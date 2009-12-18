/**
 * This test checks to see if the imap password failure is handled correctly.
 * The steps are:
 *   - Have an invalid password in the password database.
 *   - Check we get a prompt asking what to do.
 *   - Check retry does what it should do.
 *   - Check cancel does what it should do.
 *   - Re-initiate connection, this time select enter new password, check that
 *     we get a new password prompt and can enter the password.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../mailnews/resources/alertTestUtils.js");

const kUserName = "user";
const kInvalidPassword = "imaptest";
const kValidPassword = "password";

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

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};

var incomingServer, server;
var attempt = 0;

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
    // Third attempt, retry.
    case 3:
      dump("\nAttempting Retry\n");
      return 0;
    // Fourth attempt, enter a new password.
    case 4:
      dump("\nEnter new password\n");
      return 2;
    default:
      do_throw("unexpected attempt number " + attempt);
      return 1;
  }
}

function promptPasswordPS(aParent, aDialogTitle, aText, aPassword, aCheckMsg,
                          aCheckState) {
  if (attempt == 4) {
    aPassword.value = kValidPassword;
    aCheckState.value = true;
    return true;
  }
  return false;
}

function run_test() {
  do_test_pending();

  // Passwords File (generated from Mozilla 1.8 branch).
  let signons = do_get_file("../../mailnews/data/signons-mailnews1.8-imap.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  registerAlertTestUtils();

  let daemon = new imapDaemon();
  daemon.createMailbox("Subscribed", {subscribed : true});
  server = makeServer(daemon, "");
  server.setDebugLevel(fsDebugAll);

  incomingServer = createLocalIMAPServer();

  // PerformExpand expects us to already have a password loaded into the
  // incomingServer when we call it, so force a get password call to get it
  // out of the signons file (first removing the value that
  // createLocalIMAPServer puts in there).
  incomingServer.password = "";
  let password = incomingServer.getPasswordWithUI("Prompt Message",
                                                  "Prompt Title", null, {});

  // The fake server expects one password, but we're feeding it an invalid one
  // initially so that we can check what happens when password is denied.
  do_check_eq(password, kInvalidPassword);

  // First step, try and perform a subscribe where we won't be able to log in.
  // This covers attempts 1 and 2 in confirmEx.
  dump("\nperformExpand 1\n\n");

  incomingServer.performExpand(dummyMsgWindow);
  server.performTest("SUBSCRIBE");

  dump("\nfinished subscribe 1\n\n");

  do_check_eq(attempt, 2);

  let rootFolder = incomingServer.rootFolder;
  do_check_true(rootFolder.containsChildNamed("Inbox"));
  do_check_false(rootFolder.containsChildNamed("Subscribed"));

  // Check that we haven't forgetton the login even though we've retried and
  // canceled.
  let loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

  let count = {};
  let logins = loginMgr.findLogins(count, "imap://localhost", null,
                                   "imap://localhost");

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUserName);
  do_check_eq(logins[0].password, kInvalidPassword);

  server.resetTest();

  dump("\nperformExpand 2\n\n");

  incomingServer.performExpand(dummyMsgWindow);
  server.performTest("SUBSCRIBE");

  dump("\nfinished subscribe 2\n");

  do_check_true(rootFolder.containsChildNamed("Inbox"));
  do_check_true(rootFolder.containsChildNamed("Subscribed"));

  // Now check the new one has been saved.
  logins = loginMgr.findLogins(count, "imap://localhost", null,
                               "imap://localhost");

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUserName);
  do_check_eq(logins[0].password, kValidPassword);

  do_timeout(500, endTest);
}

function endTest() {
  incomingServer.closeCachedConnections();
  server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
