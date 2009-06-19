/** ***** BEGIN LICENSE BLOCK *****
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

/* This is where functions related to the standalone message window are kept */

Components.utils.import("resource://app/modules/jsTreeSelection.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// from MailNewsTypes.h
const nsMsgKey_None = 0xFFFFFFFF;
const nsMsgViewIndex_None = 0xFFFFFFFF;

/* globals for a particular window */

/// we have no tree view; let people know that.
var gFolderTreeView = null;

var gFolderDisplay;
var gMessageDisplay;

/**
 * We subclass FolderDisplayWidget:
 * - Because it assumes some thread-pane things that do not apply to us and we
 *    want to no-op those things out.
 * - To intercept queries about the selected message so that we can do the
 *    .eml file thing.  We were originally trying to avoid involving the
 *    nsMsgDBView, but that might not be important anymore. (future work)
 */
function StandaloneFolderDisplayWidget(aMessageDisplayWidget) {
  FolderDisplayWidget.call(this, null, aMessageDisplayWidget);
  // do not set the actual treeBox variable or our superclass might try and do
  //  weird rooting things we don't want to have to think about right now.
  this._magicTreeSelection = new JSTreeSelection(this.treeBox);
}
StandaloneFolderDisplayWidget.prototype = {
  __proto__: FolderDisplayWidget.prototype,

  /**
   * If we have a displayed message, then we've got 1 message, otherwise 0.
   */
  get selectedCount() {
    return this.messageDisplay.displayedMessage ? 1 : 0;
  },

  /**
   * If we have a selected message, it's the one displayed!  This is more
   *  straight-forward than having you trace through the tree selection and
   *  db view logic.
   */
  get selectedMessage() {
    return this.messageDisplay.displayedMessage;
  },

  /**
   * If we have a selected message, it's the one displayed!  This is more
   *  straight-forward than having you trace through the tree selection and
   *  db view logic.
   */
  get selectedMessages() {
    return this.messageDisplay.displayedMessage ?
             [this.messageDisplay.displayedMessage] : [];
  },

  /**
   * We never have a real treeview, so we always want to tell the view about
   *  the fake tree box so it will actually do something in NoteChange.
   */
  onCreatedView:
      function StandaloneMessageDisplayWidget_onCreatedView() {
    this._fakeTreeBox.view = this.view.dbView;
    // only if we're not dealing with a dummy message (from .eml file /
    //  attachment should we try and hook up the selection object.)  Otherwise
    //  the view will not operate in stand alone message mode.
    // XXX the sequencing here may break re-using a message window that is
    //  showing an .eml file to go to a real message, at least in terms of
    //  having the selection object properly associated with the tree.
    if (!this.messageDisplay.isDummy) {
      this.view.dbView.setTree(this._fakeTreeBox);
      this.view.dbView.selection = this._magicTreeSelection;
    }
    this.__proto__.__proto__.onCreatedView.call(this);
  },

  _superSelectedMessageUrisGetter:
    FolderDisplayWidget.prototype.__lookupGetter__('selectedMessageUris'),
  /**
   * Check with the message display widget to see if it has a dummy; if so, just
   *  return the dummy's URI, as the nsMsgDBView logic that our superclass uses
   *  falls down in that case.
   */
  get selectedMessageUris() {
    if (this.messageDisplay.displayedUri)
      return [this.messageDisplay.displayedUri];
    return this._superSelectedMessageUrisGetter.call(this);
  },

  /// folder display will want to show the thread pane; we need do nothing
  _showThreadPane: function () {},
  _showAccountCentral: function () {},

  _updateThreadDisplay: function () {},

  onMessageCountsChanged:
      function StandaloneFolderDisplayWidget_onMessageCountsChaned() {
    UpdateStatusMessageCounts();
  },
};


/**
 * Display widget abstraction for a standalone message display.  Right now
 *  I think this means the standalone message window, and not the 'message in a
 *  tab' thing, which is really just a perverted configuration of the 3-pane
 *  format.
 */
function StandaloneMessageDisplayWidget() {
  MessageDisplayWidget.call(this);
  /**
   * Indicate whether the message being displayed is a 'dummy' because it is
   *  backed not by an nsIMsgDBHdr but instead by a file on disk or an
   *  attachment on some mail message.
   */
  this.isDummy = false;
  /**
   * When displaying a dummy message, this is the URI of the message that we are
   *  displaying.  If we are not displaying a dummy message, this is null.
   */
  this.displayedUri = null;
}
StandaloneMessageDisplayWidget.prototype = {
  __proto__: MessageDisplayWidget.prototype,

  /**
   * The message pane is a standalone display widget is always visible.
   */
  get visible() {
    return true;
  },
  set visible(aIgnored) {
  },

  /**
   * Display the external message (from disk or attachment) named by the URI.
   */
  displayExternalMessage:
      function StandaloneMessageDisplayWidget_displayExternalMessage(aUri) {
    this.isDummy = true;
    this.displayedUri = aUri;
    this.onDisplayingMessage(messageHeaderSink.dummyMsgHeader);
    UpdateMailToolbar("external message display");
    // null out the selection on the view so it operates in stand alone mode
    this.folderDisplay.view.dbView.selection = null;
    this.folderDisplay.view.dbView.loadMessageByUrl(aUri);
  },

  clearDisplay: function () {
    this.messageLoading = false;
    this.messageLoaded = false;
    window.close();
  },
  _updateActiveMessagePane: function() {
    // no-op.  the message pane is always visible.
  },

  onDisplayingMessage:
      function StandaloneMessageDisplayWidget_onDisplayingMessage(aMsgHdr) {
    this.__proto__.__proto__.onDisplayingMessage.call(this, aMsgHdr);

    // - set the window title to the message subject (and maybe the app name)
    let title = aMsgHdr.mime2DecodedSubject;
    if (!gPlatformOSX)
      title += " - " + gBrandBundle.getString("brandFullName");
    document.title = title;

    this.isDummy = aMsgHdr.folder == null;
    if (!this.isDummy)
      this.displayedUri = null;
  },

  onSelectedMessagesChanged: function () {
    if (this.folderDisplay.treeSelection.count == 0) {
      window.close();
      return true;
    }
    return false;
  },
};

var messagepaneObserver = {

  canHandleMultipleItems: false,

  onDrop: function (aEvent, aData, aDragSession)
  {
    var sourceUri = aData.data;
    if (!gFolderDisplay.selectedMessage ||
        sourceUri != gFolderDisplay.selectedMessageUris[0])
    {
      var msgHdr = messenger.msgHdrFromURI(sourceUri);
      let originGlobal = aDragSession.sourceNode.ownerDocument.defaultValue;
      gFolderDisplay.cloneView(originGlobal.gFolderDisplay.view);
      gFolderDisplay.selectMessage(msgHdr);
    }
  },

  onDragOver: function (aEvent, aFlavour, aDragSession)
  {
    var messagepanebox = document.getElementById("messagepanebox");
    messagepanebox.setAttribute("dragover", "true");
  },

  onDragExit: function (aEvent, aDragSession)
  {
    var messagepanebox = document.getElementById("messagepanebox");
    messagepanebox.removeAttribute("dragover");
  },

  canDrop: function(aEvent, aDragSession)  //allow drop from mail:3pane window only - 4xp
  {
    var doc = aDragSession.sourceNode.ownerDocument;
    var elem = doc.getElementById("messengerWindow");
    return (elem && (elem.getAttribute("windowtype") == "mail:3pane"));
  },

  getSupportedFlavours: function ()
  {
    var flavourSet = new FlavourSet();
    flavourSet.appendFlavour("text/x-moz-message");
    return flavourSet;
  }
};

function UpdateStatusMessageCounts()
{
  // hook for extra toolbar items
  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(window, "mail:updateStandAloneMessageCounts", "");
}

// we won't show the window until the onload() handler is finished
// so we do this trick (suggested by hyatt / blaker)
function OnLoadMessageWindow()
{
  setTimeout(delayedOnLoadMessageWindow, 0); // when debugging, set this to 5000, so you can see what happens after the window comes up.
}

function delayedOnLoadMessageWindow()
{
  HideMenus();
  ShowMenus();
  MailOfflineMgr.init();
  CreateMailWindowGlobals();
  verifyAccounts(null);

  /**
   * Create a message listener so that we can update the title once the message
   *  finishes streaming when it's a dummy.
   */
  gMessageListeners.push({
    onStartHeaders: function () {},
    onEndHeaders: function() {
      if (gMessageDisplay.isDummy)
        gMessageDisplay.onDisplayingMessage(messageHeaderSink.dummyMsgHeader);
      UpdateMailToolbar(".eml/message from attachment finished loading");
    },
    onEndAttachments: function () {},
  });

  InitMsgWindow();

  messenger.setWindow(window, msgWindow);
  // FIX ME - later we will be able to use onload from the overlay
  OnLoadMsgHeaderPane();

  gPhishingDetector.init();

  // initialize the customizeDone method on the customizeable toolbar
  var toolbox = document.getElementById("mail-toolbox");
  toolbox.customizeDone = function(aEvent) { MailToolboxCustomizeDone(aEvent, "CustomizeMailToolbar"); };

  var toolbarset = document.getElementById('customToolbars');
  toolbox.toolbarset = toolbarset;

  SetupCommandUpdateHandlers();

  gMessageDisplay = new StandaloneMessageDisplayWidget();
  gFolderDisplay = new StandaloneFolderDisplayWidget(gMessageDisplay);
  gFolderDisplay.msgWindow = msgWindow;
  gFolderDisplay.messenger = messenger;

  setTimeout(actuallyLoadMessage, 0);
}

function actuallyLoadMessage() {
  /*
   * Our actual use cases that drive the arguments we take are:
   * 1) Displaying a message from disk or that was an attachment on a message.
   *    Such messages have no (real) message header and must come in the form of
   *    a URI.  (The message display code creates a 'dummy' header.)
   * 2) Displaying a message that has a header available, either as a result of
   *    the user selecting a message in another window to spawn us or through
   *    some indirection like displaying a message by message-id.  (The
   *    newsgroup UI exposes this, as well as the spotlight/vista indexers.)
   *
   * We clone views when possible for:
   * - Consistency of navigation within the message display.  Users would find
   *   it odd if they showed a message from a cross-folder view but ended up
   *   navigating around the message's actual folder.
   * - Efficiency.  It's faster to clone a view than open a new one.
   *
   * Our argument idioms for the use cases are thus:
   * 1) [A Message URI] where the URI is an nsIURL corresponding to a message
   *     on disk or that is an attachment part on another message.
   * 2) [A Message header, (optional) the origin DBViewWraper]
   *
   * Our original set of arguments, in case these get passed in and you're
   *  wondering why we explode, was:
   *   0: A message URI, string or nsIURI.
   *   1: A folder URI.  If arg 0 was an nsIURI, it may have had a folder attribute.
   *   2: The nsIMsgDBView used to open us.
   */
  if (window.arguments && window.arguments.length)
  {
    // message header?
    if (window.arguments[0] instanceof Components.interfaces.nsIMsgDBHdr) {
      let msgHdr = window.arguments[0];
      let originViewWrapper = window.arguments.length > 1 ?
        window.arguments[1] : null;
      if (originViewWrapper)
        gFolderDisplay.cloneView(originViewWrapper);
      else
        gFolderDisplay.show(msgHdr.folder);
      gFolderDisplay.selectMessage(msgHdr);
    }
    // it must be a URI for a message lacking a backing header
    else {
      // Here's how this goes.  nsMessenger::LoadURL checks out the URL we
      //  pass it, and if it sees that the URI starts with "file:" or contains
      //  "type=application/x-message-display" then it knows it needs to
      //  create a dummy header.  It gets the 'dummyMsgHeader' property from
      //  the js message header sink.
      // Additionally, nsMessenger::MsgHdrFromURI checks the URI we pass it
      //  and if it meets either of those same constraints (assuming it has a
      //  msgWindow), it will retrieve the header sink off the msgWindow, get
      //  the dummy header, and return that.
      // so...
      // - create a search view for the standalone dude
      gFolderDisplay.view.openSearchView();
      // - load the message
      let messageURI = window.arguments[0];
      if (messageURI instanceof Components.interfaces.nsIURI)
        messageURI = messageURI.spec;
      gMessageDisplay.displayExternalMessage(messageURI);
    }
  }

  gFolderDisplay.makeActive();

  // set focus to the message pane
  window.content.focus();
}

function ShowMenus()
{
  var openMail3Pane_menuitem = document.getElementById('tasksMenuMail');
  if (openMail3Pane_menuitem)
    openMail3Pane_menuitem.removeAttribute("hidden");
}

function HideMenus()
{
  var message_menuitem=document.getElementById('menu_showMessage');
  if (message_menuitem)
    message_menuitem.setAttribute("hidden", "true");

  var showSearch_showMessage_Separator = document.getElementById('menu_showSearch_showMessage_Separator');
  if (showSearch_showMessage_Separator)
    showSearch_showMessage_Separator.setAttribute("hidden", "true");

  var expandOrCollapseMenu = document.getElementById('menu_expandOrCollapse');
  if (expandOrCollapseMenu)
    expandOrCollapseMenu.setAttribute("hidden", "true");

  var menuDeleteFolder = document.getElementById('menu_deleteFolder');
  if (menuDeleteFolder)
    menuDeleteFolder.hidden = true;

  var renameFolderMenu = document.getElementById('menu_renameFolder');
  if (renameFolderMenu)
    renameFolderMenu.setAttribute("hidden", "true");

  var viewLayoutMenu = document.getElementById("menu_MessagePaneLayout");
  if (viewLayoutMenu)
    viewLayoutMenu.setAttribute("hidden", "true");

  var viewFolderMenu = document.getElementById("menu_FolderViews");
  if (viewFolderMenu)
    viewFolderMenu.setAttribute("hidden", "true");

  var viewMessagesMenu = document.getElementById('viewMessagesMenu');
  if (viewMessagesMenu)
    viewMessagesMenu.setAttribute("hidden", "true");

  var viewMessageViewMenu = document.getElementById('viewMessageViewMenu');
  if (viewMessageViewMenu)
    viewMessageViewMenu.setAttribute("hidden", "true");

  var viewMessagesMenuSeparator = document.getElementById('viewMessagesMenuSeparator');
  if (viewMessagesMenuSeparator)
    viewMessagesMenuSeparator.setAttribute("hidden", "true");

  var openMessageMenu = document.getElementById('openMessageWindowMenuitem');
  if (openMessageMenu)
    openMessageMenu.setAttribute("hidden", "true");

  var viewSortMenuSeparator = document.getElementById('viewSortMenuSeparator');
  if (viewSortMenuSeparator)
    viewSortMenuSeparator.setAttribute("hidden", "true");

  var viewSortMenu = document.getElementById('viewSortMenu');
  if (viewSortMenu)
    viewSortMenu.setAttribute("hidden", "true");

  var emptryTrashMenu = document.getElementById('menu_emptyTrash');
  if (emptryTrashMenu)
    emptryTrashMenu.setAttribute("hidden", "true");

  var menuPropertiesSeparator = document.getElementById("editPropertiesSeparator");
  if (menuPropertiesSeparator)
    menuPropertiesSeparator.setAttribute("hidden", "true");

  var menuProperties = document.getElementById('menu_properties');
  if (menuProperties)
    menuProperties.setAttribute("hidden", "true");

  var favoriteFolder = document.getElementById('menu_favoriteFolder');
  if (favoriteFolder)
  {
    favoriteFolder.disabled = true;
    favoriteFolder.setAttribute("hidden", "true");
  }

  var compactFolderMenu = document.getElementById('menu_compactFolder');
  if (compactFolderMenu)
    compactFolderMenu.setAttribute("hidden", "true");

  var trashSeparator = document.getElementById('trashMenuSeparator');
  if (trashSeparator)
    trashSeparator.setAttribute("hidden", "true");

  var goStartPageSeparator = document.getElementById('goNextSeparator');
  if (goStartPageSeparator)
    goStartPageSeparator.hidden = true;

  var goStartPage = document.getElementById('goStartPage');
  if (goStartPage)
   goStartPage.hidden = true;

  var menuFileClose = document.getElementById('menu_close');
  var menuFileQuit = document.getElementById('menu_FileQuitItem');
  if (menuFileClose && menuFileQuit)
    menuFileQuit.parentNode.replaceChild(menuFileClose, menuFileQuit);
}

function OnUnloadMessageWindow()
{
  gFolderDisplay.close();
  UnloadCommandUpdateHandlers();
  // FIX ME - later we will be able to use onunload from the overlay
  OnUnloadMsgHeaderPane();
  gPhishingDetector.shutdown();
  OnMailWindowUnload();
}

function GetSelectedMsgFolders()
{
  if (gFolderDisplay.displayedFolder)
    return [gFolderDisplay.displayedFolder];
  return [];
}

function GetNumSelectedMessages()
{
  return gFolderDisplay.treeSelection.count;
}

function ReloadMessage()
{
  gFolderDisplay.view.dbView.reloadMessage();
}

function MsgDeleteMessageFromMessageWindow(reallyDelete, fromToolbar)
{
  // if from the toolbar, return right away if this is a news message
  // only allow cancel from the menu:  "Edit | Cancel / Delete Message"
  if (fromToolbar && gDisplayFolder.view.isNewsFolder)
      return;

  gFolderDisplay.hintAboutToDeleteMessages();

  if (reallyDelete)
    gFolderDisplay.doCommand(nsMsgViewCommandType.deleteNoTrash);
  else
    gFolderDisplay.doCommand(nsMsgViewCommandType.deleteMsg);
}

// MessageWindowController object (handles commands when one of the trees does not have focus)
var MessageWindowController =
{
   supportsCommand: function(command)
  {
    switch ( command )
    {
      // external messages cannot be deleted, mutated, or subjected to filtering
      case "cmd_delete":
      case "cmd_killThread":
      case "cmd_killSubthread":
      case "cmd_watchThread":
      case "button_delete":
      case "button_junk":
      case "cmd_shiftDelete":
      case "cmd_tag":
      case "button_mark":
      case "cmd_markAsRead":
      case "cmd_markAllRead":
      case "cmd_markThreadAsRead":
      case "cmd_markReadByDate":
      case "cmd_markAsFlagged":
      case "cmd_markAsJunk":
      case "cmd_markAsNotJunk":
      case "cmd_recalculateJunkScore":
      case "cmd_applyFiltersToSelection":
      case "cmd_applyFilters":
      case "cmd_runJunkControls":
      case "cmd_deleteJunk":
        return !gMessageDisplay.isDummy;
      case "cmd_undo":
      case "cmd_redo":
      case "cmd_saveAsFile":
      case "cmd_saveAsTemplate":
      case "cmd_viewPageSource":
      case "cmd_getMsgsForAuthAccounts":
      case "button_file":
      case "cmd_file":
      case "cmd_nextMsg":
      case "button_next":
      case "button_previous":
      case "cmd_nextUnreadMsg":
      case "cmd_nextFlaggedMsg":
      case "cmd_nextUnreadThread":
      case "cmd_previousMsg":
      case "cmd_previousUnreadMsg":
      case "cmd_previousFlaggedMsg":
      case "cmd_goForward":
      case "cmd_goBack":
      case "button_goForward":
      case "button_goBack":
        return gFolderDisplay.selectedMessage != null;

      case "cmd_reply":
      case "button_reply":
      case "cmd_replySender":
      case "cmd_replyGroup":
      case "cmd_replyall":
      case "button_replyall":
      case "cmd_replylist":
      case "button_replylist":
      case "cmd_archive":
      case "button_archive":
      case "cmd_forward":
      case "button_forward":
      case "cmd_forwardInline":
      case "cmd_forwardAttachment":
      case "cmd_editAsNew":
      case "cmd_getNextNMessages":
      case "cmd_find":
      case "cmd_findAgain":
      case "cmd_findPrevious":
      case "cmd_search":
      case "cmd_reload":
      case "cmd_getNewMessages":
      case "button_getNewMessages":
      case "button_print":
      case "cmd_print":
      case "cmd_printpreview":
      case "cmd_printSetup":
      case "cmd_settingsOffline":
      case "cmd_createFilterFromPopup":
      case "cmd_createFilterFromMenu":
      case "cmd_moveToFolderAgain":
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
        return true;
      case "cmd_synchronizeOffline":
      case "cmd_downloadFlagged":
      case "cmd_downloadSelected":
        return MailOfflineMgr.isOnline();
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    let loadedFolder;
    switch ( command )
    {
      case "cmd_createFilterFromPopup":
      case "cmd_createFilterFromMenu":
        loadedFolder = gFolderDisplay.displayedFolder;
        if (!(loadedFolder && loadedFolder.server.canHaveFilters))
          return false;
      case "cmd_delete":
        UpdateDeleteCommand();
        // fall through
      case "button_delete":
        UpdateDeleteToolbarButton();
        // fall through
      case "cmd_shiftDelete":
        return gFolderDisplay.selectedMessage &&
               gFolderDisplay.displayedFolder &&
               (gFolderDisplay.displayedFolder.canDeleteMessages ||
                gFolderDisplay.view.isNewsFolder);
      case "button_junk":
        UpdateJunkToolbarButton();
        // fall through
      case "cmd_markAsJunk":
      case "cmd_markAsNotJunk":
      case "cmd_recalculateJunkScore":
        // can't do junk on news yet
        return (!gFolderDisplay.view.isNewsFolder);
      case "button_archive":
        var folder = gFolderDisplay.displayedFolder;
        return folder &&
          !(IsSpecialFolder(folder, Components.interfaces.nsMsgFolderFlags.Archive,
                            true));
      case "cmd_reply":
      case "button_reply":
        return gFolderDisplay.selectedMessage && IsReplyEnabled();
      case "cmd_replyall":
      case "button_replyall":
        return gFolderDisplay.selectedMessage && IsReplyAllEnabled();
      case "cmd_replylist":
      case "button_replylist":
        return gFolderDisplay.selectedMessage && IsReplyListEnabled();
      case "cmd_archive":
      case "cmd_replySender":
      case "cmd_replyGroup":
      case "cmd_forward":
      case "button_forward":
      case "cmd_forwardInline":
      case "cmd_forwardAttachment":
      case "cmd_editAsNew":
      case "cmd_print":
      case "cmd_printpreview":
      case "button_print":
      case "cmd_saveAsFile":
      case "cmd_saveAsTemplate":
      case "cmd_viewPageSource":
      case "cmd_reload":
      case "cmd_find":
      case "cmd_tag":
      case "button_mark":
      case "cmd_markAsRead":
      case "cmd_markAllRead":
      case "cmd_markThreadAsRead":
      case "cmd_markReadByDate":
        return(true);
      case "cmd_markAsFlagged":
      case "button_file":
      case "cmd_file":
        return ( gFolderDisplay.selectedMessage != null);
      case "cmd_printSetup":
        return true;
      case "cmd_getNewMessages":
      case "button_getNewMessages":
      case "cmd_getMsgsForAuthAccounts":
        // GetMsgs should always be enabled, see bugs 89404 and 111102.
        return true;
      case "cmd_getNextNMessages":
        return IsGetNextNMessagesEnabled();
      case "cmd_downloadFlagged":
      case "cmd_downloadSelected":
      case "cmd_synchronizeOffline":
        return MailOfflineMgr.isOnline();
      case "cmd_settingsOffline":
        return IsAccountOfflineEnabled();
      case "cmd_nextMsg":
      case "button_next":
      case "cmd_nextUnreadMsg":
      case "cmd_nextFlaggedMsg":
      case "cmd_nextUnreadThread":
      case "button_previous":
      case "cmd_previousMsg":
      case "cmd_previousUnreadMsg":
      case "cmd_previousFlaggedMsg":
      case "cmd_findAgain":
      case "cmd_findPrevious":
      case "cmd_goForward":
      case "cmd_goBack":
      case "cmd_applyFiltersToSelection":
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
        return true;
      case "button_goForward":
      case "button_goBack":
      case "cmd_goForward":
      case "cmd_goBack":
        return gFolderDisplay.navigateStatus(
          (command == "cmd_goBack" || command == "button_goBack") ?
            nsMsgNavigationType.back : nsMsgNavigationType.forward);
      case "cmd_search":
        loadedFolder = gFolderDisplay.displayedFolder;
        if (!loadedFolder)
          return false;
        return loadedFolder.server.canSearchMessages;
      case "cmd_undo":
      case "cmd_redo":
        return SetupUndoRedoCommand(command);
      case "cmd_moveToFolderAgain":
        loadedFolder = gFolderDisplay.displayedFolder;
        if (!loadedFolder || (pref.getBoolPref("mail.last_msg_movecopy_was_move") &&
            !loadedFolder.canDeleteMessages))
          return false;
        return pref.getCharPref("mail.last_msg_movecopy_target_uri");
      case "cmd_applyFilters":
      case "cmd_runJunkControls":
      case "cmd_deleteJunk":
        return false;
      default:
        return false;
    }
  },

  doCommand: function(command)
  {
    // if the user invoked a key short cut then it is possible that we got here for a command which is
    // really disabled. kick out if the command should be disabled.
    if (!this.isCommandEnabled(command)) return;

    var navigationType = nsMsgNavigationType.nextUnreadMessage;

  switch ( command )
  {
    case "cmd_getNewMessages":
      MsgGetMessage();
      break;
        case "cmd_undo":
            messenger.undo(msgWindow);
            break;
        case "cmd_redo":
            messenger.redo(msgWindow);
            break;
        case "cmd_getMsgsForAuthAccounts":
          MsgGetMessagesForAllAuthenticatedAccounts();
          break;
        case "cmd_getNextNMessages":
        MsgGetNextNMessages();
        break;
      case "cmd_archive":
        MsgArchiveSelectedMessages(null);
        break;
      case "cmd_reply":
        MsgReplyMessage(null);
        break;
      case "cmd_replySender":
        MsgReplySender(null);
        break;
      case "cmd_replyGroup":
        MsgReplyGroup(null);
        break;
      case "cmd_replyall":
        MsgReplyToAllMessage(null);
        break;
      case "cmd_replylist":
        MsgReplyToListMessage(null);
        break;
      case "cmd_forward":
        MsgForwardMessage(null);
        break;
      case "cmd_forwardInline":
        MsgForwardAsInline(null);
        break;
      case "cmd_forwardAttachment":
        MsgForwardAsAttachment(null);
        break;
      case "cmd_editAsNew":
        MsgEditMessageAsNew();
        break;
      case "cmd_moveToFolderAgain":
        var folderId = pref.getCharPref("mail.last_msg_movecopy_target_uri");
        if (pref.getBoolPref("mail.last_msg_movecopy_was_move"))
          MsgMoveMessage(GetMsgFolderFromUri(folderId));
        else
          MsgCopyMessage(GetMsgFolderFromUri(folderId));
        break;
      case "cmd_createFilterFromPopup":
        break;// This does nothing because the createfilter is invoked from the popupnode oncommand.
      case "cmd_createFilterFromMenu":
        MsgCreateFilter();
        break;
      case "cmd_delete":
        MsgDeleteMessageFromMessageWindow(false, false);
        break;
      case "cmd_shiftDelete":
        MsgDeleteMessageFromMessageWindow(true, false);
        break;
      case "button_junk":
        MsgJunk();
        break;
      case "button_delete":
        MsgDeleteMessageFromMessageWindow(false, true);
        break;
      case "cmd_printSetup":
        PrintUtils.showPageSetup();
        break;
      case "cmd_print":
        PrintEnginePrint();
        break;
      case "cmd_printpreview":
        PrintEnginePrintPreview();
        break;
      case "cmd_saveAsFile":
        MsgSaveAsFile();
        break;
      case "cmd_saveAsTemplate":
        MsgSaveAsTemplate();
        break;
      case "cmd_viewPageSource":
        ViewPageSource(gFolderDisplay.selectedMessageUris);
        break;
      case "cmd_reload":
        ReloadMessage();
        break;
      case "cmd_find":
        document.getElementById("FindToolbar").onFindCommand();
        break;
      case "cmd_findAgain":
        document.getElementById("FindToolbar").onFindAgainCommand(false)
        break;
      case "cmd_findPrevious":
        document.getElementById("FindToolbar").onFindAgainCommand(true)
        break;
      case "cmd_search":
        MsgSearchMessages();
        break;
      case "button_mark":
      case "cmd_markAsRead":
        MsgMarkMsgAsRead();
        return;
      case "cmd_markThreadAsRead":
        ClearPendingReadTimer();
        gFolderDisplay.doCommand(nsMsgViewCommandType.markThreadRead);
        return;
      case "cmd_markAllRead":
        MsgMarkAllRead();
        return;
      case "cmd_markReadByDate":
        MsgMarkReadByDate();
        return;
      case "cmd_markAsFlagged":
        MsgMarkAsFlagged();
        return;
      case "cmd_markAsJunk":
        JunkSelectedMessages(true);
        return;
      case "cmd_markAsNotJunk":
        JunkSelectedMessages(false);
        return;
      case "cmd_recalculateJunkScore":
        analyzeMessagesForJunk();
        return;
      case "cmd_downloadFlagged":
        gFolderDisplay.doCommand(
          nsMsgViewCommandType.downloadFlaggedForOffline);
        return;
      case "cmd_downloadSelected":
        gFolderDisplay.doCommand(
          nsMsgViewCommandType.downloadSelectedForOffline);
        return;
      case "cmd_synchronizeOffline":
        MsgSynchronizeOffline();
        return;
      case "cmd_settingsOffline":
        MailOfflineMgr.openOfflineAccountSettings();
        return;
      case "cmd_nextUnreadMsg":
      case "button_next":
        performNavigation(nsMsgNavigationType.nextUnreadMessage);
        break;
      case "cmd_nextUnreadThread":
        performNavigation(nsMsgNavigationType.nextUnreadThread);
        break;
      case "cmd_nextMsg":
        performNavigation(nsMsgNavigationType.nextMessage);
        break;
      case "cmd_nextFlaggedMsg":
        performNavigation(nsMsgNavigationType.nextFlagged);
        break;
      case "cmd_previousMsg":
        performNavigation(nsMsgNavigationType.previousMessage);
        break;
      case "button_previous":
      case "cmd_previousUnreadMsg":
        performNavigation(nsMsgNavigationType.previousUnreadMessage);
    break;
      case "cmd_previousFlaggedMsg":
        performNavigation(nsMsgNavigationType.previousFlagged);
        break;
      case "cmd_goForward":
        performNavigation(nsMsgNavigationType.forward);
        break;
      case "cmd_goBack":
        performNavigation(nsMsgNavigationType.back);
        break;
      case "cmd_applyFiltersToSelection":
        MsgApplyFiltersToSelection();
        break;
      case "cmd_fullZoomReduce":
        ZoomManager.reduce();
        break;
      case "cmd_fullZoomEnlarge":
        ZoomManager.enlarge();
        break;
      case "cmd_fullZoomReset":
        ZoomManager.reset();
        break;
      case "cmd_fullZoomToggle":
        ZoomManager.toggleZoom();
        break;
      }
  },

  onEvent: function(event)
  {
  }
};

function performNavigation(type)
{
  // Try to load a message by navigation type if we can find
  // the message in the same folder.
  if (gFolderDisplay.navigate(type))
    return;

  CrossFolderNavigation(type);
}

function SetupCommandUpdateHandlers()
{
  top.controllers.insertControllerAt(0, MessageWindowController);
}

function UnloadCommandUpdateHandlers()
{
  top.controllers.removeController(MessageWindowController);
}

function getMailToolbox ()
{
  return document.getElementById("mail-toolbox");
}

function RestoreFocusAfterHdrButton()
{
  // set focus to the message pane
  window.content.focus();
}
