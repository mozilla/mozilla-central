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

Components.utils.import("resource:///modules/mailServices.js");

const nsIMFNService = Ci.nsIMsgFolderNotificationService;
const nsIMFListener = Ci.nsIMsgFolderListener;


const gIndividualFlags =
[
  nsIMFNService.msgAdded,
  nsIMFNService.msgsClassified,
  nsIMFNService.msgsDeleted,
  nsIMFNService.msgsMoveCopyCompleted,
  nsIMFNService.msgKeyChanged,
  nsIMFNService.folderAdded,
  nsIMFNService.folderDeleted,
  nsIMFNService.folderMoveCopyCompleted,
  nsIMFNService.folderRenamed,
  nsIMFNService.itemEvent,
];

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
      MailServices.mfn.removeListener(this);
  },

  msgsClassified: function (aMsgs, aJunkProcessed, aTraitProcessed)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsClassified, 0);
    this.mReceived |= nsIMFNService.msgsClassified;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  msgsDeleted: function (aMsgs)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsDeleted, 0);
    this.mReceived |= nsIMFNService.msgsDeleted;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgsMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.msgsMoveCopyCompleted;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  msgKeyChanged: function(aOldMsgKey, aNewMsgHdr)
  {
    do_check_eq(this.mReceived & nsIMFNService.msgKeyChanged, 0);
    this.mReceived |= nsIMFNService.msgKeyChanged;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  folderAdded: function (aFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderAdded, 0);
    this.mReceived |= nsIMFNService.folderAdded;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  folderDeleted: function (aFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderDeleted, 0);
    this.mReceived |= nsIMFNService.folderDeleted;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  folderMoveCopyCompleted: function (aMove, aSrcFolder, aDestFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderMoveCopyCompleted, 0);
    this.mReceived |= nsIMFNService.folderMoveCopyCompleted;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  folderRenamed: function (aOrigFolder, aNewFolder)
  {
    do_check_eq(this.mReceived & nsIMFNService.folderRenamed, 0);
    this.mReceived |= nsIMFNService.folderRenamed;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  },

  itemEvent: function (aItem, aEvent, aData)
  {
    do_check_eq(this.mReceived & nsIMFNService.itemEvent, 0);
    this.mReceived |= nsIMFNService.itemEvent;
    if (this.mRemoveSelf)
      MailServices.mfn.removeListener(this);
  }
};

function NotifyMsgFolderListeners()
{
  MailServices.mfn.notifyMsgAdded(null);
  MailServices.mfn.notifyMsgsClassified(null, null, null);
  MailServices.mfn.notifyMsgsDeleted(null);
  MailServices.mfn.notifyMsgsMoveCopyCompleted(null, null, null, null);
  MailServices.mfn.notifyMsgKeyChanged(null, null);
  MailServices.mfn.notifyFolderAdded(null);
  MailServices.mfn.notifyFolderDeleted(null);
  MailServices.mfn.notifyFolderMoveCopyCompleted(null, null, null);
  MailServices.mfn.notifyFolderRenamed(null, null);
  MailServices.mfn.notifyItemEvent(null, null, null);
}

function run_test()
{
  // Test: Add listeners
  var singleListeners = [];

  var addAListener = function (flag) {
    var listener = new gMFListener();
    MailServices.mfn.addListener(listener, flag);
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
  do_check_false(MailServices.mfn.hasListeners);

  // Test: Send notifications again. Check that we don't receive any notifications.
  singleListeners.forEach(function (listener) { listener.mReceived = 0; });

  NotifyMsgFolderListeners();

  var checkNotReceived = function() {
    do_check_eq(singleListeners.shift().mReceived, 0);
  }
  gIndividualFlags.forEach(checkNotReceived);
}
