/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

 /*
  * Test suite for nsIMsgFolderListener events due to local mail folder
  * operations.
  *
  * Currently tested:
  * - Copy messages from files into the db
  * - Moving and copying one or more messages from one local folder to another
  * - Moving folders, with and without subfolders
  * - Renaming folders
  * - Deleting messages and folders, to trash and from trash (permanently)
  */

do_import_script("../mailnews/base/test/resources/msgFolderListenerSetup.js");

// Globals
var gMsgFile1, gMsgFile2, gMsgFile3;
var gLocalFolder2;
var gLocalFolder3;
var gLocalTrashFolder;

function copyFileMessage(file, destFolder, isDraftOrTemplate)
{
  copyListener.mFolderStoredIn = destFolder;
  gExpectedEvents = [[kEvents.msgAdded, gHdrsReceived]];
  gCopyService.CopyFileMessage(file, destFolder, null, isDraftOrTemplate, 0, copyListener, null);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function copyMessages(items, isMove, srcFolder, destFolder)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  gExpectedEvents = [[kEvents.msgsMoveCopyCompleted, isMove, items, destFolder]];
  gCopyService.CopyMessages(srcFolder, array, destFolder, isMove, copyListener, null, true);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function copyFolders(items, isMove, destFolder)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  gExpectedEvents = [[kEvents.folderMoveCopyCompleted, isMove, items, destFolder]];
  gCopyService.CopyFolders(array, destFolder, isMove, copyListener, null);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function deleteMessages(srcFolder, items, deleteStorage, isMove)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  // We should only get the delete notification only if we are not moving, and are deleting from
  // the storage/trash. We should get only the move/copy notification if we aren't.
  var isTrashFolder = srcFolder.getFlag(Ci.nsMsgFolderFlags.Trash);
  if (!isMove && (deleteStorage || isTrashFolder))
  {
    // We won't be getting any OnStopCopy notification in this case
    gCurrStatus = kStatus.onStopCopyDone;
    gExpectedEvents = [[kEvents.msgsDeleted, items]];
  }
  else
    // We have to be getting a move notification, even if isMove is false
    gExpectedEvents = [[kEvents.msgsMoveCopyCompleted, true, items, gLocalTrashFolder]];

  srcFolder.deleteMessages(array, null, deleteStorage, isMove, copyListener, true);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function renameFolder(folder, newName)
{
  gExpectedEvents = [[kEvents.folderRenamed, [folder], newName]];
  gCurrStatus = kStatus.onStopCopyDone;
  folder.rename(newName, null);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function deleteFolder(folder)
{
  var array = Cc["@mozilla.org/array;1"]
                .createInstance(Ci.nsIMutableArray);
  array.appendElement(folder, false);
  // We won't be getting any OnStopCopy notification at all
  // XXX delete to trash should get one, but we'll need to pass the listener
  // somehow to deleteSubFolders
  gCurrStatus = kStatus.onStopCopyDone;
  // If ancestor is trash, expect an itemDeleted, otherwise expect an itemMoveCopyCompleted
  if (gLocalTrashFolder.isAncestorOf(folder))
    gExpectedEvents = [[kEvents.folderDeleted, [folder]]];
  else
    gExpectedEvents = [[kEvents.folderMoveCopyCompleted, true, [folder], gLocalTrashFolder]];

  folder.parent.deleteSubFolders(array, null);
  gCurrStatus |= kStatus.functionCallDone;
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
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
  function testMoveMessages2() { copyMessages([gMsgHdrs[2].hdr], true, gLocalInboxFolder, gLocalTrashFolder); },
  function testMoveMessages3() {
    // This is to test whether the notification is correct for moving from trash
    gMsgHdrs[2].hdr = gLocalTrashFolder.getMsgDatabase(null).getMsgHdrForMessageID(gMsgHdrs[2].ID);
    copyMessages([gMsgHdrs[2].hdr], true, gLocalTrashFolder, gLocalFolder3);
  },

  // Moving/copying folders
  function testCopyFolder1() { copyFolders([gLocalFolder3], false, gLocalFolder2); },
  function testMoveFolder1() { copyFolders([gLocalFolder3], true, gLocalInboxFolder); },
  function testMoveFolder2() { copyFolders([gLocalFolder2], true, gLocalInboxFolder); },

  // Deleting messages
  function testDeleteMessages1() { // delete to trash
    // Let's take a moment to re-initialize stuff that got moved
    gLocalFolder2 = gLocalInboxFolder.getChildNamed("folder2");
    gLocalFolder3 = gLocalFolder2.getChildNamed("folder3");
    var folder3DB = gLocalFolder3.getMsgDatabase(null);
    for (var i = 0; i < gMsgHdrs.length; i++)
      gMsgHdrs[i].hdr = folder3DB.getMsgHdrForMessageID(gMsgHdrs[i].ID);

    // Now delete the message
    deleteMessages(gLocalFolder3, [gMsgHdrs[0].hdr, gMsgHdrs[1].hdr], false, false);
  },
  // shift delete
  function testDeleteMessages2() { deleteMessages(gLocalFolder3, [gMsgHdrs[2].hdr], true, false); },
  function testDeleteMessages3() { // normal delete from trash
    var trashDB = gLocalTrashFolder.getMsgDatabase(null);
    for (var i = 0; i < gMsgHdrs.length; i++)
      gMsgHdrs[i].hdr = trashDB.getMsgHdrForMessageID(gMsgHdrs[i].ID);
    deleteMessages(gLocalTrashFolder, [gMsgHdrs[0].hdr], false, false);
  },
  // shift delete from trash
  function testDeleteMessages4() { deleteMessages(gLocalTrashFolder, [gMsgHdrs[1].hdr], true, false); },

  // Renaming folders
  function testRename1() { renameFolder(gLocalFolder3, "folder4"); },
  function testRename2() { renameFolder(gLocalFolder2.getChildNamed("folder4"), "folder3"); },
  function testRename3() { renameFolder(gLocalFolder2, "folder4"); },
  function testRename4() { renameFolder(gLocalInboxFolder.getChildNamed("folder4"), "folder2"); },

  // Deleting folders (currently only one folder delete is supported through the UI)
  function deleteFolder1() { deleteFolder(gLocalInboxFolder.getChildNamed("folder3")); },
  function deleteFolder2() { deleteFolder(gLocalInboxFolder.getChildNamed("folder2")); },
  function deleteFolder3() { deleteFolder(gLocalTrashFolder.getChildNamed("folder3")); },
  function deleteFolder4() { deleteFolder(gLocalTrashFolder.getChildNamed("folder2")); }
];

function run_test()
{
  // Add a listener.
  gMFNService.addListener(gMFListener);

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

  // "Trash" folder
  gLocalTrashFolder = rootFolder.getChildNamed("Trash");

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of all the operations.
  do_test_pending();

  // Do the test.
  doTest(1);
}

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    var testFn = gTestArray[test-1];
    // Set a limit of three seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gTest == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    testFn();
  }
  else
  {
    do_test_finished(); // for the one in run_test()
    gMFNService.removeListener(gMFListener);
  }
}
