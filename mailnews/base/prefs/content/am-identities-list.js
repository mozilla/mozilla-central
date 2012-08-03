/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gIdentityListBox;                 // the root <listbox> node
var gAddButton;
var gEditButton;
var gDeleteButton;

var gAccount = null;  // the account we are showing the identities for

function onLoad()
{
  gIdentityListBox = document.getElementById("identitiesList");
  gAddButton       = document.getElementById("addButton");
  gEditButton      = document.getElementById("editButton");
  gDeleteButton    = document.getElementById("deleteButton");

  // extract the account
  gAccount = window.arguments[0].account;

  var accountName = window.arguments[0].accountName;
  document.title = document.getElementById("bundle_prefs")
                           .getFormattedString("identity-list-title", [accountName]);

  // extract the account from
  refreshIdentityList();

  // try selecting the first identity
  gIdentityListBox.selectedIndex = 0;
}

function refreshIdentityList()
{
  // remove all children
  while (gIdentityListBox.hasChildNodes())
    gIdentityListBox.removeChild(gIdentityListBox.lastChild);

  var identities = gAccount.identities;
  var identitiesCount = identities.Count();
  for (var j = 0; j < identitiesCount; j++) 
  {
    var identity = identities.QueryElementAt(j, Components.interfaces.nsIMsgIdentity);
    if (identity.valid)
    {
      var listitem = document.createElement("listitem");
      listitem.setAttribute("label", identity.identityName);
      listitem.setAttribute("key", identity.key);
      gIdentityListBox.appendChild(listitem);
    }
  }
}

// opens the identity editor dialog
// identity: pass in the identity (if any) to load in the dialog
function openIdentityEditor(identity)
{
  var result = false;
  var args = { identity: identity, account: gAccount, result: result };

  window.openDialog("am-identity-edit.xul", "",
                    "chrome,modal,resizable=no,centerscreen", args);

  var selectedItemIndex = gIdentityListBox.selectedIndex;

  if (args.result)
  {
    refreshIdentityList();
    gIdentityListBox.selectedIndex = selectedItemIndex;
  }
}

function getSelectedIdentity()
{
  var identityKey = gIdentityListBox.selectedItems[0].getAttribute("key");
  var identities = gAccount.identities;
  var identitiesCount = identities.Count();
  for (var j = 0; j < identitiesCount; j++)
  {
    var identity = identities.QueryElementAt(j, Components.interfaces.nsIMsgIdentity);
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

function updateButtons()
{
  if (gIdentityListBox.selectedItems.length <= 0)
  {
    gEditButton.setAttribute("disabled", "true");
    gDeleteButton.setAttribute("disabled", "true");
  }
  else
  {
    gEditButton.removeAttribute("disabled");
    if (gIdentityListBox.getRowCount() > 1)
      gDeleteButton.removeAttribute("disabled");
  }
}

function onDelete(event)
{
  if (gIdentityListBox.getRowCount() <= 1)  // don't support deleting the last identity
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

  gAccount.removeIdentity(selectedIdentity);
  // rebuild the list
  refreshIdentityList();
}

function onOk()
{
  window.arguments[0].result = true;
  return true;
}

function onSetDefault(event)
{
  // not implemented yet
}
