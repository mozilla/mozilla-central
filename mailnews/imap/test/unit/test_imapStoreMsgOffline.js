/**
 * This test checks if the imap protocol code saves message to
 * offline stores correctly, when we fetch the message for display.
 * It checks:
 *   - Normal messages, no attachments.
 *   - Message with inline attachment (e.g., image)
 *   - Message with non-inline attachment (e.g., .doc file)
 *   - Message with mix of attachment types.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const nsMsgMessageFlags = Ci.nsMsgMessageFlags;

var gServer;
var gIMAPDaemon;
var gIMAPInbox;
var gIMAPIncomingServer;
var gIMAPTrashFolder;
var gMessenger;
var gMsgWindow;
var gRootFolder;
var gCurTestNum;

var gMsgFile1 = do_get_file("../../mailnews/data/bugmail10");
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
var gMsgFile2 = do_get_file("../../mailnews/data/image-attach-test");
const gMsgId2 = "4A947F73.5030709@xxx.com";
var gMsgFile3 = do_get_file("../../mailnews/data/external-attach-test");
const gMsgId3 = "876TY.5030709@xxx.com";

// We use this as a display consumer
var streamListener =
{
  _data: "",

  QueryInterface:
    XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

  // nsIRequestObserver
  onStartRequest: function(aRequest, aContext) {
  },
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    do_check_eq(aStatusCode, 0);
  },

  // nsIStreamListener
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    let scriptStream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);

    scriptStream.init(aInputStream);

    scriptStream.read(aCount);
  }
};

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    let URI = ioService.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

var incomingServer, server;
function run_test() {
  // The server doesn't support more than one connection
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.server1.max_cached_connections", 1);
  // Make sure no biff notifications happen
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.server1.download_on_biff", false);
  prefBranch.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  prefBranch.setBoolPref("mail.server.server1.offline_download", true);
  // make small threshhold for mpod so our test messages don't have to be big.
  // XXX We can't set this pref until the fake server supports body structure.
  // So for now, we'll leave it at the default value, which is larger than any of
  // our test messages.
  // prefBranch.setIntPref("mail.imap.mime_parts_on_demand_threshold", 3000);

  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");

  gIMAPIncomingServer = createLocalIMAPServer();

  loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let localAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = gLocalIncomingServer;
  acctMgr.defaultAccount = localAccount;

  // Let's also have another account, using the same identity
  let imapAccount = acctMgr.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gIMAPIncomingServer;

  gMessenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);

  gMsgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
                  .createInstance(Components.interfaces.nsIMsgWindow);

  // Get the server list...
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  let msgImapFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  msgImapFolder.hierarchyDelimiter = '/';
  msgImapFolder.verifiedAsOnlineFolder = true;


  // Add a couple of messages to the INBOX
  // this is synchronous, afaik
  addMessagesToServer([{file: gMsgFile1, messageId: gMsgId1},
                        {file: gMsgFile2, messageId: gMsgId2},
                        {file: gMsgFile3, messageId: gMsgId3},
//                         {file: gMsgFile5, messageId: gMsgId5},
                      ],
                        gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();
  //start first test
  doTest(1);
}

var gIMAPService;

const gTestArray =
[
  function updateFolder() {
    gIMAPInbox.updateFolderWithListener(null, URLListener);
  },
  function selectFirstMsg() {

  // We postpone creating the imap service until after we've set the prefs
  // that it reads on its startup.
  gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

    let db = gIMAPInbox.msgDatabase;
    let msg1 = db.getMsgHdrForMessageID(gMsgId1);
    let url = new Object;
    gIMAPService.DisplayMessage(gIMAPInbox.getUriForMsg(msg1),
                                            streamListener,
                                            null,
                                            URLListener,
                                            null,
                                            url);
  },
  function select2ndMsg() {
    let msg1 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    do_check_neq(msg1.flags & nsMsgMessageFlags.Offline, 0);
    let db = gIMAPInbox.msgDatabase;
    let msg2 = db.getMsgHdrForMessageID(gMsgId2);
    let url = new Object;
    gIMAPService.DisplayMessage(gIMAPInbox.getUriForMsg(msg2),
                                            streamListener,
                                            null,
                                            URLListener,
                                            null,
                                            url);
  },
  function select3rdMsg() {
    let msg2 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    do_check_neq(msg2.flags & nsMsgMessageFlags.Offline, 0);
    let db = gIMAPInbox.msgDatabase;
    let msg3 = db.getMsgHdrForMessageID(gMsgId3);
    let url = new Object;
    gIMAPService.DisplayMessage(gIMAPInbox.getUriForMsg(msg3),
                                            streamListener,
                                            null,
                                            URLListener,
                                            null,
                                            url);
  },
  function verify3rdMsg() {
    let msg3 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId3);
    // can't turn this on because our fake server doesn't support body structure.
//    do_check_eq(msg3.flags & nsMsgMessageFlags.Offline, 0);
    do_timeout(0, "doTest(++gCurTestNum)");
  }
]

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gCurTestNum = test;

    var testFn = gTestArray[test - 1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gCurTestNum == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
    testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
  {
    do_timeout(1000, "endTest();");
  }
}

// nsIURLListener implementation - runs next test
var URLListener =
{
  OnStartRunningUrl: function(aURL) {},
  OnStopRunningUrl: function(aURL, aStatus)
  {
    dump("in OnStopRunningURL " + gCurTestNum + "\n");
    do_check_eq(aStatus, 0);
    do_timeout(0, "doTest(++gCurTestNum);");
  }
}

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
//  gMessages.clear();
  gMessenger = null;
  gMsgWindow = null;
  gRootFolder = null;
  gIMAPInbox = null;
  gIMAPTrashFolder = null;
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPIncomingServer = null;
  gLocalInboxFolder = null;
  gLocalIncomingServer = null;
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}
