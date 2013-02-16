/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");

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
}

function abNameOKButton()
{
  var newName = gNameInput.value.trim();

  // Either create a new directory or update an existing one depending on what
  // we were given when we started.
  if (gDirectory)
    gDirectory.dirName = newName;
  else
    MailServices.ab.newAddressBook(newName, "", kPABDirectory);

  return true;
}

function abNameDoOkEnabling()
{
  gOkButton.disabled = gNameInput.value.trim() == "";
}
