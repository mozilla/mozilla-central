/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that CopyFileMessage checks for > 4GB local folder, and that
 * we can parse and compact folders over 4GB to allow users to get them under
 * 4GB.
 */

load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
load("../../../resources/messageGenerator.js");

var gLocalInboxSize;

var gGotAlert = false;

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

function alert(aDialogTitle, aText) {
  do_check_eq(aText.indexOf("The folder Inbox is full, and can't hold any more messages."), 0);
  gGotAlert = true;
}

// Dummy message window so we can do the move as an offline operation.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};


var copyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    do_check_false(Components.isSuccessCode(aStatus));
  }
};


// If we're running out of memory parsing the folder, lowering the
// block size might help, though it will slow the test down and consume
// more disk space.
const kSparseBlockSize = 102400000;

function run_test()
{
  loadLocalMailAccount();

  let inboxFile = gLocalInboxFolder.filePath.clone();
  // put a single message in the Inbox.
  let messageGenerator = new MessageGenerator();
  let message = messageGenerator.makeMessage();
  let localInbox = gLocalInboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  localInbox.addMessage(message.toMboxString());

  // On Windows, check whether the drive is NTFS. If it is, mark the file as
  // sparse. If it isn't, then bail out now, because in all probability it is
  // FAT32, which doesn't support file sizes greater than 4 GB.
  if ("@mozilla.org/windows-registry-key;1" in Cc &&
      get_file_system(inboxFile) != "NTFS")
  {
    dump("On Windows, this test only works on NTFS volumes.\n");
    endTest();
    return;
  }
  if (inboxFile.diskSpaceAvailable < 0x1100000000)
  {
    dump("this test needs >4 GB of free disk space.\n");
    endTest();
    return;
  }
  do {
    let nextOffset = gLocalInboxFolder.filePath.fileSize + kSparseBlockSize;
    mark_file_region_sparse(inboxFile, gLocalInboxFolder.filePath.fileSize,
                            kSparseBlockSize);
    let outputStream = gLocalInboxFolder.offlineStoreOutputStream
      .QueryInterface(Ci.nsISeekableStream);
    outputStream.seek(0, nextOffset);
    let mboxString = "\r\n" + message.toMboxString();
    outputStream.write(mboxString, mboxString.length);
    outputStream.close();
  }
  while (gLocalInboxFolder.filePath.fileSize < 0x100000000)

  gLocalInboxSize = gLocalInboxFolder.filePath.fileSize;

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  let file = do_get_file("../../../data/multipart-complex2");
  let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

  try {
    copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                                "", copyListener, dummyMsgWindow);
  } catch (ex) {
  }
  gLocalInboxFolder.msgDatabase = null;
  try {
    gLocalInboxFolder.getDatabaseWithReparse(ParseListener, dummyMsgWindow);
  } catch (ex) {
    do_check_true(ex.result == Cr.NS_ERROR_NOT_INITIALIZED);
  }
}

function testCompact()
{
  let msgDB = gLocalInboxFolder.msgDatabase;
  let enumerator = msgDB.EnumerateMessages();
  let firstHdr = true;
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  while (enumerator.hasMoreElements()) {
    var header = enumerator.getNext();
    if (header instanceof Components.interfaces.nsIMsgDBHdr && !firstHdr)
      messages.appendElement(header, false);
    firstHdr = false;
  }
  // mark messages as deleted.
  gLocalInboxFolder.deleteMessages(messages, null, true, false, null, false);
  gLocalInboxFolder.compact(CompactListener, null);
}

var ParseListener =
{
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);
    testCompact();
  }
};

var CompactListener =
{
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);
    // check that folder size isn't much bigger than our sparse block size,
    // i.e., that we just have one message.
    do_check_true(gLocalInboxFolder.filePath.fileSize < kSparseBlockSize + 1000);
    do_check_eq(gLocalInboxFolder.getTotalMessages(false), 1);
    endTest();
  }
};

function endTest()
{
  do_check_true(gGotAlert);
  // free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  gLocalInboxFolder.filePath.remove(false);
  do_test_finished();
}
