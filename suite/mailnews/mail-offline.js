/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gMailOfflinePrefs = null;
var gOfflinePromptsBundle;
var gOfflineManager;

function MailOfflineStateChanged(goingOffline)
{
  // tweak any mail UI here that needs to change when we go offline or come back online
  gFolderJustSwitched = true;
}

function MsgSettingsOffline()
{
    window.parent.MsgAccountManager('am-offline.xul');
}

// Init PrefsService
function GetMailOfflinePrefs()
{
  // Store the prefs object
  try {
    var prefsService = Components.classes["@mozilla.org/preferences-service;1"];
    if (prefsService)
    prefsService = prefsService.getService();
    if (prefsService)
    gMailOfflinePrefs = prefsService.QueryInterface(Components.interfaces.nsIPrefBranch);

    if (!gMailOfflinePrefs)
    dump("failed to get prefs service!\n");
  }
  catch(ex) {
    dump("failed to get prefs service!\n");
  }
}

// Check for unsent messages
function CheckForUnsentMessages()
{
  return Components.classes["@mozilla.org/messengercompose/sendlater;1"]
                   .getService(Components.interfaces.nsIMsgSendLater)
                   .hasUnsentMessages();
}

// Init strings.
function InitPrompts()
{
  if (!gOfflinePromptsBundle) 
    gOfflinePromptsBundle = document.getElementById("bundle_offlinePrompts");
}

// prompt for sending messages while going online, and go online.
function PromptSendMessages()
{
  InitPrompts();
  InitServices();

  var checkValue = {value:true};
  var buttonPressed = Services.prompt.confirmEx(
      window,
      gOfflinePromptsBundle.getString('sendMessagesWindowTitle'), 
      gOfflinePromptsBundle.getString('sendMessagesLabel2'),
      Services.prompt.BUTTON_TITLE_IS_STRING * (Services.prompt.BUTTON_POS_0 + 
      Services.prompt.BUTTON_POS_1 + Services.prompt.BUTTON_POS_2),
      gOfflinePromptsBundle.getString('sendMessagesSendButtonLabel'),
      gOfflinePromptsBundle.getString('sendMessagesCancelButtonLabel'),
      gOfflinePromptsBundle.getString('sendMessagesNoSendButtonLabel'),
      gOfflinePromptsBundle.getString('sendMessagesCheckboxLabel'), 
      checkValue);
  switch (buttonPressed) {
    case 0:
      gMailOfflinePrefs.setIntPref("offline.send.unsent_messages", !checkValue.value);
      gOfflineManager.goOnline(true, true, msgWindow);
      return true;

    case 2:
      gMailOfflinePrefs.setIntPref("offline.send.unsent_messages", 2*!checkValue.value);
      gOfflineManager.goOnline(false, true, msgWindow);
      return true;
  }
  return false;
}

// prompt for downlading messages while going offline, and synchronise
function PromptDownloadMessages()
{
  InitPrompts();
  InitServices();

  var checkValue = {value:true};
  var buttonPressed = Services.prompt.confirmEx(
    window, 
    gOfflinePromptsBundle.getString('downloadMessagesWindowTitle'), 
    gOfflinePromptsBundle.getString('downloadMessagesLabel'),
    Services.prompt.BUTTON_TITLE_IS_STRING * (Services.prompt.BUTTON_POS_0 + 
    Services.prompt.BUTTON_POS_1 + Services.prompt.BUTTON_POS_2),
    gOfflinePromptsBundle.getString('downloadMessagesDownloadButtonLabel'),
    gOfflinePromptsBundle.getString('downloadMessagesCancelButtonLabel'),
    gOfflinePromptsBundle.getString('downloadMessagesNoDownloadButtonLabel'), 
    gOfflinePromptsBundle.getString('downloadMessagesCheckboxLabel'), 
    checkValue);
  switch (buttonPressed) {
    case 0:
      gMailOfflinePrefs.setIntPref("offline.download.download_messages", !checkValue.value);
      gOfflineManager.synchronizeForOffline(true, true, false, true, msgWindow);
      return true;

    case 2:
      gMailOfflinePrefs.setIntPref("offline.download.download_messages", 2*!checkValue.value);
      gOfflineManager.synchronizeForOffline(false, false, false, true, msgWindow);
      return true;
  }
  return false;
}

// Init Pref Service & Offline Manager
function InitServices()
{
  if (!gMailOfflinePrefs) 
    GetMailOfflinePrefs();

  if (!gOfflineManager) 
    GetOfflineMgrService();
}

// Init Offline Manager
function GetOfflineMgrService()
{
  if (!gOfflineManager) {
    gOfflineManager = Components.classes["@mozilla.org/messenger/offline-manager;1"]                 
        .getService(Components.interfaces.nsIMsgOfflineManager);
  }
}

// This function must always return false to prevent toggling of offline state because
// we change the offline state ourselves
function MailCheckBeforeOfflineChange()
{
  InitServices();

  var prefSendUnsentMessages = gMailOfflinePrefs.getIntPref("offline.send.unsent_messages");
  var prefDownloadMessages   = gMailOfflinePrefs.getIntPref("offline.download.download_messages");

  if (Services.io.offline) {
    switch(prefSendUnsentMessages) { 
    case 0:
      if(CheckForUnsentMessages()) { 
        if(! PromptSendMessages()) 
          return false;
      }
      else 
        gOfflineManager.goOnline(false /* sendUnsentMessages */, 
                                 true /* playbackOfflineImapOperations */, 
                                 msgWindow);
      break;
    case 1:
      gOfflineManager.goOnline(CheckForUnsentMessages() /* sendUnsentMessages */, 
                               true  /* playbackOfflineImapOperations */, 
                               msgWindow);
      break;
    case 2:
      gOfflineManager.goOnline(false /* sendUnsentMessages */, 
                               true /* playbackOfflineImapOperations */, 
                               msgWindow);
      break;
    }
  }
  else {
    // going offline
    switch(prefDownloadMessages) {	
      case 0:
        if(! PromptDownloadMessages()) return false;
      break;
      case 1:
        // download news, download mail, send unsent messages, go offline when done, msg window
        gOfflineManager.synchronizeForOffline(true, true, false, true, msgWindow);
        break;
      case 2:
        // download news, download mail, send unsent messages, go offline when done, msg window
        gOfflineManager.synchronizeForOffline(false, false, false, true, msgWindow);
        break;
    }
  }
  return false;
}

