/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

 /*
  * Test suite for folder compaction
  *
  * Currently tested:
  * - Compacting local folders
  * TODO
  * - Compacting imap offline stores.
  */

// Globals
var gMsgFile1, gMsgFile2, gMsgFile3;
var gLocalFolder2;
var gLocalFolder3;
var gLocalTrashFolder;
var gCurTestNum;
// After a compact (or other operation), this is what we expect the 
// folder size to be.
var gExpectedFolderSize;
var gMsgHdrs = new Array();

const gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

// nsIMsgCopyServiceListener implementation
var copyListener = 
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

var urlListener =
{
  OnStartRunningUrl: function (aUrl) {
  },
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

function copyFileMessage(file, destFolder, isDraftOrTemplate)
{
  gCopyService.CopyFileMessage(file, destFolder, null, isDraftOrTemplate, 0, "", copyListener, null);
}

function copyMessages(items, isMove, srcFolder, destFolder)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  gCopyService.CopyMessages(srcFolder, array, destFolder, isMove, copyListener, null, true);
}

function deleteMessages(srcFolder, items)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  
  srcFolder.deleteMessages(array, null, false, true, copyListener, true);
}

function calculateFolderSize(folder)
{
  let msgDB = folder.msgDatabase;
  let enumerator = msgDB.EnumerateMessages();
  let totalSize = 0;
  if (enumerator)
  {
    while (enumerator.hasMoreElements())
    {
      var header = enumerator.getNext();
      if (header instanceof Components.interfaces.nsIMsgDBHdr)
        totalSize += header.messageSize;
    }
  }
  return totalSize;
}

/*
 * TESTS
 */

// Beware before commenting out a test -- later tests might just depend on earlier ones
const gTestArray =
[
  // Copying messages from files
  function testCopyFileMessage1() { copyFileMessage(gMsgFile1, gLocalInboxFolder, false); },
  function testCopyFileMessage2() { copyFileMessage(gMsgFile2, gLocalInboxFolder, false); },
  function testCopyFileMessage3() { copyFileMessage(gMsgFile3, gLocalInboxFolder, true); },

  // Moving/copying messages
  function testCopyMessages1() { copyMessages([gMsgHdrs[0].hdr], false, gLocalInboxFolder, gLocalFolder2); },
  function testCopyMessages2() { copyMessages([gMsgHdrs[1].hdr, gMsgHdrs[2].hdr], false, gLocalInboxFolder, gLocalFolder2); },
  function testMoveMessages1() { copyMessages([gMsgHdrs[0].hdr, gMsgHdrs[1].hdr], true, gLocalInboxFolder, gLocalFolder3); },

  // Deleting messages
  function testDeleteMessages1() { // delete to trash
    // Let's take a moment to re-initialize stuff that got moved
    var folder3DB = gLocalFolder3.msgDatabase;
    gMsgHdrs[0].hdr = folder3DB.getMsgHdrForMessageID(gMsgHdrs[0].ID);

    // Now delete the message
    deleteMessages(gLocalFolder3, [gMsgHdrs[0].hdr], false, false);
  },
  function compactFolder()
  {
    gExpectedFolderSize = calculateFolderSize(gLocalFolder3);
    do_check_neq(gLocalFolder3.expungedBytes, 0);
    gLocalFolder3.compact(urlListener, null);
  },
  function compactAllFolders()
  {
    do_check_eq(gExpectedFolderSize, gLocalFolder3.filePath.fileSize);
    gExpectedInboxSize = calculateFolderSize(gLocalInboxFolder);
    gExpectedFolder2Size = calculateFolderSize(gLocalFolder2);
    gExpectedFolder3Size = calculateFolderSize(gLocalFolder3);
    gLocalInboxFolder.compactAll(urlListener, null, true);
  },
  function lastTestCheck()
  {
    do_check_eq(gExpectedInboxSize, gLocalInboxFolder.filePath.fileSize);
    do_check_eq(gExpectedFolder2Size, gLocalFolder2.filePath.fileSize);
    do_check_eq(gExpectedFolder3Size, gLocalFolder3.filePath.fileSize);
    urlListener.OnStopRunningUrl(null, 0);
  }
];

function run_test()
{
  loadLocalMailAccount();
  // Load up some messages so that we can copy them in later.
  gMsgFile1 = do_get_file("../mailnews/test/data/bugmail10");
  gMsgFile2 = do_get_file("../mailnews/test/data/bugmail11");
  gMsgFile3 = do_get_file("../mailnews/test/data/draft1");

  // Create another folder to move and copy messages around, and force initialization.
  var rootFolder = gLocalIncomingServer.rootMsgFolder;
  gLocalFolder2 = rootFolder.addSubfolder("folder2");
  var folderName = gLocalFolder2.prettiestName;
  // Create a third folder for more testing.
  gLocalFolder3 = rootFolder.addSubfolder("folder3");
  folderName = gLocalFolder3.prettiestName;

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of all the operations.
  do_test_pending();

//  do_test_finished();
  // Do the test.
  doTest(1);
}

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    gCurTestNum = test;
    
    var testFn = gTestArray[test-1];
    // Set a limit of three seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gCurTestNum == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
    testFn();
    } catch(ex) {dump(ex);}
  }
  else
  {
    do_test_finished(); // for the one in run_test()
  }
}
