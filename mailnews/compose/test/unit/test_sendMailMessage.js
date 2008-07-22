/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * This test currently consists of verifying the correct protocol sequence
 * between mailnews and SMTP server. It does not check the data of the message
 * either side of the link, it will be extended later to do that.
 */
var type = null;
var test = null;
var server;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

function test_RFC2822() {
  type = "RFC 2822";

  // Test file
  var testFile = do_get_file("../mailnews/compose/test/unit/data/message1.eml");

  // Ensure we have at least one mail account
  loadLocalMailAccount();

  var smtpServer = getBasicSmtpServer();
  var identity = getSmtpIdentity(kSender, smtpServer);

  var smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
                      .getService(Ci.nsISmtpService);

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // Just a basic test to check we're sending mail correctly.
    test = "Basic sendMailMessage";

    smtpService.sendMailMessage(testFile, kTo, identity,
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

    smtpServer.authMethod = 1;
    smtpServer.useSecAuth = false;
    smtpServer.trySecAuth = false;
    smtpServer.trySSL = false;
    smtpServer.username = "test";
    smtpServer.password = "password";

    smtpService.sendMailMessage(testFile, kTo, identity,
                                null, null, null, null,
                                false, {}, {});

    server.performTest();

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "AUTH PLAIN AHRlc3QAcGFzc3dvcmQ=",
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

  test_RFC2822();
}
