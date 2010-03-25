/**
 * This test checks that we handle the server dropping the connection
 * on starttls. Since fakeserver doesn't support STARTTLS, I've made
 * it drop the connection when it's attempted.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../mailnews/resources/alertTestUtils.js");

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

var gGotAlert = false;

// Dummy message window that ensures we get prompted for logins.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};


function alert(aDialogTitle, aText) {
  do_check_eq(aText.indexOf("Server localhost has disconnected"), 0);
  gGotAlert = true;
}

function run_test() {
  // set up IMAP fakeserver and incoming server
  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, "");
  gIMAPServer._handler.dropOnStartTLS = true;
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.socketType = Ci.nsMsgSocketType.alwaysSTARTTLS;

  // we need a local account for the IMAP server to have its sent messages in
  loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let imapAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gIMAPIncomingServer;
  acctMgr.defaultAccount = imapAccount;

  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  // The server doesn't support more than one connection
  prefBranch.setIntPref("mail.server.server1.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.server1.download_on_biff", false);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("Inbox")
                                  .QueryInterface(Ci.nsIMsgImapMailFolder);

  do_test_pending();

  registerAlertTestUtils();

  gIMAPInbox.updateFolderWithListener(dummyMsgWindow, UrlListener);
}

var UrlListener =
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for failure.
    do_check_false(Components.isSuccessCode(rc));
    do_timeout_function(1000, endTest);
  }
};

function endTest() {
  do_check_true(gGotAlert);
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
