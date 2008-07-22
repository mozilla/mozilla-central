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

const kMsgAdded = 0x1;
const kMsgsDeleted = 0x2;
const kMsgsMoveCopyCompleted = 0x4;
const kFolderDeleted = 0x8;
const kFolderMoveCopyCompleted = 0x10;
const kFolderRenamed = 0x20;
const kItemEvent = 0x40;
const numOptions = 7;

var gMFNService = Cc[mFNSContractID].getService(nsIMFNService);

// Our listener, which captures events.
var gMFListener =
{
  mReceived: 0,

  msgAdded: function (aMsg)
  {
    do_check_eq(this.mReceived & kMsgAdded, 0);
    this.mReceived |= kMsgAdded;
  },

  msgsDeleted: function (aMsgs)
  {
    do_check_eq(this.mReceived & kMsgsDeleted, 0);
    this.mReceived |= kMsgsDeleted;
  },

  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder)
  {
    do_check_eq(this.mReceived & kMsgsMoveCopyCompleted, 0);
    this.mReceived |= kMsgsMoveCopyCompleted;
  },

  folderDeleted: function (aFolder)
  {
    do_check_eq(this.mReceived & kFolderDeleted, 0);
    this.mReceived |= kFolderDeleted;
  },

  folderMoveCopyCompleted: function (aMove, aSrcFolder, aDestFolder)
  {
    do_check_eq(this.mReceived & kFolderMoveCopyCompleted, 0);
    this.mReceived |= kFolderMoveCopyCompleted;
  },

  folderRenamed: function (aOrigFolder, aNewFolder)
  {
    do_check_eq(this.mReceived & kFolderRenamed, 0);
    this.mReceived |= kFolderRenamed;
  },

  itemEvent: function (aItem, aEvent, aData)
  {
    do_check_eq(this.mReceived & kItemEvent, 0);
    this.mReceived |= kItemEvent;
  }
};

function NotifyMsgFolderListeners()
{
  gMFNService.notifyMsgAdded(null);
  gMFNService.notifyMsgsDeleted(null);
  gMFNService.notifyMsgsMoveCopyCompleted(null, null, null);
  gMFNService.notifyFolderDeleted(null);
  gMFNService.notifyFolderMoveCopyCompleted(null, null, null);
  gMFNService.notifyFolderRenamed(null, null);
  gMFNService.notifyItemEvent(null, null, null);
}

function run_test()
{
  // Test: Add a listener.
  gMFNService.addListener(gMFListener);

  // Test: Notify the listener of all events.
  NotifyMsgFolderListeners();

  do_check_eq(gMFListener.mReceived, (1 << numOptions) - 1);

  // Test: Remove the listener.
  gMFNService.removeListener(gMFListener);

  // Test: Send notifications again. Check that we don't receive any notifications.
  gMFListener.mReceived = 0;
  NotifyMsgFolderListeners();
  do_check_eq(gMFListener.mReceived, 0);
}
