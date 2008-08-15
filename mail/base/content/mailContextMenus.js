# -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
#
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2000
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Jan Varga <varga@nixcorp.com>
#   Hakan Waara <hwaara@chello.se>
#   Markus Hossner <markushossner@gmx.de>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

//NOTE: gMessengerBundle must be defined and set or this Overlay won't work

const mailtolength = 7;

// Function to change the highlighted row back to the row that is currently
// outline/dotted without loading the contents of either rows.  This is
// triggered when the context menu for a given row is hidden/closed
// (onpopuphiding).
function RestoreSelectionWithoutContentLoad(tree)
{
    // If a delete or move command had been issued, then we should
    // reset gRightMouseButtonDown and gThreadPaneDeleteOrMoveOccurred
    // and return (see bug 142065).
    if(gThreadPaneDeleteOrMoveOccurred)
    {
      gRightMouseButtonDown = false;
      gThreadPaneDeleteOrMoveOccurred = false;
      return;
    }

    var treeSelection = tree.view.selection;

    // make sure that currentIndex is valid so that we don't try to restore
    // a selection of an invalid row.
    if((!treeSelection.isSelected(treeSelection.currentIndex)) &&
       (treeSelection.currentIndex >= 0))
    {
        treeSelection.selectEventsSuppressed = true;
        treeSelection.select(treeSelection.currentIndex);
        treeSelection.selectEventsSuppressed = false;

        // Keep track of which row in the thread pane is currently selected.
        // This is currently only needed when deleting messages.  See
        // declaration of var in msgMail3PaneWindow.js.
        if(tree.id == "threadTree")
          gThreadPaneCurrentSelectedIndex = treeSelection.currentIndex;
    }
    else if(treeSelection.currentIndex < 0)
        // Clear the selection in the case of when a folder has just been
        // loaded where the message pane does not have a message loaded yet.
        // When right-clicking a message in this case and dismissing the
        // popup menu (by either executing a menu command or clicking
        // somewhere else),  the selection needs to be cleared.
        // However, if the 'Delete Message' or 'Move To' menu item has been
        // selected, DO NOT clear the selection, else it will prevent the
        // tree view from refreshing.
        treeSelection.clearSelection();

    // Need to reset gRightMouseButtonDown to false here because
    // TreeOnMouseDown() is only called on a mousedown, not on a key down.
    // So resetting it here allows the loading of messages in the messagepane
    // when navigating via the keyboard or the toolbar buttons *after*
    // the context menu has been dismissed.
    gRightMouseButtonDown = false;
}

function threadPaneOnPopupHiding()
{
  RestoreSelectionWithoutContentLoad(GetThreadTree());
}

function fillThreadPaneContextMenu()
{
  var numSelected = GetNumSelectedMessages();

  var isNewsgroup = false;
  var selectedMessage = null;

  // Clear the global var used to keep track if a 'Delete Message' or 'Move
  // To' command has been triggered via the thread pane context menu.
  gThreadPaneDeleteOrMoveOccurred = false;

  if(numSelected >= 0) {
    selectedMessage = GetFirstSelectedMessage();
    isNewsgroup = IsNewsMessage(selectedMessage);
  }

  SetupNewMessageWindowMenuItem("threadPaneContext-openNewWindow", numSelected, false);
  SetupEditAsNewMenuItem("threadPaneContext-editAsNew", numSelected, false);

  ShowMenuItem("threadPaneContext-sep-open", (numSelected <= 1));

  SetupReplyToSenderMenuItem("threadPaneContext-replySender", numSelected, false);
  SetupReplyToNewsgroupMenuItem("threadPaneContext-replyNewsgroup", numSelected, isNewsgroup, false);
  SetupReplyAllMenuItem("threadPaneContext-replyAll", numSelected, false);
  SetupForwardMenuItem("threadPaneContext-forward", numSelected, false);
  SetupForwardAsAttachmentMenuItem("threadPaneContext-forwardAsAttachment", numSelected, false);

  ShowMenuItem("threadPaneContext-sep-reply", true);

  SetupCopyMessageUrlMenuItem("threadPaneContext-copyMessageUrl", numSelected, isNewsgroup, numSelected != 1); 
  SetupCopyMenuItem("threadPaneContext-copyMenu", numSelected, false);
  SetupMoveMenuItem("threadPaneContext-moveMenu", numSelected, isNewsgroup, false);
  SetupMoveToFolderAgainMenuItem("threadPaneContext-moveToFolderAgain", numSelected, false);
    
  EnableMenuItem("threadPaneContext-labels", (numSelected >= 1));
  EnableMenuItem("threadPaneContext-mark", (numSelected >= 1));
  SetupSaveAsMenuItem("threadPaneContext-saveAs", numSelected, false);
#ifdef XP_MACOSX
  SetupPrintPreviewMenuItem("threadPaneContext-printpreview", numSelected, true);
#else
  SetupPrintPreviewMenuItem("threadPaneContext-printpreview", numSelected, false);
#endif
  SetupPrintMenuItem("threadPaneContext-print", numSelected, false);
  SetupDeleteMenuItem("threadPaneContext-delete", numSelected, false);
  SetupAddSenderToABMenuItem("threadPaneContext-addSenderToAddressBook", numSelected, false);
  SetupAddAllToABMenuItem("threadPaneContext-addAllToAddressBook", numSelected, false);

  ShowMenuItem("threadPaneContext-sep-edit", (numSelected <= 1));

  EnableMenuItem('downloadSelected', GetNumSelectedMessages() > 0);

  return(true);
}

function SetupNewMessageWindowMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupEditAsNewMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1)&& !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupReplyToSenderMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1)&& !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupReplyToNewsgroupMenuItem(menuID, numSelected, isNewsgroup, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && isNewsgroup && !forceHide);
  EnableMenuItem(menuID,  (numSelected == 1));
}

function SetupReplyAllMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupForwardMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID,  (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected > 0));
}

function SetupForwardAsAttachmentMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID,  (numSelected > 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected > 1));
}

function SetupMoveMenuItem(menuID, numSelected, isNewsgroup, forceHide)
{
  ShowMenuItem(menuID, !isNewsgroup && !forceHide);

  var msgFolder = GetLoadedMsgFolder();
  // disable move if we can't delete message(s) from this folder
  var enableMenuItem = (numSelected > 0) && msgFolder && msgFolder.canDeleteMessages;
  EnableMenuItem(menuID, enableMenuItem);
}

function SetupCopyMessageUrlMenuItem(menuID, numSelected, isNewsgroup, forceHide)
{
  ShowMenuItem(menuID, isNewsgroup && !forceHide);
  EnableMenuItem(menuID, (numSelected > 0));
}

function SetupCopyMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, !forceHide);
  EnableMenuItem(menuID, (numSelected > 0));
}

function SetupMoveToFolderAgainMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, !forceHide);
  if (!forceHide)
    initMoveToFolderAgainMenu(document.getElementById(menuID));
}

function SetupLabelsMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupTagMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupMarkMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupSaveAsMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupPrintPreviewMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, (numSelected == 1));
}

function SetupPrintMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, !forceHide);
  EnableMenuItem(menuID, (numSelected > 0));
}

function SetupAddSenderToABMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, false);
}

function SetupAddAllToABMenuItem(menuID, numSelected, forceHide)
{
  ShowMenuItem(menuID, (numSelected <= 1) && !forceHide);
  EnableMenuItem(menuID, false);
}

function SetupDeleteMenuItem(menuID, numSelected, forceHide)
{
  // This function is needed for the case where a folder is just loaded (while
  // there isn't a message loaded in the message pane), a right-click is done
  // in the thread pane.  This function will disable enable the 'Delete
  // Message' menu item.
  ShowMenuItem(menuID, !forceHide);
  EnableMenuItem(menuID, (numSelected > 0));
  goUpdateCommand('cmd_delete');
}

// show the message id in the context menu
function FillMessageIdContextMenu(messageIdNode)
{
  if (messageIdNode)
  {
    document.getElementById("messageIdContext-messageIdTarget")
            .setAttribute("label", messageIdNode.getAttribute("messageid"));
  }
}

function CopyMessageId(messageId)
{
   var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                             .getService(Components.interfaces.nsIClipboardHelper);

   clipboard.copyString(messageId);
}

function GetMessageIdFromNode(messageIdNode, cleanMessageId)
{
  var messageId  = messageIdNode.getAttribute("messageid");

  // remove < and >
  if (cleanMessageId)
    messageId = messageId.substring(1, messageId.length - 1);

  return messageId;
}

// take the message id from the messageIdNode and use the
// url defined in the hidden pref "mailnews.messageid_browser.url"
// to open it in a browser window (%mid is replaced by the message id)
function OpenBrowserWithMessageId(messageId)
{
  var browserURL = pref.getComplexValue("mailnews.messageid_browser.url",
                                        Components.interfaces.nsIPrefLocalizedString).data;

  browserURL = browserURL.replace(/%mid/, messageId);
  try
  {
    messenger.launchExternalURL(browserURL);
  }
  catch (ex)
  {
    dump("Failed to open message-id in browser!");
  }
}

// take the message id from the messageIdNode, search for the
// corresponding message in all folders starting with the current
// selected folder, then the current account followed by the other
// accounts and open corresponding message if found
function OpenMessageForMessageId(messageId)
{
  var startServer = msgWindow.openFolder.server;
  var messageHeader;

  window.setCursor("wait");

  // first search in current folder for message id
  var messageHeader = CheckForMessageIdInFolder(msgWindow.openFolder, messageId);

  // if message id not found in current folder search in all folders
  if (!messageHeader)
  {
    var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                   .getService(Components.interfaces.nsIMsgAccountManager);
    var allServers = accountManager.allServers;

    messageHeader = SearchForMessageIdInSubFolder(startServer.rootFolder, messageId);

    for (var i = 0; i < allServers.Count() && !messageHeader; i++)
    {
      var currentServer = allServers.GetElementAt(i);
      if ((currentServer instanceof Components.interfaces.nsIMsgIncomingServer) &&
          startServer != currentServer && currentServer.canSearchMessages &&
          !currentServer.isDeferredTo)
      {
        messageHeader = SearchForMessageIdInSubFolder(currentServer.rootFolder, messageId);
      }
    }
  }
  window.setCursor("auto");

  // if message id was found open corresponding message
  // else show error message
  if (messageHeader)
    OpenMessageByHeader(messageHeader, pref.getBoolPref("mailnews.messageid.openInNewWindow"));
  else
  {
    var messageIdStr = "<" + messageId + ">";
    var errorTitle   = gMessengerBundle.getString("errorOpenMessageForMessageIdTitle");
    var errorMessage = gMessengerBundle.getFormattedString("errorOpenMessageForMessageIdMessage",
                                                           [messageIdStr]);
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);

    promptService.alert(window, errorTitle, errorMessage);
  }
}

function OpenMessageByHeader(messageHeader, openInNewWindow)
{
  var folder    = messageHeader.folder;
  var folderURI = folder.URI;

  if (openInNewWindow)
  {
    var messageURI = folder.getUriForMsg(messageHeader);

    window.openDialog("chrome://messenger/content/messageWindow.xul",
                      "_blank", "all,chrome,dialog=no,status,toolbar",
                      messageURI, folderURI, null);
  }
  else
  {
    if (msgWindow.openFolder != folderURI)
      SelectFolder(folderURI);

    var tree = null;
    var wintype = document.documentElement.getAttribute('windowtype');
    if (wintype != "mail:messageWindow")
    {
      tree = GetThreadTree();
      tree.view.selection.clearSelection();
    }

    try
    {
      gDBView.selectMsgByKey(messageHeader.messageKey);
    }
    catch(e)
    { // message not in the thread pane
      try
      {
        goDoCommand("cmd_viewAllMsgs");
        gDBView.selectMsgByKey(messageHeader.messageKey);
      }
      catch(e)
      {
         dump("select messagekey " + messageHeader.messageKey +
              " failed in folder " + folder.URI);
      }
    }

    if (tree && tree.currentIndex != -1)
      tree.treeBoxObject.ensureRowIsVisible(tree.currentIndex);
  }
}

// search for message by message id in given folder and its subfolders
// return message header if message was found
function SearchForMessageIdInSubFolder(folder, messageId)
{
  var messageHeader;
  var subFolders = folder.subFolders;

  // search in folder
  if (!folder.isServer)
    messageHeader = CheckForMessageIdInFolder(folder, messageId);

  // search subfolders recursively
  while (subFolders.hasMoreElements() && !messageHeader)
  {
    // search in current folder
    var currentFolder =
      subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
    messageHeader = CheckForMessageIdInFolder(currentFolder, messageId);

    // search in its subfolder
    if (!messageHeader && currentFolder.hasSubFolders)
      messageHeader = SearchForMessageIdInSubFolder(currentFolder, messageId);
  }

  return messageHeader;
}

// check folder for corresponding message to given message id
// return message header if message was found
function CheckForMessageIdInFolder(folder, messageId)
{
  var messageDatabase = folder.getMsgDatabase(msgWindow);
  var messageHeader;

  try
  {
    messageHeader = messageDatabase.getMsgHdrForMessageID(messageId);
  }
  catch (ex)
  {
    dump("Failed to find message-id in folder!");
  }

  if (!gMailSession)
  {
    gMailSession = Components.classes[mailSessionContractID]
                             .getService(Components.interfaces.nsIMsgMailSession);
  }

  if (!gMailSession.IsFolderOpenInWindow(folder) &&
      !(folder.flags & (MSG_FOLDER_FLAG_TRASH | MSG_FOLDER_FLAG_INBOX)))
  {
    folder.setMsgDatabase(null);
  }

  return messageHeader;
}

function folderPaneOnPopupHiding()
{
  RestoreSelectionWithoutContentLoad(GetFolderTree());
}

function fillFolderPaneContextMenu()
{
  var folders = GetSelectedMsgFolders();
  if (!folders.length)
    return false;

  var numSelected = folders.length;
  var folder = folders[0];
  var isVirtualFolder = folder ? folder.flags & MSG_FOLDER_FLAG_VIRTUAL : false;

  var isServer = folder.isServer;
  var serverType = folder.server.type;
  var specialFolder = getSpecialFolderString(folder);
  var canSubscribeToFolder = (serverType == "nntp") || (serverType == "imap");
  var isNewsgroup = !isServer && serverType == 'nntp';
  var isMailFolder = !isServer && serverType != 'nntp';
  var canGetMessages = (isServer && serverType != "none") || isNewsgroup || (serverType == "rss");

  EnableMenuItem("folderPaneContext-properties", true);

  ShowMenuItem("folderPaneContext-getMessages", (numSelected <= 1) && canGetMessages);
  EnableMenuItem("folderPaneContext-getMessages", true);

  SetupNewMenuItem(folder, numSelected, isServer, serverType, specialFolder);
  SetupRenameMenuItem(folder, numSelected, isServer, serverType, specialFolder);
  SetupRemoveMenuItem(folder, numSelected, isServer, serverType, specialFolder);
  SetupCompactMenuItem(folder, numSelected);
  SetupFavoritesMenuItem(folder, numSelected, isServer, 'folderPaneContext-favoriteFolder');

  ShowMenuItem("folderPaneContext-emptyTrash", (numSelected <= 1) && (specialFolder == 'Trash'));
  EnableMenuItem("folderPaneContext-emptyTrash", true);
  ShowMenuItem("folderPaneContext-emptyJunk", (numSelected <= 1) && (specialFolder == 'Junk'));
  EnableMenuItem("folderPaneContext-emptyJunk", true);

  var showSendUnsentMessages = (numSelected <= 1) && (specialFolder == 'Unsent Messages');
  ShowMenuItem("folderPaneContext-sendUnsentMessages", showSendUnsentMessages);
  if (showSendUnsentMessages) 
    EnableMenuItem("folderPaneContext-sendUnsentMessages", IsSendUnsentMsgsEnabled(folder));

  ShowMenuItem("folderPaneContext-subscribe", (numSelected <= 1) && canSubscribeToFolder && !isVirtualFolder);
  EnableMenuItem("folderPaneContext-subscribe", !isVirtualFolder);

  // XXX: Hack for RSS servers...
  ShowMenuItem("folderPaneContext-rssSubscribe", (numSelected <= 1) && (serverType == "rss"));
  EnableMenuItem("folderPaneContext-rssSubscribe", true);

  // News folder context menu =============================================
  ShowMenuItem("folderPaneContext-newsUnsubscribe", (numSelected <= 1) && canSubscribeToFolder && isNewsgroup);
  EnableMenuItem("folderPaneContext-newsUnsubscribe", true);
  ShowMenuItem("folderPaneContext-markNewsgroupAllRead", (numSelected <= 1) && isNewsgroup);
  EnableMenuItem("folderPaneContext-markNewsgroupAllRead", true);
  // End of News folder context menu =======================================

  ShowMenuItem("folderPaneContext-markMailFolderAllRead", (numSelected <= 1) && isMailFolder && !isVirtualFolder);
  EnableMenuItem("folderPaneContext-markMailFolderAllRead", !isVirtualFolder);

  ShowMenuItem("folderPaneContext-searchMessages", (numSelected<=1) && !isVirtualFolder);
  goUpdateCommand('cmd_search');

  // Hide / Show our menu separators based on the menu items we are showing.
  ShowMenuItem("folderPaneContext-sep1", (numSelected <= 1) && !isServer);
  ShowMenuItem('folderPaneContext-sep2', shouldShowSeparator('folderPaneContext-sep2')); 
  ShowMenuItem("folderPaneContext-sep3", shouldShowSeparator('folderPaneContext-sep3')); // we always show the separator before properties menu item
  return(true);
}

function SetupNewMenuItem(folder, numSelected, isServer, serverType, specialFolder)
{
  var canCreateNew = folder.canCreateSubfolders;
  var isInbox = specialFolder == "Inbox";
  var isIMAPFolder = (folder.server.type == "imap");

  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService);

  var showNew = ((numSelected <=1) && (serverType != 'nntp') && canCreateNew) || isInbox;
  ShowMenuItem("folderPaneContext-new", showNew);

  EnableMenuItem("folderPaneContext-new", !isIMAPFolder || MailOfflineMgr.isOnline());

  if (showNew)
  {
    if (isServer || isInbox)
      SetMenuItemLabel("folderPaneContext-new", gMessengerBundle.getString("newFolder"));
    else
      SetMenuItemLabel("folderPaneContext-new", gMessengerBundle.getString("newSubfolder"));
  }
}

function SetupRenameMenuItem(msgFolder, numSelected, isServer, serverType, specialFolder)
{
  var isSpecialFolder = !(specialFolder == "none" || (specialFolder == "Junk" && CanRenameDeleteJunkMail(msgFolder.URI))
                                                  || (specialFolder == "Virtual") );
  var canRename = msgFolder.canRename;
  ShowMenuItem("folderPaneContext-rename", (numSelected <= 1) && !isServer && !isSpecialFolder && canRename);

  EnableMenuItem("folderPaneContext-rename", !isServer && msgFolder.isCommandEnabled("cmd_renameFolder"));
}

function SetupRemoveMenuItem(msgFolder, numSelected, isServer, serverType, specialFolder)
{
  var isMail = serverType != 'nntp';
  var isSpecialFolder = !(specialFolder == "none" || (specialFolder == "Junk" && CanRenameDeleteJunkMail(msgFolder.URI))
                                                  || (specialFolder == "Virtual") );
  //Can't currently delete Accounts or special folders.
  var showRemove = (numSelected <=1) && (isMail && !isSpecialFolder) && !isServer;

  ShowMenuItem("folderPaneContext-remove", showRemove);
  if(showRemove)
  {
    EnableMenuItem("folderPaneContext-remove", msgFolder.isCommandEnabled("cmd_delete"));
  }
}

function SetupCompactMenuItem(folder, numSelected)
{
  ShowMenuItem("folderPaneContext-compact", (numSelected <=1) && folder.canCompact && !(folder.flags & MSG_FOLDER_FLAG_VIRTUAL));
  EnableMenuItem("folderPaneContext-compact", folder.isCommandEnabled("cmd_compactFolder") && !(folder.flags & MSG_FOLDER_FLAG_VIRTUAL));
}

function SetupFavoritesMenuItem(folder, numSelected, isServer, menuItemId)
{
  var showItem = !isServer && (numSelected <=1);
  ShowMenuItem(menuItemId, showItem); 

  // adjust the checked state on the menu
  if (showItem)
    document.getElementById(menuItemId).setAttribute('checked',folder.getFlag(MSG_FOLDER_FLAG_FAVORITE));
}

function ShowMenuItem(id, showItem)
{
  var item = document.getElementById(id);
  if(item && item.hidden != "true") 
    item.hidden = !showItem;
}

function EnableMenuItem(id, enableItem)
{
  var item = document.getElementById(id);
  if(item)
  {
    var enabled = (item.getAttribute('disabled') !='true');
    if(enableItem != enabled)
    {
      item.setAttribute('disabled', enableItem ? '' : 'true');
    }
  }
}

function SetMenuItemLabel(id, label)
{
  var item = document.getElementById(id);
  if(item)
    item.setAttribute('label', label);
}

function SetMenuItemAccessKey(id, accessKey)
{
  var item = document.getElementById(id);
  if(item)
    item.setAttribute('accesskey', accessKey);
}

function fillMessagePaneContextMenu()
{
  var message = GetLoadedMessage();
  var numSelected = (message) ? 1 : 0;

  var isNewsgroup = false;

  if (numSelected == 1)
    isNewsgroup = IsNewsMessage(message);

  // don't show mail items for links/images, just show related items.
  var hideMailItems = gContextMenu.onImage || gContextMenu.onLink;

  SetupEditAsNewMenuItem("messagePaneContext-editAsNew", numSelected, (numSelected == 0 || hideMailItems));
  SetupReplyToSenderMenuItem("messagePaneContext-replySender", numSelected, (numSelected == 0 || hideMailItems));
  SetupReplyToNewsgroupMenuItem("messagePaneContext-replyNewsgroup", numSelected, isNewsgroup, (numSelected == 0 || hideMailItems));
  SetupReplyAllMenuItem("messagePaneContext-replyAll" , numSelected, (numSelected == 0 || hideMailItems));
  SetupForwardMenuItem("messagePaneContext-forward", numSelected, (numSelected == 0 || hideMailItems));
  SetupCopyMessageUrlMenuItem("messagePaneContext-copyMessageUrl", numSelected, isNewsgroup, (numSelected == 0 || hideMailItems)); 
  SetupCopyMenuItem("messagePaneContext-copyMenu", numSelected, (numSelected == 0 || hideMailItems));
  SetupMoveMenuItem("messagePaneContext-moveMenu", numSelected, isNewsgroup, (numSelected == 0 || hideMailItems));
  SetupMoveToFolderAgainMenuItem("messagePaneContext-moveToFolderAgain", numSelected, (numSelected == 0 || hideMailItems));
  SetupLabelsMenuItem("messagePaneContext-labels", numSelected, (numSelected == 0 || hideMailItems));
  SetupMarkMenuItem("messagePaneContext-mark", numSelected, (numSelected == 0 || hideMailItems));
  SetupTagMenuItem("messagePaneContext-tags", numSelected, (numSelected == 0 || hideMailItems));
  SetupSaveAsMenuItem("messagePaneContext-saveAs", numSelected, (numSelected == 0 || hideMailItems));
#ifdef XP_MACOSX
  SetupPrintPreviewMenuItem("messagePaneContext-printpreview", numSelected, true);
#else
  SetupPrintPreviewMenuItem("messagePaneContext-printpreview", numSelected, (numSelected == 0 || hideMailItems));
#endif

  SetupPrintMenuItem("messagePaneContext-print", numSelected, (numSelected == 0 || hideMailItems));
  if (numSelected == 0 || hideMailItems)
    ShowMenuItem("messagePaneContext-delete", false)
  else {
    goUpdateCommand('cmd_delete');
    ShowMenuItem("messagePaneContext-delete", true)
  }
  SetupAddSenderToABMenuItem("messagePaneContext-addSenderToAddressBook", numSelected, (numSelected == 0 || hideMailItems));
  SetupAddAllToABMenuItem("messagePaneContext-addAllToAddressBook", numSelected, (numSelected == 0 || hideMailItems));

  ShowMenuItem("messagePaneContext-addemail", gContextMenu.onMailtoLink );
  ShowMenuItem("messagePaneContext-composeemailto", gContextMenu.onMailtoLink );
  
  ShowMenuItem("messagePaneContext-reportPhishingURL", gContextMenu.onLink && !gContextMenu.onMailtoLink);
  
  // if we are on an image, go ahead and show this separator
  //if (gContextMenu.onLink && !gContextMenu.onMailtoLink)
//    ShowMenuItem("messagePaneContext-sep-edit", false);

  //Figure out separators
  ShowMenuItem("messagePaneContext-sep-link", shouldShowSeparator("messagePaneContext-sep-link"));
  ShowMenuItem("messagePaneContext-sep-open", shouldShowSeparator("messagePaneContext-sep-open"));
  ShowMenuItem("messagePaneContext-sep-reply", shouldShowSeparator("messagePaneContext-sep-reply"));
  ShowMenuItem("messagePaneContext-sep-tags-1", shouldShowSeparator("messagePaneContext-sep-tags-1"));
  ShowMenuItem("messagePaneContext-sep-saveAs", shouldShowSeparator("messagePaneContext-sep-saveAs"));
  ShowMenuItem("messagePaneContext-sep-edit", shouldShowSeparator("messagePaneContext-sep-edit"));
  ShowMenuItem("messagePaneContext-sep-copy", shouldShowSeparator("messagePaneContext-sep-copy"));
  ShowMenuItem("messagePaneContext-sep-reportPhishing", shouldShowSeparator("messagePaneContext-sep-reportPhishing"));
}

// Determines whether or not the separator with the specified ID should be 
// shown or not by determining if there are any non-hidden items between it
// and the previous separator. You should start with the first separator in the menu.
function shouldShowSeparator(aSeparatorID)
{
  var separator = document.getElementById(aSeparatorID);
  if (separator) 
  {
    var sibling = separator.previousSibling;
    while (sibling)
    {
      if (sibling.getAttribute("hidden") != "true")
        return sibling.localName != "menuseparator" && hasAVisibleNextSibling(separator);
      sibling = sibling.previousSibling;
    }
  }
  return false;  
}

// helper function used by shouldShowSeparator
function hasAVisibleNextSibling(aNode)
{
  var sibling = aNode.nextSibling;
  while (sibling)
  {
    if (sibling.getAttribute("hidden") != "true" 
        && sibling.localName != "menuseparator")
      return true;
    sibling = sibling.nextSibling;
  }
  return false;
}

function IsMenuItemShowing(menuID)
{
  var item = document.getElementById(menuID);
  if (item)
    return item.hidden != "true";
  return false;
}

// message pane context menu helper methods
function addEmail()
{
  var url = gContextMenu.linkURL;
  var addresses = getEmail(url);
  window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                    "",
                     "chrome,resizable=no,titlebar,modal,centerscreen",
                    {primaryEmail: addresses});
}

function composeEmailTo ()
{
  var url = gContextMenu.linkURL;
  var addresses = getEmail(url);
  var fields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
  var params = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
  fields.to = addresses;
  params.type = Components.interfaces.nsIMsgCompType.New;
  params.format = Components.interfaces.nsIMsgCompFormat.Default;
  params.identity = accountManager.getFirstIdentityForServer(GetLoadedMsgFolder().server);
  params.composeFields = fields;
  msgComposeService.OpenComposeWindowWithParams(null, params);
}

// Extracts email address from url string
function getEmail (url) 
{
  var qmark = url.indexOf( "?" );
  var addresses;

  if ( qmark > mailtolength ) 
      addresses = url.substring( mailtolength, qmark );
  else 
     addresses = url.substr( mailtolength );
  // Let's try to unescape it using a character set
  try {
    var characterSet = gContextMenu.target.ownerDocument.characterSet;
    const textToSubURI = Components.classes["@mozilla.org/intl/texttosuburi;1"]
                                 .getService(Components.interfaces.nsITextToSubURI);
    addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
  }
  catch(ex) {
    // Do nothing.
  }
  return addresses;
}

function CopyMessageUrl()
{
  try {
    var hdr = gDBView.hdrForFirstSelectedMessage;
    var server = hdr.folder.server;

    var url;
    if (server.isSecure) {
      url = "snews://";
    }
    else {
      url = "news://"
    }
    url += server.hostName;
    url += ":";
    url += server.port;
    url += "/";
    url += hdr.messageId;

    var contractid = "@mozilla.org/widget/clipboardhelper;1";
    var iid = Components.interfaces.nsIClipboardHelper;
    var clipboard = Components.classes[contractid].getService(iid);
    clipboard.copyString(url);
  }
  catch (ex) {
    dump("ex="+ex+"\n");
  }
}
