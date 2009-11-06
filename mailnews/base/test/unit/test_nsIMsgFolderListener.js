/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test suite for basic functionality with nsIMsgFolderListeners.
 */

const mFNSContractID = "@mozilla.org/messenger/msgnotificationservice;1";
const nsIMFNService = Ci.nsIMsgFolderNotificationService;
const nsIMFListener = Ci.nsIMsgFolderListener;


const gIndividualFlags =
[
  nsIMFNService.msgAdded,
  nsIMFNService.msgsClassified,
  nsIMFNService.msgsDeleted,
  nsIMFNService.msgsMoveCopyCompleted,
  nsIMFNService.folderAdded,
  nsIMFNService.folderDeleted,
  nsIMFNService.folderMoveCopyCompleted,
  nsIMFNService.folderRenamed,
  nsIMFNService.itemEvent,
];

var gMFNService = Cc[mFNSContractID].getService(nsIMFNService);

// Our listener, which captures events.
function gMFListener() {}
gMFListener.prototype =
{
  mReceived: 0,
  mRemoveSelf: false,

  msgAdded: function (aMsg)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgAdded, 0);
    this.mReceived |= nsIMFNService.msgAdded;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  msgsClassified: function (aMsgs, aJunkProcessed, aTraitProcessed)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsClassified, 0);
    this.mReceived |= nsIMFNService.msgsClassified;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  msgsDeleted: function (aMsgs)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsDeleted, 0);
    this.mReceived |= nsIMFNService.msgsDeleted;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.msgsMoveCopyCompleted;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },
  
  folderAdded: function (aFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderAdded, 0);
    this.mReceived |= nsIMFNService.folderAdded;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  folderDeleted: function (aFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderDeleted, 0);
    this.mReceived |= nsIMFNService.folderDeleted;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  folderMoveCopyCompleted: function (aMove, aSrcFolder, aDestFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.folderMoveCopyCompleted;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  folderRenamed: function (aOrigFolder, aNewFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderRenamed, 0);
    this.mReceived |= nsIMFNService.folderRenamed;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  },

  itemEvent: function (aItem, aEvent, aData)
  {
    do_check_eq(this.mReceived & nsIMFNService.itemEvent, 0);
    this.mReceived |= nsIMFNService.itemEvent;
    if (this.mRemoveSelf)
      gMFNService.removeListener(this);
  }
};

function NotifyMsgFolderListeners()
{
  gMFNService.notifyMsgAdded(null);
  gMFNService.notifyMsgsClassified(null, null, null);
  gMFNService.notifyMsgsDeleted(null);
  gMFNService.notifyMsgsMoveCopyCompleted(null, null, null, null);
  gMFNService.notifyFolderAdded(null);
  gMFNService.notifyFolderDeleted(null);
  gMFNService.notifyFolderMoveCopyCompleted(null, null, null);
  gMFNService.notifyFolderRenamed(null, null);
  gMFNService.notifyItemEvent(null, null, null);
}

function run_test()
{
  // Test: Add listeners
  var singleListeners = [];

  var addAListener = function (flag) {
    var listener = new gMFListener();
    gMFNService.addListener(listener, flag);
    singleListeners.push(listener);
  };

  gIndividualFlags.forEach(addAListener);

  // Test: Notify the listeners of all events.
  NotifyMsgFolderListeners();

  // Test: check whether the correct number of notifications have been received.
  // Then remove the listeners
  var checkFlag = function (flag) {
    var listener = singleListeners.shift();
    do_check_eq(listener.mReceived, flag);
    listener.mRemoveSelf = true;
    listener.mReceived = 0;
    singleListeners.push(listener);
  };
  gIndividualFlags.forEach(checkFlag);

  // We'll do one more set of notifications, and remove ourselves in the middle of them
  NotifyMsgFolderListeners();

  // Test: all listeners should be removed at this point
  do_check_false(gMFNService.hasListeners);

  // Test: Send notifications again. Check that we don't receive any notifications.
  singleListeners.forEach(function (listener) { listener.mReceived = 0; });

  NotifyMsgFolderListeners();

  var checkNotReceived = function() {
    do_check_eq(singleListeners.shift().mReceived, 0);
  }
  gIndividualFlags.forEach(checkNotReceived);
}
