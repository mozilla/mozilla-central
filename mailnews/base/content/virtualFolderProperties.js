/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
 * The Original Code is the virtual folder properties dialog
 *
 * The Initial Developer of the Original Code is
 * David Bienvenu.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  David Bienvenu <bienvenu@nventure.com>
 *  Scott MacGregor <mscott@mozilla.org>
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

var gPickedFolder;
var gMailView = null;
var msgWindow; // important, don't change the name of this variable. it's really a global used by commandglue.js
var gSearchTermSession; // really an in memory temporary filter we use to read in and write out the search terms
var gSearchFolderURIs = "";

var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;

Components.utils.import("resource://app/modules/virtualFolderWrapper.js");
Components.utils.import("resource://app/modules/iteratorUtils.jsm");

function onLoad()
{
  var arguments = window.arguments[0];

  document.getElementById("name").focus();

  // call this when OK is pressed
  msgWindow = arguments.msgWindow;

  initializeSearchWidgets();
  setSearchScope(nsMsgSearchScope.offlineMail);

  if (arguments.editExistingFolder)
    InitDialogWithVirtualFolder(arguments.folder);
  else // we are creating a new virtual folder
  {
    // it is possible that we were given arguments to pre-fill the dialog with...
    gSearchTermSession = Components.classes["@mozilla.org/messenger/searchSession;1"]
                                   .createInstance(Components.interfaces.nsIMsgSearchSession);

    if (arguments.searchTerms) // then add them to our search session
    {
      for each (let searchTerm in fixIterator(arguments.searchTerms,
                                              Components.interfaces.nsIMsgSearchTerm))
        gSearchTermSession.appendTerm(searchTerm);
    }
    if (arguments.folder)
    {
      // pre select the folderPicker, based on what they selected in the folder pane
      gPickedFolder = arguments.folder;
      try {
        document.getElementById("msgNewFolderPopup").selectFolder(arguments.folder);
      } catch(ex) {
        document.getElementById("msgNewFolderPicker")
                .setAttribute("label", arguments.folder.prettyName);
      }

      // if the passed in URI is not a server then pre-select it as the folder to search
      if (!arguments.folder.isServer)
        gSearchFolderURIs = arguments.folder.URI;
    }
    if (arguments.newFolderName)
      document.getElementById("name").value = arguments.newFolderName;
    if (arguments.searchFolderURIs)
      gSearchFolderURIs = arguments.searchFolderURIs;

    setupSearchRows(gSearchTermSession.searchTerms);
    doEnabling(); // we only need to disable/enable the OK button for new virtual folders
  }

  updateOnlineSearchState();
  doSetOKCancel(onOK, onCancel);
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
    var realFolder = GetMsgFolderFromUri(srchFolderUriArray[0]);
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
    var promptService =
      Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(Components.interfaces.nsIPromptService);
    promptService.alert(window, null,
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

    var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
    accountManager.saveVirtualFolders();

    if (window.arguments[0].onOKCallback)
      window.arguments[0].onOKCallback(virtualFolderWrapper.virtualFolder.URI);
    return true;
  }
  var uri = gPickedFolder.URI;
  if (name && uri) // create a new virtual folder
  {
    // check to see if we already have a folder with the same name and alert the user if so...
    var parentFolder = GetMsgFolderFromUri(uri);
    
    // sanity check the name based on the logic used by nsMsgBaseUtils.cpp. It can't start with a '.', it can't end with a '.', '~' or ' '.
    // it can't contain a ';' or '#'.
    if (/^\.|[\.\~ ]$|[\;\#]/.test(name))
    {
      var promptService =
        Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, null,
                          messengerBundle.getString('folderCreationFailed'));
      return false;
    }
    else if (parentFolder.containsChildNamed(name))
    {
      var promptService =
        Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, null,
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

function onCancel()
{
  // close the window
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
