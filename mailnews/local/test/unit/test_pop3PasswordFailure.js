/**
 * This test checks to see if the pop3 password failure is handled correctly.
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

var type = null;
var test = null;
var server;
var daemon;
var incomingServer;
var pop3Service;
var attempt = 0;

const kUserName = "testpop3";
const kInvalidPassword = "pop3test";
const kValidPassword = "testpop3";

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

function getPopMail() {
  pop3Service.GetNewMail(dummyMsgWindow, urlListener, gLocalInboxFolder,
                         incomingServer);

  server.performTest();
  return false;
}

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      var transaction = server.playTransaction();

      // On the last attempt, we should have successfully got one mail.
      do_check_eq(gLocalInboxFolder.getTotalMessages(false),
                  attempt == 4 ? 1 : 0);

      // If we've just cancelled, expect binding aborted rather than success.
      do_check_eq(result, attempt == 2 ? Cr.NS_BINDING_ABORTED : 0);
    }
    catch (e) {
      // If we have an error, clean up nicely before we throw it.
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }
  }
};

function actually_run_test() {
  server.start(POP3_PORT);
  daemon.setMessages(["message1.eml"]);

  dump("\nGet Mail 1\n");

  // Now get mail
  getPopMail();

  dump("\nGot Mail 1\n");

  do_check_eq(attempt, 2);

  // Check that we haven't forgetton the login even though we've retried and
  // canceled.
  let loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

  let count = {};
  let logins = loginMgr.findLogins(count, "mailbox://localhost", null,
                                   "mailbox://localhost");

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUserName);
  do_check_eq(logins[0].password, kInvalidPassword);

  server.resetTest();

  dump("\nGet Mail 2\n");

  // Now get the mail
  getPopMail();

  dump("\nGot Mail 2\n");

  // Now check the new one has been saved.
  logins = loginMgr.findLogins(count, "mailbox://localhost", null,
                               "mailbox://localhost");

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUserName);
  do_check_eq(logins[0].password, kValidPassword);
  do_test_finished();
}

function run_test()
{
  // Disable new mail notifications
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setBoolPref("mail.biff.play_sound", false);
  prefSvc.setBoolPref("mail.biff.show_alert", false);
  prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
  prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);
  prefSvc.setBoolPref("signon.debug", true);

  // Passwords File (generated from Mozilla 1.8 branch).
  let signons = do_get_file("../../mailnews/data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  registerAlertTestUtils();

  // Set up the Server
  var serverArray = setupServerDaemon();
  daemon = serverArray[0];
  server = serverArray[1];

  // Set the server expected username & password to what we have in signons.txt
  serverArray[2].expectedUsername = kUserName;
  serverArray[2].expectedPassword = kValidPassword;

  type = "RFC 1939";

  // Set up the basic accounts and folders.
  // We would use createPop3ServerAndLocalFolders() however we want to have
  // a different username and NO password for this test (as we expect to load
  // it from signons.txt).
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  incomingServer = acctMgr.createIncomingServer(kUserName, "localhost", "pop3");

  incomingServer.port = POP3_PORT;

  // Check that we haven't got any messages in the folder, if we have its a test
  // setup issue.
  do_check_eq(gLocalInboxFolder.getTotalMessages(false), 0);

  pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                      .getService(Ci.nsIPop3Service);

  do_test_pending();

  actually_run_test();
}
