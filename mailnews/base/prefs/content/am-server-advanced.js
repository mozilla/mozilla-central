/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

// pull stuff out of window.arguments
var gServerSettings = window.arguments[0];

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
    document.getElementById("imapPanel").hidden = true;
    let radioGroup = document.getElementById("folderStorage");

    gFirstDeferredAccount = gServerSettings.deferredToAccount;
    let folderPopup = document.getElementById("deferredServerPopup");

    // The current account should not be shown in the folder picker
    // of the "other account" option.
    folderPopup._teardown();
    folderPopup.setAttribute("excludeServers",
                             gServerSettings.account.incomingServer.key);
    folderPopup._ensureInitialized();

    if (gServerSettings.account.incomingServer.isDeferredTo) {
      // Some other account already defers to this account
      // therefore this one can't be deferred further.
      radioGroup.value = "currentAccount";
      folderPopup.selectFolder();
      radioGroup.disabled = true;
    }
    else if (gFirstDeferredAccount.length)
    {
      // The current account is already deferred...
      let account = MailServices.accounts.getAccount(gFirstDeferredAccount);
      radioGroup.value = "otherAccount";
      folderPopup.selectFolder(account.incomingServer.rootFolder);
    }
    else
    {
      // Current account is not deferred.
      radioGroup.value = "currentAccount";
      // If there are no other suitable accounts to defer to,
      // then disable the option.
      if (!folderPopup.selectFolder())
        document.getElementById("deferToOtherAccount").disabled = true;
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
    if (radioGroup.value != "currentAccount" && !gFirstDeferredAccount.length)
    {
      var confirmDeferAccount =
        gPrefsBundle.getString("confirmDeferAccountWarning");

      var confirmTitle = gPrefsBundle.getString("confirmDeferAccountTitle");

      if (!Services.prompt.confirm(window, confirmTitle, confirmDeferAccount))
        return false;
    }
    switch (radioGroup.value)
    {
      case "currentAccount":
        gServerSettings['deferredToAccount'] = "";
        break;
      case "otherAccount":
        let server = document.getElementById("deferredServerFolderPicker")
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
function updateInboxAccount(enablePicker)
{
  document.getElementById("deferredServerFolderPicker").disabled = !enablePicker;
  document.getElementById("deferGetNewMail").disabled = !enablePicker;
}
