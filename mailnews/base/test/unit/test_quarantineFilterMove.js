/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * tests message moves with filter and quarantine enabled per bug 582918.
 * It then tests that subsequent moves of the filtered messages work.
 *
 * adapted from test_copyThenMoveManual.js
 */

Components.utils.import("resource:///modules/mailServices.js");

load("../../../resources/POP3pump.js");
const gFiles = ["../../../data/bugmail1", "../../../data/bugmail10"];
var gMoveFolder, gMoveFolder2;
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
  function waitForCopyToFinish() {
    do_timeout(1000, function() {++gCurTestNum; doTest();});
  },
  function verifyFolders1() {
    do_check_eq(folderCount(gMoveFolder), 2);
    // the local inbox folder should now be empty, since the second
    // operation was a move
    do_check_eq(folderCount(localAccountUtils.inboxFolder), 0);

    let enumerator = gMoveFolder.msgDatabase.EnumerateMessages();
    let firstMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    let secondMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    // Check that the messages have content
    messageContent = getContentFromMessage(firstMsgHdr);
    do_check_true(messageContent.contains("Some User <bugmail@example.org> changed"));
    messageContent = getContentFromMessage(secondMsgHdr);
    do_check_true(messageContent.contains("https://bugzilla.mozilla.org/show_bug.cgi?id=436880"));

    ++gCurTestNum;
    doTest();
  },
  function copyMovedMessages() {
    let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    let enumerator = gMoveFolder.msgDatabase.EnumerateMessages();
    let firstMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    let secondMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    messages.appendElement(firstMsgHdr, false);
    messages.appendElement(secondMsgHdr, false);
    MailServices.copy.CopyMessages(gMoveFolder, messages, gMoveFolder2, false,
                             copyListener, null, false);

  },
  function verifyFolders2() {
    do_check_eq(folderCount(gMoveFolder2), 2);

    let enumerator = gMoveFolder2.msgDatabase.EnumerateMessages();
    let firstMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    let secondMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    // Check that the messages have content
    messageContent = getContentFromMessage(firstMsgHdr);
    do_check_true(messageContent.contains("Some User <bugmail@example.org> changed"));
    messageContent = getContentFromMessage(secondMsgHdr);
    do_check_true(messageContent.contains("https://bugzilla.mozilla.org/show_bug.cgi?id=436880"));

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
  /* may not work in Linux */
  //if ("@mozilla.org/gnome-gconf-service;1" in Cc)
  //  return;
  /**/

  // quarantine messages
  Services.prefs.setBoolPref("mailnews.downloadToTempFile", true);
  if (!localAccountUtils.inboxFolder)
    localAccountUtils.loadLocalMailAccount();

  gMoveFolder = localAccountUtils.rootFolder.createLocalSubfolder("MoveFolder");
  gMoveFolder2 = localAccountUtils.rootFolder.createLocalSubfolder("MoveFolder2");

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

var copyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    do_timeout(0, function(){doTest(++gCurTestNum);});
  }
};

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

/*
 * Get the full message content.
 *
 * aMsgHdr: nsIMsgDBHdr object whose text body will be read
 *          returns: string with full message contents
 */
function getContentFromMessage(aMsgHdr) {
  const MAX_MESSAGE_LENGTH = 65536;
  let msgFolder = aMsgHdr.folder;
  let msgUri = msgFolder.getUriForMsg(aMsgHdr);

  let messenger = Cc["@mozilla.org/messenger;1"]
                    .createInstance(Ci.nsIMessenger);
  let streamListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                         .createInstance(Ci.nsISyncStreamListener);
  messenger.messageServiceFromURI(msgUri).streamMessage(msgUri,
                                                        streamListener,
                                                        null,
                                                        null,
                                                        false,
                                                        "",
                                                        false);
  let sis = Cc["@mozilla.org/scriptableinputstream;1"]
              .createInstance(Ci.nsIScriptableInputStream);
  sis.init(streamListener.inputStream);
  return sis.read(MAX_MESSAGE_LENGTH);
}
