/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for SMTP.
 */

var server;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

function run_test() {
  server = setupServerDaemon();

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../mailnews/test/data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

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

    // This time with auth
    test = "Auth sendMailMessage";

    smtpServer.authMethod = 1;
    smtpServer.useSecAuth = false;
    smtpServer.trySecAuth = false;
    smtpServer.trySSL = false;
    smtpServer.username = "testsmtp";

    smtpService.sendMailMessage(testFile, kTo, identity,
                                null, null, null, null,
                                false, {}, {});

    server.performTest();

    // Auth plain is btoa('\u0000testsmtp\u0000smtptest');
    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "AUTH PLAIN AHRlc3RzbXRwAHNtdHB0ZXN0",
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
