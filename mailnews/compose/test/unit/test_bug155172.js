/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for SMTP.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kPromptServiceDescription = "Test Prompt Service";
const kPromptServiceClassID = Components.ID("4637b567-6e2d-4a24-9775-e8fc0fb159ba");
const kPromptServiceContractID = "@mozilla.org/embedcomp/prompt-service;1";

var testPromptService = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptService,
                                         Ci.nsIPromptService2]),

  createInstance: function (outer, iid) {
    return this.QueryInterface(iid);
  },

  // nsIPromptService
  alert: function (aParent, aDialogTitle, aText) {
    do_throw("alert should not be called");
  },
  alertCheck: function (aParent, aDialogTitle, aText, aCheckMsg, aCheckState) {
    do_throw("alertCheck should not be called");
  },
  confirm: function (aParent, aDialogTitle, aText) {
    do_throw("confirm should not be called");
  },
  confirmCheck: function (aParent, aDialogTitle, aText, aCheckMsg, aCheckState) {
    do_throw("confirmCheck should not be called");
  },
  confirmEx: function (aParent, aDialogTitle, aText, aButtonFlags,
                       aButton0Title, aButton1Title, aButton2Title,
                       aCheckMsg, aCheckState) {
    do_throw("confirmEx should not be called");
  },
  prompt: function (aParent, aDialogTitle, aText, aValue, aCheckMsg,
                    aCheckState) {
    do_throw("prompt should not be called");
  },
  promptUsernameAndPassword: function (aParent, aDialogTitle, aText, aUsername,
                                       aPassword, aCheckMsg, aCheckState) {
    do_throw("promptUsernameAndPassword should not be called");
  },
  promptPassword: function (aParent, aDialogTitle, aText,
                            aPassword, aCheckMsg, aCheckState) {
    aPassword.value = this._newPassword;
    return true;
  },
  select: function (aParent, aDialogTitle, aText, aCount, aSelectList,
                    aOutSelection) {
    do_throw("promptPassword should not be called");
  }
};

var server;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";
const kUsername = "test.smtp@fakeserver";
// kPassword 2 is the one defined in signons-mailnews1.8.txt, the other one
// is intentionally wrong.
const kPassword1 = "wrong";
const kPassword2 = "smtptest";

function run_test() {
  // Register our prompt service
  var componentManager = Components.manager
                                   .QueryInterface(Ci.nsIComponentRegistrar);
  componentManager.registerFactory(kPromptServiceClassID,
                                   kPromptServiceDescription,
                                   kPromptServiceContractID,
                                   testPromptService);


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
    testPromptService._newPassword = kPassword1;

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
