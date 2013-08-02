/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Login tests for POP3
 *
 * Test code <copied from="test_pop3GetNewMail.js">
 */

Components.utils.import("resource:///modules/mailServices.js");

var server;
var daemon;
var handler;
var incomingServer;
var thisTest;
var test = null;

var tests = [
  { title: "Cleartext password, with server only supporting USER/PASS",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "USER fred", "PASS wilma", "STAT" ] },
  // Just to make sure we clear the auth flags and re-issue "AUTH"
  { title: "Second time Cleartext password, with server only supporting USER/PASS",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "USER fred", "PASS wilma", "STAT" ] },
  { title: "Cleartext password, with server supporting AUTH PLAIN, LOGIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH PLAIN", "STAT" ] },
  { title: "Cleartext password, with server supporting only AUTH LOGIN",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "LOGIN" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH LOGIN", "STAT" ] },
  { title: "Encrypted password, with server supporting PLAIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH CRAM-MD5", "STAT" ] },
  { title: "Encrypted password, with server only supporting AUTH PLAIN and LOGIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN", "LOGIN" ],
    expectSuccess : false,
    transaction: [ "AUTH", "CAPA"] },
  { title: "Any secure method, with server supporting AUTH PLAIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" , "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH CRAM-MD5", "STAT" ] },
  { title: "Any secure method, with server only supporting AUTH PLAIN and LOGIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" ],
    expectSuccess : false,
    transaction: [ "AUTH", "CAPA" ] }
];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      if (thisTest.expectSuccess)
        do_check_eq(result, 0);
      else
        do_check_neq(result, 0);

      var transaction = server.playTransaction();
      do_check_transaction(transaction, thisTest.transaction);

      do_timeout(0, checkBusy);
    } catch (e) {
      server.stop();
      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }
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
    server.resetTest();

    test = thisTest.title;
    dump("NEXT test: " + thisTest.title + "\n");

    handler.kAuthSchemes = thisTest.serverAuthMethods;

    // Mailnews caches server capabilities, so try to reset it
    // (alternative would be .pop3CapabilityFlags = 0, but this is safer)
    deletePop3Server();
    incomingServer = createPop3Server();

    let msgServer = incomingServer;
    msgServer.QueryInterface(Ci.nsIMsgIncomingServer);
    msgServer.authMethod = thisTest.clientAuthMethod;

    MailServices.pop3.GetNewMail(null, urlListener, gLocalInboxFolder,
                                 incomingServer);
    server.performTest();
  } catch (e) {
    server.stop();
    do_throw(e);
  }
}

// <copied from="head_maillocal.js::createPop3ServerAndLocalFolders()">
function createPop3Server()
{
  let incoming = MailServices.accounts.createIncomingServer("fred", "localhost", "pop3");
  incoming.port = POP3_PORT;
  incoming.password = "wilma";
  return incoming;
}
//</copied>

function deletePop3Server()
{
  if (!incomingServer)
    return;
  MailServices.accounts.removeIncomingServer(incomingServer, true);
  incomingServer = null;
}

function run_test() {
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  ssd = setupServerDaemon();
  daemon = ssd[0];
  server = ssd[1];
  handler = ssd[2];
  server.start(POP3_PORT);

  //incomingServer = createPop3ServerAndLocalFolders();
  localAccountUtils.loadLocalMailAccount();

  do_test_pending();

  testNext();
}
