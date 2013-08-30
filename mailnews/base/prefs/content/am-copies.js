/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/MailUtils.js");

var gFccRadioElemChoice, gDraftsRadioElemChoice, gArchivesRadioElemChoice, gTmplRadioElemChoice;
var gFccRadioElemChoiceLocked, gDraftsRadioElemChoiceLocked, gArchivesRadioElemChoiceLocked, gTmplRadioElemChoiceLocked;
var gDefaultPickerMode = "1";

var gFccFolderWithDelim, gDraftsFolderWithDelim, gArchivesFolderWithDelim, gTemplatesFolderWithDelim;
var gAccount;
var gCurrentServerId;

function onPreInit(account, accountValues)
{
  gAccount = account;
  var type = parent.getAccountValue(account, accountValues, "server", "type", null, false);
  hideShowControls(type);
}

/*
 * Set the global radio element choices and initialize folder/account pickers.
 * Also, initialize other UI elements (cc, bcc, fcc picker controller checkboxes).
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

    SetFolderDisplay(gArchivesRadioElemChoice, gArchivesRadioElemChoiceLocked,
                     "archive",
                     "msgArchivesAccountPicker",
                     "identity.archiveFolder",
                     "msgArchivesFolderPicker");

    SetFolderDisplay(gDraftsRadioElemChoice, gDraftsRadioElemChoiceLocked,
                     "draft",
                     "msgDraftsAccountPicker",
                     "identity.draftFolder",
                     "msgDraftsFolderPicker");

    SetFolderDisplay(gTmplRadioElemChoice, gTmplRadioElemChoiceLocked,
                     "tmpl",
                     "msgStationeryAccountPicker",
                     "identity.stationeryFolder",
                     "msgStationeryFolderPicker");

    setupCcTextbox(true);
    setupBccTextbox(true);
    setupFccItems();
    setupArchiveItems();

    SetSpecialFolderNamesWithDelims();
}

// Initialize the picker mode choices (account/folder picker) into global vars
function SetGlobalRadioElemChoices()
{
    var pickerModeElement = document.getElementById("identity.fccFolderPickerMode");
    gFccRadioElemChoice = pickerModeElement.getAttribute("value");
    gFccRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gFccRadioElemChoice) gFccRadioElemChoice = gDefaultPickerMode;

    pickerModeElement = document.getElementById("identity.archivesFolderPickerMode");
    gArchivesRadioElemChoice = pickerModeElement.getAttribute("value");
    gArchivesRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gArchivesRadioElemChoice) gArchivesRadioElemChoice = gDefaultPickerMode;

    pickerModeElement = document.getElementById("identity.draftsFolderPickerMode");
    gDraftsRadioElemChoice = pickerModeElement.getAttribute("value");
    gDraftsRadioElemChoiceLocked = pickerModeElement.getAttribute("disabled");
    if (!gDraftsRadioElemChoice) gDraftsRadioElemChoice = gDefaultPickerMode;

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
    // Get message folder from the given uri. Second argument (false) signifies
    // that there is no need to check for the existence of special folders as
    // these folders are created on demand at runtime in case of imap accounts.
    // For POP3 accounts, special folders are created at the account creation time.
    var msgFolder = MailUtils.getFolderForURI(uri, false);
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
    } catch (ex) {}
    folderPicker.setAttribute("label", prettyFolderName(folder));
    folderPicker.folder = folder;
}

/**
 * Capture any menulist changes and update the folder property.
 *
 * @param aGroup the prefix for the menulist we're handling (e.g. "drafts")
 * @param aType "Account" for the account picker or "Folder" for the folder
 *        picker
 * @param aEvent the event that we're responding to
 */
function noteSelectionChange(aGroup, aType, aEvent)
{
  var checkedElem = document.getElementById(aGroup+"_select"+aType);
  var folder = aEvent.target._folder;
  var modeValue = checkedElem.value;
  var radioGroup = checkedElem.radioGroup.getAttribute("id");
  var picker;

  switch (radioGroup) {
    case "doFcc" :
      gFccRadioElemChoice = modeValue;
      picker = document.getElementById("msgFcc"+aType+"Picker");
      break;

    case "messageArchives" :
      gArchivesRadioElemChoice = modeValue;
      picker = document.getElementById("msgArchives"+aType+"Picker");
      updateArchiveHierarchyButton(folder);
      break;

    case "messageDrafts" :
      gDraftsRadioElemChoice = modeValue;
      picker = document.getElementById("msgDrafts"+aType+"Picker");
      break;

    case "messageTemplates" :
      gTmplRadioElemChoice = modeValue;
      picker = document.getElementById("msgStationery"+aType+"Picker");
      break;
  }

  picker.folder = folder;
  picker.setAttribute("label", prettyFolderName(folder));
}

// Need to append special folders when account picker is selected.
// Create a set of global special folder vars to be suffixed to the
// server URI of the selected account.
function SetSpecialFolderNamesWithDelims()
{
    var folderDelim = "/";
    /* we use internal names known to everyone like "Sent", "Templates" and "Drafts" */

    gFccFolderWithDelim = folderDelim + "Sent";
    gArchivesFolderWithDelim = folderDelim + "Archives";
    gDraftsFolderWithDelim = folderDelim + "Drafts";
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

    SaveFolderSettings( gArchivesRadioElemChoice,
                        "messageArchives",
                        gArchivesFolderWithDelim,
                        "msgArchivesAccountPicker",
                        "msgArchivesFolderPicker",
                        "identity.archiveFolder",
                        "identity.archivesFolderPickerMode" );

    SaveFolderSettings( gDraftsRadioElemChoice,
                        "messageDrafts",
                        gDraftsFolderWithDelim,
                        "msgDraftsAccountPicker",
                        "msgDraftsFolderPicker",
                        "identity.draftFolder",
                        "identity.draftsFolderPickerMode" );

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
            uri = document.getElementById(accountPickerId).folder.URI;
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

// Disable CC textbox if CC checkbox is not checked
function setupCcTextbox(init)
{
    var ccChecked = document.getElementById("identity.doCc").checked;
    var ccTextbox = document.getElementById("identity.doCcList");

    ccTextbox.disabled = !ccChecked;

    if (ccChecked) {
        if (ccTextbox.value == "") {
            ccTextbox.value = document.getElementById("identity.email").value;
            if (!init)
                ccTextbox.select();
        }
    } else if ((ccTextbox.value == document.getElementById("identity.email").value) ||
               (init && ccTextbox.getAttribute("value") == ""))
        ccTextbox.value = "";
}

// Disable BCC textbox if BCC checkbox is not checked
function setupBccTextbox(init)
{
    var bccChecked = document.getElementById("identity.doBcc").checked;
    var bccTextbox = document.getElementById("identity.doBccList");

    bccTextbox.disabled = !bccChecked;

    if (bccChecked) {
        if (bccTextbox.value == "") {
            bccTextbox.value = document.getElementById("identity.email").value;
            if (!init)
                bccTextbox.select();
        }
    } else if ((bccTextbox.value == document.getElementById("identity.email").value) ||
               (init && bccTextbox.getAttribute("value") == ""))
        bccTextbox.value = "";
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
  SetPickerEnabling(enablePickerId, disablePickerId);

  var radioElemValue = event.target.value;

  switch (event.target.id) {
    case "fcc_selectAccount":
    case "fcc_selectFolder":
      gFccRadioElemChoice = radioElemValue;
      break;
    case "archive_selectAccount":
    case "archive_selectFolder":
      gArchivesRadioElemChoice = radioElemValue;
      updateArchiveHierarchyButton(document.getElementById(enablePickerId)
                                           .folder);
      break;
    case "draft_selectAccount":
    case "draft_selectFolder":
      gDraftsRadioElemChoice = radioElemValue;
      break;
    case "tmpl_selectAccount":
    case "tmpl_selectFolder":
      gTmplRadioElemChoice = radioElemValue;
      break;
    default:
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

/**
 * Enable/disable the archive hierarchy button depending on what folder is
 * currently selected (Gmail IMAP folders should have the button disabled, since
 * changing the archive hierarchy does nothing there.
 *
 * @param archiveFolder the currently-selected folder to store archives in
 */
function updateArchiveHierarchyButton(archiveFolder) {
  let isGmailImap = (archiveFolder.server.type == "imap" &&
                     archiveFolder.server.QueryInterface(
                       Components.interfaces.nsIImapIncomingServer)
                     .isGMailServer);
  document.getElementById("archiveHierarchyButton").disabled = isGmailImap;
}

/**
 * Enable or disable (as appropriate) the controls for setting archive options
 */
function setupArchiveItems() {
  let broadcaster = document.getElementById("broadcaster_archiveEnabled");
  let checked = document.getElementById("identity.archiveEnabled").checked;
  let archiveFolder;

  if (checked) {
    broadcaster.removeAttribute("disabled");
    switch (gArchivesRadioElemChoice) {
      case "0":
        if (!gArchivesRadioElemChoiceLocked)
          SetPickerEnabling("msgArchivesAccountPicker", "msgArchivesFolderPicker");
        SetRadioButtons("archive_selectAccount", "archive_selectFolder");
        updateArchiveHierarchyButton(document.getElementById(
                                     "msgArchivesAccountPicker").folder);
        break;

      case "1":
        if (!gArchivesRadioElemChoiceLocked)
          SetPickerEnabling("msgArchivesFolderPicker", "msgArchivesAccountPicker");
        SetRadioButtons("archive_selectFolder", "archive_selectAccount");
        updateArchiveHierarchyButton(document.getElementById(
                                     "msgArchivesFolderPicker").folder);
        break;

      default:
        dump("Error in setting Archive elements.\n");
        return;
    }
  }
  else
    broadcaster.setAttribute("disabled", "true");
}

/**
 * Open a dialog to edit the folder hierarchy used when archiving messages.
 */
function ChangeArchiveHierarchy() {
  let identity = parent.gIdentity || parent.getCurrentAccount().defaultIdentity;

  top.window.openDialog("chrome://messenger/content/am-archiveoptions.xul",
                        "", "centerscreen,chrome,modal,titlebar,resizable=yes",
                        identity);
  return true;
}
