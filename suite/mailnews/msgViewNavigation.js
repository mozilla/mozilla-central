/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*  This file contains the js functions necessary to implement view navigation within the 3 pane. */

Components.utils.import("resource:///modules/folderUtils.jsm");

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

    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    let ignoreFlags = nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
                      nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
                      nsMsgFolderFlags.Templates | nsMsgFolderFlags.Junk;
    while (i < subFolders.length) {
      folder = subFolders[i++];
      // if there is unread mail in the trash, sent, drafts, unsent messages
      // templates or junk special folder, 
      // we ignore it when doing cross folder "next" navigation
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
  var accounts = allAccountsSorted(false);

  var serversMsgFolders = [];
  for each (var account in accounts)
    serversMsgFolders.push(account.incomingServer.rootMsgFolder);

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
    
    var nextMode = Services.prefs.getIntPref("mailnews.nav_crosses_folders");
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
          if (Services.prompt.confirmEx(window, null, promptText, 
                                        Services.prompt.STD_YES_NO_BUTTONS, 
                                        null, null, null, null, {}) == 0)
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

    let elidedFlag = Components.interfaces.nsMsgMessageFlags.Elided;
    let summarizeSelection =
      Services.prefs.getBoolPref("mail.operate_on_msgs_in_collapsed_threads");

    // if we're doing next unread, and a collapsed thread is selected, and
    // the top level message is unread, just set the result manually to
    // the top level message, without using gDBView.viewNavigate.
    if (summarizeSelection && type == nsMsgNavigationType.nextUnreadMessage &&
        currentIndex != -1 &&
        gDBView.getFlagsAt(currentIndex) & elidedFlag &&
        gDBView.isContainer(currentIndex) &&
        ! (gDBView.getFlagsAt(currentIndex) &
           Components.interfaces.nsMsgMessageFlags.Read)) {
      resultIndex.value = currentIndex;
      resultId.value = gDBView.getKeyAt(currentIndex);
    } else {
      gDBView.viewNavigate(type, resultId, resultIndex, threadIndex, true /* wrap */);
    }

    // only scroll and select if we found something
    if ((resultId.value != nsMsgViewIndex_None) && (resultIndex.value != nsMsgViewIndex_None)) {
      if (gDBView.getFlagsAt(resultIndex.value) & elidedFlag &&
          summarizeSelection)
        gDBView.toggleOpenState(resultIndex.value);

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
  if (!ScrollToMessage(type, startFromBeginning, true))
    CrossFolderNavigation(type);

  SetFocusThreadPaneIfNotOnMessagePane();
}

