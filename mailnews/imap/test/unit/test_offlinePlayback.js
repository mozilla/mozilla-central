/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that changes made while offline are played back when we
 * go back online.
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const nsIIOService = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService);

load("../../../resources/messageGenerator.js");

var gIMAPInbox;
var gTest;
var gSecondFolder, gThirdFolder;
var gSynthMessage1, gSynthMessage2;
// the message id of bugmail10
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
var gOfflineManager;

const gTestArray =
[
  function prepareToGoOffline() {
    let rootFolder = gIMAPIncomingServer.rootFolder;
    gSecondFolder = rootFolder.getChildNamed("secondFolder")
                      .QueryInterface(Ci.nsIMsgImapMailFolder);
    gThirdFolder =  rootFolder.getChildNamed("thirdFolder")
                      .QueryInterface(Ci.nsIMsgImapMailFolder);
    gIMAPIncomingServer.closeCachedConnections();
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);

    dump("wait 2 seconds, then go offline\n");
    do_timeout(2000, function () {doTest(++gTest);});
  },
  function doOfflineOps() {
    gServer.stop();
    nsIIOService.offline = true;

    // Flag the two messages, and then copy them to different folders. Since
    // we're offline, these operations are synchronous.
    let msgHdr1 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gSynthMessage1.messageId);
    let msgHdr2 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gSynthMessage2.messageId);
    let headers1 = Cc["@mozilla.org/array;1"]
                     .createInstance(Ci.nsIMutableArray);
    let headers2 = Cc["@mozilla.org/array;1"]
                     .createInstance(Ci.nsIMutableArray);
    headers1.appendElement(msgHdr1, false);
    headers2.appendElement(msgHdr2, false);
    msgHdr1.folder.markMessagesFlagged(headers1, true);
    msgHdr2.folder.markMessagesFlagged(headers2, true);
    copyService.CopyMessages(gIMAPInbox, headers1, gSecondFolder, true, null,
                             null, true);
    copyService.CopyMessages(gIMAPInbox, headers2, gThirdFolder, true, null,
                             null, true);
    var file = do_get_file("../../../data/bugmail10");
    copyService.CopyFileMessage(file, gIMAPInbox, null, false, 0,
                                "", CopyListener, null);
  },
  function goOffline() {
    gOfflineManager = Cc["@mozilla.org/messenger/offline-manager;1"]
                           .getService(Ci.nsIMsgOfflineManager);
    gIMAPDaemon.closing = false;
    nsIIOService.offline = false;

    gServer.start(IMAP_PORT);
    gOfflineManager.goOnline(false, true, null);
    do_timeout(2000, function() {doTest(++gTest);});
  },
  function updateSecondFolder() {
    if (gOfflineManager.inProgress)
      do_timeout(2000, updateSecondFolder);
    gSecondFolder.updateFolderWithListener(null, UrlListener);
  },
  function updateThirdFolder() {
    gThirdFolder.updateFolderWithListener(null, UrlListener);
  },
  function updateInbox() {
    gIMAPInbox.updateFolderWithListener(null, UrlListener);
  },
  function checkDone() {
    let msgHdr1 = gSecondFolder.msgDatabase.getMsgHdrForMessageID(gSynthMessage1.messageId);
    let msgHdr2 = gThirdFolder.msgDatabase.getMsgHdrForMessageID(gSynthMessage2.messageId);
    let msgHdr3 = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    do_check_neq(msgHdr1, null);
    do_check_neq(msgHdr2, null);
    do_check_neq(msgHdr3, null);
    doTest(++gTest);
  }
];

function run_test()
{
  gTest = 0;
  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPDaemon.createMailbox("secondFolder", {subscribed : true});
  gIMAPDaemon.createMailbox("thirdFolder", {subscribed : true});
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

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
  
  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  prefBranch.setBoolPref("mail.server.default.autosync_offline_stores", false);
  // Don't prompt about offline download when going offline
  prefBranch.setIntPref("offline.download.download_messages", 2);

  // make a couple messges
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage1 = messages[0];
  gSynthMessage2 = messages[1];

  let msgURI =
    nsIIOService.newURI("data:text/plain;base64," +
                     btoa(messages[0].toMessageString()),
                     null, null);
  let imapInbox =  gIMAPDaemon.getMailbox("INBOX")
  let message = new imapMessage(msgURI.spec, imapInbox.uidnext++, ["\\Seen"]);
  imapInbox.addMessage(message);
  msgURI =
    nsIIOService.newURI("data:text/plain;base64," +
                     btoa(messages[1].toMessageString()),
                     null, null);
  message = new imapMessage(msgURI.spec, imapInbox.uidnext++, ["\\Seen"]);
  imapInbox.addMessage(message);
  do_test_pending();

  // Get the IMAP inbox...
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);

  // update folder to download header.
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    doTest(++gTest);
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
    do_timeout (0, function(){doTest(++gTest)});;
  }
};

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gTest = test;

    var testFn = gTestArray[test - 1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    try {
      testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
  {
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
