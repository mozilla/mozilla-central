/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gFccRadioElemChoice, gDraftsRadioElemChoice, gArchivesRadioElemChoice, gTmplRadioElemChoice;
var gFccRadioElemChoiceLocked, gDraftsRadioElemChoiceLocked, gArchivesRadioElemChoiceLocked, gTmplRadioElemChoiceLocked;
var gDefaultPickerMode = "1";

var gFccFolderWithDelim, gDraftsFolderWithDelim, gArchivesFolderWithDelim, gTemplatesFolderWithDelim;
var gCurrentServerId;
var gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

function onPreInit(account, accountValues)
{
  var type = parent.getAccountValue(account, accountValues, "server", "type", null, false);
  hideShowControls(type);
}

/* 
 * Set the global radio element choices and initialize folder/account pickers. 
 * Also, initialize other UI elements (bcc self, fcc picker controller checkboxes). 
 */
function onInit(aPageId, aServerId) 
{
  gCurrentServerId = aServerId;
    onInitCopiesAndFolders();
}

function onInitCopiesAndFolders()
{
    SetGlobalRadioElemChoices();
                     
    SetFolderDisplay(gFccRadioElemChoice, gFccRadioElemChoiceLocked, 
                     "fcc", 
                     "msgFccAccountPicker", 
                     "identity.fccFolder", 
                     "msgFccFolderPicker");

    SetFolderDisplay(gDraftsRadioElemChoice, gDraftsRadioElemChoiceLocked, 
                     "draft",
                     "msgDraftsAccountPicker",
                     "identity.draftFolder",
                     "msgDraftsFolderPicker");

    SetFolderDisplay(gArchivesRadioElemChoice, gArchivesRadioElemChoiceLocked,
                     "archive",
                     "msgArchivesAccountPicker",
                     "identity.archiveFolder",
                     "msgArchivesFolderPicker");

    SetFolderDisplay(gTmplRadioElemChoice, gTmplRadioElemChoiceLocked,
                     "tmpl",
                     "msgStationeryAccountPicker",
                     "identity.stationeryFolder",
                     "msgStationeryFolderPicker");
    
    setupBccTextbox();
    setupFccItems();

    SetSpecialFolderNamesWithDelims();
}

// Initialize the picker mode choices (account/folder picker) into global vars
function SetGlobalRadioElemChoices()
{
    var pickerModeElement = document.getElementById("identity.fccFolderPickerMode");
    gFccRadioElemChoice = pickerModeElement.getAttribute("value");
    gFccRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gFccRadioElemChoice) gFccRadioElemChoice = gDefaultPickerMode;

    pickerModeElement = document.getElementById("identity.draftsFolderPickerMode");
    gDraftsRadioElemChoice = pickerModeElement.getAttribute("value");
    gDraftsRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gDraftsRadioElemChoice) gDraftsRadioElemChoice = gDefaultPickerMode;

    pickerModeElement = document.getElementById("identity.archivesFolderPickerMode");
    gArchivesRadioElemChoice = pickerModeElement.getAttribute("value");
    gArchivesRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gArchivesRadioElemChoice) gArchivesRadioElemChoice = gDefaultPickerMode;
    
    pickerModeElement = document.getElementById("identity.tmplFolderPickerMode");
    gTmplRadioElemChoice = pickerModeElement.getAttribute("value");
    gTmplRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gTmplRadioElemChoice) gTmplRadioElemChoice = gDefaultPickerMode;
}

/* 
 * Set Account and Folder elements based on the values read from 
 * preferences file. Default picker mode, if none specified at this stage, is
 * set to 1 i.e., Other picker displaying the folder value read from the 
 * preferences file.
 */
function SetFolderDisplay(pickerMode, disableMode,
                          radioElemPrefix, 
                          accountPickerId, 
                          folderPickedField, 
                          folderPickerId)
{
    if (!pickerMode)
        pickerMode = gDefaultPickerMode;

    var selectAccountRadioId = radioElemPrefix + "_selectAccount";
    var selectAccountRadioElem = document.getElementById(selectAccountRadioId);
    var selectFolderRadioId = radioElemPrefix + "_selectFolder";
    var selectFolderRadioElem = document.getElementById(selectFolderRadioId);
    var accountPicker = document.getElementById(accountPickerId);
    var folderPicker = document.getElementById(folderPickerId);
    var rg = selectAccountRadioElem.radioGroup;
    var folderPickedElement = document.getElementById(folderPickedField);
    var uri = folderPickedElement.getAttribute("value");
    // Get message folder from the given uri. Second argument (false) siginifies
    // that there is no need to check for the existence of special folders as 
    // these folders are created on demand at runtime in case of imap accounts.
    // For POP3 accounts, special folders are created at the account creation time.
    var msgFolder = GetMsgFolderFromUri(uri, false);
    InitFolderDisplay(msgFolder.server.rootFolder, accountPicker);
    InitFolderDisplay(msgFolder, folderPicker);

    switch (pickerMode) 
    {
        case "0" :
            rg.selectedItem = selectAccountRadioElem;
            SetPickerEnabling(accountPickerId, folderPickerId);
            break;

        case "1"  :
            rg.selectedItem = selectFolderRadioElem;
            SetPickerEnabling(folderPickerId, accountPickerId);
            break;

        default :
            dump("Error in setting initial folder display on pickers\n");
            break;
    }

    // Check to see if we need to lock page elements. Disable radio buttons
    // and account/folder pickers when locked.
    if (disableMode) {
      selectAccountRadioElem.setAttribute("disabled","true");
      selectFolderRadioElem.setAttribute("disabled","true");
      accountPicker.setAttribute("disabled","true");
      folderPicker.setAttribute("disabled","true");
    }
}

// Initialize the folder display based on prefs values
function InitFolderDisplay(folder, folderPicker) {
    try {
      folderPicker.firstChild.selectFolder(folder);
    } catch(ex) {
      folderPicker.setAttribute("label", folder.prettyName);
    }
    folderPicker.folder = folder;
}

// Capture any menulist changes
function noteSelectionChange(radioItemId, aEvent)
{
    var checkedElem = document.getElementById(radioItemId);
    var folder = aEvent.target._folder;
    var modeValue  = checkedElem.value;
    var radioGroup = checkedElem.radioGroup.getAttribute("id");
    var picker;
    switch (radioGroup)
    {
        case "doFcc" :
            gFccRadioElemChoice = modeValue;
            picker = document.getElementById("msgFccFolderPicker");
            break;
    
        case "messageDrafts" :
            gDraftsRadioElemChoice = modeValue;
            picker = document.getElementById("msgDraftsFolderPicker");
            break;

        case "messageArchives" :
            gArchivesRadioElemChoice = modeValue;
            picker = document.getElementById("msgArchivesFolderPicker");
            break;

        case "messageTemplates" :
            gTmplRadioElemChoice = modeValue;
            picker = document.getElementById("msgStationeryFolderPicker");
            break;
    }
    picker.folder = folder;
    picker.setAttribute("label", folder.prettyName);
}

// Need to append special folders when account picker is selected.
// Create a set of global special folder vars to be suffixed to the
// server URI of the selected account.
function SetSpecialFolderNamesWithDelims()
{
    var folderDelim = "/";
    /* we use internal names known to everyone like "Sent", "Templates" and "Drafts" */

    gFccFolderWithDelim = folderDelim + "Sent";
    gDraftsFolderWithDelim = folderDelim + "Drafts";
    gArchivesFolderWithDelim = folderDelim + "Archives";
    gTemplatesFolderWithDelim = folderDelim + "Templates";
}

// Save all changes on this page
function onSave()
{
    onSaveCopiesAndFolders();
}

function onSaveCopiesAndFolders()
{
    SaveFolderSettings( gFccRadioElemChoice, 
                        "doFcc",
                        gFccFolderWithDelim, 
                        "msgFccAccountPicker", 
                        "msgFccFolderPicker",
                        "identity.fccFolder",
                        "identity.fccFolderPickerMode" );

    SaveFolderSettings( gDraftsRadioElemChoice, 
                        "messageDrafts",
                        gDraftsFolderWithDelim, 
                        "msgDraftsAccountPicker", 
                        "msgDraftsFolderPicker",
                        "identity.draftFolder",
                        "identity.draftsFolderPickerMode" );

    SaveFolderSettings(gArchivesRadioElemChoice,
                        "messageArchives",
                        gArchivesFolderWithDelim,
                        "msgArchivesAccountPicker",
                        "msgArchivesFolderPicker",
                        "identity.archiveFolder",
                        "identity.archivesFolderPickerMode");
                        
    SaveFolderSettings( gTmplRadioElemChoice,
                        "messageTemplates",
                        gTemplatesFolderWithDelim, 
                        "msgStationeryAccountPicker", 
                        "msgStationeryFolderPicker",
                        "identity.stationeryFolder",
                        "identity.tmplFolderPickerMode" );
}

// Save folder settings and radio element choices
function SaveFolderSettings(radioElemChoice, 
                            radioGroupId,
                            folderSuffix,
                            accountPickerId,
                            folderPickerId,
                            folderElementId,
                            folderPickerModeId)
{
    var formElement = document.getElementById(folderElementId);
    var uri;

    switch (radioElemChoice) 
    {
        case "0" :
            uri = document.getElementById(accountPickerId).selectedItem._folder.URI;
            if (uri) {
                // Create  Folder URI
                uri = uri + folderSuffix;
            }
            break;

        case "1" : 
            uri = document.getElementById(folderPickerId).folder.URI;
            break;

        default :
            dump ("Error saving folder preferences.\n");
            return;
    }
    formElement.setAttribute("value", uri);

    formElement = document.getElementById(folderPickerModeId);
    formElement.setAttribute("value", radioElemChoice);
}

// Check the Fcc Self item and setup associated picker state 
function setupFccItems()
{ 
    var broadcaster = document.getElementById("broadcaster_doFcc");

    var checked = document.getElementById("identity.doFcc").checked;
    if (checked) {
        broadcaster.removeAttribute("disabled");
        switch (gFccRadioElemChoice) {
            case "0" :
                if (!gFccRadioElemChoiceLocked)
                    SetPickerEnabling("msgFccAccountPicker", "msgFccFolderPicker");
                SetRadioButtons("fcc_selectAccount", "fcc_selectFolder");
                break;

            case "1" :
                if (!gFccRadioElemChoiceLocked)
                    SetPickerEnabling("msgFccFolderPicker", "msgFccAccountPicker");
                SetRadioButtons("fcc_selectFolder", "fcc_selectAccount");
                break;

            default :
                dump("Error in setting Fcc elements.\n");
                break;
        }
    }
    else
        broadcaster.setAttribute("disabled", "true");
}

// Disable BCC textbox if BCC checkbox is not checked
function setupBccTextbox()
{
    var bccChecked = document.getElementById("identity.doBcc").checked;
    var bccTextbox = document.getElementById("identity.doBccList");

    bccTextbox.disabled = !bccChecked;
}

// Enable and disable pickers based on the radio element clicked
function SetPickerEnabling(enablePickerId, disablePickerId)
{
    var activePicker = document.getElementById(enablePickerId);
    activePicker.removeAttribute("disabled");

    var inactivePicker = document.getElementById(disablePickerId);
    inactivePicker.setAttribute("disabled", "true");
}

// Set radio element choices and picker states
function setPickersState(enablePickerId, disablePickerId, event)
{
    const Ci = Components.interfaces;
    SetPickerEnabling(enablePickerId, disablePickerId);

    var selectedElementUri;
    var radioElemValue = event.target.value;

    var account = parent.getCurrentAccount();
    if (!account) return;

    var server = account.incomingServer;
    var serverId = server.key;

    // if special folders are not to be made on the server, 
    // then Local Folders is the home for it's special folders
    if (!server.defaultCopiesAndFoldersPrefsToServer) {
        var am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
        selectedElementUri = am.localFoldersServer.serverURI;
    }        
    else
        selectedElementUri = serverId;
    
    switch (event.target.id) {
        case "fcc_selectAccount" :
            gFccRadioElemChoice = radioElemValue;   
            break;
        case "draft_selectAccount" :
            gDraftsRadioElemChoice = radioElemValue;   
            break;
        case "archive_selectAccount" :
            gArchivesRadioElemChoice = radioElemValue;
            break;
        case "tmpl_selectAccount" :
            gTmplRadioElemChoice = radioElemValue;   
            break;
        case "fcc_selectFolder" :
            gFccRadioElemChoice = radioElemValue;   
            selectedElementUri += gFccFolderWithDelim;
            break;
        case "draft_selectFolder" :
            gDraftsRadioElemChoice = radioElemValue;   
            selectedElementUri += gDraftsFolderWithDelim;
            break;
        case "archive_selectFolder" :
            gArchivesRadioElemChoice = radioElemValue;
            selectedElementUri += gArchivesFolderWithDelim;
            break;
        case "tmpl_selectFolder" :
            gTmplRadioElemChoice = radioElemValue;   
            selectedElementUri += gTemplatesFolderWithDelim;
            break;
        default :
            dump("Error in setting picker state.\n");
            return;
    }
}

// This routine is to restore the correct radio element 
// state when the fcc self checkbox broadcasts the change
function SetRadioButtons(selectPickerId, unselectPickerId)
{
    var activeRadioElem = document.getElementById(selectPickerId);
    activeRadioElem.radioGroup.selectedItem = activeRadioElem;
}
