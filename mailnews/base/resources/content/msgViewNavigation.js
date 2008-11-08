/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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

/*  This file contains the js functions necessary to implement view navigation within the 3 pane. */

//NOTE: gMessengerBundle must be defined and set or this Overlay won't work

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

    while (i < subFolders.length) {
      folder = subFolders[i++];
      // if there is unread mail in the trash, sent, drafts, unsent messages
      // templates or junk special folder, 
      // we ignore it when doing cross folder "next" navigation
      const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
      if (!IsSpecialFolder(folder, nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue | nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk, true)) {
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

    var parent = folder.parentMsgFolder;
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
  for (i = 0; i < rootFolders.length; i++) {
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
    if (acct.incomingServer)
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
      switch (nextMode) 
      {
        case 0:
          // do this unconditionally
          gNextMessageAfterLoad = type;
          SelectFolder(folder.URI);
          break;
        case 1:
        default:
          var promptText = gMessengerBundle.getFormattedString("advanceNextPrompt", [ folder.name ], 1); 
          var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                        .getService(Components.interfaces.nsIPromptService);
          if (!promptService.confirmEx(window, null, promptText, 
                                       promptService.STD_YES_NO_BUTTONS, 
                                       null, null, null, null, {}))
          {
            gNextMessageAfterLoad = type;
            SelectFolder(folder.URI);
          }
          break;
      }
    }
  }
  else
  {
    // if no message is loaded, relPos should be 0, to
    // go back to the previously loaded message
    var relPos = (type == nsMsgNavigationType.forward)
      ? 1 : ((GetLoadedMessage()) ? -1 : 0);
    var folderUri = messenger.getFolderUriAtNavigatePos(relPos);
    var msgHdr = messenger.msgHdrFromURI(messenger.getMsgUriAtNavigatePos(relPos));
    gStartMsgKey = msgHdr.messageKey;
    var curPos = messenger.navigatePos;
    curPos += relPos;
    messenger.navigatePos = curPos;
    SelectFolder(folderUri);
  }
}


function ScrollToMessage(type, wrap, selectMessage)
{
  try {
    var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
    var treeSelection = treeView.selection;
    var currentIndex = treeSelection.currentIndex;

    var resultId = new Object;
    var resultIndex = new Object;
    var threadIndex = new Object;

    gDBView.viewNavigate(type, resultId, resultIndex, threadIndex, true /* wrap */);

    // only scroll and select if we found something
    if ((resultId.value != nsMsgViewIndex_None) && (resultIndex.value != nsMsgViewIndex_None)) {
        if (selectMessage){
            treeSelection.select(resultIndex.value);
        }
        EnsureRowInThreadTreeIsVisible(resultIndex.value);
        return true;
    }
    else {
        return false;
    }
  }
  catch (ex) {
    return false;
  }
}

function GoNextMessage(type, startFromBeginning)
{
  try {
    var succeeded = ScrollToMessage(type, startFromBeginning, true);
    if (!succeeded) {
      CrossFolderNavigation(type);
    }
  }
  catch (ex) {
    dump("GoNextMessage ex = " + ex + "\n");
  }

  SetFocusThreadPaneIfNotOnMessagePane();
}

