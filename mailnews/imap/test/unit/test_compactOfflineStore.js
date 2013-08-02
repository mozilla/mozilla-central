/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that compacting offline stores works correctly with imap folders
 * and returns success.
 */

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// Globals
var gRootFolder;
var gImapInboxOfflineStoreSize;

const gMsgFile1 = do_get_file("../../../data/bugmail10");
const gMsgFile2 = do_get_file("../../../data/bugmail11");
const gMsgFile3 = do_get_file("../../../data/draft1");
const gMsgFile4 = do_get_file("../../../data/bugmail7");
const gMsgFile5 = do_get_file("../../../data/bugmail6");

// Copied straight from the example files
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
const gMsgId2 = "200804111417.m3BEHTk4030129@mrapp51.mozilla.org";
const gMsgId3 = "4849BF7B.2030800@example.com";
const gMsgId4 = "bugmail7.m47LtAEf007542@mrapp51.mozilla.org";
const gMsgId5 = "bugmail6.m47LtAEf007542@mrapp51.mozilla.org";

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox)
{
  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    let URI =
      Services.io.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

function addGeneratedMessagesToServer(messages, mailbox)
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

var tests = [
  setup,
  function downloadForOffline() {
    // ...and download for offline use.
    dump("Downloading for offline use\n");
    gIMAPInbox.downloadAllForOffline(asyncUrlListener, null);
    yield false;
  },
  function markOneMsgDeleted() {
    // mark a message deleted, and then do a compact of just
    // that folder.
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId5);
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    // store the deleted flag
    gIMAPInbox.storeImapFlags(0x0008, true, [msgHdr.messageKey], 1, asyncUrlListener);
    yield false;
  },
  function compactOneFolder() {
    gIMAPIncomingServer.deleteModel = Ci.nsMsgImapDeleteModels.IMAPDelete;
    // asyncUrlListener will get called when both expunge and offline store
    // compaction are finished. dummyMsgWindow is required to make the backend
    // compact the offline store.
    gIMAPInbox.compact(asyncUrlListener, gDummyMsgWindow);
    yield false;
  },
  function deleteOneMessage() {
    // check that nstmp file has been cleaned up.
    let tmpFile = gRootFolder.filePath;
    tmpFile.append("nstmp");
    do_check_false(tmpFile.exists());
    dump("deleting one message\n");
    gIMAPIncomingServer.deleteModel = Ci.nsMsgImapDeleteModels.MoveToTrash;
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    gIMAPInbox.deleteMessages(array, null, false, true, CopyListener, false);
    let trashFolder = gRootFolder.getChildNamed("Trash");
    // hack to force uid validity to get initialized for trash.
    trashFolder.updateFolder(null);
    yield false;
  },
  function compactOfflineStore() {
    dump("compacting offline store\n");
    gImapInboxOfflineStoreSize = gIMAPInbox.filePath.fileSize;
    gRootFolder.compactAll(asyncUrlListener, null, true);
    yield false;
  },
  function checkCompactionResult() {
    checkOfflineStore(gImapInboxOfflineStoreSize);
    asyncUrlListener.OnStopRunningUrl(null, 0);
    yield false;
  },
  function testPendingRemoval() {
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    gIMAPInbox.markPendingRemoval(msgHdr, true);
    gImapInboxOfflineStoreSize = gIMAPInbox.filePath.fileSize;
    gRootFolder.compactAll(asyncUrlListener, null, true);
    yield false;
  },
  function checkCompactionResult() {
    let tmpFile = gRootFolder.filePath;
    tmpFile.append("nstmp");
    do_check_false(tmpFile.exists());
    checkOfflineStore(gImapInboxOfflineStoreSize);
    asyncUrlListener.OnStopRunningUrl(null, 0);
    yield false;
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    do_check_eq(msgHdr.flags & Ci.nsMsgMessageFlags.Offline, 0);
  },
  teardown
];

function setup() {
  setupIMAPPump();

  gRootFolder = gIMAPIncomingServer.rootFolder;
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  gIMAPInbox.hierarchyDelimiter = '/';
  gIMAPInbox.verifiedAsOnlineFolder = true;

  let messageGenerator = new MessageGenerator();
  let messages = [];
  for (let i = 0; i < 50; i++)
    messages = messages.concat(messageGenerator.makeMessage());

  addGeneratedMessagesToServer(messages, gIMAPDaemon.getMailbox("INBOX"));

  // Add a couple of messages to the INBOX
  // this is synchronous, afaik
  addMessagesToServer([{file: gMsgFile1, messageId: gMsgId1},
                        {file: gMsgFile4, messageId: gMsgId4},
                        {file: gMsgFile2, messageId: gMsgId2},
                        {file: gMsgFile5, messageId: gMsgId5}],
                        gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {
    let hdr = localAccountUtils.inboxFolder.GetMessageHeader(aKey);
    gMsgHdrs.push({hdr: hdr, ID: hdr.messageId});
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    async_driver();
  }
};

function teardown() {
  gRootFolder = null;
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
