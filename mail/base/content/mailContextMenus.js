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
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jan Varga <varga@nixcorp.com>
 *   Hakan Waara <hwaara@chello.se>
 *   Markus Hossner <markushossner@gmx.de>
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

//NOTE: gMessengerBundle must be defined and set or this Overlay won't work

Components.utils.import("resource://gre/modules/PluralForm.jsm");

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
  if (gRightMouseButtonSavedSelection) {
    let view = gRightMouseButtonSavedSelection.view;
    // restore the selection
    let transientSelection = gRightMouseButtonSavedSelection.transientSelection;
    let realSelection = gRightMouseButtonSavedSelection.realSelection;
    view.selection = realSelection;
    // replay any calls to adjustSelection, this handles suppression.
    transientSelection.replayAdjustSelectionLog(realSelection);
    gRightMouseButtonSavedSelection = null;

    if (tree)
      tree.treeBoxObject.invalidate();

    UpdateMailToolbar("RestoreSelectionWithoutContentLoad");
  }
}

/**
 * Function to clear out the global nsContextMenu, and in the case when we
 * were a threadpane context menu, restore the selection so that a right-click
 * on a non-selected row doesn't move the selection.
 * @param event the onpopuphiding event
 */
function mailContextOnPopupHiding(aEvent)
{
  // Don't do anything if it's a submenu's onpopuphiding that's just bubbling
  // up to the top.
  if (aEvent.target != aEvent.currentTarget)
    return;

  gContextMenu = null;
  if (popupNodeIsInThreadPane())
    RestoreSelectionWithoutContentLoad(GetThreadTree());
}

/**
 * Determines whether the context menu was triggered by a node that's a child
 * of the threadpane by looking for a parent node with id="threadTree".
 * @return true if the popupNode is a child of the threadpane, otherwise false
 */
function popupNodeIsInThreadPane()
{
  var node = document.popupNode;
  while (node)
  {
    if (node.id == "threadTree")
      return true;

    node = node.parentNode;
  }
  return false;
}

function fillMailContextMenu(event)
{
  // If the popupshowing was for a submenu, we don't need to do anything.
  if (event.target != event.currentTarget)
    return true;

  var numSelected = GetNumSelectedMessages();
  if (numSelected == 0)
    return false; // Don't show the context menu if no items are selected.

  var inThreadPane = popupNodeIsInThreadPane();
  gContextMenu = new nsContextMenu(event.target);

  var selectedMessage = gFolderDisplay.selectedMessage;
  var isNewsgroup = gFolderDisplay.selectedMessageIsNews;

  // Don't show mail items for links/images, just show related items.
  var hideMailItems = !inThreadPane &&
                      (gContextMenu.onImage || gContextMenu.onLink);
  var single = (numSelected == 1);

  let onPlayableMedia = gContextMenu.onVideo || gContextMenu.onAudio;

  // Select-all and copy are only available in the message-pane
  ShowMenuItem("mailContext-selectall", !inThreadPane && !onPlayableMedia);
  ShowMenuItem("mailContext-copy", !inThreadPane && !onPlayableMedia);

  // Show the Open in New Window  and New Tab options if there is exactly one
  // message selected.
  ShowMenuItem("mailContext-openNewWindow", single && inThreadPane);
  ShowMenuItem("threadPaneContext-openNewTab", single && inThreadPane);

  /**
   * Most menu items are visible if there's 1 or 0 messages selected, and
   * enabled if there's exactly one selected. Handle those here.
   * Exception: playable media is selected, in which case, don't show them.
   *
   * @param aID   the id of the element to display/enable
   * @param aHide (optional)  an additional criteria to evaluate when we
   *              decide whether to display the element. If false, we'll hide
   *              the item no matter what messages are selected
   */
 function setSingleSelection(aID, aHide) {
    var hide = aHide != undefined ? aHide : true;
    ShowMenuItem(aID, single && !hideMailItems && hide && !onPlayableMedia);
    EnableMenuItem(aID, single);
  }

  setSingleSelection("mailContext-replySender");
  setSingleSelection("mailContext-editAsNew");
  setSingleSelection("mailContext-replyNewsgroup", isNewsgroup);
  setSingleSelection("mailContext-replyAll");
  setSingleSelection("mailContext-replyList");
  setSingleSelection("mailContext-forward");
  ShowMenuItem("mailContext-forwardAsAttachment",
               numSelected > 1 && inThreadPane && !hideMailItems);

  setSingleSelection("mailContext-copyMessageUrl", isNewsgroup);

  ShowMenuItem("mailContext-sep-open", single);

  ShowMenuItem("mailContext-sep-reply", true);

  let msgFolder = gFolderDisplay.displayedFolder;

  // Set up the move menu. We can't move from newsgroups.
  ShowMenuItem("mailContext-moveMenu",
               !isNewsgroup && !hideMailItems && msgFolder && !onPlayableMedia);

  // disable move if we can't delete message(s) from this folder
  var canMove = msgFolder && msgFolder.canDeleteMessages;
  EnableMenuItem("mailContext-moveMenu", canMove && !onPlayableMedia);

  // Copy is available as long as something is selected.
  ShowMenuItem("mailContext-copyMenu",
               !hideMailItems && msgFolder && !onPlayableMedia);

  let hideMoveToFolderAgain = !hideMailItems && msgFolder && !onPlayableMedia;
  ShowMenuItem("mailContext-moveToFolderAgain", hideMoveToFolderAgain);
  if (hideMoveToFolderAgain) {
    initMoveToFolderAgainMenu(document.getElementById("mailContext-moveToFolderAgain"));
    goUpdateCommand("cmd_moveToFolderAgain");
  }

  ShowMenuItem("paneContext-afterMove", !inThreadPane);

  ShowMenuItem("mailContext-tags", !hideMailItems && msgFolder && !onPlayableMedia);

  ShowMenuItem("mailContext-mark", !hideMailItems && msgFolder && !onPlayableMedia);

  setSingleSelection("mailContext-saveAs");
  if (Application.platformIsMac)
    ShowMenuItem("mailContext-printpreview", false);
  else
    setSingleSelection("mailContext-printpreview");

  ShowMenuItem("mailContext-print", !hideMailItems && !onPlayableMedia);

  ShowMenuItem("mailContext-delete",
               !hideMailItems && (isNewsgroup || canMove) && !onPlayableMedia);
  // This function is needed for the case where a folder is just loaded (while
  // there isn't a message loaded in the message pane), a right-click is done
  // in the thread pane.  This function will disable enable the 'Delete
  // Message' menu item.
  goUpdateCommand('cmd_delete');

  setSingleSelection("mailContext-composeemailto",
                     gContextMenu.onMailtoLink && !inThreadPane);
  setSingleSelection("mailContext-addemail",
                     gContextMenu.onMailtoLink && !inThreadPane);

  ShowMenuItem("mailContext-sep-edit", single);

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
    window.openDialog("chrome://messenger/content/messageWindow.xul",
                      "_blank", "all,chrome,dialog=no,status,toolbar",
                      messageHeader);
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
  var folders = gFolderTreeView.getSelectedFolders();
  if (!folders.length)
    return false;

  var numSelected = folders.length;

  function checkIsVirtualFolder(folder) {
    const kVirtualFlag = Components.interfaces.nsMsgFolderFlags.Virtual;
    return folder.flags & kVirtualFlag;
  }
  var haveAnyVirtualFolders = folders.some(checkIsVirtualFolder);

  function checkIsServer(folder) {
    return folder.isServer;
  }
  var selectedServers = folders.filter(checkIsServer);

  let specialFolder;
  if (numSelected == 1)
    specialFolder = haveAnyVirtualFolders ? "Virtual" :
                                          getSpecialFolderString(folders[0]);

  function checkCanSubscribeToFolder(folder) {
    if (checkIsVirtualFolder(folder))
      return false;
    return folder.server.type == "nntp" ||
           folder.server.type == "imap" ||
           folder.server.type == "rss";
  }
  var haveOnlySubscribableFolders = folders.every(checkCanSubscribeToFolder);

  function checkIsNewsgroup(folder) {
    return !folder.isServer && folder.server.type == "nntp";
  }
  var haveOnlyNewsgroups = folders.every(checkIsNewsgroup);

  function checkIsMailFolder(folder) {
    return !folder.isServer && folder.server.type != "nntp";
  }
  var haveOnlyMailFolders = folders.every(checkIsMailFolder);

  function checkCanGetMessages(folder) {
    const kTrashFlag = Components.interfaces.nsMsgFolderFlags.Trash;
    return (folder.isServer && (folder.server.type != "none")) ||
           checkIsNewsgroup(folder) ||
           ((folder.server.type == "rss") && !folder.isSpecialFolder(kTrashFlag, true) &&
             !checkIsVirtualFolder(folder));
  }
  var selectedFoldersThatCanGetMessages = folders.filter(checkCanGetMessages);

  // --- Set up folder properties / account settings menu item.
  if (numSelected != 1) {
    ShowMenuItem("folderPaneContext-settings", false);
    ShowMenuItem("folderPaneContext-properties", false);
  }
  else if (selectedServers.length != 1)
  {
    ShowMenuItem("folderPaneContext-settings", false);
    ShowMenuItem("folderPaneContext-properties", true);
  }
  else
  {
    ShowMenuItem("folderPaneContext-properties", false);
    ShowMenuItem("folderPaneContext-settings", true);
  }

  // --- Set up the get messages menu item.
  // Show if only servers, or it's only newsgroups/feeds. We could mix,
  // but it gets messy for situations where both server and a folder
  // on the server are selected.
  ShowMenuItem("folderPaneContext-getMessages",
               (selectedServers.length > 0 &&
                selectedFoldersThatCanGetMessages.length == numSelected &&
                selectedServers.length == selectedFoldersThatCanGetMessages.length) ||
               selectedFoldersThatCanGetMessages.length == numSelected);

  // --- Set up new sub/folder menu item.
  if (numSelected == 1) {
    let showNewFolderItem =
      ((folders[0].server.type != "nntp") && folders[0].canCreateSubfolders) ||
      (specialFolder == "Inbox");
    ShowMenuItem("folderPaneContext-new", showNewFolderItem);
    // XXX: Can't offline imap create folders nowadays?
    EnableMenuItem("folderPaneContext-new", folders[0].server.type != "imap" ||
                                            MailOfflineMgr.isOnline());
    if (showNewFolderItem)
    {
      if (folders[0].isServer || specialFolder == "Inbox")
        SetMenuItemLabel("folderPaneContext-new", gMessengerBundle.getString("newFolder"));
      else
        SetMenuItemLabel("folderPaneContext-new", gMessengerBundle.getString("newSubfolder"));
    }
  }
  else {
    ShowMenuItem("folderPaneContext-new", false);
  }

  // --- Set up rename menu item.
  if (numSelected == 1) {
    ShowMenuItem("folderPaneContext-rename",
                 !folders[0].isServer && folders[0].canRename &&
                 specialFolder == "none" || specialFolder == "Virtual" ||
                 (specialFolder == "Junk" && CanRenameDeleteJunkMail(folders[0].URI)));
    EnableMenuItem("folderPaneContext-rename",
                   !folders[0].isServer && folders[0].isCommandEnabled("cmd_renameFolder"));
  }
  else {
    ShowMenuItem("folderPaneContext-rename", false);
  }

  // --- Set up the delete folder menu item.
  function checkCanDeleteFolder(folder) {
    let specialFolder = getSpecialFolderString(folder);
    return folder.server.type != "nntp" && !folder.isServer &&
           (specialFolder == "none" || specialFolder == "Virtual" ||
            (specialFolder == "Junk" && CanRenameDeleteJunkMail(folder.URI)));
  }
  var haveOnlyDeletableFolders = folders.every(checkCanDeleteFolder);
  ShowMenuItem("folderPaneContext-remove", haveOnlyDeletableFolders && numSelected == 1);

  function checkIsDeleteEnabled(folder) {
    return folder.isCommandEnabled("cmd_delete");
  }
  var haveOnlyDeleteEnabledFolders = folders.every(checkIsDeleteEnabled);
  EnableMenuItem("folderPaneContext-remove", haveOnlyDeleteEnabledFolders);

  // --- Set up the compact folder menu item.
  function checkCanCompactFolder(folder) {
    const kVirtualFlag = Components.interfaces.nsMsgFolderFlags.Virtual;
    return folder.canCompact && !(folder.flags & kVirtualFlag) &&
           folder.isCommandEnabled("cmd_compactFolder");
  }
  var haveOnlyCompactableFolders = folders.every(checkCanCompactFolder);
  ShowMenuItem("folderPaneContext-compact", haveOnlyCompactableFolders);

  function checkIsCompactEnabled(folder) {
    return folder.isCommandEnabled("cmd_compactFolder");
  }
  var haveOnlyCompactEnabledFolders = folders.every(checkIsCompactEnabled);
  EnableMenuItem("folderPaneContext-compact", haveOnlyCompactEnabledFolders);

  // --- Set up favorite folder menu item.
  ShowMenuItem("folderPaneContext-favoriteFolder",
               numSelected == 1 && !folders[0].isServer);
  if (numSelected == 1 && !folders[0].isServer)
  {
    const kFavoriteFlag = Components.interfaces.nsMsgFolderFlags.Favorite;
     // Adjust the checked state on the menu item.
    document.getElementById("folderPaneContext-favoriteFolder")
            .setAttribute("checked", folders[0].getFlag(kFavoriteFlag));
  }

  // --- Set up the empty trash menu item.
  ShowMenuItem("folderPaneContext-emptyTrash",
               numSelected == 1 && specialFolder == "Trash");

  // --- Set up the empty junk menu item.
  ShowMenuItem("folderPaneContext-emptyJunk",
               numSelected == 1 && specialFolder == "Junk");

  // --- Set up the send unsent messages menu item.
  ShowMenuItem("folderPaneContext-sendUnsentMessages",
               numSelected == 1 && specialFolder == "Outbox");
  EnableMenuItem("folderPaneContext-sendUnsentMessages",
                 IsSendUnsentMsgsEnabled(folders[0]));

  // --- Set up the subscribe menu item.
  ShowMenuItem("folderPaneContext-subscribe",
               numSelected == 1 && haveOnlySubscribableFolders);

  // --- Set up the unsubscribe menu item.
  ShowMenuItem("folderPaneContext-newsUnsubscribe", haveOnlyNewsgroups);

  // --- Set up the mark newsgroup/s read menu item.
  ShowMenuItem("folderPaneContext-markNewsgroupAllRead", haveOnlyNewsgroups);
  SetMenuItemLabel("folderPaneContext-markNewsgroupAllRead",
                   PluralForm.get(numSelected, gMessengerBundle.getString("markNewsgroupRead")));

  // --- Set up the mark folder/s read menu item.
  ShowMenuItem("folderPaneContext-markMailFolderAllRead",
               haveOnlyMailFolders && !haveAnyVirtualFolders);
  SetMenuItemLabel("folderPaneContext-markMailFolderAllRead",
                  PluralForm.get(numSelected, gMessengerBundle.getString("markFolderRead")));

  // Set up the search menu item.
  ShowMenuItem("folderPaneContext-searchMessages",
               numSelected == 1 && !haveAnyVirtualFolders);
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
  ShowMenuItem("folderPaneContext-sep1", selectedServers.length == 0);
  hideIfAppropriate("folderPaneContext-sep1");
  hideIfAppropriate("folderPaneContext-sep2");
  hideIfAppropriate("folderPaneContext-sep3");

  return(true);
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

function composeEmailTo()
{
  let fields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                         .createInstance(Components.interfaces.nsIMsgCompFields);
  let params = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                         .createInstance(Components.interfaces.nsIMsgComposeParams);
  fields.to = getEmail(gContextMenu.linkURL);
  params.type = Components.interfaces.nsIMsgCompType.New;
  params.format = Components.interfaces.nsIMsgCompFormat.Default;
  if (gFolderDisplay.displayedFolder) {
    params.identity = accountManager.getFirstIdentityForServer(
                        gFolderDisplay.displayedFolder.server);
  }
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
