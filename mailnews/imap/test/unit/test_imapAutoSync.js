/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
load("../../../resources/logHelper.js");

load("../../../resources/asyncTestUtils.js");

load("../../../resources/alertTestUtils.js");
load("../../../resources/messageGenerator.js");

// Globals
Components.utils.import("resource:///modules/mailServices.js");

setupIMAPPump();

const msgFlagOffline = Ci.nsMsgMessageFlags.Offline;
const nsIAutoSyncMgrListener = Ci.nsIAutoSyncMgrListener;

var gGotAlert;

var gAutoSyncManager = Cc["@mozilla.org/imap/autosyncmgr;1"]
                       .getService(Ci.nsIAutoSyncManager);

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

  IMAPPump.incomingServer.rootFolder.createSubfolder("targetFolder", null);
  yield false;
  gTargetFolder = IMAPPump.incomingServer.rootFolder.getChildNamed("targetFolder");
  do_check_true(gTargetFolder instanceof Ci.nsIMsgImapMailFolder);
  // set folder to be checked for new messages when inbox is checked.
  gTargetFolder.setFlag(Ci.nsMsgFolderFlags.CheckNew);
}

function test_checkForNewMessages()
{
  addMessageToFolder(gTargetFolder);
  // This will update the INBOX and STATUS targetFolder. We only care about
  // the latter.
  IMAPPump.inbox.getNewMessages(null, null);
  IMAPPump.server.performTest("STATUS");
  // Now we'd like to make autosync update folders it knows about, to
  // get the initial autosync out of the way.
  yield true;
}

function test_triggerAutoSyncIdle()
{
  // wait for both folders to get updated.
  gAutoSyncListener._waitingForDiscoveryList.push(IMAPPump.inbox);
  gAutoSyncListener._waitingForDiscoveryList.push(gTargetFolder);
  gAutoSyncListener._waitingForDiscovery = true;
  let observer = gAutoSyncManager.QueryInterface(Ci.nsIObserver);
  observer.observe(null, "mail-startup-done", "");
  observer.observe(null, "mail:appIdle", "idle");
}

// move the message to a diffent folder
function test_moveMessageToTargetFolder()
{
  let observer = gAutoSyncManager.QueryInterface(Ci.nsIObserver);
  observer.observe(null, "mail:appIdle", "back");
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  do_check_neq(msgHdr, null);

  // Now move this message to the target folder.
  let messages = Cc["@mozilla.org/array;1"]
                   .createInstance(Ci.nsIMutableArray);
  messages.appendElement(msgHdr, false);
  MailServices.copy.CopyMessages(IMAPPump.inbox, messages, gTargetFolder, true,
                                 asyncCopyListener, null, false);
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
  // Need two yield here to get results of both onDownloadCompleted and onDiscoveryQProcessed
  yield false;
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
  let flags =
        nsIMFNService.folderAdded |
        nsIMFNService.msgsMoveCopyCompleted |
        nsIMFNService.msgAdded;
  MailServices.mfn.addListener(mfnListener, flags);
  addMessageToFolder(IMAPPump.inbox);

  async_run_tests(tests);
}

// listeners for various events to drive the tests.

var mfnListener =
{
  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    dump('msgsMoveCopyCompleted to folder ' + aDestFolder.name + '\n');
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
        let index = mailTestUtils.non_strict_index_of(this._waitingForUpdateList, folder);
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
    let index = mailTestUtils.non_strict_index_of(this._waitingForDiscoveryList, folder);
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

// load and update a message in the imap fake server
function addMessageToFolder(folder)
{
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());

  let msgURI =
    Services.io.newURI("data:text/plain;base64," +
                       btoa(messages[0].toMessageString()),
                       null, null);
  let imapMailbox =  IMAPPump.daemon.getMailbox(folder.name);
  // We add messages with \Seen flag set so that we won't accidentally
  // trigger the code that updates imap folders that have unread messages moved
  // into them.
  let message = new imapMessage(msgURI.spec, imapMailbox.uidnext++, ["\\Seen"]);
  imapMailbox.addMessage(message);
}
