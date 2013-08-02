/*
 * This file tests that a pop3 move filter doesn't reuse msg hdr
 * info from previous moves.
 *
 * Original author: David Bienvenu <dbienvenu@mozilla.com>
 */


load("../../../resources/POP3pump.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
const gFiles = ["../../../data/bugmail10", "../../../data/basic1"];

Services.prefs.setBoolPref("mail.server.default.leave_on_server", true);

const basic1_preview = 'Hello, world!';
const bugmail10_preview = 'Do not reply to this email. You can add comments to this bug at https://bugzilla.mozilla.org/show_bug.cgi?id=436880 -- Configure bugmail: https://bugzilla.mozilla.org/userprefs.cgi?tab=email ------- You are receiving this mail because: -----';

var gMoveFolder;
var gFilter; // the test filter
var gFilterList;
var gCurTestNum = 1;
const gTestArray =
[
  function createFilters() {
    gFilterList = gPOP3Pump.fakeServer.getFilterList(null);
    // create a cc filter which will match the first message but not the second.
    gFilter = gFilterList.createFilter("MoveCc");
    let searchTerm = gFilter.createTerm();
    searchTerm.attrib = Ci.nsMsgSearchAttrib.CC;
    searchTerm.op = Ci.nsMsgSearchOp.Contains;
    var oldValue = searchTerm.value;
    oldValue.attrib = Ci.nsMsgSearchAttrib.CC;
    oldValue.str = "invalid@example.com";
    searchTerm.value = oldValue;
    gFilter.appendTerm(searchTerm);
    let moveAction = gFilter.createAction();
    moveAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    moveAction.targetFolderUri = gMoveFolder.URI;
    gFilter.appendAction(moveAction);
    gFilter.enabled = true;
    gFilter.filterType = Ci.nsMsgFilterType.InboxRule;
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
  function verifyFolders2() {
    do_check_eq(folderCount(gMoveFolder), 1);
    // the local inbox folder should gave one message.
    do_check_eq(folderCount(gLocalInboxFolder), 1);
    ++gCurTestNum;
    doTest();

  },
  function verifyMessages() {
    let hdrs = [];
    let keys = [];
    let asyncResults = new Object;
    let enumerator = gMoveFolder.msgDatabase.EnumerateMessages();
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    keys.push(hdr.messageKey);
    hdrs.push(hdr);
    gMoveFolder.fetchMsgPreviewText(keys, keys.length, false, null, asyncResults);
    do_check_eq(hdrs[0].getStringProperty('preview'), bugmail10_preview);
    // check inbox message
    hdrs = [];
    keys = [];
    let asyncResults = new Object;
    enumerator = gLocalInboxFolder.msgDatabase.EnumerateMessages();
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    keys.push(hdr.messageKey);
    hdrs.push(hdr);
    gLocalInboxFolder.fetchMsgPreviewText(keys, keys.length, false, null, asyncResults);
    do_check_eq(hdrs[0].getStringProperty('preview'), basic1_preview);
    ++gCurTestNum;
    doTest();
  },
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
  // Make sure we're not quarantining messages
  Services.prefs.setBoolPref("mailnews.downloadToTempFile", false);
  if (!gLocalInboxFolder)
    localAccountUtils.loadLocalMailAccount();

  gMoveFolder = localAccountUtils.incomingServer
                                 .rootFolder.createLocalSubfolder("MoveFolder");

  MailServices.mailSession.AddFolderListener(FolderListener,
                                             Ci.nsIFolderListener.event |
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
  dump("Exiting mail tests\n");
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  gPOP3Pump = null;

  do_test_finished(); // for the one in run_test()
}

