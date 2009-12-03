/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

 /*
  * Test suite for empty trash
  *
  * Currently tested:
  * - Empty local trash
  * TODO
  * - Empty imap trash
  */

// Globals
var gMsgFile1;
var gLocalTrashFolder;
var gCurTestNum;
var gMsgHdrs = new Array();
var gRootFolder;

const mFNSContractID = "@mozilla.org/messenger/msgnotificationservice;1";
const nsIMFNService = Ci.nsIMsgFolderNotificationService;
const nsIMFListener = Ci.nsIMsgFolderListener;

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
  // Copying message from file
  function testCopyFileMessage1() { copyFileMessage(gMsgFile1, gLocalInboxFolder, false); },

  // Delete message
  function testDeleteMessage() { // delete to trash
    // Let's take a moment to re-initialize stuff that got moved
    let inboxDB = gLocalInboxFolder.msgDatabase;
    gMsgHdrs[0].hdr = inboxDB.getMsgHdrForMessageID(gMsgHdrs[0].ID);

    // Now delete the message
    deleteMessages(gLocalInboxFolder, [gMsgHdrs[0].hdr], false, false);
  },
  function emptyTrash()
  {
    gRootFolder = gLocalIncomingServer.rootMsgFolder;
    gLocalTrashFolder = gRootFolder.getChildNamed("Trash");
    // hold onto a db to make sure that empty trash deals with the case
    // of someone holding onto the db, but the trash folder has a null db.
    let gLocalTrashDB = gLocalTrashFolder.msgDatabase;
    gLocalTrashFolder.msgDatabase = null;
    // this is synchronous
    gLocalTrashFolder.emptyTrash(null, null);
    // check that the trash folder is 0 size, that the db has a 0 message count
    // and has no messages.
    do_check_eq(0, gLocalTrashFolder.filePath.fileSize);
    do_check_eq(0, gLocalTrashFolder.msgDatabase.dBFolderInfo.numMessages);
    let enumerator = gLocalTrashFolder.msgDatabase.EnumerateMessages();
    do_check_eq(false, enumerator.hasMoreElements());
    urlListener.OnStopRunningUrl(null, 0);
  }
];

var gMFNService = Cc[mFNSContractID].getService(nsIMFNService);

// Our listener, which captures events.
function gMFListener() {}
gMFListener.prototype =
{
  folderDeleted: function (aFolder)
  {
    aFolder.msgDatabase = null;
  },
};

function run_test()
{
  loadLocalMailAccount();
  // Load up a message so that we can copy it in later.
  gMsgFile1 = do_get_file("../../mailnews/data/bugmail10");
  // our front end code clears the msg db when it gets told the folder for
  // an open view has been deleted - so simulate that.
  var folderDeletedListener = new gMFListener();
  gMFNService.addListener(folderDeletedListener, nsIMFNService.folderDeleted);

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of all the operations.
  do_test_pending();

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
    gMsgHdrs = null;
    do_test_finished(); // for the one in run_test()
  }
}
