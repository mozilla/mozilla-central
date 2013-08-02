/*
 * This file tests that a pop3 move filter doesn't leave the
 * original message in the inbox.
 *
 * Original author: David Bienvenu <dbienvenu@mozilla.com>
 */


load("../../../resources/POP3pump.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
const gFiles = ["../../../data/bugmail10", "../../../data/bugmail11"];

// make sure limiting download size doesn't causes issues with move filters.
Services.prefs.setBoolPref("mail.server.default.limit_offline_message_size", true);
Services.prefs.setBoolPref("mail.server.default.leave_on_server", true);

const bugmail10_preview = 'Do not reply to this email. You can add comments to this bug at https://bugzilla.mozilla.org/show_bug.cgi?id=436880 -- Configure bugmail: https://bugzilla.mozilla.org/userprefs.cgi?tab=email ------- You are receiving this mail because: -----';
const bugmail11_preview = 'Bugzilla has received a request to create a user account using your email address (example@example.org). To confirm that you want to create an account using that email address, visit the following link: https://bugzilla.mozilla.org/token.cgi?t=xxx';

var gMoveFolder;
var gFilter; // the test filter
var gFilterList;
var gCurTestNum = 1;
const gTestArray =
[
  function createFilters() {
    gFilterList = gPOP3Pump.fakeServer.getFilterList(null);
    gFilter = gFilterList.createFilter("MoveAll");
    let searchTerm = gFilter.createTerm();
    searchTerm.matchAll = true;
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
    do_check_eq(folderCount(gMoveFolder), 2);
    // the local inbox folder should now be empty, since we moved incoming mail.
    do_check_eq(folderCount(gLocalInboxFolder), 0);

    // invalidate the inbox summary file, to be sure that we really moved
    // the mail.
    gLocalInboxFolder.msgDatabase.summaryValid = false;
    gLocalInboxFolder.msgDatabase = null;
    gLocalInboxFolder.ForceDBClosed();
    try {
      gLocalInboxFolder.getDatabaseWithReparse(ParseListener, null);
    } catch (ex) {
      do_check_true(ex.result == Cr.NS_ERROR_NOT_INITIALIZED);
    }
  },
  function verifyMessages() {
    let hdrs = [];
    let keys = [];
    let asyncResults = new Object;
    let enumerator = gMoveFolder.msgDatabase.EnumerateMessages();
    while (enumerator.hasMoreElements())
    {
      let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
      keys.push(hdr.messageKey);
      hdrs.push(hdr);
    }
    gMoveFolder.fetchMsgPreviewText(keys, keys.length, false, null, asyncResults);
    do_check_eq(hdrs[0].getStringProperty('preview'), bugmail10_preview);
    do_check_eq(hdrs[1].getStringProperty('preview'), bugmail11_preview);
    ++gCurTestNum;
    doTest();
  },
];

var ParseListener =
{
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    do_check_eq(aExitCode, 0);
    do_check_true(gLocalInboxFolder.msgDatabase.summaryValid);
    do_check_eq(folderCount(gLocalInboxFolder), 0);
    ++gCurTestNum;
    doTest();
  }
};

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

