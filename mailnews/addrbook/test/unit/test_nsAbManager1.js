/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsAbManager functions relating to listeners.
 */

const abManagerContractID = "@mozilla.org/abmanager;1";
const nsIAbManager = Components.interfaces.nsIAbManager;
const nsIAbListener = Components.interfaces.nsIAbListener;
const numListenerOptions = 4;

var gAbManager = Components.classes[abManagerContractID]
                             .getService(nsIAbManager);

var gAblAll;
var gAblSingle = new Array(numListenerOptions);

function abL() {}

abL.prototype = {
 mReceived: 0,
 mAutoRemoveItem: false,

  onItemAdded: function (parentItem, item) {
    this.mReceived |= nsIAbListener.itemAdded;
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  },
  onItemRemoved: function (parentItem, item) {
    this.mReceived |=
      (item == gAbManager ? nsIAbListener.directoryRemoved :
                            nsIAbListener.directoryItemRemoved);
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  },
  onItemPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIAbListener.itemChanged;
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  }
};

function NotifyAbManager() {
  gAbManager.notifyItemPropertyChanged(null, null, null, null);
  gAbManager.notifyDirectoryItemAdded(null, null);
  gAbManager.notifyDirectoryItemDeleted(null, null);
  // gAbManager just happens to be nsISupports derived and makes it easy for
  // us to distinguish between xxxItemDeleted and xxxDeleted.
  gAbManager.notifyDirectoryDeleted(null, gAbManager);
}

function run_test() {
  var i;

  // Test - Add a listener

  gAblAll = new abL;

  gAbManager.addAddressBookListener(gAblAll, nsIAbListener.all);

  for (i = 0; i < numListenerOptions; ++i) {
    gAblSingle[i] = new abL;
    gAbManager.addAddressBookListener(gAblSingle[i], 1 << i);
  }

  // Test - Notify listener on all available items

  NotifyAbManager();

  do_check_eq(gAblAll.mReceived, (1 << numListenerOptions) - 1);
  gAblAll.mReceived = 0;

  for (i = 0; i < numListenerOptions; ++i) {
    do_check_eq(gAblSingle[i].mReceived, 1 << i);
    gAblSingle[i].mReceived = 0;

    // And prepare for test 3.
    gAblSingle[i].mAutoRemoveItem = true;
  }

  // Test - Remove Single Listeners as we go through the functions

  // Check the for loop above for changes to the single listeners.

  NotifyAbManager();

  do_check_eq(gAblAll.mReceived, (1 << numListenerOptions) - 1);
  gAblAll.mReceived = 0;

  for (i = 0; i < numListenerOptions; ++i) {
    do_check_eq(gAblSingle[i].mReceived, 1 << i);
    gAblSingle[i].mReceived = 0;
  }

  // Test - Ensure the single listeners have been removed.

  NotifyAbManager();

  do_check_eq(gAblAll.mReceived, (1 <<  numListenerOptions) - 1);
  gAblAll.mReceived = 0;

  for (i = 0; i < numListenerOptions; ++i) {
    do_check_eq(gAblSingle[i].mReceived, 0);
  }

  // Test - Remove main listener

  gAbManager.removeAddressBookListener(gAblAll);
};
