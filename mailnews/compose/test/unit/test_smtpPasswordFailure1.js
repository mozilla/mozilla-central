/**
 * This test checks to see if the smtp password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Check we get a prompt asking what to do.
 *   - Check retry does what it should do.
 *   - Check cancel does what it should do.
 *
 * XXX Due to problems with the fakeserver + smtp not using one connection for
 * multiple sends, the rest of this test is in test_smtpPasswordFailure2.js.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../mailnews/resources/alertTestUtils.js");

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
      dump("\nAttempting retry\n");
      return 0;
    // Second attempt, cancel.
    case 2:
      dump("\nCancelling login attempt\n");
      return 1;
    default:
      do_throw("unexpected attempt number " + attempt);
      return 1;
  }
}

function run_test() {
  var handler = new SMTP_RFC2822_handler(new smtpDaemon(), "PLAIN", kUsername,
                                         kValidPassword);
  server = new nsMailServer(handler);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../mailnews/data/signons-mailnews1.8.txt");

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

    smtpServer.authMethod = 1;
    smtpServer.useSecAuth = false;
    smtpServer.trySecAuth = false;
    smtpServer.trySSL = false;
    smtpServer.username = kUsername;

    dump("Send\n");

    smtpService.sendMailMessage(testFile, kTo, identity,
                                null, null, null, null,
                                false, {}, {});

    server.performTest();

    dump("End Send\n");

    do_check_eq(attempt, 2);

    // Check that we haven't forgetton the login even though we've retried and
    // canceled.
    let loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

    let count = {};
    let logins = loginMgr.findLogins(count, "smtp://localhost", null,
                                     "smtp://localhost");

    do_check_eq(count.value, 1);
    do_check_eq(logins[0].username, kUsername);
    do_check_eq(logins[0].password, kInvalidPassword);
  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}
