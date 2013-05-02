/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Controller object for folder pane
var FolderPaneController =
{
   supportsCommand: function(command)
	{
		switch ( command )
		{
			case "cmd_delete":
			case "cmd_shiftDelete":
			case "button_delete":
			case "button_shiftDelete":
			//case "cmd_selectAll": the folder pane currently only handles single selection
			case "cmd_cut":
			case "cmd_copy":
			case "cmd_paste":
				return true;
				
			default:
				return false;
		}
	},

	isCommandEnabled: function(command)
	{
		switch ( command )
		{
			case "cmd_cut":
			case "cmd_copy":
			case "cmd_paste":
				return false;
			case "cmd_delete":
			case "cmd_shiftDelete":
			case "button_delete":
        // Make sure the button doesn't show "Undelete" for folders.
        if (command == "button_delete")
          UpdateDeleteToolbarButton(true);
			case "button_shiftDelete":
			if ( command == "cmd_delete" )
				goSetMenuValue(command, 'valueFolder');
        let folders = GetSelectedMsgFolders();

        if (folders.length) {
          var canDeleteThisFolder;
				var specialFolder = null;
				var isServer = null;
				try {
          let folder = folders[0];
          specialFolder = getSpecialFolderString(folder);
          isServer = folder.isServer;
          if (folder.server.type == "nntp") {
			     	if ( command == "cmd_delete" ) {
					      goSetMenuValue(command, 'valueNewsgroup');
				    	  goSetAccessKey(command, 'valueNewsgroupAccessKey');
            }
          }
				}
				catch (ex) {
					//dump("specialFolder failure: " + ex + "\n");
				} 
        if (specialFolder == "Inbox" || specialFolder == "Trash" || specialFolder == "Drafts" ||
            specialFolder == "Sent" || specialFolder == "Templates" || specialFolder == "Outbox" ||
            (specialFolder == "Junk" && !CanRenameDeleteJunkMail(GetSelectedFolderURI())) || isServer)
          canDeleteThisFolder = false;
        else
          canDeleteThisFolder = true;
        return canDeleteThisFolder && isCommandEnabled(command);
      }
			else
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

		switch ( command )
		{
			case "cmd_delete":
			case "cmd_shiftDelete":
			case "button_delete":
			case "button_shiftDelete":
				MsgDeleteFolder();
				break;
		}
	},
	
	onEvent: function(event)
	{
	}
};

// DefaultController object (handles commands when one of the trees does not have focus)
var DefaultController =
{
   supportsCommand: function(command)
	{

		switch ( command )
		{
      case "cmd_createFilterFromPopup":
      case "cmd_archive":
			case "cmd_reply":
			case "button_reply":
			case "cmd_replyList":
			case "cmd_replyGroup":
			case "cmd_replySender":
			case "cmd_replyall":
			case "button_replyall":
      case "cmd_replySenderAndGroup":
      case "cmd_replyAllRecipients":
			case "cmd_forward":
			case "button_forward":
			case "cmd_forwardInline":
			case "cmd_forwardAttachment":
			case "cmd_editAsNew":
      case "cmd_createFilterFromMenu":
      case "cmd_delete":
      case "cmd_shiftDelete":
      case "button_delete":
      case "button_shiftDelete":
      case "button_junk":
			case "cmd_nextMsg":
      case "button_next":
			case "cmd_nextUnreadMsg":
			case "cmd_nextFlaggedMsg":
			case "cmd_nextUnreadThread":
			case "cmd_previousMsg":
			case "cmd_previousUnreadMsg":
			case "cmd_previousFlaggedMsg":
      case "button_goBack":
      case "cmd_goBack":
      case "button_goForward":
      case "cmd_goForward":
      case "cmd_goStartPage":
			case "cmd_viewAllMsgs":
			case "cmd_viewUnreadMsgs":
      case "cmd_viewThreadsWithUnread":
      case "cmd_viewWatchedThreadsWithUnread":
      case "cmd_viewIgnoredThreads":
      case "cmd_stop":
      case "cmd_undo":
      case "cmd_redo":
			case "cmd_expandAllThreads":
			case "cmd_collapseAllThreads":
			case "cmd_renameFolder":
			case "cmd_sendUnsentMsgs":
			case "cmd_openMessage":
      case "button_print":
			case "cmd_print":
			case "cmd_printpreview":
			case "cmd_printSetup":
			case "cmd_saveAsFile":
			case "cmd_saveAsTemplate":
      case "cmd_properties":
			case "cmd_viewPageSource":
			case "cmd_setFolderCharset":
			case "cmd_reload":
      case "button_getNewMessages":
			case "cmd_getNewMessages":
      case "cmd_getMsgsForAuthAccounts":
			case "cmd_getNextNMessages":
			case "cmd_find":
      case "cmd_findNext":
			case "cmd_findPrev":
      case "button_search":
      case "cmd_search":
      case "button_mark":
			case "cmd_markAsRead":
			case "cmd_markAllRead":
			case "cmd_markThreadAsRead":
			case "cmd_markReadByDate":
			case "cmd_markAsFlagged":
			case "cmd_markAsJunk":
			case "cmd_markAsNotJunk":
      case "cmd_recalculateJunkScore":
      case "cmd_markAsShowRemote":
      case "cmd_markAsNotPhish":
      case "cmd_displayMsgFilters":
      case "cmd_applyFiltersToSelection":
      case "cmd_applyFilters":
      case "cmd_runJunkControls":
      case "cmd_deleteJunk":
      case "button_file":
			case "cmd_emptyTrash":
			case "cmd_compactFolder":
  	  case "cmd_settingsOffline":
      case "cmd_close":
      case "cmd_selectAll":
      case "cmd_selectThread":
      case "cmd_selectFlagged":
				return true;
      case "cmd_downloadFlagged":
      case "cmd_downloadSelected":
      case "cmd_synchronizeOffline":
        return !Services.io.offline;

      case "cmd_watchThread":
      case "cmd_killThread":
      case "cmd_killSubthread":
      case "cmd_cancel":
        return gFolderDisplay.selectedMessageIsNews;

			default:
				return false;
		}
	},

  isCommandEnabled: function(command)
  {
    var enabled = new Object();
    enabled.value = false;
    var checkStatus = new Object();

    switch ( command )
    {
      case "cmd_delete":
        UpdateDeleteCommand();
        // fall through
      case "button_delete":
        if (command == "button_delete")
          UpdateDeleteToolbarButton(false);
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.deleteMsg, enabled, checkStatus);
        return enabled.value;
      case "cmd_shiftDelete":
      case "button_shiftDelete":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.deleteNoTrash, enabled, checkStatus);
        return enabled.value;
      case "cmd_cancel":
        return GetNumSelectedMessages() == 1 &&
               gFolderDisplay.selectedMessageIsNews;
      case "button_junk":
        UpdateJunkToolbarButton();
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.junk, enabled, checkStatus);
        return enabled.value;
      case "cmd_killThread":
      case "cmd_killSubthread":
        return GetNumSelectedMessages() > 0;
      case "cmd_watchThread":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.toggleThreadWatched, enabled, checkStatus);
        return enabled.value;
      case "cmd_createFilterFromPopup":
      case "cmd_createFilterFromMenu":
        var loadedFolder = GetLoadedMsgFolder();
        if (!(loadedFolder && loadedFolder.server.canHaveFilters))
          return false;   // else fall thru
      case "cmd_saveAsFile":
        return GetNumSelectedMessages() > 0;
      case "cmd_saveAsTemplate":
        var msgFolder = GetSelectedMsgFolders();
        var target = msgFolder[0].server.localStoreType;
        if (GetNumSelectedMessages() == 0 || target == "news")
          return false;   // else fall thru
      case "cmd_reply":
      case "button_reply":
      case "cmd_replyList":
      case "cmd_replyGroup":
      case "cmd_replySender":
      case "cmd_replyall":
      case "button_replyall":
      case "cmd_replySenderAndGroup":
      case "cmd_replyAllRecipients":
      case "cmd_forward":
      case "button_forward":
      case "cmd_forwardInline":
      case "cmd_forwardAttachment":
      case "cmd_editAsNew":
      case "cmd_openMessage":
      case "button_print":
      case "cmd_print":
      case "cmd_viewPageSource":
      case "cmd_reload":
      case "cmd_applyFiltersToSelection":
        if (command == "cmd_applyFiltersToSelection")
        {
          var whichText = "valueMessage";
          if (GetNumSelectedMessages() > 1)
            whichText = "valueSelection";
          goSetMenuValue(command, whichText);
          goSetAccessKey(command, whichText + "AccessKey");
        }
        if (GetNumSelectedMessages() > 0)
        {
          if (gDBView)
          {
            gDBView.getCommandStatus(nsMsgViewCommandType.cmdRequiringMsgBody, enabled, checkStatus);
            return enabled.value;
          }
        }
        return false;
      case "cmd_printpreview":
	      if ( GetNumSelectedMessages() == 1 && gDBView)
        {
           gDBView.getCommandStatus(nsMsgViewCommandType.cmdRequiringMsgBody, enabled, checkStatus);
           return enabled.value;
        }
        return false;
      case "cmd_printSetup":
        return true;
      case "cmd_markAsFlagged":
      case "button_file":
        return GetNumSelectedMessages() > 0;
      case "cmd_archive":
        return gFolderDisplay.canArchiveSelectedMessages;
      case "cmd_markAsJunk":
      case "cmd_markAsNotJunk":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.junk, enabled, checkStatus);
        return enabled.value;
      case "cmd_recalculateJunkScore":
        // We're going to take a conservative position here, because we really
        // don't want people running junk controls on folders that are not
        // enabled for junk. The junk type picks up possible dummy message headers,
        // while the runJunkControls will prevent running on XF virtual folders.
        if (gDBView)
        {
          gDBView.getCommandStatus(nsMsgViewCommandType.runJunkControls, enabled, checkStatus);
          if (enabled.value)
            gDBView.getCommandStatus(nsMsgViewCommandType.junk, enabled, checkStatus);
        }
        return enabled.value;
      case "cmd_markAsShowRemote":
        return (GetNumSelectedMessages() > 0 && checkMsgHdrPropertyIsNot("remoteContentPolicy", kAllowRemoteContent));
      case "cmd_markAsNotPhish":
        return (GetNumSelectedMessages() > 0 && checkMsgHdrPropertyIsNot("notAPhishMessage", kNotAPhishMessage));
      case "cmd_displayMsgFilters":
        let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                            .getService(Components.interfaces.nsIMsgAccountManager);
        return mgr.accounts.length > 0;
      case "cmd_applyFilters":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.applyFilters, enabled, checkStatus);
        return enabled.value;
      case "cmd_runJunkControls":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.runJunkControls, enabled, checkStatus);
        return enabled.value;
      case "cmd_deleteJunk":
        if (gDBView)
          gDBView.getCommandStatus(nsMsgViewCommandType.deleteJunk, enabled, checkStatus);
        return enabled.value;
      case "button_mark":
      case "cmd_markAsRead":
      case "cmd_markThreadAsRead":
        return GetNumSelectedMessages() > 0;
      case "button_next":
        return IsViewNavigationItemEnabled();
      case "cmd_nextMsg":
      case "cmd_nextUnreadMsg":
      case "cmd_nextUnreadThread":
      case "cmd_previousMsg":
      case "cmd_previousUnreadMsg":
        return IsViewNavigationItemEnabled();
      case "button_goBack":
      case "cmd_goBack":
        return gDBView && gDBView.navigateStatus(nsMsgNavigationType.back);
      case "button_goForward":
      case "cmd_goForward":
        return gDBView && gDBView.navigateStatus(nsMsgNavigationType.forward);
      case "cmd_goStartPage":
        return Services.prefs.getBoolPref("mailnews.start_page.enabled") && !IsMessagePaneCollapsed();
      case "cmd_markAllRead":
        return IsFolderSelected() && gDBView && gDBView.msgFolder.getNumUnread(false) > 0;
      case "cmd_markReadByDate":
        return IsFolderSelected();
      case "cmd_find":
      case "cmd_findNext":
      case "cmd_findPrev":
        return IsMessageDisplayedInMessagePane();
        break;
      case "button_search":
      case "cmd_search":
        return IsCanSearchMessagesEnabled();
      case "cmd_selectAll":
      case "cmd_selectFlagged":
        return gDBView != null;
      // these are enabled on when we are in threaded mode
      case "cmd_selectThread":
        if (GetNumSelectedMessages() <= 0) return false;
      case "cmd_expandAllThreads":
      case "cmd_collapseAllThreads":
        return gDBView && (gDBView.viewFlags & nsMsgViewFlagsType.kThreadedDisplay);
        break;
      case "cmd_nextFlaggedMsg":
      case "cmd_previousFlaggedMsg":
        return IsViewNavigationItemEnabled();
      case "cmd_viewAllMsgs":
      case "cmd_viewUnreadMsgs":
      case "cmd_viewIgnoredThreads":
        return gDBView;
      case "cmd_viewThreadsWithUnread":
      case "cmd_viewWatchedThreadsWithUnread":
        return gDBView && !(GetSelectedMsgFolders()[0].flags & 
                            Components.interfaces.nsMsgFolderFlags.Virtual);
      case "cmd_stop":
        return true;
      case "cmd_undo":
      case "cmd_redo":
          return SetupUndoRedoCommand(command);
      case "cmd_renameFolder":
        return IsRenameFolderEnabled();
      case "cmd_sendUnsentMsgs":
        return IsSendUnsentMsgsEnabled(null);
      case "cmd_properties":
        return IsPropertiesEnabled(command);
      case "button_getNewMessages":
      case "cmd_getNewMessages":
      case "cmd_getMsgsForAuthAccounts":
        return IsGetNewMessagesEnabled();
      case "cmd_getNextNMessages":
        return IsGetNextNMessagesEnabled();
      case "cmd_emptyTrash":
        return IsEmptyTrashEnabled();
      case "cmd_compactFolder":
        return IsCompactFolderEnabled();
      case "cmd_setFolderCharset":
        return IsFolderCharsetEnabled();
      case "cmd_close":
        return true;
      case "cmd_downloadFlagged":
        return !Services.io.offline;
      case "cmd_downloadSelected":
        return IsFolderSelected() && !Services.io.offline &&
               GetNumSelectedMessages() > 0;
      case "cmd_synchronizeOffline":
        return !Services.io.offline;
      case "cmd_settingsOffline":
        return IsAccountOfflineEnabled();
      default:
        return false;
    }
    return false;
  },

  doCommand: function(command)
  {
    // if the user invoked a key short cut then it is possible that we got here for a command which is
    // really disabled. kick out if the command should be disabled.
    if (!this.isCommandEnabled(command))
      return;

    switch (command)
    {
      case "cmd_close":
        MsgCloseCurrentTab();
        break;
      case "button_getNewMessages":
			case "cmd_getNewMessages":
				MsgGetMessage();
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
			case "cmd_replyList":
				MsgReplyList(null);
				break;
			case "cmd_replyGroup":
				MsgReplyGroup(null);
				break;
			case "cmd_replySender":
				MsgReplySender(null);
				break;
			case "cmd_replyall":
				MsgReplyToAllMessage(null);
				break;
      case "cmd_replySenderAndGroup":
        MsgReplyToSenderAndGroup(null);
        break;
      case "cmd_replyAllRecipients":
        MsgReplyToAllRecipients(null);
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
      case "cmd_createFilterFromMenu":
        MsgCreateFilter();
        break;   
      case "cmd_createFilterFromPopup":
        CreateFilter(document.popupNode);
        break;
      case "cmd_delete":
      case "button_delete":
        MsgDeleteMessage(false);
        UpdateDeleteToolbarButton(false);
        break;
      case "cmd_shiftDelete":
      case "button_shiftDelete":
        MsgDeleteMessage(true);
        UpdateDeleteToolbarButton(false);
        break;
      case "cmd_cancel":
        let message = gFolderDisplay.selectedMessage;
        message.folder.QueryInterface(Components.interfaces.nsIMsgNewsFolder)
                      .cancelMessage(message, msgWindow);
        break;
      case "cmd_killThread":
        /* kill thread kills the thread and then does a next unread */
      	GoNextMessage(nsMsgNavigationType.toggleThreadKilled, true);
        break;
      case "cmd_killSubthread":
        GoNextMessage(nsMsgNavigationType.toggleSubthreadKilled, true);
        break;
      case "cmd_watchThread":
        gDBView.doCommand(nsMsgViewCommandType.toggleThreadWatched);
        break;
      case "button_next":
			case "cmd_nextUnreadMsg":
				MsgNextUnreadMessage();
				break;
			case "cmd_nextUnreadThread":
				MsgNextUnreadThread();
				break;
			case "cmd_nextMsg":
				MsgNextMessage();
				break;
			case "cmd_nextFlaggedMsg":
				MsgNextFlaggedMessage();
				break;
			case "cmd_previousMsg":
				MsgPreviousMessage();
				break;
			case "cmd_previousUnreadMsg":
				MsgPreviousUnreadMessage();
				break;
			case "cmd_previousFlaggedMsg":
				MsgPreviousFlaggedMessage();
				break;
      case "button_goBack":
      case "cmd_goBack":
        MsgGoBack();
        break;
       case "button_goForward":
       case "cmd_goForward":
        MsgGoForward();
        break;
      case "cmd_goStartPage":
        HideMessageHeaderPane();
        loadStartPage();
        break;
			case "cmd_viewAllMsgs":
      case "cmd_viewThreadsWithUnread":
      case "cmd_viewWatchedThreadsWithUnread":
			case "cmd_viewUnreadMsgs":
      case "cmd_viewIgnoredThreads":
				SwitchView(command);
				break;
			case "cmd_undo":
				messenger.undo(msgWindow);
				break;
			case "cmd_redo":
				messenger.redo(msgWindow);
				break;
			case "cmd_expandAllThreads":
                gDBView.doCommand(nsMsgViewCommandType.expandAll);
				break;
			case "cmd_collapseAllThreads":
                gDBView.doCommand(nsMsgViewCommandType.collapseAll);
				break;
			case "cmd_renameFolder":
				MsgRenameFolder();
				return;
			case "cmd_sendUnsentMsgs":
				MsgSendUnsentMsgs();
				return;
			case "cmd_openMessage":
                MsgOpenSelectedMessages();
				return;
            case "cmd_printSetup":
                PrintUtils.showPageSetup();
                return;
			case "cmd_print":
				PrintEnginePrint();
				return;
			case "cmd_printpreview":
				PrintEnginePrintPreview();
				return;
			case "cmd_saveAsFile":
				MsgSaveAsFile();
				return;
			case "cmd_saveAsTemplate":
				MsgSaveAsTemplate();
				return;
			case "cmd_viewPageSource":
				MsgViewPageSource();
				return;
			case "cmd_setFolderCharset":
				MsgFolderProperties();
				return;
			case "cmd_reload":
				ReloadMessage();
				return;
			case "cmd_find":
				MsgFind();
				return;
      case "cmd_findNext":
				MsgFindAgain(false);
				return;
			case "cmd_findPrev":
				MsgFindAgain(true);
				return;
      case "cmd_properties":
        MsgFolderProperties();
        return;
      case "button_search":
      case "cmd_search":
        MsgSearchMessages();
        return;
      case "button_mark":
			case "cmd_markAsRead":
				MsgMarkMsgAsRead(null);
				return;
			case "cmd_markThreadAsRead":
				MsgMarkThreadAsRead();
				return;
			case "cmd_markAllRead":
        gDBView.doCommand(nsMsgViewCommandType.markAllRead);
				return;
			case "cmd_markReadByDate":
        MsgMarkReadByDate();
        return;
      case "button_junk":
        MsgJunk();
        return;
      case "cmd_stop":
        MsgStop();
        return;
			case "cmd_markAsFlagged":
				MsgMarkAsFlagged(null);
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
      case "cmd_markAsShowRemote":
        LoadMsgWithRemoteContent();
        return;
      case "cmd_markAsNotPhish":
        MsgIsNotAScam();
        return;
      case "cmd_displayMsgFilters":
        MsgFilters(null, null);
        return;
      case "cmd_applyFiltersToSelection":
        MsgApplyFiltersToSelection();
        return;
      case "cmd_applyFilters":
        MsgApplyFilters(null);
        return;
      case "cmd_runJunkControls":
        filterFolderForJunk();
        return;
      case "cmd_deleteJunk":
        deleteJunkInFolder();
        return;
			case "cmd_emptyTrash":
				MsgEmptyTrash();
				return;
			case "cmd_compactFolder":
				MsgCompactFolder(true);
				return;
            case "cmd_downloadFlagged":
                MsgDownloadFlagged();
                break;
            case "cmd_downloadSelected":
                MsgDownloadSelected();
                break;
            case "cmd_synchronizeOffline":
                MsgSynchronizeOffline();
                break;
            case "cmd_settingsOffline":
                MsgSettingsOffline();
                break;
            case "cmd_selectAll":
                // move the focus so the user can delete the newly selected messages, not the folder
                SetFocusThreadPane();
                // if in threaded mode, the view will expand all before selecting all
                gDBView.doCommand(nsMsgViewCommandType.selectAll)
                if (gDBView.numSelected != 1) {
                    setTitleFromFolder(gDBView.msgFolder,null);
                    ClearMessagePane();
                }
                break;
            case "cmd_selectThread":
                gDBView.doCommand(nsMsgViewCommandType.selectThread);
                break;
      case "cmd_selectFlagged":
        gDBView.doCommand(nsMsgViewCommandType.selectFlagged);
        break;
		}
	},
	
	onEvent: function(event)
	{
		// on blur events set the menu item texts back to the normal values
		if ( event == 'blur' )
        {
            goSetMenuValue('cmd_undo', 'valueDefault');
            goSetMenuValue('cmd_redo', 'valueDefault');
        }
	}
};

function GetNumSelectedMessages()
{
    try {
        return gDBView.numSelected;
    }
    catch (ex) {
        return 0;
    }
}

var gLastFocusedElement=null;

function FocusRingUpdate_Mail()
{
  // WhichPaneHasFocus() uses on top.document.commandDispatcher.focusedElement
  // to determine which pane has focus
  // if the focusedElement is null, we're here on a blur.
  // nsFocusController::Blur() calls nsFocusController::SetFocusedElement(null), 
  // which will update any commands listening for "focus".
  // we really only care about nsFocusController::Focus() happens, 
  // which calls nsFocusController::SetFocusedElement(element)
  var currentFocusedElement = WhichPaneHasFocus();
      
	if (currentFocusedElement != gLastFocusedElement) {
    if (currentFocusedElement)
      currentFocusedElement.setAttribute("focusring", "true");
    
    if (gLastFocusedElement)
      gLastFocusedElement.removeAttribute("focusring");

    gLastFocusedElement = currentFocusedElement;

    // since we just changed the pane with focus we need to update the toolbar to reflect this
    // XXX TODO
    // can we optimize
    // and just update cmd_delete and button_delete?
    UpdateMailToolbar("focus");
  }
}

function WhichPaneHasFocus()
{
  var threadTree = GetThreadTree();
  var folderTree = GetFolderTree();
  var messagePane = GetMessagePane();
    
  if (top.document.commandDispatcher.focusedWindow == GetMessagePaneFrame())
    return messagePane;

	var currentNode = top.document.commandDispatcher.focusedElement;	
	while (currentNode) {
    if (currentNode === threadTree ||
        currentNode === folderTree ||
        currentNode === messagePane)
      return currentNode;
    			
		currentNode = currentNode.parentNode;
  }
	
	return null;
}

function SetupCommandUpdateHandlers()
{
  // folder pane
  var widget = GetFolderTree();
  if (widget)
    widget.controllers.appendController(FolderPaneController);
}

// Called from <msgMail3PaneWindow.js>.
function UnloadCommandUpdateHandlers()
{
  var widget = GetFolderTree();
  if (widget)
    widget.controllers.removeController(FolderPaneController);
}

function IsSendUnsentMsgsEnabled(folderResource)
{
  var msgSendLater =
    Components.classes["@mozilla.org/messengercompose/sendlater;1"]
              .getService(Components.interfaces.nsIMsgSendLater);

  // If we're currently sending unsent msgs, disable this cmd.
  if (msgSendLater.sendingMessages)
    return false;

  if (folderResource &&
      folderResource instanceof Components.interfaces.nsIMsgFolder) {
    // If unsentMsgsFolder is non-null, it is the "Outbox" folder.
    // We're here because we've done a right click on the "Outbox"
    // folder (context menu), so we can use the folder and return true/false
    // straight away.
    return folderResource.getTotalMessages(false) > 0;
  }

  // Otherwise, we don't know where we are, so use the current identity and
  // find out if we have messages or not via that.
  let identity = null;
  let folders = GetSelectedMsgFolders();
  if (folders.length > 0)
    identity = getIdentityForServer(folders[0].server);

  if (!identity)
    identity = Components.classes["@mozilla.org/messenger/account-manager;1"]
                         .getService(Components.interfaces.nsIMsgAccountManager)
                         .defaultAccount.defaultIdentity;

  return msgSendLater.hasUnsentMessages(identity);
}

function IsRenameFolderEnabled()
{
  let folders = GetSelectedMsgFolders();
  return folders.length == 1 && folders[0].canRename &&
         isCommandEnabled("cmd_renameFolder");
}

function IsCanSearchMessagesEnabled()
{
  var folderURI = GetSelectedFolderURI();
  if (!folderURI)
    return false;

  var folder = GetMsgFolderFromUri(folderURI, false);
  return folder.server.canSearchMessages &&
         !(folder.flags & Components.interfaces.nsMsgFolderFlags.Virtual);
}

function IsFolderCharsetEnabled()
{
  return IsFolderSelected();
}

function IsPropertiesEnabled(command)
{
  let folders = GetSelectedMsgFolders();
  if (!folders.length)
    return false;

  let folder = folders[0];
  // When servers are selected, it should be "Edit | Properties...".
  goSetMenuValue(command,
                 folder.isServer ? "valueGeneric" :
                   isNewsURI(folder.URI) ? "valueNewsgroup" : "valueFolder");

  return folders.length == 1;
}

function IsViewNavigationItemEnabled()
{
  return IsFolderSelected();
}

function IsFolderSelected()
{
  let folders = GetSelectedMsgFolders();
  return folders.length == 1 && !folders[0].isServer;
}

function IsMessageDisplayedInMessagePane()
{
  return (!IsMessagePaneCollapsed() && (GetNumSelectedMessages() > 0));
}

function MsgDeleteFolder()
{
    const NS_MSG_ERROR_COPY_FOLDER_ABORTED = 0x8055001a;
    var folderTree = GetFolderTree();
    var selectedFolders = GetSelectedMsgFolders();
    var prompt = Services.prompt;
    for (var i = 0; i < selectedFolders.length; i++)
    {
        var selectedFolder = selectedFolders[i];
        let specialFolder = getSpecialFolderString(selectedFolder);
        if (specialFolder != "Inbox" && specialFolder != "Trash")
        {
            var folder = selectedFolder.QueryInterface(Components.interfaces.nsIMsgFolder);
            if (folder.flags & Components.interfaces.nsMsgFolderFlags.Virtual)
            {
                var confirmation = gMessengerBundle.getString("confirmSavedSearchDeleteMessage");
                var title = gMessengerBundle.getString("confirmSavedSearchDeleteTitle");
                var buttonTitle = gMessengerBundle.getString("confirmSavedSearchDeleteButton");
                var buttonFlags = prompt.BUTTON_TITLE_IS_STRING * prompt.BUTTON_POS_0 +
                                  prompt.BUTTON_TITLE_CANCEL * prompt.BUTTON_POS_1;
                if (prompt.confirmEx(window, title, confirmation, buttonFlags, buttonTitle,
                                     "", "", "", {}) != 0) /* the yes button is in position 0 */
                    continue;
                if (gCurrentVirtualFolderUri == selectedFolder.URI)
                  gCurrentVirtualFolderUri = null;
                var array = Components.classes["@mozilla.org/array;1"]
                                      .createInstance(Components.interfaces.nsIMutableArray);
                array.appendElement(folder, false);
                folder.parent.deleteSubFolders(array, msgWindow);
                continue;
            }

            if (isNewsURI(selectedFolder.URI))
            {
                var unsubscribe = ConfirmUnsubscribe(selectedFolder);
                if (unsubscribe)
                    UnSubscribe(selectedFolder);
            }
            else if (specialFolder == "Junk" ?
                     CanRenameDeleteJunkMail(folder.URI) : folder.deletable)
            {
                // We can delete this folder.

                var array = Components.classes["@mozilla.org/array;1"]
                                      .createInstance(Components.interfaces.nsIMutableArray);
                array.appendElement(selectedFolder, false);
                try
                {
                    selectedFolder.parent.deleteSubFolders(array, msgWindow);
                }
                // Ignore known errors from canceled warning dialogs.
                catch (ex if (ex.result == NS_MSG_ERROR_COPY_FOLDER_ABORTED)) {}
            }
        }
    }
}

function SetFocusThreadPaneIfNotOnMessagePane()
{
  var focusedElement = WhichPaneHasFocus();

  if((focusedElement != GetThreadTree()) &&
     (focusedElement != GetMessagePane()))
     SetFocusThreadPane();
}

// 3pane related commands.  Need to go in own file.  Putting here for the moment.
function MsgNextMessage()
{
	GoNextMessage(nsMsgNavigationType.nextMessage, false );
}

function MsgNextUnreadMessage()
{
	GoNextMessage(nsMsgNavigationType.nextUnreadMessage, true);
}
function MsgNextFlaggedMessage()
{
	GoNextMessage(nsMsgNavigationType.nextFlagged, true);
}

function MsgNextUnreadThread()
{
  GoNextMessage(nsMsgNavigationType.nextUnreadThread, true);
}

function MsgPreviousMessage()
{
    GoNextMessage(nsMsgNavigationType.previousMessage, false);
}

function MsgPreviousUnreadMessage()
{
	GoNextMessage(nsMsgNavigationType.previousUnreadMessage, true);
}

function MsgPreviousFlaggedMessage()
{
	GoNextMessage(nsMsgNavigationType.previousFlagged, true);
}

function MsgGoBack()
{
  GoNextMessage(nsMsgNavigationType.back, true);
}

function MsgGoForward()
{
  GoNextMessage(nsMsgNavigationType.forward, true);
}

function SwitchPaneFocus(event)
{
  var folderTree = GetFolderTree();
  var threadTree = GetThreadTree();
  var messagePane = GetMessagePane();

  // Although internally this is actually a four-pane window, it is presented as
  // a three-pane -- the search pane is more of a toolbar.  So, shift among the
  // three main panes.

  var focusedElement = WhichPaneHasFocus();
  if (focusedElement == null)       // focus not on one of the main three panes?
    focusedElement = threadTree;    // treat as if on thread tree

  if (event && event.shiftKey)
  {
    // Reverse traversal: Message -> Thread -> Folder -> Message
    if (focusedElement == threadTree && !IsFolderPaneCollapsed())
      folderTree.focus();
    else if (focusedElement != messagePane && !IsMessagePaneCollapsed())
      SetFocusMessagePane();
    else
      threadTree.focus();
  }
  else
  {
    // Forward traversal: Folder -> Thread -> Message -> Folder
    if (focusedElement == threadTree && !IsMessagePaneCollapsed())
      SetFocusMessagePane();
    else if (focusedElement != folderTree && !IsFolderPaneCollapsed())
      folderTree.focus();
    else
      threadTree.focus();
  }
}

function SetFocusThreadPane()
{
    var threadTree = GetThreadTree();
    threadTree.focus();
}

function SetFocusMessagePane()
{
    // XXX hack: to clear the focus on the previous element first focus
    // on the message pane element then focus on the main content window
    GetMessagePane().focus();
    GetMessagePaneFrame().focus();
}

function isCommandEnabled(cmd)
{
  var selectedFolders = GetSelectedMsgFolders();
  var numFolders = selectedFolders.length;
  if(numFolders !=1)
    return false;

  var folder = selectedFolders[0];
  if (!folder)
    return false;
  else
    return folder.isCommandEnabled(cmd);

}

//
// This function checks if the configured junk mail can be renamed or deleted.
//
function CanRenameDeleteJunkMail(aFolderUri)
{
  if (!aFolderUri)
    return false;

  // Go through junk mail settings for all servers and see if the folder is set/used by anyone.
  try
  {
    var allServers = accountManager.allServers;

    for (var i = 0; i < allServers.length; i++)
    {
      var currentServer =
        allServers.queryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
      var settings = currentServer.spamSettings;
      // If junk mail control or move junk mail to folder option is disabled then
      // allow the folder to be removed/renamed since the folder is not used in this case.
      if (!settings.level || !settings.moveOnSpam)
        continue;
      if (settings.spamFolderURI == aFolderUri)
        return false;
    }
  }
  catch(ex)
  {
      dump("Can't get all servers\n");
  }
  return true;
}
