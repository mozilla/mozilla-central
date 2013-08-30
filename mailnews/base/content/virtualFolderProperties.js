/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gPickedFolder;
var gMailView = null;
var msgWindow; // important, don't change the name of this variable. it's really a global used by commandglue.js
var gSearchTermSession; // really an in memory temporary filter we use to read in and write out the search terms
var gSearchFolderURIs = "";

var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/virtualFolderWrapper.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/MailUtils.js");

function onLoad()
{
  var windowArgs = window.arguments[0];
  var acceptButton = document.documentElement.getButton("accept");

  document.getElementById("name").focus();

  // call this when OK is pressed
  msgWindow = windowArgs.msgWindow;

  initializeSearchWidgets();

  setSearchScope(nsMsgSearchScope.offlineMail);
  if (windowArgs.editExistingFolder)
  {
    acceptButton.label = 
        document.documentElement.getAttribute("editFolderAcceptButtonLabel");
    acceptButton.accesskey = 
        document.documentElement.getAttribute("editFolderAcceptButtonAccessKey");
    InitDialogWithVirtualFolder(windowArgs.folder);
  }
  else // we are creating a new virtual folder
  {
    acceptButton.label = 
        document.documentElement.getAttribute("newFolderAcceptButtonLabel");
    acceptButton.accesskey = 
        document.documentElement.getAttribute("newFolderAcceptButtonAccessKey");
    // it is possible that we were given arguments to pre-fill the dialog with...
    gSearchTermSession = Components.classes["@mozilla.org/messenger/searchSession;1"]
                                   .createInstance(Components.interfaces.nsIMsgSearchSession);

    if (windowArgs.searchTerms) // then add them to our search session
    {
      for each (let searchTerm in fixIterator(windowArgs.searchTerms,
                                              Components.interfaces.nsIMsgSearchTerm))
        gSearchTermSession.appendTerm(searchTerm);
    }
    if (windowArgs.folder)
    {
      // pre select the folderPicker, based on what they selected in the folder pane
      gPickedFolder = windowArgs.folder;
      try {
        document.getElementById("msgNewFolderPopup").selectFolder(windowArgs.folder);
      } catch(ex) {
        document.getElementById("msgNewFolderPicker")
                .setAttribute("label", windowArgs.folder.prettyName);
      }

      // if the passed in URI is not a server then pre-select it as the folder to search
      if (!windowArgs.folder.isServer)
        gSearchFolderURIs = windowArgs.folder.URI;
    }
    if (windowArgs.newFolderName)
      document.getElementById("name").value = windowArgs.newFolderName;
    if (windowArgs.searchFolderURIs)
      gSearchFolderURIs = windowArgs.searchFolderURIs;

    setupSearchRows(gSearchTermSession.searchTerms);
    doEnabling(); // we only need to disable/enable the OK button for new virtual folders
  }

  if (typeof windowArgs.searchOnline != "undefined")
    document.getElementById('searchOnline').checked = windowArgs.searchOnline;
  updateOnlineSearchState();
}

function setupSearchRows(aSearchTerms)
{
  if (aSearchTerms && aSearchTerms.Count() > 0)
    initializeSearchRows(nsMsgSearchScope.offlineMail, aSearchTerms); // load the search terms for the folder
  else
    onMore(null);
}

function updateOnlineSearchState()
{
  var enableCheckbox = false;
  var checkbox = document.getElementById('searchOnline');
  // only enable the checkbox for selection, for online servers
  var srchFolderUriArray = gSearchFolderURIs.split('|');
  if (srchFolderUriArray[0])
  {
    var realFolder = MailUtils.getFolderForURI(srchFolderUriArray[0]);
    enableCheckbox =  realFolder.server.offlineSupportLevel; // anything greater than 0 is an online server like IMAP or news
  }

  if (enableCheckbox)
    checkbox.removeAttribute('disabled');
  else
  {
    checkbox.setAttribute('disabled', true);
    checkbox.checked = false;
  }
}

function InitDialogWithVirtualFolder(aVirtualFolder)
{
  let virtualFolderWrapper =
    VirtualFolderHelper.wrapVirtualFolder(window.arguments[0].folder);

  // when editing an existing folder, hide the folder picker that stores the parent location of the folder
  document.getElementById("chooseFolderLocationRow").collapsed = true;
  var folderNameField = document.getElementById("name");
  folderNameField.disabled = true;

  gSearchFolderURIs = virtualFolderWrapper.searchFolderURIs;
  document.getElementById('searchOnline').checked = virtualFolderWrapper.onlineSearch;
  gSearchTermSession = virtualFolderWrapper.searchTermsSession;

  setupSearchRows(gSearchTermSession.searchTerms);

  // set the name of the folder
  folderNameField.value = aVirtualFolder.prettyName;

  // update the window title based on the name of the saved search
  var messengerBundle = document.getElementById("bundle_messenger");
  document.title = messengerBundle.getFormattedString('editVirtualFolderPropertiesTitle',
                                                      [aVirtualFolder.prettyName]);
}

function onFolderPick(aEvent) {
  gPickedFolder = aEvent.target._folder;
  document.getElementById("msgNewFolderPicker")
          .setAttribute("label", gPickedFolder.prettyName);
}

function onOK()
{
  var name = document.getElementById("name").value;
  var messengerBundle = document.getElementById("bundle_messenger");
  var searchOnline = document.getElementById('searchOnline').checked;

  if (!gSearchFolderURIs)
  {
    Services.prompt.alert(window, null,
                          messengerBundle.getString('alertNoSearchFoldersSelected'));
    return false;
  }

  if (window.arguments[0].editExistingFolder)
  {
    // update the search terms
    saveSearchTerms(gSearchTermSession.searchTerms, gSearchTermSession);
    // save the settings
    let virtualFolderWrapper =
      VirtualFolderHelper.wrapVirtualFolder(window.arguments[0].folder);
    virtualFolderWrapper.searchTerms = gSearchTermSession.searchTerms;
    virtualFolderWrapper.searchFolders = gSearchFolderURIs;
    virtualFolderWrapper.onlineSearch = searchOnline;
    virtualFolderWrapper.cleanUpMessageDatabase();

    MailServices.accounts.saveVirtualFolders();

    if (window.arguments[0].onOKCallback)
      window.arguments[0].onOKCallback(virtualFolderWrapper.virtualFolder.URI);
    return true;
  }
  var uri = gPickedFolder.URI;
  if (name && uri) // create a new virtual folder
  {
    // check to see if we already have a folder with the same name and alert the user if so...
    var parentFolder = MailUtils.getFolderForURI(uri);

    // sanity check the name based on the logic used by nsMsgBaseUtils.cpp. It can't start with a '.', it can't end with a '.', '~' or ' '.
    // it can't contain a ';' or '#'.
    if (/^\.|[\.\~ ]$|[\;\#]/.test(name))
    {
      Services.prompt.alert(window, null,
                            messengerBundle.getString('folderCreationFailed'));
      return false;
    }
    else if (parentFolder.containsChildNamed(name))
    {
      Services.prompt.alert(window, null,
                            messengerBundle.getString('folderExists'));
      return false;
    }

    saveSearchTerms(gSearchTermSession.searchTerms, gSearchTermSession);
    VirtualFolderHelper.createNewVirtualFolder(name, parentFolder, gSearchFolderURIs,
                                               gSearchTermSession.searchTerms,
                                               searchOnline);
  }

  return true;
}

function doEnabling()
{
  var acceptButton = document.documentElement.getButton("accept");
  acceptButton.disabled = !document.getElementById("name").value;
}

function chooseFoldersToSearch()
{
  // if we have some search folders already, then root the folder picker dialog off the account
  // for those folders. Otherwise fall back to the preselectedfolderURI which is the parent folder
  // for this new virtual folder.
  var srchFolderUriArray = gSearchFolderURIs.split('|');
  var dialog = window.openDialog("chrome://messenger/content/virtualFolderListDialog.xul", "",
                                 "chrome,titlebar,modal,centerscreen,resizable",
                                 {searchFolderURIs:gSearchFolderURIs,
                                  okCallback:onFolderListDialogCallback});
}

// callback routine from chooseFoldersToSearch
function onFolderListDialogCallback(searchFolderURIs)
{
  gSearchFolderURIs = searchFolderURIs;
  updateOnlineSearchState(); // we may have changed the server type we are searching...
}

function onEnterInSearchTerm()
{
  // stub function called by the core search widget code...
  // nothing for us to do here
}
