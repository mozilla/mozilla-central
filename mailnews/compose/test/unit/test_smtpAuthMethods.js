/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for SMTP.
 *
 * Test code <copied from="test_pop3AuthMethods.js">
 */

var server;
var handler;
var smtpServer;
var smtpService;
var testFile;
var identity;

const kUsername = "fred";
const kPassword = "wilma";
const kSender = "from@invalid.com";
const kTo = "to@invalid.com";
const MAILFROM = "MAIL FROM:<" + kSender + "> SIZE=155";
const RCPTTO = "RCPT TO:<" + kTo + ">";
const AUTHPLAIN = "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kPassword);

var tests = [
  { title: "Cleartext password, with server supporting AUTH PLAIN, LOGIN, and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "EHLO test", AUTHPLAIN, MAILFROM, RCPTTO, "DATA" ] },
  { title: "Cleartext password, with server only supporting AUTH LOGIN",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordCleartext,
    serverAuthMethods : [ "LOGIN" ],
    expectSuccess : true,
    transaction: [ "EHLO test", "AUTH LOGIN", MAILFROM, RCPTTO, "DATA" ] },
  { title: "Encrypted password, with server supporting AUTH PLAIN, LOGIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN", "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "EHLO test", "AUTH CRAM-MD5", MAILFROM, RCPTTO, "DATA" ] },
  { title: "Encrypted password, with server only supporting AUTH PLAIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "PLAIN" ],
    expectSuccess : false,
    transaction: [ "EHLO test"] },
  { title: "Any secure method, with server supporting AUTH PLAIN, LOGIN and CRAM",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" , "LOGIN", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "EHLO test", "AUTH CRAM-MD5", MAILFROM, RCPTTO, "DATA" ] },
  { title: "Any secure method, with server only supporting AUTH PLAIN (must fail)",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "PLAIN" ],
    expectSuccess : false,
    transaction: [ "EHLO test" ] },
];



function nextTest() {
  if (tests.length == 0)
  {
    // this is sync, so we run into endTest() at the end of run_test() now
    return;
  }
  server.resetTest();

  var curTest = tests.shift();
  test = curTest.title;
  dump("NEXT test: " + curTest.title + "\n");


  // Adapt to curTest
  handler.kAuthSchemes = curTest.serverAuthMethods;
  smtpServer.authMethod = curTest.clientAuthMethod;

  // Run test
  smtpService.sendMailMessage(testFile, kTo, identity,
                              null, null, null, null,
                              false, {}, {});
  server.performTest();

  do_check_transaction(server.playTransaction(), curTest.transaction);

  nextTest();
}

function run_test() {
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    handler = new SMTP_RFC2821_handler(new smtpDaemon());
    server = new nsMailServer(handler);
    handler.kUsername = kUsername;
    handler.kPassword = kPassword;
    handler.kAuthRequired = true;
    dump("AUTH PLAIN = " + AUTHPLAIN + "\n");
    server.start(SMTP_PORT);

    loadLocalMailAccount();
    smtpServer = getBasicSmtpServer();
    smtpServer.socketType = Ci.nsMsgSocketType.plain;
    smtpServer.username = handler.kUsername;
    smtpServer.password = handler.kPassword;
    identity = getSmtpIdentity(kSender, smtpServer);
    smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
                        .getService(Ci.nsISmtpService);

    testFile = do_get_file("data/message1.eml");

    nextTest();

  } catch (e) {
    do_throw(e);
  } finally {
    endTest();
  }
}

function endTest() {
    dump("endTest()\n");
    server.stop();

    dump("emptying event loop\n");
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents()) {
        dump("next event\n");
      thread.processNextEvent(true);
    }
}
