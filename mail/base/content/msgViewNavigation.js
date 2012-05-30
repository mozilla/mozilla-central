/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*  This file contains the js functions necessary to implement view navigation within the 3 pane. */

function GetSubFoldersInFolderPaneOrder(folder)
{
  var subFolders = folder.subFolders;
  var msgFolders = Array();

  // get all the subfolders
  while (subFolders.hasMoreElements()) {
    msgFolders[msgFolders.length] =
      subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
  }

  function compareFolderSortKey(folder1, folder2) {
    return folder1.compareSortKeys(folder2);
  }

  // sort the subfolders
  msgFolders.sort(compareFolderSortKey);
  return msgFolders;
}

function FindNextChildFolder(aParent, aAfter)
{
  // Search the child folders of aParent for unread messages
  // but in the case that we are working up from the current folder
  // we need to skip up to and including the current folder
  // we skip the current folder in case a mail view is hiding unread messages
  if (aParent.getNumUnread(true) > 0) {
    var subFolders = GetSubFoldersInFolderPaneOrder(aParent);
    var i = 0;
    var folder = null;

    // Skip folders until after the specified child
    while (folder != aAfter)
      folder = subFolders[i++];

    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    let ignoreFlags = nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
                      nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
                      nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk;
    while (i < subFolders.length) {
      folder = subFolders[i++];
      // If there is unread mail in the trash, sent, drafts, unsent messages
      // templates or junk special folder,
      // we ignore it when doing cross folder "next" navigation.
      if (!folder.isSpecialFolder(ignoreFlags, true)) {
        if (folder.getNumUnread(false) > 0)
          return folder;

        folder = FindNextChildFolder(folder, null);
        if (folder)
          return folder;
      }
    }
  }

  return null;
}

function FindNextFolder()
{
  // look for the next folder, this will only look on the current account
  // and below us, in the folder pane
  // note use of gDBView restricts this function to message folders
  // otherwise you could go next unread from a server
  var folder = FindNextChildFolder(gDBView.msgFolder, null);
  if (folder)
    return folder;

  // didn't find folder in children
  // go up to the parent, and start at the folder after the current one
  // unless we are at a server, in which case bail out.
  for (folder = gDBView.msgFolder; !folder.isServer; ) {

    var parent = folder.parent;
    folder = FindNextChildFolder(parent, folder);
    if (folder)
      return folder;
 
    // none at this level after the current folder.  go up.
    folder = parent;
  }

  // nothing in the current account, start with the next account (below)
  // and try until we hit the bottom of the folder pane

  // start at the account after the current account
  var rootFolders = GetRootFoldersInFolderPaneOrder();
  for (var i = 0; i < rootFolders.length; i++) {
    if (rootFolders[i].URI == gDBView.msgFolder.server.serverURI)
      break;
  }
  
  for (var j = i + 1; j < rootFolders.length; j++) {
    folder = FindNextChildFolder(rootFolders[j], null);
    if (folder)
      return folder;
  }
  
  // if nothing from the current account down to the bottom
  // (of the folder pane), start again at the top.
  for (j = 0; j <= i; j++) {
    folder = FindNextChildFolder(rootFolders[j], null);
    if (folder)
      return folder;
  }
  return null;
}

function GetRootFoldersInFolderPaneOrder()
{
  var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"].
                getService(Components.interfaces.nsIMsgAccountManager);
  var acctEnum = acctMgr.accounts;
  var count = acctEnum.Count();

  var accounts = new Array();
  for (var i = 0; i < count; i++) {
    var acct = acctEnum.GetElementAt(i)
                       .QueryInterface(Components.interfaces.nsIMsgAccount);

    // This is a HACK to work around bug 41133. If we have one of the
    // dummy "news" accounts there, that account won't have an
    // incomingServer attached to it, and everything will blow up.
    if (acct.incomingServer && acct.incomingServer.type != "im")
      accounts.push(acct);
  }

  /**
   * This is our actual function for sorting accounts.  Accounts go in the
   * following order: (1) default account (2) other mail accounts (3) Local
   * Folders (4) news
   */
  function accountCompare(a, b) {
    if (a.key == acctMgr.defaultAccount.key)
      return -1;
    if (b.key == acctMgr.defaultAccount.key)
      return 1;
    var aIsNews = a.incomingServer.type == "nntp";
    var bIsNews = b.incomingServer.type == "nntp";
    if (aIsNews && !bIsNews)
      return 1;
    if (bIsNews && !aIsNews)
      return -1;

    var aIsLocal = a.incomingServer.type == "none";
    var bIsLocal = b.incomingServer.type == "none";
    if (aIsLocal && !bIsLocal)
      return 1;
    if (bIsLocal && !aIsLocal)
      return -1;
    return 0;
  }

  // sort accounts, so they are in the same order as folder pane
  accounts.sort(accountCompare)

  var serversMsgFolders = new Array();
  for each (var acct in accounts)
    serversMsgFolders.push(acct.incomingServer.rootMsgFolder);

  return serversMsgFolders;
}

function CrossFolderNavigation(type)
{
  // do cross folder navigation for next unread message/thread and message history
  if (type != nsMsgNavigationType.nextUnreadMessage &&
      type != nsMsgNavigationType.nextUnreadThread &&
      type != nsMsgNavigationType.forward &&
      type != nsMsgNavigationType.back)
    return;

  if (type == nsMsgNavigationType.nextUnreadMessage ||
      type == nsMsgNavigationType.nextUnreadThread)
  {
    var nextMode = pref.getIntPref("mailnews.nav_crosses_folders");
    // 0: "next" goes to the next folder, without prompting
    // 1: "next" goes to the next folder, and prompts (the default)
    // 2: "next" does nothing when there are no unread messages

    // not crossing folders, don't find next
    if (nextMode == 2)
      return;

    var folder = FindNextFolder();
    if (folder && (gDBView.msgFolder.URI != folder.URI)) 
    {
      if (nextMode == 1)
      {
        let promptText = document.getElementById("bundle_messenger")
                                 .getFormattedString("advanceNextPrompt",
                                                     [folder.name], 1);
        let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);
        if (promptService.confirmEx(window, null, promptText,
                                    promptService.STD_YES_NO_BUTTONS,
                                    null, null, null, null, {}))
          return;
      }
      gFolderDisplay.pushNavigation(type, true);
      SelectFolder(folder.URI);
    }
  }
  else
  {
    // if no message is loaded, relPos should be 0, to
    // go back to the previously loaded message
    var relPos = (type == nsMsgNavigationType.forward)
      ? 1 : ((gMessageDisplay.displayedMessage) ? -1 : 0);
    var folderUri = messenger.getFolderUriAtNavigatePos(relPos);
    var msgHdr = messenger.msgHdrFromURI(messenger.getMsgUriAtNavigatePos(relPos));
    gStartMsgKey = msgHdr.messageKey;
    var curPos = messenger.navigatePos;
    curPos += relPos;
    messenger.navigatePos = curPos;
    SelectFolder(folderUri);
  }
}

function GoNextMessage(type, startFromBeginning)
{
  if (!gFolderDisplay.navigate(type))
    CrossFolderNavigation(type);

  SetFocusThreadPaneIfNotOnMessagePane();
}

