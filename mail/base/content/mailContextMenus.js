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

/**
 * Function to change the highlighted row back to the row that is currently
 * outline/dotted without loading the contents of either rows. This is
 * triggered when the context menu for a given row is hidden/closed
 * (onpopuphiding).
 * @param tree the tree element to restore selection for
 */
function RestoreSelectionWithoutContentLoad(tree)
{
    if (!tree)
      return;

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

function fillMailContextMenu(event)
{
  var inThreadPane = false;
  var node = document.popupNode;
  while (node) {
    if (node.id == "threadTree") {
      inThreadPane = true;
      break;
    }
    node = node.parentNode;
  }

  gContextMenu = new nsContextMenu(event.target);
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

  // Don't show mail items for links/images, just show related items.
  var hideMailItems = !inThreadPane &&
                      (gContextMenu.onImage || gContextMenu.onLink);
  var single = (numSelected == 1);

  // Select-all and copy are only available in the message-pane
  if (inThreadPane) {
    document.getElementById("mailContext-selectall").hidden = true;
    document.getElementById("mailContext-copy").hidden = true;
  }

  // Show the Open in New Window  and New Tab options if there is exactly one
  // message selected.
  ShowMenuItem("mailContext-openNewWindow", single && inThreadPane);
  ShowMenuItem("threadPaneContext-openNewTab", single && inThreadPane);

  /**
   * Most menu items are visible if there's 1 or 0 messages selected, and
   * enabled if there's exactly one selected. Handle those here.
   * @param aID   the id of the element to display/enable
   * @param aHide (optional)  an additional criteria to evaluate when we
   *              decide whether to display the element. If false, we'll hide
   *              the item no matter what messages are selected
   */
 function setSingleSelection(aID, aHide) {
    var hide = aHide != undefined ? aHide : true;
    ShowMenuItem(aID, single && !hideMailItems && hide);
    EnableMenuItem(aID, single);
  }

  setSingleSelection("mailContext-replySender");
  setSingleSelection("mailContext-editAsNew");
  setSingleSelection("mailContext-replyNewsgroup", isNewsgroup);
  setSingleSelection("mailContext-replyAll");
  setSingleSelection("mailContext-forward");
  ShowMenuItem("mailContext-forwardAsAttachment",
               numSelected > 1 && inThreadPane && !hideMailItems);

  setSingleSelection("mailContext-copyMessageUrl", isNewsgroup);

  ShowMenuItem("mailContext-sep-open", (numSelected <= 1));

  ShowMenuItem("mailContext-sep-reply", true);

  var msgFolder = GetLoadedMsgFolder();

  // Set up the move menu. We can't move from newsgroups.
  ShowMenuItem("mailContext-moveMenu",
               !isNewsgroup && !hideMailItems && numSelected && msgFolder);

  // disable move if we can't delete message(s) from this folder
  var canMove = (numSelected > 0) && msgFolder && msgFolder.canDeleteMessages;
  EnableMenuItem("mailContext-moveMenu", canMove);

  // Copy is available as long as something is selected.
  ShowMenuItem("mailContext-copyMenu", numSelected && !hideMailItems && msgFolder);
  EnableMenuItem("mailContext-copyMenu", numSelected);

  ShowMenuItem("mailContext-moveToFolderAgain",
               numSelected && !hideMailItems && msgFolder);
  if (numSelected && !hideMailItems) {
    initMoveToFolderAgainMenu(document.getElementById("mailContext-moveToFolderAgain"));
    goUpdateCommand("cmd_moveToFolderAgain");
  }

  ShowMenuItem("paneContext-afterMove", !inThreadPane);

  ShowMenuItem("mailContext-tags", !hideMailItems && msgFolder);

  ShowMenuItem("mailContext-mark", !hideMailItems && msgFolder);
  EnableMenuItem("mailContext-mark", (numSelected >= 1));

  setSingleSelection("mailContext-saveAs");
#ifdef XP_MACOSX
  ShowMenuItem("mailContext-printpreview", false);
#else
  setSingleSelection("mailContext-printpreview");
#endif

  ShowMenuItem("mailContext-print", !hideMailItems);
  EnableMenuItem("mailContext-print", numSelected);

  ShowMenuItem("mailContext-delete", !hideMailItems && (isNewsgroup || canMove));
  // This function is needed for the case where a folder is just loaded (while
  // there isn't a message loaded in the message pane), a right-click is done
  // in the thread pane.  This function will disable enable the 'Delete
  // Message' menu item.
  goUpdateCommand('cmd_delete');

  setSingleSelection("mailContext-composeemailto",
                     gContextMenu.onMailtoLink && !inThreadPane);
  setSingleSelection("mailContext-addemail",
                     gContextMenu.onMailtoLink && !inThreadPane);

  ShowMenuItem("mailContext-sep-edit", (numSelected <= 1));

  ShowMenuItem('downloadSelected', numSelected > 1 && !hideMailItems);

  ShowMenuItem("mailContext-reportPhishingURL",
               !inThreadPane && gContextMenu.onLink && !gContextMenu.onMailtoLink);

  // handle our separators
  function hideIfAppropriate(aID) {
    var separator = document.getElementById(aID);
    var sibling = separator.previousSibling;
    while (sibling) {
      if (!sibling.hidden) {
        ShowMenuItem(aID, sibling.localName != "menuseparator" &&
                          hasAVisibleNextSibling(separator));
        return;
      }
      sibling = sibling.previousSibling;
    }
    ShowMenuItem(aID, false);
  }

  hideIfAppropriate("mailContext-sep-link");
  hideIfAppropriate("mailContext-sep-open");
  hideIfAppropriate("mailContext-sep-open2");
  hideIfAppropriate("mailContext-sep-reply");
  hideIfAppropriate("paneContext-afterMove");
  hideIfAppropriate("mailContext-sep-afterMarkMenu");
  hideIfAppropriate("mailContext-sep-edit");
  hideIfAppropriate("mailContext-sep-copy");
  hideIfAppropriate("mailContext-sep-reportPhishing");

  return true;
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
      gFolderTreeView.selectFolder(folder);

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
  var messageDatabase = folder.msgDatabase;
  var messageHeader;

  try
  {
    messageHeader = messageDatabase.getMsgHdrForMessageID(messageId);
  }
  catch (ex)
  {
    dump("Failed to find message-id in folder!");
  }
  var mailSession = Components.classes["@mozilla.org/messenger/services/session;1"]
                              .getService(Components.interfaces.nsIMsgMailSession);

  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  if (!mailSession.IsFolderOpenInWindow(folder) &&
      !(folder.flags & (nsMsgFolderFlags.Trash | nsMsgFolderFlags.Inbox)))
  {
    folder.msgDatabase = null;
  }

  return messageHeader;
}

function folderPaneOnPopupHiding()
{
  RestoreSelectionWithoutContentLoad(document.getElementById("folderTree"));
}

function fillFolderPaneContextMenu()
{
  var folders = GetSelectedMsgFolders();
  if (!folders.length)
    return false;

  var numSelected = folders.length;
  var folder = folders[0];
  const kVirtualFlag = Components.interfaces.nsMsgFolderFlags.Virtual;
  var isVirtualFolder = folder ? folder.flags & kVirtualFlag : false;
  const kTrashFlag = Components.interfaces.nsMsgFolderFlags.Trash;
  var isChildOfTrash = IsSpecialFolder(folder, kTrashFlag, true);

  var isServer = folder.isServer;
  var serverType = folder.server.type;
  var specialFolder = getSpecialFolderString(folder);
  var canSubscribeToFolder = (serverType == "nntp") ||
                             (serverType == "imap") ||
                             (serverType == "rss");
  var isNewsgroup = !isServer && serverType == 'nntp';
  var isMailFolder = !isServer && serverType != 'nntp';
  var canGetMessages =
    (isServer && (serverType != "nntp") && (serverType != "none")) ||
    isNewsgroup ||
    ((serverType == "rss") && !isChildOfTrash && !isVirtualFolder);

  if (!isServer)
  {
    ShowMenuItem("folderPaneContext-settings", false);
    ShowMenuItem("folderPaneContext-properties", true);
    EnableMenuItem("folderPaneContext-properties", true);
  }
  else
  {
    ShowMenuItem("folderPaneContext-properties", false);
    ShowMenuItem("folderPaneContext-settings", true);
    EnableMenuItem("folderPaneContext-settings", true);
  }

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

  var showSendUnsentMessages = (numSelected <= 1) && (specialFolder == 'Outbox');
  ShowMenuItem("folderPaneContext-sendUnsentMessages", showSendUnsentMessages);
  if (showSendUnsentMessages) 
    EnableMenuItem("folderPaneContext-sendUnsentMessages", IsSendUnsentMsgsEnabled(folder));

  ShowMenuItem("folderPaneContext-subscribe", (numSelected <= 1) && canSubscribeToFolder && !isVirtualFolder);
  EnableMenuItem("folderPaneContext-subscribe", true);

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

  // handle our separators
  function hideIfAppropriate(aID) {
    var separator = document.getElementById(aID);
    var sibling = separator.previousSibling;
    while (sibling) {
      if (sibling.getAttribute("hidden") != "true") {
        ShowMenuItem(aID, sibling.localName != "menuseparator" &&
                          hasAVisibleNextSibling(separator));
        return;
      }
      sibling = sibling.previousSibling;
    }
    ShowMenuItem(aID, false);
  }

  // Hide / Show our menu separators based on the menu items we are showing.
  ShowMenuItem("folderPaneContext-sep1", (numSelected <= 1) && !isServer);
  hideIfAppropriate("folderPaneContext-sep2");
  hideIfAppropriate("folderPaneContext-sep3");

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
  const kVirtualFlag = Components.interfaces.nsMsgFolderFlags.Virtual;
  ShowMenuItem("folderPaneContext-compact", (numSelected <= 1) && folder.canCompact && !(folder.flags & kVirtualFlag));
  EnableMenuItem("folderPaneContext-compact", folder.isCommandEnabled("cmd_compactFolder") && !(folder.flags & kVirtualFlag));
}

function SetupFavoritesMenuItem(folder, numSelected, isServer, menuItemId)
{
  var showItem = !isServer && (numSelected <=1);
  ShowMenuItem(menuItemId, showItem); 

  // adjust the checked state on the menu
  if (showItem)
  {
    const kFavoriteFlag = Components.interfaces.nsMsgFolderFlags.Favorite;
    document.getElementById(menuItemId)
            .setAttribute('checked', folder.getFlag(kFavoriteFlag));
  }
}

function ShowMenuItem(id, showItem)
{
  document.getElementById(id).hidden = !showItem;
}

function EnableMenuItem(id, enableItem)
{
  document.getElementById(id).disabled = !enableItem;
}

function SetMenuItemLabel(id, label)
{
  document.getElementById(id).setAttribute('label', label);
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

    var url = (server.socketType == Components.interfaces.nsIMsgIncomingServer.useSSL) ?
              "snews://" : "news://";
    url += server.hostName + ":" + server.port + "/" + hdr.messageId;

    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                              .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(url);
  }
  catch (ex) {
    dump("ex="+ex+"\n");
  }
}
