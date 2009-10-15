/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that compacting offline stores works correctly with imap folders
 * and returns success.
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder, gMsgImapInboxFolder;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gImapInboxOfflineStoreSize;

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
    let URI = ioService.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

function checkOfflineStore(prevOfflineStoreSize) {
  dump("checking offline store\n");
  let offset = new Object;
  let size = new Object;
  let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
  if (enumerator)
  {
    while (enumerator.hasMoreElements())
    {
      let header = enumerator.getNext();
      // this will verify that the message in the offline store
      // starts with "From " - otherwise, it returns an error.
      if (header instanceof Components.interfaces.nsIMsgDBHdr &&
         (header.flags & Ci.nsMsgMessageFlags.Offline))
        gIMAPInbox.getOfflineFileStream(header.messageKey, offset, size).close();
    }
  }
  // check that the offline store shrunk by at least 100 bytes.
  // (exact calculation might be fragile).
  do_check_true(prevOfflineStoreSize > gIMAPInbox.filePath.fileSize + 100);
}

const gTestArray =
[
  function downloadForOffline() {
    // ...and download for offline use.
    dump("Downloading for offline use\n");
    gIMAPInbox.downloadAllForOffline(UrlListener, null);
  },
  function deleteOneMessage() {
    dump("deleting one message\n");
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    gIMAPInbox.deleteMessages(array, null, false, true, CopyListener, false);
    gIMAPTrash = gRootFolder.getChildNamed("Trash");
    // hack to force uid validity to get initialized for trash.
    gIMAPTrash.updateFolder(null);
  },
  function compactOfflineStore() {
    dump("compacting offline store\n");
    gImapInboxOfflineStoreSize = gIMAPInbox.filePath.fileSize;
    gRootFolder.compactAll(UrlListener, null, true);
  },
  function checkCompactionResult() {
    checkOfflineStore(gImapInboxOfflineStoreSize);
    UrlListener.OnStopRunningUrl(null, 0);
  },
  function testPendingRemoval() {
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    gMsgImapInboxFolder.markPendingRemoval(msgHdr, true);
    gImapInboxOfflineStoreSize = gIMAPInbox.filePath.fileSize;
    gRootFolder.compactAll(UrlListener, null, true);
  },
  function checkCompactionResult() {
    checkOfflineStore(gImapInboxOfflineStoreSize);
    UrlListener.OnStopRunningUrl(null, 0);
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    do_check_eq(msgHdr.flags & Ci.nsMsgMessageFlags.Offline, 0);
  },
];

function run_test()
{
  // This is before any of the actual tests, so...
  gTest = 0;

  // Add a listener.
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

  // Get the server list...
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  gMsgImapInboxFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  gMsgImapInboxFolder.hierarchyDelimiter = '/';
  gMsgImapInboxFolder.verifiedAsOnlineFolder = true;


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

    var testFn = gTestArray[test-1];
    // Set a limit of three seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gCurTestNum == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
    testFn();
    } catch(ex) {do_throw(ex);}
  }
  else
  {
    // Cleanup, null out everything, close all cached connections and stop the
    // server
    gRootFolder = null;
    gIMAPInbox = null;
    gMsgImapFolder = null;
    gIMAPTrashFolder = null;
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    let hdr = gLocalInboxFolder.GetMessageHeader(aKey);
    gMsgHdrs.push({hdr: hdr, ID: hdr.messageId});
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, "doTest(++gCurTestNum)");
  }
};

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },

  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, "doTest(++gCurTestNum)");
  }
};
