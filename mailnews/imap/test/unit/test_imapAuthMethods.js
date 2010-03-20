/**
 * Login tests for IMAP
 *
 * Test code <copied from="test_mailboxes.js">
 * and <copied from="test_pop3AuthMethods.js">
 *
 * BUGS:
 * - cleanup after each test doesn't seem to work correctly. Effects:
 *    - one more "lsub" per test, e.g. "capability", "auth...", "lsub", "lsub", "lsub", "list" in the 3. test.,
 *    - root folder check succeeds although login failed
 * - removeIncomingServer(..., true); (cleanup files) fails.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
load("../../mailnews/resources/alertTestUtils.js");

//const kUsername = "fred";
//const kPassword = "wilma";

var acctMgr;
var thisTest;
var test = null;

var tests = [
  { title: "Cleartext password, with server only supporting old-style login",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [],
    expectSuccess : true,
    transaction: [ "capability", "login", "lsub" ] },
  // Just to make sure we clean up properly - in the test and in TB, e.g. don't cache stuff
  { title: "Second time Cleartext password, with server only supporting old-style login",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [],
    expectSuccess : true,
    transaction: [ "capability", "login", "lsub" ] },
 { title: "Cleartext password, with server supporting AUTH PLAIN, LOGIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "capability", "authenticate PLAIN", "lsub" ] },
  { title: "Cleartext password, with server supporting only AUTH LOGIN",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "LOGIN" ],
    expectSuccess : true,
    transaction: [ "capability", "authenticate LOGIN", "lsub" ] },
  { title: "Encrypted password, with server supporting PLAIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "capability", "authenticate CRAM-MD5", "lsub" ] },
  { title: "Encrypted password, with server only supporting AUTH PLAIN and LOGIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN", "LOGIN" ],
    expectSuccess : false,
    transaction: [ "capability" ] },
  { title: "Any secure method, with server supporting AUTH PLAIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" , "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "capability", "authenticate CRAM-MD5", "lsub" ] },
  { title: "Any secure method, with server only supporting AUTH PLAIN and LOGIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" ],
    expectSuccess : false,
    transaction: [ "capability" ] },
];

function nextTest() {
  try {
    thisTest = tests.shift();
    if (!thisTest)
    {
        endTest();
        return;
    }
    /* doesn't work, hangs on first performTest(...)
    {
      dump("resetTest()\n");
      server.resetTest();
      dump("server.performTest()\n");
      server.performTest();
    }*/

    test = thisTest.title;
    dump("NEXT test: " + thisTest.title + "\n");

    // (re)create fake server
    var daemon = new imapDaemon();
    var server = makeServer(daemon, "");
    server.setDebugLevel(fsDebugAll);
    var handler = server._handler;
    //handler.kUsername = kUsername;
    //handler.kPassword = kPassword;
    //daemon.createMailbox("somemailbox");

    handler.kAuthSchemes = thisTest.serverAuthMethods;

    // If Mailnews ever caches server capabilities, delete and re-create the incomingServer here
    var incomingServer = createLocalIMAPServer();

    let msgServer = incomingServer;
    msgServer.QueryInterface(Ci.nsIMsgIncomingServer);
    msgServer.authMethod = thisTest.clientAuthMethod;

    // connect
    incomingServer.performExpand(null);
    server.performTest("LSUB");

    dump("should " + (thisTest.expectSuccess ? "":"not ") + "be logged in\n");
    do_check_eq(true, incomingServer instanceof Ci.nsIImapServerSink);
    //do_check_eq(thisTest.expectSuccess, incomingServer.userAuthenticated); TODO fails second time
    //var rootFolder = incomingServer.rootFolder;
    // Client creates fake Inbox, so check other folder
    //do_check_eq(thisTest.expectSuccess,
    //    rootFolder.containsChildNamed("somemailbox")); TODO
    do_check_transaction(server.playTransaction(), thisTest.transaction, false);

    do {
      incomingServer.closeCachedConnections();
    } while (incomingServer.serverBusy)
    incomingServer.shutdown();
    incomingServer.clearAllValues();
    deleteIMAPServer(incomingServer);
    acctMgr.closeCachedConnections();
    acctMgr.shutdownServers();
    acctMgr.UnloadAccounts();
    server.stop();

  } catch (e) {
    //server.stop();
    //endTest();
    do_throw(e);
  }

  nextTest();
}

function deleteIMAPServer(incomingServer) {
  if (!incomingServer)
    return;
  acctMgr.removeIncomingServer(incomingServer, false); // TODO cleanup files = true fails
  //incomingServer = null;
  acctMgr.removeAccount(acctMgr.defaultAccount);
}


function run_test() {
  // XXX BUG 553764 XXX
  // This unit test is relying on the random behavior of threads and so is
  // being disabled.
  dump("***\n***\nTHIS TEST IS DISABLED PER BUG 553764!\n***\n***\n");
  do_check_true(true);
  return;

  do_test_pending();

  registerAlertTestUtils();
  acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  nextTest();
}

function endTest() {
  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
