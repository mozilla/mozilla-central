/**
 * This test checks that we handle the server dropping the connection
 * on starttls. Since fakeserver doesn't support STARTTLS, I've made
 * it drop the connection when it's attempted.
 */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/asyncTestUtils.js");

var gGotAlert = false;

function alert(aDialogTitle, aText) {
  do_check_true(aText.startsWith("Server Mail for  has disconnected"));
  gGotAlert = true;
}

var tests = [
  setup,
  check_alert,
  teardown
];

function setup() {
  // set up IMAP fakeserver and incoming server
  IMAPPump.daemon = new imapDaemon();
  IMAPPump.server = makeServer(IMAPPump.daemon, "", {dropOnStartTLS: true});
  IMAPPump.incomingServer = createLocalIMAPServer();
  IMAPPump.incomingServer.socketType = Ci.nsMsgSocketType.alwaysSTARTTLS;

  // we need a local account for the IMAP server to have its sent messages in
  localAccountUtils.loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let imapAccount = MailServices.accounts.createAccount();
  let identity = MailServices.accounts.createIdentity();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = IMAPPump.incomingServer;
  MailServices.accounts.defaultAccount = imapAccount;

  // The server doesn't support more than one connection
  Services.prefs.setIntPref("mail.server.server1.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.server1.download_on_biff", false);

  IMAPPump.inbox = IMAPPump.incomingServer.rootFolder.getChildNamed("Inbox")
                                  .QueryInterface(Ci.nsIMsgImapMailFolder);

  registerAlertTestUtils();

  IMAPPump.inbox.updateFolderWithListener(gDummyMsgWindow, asyncUrlListener);
  yield false;
}

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_false(Components.isSuccessCode(aExitCode));
};

function check_alert() {
  do_check_true(gGotAlert);
}

function teardown() {
  IMAPPump.incomingServer.closeCachedConnections();
  IMAPPump.server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

function run_test() {
  async_run_tests(tests);
}
