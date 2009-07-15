/* ***** BEGIN LICENSE BLOCK *****
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
 *   Håkan Waara <hwaara@chello.se>
 *   Andrew Sutherland <asutherland@asutherland.org>
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

var gCurrentFolder;

var gFolderDisplay;
// Although we don't display messages, we have a message display object to
//  simplify our code.  It's just always disabled.
var gMessageDisplay;

var nsIMsgWindow = Components.interfaces.nsIMsgWindow;

var gFolderPicker;
var gStatusFeedback;
var gTimelineEnabled = false;
var gMessengerBundle = null;
var RDF;
var gSearchBundle;

// Datasource search listener -- made global as it has to be registered
// and unregistered in different functions.
var gDataSourceSearchListener;
var gViewSearchListener;

var gSearchStopButton;

// Controller object for search results thread pane
var nsSearchResultsController =
{
    supportsCommand: function(command)
    {
        switch(command) {
        case "cmd_delete":
        case "cmd_shiftDelete":
        case "button_delete":
        case "cmd_open":
        case "file_message_button":
        case "goto_folder_button":
        case "saveas_vf_button":
        case "cmd_selectAll":
            return true;
        default:
            return false;
        }
    },

    // this controller only handles commands
    // that rely on items being selected in
    // the search results pane.
    isCommandEnabled: function(command)
    {
        var enabled = true;

        switch (command) {
          case "goto_folder_button":
            if (GetNumSelectedMessages() != 1)
              enabled = false;
            break;
          case "cmd_delete":
          case "cmd_shiftDelete":
          case "button_delete":
            // this assumes that advanced searches don't cross accounts
            if (GetNumSelectedMessages() <= 0 ||
                isNewsURI(gFolderDisplay.view.dbView.getURIForViewIndex(0)))
              enabled = false;
            break;
          case "saveas_vf_button":
              // need someway to see if there are any search criteria...
              return true;
          case "cmd_selectAll":
            return true;
          default:
            if (GetNumSelectedMessages() <= 0)
              enabled = false;
            break;
        }

        return enabled;
    },

    doCommand: function(command)
    {
        switch(command) {
        case "cmd_open":
            MsgOpenSelectedMessages();
            return true;

        case "cmd_delete":
        case "button_delete":
            MsgDeleteSelectedMessages(nsMsgViewCommandType.deleteMsg);
            return true;
        case "cmd_shiftDelete":
            MsgDeleteSelectedMessages(nsMsgViewCommandType.deleteNoTrash);
            return true;

        case "goto_folder_button":
            GoToFolder();
            return true;

        case "saveas_vf_button":
            saveAsVirtualFolder();
            return true;

        case "cmd_selectAll":
            // move the focus to the search results pane
            GetThreadTree().focus();
            gFolderDisplay.doCommand(nsMsgViewCommandType.selectAll);
            return true;

        default:
            return false;
        }

    },

    onEvent: function(event)
    {
    }
}

function UpdateMailSearch(caller)
{
  document.commandDispatcher.updateCommands('mail-search');
}
/**
 * FolderDisplayWidget currently calls this function when the command updater
 *  notification for updateCommandStatus is called.  We don't have a toolbar,
 *  but our 'mail-search' command set serves the same purpose.
 */
var UpdateMailToolbar = UpdateMailSearch;

/**
 * No-op clear message pane function for FolderDisplayWidget.
 */
function ClearMessagePane() {
}

function SetAdvancedSearchStatusText(aNumHits)
{
}

/**
 * Subclass the FolderDisplayWidget to deal with UI specific to the search
 *  window.
 */
function SearchFolderDisplayWidget(aMessageDisplay) {
  FolderDisplayWidget.call(this, /* no tab info */ null, aMessageDisplay);
}

SearchFolderDisplayWidget.prototype = {
  __proto__: FolderDisplayWidget.prototype,

  /// folder display will want to show the thread pane; we need do nothing
  _showThreadPane: function () {},

  onSearching: function SearchFolderDisplayWidget_onSearch(aIsSearching) {
    if (aIsSearching) {
      // Search button becomes the "stop" button
      gSearchStopButton.setAttribute(
        "label", gSearchBundle.getString("labelForStopButton"));
      gSearchStopButton.setAttribute(
        "accesskey", gSearchBundle.getString("labelForStopButton.accesskey"));

      // update our toolbar equivalent
      UpdateMailSearch("new-search");
      // spin the meteors
      gStatusFeedback._startMeteors();
      // tell the user that we're searching
      gStatusFeedback.showStatusString(
        gSearchBundle.getString("searchingMessage"));
    }
    else {
      // Stop button resumes being the "search" button
      gSearchStopButton.setAttribute(
        "label", gSearchBundle.getString("labelForSearchButton"));
      gSearchStopButton.setAttribute(
        "accesskey", gSearchBundle.getString("labelForSearchButton.accesskey"));

      // update our toolbar equivalent
      UpdateMailSearch("done-search");
      // stop spining the meteors
      gStatusFeedback._stopMeteors();
      // set the result test
      this.updateStatusResultText();
    }
  },

  /**
   * If messages were removed, we might have lost some search results and so
   *  should update our search result text.  Also, defer to our super-class.
   */
  onMessagesRemoved: function SearchFolderDisplayWidget_onMessagesRemoved() {
    // result text is only for when we are not searching
    if (!this.view.searching)
      this.updateStatusResultText();
    this.__proto__.__proto__.onMessagesRemoved.call(this);
  },

  updateStatusResultText: function() {
    let statusMsg, rowCount = this.view.dbView.rowCount;
    // if there are no hits, it means no matches were found in the search.
    if (rowCount == 0)
      statusMsg = gSearchBundle.getString("searchFailureMessage");
    else if (rowCount == 1)
      statusMsg = gSearchBundle.getString("searchSuccessMessage");
    else
      statusMsg = gSearchBundle.getFormattedString("searchSuccessMessages",
                                                   [rowCount]);

    gStatusFeedback.showStatusString(statusMsg);
  },
};


function searchOnLoad()
{
  initializeSearchWidgets();
  initializeSearchWindowWidgets();
  messenger = Components.classes["@mozilla.org/messenger;1"]
                        .createInstance(Components.interfaces.nsIMessenger);

  gSearchBundle = document.getElementById("bundle_search");
  gSearchStopButton.setAttribute("label", gSearchBundle.getString("labelForSearchButton"));
  gSearchStopButton.setAttribute("accesskey", gSearchBundle.getString("labelForSearchButton.accesskey"));
  gMessengerBundle = document.getElementById("bundle_messenger");

  gMessageDisplay = new NeverVisisbleMessageDisplayWidget();
  gFolderDisplay = new SearchFolderDisplayWidget(gMessageDisplay);
  gFolderDisplay.messenger = messenger;
  gFolderDisplay.msgWindow = msgWindow;
  gFolderDisplay.tree = document.getElementById("threadTree");
  gFolderDisplay.treeBox = gFolderDisplay.tree.boxObject.QueryInterface(
                             Components.interfaces.nsITreeBoxObject);
  gFolderDisplay.view.openSearchView();
  gFolderDisplay.makeActive();

  gFolderDisplay.setColumnStates({
    subjectCol: { visible: true },
    senderCol: { visible: true },
    dateCol: { visible: true },
    locationCol: { visible: true },
  });

  if (window.arguments && window.arguments[0])
      selectFolder(window.arguments[0].folder);

  // trigger searchTermOverlay.js to create the first criterion
  onMore(null);
  // make sure all the buttons are configured
  UpdateMailSearch("onload");
}

function searchOnUnload()
{
  gFolderDisplay.close();
  top.controllers.removeController(nsSearchResultsController);

  // release this early because msgWindow holds a weak reference
  msgWindow.rootDocShell = null;
}

function initializeSearchWindowWidgets()
{
    gFolderPicker = document.getElementById("searchableFolders");
    gSearchStopButton = document.getElementById("search-button");
    hideMatchAllItem();

    msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                          .createInstance(nsIMsgWindow);
    msgWindow.domWindow = window;
    msgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;

    gStatusFeedback = new nsMsgStatusFeedback();
    msgWindow.statusFeedback = gStatusFeedback;

    // functionality to enable/disable buttons using nsSearchResultsController
    // depending of whether items are selected in the search results thread pane.
    top.controllers.insertControllerAt(0, nsSearchResultsController);
}


function onSearchStop() {
  gFolderDisplay.view.search.session.interruptSearch();
}

function onResetSearch(event) {
  onReset(event);
  gFolderDisplay.view.search.clear();

  gStatusFeedback.showStatusString("");
}

function selectFolder(folder)
{
    var folderURI;

    // if we can't search messages on this folder, just select the first one
    if (!folder || !folder.server.canSearchMessages ||
        (folder.flags & Components.interfaces.nsMsgFolderFlags.Virtual)) {
        // find first item in our folder picker menu list
        folderURI = gFolderPicker.firstChild.tree.builderView.getResourceAtIndex(0).Value;
    } else {
        folderURI = folder.URI;
    }
    updateSearchFolderPicker(folderURI);
}

function updateSearchFolderPicker(folderURI)
{
    SetFolderPicker(folderURI, gFolderPicker.id);

    // use the URI to get the real folder
    gCurrentFolder = GetMsgFolderFromUri(folderURI);

    var searchLocalSystem = document.getElementById("checkSearchLocalSystem");
    if (searchLocalSystem)
        searchLocalSystem.disabled = gCurrentFolder.server.searchScope == nsMsgSearchScope.offlineMail;
    setSearchScope(GetScopeForFolder(gCurrentFolder));
}

function updateSearchLocalSystem()
{
  setSearchScope(GetScopeForFolder(gCurrentFolder));
}

function UpdateAfterCustomHeaderChange()
{
  updateSearchAttributes();
}

function onChooseFolder(event) {
    var folderURI = event.id;
    if (folderURI) {
        updateSearchFolderPicker(folderURI);
    }
}

function onEnterInSearchTerm()
{
  // on enter
  // if not searching, start the search
  // if searching, stop and then start again
  if (gSearchStopButton.getAttribute("label") == gSearchBundle.getString("labelForSearchButton")) {
     onSearch();
  }
  else {
     onSearchStop();
     onSearch();
  }
}

function onSearch()
{
  let viewWrapper = gFolderDisplay.view;
  let searchTerms = getSearchTerms();

  viewWrapper.beginViewUpdate();
  viewWrapper.search.userTerms = searchTerms.length ? searchTerms : null;
  viewWrapper.searchFolders = getSearchFolders();
  viewWrapper.endViewUpdate();
}

/**
 * Get the current set of search terms, returning them as a list.  We filter out
 *  dangerous and insane predicates.
 */
function getSearchTerms() {
  let termCreator = gFolderDisplay.view.search.session;

  let searchTerms = [];
  // searchTermOverlay stores wrapper objects in its gSearchTerms array.  Pluck
  //  them.
  for (let iTerm = 0; iTerm < gSearchTerms.length; iTerm++) {
    let termWrapper = gSearchTerms[iTerm].obj;
    let realTerm = termCreator.createTerm();
    termWrapper.saveTo(realTerm);
    // A header search of "" is illegal for IMAP and will cause us to
    //  explode.  You don't want that and I don't want that.  So let's check
    //  if the bloody term is a subject search on a blank string, and if it
    //  is, let's secretly not add the term.  Everyone wins!
    if ((realTerm.attrib != Components.interfaces.nsMsgSearchAttrib.Subject) ||
        (realTerm.value.str != ""))
      searchTerms.push(realTerm);
  }

  return searchTerms;
}

/**
 * @return the list of folders the search should cover.
 */
function getSearchFolders() {
  let searchFolders = [];

  if (!gCurrentFolder.isServer && !gCurrentFolder.noSelect)
    searchFolders.push(gCurrentFolder);

  var searchSubfolders =
    document.getElementById("checkSearchSubFolders").checked;
  if (gCurrentFolder &&
      (searchSubfolders || gCurrentFolder.isServer || gCurrentFolder.noSelect))
    AddSubFolders(gCurrentFolder, searchFolders);

  return searchFolders;
}

function AddSubFolders(folder, outFolders) {
  var subFolders = folder.subFolders;
  while (subFolders.hasMoreElements()) {
    var nextFolder =
      subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);

    if (!(nextFolder.flags & Components.interfaces.nsMsgFolderFlags.Virtual)) {
      if (!nextFolder.noSelect)
        outFolders.push(nextFolder);

      AddSubFolders(nextFolder, outFolders);
    }
  }
}

function AddSubFoldersToURI(folder)
{
  var returnString = "";

  var subFolders = folder.subFolders;

  while (subFolders.hasMoreElements())
  {
    var nextFolder =
      subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);

    if (!(nextFolder.flags & Components.interfaces.nsMsgFolderFlags.Virtual))
    {
      if (!nextFolder.noSelect && !nextFolder.isServer)
      {
        if (returnString.length > 0)
          returnString += '|';
        returnString += nextFolder.URI;
      }
      var subFoldersString = AddSubFoldersToURI(nextFolder);
      if (subFoldersString.length > 0)
      {
        if (returnString.length > 0)
          returnString += '|';
        returnString += subFoldersString;
      }
    }
  }
  return returnString;
}


function GetScopeForFolder(folder)
{
  var searchLocalSystem = document.getElementById("checkSearchLocalSystem");
  return searchLocalSystem && searchLocalSystem.checked ? nsMsgSearchScope.offlineMail : folder.server.searchScope;
}

var nsMsgViewSortType = Components.interfaces.nsMsgViewSortType;
var nsMsgViewSortOrder = Components.interfaces.nsMsgViewSortOrder;
var nsMsgViewFlagsType = Components.interfaces.nsMsgViewFlagsType;
var nsMsgViewCommandType = Components.interfaces.nsMsgViewCommandType;

function goUpdateSearchItems(commandset)
{
  for (var i = 0; i < commandset.childNodes.length; i++)
  {
    var commandID = commandset.childNodes[i].getAttribute("id");
    if (commandID)
    {
      goUpdateCommand(commandID);
    }
  }
}

// used to toggle functionality for Search/Stop button.
function onSearchButton(event)
{
    if (event.target.label == gSearchBundle.getString("labelForSearchButton"))
        onSearch();
    else
        onSearchStop();
}

// threadPane.js will be needing this, too
function GetNumSelectedMessages()
{
  return gFolderDisplay.treeSelection.count;
}

function MsgDeleteSelectedMessages(aCommandType)
{
    // we don't delete news messages, we just return in that case
    if (gFolderDisplay.selectedMessageIsNews)
        return;

    // if mail messages delete
    gFolderDisplay.hintAboutToDeleteMessages();
    gFolderDisplay.doCommand(aCommandType);
}

function MoveMessageInSearch(destFolder)
{
  // Get the msg folder we're moving messages into.
  // If the id (uri) is not set, use file-uri which is set for
  // "File Here".
  let destUri = destFolder.getAttribute('id');
  if (destUri.length == 0)
    destUri = destFolder.getAttribute('file-uri');

  let destMsgFolder = GetMsgFolderFromUri(destUri).QueryInterface(
                        Components.interfaces.nsIMsgFolder);

  // we don't move news messages, we copy them
  if (gFolderDisplay.selectedMessageIsNews) {
    gFolderDisplay.doCommandWithFolder(nsMsgViewCommandType.copyMessages,
                                       destMsgFolder);
  }
  else {
    gFolderDisplay.hintAboutToDeleteMessages();
    gFolderDisplay.doCommandWithFolder(nsMsgViewCommandType.moveMessages,
                                       destMsgFolder);
  }
}

function GoToFolder()
{
  MsgOpenNewWindowForFolder(gFolderDisplay.selectedMessage);
}

function BeginDragThreadPane(event)
{
    // no search pane dnd yet
    return false;
}

function saveAsVirtualFolder()
{
  var searchFolderURIs = window.arguments[0].folder.URI;

  var searchSubfolders = document.getElementById("checkSearchSubFolders").checked;
  if (gCurrentFolder && (searchSubfolders || gCurrentFolder.isServer || gCurrentFolder.noSelect))
  {
    var subFolderURIs = AddSubFoldersToURI(gCurrentFolder);
    if (subFolderURIs.length > 0)
      searchFolderURIs += '|' + subFolderURIs;
  }

  var dialog = window.openDialog("chrome://messenger/content/virtualFolderProperties.xul", "",
                                 "chrome,titlebar,modal,centerscreen",
                                 {folder: window.arguments[0].folder,
                                  searchTerms: toXPCOMArray(getSearchTerms(),
                                                            Components.interfaces.nsISupportsArray),
                                  searchFolderURIs: searchFolderURIs});
}

