/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

// Listener to refresh the list items if something changes. In all these
// cases we just rebuild the list as it is easier than searching/adding in the
// correct places an would be an infrequent operation.
var gAddressBookAbListener = {
  onItemAdded: function(parentDir, item) {
    if (item instanceof Components.interfaces.nsIAbDirectory) {
      fillDirectoryList();
    }
  },
  onItemRemoved: function(parentDir, item) {
    if (item instanceof Components.interfaces.nsIAbDirectory) {
      fillDirectoryList();
    }
  },
  onItemPropertyChanged: function(item, property, oldValue, newValue) {
    if (item instanceof Components.interfaces.nsIAbDirectory) {
      fillDirectoryList();
    }
  }
};

function onInitEditDirectories()
{
  // For AbDeleteDirectory in abCommon.js
  gAddressBookBundle = document.getElementById("bundle_addressBook");

  // If the pref is locked disable the "Add" button
  if (Services.prefs.prefIsLocked("ldap_2.disable_button_add"))
    document.getElementById("addButton").setAttribute('disabled', true);

  // Fill out the directory list
  fillDirectoryList();

  const nsIAbListener = Components.interfaces.nsIAbListener;
  // Add a listener so we can update correctly if the list should change
  MailServices.ab.addAddressBookListener(gAddressBookAbListener,
                                         nsIAbListener.itemAdded |
                                         nsIAbListener.directoryRemoved |
                                         nsIAbListener.itemChanged);
}

function onUninitEditDirectories()
{
  MailServices.ab.removeAddressBookListener(gAddressBookAbListener);
}

function fillDirectoryList()
{
  var abList = document.getElementById("directoriesList");

  // Empty out anything in the list
  while (abList.hasChildNodes())
    abList.removeChild(abList.lastChild);

  // Init the address book list
  let directories = MailServices.ab.directories;
  let holdingArray = [];
  while (directories && directories.hasMoreElements()) {
    let ab = directories.getNext();
    if (ab instanceof Components.interfaces.nsIAbDirectory && ab.isRemote)
      holdingArray.push(ab);
  }

  holdingArray.sort(function (a, b) { return a.dirName.localeCompare(b.dirName); });

  holdingArray.forEach(function (ab) {
    var item = document.createElement('listitem');
    item.setAttribute("label", ab.dirName);
    item.setAttribute("value", ab.URI);

    abList.appendChild(item);
  });
}

function selectDirectory()
{
  var abList = document.getElementById("directoriesList");
  var editButton = document.getElementById("editButton");
  var removeButton = document.getElementById("removeButton");

  if (abList && abList.selectedItem) {
    editButton.removeAttribute("disabled");

    // If the disable delete button pref for the selected directory is set,
    // disable the delete button for that directory.
    let disable = false;
    let ab = MailServices.ab.getDirectory(abList.value);
    try {
      disable = Services.prefs.getBoolPref(ab.dirPrefId + ".disable_delete");
    }
    catch(ex){
      // If this preference is not set, it's ok.
    }
    if (disable)
      removeButton.setAttribute("disabled", true);
    else
      removeButton.removeAttribute("disabled");
  }
  else {
    editButton.setAttribute("disabled", true);
    removeButton.setAttribute("disabled", true);
  }
}

function dblClickDirectory(event)
{
  // We only care about left click events.
  if (event.button != 0)
    return;

  editDirectory();
}

function editDirectory()
{
  var abList = document.getElementById("directoriesList");

  if (abList && abList.selectedItem) {
    let abURI = abList.value;
    let ab = MailServices.ab.getDirectory(abURI);

    window.openDialog(ab.propertiesChromeURI, "editDirectory",
                      "chrome,modal=yes,resizable=no",
                      { selectedDirectory: ab });
  }
}

function removeDirectory()
{
  var abList = document.getElementById("directoriesList");

  if (abList && abList.selectedItem)
    AbDeleteDirectory(abList.value);
}
