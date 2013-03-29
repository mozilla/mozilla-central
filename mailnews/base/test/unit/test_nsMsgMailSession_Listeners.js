/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgMailSession functions relating to listeners.
 */

Components.utils.import("resource:///modules/mailServices.js");

const nsIFolderListener = Components.interfaces.nsIFolderListener;
const numListenerFunctions = 8;

var gMailSessionNotifier = MailServices.mailSession.QueryInterface(nsIFolderListener);

var gFLAll;
var gFLSingle = new Array(numListenerFunctions);

function fL() {}

fL.prototype = {
  mReceived: 0,
  mAutoRemoveItem: false,

  OnItemAdded: function (parentItem, item) {
    this.mReceived |= nsIFolderListener.added;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemRemoved: function (parentItem, item) {
    this.mReceived |= nsIFolderListener.removed;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIFolderListener.propertyChanged;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemIntPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIFolderListener.intPropertyChanged;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemBoolPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIFolderListener.boolPropertyChanged;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemUnicharPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIFolderListener.unicharPropertyChanged;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemPropertyFlagChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIFolderListener.propertyFlagChanged;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  },
  OnItemEvent: function (parentItem, item) {
    this.mReceived |= nsIFolderListener.event;
    if (this.mAutoRemoveItem)
      MailServices.mailSession.RemoveFolderListener(this);
  }
};

function NotifyMailSession() {
    gMailSessionNotifier.OnItemAdded(null, null);
    gMailSessionNotifier.OnItemRemoved(null, null);
    gMailSessionNotifier.OnItemPropertyChanged(null, null, null, null);
    gMailSessionNotifier.OnItemIntPropertyChanged(null, null, null, null);
    gMailSessionNotifier.OnItemBoolPropertyChanged(null, null, null, null);
    gMailSessionNotifier.OnItemUnicharPropertyChanged(null, null, null, null);
    gMailSessionNotifier.OnItemPropertyFlagChanged(null, null, null, null);
    gMailSessionNotifier.OnItemEvent(null, null);
}

function run_test() {
  var i;

  do_check_true(MailServices.mailSession != null);

  // Test - Add a listener

  gFLAll = new fL;

  MailServices.mailSession.AddFolderListener(gFLAll, nsIFolderListener.all);

  for (i = 0; i < numListenerFunctions; ++i) {
    gFLSingle[i] = new fL;
    MailServices.mailSession.AddFolderListener(gFLSingle[i], Math.pow(2, i));
  }

  // Test - Notify listener on all available items

  NotifyMailSession();

  do_check_eq(gFLAll.mReceived, Math.pow(2, numListenerFunctions) - 1);
  gFLAll.mReceived = 0;

  for (i = 0; i < numListenerFunctions; ++i) {
    do_check_eq(gFLSingle[i].mReceived, Math.pow(2, i));
    gFLSingle[i].mReceived = 0;

    // And prepare for test 3.
    gFLSingle[i].mAutoRemoveItem = true;
  }

  // Test - Remove Single Listeners as we go through the functions

  // Check the for loop above for changes to the single listeners.

  NotifyMailSession();

  do_check_eq(gFLAll.mReceived, Math.pow(2, numListenerFunctions) - 1);
  gFLAll.mReceived = 0;

  for (i = 0; i < numListenerFunctions; ++i) {
    do_check_eq(gFLSingle[i].mReceived, Math.pow(2, i));
    gFLSingle[i].mReceived = 0;
  }

  // Test - Ensure the single listeners have been removed.

  NotifyMailSession();

  do_check_eq(gFLAll.mReceived, Math.pow(2, numListenerFunctions) - 1);
  gFLAll.mReceived = 0;

  for (i = 0; i < numListenerFunctions; ++i)
    do_check_eq(gFLSingle[i].mReceived, 0);

  // Test - Remove main listener

  MailServices.mailSession.RemoveFolderListener(gFLAll);
};
