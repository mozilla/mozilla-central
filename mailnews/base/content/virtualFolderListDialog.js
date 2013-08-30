/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/MailUtils.js");

var gFolderPickerTree = null;

function onLoad()
{
  gFolderPickerTree = document.getElementById("folderPickerTree");

  if (window.arguments[0].searchFolderURIs)
  {
    // for each folder uri, 
    var srchFolderUriArray = window.arguments[0].searchFolderURIs.split('|');
    // get the folder for each search URI and set the searchThisFolder flag on it
    for (var i in srchFolderUriArray) 
    {
      var realFolder = MailUtils.getFolderForURI(srchFolderUriArray[i]);
      if (realFolder)
        realFolder.setInVFEditSearchScope(true, false);
    }
  }
}

function onUnLoad()
{
  resetFolderToSearchAttribute();
}

function onOK()
{
  if ( window.arguments[0].okCallback )
    window.arguments[0].okCallback(generateFoldersToSearchList());
}

function onCancel()
{
  // onunload will clear out the folder attributes we changed
}

function addFolderToSearchListString(aFolder, aCurrentSearchURIString)
{
  if (aCurrentSearchURIString)
    aCurrentSearchURIString += '|';
  aCurrentSearchURIString += aFolder.URI;

  return aCurrentSearchURIString;
}

function processSearchSettingForFolder(aFolder, aCurrentSearchURIString)
{
  if (aFolder.inVFEditSearchScope)
    aCurrentSearchURIString = addFolderToSearchListString(aFolder, aCurrentSearchURIString);
  
  aFolder.setInVFEditSearchScope(false, false);
  return aCurrentSearchURIString;
}

// warning: this routine also clears out the search property list from all of the msg folders
function generateFoldersToSearchList()
{
  let uriSearchString = "";
  let allFolders = MailServices.accounts.allFolders;
  for (let folder in fixIterator(allFolders, Components.interfaces.nsIMsgFolder))
    uriSearchString = processSearchSettingForFolder(folder, uriSearchString);

  return uriSearchString;
}

function resetFolderToSearchAttribute()
{
  // iterates over all accounts and all folders, clearing out the inVFEditScope property in case
  // we set it.
  let allFolders = MailServices.accounts.allFolders;
  for (let folder in fixIterator(allFolders, Components.interfaces.nsIMsgFolder))
    folder.setInVFEditSearchScope(false, false);
}

function ReverseStateFromNode(row)
{
  var folder = GetFolderResource(row).QueryInterface(Components.interfaces.nsIMsgFolder);
  var currentState = folder.inVFEditSearchScope;

  folder.setInVFEditSearchScope(!currentState, false);
}

function GetFolderResource(rowIndex)
{
  return gFolderPickerTree.builder.QueryInterface(Components.interfaces.nsIXULTreeBuilder).getResourceAtIndex(rowIndex);
}

function selectFolderTreeOnClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0 || event.originalTarget.localName != "treechildren")
   return;
 
  var row = {}, col = {}, obj = {};
  gFolderPickerTree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
  if (row.value == -1 || row.value > (gFolderPickerTree.view.rowCount - 1))
    return;

  if (event.detail == 2) {
    // only toggle the search folder state when double clicking something
    // that isn't a container
    if (!gFolderPickerTree.view.isContainer(row.value)) {
      ReverseStateFromNode(row.value);
      return;
    } 
  }
  else if (event.detail == 1)
  {
    if (obj.value != "twisty" && col.value.id == "selectedColumn")
      ReverseStateFromNode(row.value)
  }
}

function onSelectFolderTreeKeyPress(event)
{
  // for now, only do something on space key
  if (event.charCode != KeyEvent.DOM_VK_SPACE)
    return;

  var treeSelection = gFolderPickerTree.view.selection; 
  for (var i=0;i<treeSelection.getRangeCount();i++) {
    var start = {}, end = {};
    treeSelection.getRangeAt(i,start,end);
    for (var k=start.value;k<=end.value;k++)
      ReverseStateFromNode(k);
  }
}
