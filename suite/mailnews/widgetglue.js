/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * widget-specific wrapper glue. There should be one function for every
 * widget/menu item, which gets some context (like the current selection)
 * and then calls a function/command in commandglue
 */
 
//The eventual goal is for this file to go away and its contents to be brought into
//mailWindowOverlay.js.  This is currently being done.

Components.utils.import("resource:///modules/MailUtils.js");

//NOTE: gMessengerBundle must be defined and set or this Overlay won't work

function GetSelectedFolderURI()
{
  let folders = GetSelectedMsgFolders();
  return folders.length == 1 ? folders[0].URI : null;
}

function MsgRenameFolder() 
{
  let folder = GetSelectedMsgFolders()[0];
  let dialog = window.openDialog(
               "chrome://messenger/content/renameFolderDialog.xul",
               "",
               "chrome,modal,centerscreen",
               {preselectedURI: folder.URI,
                okCallback: RenameFolder, name: folder.prettyName});
}

function RenameFolder(name,uri)
{
  var folderTree = GetFolderTree();
  if (folderTree)
  {
    if (uri && (uri != "") && name && (name != "")) 
    {
      var selectedFolder = GetMsgFolderFromUri(uri);
      if (gDBView)
        gCurrentlyDisplayedMessage = gDBView.currentlyDisplayedMessage;

      ClearThreadPane();
      ClearMessagePane();
      folderTree.view.selection.clearSelection();

      try
      {
        selectedFolder.rename(name, msgWindow);
      }
      catch(e)
      {
        SelectFolder(selectedFolder.URI);  //restore selection
        throw(e); // so that the dialog does not automatically close
        dump ("Exception : RenameFolder \n");
      }
    }
    else 
    {
      dump("no name or nothing selected\n");
    }   
  }
  else 
  {
    dump("no folder tree\n");
  }
}

function MsgEmptyTrash()
{
  let folders = GetSelectedMsgFolders();
  if (folders.length != 1 || !confirmToProceed("emptyTrash"))
    return;

  folders[0].emptyTrash(msgWindow, null);
}

function MsgCompactFolder(aCompactAccount)
{
  // Get the selected folders.
  var selectedFolders = GetSelectedMsgFolders();
  if (selectedFolders.length == 1)
  {
    var selectedFolder = selectedFolders[0];
    var isImapFolder = selectedFolder.server.type == "imap";
    if (!isImapFolder)
    {
      if (selectedFolder.expungedBytes > 0)
      {
        if (gDBView)
        {
          gCurrentlyDisplayedMessage = gDBView.currentlyDisplayedMessage;
          if (gDBView.msgFolder == selectedFolder || aCompactAccount)
          {
            ClearThreadPaneSelection();
            ClearThreadPane();
            ClearMessagePane();
          }
        }
      }
      else
      {
        if (!aCompactAccount) // you have one local folder with no room to compact
          return;
      }
    }
    if (aCompactAccount)
      selectedFolder.compactAll(null, msgWindow, isImapFolder || selectedFolder.server.type == "nntp");
    else
      selectedFolder.compact(null, msgWindow);
  }
}

function openNewVirtualFolderDialogWithArgs(defaultViewName, aSearchTerms)
{
  var folder = GetFirstSelectedMsgFolder();
  let name = folder.prettyName + "-" + defaultViewName;

  var dialog = window.openDialog("chrome://messenger/content/virtualFolderProperties.xul", "",
                                 "chrome,modal,centerscreen",
                                 {folder:folder,
                                  searchTerms:aSearchTerms,
                                  newFolderName:name});
}

function MsgVirtualFolderProperties(aEditExistingVFolder)
{
  var preselectedFolder = GetFirstSelectedMsgFolder();

  var dialog = window.openDialog("chrome://messenger/content/virtualFolderProperties.xul", "",
                                 "chrome,modal,centerscreen",
                                 {folder:preselectedFolder,
                                  editExistingFolder: aEditExistingVFolder,
                                  onOKCallback:onEditVirtualFolderPropertiesCallback,
                                  msgWindow:msgWindow});
}

function onEditVirtualFolderPropertiesCallback(aVirtualFolderURI)
{
  // we need to reload the folder if it is the currently loaded folder...
  if (gMsgFolderSelected && aVirtualFolderURI == gMsgFolderSelected.URI)
  {
    gMsgFolderSelected = null; // force the folder pane to reload the virtual folder
    FolderPaneSelectionChange();
  }
}


function MsgFolderProperties() 
{
  let msgFolder = GetMsgFolderFromUri(GetSelectedFolderURI(), true);

  // if a server is selected, view settings for that account
  if (msgFolder.isServer) {
    MsgAccountManager(null);
    return;
  }

  if (msgFolder.flags & Components.interfaces.nsMsgFolderFlags.Virtual)
  { 
    // virtual folders get their own property dialog that contains all of the
    // search information related to the virtual folder.
    MsgVirtualFolderProperties(true);
    return;
  }

  var windowTitle = gMessengerBundle.getString("folderProperties");
  var dialog = window.openDialog(
              "chrome://messenger/content/folderProps.xul",
              "",
              "chrome,modal,centerscreen",
              {folder: msgFolder, serverType: msgFolder.server.type,
               msgWindow: msgWindow, title: windowTitle,
               okCallback: FolderProperties, tabID: "", tabIndex: 0,
               name: msgFolder.prettyName,
               rebuildSummaryCallback: RebuildSummaryFile});
}

function RebuildSummaryFile(msgFolder)
{
  if (msgFolder.locked)
  {
    msgFolder.throwAlertMsg("operationFailedFolderBusy", msgWindow);
    return;
  }
  var msgDB = msgFolder.msgDatabase;
  msgDB.summaryValid = false;
  try {
    msgFolder.closeAndBackupFolderDB("");
  }
  catch(e) {
    // In a failure, proceed anyway since we're dealing with problems
    msgFolder.ForceDBClosed();
  }
  // these two lines will cause the thread pane to get reloaded
  // when the download/reparse is finished. Only do this
  // if the selected folder is loaded (i.e., not thru the
  // context menu on a non-loaded folder).
  if (msgFolder == GetLoadedMsgFolder())
  {
    gRerootOnFolderLoad = true;
    gCurrentFolderToReroot = msgFolder.URI;
  }
  msgFolder.updateFolder(msgWindow);
}

function FolderProperties(name, oldName, uri)
{
  if (name != oldName)
    RenameFolder(name, uri);
}

// Given a URI we would like to return corresponding message folder here.
// An additonal input param which specifies whether or not to check folder 
// attributes (like if there exists a parent or is it a server) is also passed
// to this routine. Qualifying against those checks would return an existing 
// folder. Callers who don't want to check those attributes will specify the
// same and then this routine will simply return a msgfolder. This scenario
// applies to a new imap account creation where special folders are created
// on demand and hence needs to prior check of existence.
function GetMsgFolderFromUri(uri, checkFolderAttributes)
{
  return MailUtils.getFolderForURI(uri, checkFolderAttributes);
}
