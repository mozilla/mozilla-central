/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

 /*
  * Test for https://bugzilla.mozilla.org/show_bug.cgi?id=710056
  * custom column header settings lost after folder compact
  * adapted from test_folderCompact.js
  *
  * Basic test procedure:
  *   Open mail account
  *   create sub-folder named "folder2"
  *   Set custom column headings on folder2
  *   Copy in two messages
  *   Remove one message
  *   Compact folder2
  *   Close folder2
  *   Reopen folder2
  *   Check whether custom column headings are still there
  *
  */

Components.utils.import("resource:///modules/mailServices.js");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

// Globals
var gMsgFile1, gMsgFile2, gMsgFile3;
var gLocalFolder2;

var gCurTestNum;

var gMsgHdrs = new Array();

const PERSISTED_COLUMN_PROPERTY_NAME = "columnStates";
const columnJSON = '{"threadCol":{"visible":true,"ordinal":"1"},"flaggedCol":{"visible":true,"ordinal":"4"},"attachmentCol":{"visible":true,"ordinal":"5"},"subjectCol":{"visible":true,"ordinal":"7"},"unreadButtonColHeader":{"visible":true,"ordinal":"9"},"senderCol":{"visible":true,"ordinal":"11"},"recipientCol":{"visible":false,"ordinal":"13"},"junkStatusCol":{"visible":true,"ordinal":"15"},"receivedCol":{"visible":true,"ordinal":"17"},"dateCol":{"visible":true,"ordinal":"19"},"statusCol":{"visible":false,"ordinal":"21"},"sizeCol":{"visible":true,"ordinal":"23"},"tagsCol":{"visible":false,"ordinal":"25"},"accountCol":{"visible":false,"ordinal":"27"},"priorityCol":{"visible":false,"ordinal":"29"},"unreadCol":{"visible":false,"ordinal":"31"},"totalCol":{"visible":false,"ordinal":"33"},"locationCol":{"visible":false,"ordinal":"35"},"idCol":{"visible":false,"ordinal":"37"}}';

function setColumnStates(folder) {
  let msgDatabase = folder.msgDatabase;
  let dbFolderInfo = msgDatabase.dBFolderInfo;
  dbFolderInfo.setCharProperty(this.PERSISTED_COLUMN_PROPERTY_NAME, columnJSON);
  msgDatabase.Commit(Components.interfaces.nsMsgDBCommitType.kLargeCommit);
}

function checkPersistentState(folder) {
  let msgDatabase = folder.msgDatabase;
  let dbFolderInfo = msgDatabase.dBFolderInfo;
  let state = dbFolderInfo.getCharProperty(this.PERSISTED_COLUMN_PROPERTY_NAME);
  do_check_eq(state, columnJSON);
  do_timeout(0, function(){doTest(++gCurTestNum);});
}


// nsIMsgCopyServiceListener implementation
var copyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    try {
      let hdr = gLocalFolder2.GetMessageHeader(aKey);
      gMsgHdrs.push({hdr: hdr, ID: hdr.messageId});
    }
    catch(e) {
      dump("SetMessageKey failed: " + e + "\n");
    }
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
    do_timeout(0, function(){doTest(++gCurTestNum);});
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
    do_timeout(0, function(){doTest(++gCurTestNum);});
  }
};

function copyFileMessage(file, destFolder, isDraftOrTemplate)
{
  MailServices.copy.CopyFileMessage(file, destFolder, null, isDraftOrTemplate, 0, "", copyListener, null);
}

function deleteMessages(srcFolder, items)
{
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  items.forEach(function (item) {
    array.appendElement(item, false);
  });
  
  srcFolder.deleteMessages(array, null, false, true, copyListener, true);
}

/*
 * TESTS
 */

// Beware before commenting out a test -- later tests might just depend on earlier ones
const gTestArray =
[
  // Copying messages from files
  function testCopyFileMessage1() { copyFileMessage(gMsgFile1, gLocalFolder2, false); },
  function testCopyFileMessage2() { copyFileMessage(gMsgFile2, gLocalFolder2, false); },
  function testCopyFileMessage3() { copyFileMessage(gMsgFile3, gLocalFolder2, true); },

  // Deleting messages
  function testDeleteMessages1() { // delete to trash
    deleteMessages(gLocalFolder2, [gMsgHdrs[0].hdr], false, false);
  },
  function checkBeforeCompact()
  {
    checkPersistentState(gLocalFolder2);
  },
  function compactFolder()
  {
    gLocalFolder2.compact(urlListener, null);
  },
  function checkAfterCompact()
  {
    checkPersistentState(gLocalFolder2);
  },
];

function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  // Load up some messages so that we can copy them in later.
  gMsgFile1 = do_get_file("../../../data/bugmail10");
  gMsgFile2 = do_get_file("../../../data/bugmail11");
  gMsgFile3 = do_get_file("../../../data/draft1");

  // Create another folder to move and copy messages around, and force initialization.
  gLocalFolder2 = localAccountUtils.rootFolder.createLocalSubfolder("folder2");
  let folderName = gLocalFolder2.prettiestName;
  setColumnStates(gLocalFolder2);

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
    // Set a limit of 10 seconds; if the notifications haven't arrived by
    // then, there's a problem.
    do_timeout(10000, function() {
      if (gCurTestNum == test)
        do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
    });
    try {
    testFn();
    } catch(ex) {dump(ex);}
  }
  else
  {
    do_test_finished(); // for the one in run_test()
  }
}
