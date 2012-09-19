/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var gIdentityListBox;                 // the root <listbox> node
var gAddButton;
var gEditButton;
var gSetDefaultButton;
var gDeleteButton;

var gAccount = null;  // the account we are showing the identities for

function onLoad()
{
  gIdentityListBox  = document.getElementById("identitiesList");
  gAddButton        = document.getElementById("addButton");
  gEditButton       = document.getElementById("editButton");
  gSetDefaultButton = document.getElementById("setDefaultButton");
  gDeleteButton     = document.getElementById("deleteButton");

  // extract the account
  gAccount = window.arguments[0].account;

  var accountName = window.arguments[0].accountName;
  document.title = document.getElementById("bundle_prefs")
                           .getFormattedString("identity-list-title", [accountName]);

  refreshIdentityList(0);
}

/**
 * Rebuilds the listbox holding the list of identities.
 *
 * @param aSelectIndex  Attempt to select the identity with this index.
 */
function refreshIdentityList(aSelectIndex)
{
  // Remove all children.
  while (gIdentityListBox.hasChildNodes())
    gIdentityListBox.removeChild(gIdentityListBox.lastChild);

  // Build the list from the identities array.
  let identities = gAccount.identities;
  for each (let identity in fixIterator(identities,
                                        Components.interfaces.nsIMsgIdentity))
  {
    if (identity.valid)
    {
      let listitem = document.createElement("listitem");
      listitem.setAttribute("label", identity.identityName);
      listitem.setAttribute("key", identity.key);
      gIdentityListBox.appendChild(listitem);
    }
  }

  // Ensure one identity is always selected.
  if (!aSelectIndex || aSelectIndex < 0)
    aSelectIndex = 0;
  else if (aSelectIndex >= gIdentityListBox.itemCount)
    aSelectIndex = gIdentityListBox.itemCount - 1;

  // This also fires the onselect event, which in turn calls updateButtons().
  gIdentityListBox.selectedIndex = aSelectIndex;
}

/**
 * Opens the identity editor dialog.
 *
 * @param identity  the identity (if any) to load in the dialog
 */
function openIdentityEditor(identity)
{
  let args = { identity: identity, account: gAccount, result: false };

  let indexToSelect = identity ? gIdentityListBox.selectedIndex :
                                 gIdentityListBox.itemCount;

  window.openDialog("am-identity-edit.xul", "",
                    "chrome,modal,resizable=no,centerscreen", args);

  if (args.result)
    refreshIdentityList(indexToSelect);
}

function getSelectedIdentity()
{
  if (gIdentityListBox.selectedItems.length != 1)
    return null;

  var identityKey = gIdentityListBox.selectedItems[0].getAttribute("key");
  let identities = gAccount.identities;
  for each (let identity in fixIterator(identities,
                                        Components.interfaces.nsIMsgIdentity))
  {
    if (identity.valid && identity.key == identityKey)
      return identity;
  }

  return null; // no identity found
}

function onEdit(event)
{
  var id = (event.target.localName == 'listbox') ? null : getSelectedIdentity();
  openIdentityEditor(id);
}

/**
 * Enable/disable buttons depending on number of identities and current selection.
 */
function updateButtons()
{
  // In this listbox there should always be one item selected.
  if (gIdentityListBox.selectedItems.length != 1 || gIdentityListBox.itemCount == 0) {
    // But in case this is not met (e.g. there is no identity for some reason,
    // or the list is being rebuilt), disable all buttons.
    gEditButton.disabled = true;
    gDeleteButton.disabled = true;
    gSetDefaultButton.disabled = true;
    return;
  }

  gEditButton.disabled = false;
  gDeleteButton.disabled = gIdentityListBox.itemCount <= 1;
  gSetDefaultButton.disabled = gIdentityListBox.selectedIndex == 0;
}

function onSetDefault(event)
{
  let identity = getSelectedIdentity();
  if (!identity)
    return;

  // If the first identity is selected, there is nothing to do.
  if (gIdentityListBox.selectedIndex == 0)
    return;

  gAccount.defaultIdentity = identity;
  // Rebuilt the identity list and select the moved identity again.
  refreshIdentityList(0);
}

function onDelete(event)
{
  if (gIdentityListBox.itemCount <= 1)  // don't support deleting the last identity
    return;

  // get delete confirmation
  let selectedIdentity = getSelectedIdentity();

  let prefsBundle = document.getElementById("bundle_prefs");
  let confirmTitle = prefsBundle.getFormattedString("identity-delete-confirm-title",
                                                    [window.arguments[0].accountName]);
  let confirmText = prefsBundle.getFormattedString("identity-delete-confirm",
                                                   [selectedIdentity.identityName]);
  let confirmButton = prefsBundle.getString("identity-delete-confirm-button");

  if (Services.prompt.confirmEx(window, confirmTitle, confirmText,
                                (Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING) +
                                (Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL),
                                confirmButton, null, null, null, {}))
    return;

  let selectedItemIndex = gIdentityListBox.selectedIndex;

  gAccount.removeIdentity(selectedIdentity);

  refreshIdentityList(selectedItemIndex);
}

function onOk()
{
  window.arguments[0].result = true;
  return true;
}
