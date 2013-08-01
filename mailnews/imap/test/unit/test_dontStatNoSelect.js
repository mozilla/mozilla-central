// This file tests that checking folders for new mail with STATUS
// doesn't try to STAT noselect folders.

var gServer, gImapServer;
var gIMAPInbox, gIMAPFolder1, gIMAPFolder2;
var gFolder2Mailbox;
var gFolder1, gFolder2;

load("../../../resources/messageGenerator.js");
// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

Components.utils.import("resource:///modules/mailServices.js");

var tests = [
  checkStatSelect,
  checkStatNoSelect,
  endTest
];

function run_test() {
  var daemon = new imapDaemon();
  daemon.createMailbox("folder 1", {subscribed : true});
  let folder1Mailbox = daemon.getMailbox("folder 1");
  folder1Mailbox.flags.push("\\Noselect");
  daemon.createMailbox("folder 2", {subscribed : true});
  gFolder2Mailbox = daemon.getMailbox("folder 2");
  addMessageToFolder(gFolder2Mailbox);
  gServer = makeServer(daemon, "");

  gImapServer = createLocalIMAPServer();
  gImapServer.maximumConnectionsNumber = 1;

  loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let localAccount = MailServices.accounts.createAccount();
  let identity = MailServices.accounts.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = gLocalIncomingServer;
  MailServices.accounts.defaultAccount = localAccount;

  // Let's also have another account, using the same identity
  let imapAccount = MailServices.accounts.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gImapServer;

  // Get the folder list...
  gImapServer.performExpand(null);
  gServer.performTest("SUBSCRIBE");
  // pref tuning: one connection only, turn off notifications
  // Make sure no biff notifications happen
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  let rootFolder = gImapServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);
  gFolder1 = rootFolder.getChildNamed("folder 1");
  gFolder2 = rootFolder.getChildNamed("folder 2");
  gFolder1.setFlag(Ci.nsMsgFolderFlags.CheckNew);
  gFolder2.setFlag(Ci.nsMsgFolderFlags.CheckNew);
  //start first test
  async_run_tests(tests);
}

function checkStatSelect() {
  // imap fake server's resetTest resets the authentication state - charming.
  // So poke the _test member directly.
  gServer._test = true;
  gIMAPInbox.getNewMessages(null, null);
  gServer.performTest("STATUS");
  // We want to wait for the STATUS to be really done before we issue
  // more STATUS commands, so we do a NOOP on the
  // INBOX, and since we only have one connection with the fake server,
  // that will essentially serialize things.
  gServer._test = true;
  gIMAPInbox.updateFolder(null);
  gServer.performTest("NOOP");
  yield true;
}

function checkStatNoSelect() {
  // folder 2 should have been stat'd, but not folder 1. All we can really check
  // is that folder 2 was stat'd and that its unread msg count is 1
  do_check_eq(gFolder2.getNumUnread(false), 1);
  addMessageToFolder(gFolder2Mailbox);
  gFolder1.clearFlag(Ci.nsMsgFolderFlags.ImapNoselect);
  gServer._test = true;
  // we've cleared the ImapNoselect flag, so we will attempt to STAT folder 1,
  // which will fail. So we verify that we go on and STAT folder 2, and that
  // it picks up the message we added to it above.
  MailServices.mailSession.AddFolderListener(gFolderListener,
                                             Ci.nsIFolderListener.boolPropertyChanged);
  gIMAPInbox.getNewMessages(null, null);
  // Wait for the folder listener to get told about new messages.
  yield false;
}

function addMessageToFolder(mbox) {
  // make a couple messges
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());

  let msgURI =
    Services.io.newURI("data:text/plain;base64," +
                       btoa(messages[0].toMessageString()),
                       null, null);
  let message = new imapMessage(msgURI.spec, mbox.uidnext++);
  mbox.addMessage(message);
}

function endTest()
{
  do_check_eq(gFolder2.getNumUnread(false), 2);
  // Clean up the server in preparation
  gServer.resetTest();
  gImapServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  yield true;
}

var gFolderListener = {
  OnItemBoolPropertyChanged : function(aItem, aProperty, aOldValue, aNewValue) {
    // This means that the STAT on "folder 2" has finished.
    if (aProperty == "NewMessages" && aNewValue == true)
      async_driver();
  }
};
