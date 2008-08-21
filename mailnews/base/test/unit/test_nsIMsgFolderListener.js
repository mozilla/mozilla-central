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

const finalReceived = nsIMFNService.msgAdded |
                      nsIMFNService.msgsDeleted |
                      nsIMFNService.msgsMoveCopyCompleted |
                      nsIMFNService.folderDeleted |
                      nsIMFNService.folderMoveCopyCompleted |
                      nsIMFNService.folderRenamed |
                      nsIMFNService.itemEvent;

var gMFNService = Cc[mFNSContractID].getService(nsIMFNService);

// Our listener, which captures events.
var gMFListener =
{
  mReceived: 0,

  msgAdded: function (aMsg)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgAdded, 0);
    this.mReceived |= nsIMFNService.msgAdded;
  },

  msgsDeleted: function (aMsgs)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsDeleted, 0);
    this.mReceived |= nsIMFNService.msgsDeleted;
  },

  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.msgsMoveCopyCompleted;
  },

  folderDeleted: function (aFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderDeleted, 0);
    this.mReceived |= nsIMFNService.folderDeleted;
  },

  folderMoveCopyCompleted: function (aMove, aSrcFolder, aDestFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.folderMoveCopyCompleted;
  },

  folderRenamed: function (aOrigFolder, aNewFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderRenamed, 0);
    this.mReceived |= nsIMFNService.folderRenamed;
  },

  itemEvent: function (aItem, aEvent, aData)
  {
    do_check_eq(this.mReceived & nsIMFNService.itemEvent, 0);
    this.mReceived |= nsIMFNService.itemEvent;
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
  gMFNService.addListener(gMFListener, nsIMFNService.all);

  // Test: Notify the listener of all events.
  NotifyMsgFolderListeners();

  do_check_eq(gMFListener.mReceived, finalReceived);

  // Test: Remove the listener.
  gMFNService.removeListener(gMFListener);

  // Test: Send notifications again. Check that we don't receive any notifications.
  gMFListener.mReceived = 0;
  NotifyMsgFolderListeners();
  do_check_eq(gMFListener.mReceived, 0);
}
