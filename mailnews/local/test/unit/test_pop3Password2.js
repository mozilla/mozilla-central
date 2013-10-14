/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for POP3 - checks for servers whose details have
 * changed (e.g. realusername and realhostname are different from username and
 * hostname).
 */

Components.utils.import("resource:///modules/mailServices.js");

load("../../../resources/passwordStorage.js");

var test = null;
var server;
var daemon;
var incomingServer;
var firstTest = true;
var thisTest;

var tests = [
  { title: "Get New Mail, One Message",
    messages: ["message1.eml"],
    transaction: [ "AUTH", "CAPA", "AUTH PLAIN", "STAT", "LIST",
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

  // These preferences set up a local pop server that has had its hostname
  // and username changed from the original settings. We can't do this by
  // function calls for this test as they would cause the password to be
  // forgotten when changing the hostname/username and this breaks the test.
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");
  Services.prefs.setCharPref("mail.account.account2.identities", "id1");
  Services.prefs.setCharPref("mail.accountmanager.accounts", "account1,account2");
  Services.prefs.setCharPref("mail.accountmanager.localfoldersserver", "server1");
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount", "account2");
  Services.prefs.setCharPref("mail.identity.id1.fullName", "testpop3");
  Services.prefs.setCharPref("mail.identity.id1.useremail", "testpop3@localhost");
  Services.prefs.setBoolPref("mail.identity.id1.valid", true);
  Services.prefs.setCharPref("mail.server.server1.directory-rel", "[ProfD]Mail/Local Folders");
  Services.prefs.setCharPref("mail.server.server1.hostname", "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.name", "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server1.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server2.directory-rel", "[ProfD]Mail/invalid");
  Services.prefs.setCharPref("mail.server.server2.hostname", "invalid");
  Services.prefs.setCharPref("mail.server.server2.name", "testpop3 on localhost");
  Services.prefs.setIntPref("mail.server.server2.port", 1134);
  Services.prefs.setCharPref("mail.server.server2.realhostname", "localhost");
  Services.prefs.setCharPref("mail.server.server2.realuserName", "testpop3");
  Services.prefs.setCharPref("mail.server.server2.type", "pop3");
  Services.prefs.setCharPref("mail.server.server2.userName", "othername");

  // Prepare files for passwords (generated by a script in bug 925489).
  setupForPassword("signons-mailnews1.8-alt.sqlite")

  // Set up the Server
  var serverArray = setupServerDaemon();
  daemon = serverArray[0];
  server = serverArray[1];
  var handler = serverArray[2];

  // Set the server expected username & password to what we have in signons.txt
  handler.kUsername = "testpop3";
  handler.kPassword = "pop3test";

  MailServices.accounts.LoadAccounts();

  localAccountUtils.incomingServer = MailServices.accounts.localFoldersServer;

  var rootFolder = localAccountUtils.incomingServer
                                    .rootMsgFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);

  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  localAccountUtils.inboxFolder = rootFolder.createLocalSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  localAccountUtils.inboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);

  // Create the incoming server with "original" details.
  incomingServer = MailServices.accounts.getIncomingServer("server2");

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  do_check_eq(localAccountUtils.inboxFolder.getTotalMessages(false), 0);

  do_test_pending();

  testNext();
}
