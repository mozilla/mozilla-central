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
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Bienvenu <bienvenu@mozillamessaging.com>
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

// This tests various features of imap autosync
// N.B. We need to beware of messageInjection, since it turns off
// imap autosync.

// Our general approach is to attach an nsIAutoSyncMgrListener to the
// autoSyncManager, and listen for the expected events. We simulate idle
// by directly poking the nsIAutoSyncManager QI'd to nsIObserver with app
// idle events. If we really go idle, duplicate idle events are ignored.

// We test that checking non-inbox folders for new messages isn't
// interfering with autoSync's detection of new messages.

// We also test that folders that have messages added to them via move/copy
// get put in the front of the queue.

// IMAP pump
load("../../../resources/IMAPpump.js");
load("../../../resources/logHelper.js");

load("../../../resources/asyncTestUtils.js");

load("../../../resources/alertTestUtils.js");
load("../../../resources/messageGenerator.js");

// Globals

setupIMAPPump();

const msgFlagOffline = Ci.nsMsgMessageFlags.Offline;

var gGotAlert;

var gAutoSyncManager = Cc["@mozilla.org/imap/autosyncmgr;1"]
                       .getService(Ci.nsIAutoSyncManager);

var CopyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    async_driver();
  }
};

var dummyDocShell =
{
  getInterface: function (iid) {
    if (iid.equals(Ci.nsIAuthPrompt)) {
      return Cc["@mozilla.org/login-manager/prompter;1"]
               .getService(Ci.nsIAuthPrompt);
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDocShell,
                                         Ci.nsIInterfaceRequestor])
}

// Dummy message window so we can do the move as an offline operation.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};


// Definition of tests
var tests = [
  test_createTargetFolder,
  test_checkForNewMessages,
  test_triggerAutoSyncIdle,
  test_moveMessageToTargetFolder,
  test_waitForTargetUpdate,
  endTest
]

let gTargetFolder;

function test_createTargetFolder()
{
  gAutoSyncManager.addListener(gAutoSyncListener);

  gIMAPIncomingServer.rootFolder.createSubfolder("targetFolder", null);
  yield false;
  gTargetFolder = gIMAPIncomingServer.rootFolder.getChildNamed("targetFolder");
  do_check_true(gTargetFolder instanceof Ci.nsIMsgImapMailFolder);
  // set folder to be checked for new messages when inbox is checked.
  gTargetFolder.setFlag(Ci.nsMsgFolderFlags.CheckNew);
}

function test_checkForNewMessages()
{
  addMessageToFolder(gTargetFolder);
  // This will update the INBOX and STATUS targetFolder. We only care about
  // the latter.
  gIMAPInbox.getNewMessages(null, null);
  gIMAPServer.performTest("STATUS");
  // Now we'd like to make autosync update folders it knows about, to
  // get the initial autosync out of the way.
  yield true;
}

function test_triggerAutoSyncIdle()
{
  // wait for both folders to get updated.
  gAutoSyncListener._waitingForDiscoveryList.push(gIMAPInbox);
  gAutoSyncListener._waitingForDiscoveryList.push(gTargetFolder);
  gAutoSyncListener._waitingForDiscovery = true;
  let observer = gAutoSyncManager.QueryInterface(Ci.nsIObserver);
  observer.observe(null, "mail-startup-done", "");
  observer.observe(null, "mail:appIdle", "idle");
  // now we expect to hear that targetFolder was updated.
  yield false;
}

// move the message to a diffent folder
function test_moveMessageToTargetFolder()
{
  let observer = gAutoSyncManager.QueryInterface(Ci.nsIObserver);
  observer.observe(null, "mail:appIdle", "back");
  let msgHdr = firstMsgHdr(gIMAPInbox);
  do_check_neq(msgHdr, null);

  // Now move this message to the target folder.
  let messages = Cc["@mozilla.org/array;1"]
                   .createInstance(Ci.nsIMutableArray);
  messages.appendElement(msgHdr, false);
  let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
  copyService.CopyMessages(gIMAPInbox, messages, gTargetFolder, true,
                           CopyListener, null, false);
  yield false;
}

function test_waitForTargetUpdate()
{
  // After the copy, now we expect to get notified of the gTargetFolder
  // getting updated, after we simulate going idle.
  gAutoSyncListener._waitingForUpdate = true;
  gAutoSyncListener._waitingForUpdateList.push(gTargetFolder);
  gAutoSyncManager.QueryInterface(Ci.nsIObserver).observe(null, "mail:appIdle",
                                                          "idle");
  yield false;
}

// Cleanup
function endTest()
{
  let enumerator = gTargetFolder.messages;
  let numMsgs = 0;
  while (enumerator.hasMoreElements()) {
    numMsgs++;
    do_check_neq(enumerator.getNext()
                  .QueryInterface(Ci.nsIMsgDBHdr).flags & msgFlagOffline, 0);
  }
  do_check_eq(2, numMsgs);
  do_check_eq(gAutoSyncListener._waitingForUpdateList.length, 0);
  do_check_false(gAutoSyncListener._waitingForDiscovery);
  do_check_false(gAutoSyncListener._waitingForUpdate);
  teardownIMAPPump();
}

function run_test()
{
  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  let MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(nsIMFNService);
  let flags =
        nsIMFNService.folderAdded |
        nsIMFNService.msgsMoveCopyCompleted |
        nsIMFNService.msgAdded;
  MFNService.addListener(mfnListener, flags);
  addMessageToFolder(gIMAPInbox);

  async_run_tests(tests);
}

// listeners for various events to drive the tests.

mfnListener =
{
  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    dl('msgsMoveCopyCompleted to folder ' + aDestFolder.name);
    async_driver();
  },
  folderAdded: function folderAdded(aFolder)
  {
    // we are only using async yield on the target folder add
    if (aFolder.name == "targetFolder")
      async_driver();
  },

  msgAdded: function msgAdded(aMsg)
  {
  },
};

var gAutoSyncListener =
{
  _inQFolderList : new Array(),
  _runnning : false,
  _lastMessage: {},
  _waitingForUpdateList : new Array(),
  _waitingForUpdate : false,
  _waitingForDiscoveryList : new Array(),
  _waitingForDiscovery : false,

  onStateChanged : function(running) {
    try {
      this._runnning = running;
    } catch (e) {
      throw(e);
    }
  },

  onFolderAddedIntoQ : function(queue, folder) {
    try {
      let queueName = "";
      dump("folder added into Q " + this.qName(queue) + " " + folder.URI + "\n");
      if (folder instanceof Components.interfaces.nsIMsgFolder &&
          queue == nsIAutoSyncMgrListener.PriorityQueue) {
      }
    } catch (e) {
      throw(e);
    }
  },
  onFolderRemovedFromQ : function(queue, folder) {
    try {
      dump("folder removed from Q " + this.qName(queue) + " " + folder.URI + "\n");
      if (folder instanceof Components.interfaces.nsIMsgFolder &&
          queue == nsIAutoSyncMgrListener.PriorityQueue) {
      }
    } catch (e) {
      throw(e);
    }
  },
  onDownloadStarted : function(folder, numOfMessages, totalPending) {
    try {
      dump("folder download started" + folder.URI + "\n");
    } catch (e) {
      throw(e);
    }
  },

  onDownloadCompleted : function(folder) {
    try {
      dump("folder download completed" + folder.URI + "\n");
      if (folder instanceof Components.interfaces.nsIMsgFolder) {
        let index = this._waitingForUpdateList.indexOf(folder);
        if (index != -1)
          this._waitingForUpdateList.splice(index, 1);
        if (this._waitingForUpdate && this._waitingForUpdateList.length == 0) {
          dump("got last folder update looking for\n");
          this._waitingForUpdate = false;
          async_driver();
        }
      }
    } catch (e) {
      throw(e);
    }
  },

  onDownloadError : function(folder) {
    if (folder instanceof Components.interfaces.nsIMsgFolder) {
      dump("OnDownloadError: " + folder.prettiestName + "\n");
    }
  },

  onDiscoveryQProcessed : function (folder, numOfHdrsProcessed, leftToProcess) {
    dump("onDiscoveryQProcessed: " + folder.prettiestName + "\n");
    let index = this._waitingForDiscoveryList.indexOf(folder);
    if (index != -1)
      this._waitingForDiscoveryList.splice(index, 1);
    if (this._waitingForDiscovery && this._waitingForDiscoveryList.length == 0) {
      dump("got last folder discovery looking for\n");
      this._waitingForDiscovery = false;
      async_driver();
    }
  },

  onAutoSyncInitiated : function (folder) {
  },
  qName : function(queueType) {
    if (queueType == nsIAutoSyncMgrListener.PriorityQueue)
      return "priorityQ";
    if (queueType == nsIAutoSyncMgrListener.UpdateQueue)
     return "updateQ";
    if (queueType == nsIAutoSyncMgrListener.DiscoveryQueue)
      return "discoveryQ";
    return "";
  },
}

/*
 * helper functions
 */

// get the first message header found in a folder
function firstMsgHdr(folder) {
  let enumerator = folder.messages;
  if (enumerator.hasMoreElements())
    return enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}

// load and update a message in the imap fake server
function addMessageToFolder(folder)
{
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  let msgURI =
    ioService.newURI("data:text/plain;base64," +
                     btoa(messages[0].toMessageString()),
                     null, null);
  let imapMailbox =  gIMAPDaemon.getMailbox(folder.name);
  // We add messages with \Seen flag set so that we won't accidentally
  // trigger the code that updates imap folders that have unread messages moved
  // into them.
  gMessage = new imapMessage(msgURI.spec, imapMailbox.uidnext++, ["\\Seen"]);
  imapMailbox.addMessage(gMessage);
}
