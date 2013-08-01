/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that offline imap moves handle extremely high highwater
 * marks.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
load("../../../resources/logHelper.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

var gIMAPDaemon, gServer, gIMAPIncomingServer;

var gIMAPInbox;
var gFolder1, gRootFolder;

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox)
{
  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    let dataUri = Services.io.newURI("data:text/plain;base64," +
                                      btoa(message.toMessageString()),
                                     null, null);
    mailbox.addMessage(new imapMessage(dataUri.spec, mailbox.uidnext++, []));
  });
}

function run_test()
{
  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPDaemon.createMailbox("folder 1", {subscribed : true});
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

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
  imapAccount.incomingServer = gIMAPIncomingServer;

  // pref tuning: one connection only, turn off notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
  // Don't prompt about offline download when going offline
  Services.prefs.setIntPref("offline.download.download_messages", 2);
  actually_run_test();
}

function setupFolders() {
  // make 10 messges
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);

  // build up a list of messages
  let messages = [];
  messages = messages.concat(scenarioFactory.directReply(10));

  // Add 10 messages with uids 1-10.
  let imapInbox = gIMAPDaemon.getMailbox("INBOX")
  addMessagesToServer(messages, imapInbox);
  messages = [];
  messages = messages.concat(messageGenerator.makeMessage());
  // Add a single message to move target folder.
  addMessagesToServer(messages, gIMAPDaemon.getMailbox("folder 1"));

  // Get the IMAP inbox...
  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);
  yield true;
}

function doMoves() {
  // update folders to download headers.
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  yield false;
  gFolder1 = gRootFolder.getChildNamed("folder 1")
               .QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
  gFolder1.updateFolderWithListener(null, UrlListener);
  yield false;
  // get five messages to move from Inbox to folder 1.
  let headers1 = Cc["@mozilla.org/array;1"]
                   .createInstance(Ci.nsIMutableArray);
  let msgEnumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
  for (i = 0; i < 5 && msgEnumerator.hasMoreElements(); i++)
  {
    let header = msgEnumerator.getNext();
    if (header instanceof Components.interfaces.nsIMsgDBHdr)
      headers1.appendElement(header, false);
  }
  // this will add dummy headers with keys > 0xffffff80
  MailServices.copy.CopyMessages(gIMAPInbox, headers1, gFolder1, true,
                                 CopyListener, gDummyMsgWindow, true);
  yield false;
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  yield false;
  gFolder1.updateFolderWithListener(gDummyMsgWindow, UrlListener);
  yield false;
  // Check that playing back offline events gets rid of dummy
  // headers, and thus highWater is recalculated.
  do_check_eq(gFolder1.msgDatabase.dBFolderInfo.highWater, 6);
  headers1 = Cc["@mozilla.org/array;1"]
                .createInstance(Ci.nsIMutableArray);
  msgEnumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
  for (i = 0; i < 5 && msgEnumerator.hasMoreElements(); i++)
  {
    let header = msgEnumerator.getNext();
    if (header instanceof Components.interfaces.nsIMsgDBHdr)
      headers1.appendElement(header, false);
  }
  // Check that CopyMessages will handle having a high highwater mark.
  // It will thrown an exception if it can't.
  let msgHdr = gFolder1.msgDatabase.CreateNewHdr(0xfffffffd);
  gFolder1.msgDatabase.AddNewHdrToDB(msgHdr, false);
  MailServices.copy.CopyMessages(gIMAPInbox, headers1, gFolder1, true,
                                 CopyListener, gDummyMsgWindow, true);
  yield false;
  gServer.performTest("UID COPY");

  gFolder1.msgDatabase.DeleteHeader(msgHdr, null, true, false);
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  yield false;
  // this should clear the dummy headers.
  gFolder1.updateFolderWithListener(gDummyMsgWindow, UrlListener);
  yield false;
  let serverSink = gIMAPIncomingServer.QueryInterface(Ci.nsIImapServerSink);
  do_check_eq(gFolder1.msgDatabase.dBFolderInfo.highWater, 11);
  yield true;
}

var UrlListener =
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    async_driver();
  }
};

// nsIMsgCopyServiceListener implementation
var CopyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey){},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus){
    do_check_eq(aStatus, 0);
    async_driver();
  }
};

// Definition of tests
var tests = [
  setupFolders,
  doMoves,
  endTest
]

function actually_run_test() {
  async_run_tests(tests);
}

function endTest()
{
  Services.io.offline = true;
  gServer.performTest("LOGOUT");
//  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  yield true;
}
