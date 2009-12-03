// This file tests undoing of an imap delete to the trash. 
// There are three main cases:
// 1. Normal undo
// 2. Undo after the source folder has been compacted.
// 2.1 Same, but the server doesn't support COPYUID (GMail case)
//
// Original Author: David Bienvenu <bienvenu@nventure.com>


var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gLastKey;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Ci.nsIMsgCopyService);
var gMessenger;
var gMsgWindow;
var gCurTestNum;

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

const gMsgFile1 = do_get_file("../../mailnews/data/bugmail10");
const gMsgFile2 = do_get_file("../../mailnews/data/bugmail11");
const gMsgFile3 = do_get_file("../../mailnews/data/draft1");
const gMsgFile4 = do_get_file("../../mailnews/data/bugmail7");
const gMsgFile5 = do_get_file("../../mailnews/data/bugmail6");

// Copied straight from the example files
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
const gMsgId2 = "200804111417.m3BEHTk4030129@mrapp51.mozilla.org";
const gMsgId3 = "4849BF7B.2030800@example.com";
const gMsgId4 = "bugmail7.m47LtAEf007542@mrapp51.mozilla.org";
const gMsgId5 = "bugmail6.m47LtAEf007542@mrapp51.mozilla.org";



// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    message.spec = ioService.newFileURI(message.file)
                     .QueryInterface(Ci.nsIFileURL).spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

const gTestArray =
[
  function updateFolder() {
    gIMAPInbox.updateFolderWithListener(null, URLListener);
  },
  function deleteMessage() {
    let msgToDelete = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    gMessages.appendElement(msgToDelete, false);
    // This delete happens offline, so we need to wait for playback before
    // doing the expunge. Playback happens 500 ms after the operation starts.
    gIMAPInbox.deleteMessages(gMessages, gMsgWindow, false, true, null, true);
    do_timeout(1500, "doTest(++gCurTestNum)");
  },
  function expunge() {
    gIMAPInbox.expunge(URLListener, gMsgWindow);
  },
  function undoDelete() {
    gMsgWindow.transactionManager.undoTransaction();
    // after undo, we select the trash and then the inbox, so that we sync
    // up with the server, and clear out the effects of having done the 
    // delete offline.
    let trash = gRootFolder.getChildNamed("Trash");
    trash.QueryInterface(Ci.nsIMsgImapMailFolder)
         .updateFolderWithListener(null, URLListener);
  },
  function goBackToInbox() {
    gIMAPInbox.updateFolderWithListener(null, URLListener);
  },
  function verifyFolders() {
    let msgRestored = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    do_check_neq(msgRestored, null);
    doTest(++gCurTestNum);
  },
];

function run_test()
{
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
  prefBranch.setBoolPref("mail.server.server1.offline_download", false);
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
                        {file: gMsgFile4, messageId: gMsgId4},
                         {file: gMsgFile5, messageId: gMsgId5},
                        {file: gMsgFile2, messageId: gMsgId2}],
                        gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();
  //start first test
  doTest(1);
}

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

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gLastKey = aKey;
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    dump("in OnStopCopy " + gCurTestNum + "\n");
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, "doTest(++gCurTestNum)");
  }
};


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
  gMessages.clear();
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
