/**
 * This test checks to see if the pop3 password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Re-initiate connection, this time select enter new password, check that
 *     we get a new password prompt and can enter the password.
 *
 * XXX Due to problems with the fakeserver + smtp not using one connection for
 * multiple sends, the first part of this test is in
 * test_smtpPasswordFailure2.js.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/alertTestUtils.js");

var server;
var attempt = 0;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";
const kUsername = "testsmtp";
// This is the same as in the signons file.
const kInvalidPassword = "smtptest";
const kValidPassword = "smtptest1";

var dummyDocShell =
{
  getInterface: function (iid) {
    if (iid.equals(Ci.nsIAuthPrompt)) {
      return Cc["@mozilla.org/login-manager/prompter;1"]
               .getService(Ci.nsIAuthPrompt);
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDocShell,
                                         Ci.nsIInterfaceRequestor])
}

// Dummy message window that ensures we get prompted for logins.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};

function alert(aDialogText, aText)
{
  // The first few attempts may prompt about the password problem, the last
  // attempt shouldn't.
  do_check_true(attempt < 4);

  // Log the fact we've got an alert, but we don't need to test anything here.
  dump("Alert Title: " + aDialogText + "\nAlert Text: " + aText + "\n");
}

function confirmEx(aDialogTitle, aText, aButtonFlags, aButton0Title,
                   aButton1Title, aButton2Title, aCheckMsg, aCheckState) {
  switch (++attempt) {
    // First attempt, retry.
    case 1:
      dump("\nAttempting Retry\n");
      return 0;
    // Second attempt, enter a new password.
    case 2:
      dump("\nEnter new password\n");
      return 2;
    default:
      do_throw("unexpected attempt number " + attempt);
      return 1;
  }
}

function promptPasswordPS(aParent, aDialogTitle, aText, aPassword, aCheckMsg,
                          aCheckState) {
  if (attempt == 2) {
    aPassword.value = kValidPassword;
    aCheckState.value = true;
    return true;
  }
  return false;
}

function run_test() {
  var handler = new SMTP_RFC2821_handler(new smtpDaemon());
  server = new nsMailServer(handler);
  // Username needs to match signons.txt
  handler.kUsername = kUsername;
  handler.kPassword = kValidPassword;
  handler.kAuthRequired = true;
  handler.kAuthSchemes = [ "PLAIN", "LOGIN" ]; // make match expected transaction below

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../../data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  registerAlertTestUtils();

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

    smtpServer.authMethod = Ci.nsMsgAuthMethod.passwordCleartext;
    smtpServer.socketType = Ci.nsMsgSocketType.plain;
    smtpServer.username = kUsername;

    dump("Send\n");

    smtpService.sendMailMessage(testFile, kTo, identity,
                                null, null, null, null,
                                false, {}, {});

    server.performTest();

    dump("End Send\n");

    do_check_eq(attempt, 2);

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       // attempt 3 invalid password
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kInvalidPassword),
                                       "AUTH LOGIN",
                                       // attempt 4 which retries
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kInvalidPassword),
                                       "AUTH LOGIN",
                                       // then we enter the correct password
                                       "AUTH PLAIN " + AuthPLAIN.encodeLine(kUsername, kValidPassword),
                                       "MAIL FROM:<" + kSender + "> SIZE=155",
                                       "RCPT TO:<" + kTo + ">",
                                       "DATA"]);


      // Now check the new one has been saved.
      let loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

      let count = {};
      let logins = loginMgr.findLogins(count, "smtp://localhost", null,
                                     "smtp://localhost");

    do_check_eq(count.value, 1);
    do_check_eq(logins[0].username, kUsername);
    do_check_eq(logins[0].password, kValidPassword);
    do_test_finished();

  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}
