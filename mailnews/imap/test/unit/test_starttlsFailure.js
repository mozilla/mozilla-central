/**
 * This test checks that we handle the server dropping the connection
 * on starttls. Since fakeserver doesn't support STARTTLS, I've made
 * it drop the connection when it's attempted.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/asyncTestUtils.js");

var gGotAlert = false;

function alert(aDialogTitle, aText) {
  do_check_eq(aText.indexOf("Server Mail for  has disconnected"), 0);
  gGotAlert = true;
}

var tests = [
  setup,
  check_alert,
  teardown
];

function setup() {
  // set up IMAP fakeserver and incoming server
  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, "", {dropOnStartTLS: true});
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

  // The server doesn't support more than one connection
  Services.prefs.setIntPref("mail.server.server1.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.server1.download_on_biff", false);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("Inbox")
                                  .QueryInterface(Ci.nsIMsgImapMailFolder);

  registerAlertTestUtils();

  gIMAPInbox.updateFolderWithListener(gDummyMsgWindow, asyncUrlListener);
  yield false;
}

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_false(Components.isSuccessCode(aExitCode));
};

function check_alert() {
  do_check_true(gGotAlert);
}

function teardown() {
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

function run_test() {
  async_run_tests(tests);
}
