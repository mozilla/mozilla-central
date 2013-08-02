/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for SMTP.
 *
 * Test code <copied from="test_pop3AuthMethods.js">
 */

Components.utils.import("resource:///modules/mailServices.js");

var server;
var kAuthSchemes;
var smtpServer;
var testFile;
var identity;

const kUsername = "fred";
const kPassword = "wilma";
const kSender = "from@foo.invalid";
const kTo = "to@foo.invalid";
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
  kAuthSchemes = curTest.serverAuthMethods;
  smtpServer.authMethod = curTest.clientAuthMethod;

  // Run test
  MailServices.smtp.sendMailMessage(testFile, kTo, identity,
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
    function createHandler(d) {
      var handler = new SMTP_RFC2821_handler(d);
      handler.kUsername = kUsername;
      handler.kPassword = kPassword;
      handler.kAuthRequired = true;
      handler.kAuthSchemes = kAuthSchemes;
      return handler;
    }
    server = setupServerDaemon(createHandler);
    dump("AUTH PLAIN = " + AUTHPLAIN + "\n");
    server.start(SMTP_PORT);

    localAccountUtils.loadLocalMailAccount();
    smtpServer = getBasicSmtpServer();
    smtpServer.socketType = Ci.nsMsgSocketType.plain;
    smtpServer.username = kUsername;
    smtpServer.password = kPassword;
    identity = getSmtpIdentity(kSender, smtpServer);

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
