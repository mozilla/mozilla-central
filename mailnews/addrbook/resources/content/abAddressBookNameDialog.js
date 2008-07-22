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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
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

var gOkButton;
var gNameInput;
var gDirectory = null;

const kPersonalAddressbookURI = "moz-abmdbdirectory://abook.mab";
const kCollectedAddressbookURI = "moz-abmdbdirectory://history.mab";
const kPABDirectory = 2; // defined in nsDirPrefs.h

function abNameOnLoad()
{
  // Get the document elements.  
  gOkButton = document.documentElement.getButton('accept');
  gNameInput = document.getElementById('name');

  // look in arguments[0] for parameters to see if we have a directory or not
  if ("arguments" in window && window.arguments[0] &&
      "selectedDirectory" in window.arguments[0]) {
    gDirectory = window.arguments[0].selectedDirectory;
    gNameInput.value = gDirectory.dirName;
  }

  // Work out the window title (if we have a directory specified, then it's a
  // rename).
  var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService);

  var bundle = document.getElementById("bundle_addressBook");

  document.title = bundle.getString(gDirectory ?
    'renameAddressBookTitle' : 'newAddressBookTitle');

  if (gDirectory &&
     (gDirectory.URI == kCollectedAddressbookURI ||
       gDirectory.URI == kPersonalAddressbookURI)) {
    // Address book name is not editable, therefore disable the field and
    // only have an ok button that doesn't do anything.
    gNameInput.readOnly = true;
    document.documentElement.buttons = "accept";
    document.documentElement.removeAttribute("ondialogaccept");
  } else {
    gNameInput.focus();
    abNameDoOkEnabling();
  }

  moveToAlertPosition();
}

function abNameOKButton()
{
  var newName = gNameInput.value.replace(/^\s+|\s+$/g, '');

  // Either create a new directory or update an existing one depending on what
  // we were given when we started.
  if (gDirectory)
    gDirectory.dirName = newName;
  else
    Components.classes["@mozilla.org/abmanager;1"]
              .getService(Components.interfaces.nsIAbManager)
              .newAddressBook(newName, "", kPABDirectory);

  return true;
}

function abNameDoOkEnabling()
{
  gOkButton.disabled = !/\S/.test(gNameInput.value);
}
