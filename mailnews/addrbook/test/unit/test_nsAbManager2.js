/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsAbManager functions relating to add/delete directories and
 * getting the list of directories..
 */

do_import_script("mailnews/addrbook/test/resources/abSetup.js");
do_import_script("mailnews/addrbook/test/resources/abCleanup.js");

const abManagerContractID = "@mozilla.org/abmanager;1";
const nsIAbManager = Components.interfaces.nsIAbManager;
const nsIAbDirectory = Components.interfaces.nsIAbDirectory;
const nsIAbListener = Components.interfaces.nsIAbListener;
const numListenerOptions = 4;

var testnum = 0;

var gAbManager = Components.classes[abManagerContractID]
                             .getService(nsIAbManager);

var gAblAll;
var gAblSingle = new Array(numListenerOptions);

function abL() {}

abL.prototype = {
 mReceived: 0,
 mDirectory: null,
 mAutoRemoveItem: false,

  onItemAdded: function (parentItem, item) {
    this.mReceived |= nsIAbListener.itemAdded;
    this.mDirectory = item;
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  },
  onItemRemoved: function (parentItem, item) {
    this.mReceived |= nsIAbListener.directoryRemoved;
    this.mDirectory = item;
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  },
  onItemPropertyChanged: function (item, property, oldValue, newValue) {
    this.mReceived |= nsIAbListener.itemChanged;
    this.mDirectory = item;
    if (this.mAutoRemoveItem)
      gAbManager.removeAddressBookListener(this);
  }
};

function checkDirs(dirs, dirArray) {
    while (dirs.hasMoreElements()) {
      dump("has elements\n");
      var dir = dirs.getNext().QueryInterface(nsIAbDirectory);
      var loc = dirArray.indexOf(dir.URI);
      dump(dir.URI + " " + loc + "\n");

      if (loc == -1)
        do_throw("Unexpected directory " + dir.URI + " found in address book list");
      else
        dirArray[loc] = null;
    }

    dirArray.forEach(function(value) { do_check_eq(value, null); });
}

function addDirectory(dirName) {
  // Add the directory
  gAbManager.newAddressBook(dirName, "", kPABData.dirType);

  // Check for correct notifications
  do_check_eq(gAblAll.mReceived, nsIAbListener.itemAdded);

  var newDirectory = gAblAll.mDirectory.QueryInterface(nsIAbDirectory);

  gAblAll.mReceived = 0;
  gAblAll.mDirectory = null;

  for (var i = 0; i < numListenerOptions; ++i) {
    if (1 << i == nsIAbListener.itemAdded) {
      do_check_eq(gAblSingle[i].mReceived, nsIAbListener.itemAdded);
      gAblSingle[i].mReceived = 0;
    }
    else
      do_check_eq(gAblSingle[i].mReceived, 0);
  }

  return newDirectory;
}

function removeDirectory(directory) {
  // Remove the directory
  gAbManager.deleteAddressBook(directory.URI);

  // Check correct notifications
  do_check_eq(gAblAll.mReceived, nsIAbListener.directoryRemoved);
  do_check_eq(gAblAll.mDirectory, directory);

  gAblAll.mReceived = 0;
  gAblAll.mDirectory = null;

  for (var i = 0; i < numListenerOptions; ++i) {
    if (1 << i == nsIAbListener.directoryRemoved) {
      do_check_eq(gAblSingle[i].mReceived, nsIAbListener.directoryRemoved);
      gAblSingle[i].mReceived = 0;
    }
    else
      do_check_eq(gAblSingle[i].mReceived, 0);
  }
}

function run_test() {
  try {
    var i;

    // Set up listeners
    gAblAll = new abL;
    gAbManager.addAddressBookListener(gAblAll, nsIAbListener.all);

    for (i = 0; i < numListenerOptions; ++i) {
      gAblSingle[i] = new abL;
      gAbManager.addAddressBookListener(gAblSingle[i], 1 << i);
    }

    ++testnum; // Test 1 - Check initial directories

    checkDirs(gAbManager.directories, [kPABData.URI, kCABData.URI]);

    ++testnum; // Test 2 - Add a directory

    var newDirectory1 = addDirectory("testAb1");

    // Check new directory list
    checkDirs(gAbManager.directories,
              [kPABData.URI, kCABData.URI, newDirectory1.URI]);

    ++testnum; // Test 3 - Repeat

    var newDirectory2 = addDirectory("testAb2");

    // Check new directory list
    checkDirs(gAbManager.directories,
              [kPABData.URI, kCABData.URI,
               newDirectory1.URI, newDirectory2.URI]);

    ++testnum; // Test 4 - Remove a directory

    removeDirectory(newDirectory1);
    newDirectory1 = null;

    // Check new directory list
    checkDirs(gAbManager.directories,
              [kPABData.URI, kCABData.URI, newDirectory2.URI]);

    ++testnum; // Test 5 - Repeat

    removeDirectory(newDirectory2);
    newDirectory2 = null;

    // Check new directory list
    checkDirs(gAbManager.directories,
              [kPABData.URI, kCABData.URI]);

    ++testnum; // Test 6 - Clear everything down

    gAbManager.removeAddressBookListener(gAblAll);
    gAblAll = null;

    for (i = 0; i < numListenerOptions; ++i) {
      gAbManager.removeAddressBookListener(gAblSingle[i]);
      gAblSingle[i] = null;
    }

    cleanup();
  }
  catch (e) {
    throw "FAILED in test #" + testnum + " : " + e;
  }
};
