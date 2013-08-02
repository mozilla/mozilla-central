/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for POP3.
 */
var test = null;
var server;
var daemon;
var incomingServer;
var firstTest = true;
var thisTest;

var tests = [
  { title: "Get New Mail, No Messages",
    messages: [],
    transaction: [ "AUTH", "CAPA", "AUTH PLAIN", "STAT" ] },
  { title: "Get New Mail, No Messages 2",
    messages: [],
    transaction: [ "CAPA", "AUTH PLAIN", "STAT" ] },
  { title: "Get New Mail, One Message",
    messages: ["message1.eml"],
    transaction: [ "CAPA", "AUTH PLAIN", "STAT", "LIST",
                   "UIDL", "RETR 1", "DELE 1" ] }
];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      var transaction = server.playTransaction();

      do_check_transaction(transaction, thisTest.transaction);

      do_check_eq(localAccountUtils.inboxFolder.getTotalMessages(false),
                  thisTest.messages.length);

      do_check_eq(result, 0);
    }
    catch (e) {
      // If we have an error, clean up nicely before we throw it.
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }

    // Let OnStopRunningUrl return cleanly before doing anything else.
    do_timeout(0, checkBusy);
  }
};

function checkBusy() {
  if (tests.length == 0) {
    incomingServer.closeCachedConnections();

    // No more tests, let everything finish
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);

    do_test_finished();
    return;
  }

  // If the server hasn't quite finished, just delay a little longer.
  if (incomingServer.serverBusy ||
      (incomingServer instanceof Ci.nsIPop3IncomingServer &&
       incomingServer.runningProtocol)) {
    do_timeout(20, checkBusy);
    return;
  }

  testNext();
}

function testNext() {
  thisTest = tests.shift();

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    if (firstTest) {
      firstTest = false;

      // Start the fake POP3 server
      server.start(POP3_PORT);
    }
    else
      server.resetTest();

    // Set up the test
    test = thisTest.title;
    daemon.setMessages(thisTest.messages);

    // Now get the mail
    MailServices.pop3.GetNewMail(null, urlListener, localAccountUtils.inboxFolder,
                                 incomingServer);

    server.performTest();
  } catch (e) {
    server.stop();

    do_throw(e);
  } finally {
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}

function run_test() {
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  server = setupServerDaemon();
  daemon = server[0];
  server = server[1];

  // Set up the basic accounts and folders
  incomingServer = createPop3ServerAndLocalFolders();

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  do_check_eq(localAccountUtils.inboxFolder.getTotalMessages(false), 0);

  do_test_pending();

  testNext();
}
