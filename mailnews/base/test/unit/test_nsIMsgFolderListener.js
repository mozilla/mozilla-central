/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test suite for basic functionality with nsIMsgFolderListeners.
 *
 * Currently tests itemAdded, itemDeleted, itemMoveCopyCompleted, and itemEvent.
 */

const mFNSContractID = "@mozilla.org/messenger/msgnotificationservice;1";
const nsIMFNService = Ci.nsIMsgFolderNotificationService;
const nsIMFListener = Ci.nsIMsgFolderListener;

const kItemAdded = 0x1;
const kItemDeleted = 0x2;
const kItemMoveCopyCompleted = 0x4;
const kItemEvent = 0x8;
const numOptions = 4;

var gMFNService = Cc[mFNSContractID].getService(nsIMFNService);

// Our listener, which captures events.
var gMFListener =
{
  mReceived: 0,

  itemAdded: function (aItem)
  {
    do_check_eq(this.mReceived & kItemAdded, 0);
    this.mReceived |= kItemAdded;
  },

  itemDeleted: function (aItem)
  {
    do_check_eq(this.mReceived & kItemDeleted, 0);
    this.mReceived |= kItemDeleted;
  },

  itemMoveCopyCompleted: function (aMove, aSrcItems, aDestFolder)
  {
    do_check_eq(this.mReceived & kItemMoveCopyCompleted, 0);
    this.mReceived |= kItemMoveCopyCompleted;
  },

  itemEvent: function (aItem, aEvent, aData)
  {
    do_check_eq(this.mReceived & kItemEvent, 0);
    this.mReceived |= kItemEvent;
  }
};

function NotifyMsgFolderListeners()
{
  gMFNService.notifyItemAdded(null);
  gMFNService.notifyItemDeleted(null);
  gMFNService.notifyItemMoveCopyCompleted(null, null, null);
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
