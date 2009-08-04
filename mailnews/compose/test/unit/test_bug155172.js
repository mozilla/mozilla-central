/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for SMTP.
 */

load("../../mailnews/resources/alertTestUtils.js");

var gNewPassword = null;

function confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
                   aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
  // Just return 2 which will is pressing button 2 - enter a new password.
  return 2;
}

function promptPasswordPS(aParent, aDialogTitle, aText, aPassword,
                          aCheckMsg, aCheckState) {
  aPassword.value = gNewPassword;
  return true;
}

var server;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";
const kUsername = "test.smtp@fakeserver";
// kPassword 2 is the one defined in signons-mailnews1.8.txt, the other one
// is intentionally wrong.
const kPassword1 = "wrong";
const kPassword2 = "smtptest";

function run_test() {
  registerAlertTestUtils();

  var handler = new SMTP_RFC2822_handler(new smtpDaemon());

  handler._username = kUsername;
  handler._password = kPassword1;

  server = setupServerDaemon(handler);
  server.setDebugLevel(fsDebugAll);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("data/signons-smtp.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  // Test file
  var testFile = do_get_file("data/message1.eml");

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
    smtpServer.username = kUsername;

    smtpService.sendMailMessage(testFile, kTo, identity,
                                null, null, null, null,
                                false, {}, {});

    // Set the new password for when we get a prompt
    gNewPassword = kPassword1;

    server.performTest();

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "AUTH PLAIN " + btoa('\u0000' +
                                                            kUsername +
                                                            '\u0000' +
                                                            kPassword2),
                                       "AUTH PLAIN " + btoa('\u0000' +
                                                            kUsername +
                                                            '\u0000' +
                                                            kPassword1),
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
