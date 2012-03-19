/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    do_check_eq(folderCount(gLocalInboxFolder), 0);

    let enumerator = gMoveFolder.msgDatabase.EnumerateMessages();
    let firstMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    let secondMsgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    // Check that the messages have content
    messageContent = getContentFromMessage(firstMsgHdr);
    do_check_true(messageContent.indexOf("Some User <bugmail@example.org> changed") != -1);
    messageContent = getContentFromMessage(secondMsgHdr);
    do_check_true(messageContent.indexOf("https://bugzilla.mozilla.org/show_bug.cgi?id=436880") != -1);

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
    do_check_true(messageContent.indexOf("Some User <bugmail@example.org> changed") != -1);
    messageContent = getContentFromMessage(secondMsgHdr);
    do_check_true(messageContent.indexOf("https://bugzilla.mozilla.org/show_bug.cgi?id=436880") != -1);

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
  let prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);
  prefs.setBoolPref("mailnews.downloadToTempFile", true);
  if (!gLocalInboxFolder)
    loadLocalMailAccount();

  gMoveFolder = gLocalIncomingServer.rootMsgFolder
                  .createLocalSubfolder("MoveFolder");
  gMoveFolder2 = gLocalIncomingServer.rootMsgFolder
                  .createLocalSubfolder("MoveFolder2");
  const mailSession = Cc["@mozilla.org/messenger/services/session;1"]
                        .getService(Ci.nsIMsgMailSession);

  mailSession.AddFolderListener(FolderListener, Ci.nsIFolderListener.event |
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

// get the first message header found in a folder
function firstMsgHdr(folder) {
  let enumerator = folder.msgDatabase.EnumerateMessages();
  if (enumerator.hasMoreElements())
    return enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}
