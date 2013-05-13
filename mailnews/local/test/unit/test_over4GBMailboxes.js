/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that operations around the 4GiB folder size boundary work correctly.
 * This test only works for mbox format mail folders.
 * Some of the tests will be removed when support for over 4GiB folders is enabled by default.
 * The test functions are executed in this order:
 * - run_test
 * -  ParseListener1
 * - downloadUnder4GiB
 * -  ParseListener2
 * - downloadOver4GiB
 * - growOver4GiB
 * -  ParseListener3
 * - copyIntoOver4GiB
 * - compactUnder4GiB
 * -  CompactListener2
 */

load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/messageGenerator.js");
load("../../../resources/POP3pump.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

// If we're running out of memory parsing the folder, lowering the
// block size might help, though it will slow the test down and consume
// more disk space.
const kSparseBlockSize = 102400000;
const kSizeLimit = 0x100000000; // 4GiB
const kNearLimit = kSizeLimit - 0x1000000; // -16MiB

var gGotAlert = false;
var gInboxFile = null;

// This alert() is triggered when file size becomes close (enough) to or
// exceeds 4 GiB.
// See hardcoded value in nsMsgBrkMBoxStore::HasSpaceAvailable().
function alert(aDialogTitle, aText) {
  // See "/*/locales/en-US/chrome/*/messenger.properties > mailboxTooLarge".
  do_check_true(aText.startsWith("The folder Inbox is full, and can't hold any more messages."));
  gGotAlert = true;
}

/**
 * Grow local inbox folder to the wanted size using direct appending
 * to the underlying file. The folder is filled with copies of a dummy
 * message with kSparseBlockSize bytes in size.
 * The file is marked as sparse in the filesystem so that it does not
 * really take 4GiB and working with it is faster.
 */
function growInbox(aWantedSize) {
  // Put a single message in the Inbox.
  let messageGenerator = new MessageGenerator();
  let message = messageGenerator.makeMessage();

  // Refresh 'gInboxFile'.
  gInboxFile = gLocalInboxFolder.filePath;

  let mboxString = message.toMboxString();
  let plugStore = gLocalInboxFolder.msgStore;
  // Grow local inbox to our wished size that is below the max limit.
  do {
    let nextOffset = gInboxFile.fileSize +
      Math.min(kSparseBlockSize + mboxString.length,
               aWantedSize - gInboxFile.fileSize) - 2;

    // Get stream to write a new message.
    let reusable = new Object;
    let newMsgHdr = new Object;
    let outputStream = plugStore.getNewMsgOutputStream(gLocalInboxFolder,
                                                       newMsgHdr, reusable)
                                .QueryInterface(Ci.nsISeekableStream);
    // Write message header.
    outputStream.write(mboxString, mboxString.length);

    // "Add" a new (empty) sparse block at the end of the file.
    mark_file_region_sparse(gInboxFile, gInboxFile.fileSize + mboxString.length,
                            nextOffset - (gInboxFile.fileSize + mboxString.length));

    // Skip to the wished end of the message.
    outputStream.seek(0, nextOffset);
    // Add a CR+LF to terminate the message.
    outputStream.write("\r\n", 2);
    outputStream.close();
    plugStore.finishNewMessage(outputStream, newMsgHdr);

    // Refresh 'gInboxFile'.
    gInboxFile = gLocalInboxFolder.filePath;
  }
  while (gInboxFile.fileSize < aWantedSize);

  do_print("Local inbox size = " + gInboxFile.fileSize + "bytes = " +
           gInboxFile.fileSize / 1024 / 1024 + "MiB");
}

function run_test()
{
  loadLocalMailAccount();

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  gInboxFile = gLocalInboxFolder.filePath;

  let neededFreeSpace = kSizeLimit + 0x10000000; // +256MiB
  // On Windows, check whether the drive is NTFS. If it is, mark the file as
  // sparse. If it isn't, then bail out now, because in all probability it is
  // FAT32, which doesn't support file sizes greater than 4 GiB.
  if ("@mozilla.org/windows-registry-key;1" in Cc &&
      get_file_system(gInboxFile) != "NTFS")
  {
    dump("On Windows, this test only works on NTFS volumes.\n");

    endTest();
    return;
  }

  let freeDiskSpace = gInboxFile.diskSpaceAvailable;
  do_print("Free disk space = " + toMiBString(freeDiskSpace));
  if (freeDiskSpace < neededFreeSpace) {
    do_print("This test needs " + toMiBString(neededFreeSpace) +
             " free space to run. Aborting.");
    todo_check_true(false);

    endTest();
    return;
  }

  // Grow inbox to size near the max limit.
  growInbox(kNearLimit);

  // Force the db closed, so that getDatabaseWithReparse will notice
  // that it's out of date.
  gLocalInboxFolder.msgDatabase.ForceClosed();
  gLocalInboxFolder.msgDatabase = null;
  try {
    gLocalInboxFolder.getDatabaseWithReparse(ParseListener1, gDummyMsgWindow);
  } catch (ex) {
    do_check_eq(ex.result, Cr.NS_ERROR_NOT_INITIALIZED);
  }
  // Execution continues in downloadUnder4GiB() when done.
}

/**
 * Check we can download new mail when we are near 4GiB limit but do not cross it.
 */
function downloadUnder4GiB()
{
  // Check fake POP3 server is ready.
  do_check_neq(gPOP3Pump.fakeServer, null);

  // Download a file that still fits into the limit.
  let bigFile = do_get_file("../../../data/mime-torture");
  do_check_true(bigFile.fileSize >= 1024 * 1024);
  do_check_true(bigFile.fileSize <= 1024 * 1024 * 2);

  gPOP3Pump.files = ["../../../data/mime-torture"];
  gPOP3Pump.onDone = downloadOver4GiB;
  // It must succeed.
  gPOP3Pump.run(0);
  // Execution continues in downloadOver4GiB() when done.
}

/**
 * Bug 640371
 * Check we will not cross the 4GiB limit when downloading new mail.
 */
function downloadOver4GiB()
{
  let localInboxSize = gInboxFile.fileSize;
  do_check_true(localInboxSize > kNearLimit);
  do_check_true(localInboxSize < kSizeLimit);
  // The big file is between 1 and 2 MiB. Append it 16 times to attempt to cross the 4GiB limit.
  gPOP3Pump.files = ["../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture",
                     "../../../data/mime-torture", "../../../data/mime-torture"];
  gPOP3Pump.onDone = growOver4GiB;
  // The download must fail.
  gPOP3Pump.run(2147500037);
  // Execution continues in growOver4GiB() when done.
}

/**
 * Bug 608449
 * Check we can parse a folder if it is above 4GiB.
 */
function growOver4GiB()
{
  gPOP3Pump = null;

  // Grow inbox to size greater than the max limit (+16 MiB).
  growInbox(kSizeLimit + 0x1000000);
  do_check_true(gInboxFile.fileSize > kSizeLimit);

  // Force the db closed, so that getDatabaseWithReparse will notice
  // that it's out of date.
  gLocalInboxFolder.msgDatabase.ForceClosed();
  gLocalInboxFolder.msgDatabase = null;
  try {
    gLocalInboxFolder.getDatabaseWithReparse(ParseListener2, gDummyMsgWindow);
  } catch (ex) {
    do_check_eq(ex.result, Cr.NS_ERROR_NOT_INITIALIZED);
  }
  // Execution continues in copyOver4GiB() when done.
}

/**
 * Bug 598104
 * Check that copy operation does not allow to grow a local folder above 4 GiB.
 */
function copyIntoOver4GiB()
{
  // Save initial file size.
  let localInboxSize = gInboxFile.fileSize;
  do_print("Local inbox size (before copyFileMessageInLocalFolder()) = " +
           localInboxSize);

  // Use copyFileMessageInLocalFolder() to (try to) append another message
  // to local inbox.
  let file = do_get_file("../../../data/multipart-complex2");
  copyFileMessageInLocalFolder(file, 0, "", gDummyMsgWindow,
                               function(aMessageHeadersKeys, aStatus) {
    do_check_false(Components.isSuccessCode(aStatus));
  });
  do_check_true(gGotAlert);

  // Make sure inbox file did not grow (i.e., no data were appended).
  let newLocalInboxSize = gLocalInboxFolder.filePath.fileSize;
  do_print("Local inbox size (after copyFileMessageInLocalFolder()) = " +
           newLocalInboxSize);
  do_check_eq(newLocalInboxSize, localInboxSize);

  do_timeout(0, compactUnder4GiB);
}

/**
 * Bug 608449
 * Check we compact a folder to get it under 4 GiB.
 */
function compactUnder4GiB()
{
  do_check_true(gInboxFile.fileSize > kSizeLimit);
  // Very first header in msgDB is retained,
  // then all other headers are marked as deleted.
  let msgDB = gLocalInboxFolder.msgDatabase;
  let enumerator = msgDB.EnumerateMessages();
  let firstHdr = true;
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  while (enumerator.hasMoreElements()) {
    let header = enumerator.getNext();
    if (header instanceof Components.interfaces.nsIMsgDBHdr && !firstHdr)
      messages.appendElement(header, false);
    firstHdr = false;
  }
  gLocalInboxFolder.deleteMessages(messages, null, true, false, null, false);

  // Note: compact() will also add 'X-Mozilla-Status' and 'X-Mozilla-Status2'
  // lines to message(s).
  gLocalInboxFolder.compact(CompactListener2, null);
  // Test ends after compaction is done.
}

var ParseListener1 =
{
  OnStartRunningUrl: function (aUrl) {},
  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: reparse successful
    do_check_eq(aExitCode, 0);
    do_check_neq(gLocalInboxFolder.msgDatabase, null);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);

    downloadUnder4GiB();
  }
};

var ParseListener2 =
{
  OnStartRunningUrl: function (aUrl) {},
  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: reparse successful
    do_check_eq(aExitCode, 0);
    do_check_neq(gLocalInboxFolder.msgDatabase, null);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);

    copyIntoOver4GiB();
  }
};

var CompactListener2 =
{
  OnStartRunningUrl: function (aUrl) {},
  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);

    // Check that folder size isn't much bigger than our sparse block size, ...
    let localInboxSize = gLocalInboxFolder.filePath.fileSize;
    do_print("Local inbox size (after compact()) = " + localInboxSize);
    do_check_true(localInboxSize < kSparseBlockSize + 1000);
    // ... i.e., that we just have one message.
    do_check_eq(gLocalInboxFolder.getTotalMessages(false), 1);

    endTest();
  }
};

function endTest()
{
  // Free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  gLocalInboxFolder.filePath.remove(false);

  do_test_finished();
}
