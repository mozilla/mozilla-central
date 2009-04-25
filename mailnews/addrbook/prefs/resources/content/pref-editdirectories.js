/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org Address Book.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

  if (prefs.prefIsLocked("ldap_2.disable_button_add"))
    document.getElementById("addButton").setAttribute('disabled', true);

  // Fill out the directory list
  fillDirectoryList();

  const nsIAbListener = Components.interfaces.nsIAbListener;
  // Add a listener so we can update correctly if the list should change
  Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager)
            .addAddressBookListener(gAddressBookAbListener,
                                    nsIAbListener.itemAdded |
                                    nsIAbListener.directoryRemoved |
                                    nsIAbListener.itemChanged);
}

function onUninitEditDirectories()
{
  Components.classes["@mozilla.org/abmanager;1"]
            .getService(Components.interfaces.nsIAbManager)
            .removeAddressBookListener(gAddressBookAbListener);
}

function fillDirectoryList()
{
  var abList = document.getElementById("directoriesList");

  // Empty out anything in the list
  while (abList.hasChildNodes())
    abList.removeChild(abList.lastChild);

  // Init the address book list
  var addressBooks = Components.classes["@mozilla.org/abmanager;1"]
                               .getService(Components.interfaces.nsIAbManager)
                               .directories;
  var holdingArray = [];

  while (addressBooks && addressBooks.hasMoreElements()) {
    var ab = addressBooks.getNext();
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
    var disable = false;
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    var ab = Components.classes["@mozilla.org/abmanager;1"]
                       .getService(Components.interfaces.nsIAbManager)
                       .getDirectory(abList.value);
    try {
      disable = prefs.getBoolPref(ab.dirPrefId + ".disable_delete");
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
    var abURI = abList.value;
    var ab = Components.classes["@mozilla.org/abmanager;1"]
                       .getService(Components.interfaces.nsIAbManager)
                       .getDirectory(abURI);

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
