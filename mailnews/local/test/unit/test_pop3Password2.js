/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for POP3 - checks for servers whose details have
 * changed (e.g. realusername and realhostname are different from username and
 * hostname).
 */
var type = null;
var test = null;
var server;
var daemon;
var incomingServer;
var pop3Service;
var firstTest = true;
var thisTest;

// The fake server doesn't support AUTH and CAPA (not part of RFC 1939),
// but mailnews correctly tries anyway.
var tests = [
  { title: "Get New Mail, One Message",
    messages: ["message1.eml"],
    transaction: [ "AUTH", "CAPA", "USER testpop3", "PASS pop3test", "STAT", "LIST",
                   "UIDL", "XTND XLST Message-Id",
                   "RETR 1", "DELE 1" ] }
];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      var transaction = server.playTransaction();

      do_check_transaction(transaction, thisTest.transaction);

      do_check_eq(gLocalInboxFolder.getTotalMessages(false), thisTest.messages.length);

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
    do_timeout(0, "checkBusy();");
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
    do_timeout(20, "checkBusy();");
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
    pop3Service.GetNewMail(null, urlListener, gLocalInboxFolder,
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
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  // Disable new mail notifications
  prefSvc.setBoolPref("mail.biff.play_sound", false);
  prefSvc.setBoolPref("mail.biff.show_alert", false);
  prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
  prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);

  // These preferences set up a local pop server that has had its hostname
  // and username changed from the original settings. We can't do this by
  // function calls for this test as they would cause the password to be
  // forgotten when changing the hostname/username and this breaks the test.
  prefSvc.setCharPref("mail.account.account1.server", "server1");
  prefSvc.setCharPref("mail.account.account2.server", "server2");
  prefSvc.setCharPref("mail.account.account2.identities", "id1");
  prefSvc.setCharPref("mail.accountmanager.accounts", "account1,account2");
  prefSvc.setCharPref("mail.accountmanager.localfoldersserver", "server1");
  prefSvc.setCharPref("mail.accountmanager.defaultaccount", "account2");
  prefSvc.setCharPref("mail.identity.id1.fullName", "testpop3");
  prefSvc.setCharPref("mail.identity.id1.useremail", "testpop3@localhost");
  prefSvc.setBoolPref("mail.identity.id1.valid", true);
  prefSvc.setCharPref("mail.server.server1.directory-rel", "[ProfD]Mail/Local Folders");
  prefSvc.setCharPref("mail.server.server1.hostname", "Local Folders");
  prefSvc.setCharPref("mail.server.server1.name", "Local Folders");
  prefSvc.setCharPref("mail.server.server1.type", "none");
  prefSvc.setCharPref("mail.server.server1.userName", "nobody");
  prefSvc.setCharPref("mail.server.server2.directory-rel", "[ProfD]Mail/invalid");
  prefSvc.setCharPref("mail.server.server2.hostname", "invalid");
  prefSvc.setCharPref("mail.server.server2.name", "testpop3 on localhost");
  prefSvc.setIntPref("mail.server.server2.port", 1134);
  prefSvc.setCharPref("mail.server.server2.realhostname", "localhost");
  prefSvc.setCharPref("mail.server.server2.realuserName", "testpop3");
  prefSvc.setCharPref("mail.server.server2.type", "pop3");
  prefSvc.setCharPref("mail.server.server2.userName", "othername");

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../mailnews/test/data/signons-mailnews1.8-alt.txt");

  // Copy the file to the profile directory
  signons.copyTo(gProfileDir, "signons.txt");

  // Set up the Server
  var serverArray = setupServerDaemon();
  daemon = serverArray[0];
  server = serverArray[1];

  // Set the server expected username & password to what we have in signons.txt
  serverArray[2].expectedUsername = "testpop3";
  serverArray[2].expectedPassword = "pop3test";

  type = "RFC 1939";

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  acctMgr.LoadAccounts();

  gLocalIncomingServer = acctMgr.localFoldersServer;

  var rootFolder = gLocalIncomingServer.rootMsgFolder;

  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  gLocalInboxFolder = rootFolder.addSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  gLocalInboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);

  // Create the incoming server with "original" details.
  incomingServer = acctMgr.getIncomingServer("server2");

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  do_check_eq(gLocalInboxFolder.getTotalMessages(false), 0);

  pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                      .getService(Ci.nsIPop3Service);
  var prefsFile = do_get_file("../testprefs1.js", true);
  var realPrefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService);
  realPrefSvc.savePrefFile(prefsFile);

  do_test_pending();

  testNext();
}
