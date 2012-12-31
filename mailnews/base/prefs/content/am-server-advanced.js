/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

// pull stuff out of window.arguments
var gServerSettings = window.arguments[0];

var serverList;

var gFirstDeferredAccount;
// initialize the controls with the "gServerSettings" argument

var gControls;
function getControls()
{
  if (!gControls)
    gControls = document.getElementsByAttribute("amsa_persist", "true");
  return gControls;
}

function getLocalFoldersAccount()
{
  return MailServices.accounts
    .FindAccountForServer(MailServices.accounts.localFoldersServer);
}

function onLoad()
{
  var prettyName = gServerSettings.serverPrettyName;

  if (prettyName)
    document.getElementById("serverPrettyName").value = 
      document.getElementById("bundle_prefs")
              .getFormattedString("forAccount", [prettyName]);

  if (gServerSettings.serverType == "imap")
  {
    document.getElementById("pop3Panel").hidden = true;
  }
  else if (gServerSettings.serverType == "pop3")
  {
    var radioGroup = document.getElementById("folderStorage");
    document.getElementById("imapPanel").hidden = true;
    gFirstDeferredAccount = gServerSettings.deferredToAccount;
    var localFoldersAccount = getLocalFoldersAccount();
    var folderPopup = document.getElementById("deferedServerPopup");
    if (gFirstDeferredAccount.length)
    {
      let account = MailServices.accounts.getAccount(gFirstDeferredAccount);
      if (account)
      {
        folderPopup.selectFolder(account.incomingServer.rootFolder);
      }
      if (gFirstDeferredAccount == localFoldersAccount.key)
      {
        radioGroup.selectedItem = document.getElementById("globalInbox");
        folderPopup.selectFolder(localFoldersAccount.incomingServer.rootFolder);
        updateInboxAccount(false, true);
      }
      else
      {
        radioGroup.selectedItem = document.getElementById("deferToServer");
        folderPopup.selectFolder(account.incomingServer.rootFolder);
        updateInboxAccount(true, true);
      }
    }
    else
    {
      radioGroup.selectedItem = document.getElementById("accountDirectory");

      // we should find out if there's another pop3/movemail server to defer to,
      // perhaps by checking the number of elements in the picker. For now, 
      // just use the local folders account
      folderPopup.selectFolder(localFoldersAccount.incomingServer.rootFolder);

      updateInboxAccount(false, false);

    }
  }

  var controls = getControls();

  for (var i = 0; i < controls.length; i++)
  {
    var slot = controls[i].id;
    if (slot in gServerSettings)
    {
      if (controls[i].localName == "checkbox")
        controls[i].checked = gServerSettings[slot];
      else
        controls[i].value = gServerSettings[slot];
    }
  }
}

function onOk()
{
  // Handle account deferral settings for POP3 accounts.
  if (gServerSettings.serverType == "pop3")
  {
    var radioGroup = document.getElementById("folderStorage");
    var gPrefsBundle = document.getElementById("bundle_prefs");

    // if this account wasn't deferred, and is now...
    if (radioGroup.value != 1 && !gFirstDeferredAccount.length)
    {
      var confirmDeferAccount =
        gPrefsBundle.getString("confirmDeferAccountWarning");

      var confirmTitle = gPrefsBundle.getString("confirmDeferAccountTitle");

      if (!Services.prompt.confirm(window, confirmTitle, confirmDeferAccount))
        return false;
    }
    switch (radioGroup.value)
    {
      case "0":
        gServerSettings['deferredToAccount'] = getLocalFoldersAccount().key;
        break;
      case "1":
        gServerSettings['deferredToAccount'] = "";
        break;
      case "2":
        var server = document.getElementById("deferedServerFolderPicker")
                             .selectedItem._folder.server;
        let account = MailServices.accounts.FindAccountForServer(server);
        gServerSettings['deferredToAccount'] = account.key;
        break;
    }
  }

  // Save the controls back to the "gServerSettings" array.
  var controls = getControls();
  for (var i = 0; i < controls.length; i++)
  {
    var slot = controls[i].id;
    if (slot in gServerSettings)
    {
      if (controls[i].localName == "checkbox")
        gServerSettings[slot] = controls[i].checked;
      else
        gServerSettings[slot] = controls[i].value;
    }
  }

  return true;
}


// Set radio element choices and picker states
function updateInboxAccount(enablePicker, enableDeferGetNewMail, event)
{
    var picker = document.getElementById('deferedServerFolderPicker');
    picker.disabled = !enablePicker;

    var deferCheckbox = document.getElementById('deferGetNewMail');
    deferCheckbox.disabled = !enableDeferGetNewMail
}
