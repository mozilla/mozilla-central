/*
 * This file tests copy followed by a move in a single filter.
 * Tests fix from bug 448337.
 *
 * Original author: Kent James <kent@caspia.com>
 */

load("../../../resources/POP3pump.js");

Components.utils.import("resource:///modules/mailServices.js");

const gFiles = ["../../../data/bugmail1"];
var gCopyFolder;
var gMoveFolder;
var gFilter; // the test filter
var gFilterList;
var gCurTestNum = 1;
const gTestArray =
[
  function createFilters() {
    // setup manual copy then move mail filters on the inbox
    gFilterList = localAccountUtils.incomingServer.getFilterList(null);
    gFilter = gFilterList.createFilter("copyThenMoveAll");
    let searchTerm = gFilter.createTerm();
    searchTerm.matchAll = true;
    gFilter.appendTerm(searchTerm);
    let copyAction = gFilter.createAction();
    copyAction.type = Ci.nsMsgFilterAction.CopyToFolder;
    copyAction.targetFolderUri = gCopyFolder.URI;
    gFilter.appendAction(copyAction);
    let moveAction = gFilter.createAction();
    moveAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    moveAction.targetFolderUri = gMoveFolder.URI;
    gFilter.appendAction(moveAction);
    gFilter.enabled = true;
    gFilter.filterType = Ci.nsMsgFilterType.Manual;
    gFilterList.insertFilterAt(0, gFilter);
    ++gCurTestNum;
    doTest();
  },
  // just get a message into the local folder
  function getLocalMessages1() {
    gPOP3Pump.files = gFiles;
    gPOP3Pump.onDone = doTest;
    ++gCurTestNum;
    gPOP3Pump.run();
  },
  // test applying filters to a message header
  function applyFilters() {
    let messages = Cc["@mozilla.org/array;1"]
                     .createInstance(Ci.nsIMutableArray);
    messages.appendElement(localAccountUtils.inboxFolder.firstNewMessage, false);
    ++gCurTestNum;
    MailServices.filters.applyFilters(Ci.nsMsgFilterType.Manual,
                                      messages, localAccountUtils.inboxFolder, null);
  },
  function verifyFolders1() {
    // Copy and Move should each now have 1 message in them.
    do_check_eq(folderCount(gCopyFolder), 1);
    do_check_eq(folderCount(gMoveFolder), 1);
    // the local inbox folder should now be empty, since the second
    // operation was a move
    do_check_eq(folderCount(localAccountUtils.inboxFolder), 0);
    ++gCurTestNum;
    doTest();
  },
  // just get a message into the local folder
  function getLocalMessages2() {
    gPOP3Pump.files = gFiles;
    gPOP3Pump.onDone = doTest;
    ++gCurTestNum;
    gPOP3Pump.run();
  },
  // use the alternate call into the filter service
  function applyFiltersToFolders() {
    let folders = Cc["@mozilla.org/array;1"]
                    .createInstance(Ci.nsIMutableArray);
    folders.appendElement(localAccountUtils.inboxFolder, false);
    ++gCurTestNum;
    MailServices.filters.applyFiltersToFolders(gFilterList, folders, null);
  },
  function verifyFolders2() {
    // Copy and Move should each now have 2 message in them.
    do_check_eq(folderCount(gCopyFolder), 2);
    do_check_eq(folderCount(gMoveFolder), 2);
    // the local inbox folder should now be empty, since the second
    // operation was a move
    do_check_eq(folderCount(localAccountUtils.inboxFolder), 0);
    ++gCurTestNum;
    doTest();
  }
];

function folderCount(folder)
{
  let enumerator = folder.msgDatabase.EnumerateMessages();
  let count = 0;
  while (enumerator.hasMoreElements())
  {
    count++;
    let hdr = enumerator.getNext();
  }
  return count;
}

function run_test()
{
  if (!localAccountUtils.inboxFolder)
    localAccountUtils.loadLocalMailAccount();

  gCopyFolder = localAccountUtils.rootFolder.createLocalSubfolder("CopyFolder");
  gMoveFolder = localAccountUtils.rootFolder.createLocalSubfolder("MoveFolder");

  MailServices.mailSession.AddFolderListener(FolderListener, Ci.nsIFolderListener.event |
                                                             Ci.nsIFolderListener.added |
                                                             Ci.nsIFolderListener.removed);

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  //start first test
  doTest();
}

function doTest()
{
  var test = gCurTestNum;
  if (test <= gTestArray.length)
  {
    var testFn = gTestArray[test-1];
    dump("Doing test " + test + " " + testFn.name + "\n");

    try {
      testFn();
    } catch(ex) {
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
    do_timeout(1000, endTest);
}

// nsIFolderListener implementation
var FolderListener = {
  OnItemAdded: function OnItemAdded(aParentItem, aItem) {
    this._showEvent(aParentItem, "OnItemAdded");
  },
  OnItemRemoved: function OnItemRemoved(aParentItem, aItem) {
    this._showEvent(aParentItem, "OnItemRemoved");
    // continue test, as all tests remove a message during the move
    do_timeout(0, doTest);
  },
  OnItemEvent: function OnItemEvent(aEventFolder, aEvent) {
    this._showEvent(aEventFolder, aEvent.toString())
  },
  _showEvent: function showEvent(aFolder, aEventString) {
        dump("received folder event " + aEventString +
         " folder " + aFolder.name +
         "\n");
  }
};

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
  dump(" Exiting mail tests\n");
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  gPOP3Pump = null;

  do_test_finished(); // for the one in run_test()
}
