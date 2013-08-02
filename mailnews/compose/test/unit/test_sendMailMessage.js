/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * This test currently consists of verifying the correct protocol sequence
 * between mailnews and SMTP server. It does not check the data of the message
 * either side of the link, it will be extended later to do that.
 */
Components.utils.import("resource:///modules/mailServices.js");

var test = null;
var server;

const kSender = "from@foo.invalid";
const kTo = "to@foo.invalid";
const kUsername = "testsmtp";
const kPassword = "smtptest";

function test_RFC2821() {

  // Test file
  var testFile = do_get_file("data/message1.eml");

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();

  var smtpServer = getBasicSmtpServer();
  var identity = getSmtpIdentity(kSender, smtpServer);

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // Just a basic test to check we're sending mail correctly.
    test = "Basic sendMailMessage";

    MailServices.smtp.sendMailMessage(testFile, kTo, identity,
                                      null, null, null, null,
                                      false, {}, {});

    server.performTest();

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "MAIL FROM:<" + kSender + "> SIZE=155",
                                       "RCPT TO:<" + kTo + ">",
                                       "DATA"]);

    server.resetTest();

    // This time with auth
    test = "Auth sendMailMessage";

    smtpServer.authMethod = Ci.nsMsgAuthMethod.passwordCleartext;
    smtpServer.socketType = Ci.nsMsgSocketType.plain;
    smtpServer.username = kUsername;
    smtpServer.password = kPassword;

    MailServices.smtp.sendMailMessage(testFile, kTo, identity,
                                      null, null, null, null,
                                      false, {}, {});

    server.performTest();

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kPassword),
                                       "MAIL FROM:<" + kSender + "> SIZE=155",
                                       "RCPT TO:<" + kTo + ">",
                                       "DATA"]);


  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();
  
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}

function run_test() {
  server = setupServerDaemon();

  test_RFC2821();
}
