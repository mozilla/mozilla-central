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
 * Portions created by the Initial Developer are Copyright (C) 1998-2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jan Varga <varga@nixcorp.com>
 *   Håkan Waara <hwaara@gmail.com>
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
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

var gMessengerBundle = document.getElementById("bundle_messenger");

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
        // Even if the folder pane has focus, don't do a folder delete if
        // we have a selected message, but do a message delete instead.
        // Return false here supportsCommand and let the command fall back
        // to the DefaultController.
        if (GetNumSelectedMessages() != 0)
          return false;
        // else fall through
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
      {
        // Make sure the button doesn't show "Undelete" for folders.
        UpdateDeleteToolbarButton();
        let folders = gFolderTreeView.getSelectedFolders();
        if (folders.length) {
          // XXX Figure out some better way/place to update the folder labels.
          UpdateDeleteLabelsFromFolderCommand(folders[0], command);
          return CanDeleteFolder(folders[0]) && folders[0].isCommandEnabled(command);
        }
        else
          return false;
      }
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
      case "cmd_deleteFolder":
        gFolderTreeController.deleteFolder();
        break;
    }
  },

  onEvent: function(event)
  {
  }
};

function UpdateDeleteLabelsFromFolderCommand(folder, command)
{
  if (command != "cmd_delete")
    return;

  if (folder.server.type == "nntp") {
    goSetMenuValue(command, "valueNewsgroup");
    goSetAccessKey(command, "valueNewsgroupAccessKey");
  }
  else {
    goSetMenuValue(command, "valueFolder");
  }
}

// DefaultController object (handles commands when one of the trees does not have focus)
var DefaultController =
{
  supportsCommand: function(command)
  {
    switch ( command )
    {
      case "cmd_createFilterFromPopup":
      case "cmd_archive":
      case "button_archive":
      case "cmd_reply":
      case "button_reply":
      case "cmd_replySender":
      case "cmd_replyGroup":
      case "cmd_replyall":
      case "button_replyall":
      case "cmd_replylist":
      case "button_replylist":
      case "cmd_forward":
      case "button_forward":
      case "cmd_forwardInline":
      case "cmd_forwardAttachment":
      case "cmd_editAsNew":
      case "cmd_createFilterFromMenu":
      case "cmd_delete":
      case "cmd_deleteFolder":
      case "button_delete":
      case "button_junk":
      case "cmd_shiftDelete":
      case "cmd_nextMsg":
      case "button_next":
      case "button_previous":
      case "cmd_nextUnreadMsg":
      case "cmd_nextFlaggedMsg":
      case "cmd_nextUnreadThread":
      case "cmd_previousMsg":
      case "cmd_previousUnreadMsg":
      case "cmd_previousFlaggedMsg":
      case "button_goForward":
      case "button_goBack":
      case "cmd_goForward":
      case "cmd_goBack":
      case "cmd_goStartPage":
      case "cmd_viewClassicMailLayout":
      case "cmd_viewWideMailLayout":
      case "cmd_viewVerticalMailLayout":
      case "cmd_toggleMessagePane":
      case "cmd_viewAllMsgs":
      case "cmd_viewUnreadMsgs":
      case "cmd_viewThreadsWithUnread":
      case "cmd_viewWatchedThreadsWithUnread":
      case "cmd_viewIgnoredThreads":
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
      case "cmd_findAgain":
      case "cmd_findPrevious":
      case "cmd_search":
      case "button_mark":
      case "cmd_tag":
      case "cmd_markAsRead":
      case "cmd_markAllRead":
      case "cmd_markThreadAsRead":
      case "cmd_markReadByDate":
      case "cmd_markAsFlagged":
      case "cmd_markAsJunk":
      case "cmd_markAsNotJunk":
      case "cmd_recalculateJunkScore":
      case "cmd_displayMsgFilters":
      case "cmd_applyFiltersToSelection":
      case "cmd_applyFilters":
      case "cmd_runJunkControls":
      case "cmd_deleteJunk":
      case "button_file":
      case "cmd_file":
      case "cmd_emptyTrash":
      case "cmd_compactFolder":
      case "button_compact":
      case "cmd_settingsOffline":
      case "cmd_selectAll":
      case "cmd_selectThread":
      case "cmd_moveToFolderAgain":
      case "cmd_selectFlagged":
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
      case "cmd_viewAllHeader":
      case "cmd_viewNormalHeader":
      case "cmd_stop":
        return true;
      case "cmd_downloadFlagged":
      case "cmd_downloadSelected":
      case "cmd_synchronizeOffline":
        return MailOfflineMgr.isOnline();

      case "cmd_watchThread":
      case "cmd_killThread":
      case "cmd_killSubthread":
        return(gFolderDisplay.selectedMessageIsNews);

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
        UpdateDeleteToolbarButton();
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.deleteMsg);
      case "cmd_shiftDelete":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.deleteNoTrash);
      case "cmd_deleteFolder":
        var folders = gFolderTreeView.getSelectedFolders();
        if (folders.length == 1) {
          var folder = folders[0];
          if (folder.server.type == "nntp")
            return false; // Just disable the command for news.
          else
            return CanDeleteFolder(folder);
        }
        return false;
      case "button_junk":
        UpdateJunkToolbarButton();
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.junk);
      case "cmd_killThread":
      case "cmd_killSubthread":
        return GetNumSelectedMessages() > 0;
      case "cmd_watchThread":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.toggleThreadWatched);
      case "cmd_createFilterFromPopup":
      case "cmd_createFilterFromMenu":
      {
        let selectedMessages = gFolderDisplay.selectedMessages;
        return selectedMessages.length == 1 && selectedMessages[0].folder &&
               selectedMessages[0].folder.server.canHaveFilters;
      }
      case "cmd_saveAsFile":
      case "cmd_saveAsTemplate":
        if (GetNumSelectedMessages() > 1)
          return false;   // else fall thru
      case "cmd_reply":
      case "button_reply":
      case "cmd_replySender":
      case "cmd_replyGroup":
      case "cmd_replyall":
      case "button_replyall":
      case "cmd_replylist":
      case "button_replylist":
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
        let numSelected = GetNumSelectedMessages();
        if (command == "cmd_applyFiltersToSelection")
        {
          var whichText = "valueMessage";
          if (numSelected > 1)
            whichText = "valueSelection";
          goSetMenuValue(command, whichText);
          goSetAccessKey(command, whichText + "AccessKey");
        }
        if (numSelected > 0)
        {
          if (!gFolderDisplay.getCommandStatus(nsMsgViewCommandType.cmdRequiringMsgBody))
            return false;

          // Check if we have a collapsed thread selected and are summarizing it.
          // If so, selectedIndices.length won't match numSelected. Also check
          // that we're not displaying a message, which handles the case
          // where we failed to summarize the selection and fell back to
          // displaying a message.
          if (gFolderDisplay.selectedIndices.length != numSelected &&
              command != "cmd_applyFiltersToSelection" &&
              gDBView && gDBView.currentlyDisplayedMessage == nsMsgViewIndex_None)
            return false;
          if (command == "cmd_reply" || command == "button_reply" ||
              command == "cmd_replyall" ||command == "button_replyall")
            return IsReplyEnabled();
          if (command == "cmd_replylist" || command == "button_replylist")
            return IsReplyListEnabled();
          return true;
        }
        return false;
      case "cmd_printpreview":
        if (GetNumSelectedMessages() == 1)
          return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.cmdRequiringMsgBody);
        return false;
      case "cmd_printSetup":
      case "cmd_viewAllHeader":
      case "cmd_viewNormalHeader":
        return true;
      case "cmd_markAsFlagged":
      case "button_file":
      case "cmd_file":
      case "cmd_archive":
        return (gFolderDisplay.selectedCount > 0 );
      case "button_archive":
        return gFolderDisplay.selectedCount > 0 && gFolderDisplay.displayedFolder &&
          !gFolderDisplay.displayedFolder.isSpecialFolder(
             Components.interfaces.nsMsgFolderFlags.Archive, true);
      case "cmd_markAsJunk":
      case "cmd_markAsNotJunk":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.junk);
      case "cmd_recalculateJunkScore":
        // We're going to take a conservative position here, because we really
        // don't want people running junk controls on folders that are not
        // enabled for junk. The junk type picks up possible dummy message headers,
        // while the runJunkControls will prevent running on XF virtual folders.
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.junk) &&
               gFolderDisplay.getCommandStatus(nsMsgViewCommandType.runJunkControls);
      case "cmd_displayMsgFilters":
        let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                            .getService(Components.interfaces.nsIMsgAccountManager);
        return mgr.accounts.Count() > 0;
      case "cmd_applyFilters":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.applyFilters);
      case "cmd_runJunkControls":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.runJunkControls);
      case "cmd_deleteJunk":
        return gFolderDisplay.getCommandStatus(nsMsgViewCommandType.deleteJunk);
      case "button_mark":
      case "cmd_tag":
      case "cmd_markAsRead":
      case "cmd_markThreadAsRead":
        return GetNumSelectedMessages() > 0;
      case "button_previous":
      case "button_next":
        return IsViewNavigationItemEnabled();
      case "cmd_nextMsg":
      case "cmd_nextUnreadMsg":
      case "cmd_nextUnreadThread":
      case "cmd_previousMsg":
      case "cmd_previousUnreadMsg":
        return IsViewNavigationItemEnabled();
      case "button_goForward":
      case "button_goBack":
      case "cmd_goForward":
      case "cmd_goBack":
        if (gDBView)
          enabled.value = gDBView.navigateStatus((command == "cmd_goBack" || command == "button_goBack") ? nsMsgNavigationType.back : nsMsgNavigationType.forward);
        return enabled.value;
      case "cmd_goStartPage":
        return document.getElementById("tabmail").selectedTab.mode.name == "folder" &&
               !IsMessagePaneCollapsed();
      case "cmd_markAllRead":
      case "cmd_markReadByDate":
        return IsFolderSelected();
      case "cmd_find":
      case "cmd_findAgain":
      case "cmd_findPrevious":
        // If we are a message tab, then we've got a message displayed, so
        // always allow searching in the message
        if (document.getElementById("tabmail").selectedTab.mode.name == "message")
          return true;

        // Otherwise, only allow searching if we're showing the message pane
        // and have more than one message selected.
        return (!IsMessagePaneCollapsed() && (GetNumSelectedMessages() == 1));
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
        return gFolderDisplay.view.showThreaded;
      case "cmd_nextFlaggedMsg":
      case "cmd_previousFlaggedMsg":
        return IsViewNavigationItemEnabled();
      case "cmd_viewClassicMailLayout":
      case "cmd_viewWideMailLayout":
      case "cmd_viewVerticalMailLayout":
      case "cmd_toggleMessagePane":
        // this is overridden per-mail tab
        return true;
      case "cmd_viewAllMsgs":
      case "cmd_viewIgnoredThreads":
        return gDBView;
      case "cmd_viewUnreadMsgs":
      case "cmd_viewThreadsWithUnread":
      case "cmd_viewWatchedThreadsWithUnread":
        return !gFolderDisplay.view.isVirtual;
      case "cmd_stop":
        return window.MsgStatusFeedback._meteorsSpinning;
      case "cmd_undo":
      case "cmd_redo":
          return SetupUndoRedoCommand(command);
      case "cmd_renameFolder":
      {
        let folders = gFolderTreeView.getSelectedFolders();
        return folders.length == 1 && folders[0].canRename &&
               folders[0].isCommandEnabled("cmd_renameFolder");
      }
      case "cmd_sendUnsentMsgs":
        return IsSendUnsentMsgsEnabled(null);
      case "cmd_properties":
        return IsPropertiesEnabled(command);
      case "button_getNewMessages":
      case "cmd_getNewMessages":
      case "cmd_getMsgsForAuthAccounts":
        // GetMsgs should always be enabled, see bugs 89404 and 111102.
        return true;
      case "cmd_getNextNMessages":
        return IsGetNextNMessagesEnabled();
      case "cmd_emptyTrash":
      {
        let folder = GetSelectedMsgFolders()[0];
        return folder && folder.server.canEmptyTrashOnExit ?
                         IsMailFolderSelected() : false;
      }
      case "button_compact":
      {
        let folders = gFolderTreeView.getSelectedFolders();
        function canCompact(folder) {
          return !folder.isServer &&
            !(folder.flags & Components.interfaces.nsMsgFolderFlags.Virtual) &&
            (folder.server.type != "imap" || folder.server.canCompactFoldersOnServer) &&
            folder.isCommandEnabled("button_compact");
        }
        return folders && folders.every(canCompact);
      }
      case "cmd_compactFolder":
      {
        let folders = gFolderTreeView.getSelectedFolders();
        function canCompactAll(folder) {
          return (folder.server.type != "imap" ||
                  folder.server.canCompactFoldersOnServer) &&
                  folder.isCommandEnabled("cmd_compactFolder") ;
        }
        return folders && folders.every(canCompactAll);
      }
      case "cmd_setFolderCharset":
        return IsFolderCharsetEnabled();
      case "cmd_downloadFlagged":
        return(IsFolderSelected() && MailOfflineMgr.isOnline());
      case "cmd_downloadSelected":
        return (IsFolderSelected() && MailOfflineMgr.isOnline() && GetNumSelectedMessages() > 0);
      case "cmd_synchronizeOffline":
        return MailOfflineMgr.isOnline();
      case "cmd_settingsOffline":
        return IsAccountOfflineEnabled();
      case "cmd_moveToFolderAgain":
        // Disable "Move to <folder> Again" for news and other read only
        // folders since we can't really move messages from there - only copy.
        if (pref.getBoolPref("mail.last_msg_movecopy_was_move"))
        {
          let loadedFolder = gFolderTreeView.getSelectedFolders()[0];
          if (loadedFolder && !loadedFolder.canDeleteMessages)
            return false;
        }
        return pref.getCharPref("mail.last_msg_movecopy_target_uri") &&
               GetNumSelectedMessages() > 0;
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
        // If we are a message tab, then we've got a message displayed, so
        // always allow zooming in the message
        if (document.getElementById("tabmail").selectedTab.mode.name == "message")
          return true;

        return IsFolderSelected() && !IsMessagePaneCollapsed();
      default:
        return false;
    }
    return false;
  },

  doCommand: function(command, aTab)
  {
    // if the user invoked a key short cut then it is possible that we got here for a command which is
    // really disabled. kick out if the command should be disabled.
    if (!this.isCommandEnabled(command)) return;

    switch ( command )
    {
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
      case "cmd_createFilterFromMenu":
        MsgCreateFilter();
        break;
      case "cmd_createFilterFromPopup":
        break;// This does nothing because the createfilter is invoked from the popupnode oncommand.
      case "button_delete":
      case "cmd_delete":
         // if the user deletes a message before its mark as read timer goes off, we should mark it as read
         // this ensures that we clear the biff indicator from the system tray when the user deletes the new message
        MarkSelectedMessagesRead(true);
        // If this is a right-click triggered delete, then do not hint about
        //  the deletion.  Note: The code that swaps the selection back in will
        //  take care of ensuring that this deletion does not make the saved
        //  selection incorrect.
        if (!gRightMouseButtonSavedSelection)
          gFolderDisplay.hintAboutToDeleteMessages();
        gFolderDisplay.doCommand(nsMsgViewCommandType.deleteMsg);
        break;
      case "cmd_shiftDelete":
        MarkSelectedMessagesRead(true);
        gFolderDisplay.hintAboutToDeleteMessages();
        gFolderDisplay.doCommand(nsMsgViewCommandType.deleteNoTrash);
        break;
      case "cmd_deleteFolder":
        gFolderTreeController.deleteFolder();
        break;
      case "cmd_killThread":
        /* kill thread kills the thread and then does a next unread */
        GoNextMessage(nsMsgNavigationType.toggleThreadKilled, true);
        break;
      case "cmd_killSubthread":
        GoNextMessage(nsMsgNavigationType.toggleSubthreadKilled, true);
        break;
      case "cmd_watchThread":
        gFolderDisplay.doCommand(nsMsgViewCommandType.toggleThreadWatched);
        break;
      case "button_next":
      case "cmd_nextUnreadMsg":
        GoNextMessage(nsMsgNavigationType.nextUnreadMessage, true);
        break;
      case "cmd_nextUnreadThread":
        GoNextMessage(nsMsgNavigationType.nextUnreadThread, true);
        break;
      case "cmd_nextMsg":
        GoNextMessage(nsMsgNavigationType.nextMessage, false);
        break;
      case "cmd_nextFlaggedMsg":
        GoNextMessage(nsMsgNavigationType.nextFlagged, true);
        break;
      case "cmd_previousMsg":
        GoNextMessage(nsMsgNavigationType.previousMessage, false);
        break;
      case "button_previous":
      case "cmd_previousUnreadMsg":
        GoNextMessage(nsMsgNavigationType.previousUnreadMessage, true);
        break;
      case "cmd_previousFlaggedMsg":
        GoNextMessage(nsMsgNavigationType.previousFlagged, true);
        break;
      case "button_goForward":
      case "cmd_goForward":
        GoNextMessage(nsMsgNavigationType.forward, true);
        break;
      case "button_goBack":
      case "cmd_goBack":
        GoNextMessage(nsMsgNavigationType.back, true);
        break;
      case "cmd_goStartPage":
        HideMessageHeaderPane();
        loadStartPage(true);
        break;
      case "cmd_viewClassicMailLayout":
      case "cmd_viewWideMailLayout":
      case "cmd_viewVerticalMailLayout":
        ChangeMailLayoutForCommand(command);
        break;
      case "cmd_toggleMessagePane":
        MsgToggleMessagePane();
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
        gFolderDisplay.doCommand(nsMsgViewCommandType.expandAll);
        gFolderDisplay.ensureSelectionIsVisible();
        break;
      case "cmd_collapseAllThreads":
        gFolderDisplay.selectSelectedThreadRoots();
        gFolderDisplay.doCommand(nsMsgViewCommandType.collapseAll);
        gFolderDisplay.ensureSelectionIsVisible();
        break;
      case "cmd_renameFolder":
        gFolderTreeController.renameFolder();
        return;
      case "cmd_sendUnsentMsgs":
        // if offline, prompt for sendUnsentMessages
        if (MailOfflineMgr.isOnline())
          SendUnsentMessages();
        else
          MailOfflineMgr.goOnlineToSendMessages(msgWindow);
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
        ViewPageSource(gFolderDisplay.selectedMessageUris);
        return;
      case "cmd_setFolderCharset":
        gFolderTreeController.editFolder();
        return;
      case "cmd_reload":
        ReloadMessage();
        return;
      case "cmd_find":
        // Make sure the message pane has focus before we start a find since we
        // only support searching within the message body.
        SetFocusMessagePane();
        document.getElementById("FindToolbar").onFindCommand();
        return;
      case "cmd_findAgain":
        // Make sure the message pane has focus before we start a find since we
        // only support searching within the message body.
        SetFocusMessagePane();
        document.getElementById("FindToolbar").onFindAgainCommand(false);
        return;
      case "cmd_findPrevious":
        // Make sure the message pane has focus before we start a find since we
        // only support searching within the message body.
        SetFocusMessagePane();
        document.getElementById("FindToolbar").onFindAgainCommand(true);
        return;
      case "cmd_markReadByDate":
        MsgMarkReadByDate();
        return;
      case "cmd_properties":
        gFolderTreeController.editFolder();
        return;
      case "cmd_search":
        MsgSearchMessages();
        return;
      case "button_mark":
      case "cmd_markAsRead":
        MsgMarkMsgAsRead();
        return;
      case "cmd_markThreadAsRead":
        ClearPendingReadTimer();
        gFolderDisplay.doCommand(nsMsgViewCommandType.markThreadRead);
        return;
      case "cmd_markAllRead":
        gFolderDisplay.doCommand(nsMsgViewCommandType.markAllRead);
        return;
      case "button_junk":
        MsgJunk();
        return;
      case "cmd_stop":
        msgWindow.StopUrls();
        return;
      case "cmd_markAsFlagged":
        MsgMarkAsFlagged();
        return;
      case "cmd_viewAllHeader":
        MsgViewAllHeaders();
        return;
      case "cmd_viewNormalHeader":
        MsgViewNormalHeaders();
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
        gFolderTreeController.emptyTrash();
        return;
      case "cmd_compactFolder":
        gFolderTreeController.compactAllFoldersForAccount();
        return;
      case "button_compact":
        gFolderTreeController.compactFolders();
        return;
      case "cmd_downloadFlagged":
          gFolderDisplay.doCommand(nsMsgViewCommandType.downloadFlaggedForOffline);
          break;
      case "cmd_downloadSelected":
          gFolderDisplay.doCommand(nsMsgViewCommandType.downloadSelectedForOffline);
          break;
      case "cmd_synchronizeOffline":
          MsgSynchronizeOffline();
          break;
      case "cmd_settingsOffline":
          MailOfflineMgr.openOfflineAccountSettings();
          break;
      case "cmd_moveToFolderAgain":
          var folderId = pref.getCharPref("mail.last_msg_movecopy_target_uri");
          if (pref.getBoolPref("mail.last_msg_movecopy_was_move"))
            MsgMoveMessage(GetMsgFolderFromUri(folderId));
          else
            MsgCopyMessage(GetMsgFolderFromUri(folderId));
          break;
      case "cmd_selectAll":
        // XXX If the message pane is selected but the tab focused, this ends
        // closing the message tab. See bug 502834.
        if (aTab.mode.name == "message")
          break;

        // move the focus so the user can delete the newly selected messages, not the folder
        SetFocusThreadPane();
        // if in threaded mode, the view will expand all before selecting all
        gFolderDisplay.doCommand(nsMsgViewCommandType.selectAll);
        break;
      case "cmd_selectThread":
          gFolderDisplay.doCommand(nsMsgViewCommandType.selectThread);
          break;
      case "cmd_selectFlagged":
        gFolderDisplay.doCommand(nsMsgViewCommandType.selectFlagged);
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
    // on blur events set the menu item texts back to the normal values
    if ( event == 'blur' )
    {
      goSetMenuValue('cmd_undo', 'valueDefault');
      goSetMenuValue('cmd_redo', 'valueDefault');
    }
  }
};

function CloseTabOrWindow()
{
  let tabmail = document.getElementById('tabmail');
  if (tabmail.tabInfo.length == 1) {
    if (pref.getBoolPref("mail.tabs.closeWindowWithLastTab"))
      window.close();
  }
  else {
    tabmail.removeCurrentTab();
  }
}

function GetNumSelectedMessages()
{
  return gDBView ? gDBView.numSelected : 0;
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
  if (top.document.commandDispatcher.focusedWindow == GetMessagePaneFrame())
    return GetMessagePane();

  var currentNode = top.document.commandDispatcher.focusedElement;
  while (currentNode) {
    if (currentNode === document.getElementById('threadTree') ||
        currentNode === document.getElementById("folderTree") ||
        currentNode === document.getElementById("messagepanebox"))
      return currentNode;

    currentNode = currentNode.parentNode;
  }
  return null;
}

function RestoreFocusAfterHdrButton()
{
  // I would love to really restore the focus to the pane that had
  // focus before the user clicked on the hdr button, and gLastFocusedElement
  // would almost do that, except that clicking on the hdr button sets
  // gLastFocusedElement to the message pane. What I need is
  // gPenultimateFocusedElement.
  SetFocusThreadPane();
}

function SetupCommandUpdateHandlers()
{
  // folder pane
  var widget = document.getElementById("folderTree");
  if ( widget )
    widget.controllers.appendController(FolderPaneController);
}

function UnloadCommandUpdateHandlers()
{
}

function IsSendUnsentMsgsEnabled(unsentMsgsFolder)
{
  var msgSendlater =
    Components.classes["@mozilla.org/messengercompose/sendlater;1"]
              .getService(Components.interfaces.nsIMsgSendLater);

  // If we're currently sending unsent msgs, disable this cmd.
  if (msgSendlater.sendingMessages)
    return false;

  if (unsentMsgsFolder) {
    // If unsentMsgsFolder is non-null, it is the "Unsent Messages" folder.
    // We're here because we've done a right click on the "Unsent Messages"
    // folder (context menu), so we can use the folder and return true/false
    // straight away.
    return unsentMsgsFolder.getTotalMessages(false) > 0;
  }

  // Otherwise, we don't know where we are, so use the current identity and
  // find out if we have messages or not via that.
  let identity;
  let folders = GetSelectedMsgFolders();
  if (folders.length > 0)
    identity = getIdentityForServer(folders[0].server);

  if (!identity)
    identity = Components.classes["@mozilla.org/messenger/account-manager;1"]
                         .getService(Components.interfaces.nsIMsgAccountManager)
                         .defaultAccount.defaultIdentity;

  return msgSendlater.hasUnsentMessages(identity);
}

function IsCanSearchMessagesEnabled()
{
  var folder = GetSelectedMsgFolders()[0];
  if (!folder)
    return false;
  return folder.server.canSearchMessages;
}
function IsFolderCharsetEnabled()
{
  return IsFolderSelected();
}

function IsPropertiesEnabled(command)
{
  var folders = GetSelectedMsgFolders();
  if (!folders.length)
    return false;
  var folder = folders[0];

  // when servers are selected it should be "Edit | Properties..."
  if (folder.isServer)
    goSetMenuValue(command, "valueGeneric");
  else
    goSetMenuValue(command, isNewsURI(folder.URI) ? "valueNewsgroup" : "valueFolder");

   return (folders.length == 1);
}

function IsViewNavigationItemEnabled()
{
  return IsFolderSelected();
}

function IsFolderSelected()
{
  var folders = GetSelectedMsgFolders();
  return folders.length == 1 && !folders[0].isServer;
}

function SetFocusThreadPaneIfNotOnMessagePane()
{
  var focusedElement = WhichPaneHasFocus();

  if((focusedElement != GetThreadTree()) &&
     (focusedElement != GetMessagePane()))
     SetFocusThreadPane();
}

// 3pane related commands.  Need to go in own file.  Putting here for the moment.
function SwitchPaneFocus(event)
{
  var folderTree = document.getElementById("folderTree");
  var threadTree = GetThreadTree();
  var messagePane = GetMessagePane();

  var folderPaneCollapsed = document.getElementById("folderPaneBox").collapsed;

  var focusedElement = WhichPaneHasFocus();
  if (focusedElement == null)       // focus not on one of the main three panes (probably toolbar)
    focusedElement = threadTree;    // treat as if on thread tree

  if (event && event.shiftKey)
  {
    // Reverse traversal: Message -> Thread -> Folder -> Message
    if (focusedElement == threadTree && !folderPaneCollapsed)
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
    else if (focusedElement != folderTree && !folderPaneCollapsed)
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
  // Calling .focus() on content doesn't blur the previously focused chrome
  // element, so we shift focus to the XUL pane first, to not leave another
  // pane looking like it has focus.
  GetMessagePane().focus();
  GetMessagePaneFrame().focus();
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

    for (var i=0;i<allServers.Count();i++)
    {
      var currentServer = allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
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

/** Check if this is a folder the user is allowed to delete. */
function CanDeleteFolder(folder)
{
  if (folder.isServer)
    return false;

  var specialFolder = getSpecialFolderString(folder);

  if (specialFolder == "Inbox" || specialFolder == "Trash" ||
      specialFolder == "Drafts" || specialFolder == "Sent" ||
      specialFolder == "Templates" || specialFolder == "Outbox" ||
      (specialFolder == "Junk" && !CanRenameDeleteJunkMail(folder.URI)))
    return false;

  return true;
}
