/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
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

var gLastMessageUriToLoad = null;
var gThreadPaneCommandUpdater = null;

function ThreadPaneOnClick(event)
{
    // we only care about button 0 (left click) events
    if (event.button != 0) return;

    // we are already handling marking as read and flagging
    // in nsMsgDBView.cpp
    // so all we need to worry about here is double clicks
    // and column header.
    //
    // we get in here for clicks on the "treecol" (headers)
    // and the "scrollbarbutton" (scrollbar buttons)
    // we don't want those events to cause a "double click"

    var t = event.originalTarget;

    if (t.localName == "treecol") {
       HandleColumnClick(t.id);
    }
    else if (t.localName == "treechildren") {
      var row = new Object;
      var col = new Object;
      var childElt = new Object;

      var tree = GetThreadTree();
      // figure out what cell the click was in
      tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, childElt);
      if (row.value == -1)
       return;

      // if the cell is in a "cycler" column
      // or if the user double clicked on the twisty,
      // don't open the message in a new window
      if (event.detail == 2 && !col.value.cycler && (childElt.value != "twisty")) {
        ThreadPaneDoubleClick();
        // double clicking should not toggle the open / close state of the 
        // thread.  this will happen if we don't prevent the event from
        // bubbling to the default handler in tree.xml
        event.stopPropagation();
      }
      else if (col.value.id == "junkStatusCol") {
        MsgJunkMailInfo(true);
      }
      else if (col.value.id == "threadCol" && !event.shiftKey &&
          (event.ctrlKey || event.metaKey)) {
        gDBView.ExpandAndSelectThreadByIndex(row.value, true);
        event.stopPropagation();
      }
    }
}

function HandleColumnClick(columnID)
{
  const columnMap = {dateCol: 'byDate',
                     receivedCol: 'byReceived',
                     senderCol: 'byAuthor',
                     recipientCol: 'byRecipient',
                     subjectCol: 'bySubject',
                     locationCol: 'byLocation',
                     accountCol: 'byAccount',
                     unreadButtonColHeader: 'byUnread',
                     statusCol: 'byStatus',
                     sizeCol: 'bySize',
                     priorityCol: 'byPriority',
                     flaggedCol: 'byFlagged',
                     threadCol: 'byThread',
                     tagsCol: 'byTags',
                     junkStatusCol: 'byJunkStatus',
                     idCol: 'byId',
                     attachmentCol: 'byAttachments'};


  var sortType;
  if (columnID in columnMap) {
    sortType = columnMap[columnID];
  } else {
    // If the column isn't in the map, check and see if it's a custom column
    try {
      // try to grab the columnHandler (an error is thrown if it does not exist)
      columnHandler = gDBView.getColumnHandler(columnID);

      // it exists - set it to be the current custom column
      gDBView.curCustomColumn = columnID;
        
      sortType = "byCustom";
    } catch(err) {
        dump("unsupported sort column: " + columnID + " - no custom handler installed. (Error was: " + err + ")\n");
        return; // bail out
    }
  }

  let viewWrapper = gFolderDisplay.view;
  var simpleColumns = false;
  try {
    simpleColumns = !pref.getBoolPref("mailnews.thread_pane_column_unthreads");
  }
  catch (ex) {
  }
  if (sortType == "byThread") {
    if (simpleColumns)
      MsgToggleThreaded();
    else if (viewWrapper.showThreaded)
      MsgReverseSortThreadPane();
    else
      MsgSortByThread();
  }
  else {
    if (!simpleColumns && viewWrapper.showThreaded) {
      viewWrapper.showUnthreaded = true;
      MsgSortThreadPane(sortType);
    }
    else if (viewWrapper.primarySortType == nsMsgViewSortType[sortType]) {
      MsgReverseSortThreadPane();
    }
    else {
      MsgSortThreadPane(sortType);
    }
  }
}

function ThreadPaneDoubleClick()
{
  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  if (IsSpecialFolderSelected(nsMsgFolderFlags.Drafts, true)) {
    MsgComposeDraftMessage();
  }
  else if(IsSpecialFolderSelected(nsMsgFolderFlags.Templates, true)) {
    ComposeMessage(Components.interfaces.nsIMsgCompType.Template,
                   Components.interfaces.nsIMsgCompFormat.Default,
                   gFolderDisplay.displayedFolder,
                   gFolderDisplay.selectedMessageUris);
  }
  else {
    MsgOpenSelectedMessages();
  }
}

function ThreadPaneKeyPress(event)
{
  if (event.keyCode == KeyEvent.DOM_VK_RETURN)
    ThreadPaneDoubleClick();
}

function MsgSortByThread()
{
  gFolderDisplay.view.showThreaded = true;
  MsgSortThreadPane('byDate');
}

function MsgSortThreadPane(sortName)
{
  var sortType = nsMsgViewSortType[sortName];
  // legacy behavior dictates we un-group-by-sort if we were.  this probably
  //  deserves a UX call...
  gFolderDisplay.view.showGroupedBySort = false;
  gFolderDisplay.view.sort(sortType, nsMsgViewSortOrder.ascending)
}

function MsgReverseSortThreadPane()
{
  if (gFolderDisplay.view.isSortedAscending)
    gFolderDisplay.view.sortDescending();
  else
    gFolderDisplay.view.sortAscending();
}

function MsgToggleThreaded()
{
  if (gFolderDisplay.view.showThreaded)
    gFolderDisplay.view.showUnthreaded = true;
  else
    gFolderDisplay.view.showThreaded = true;
}

function MsgSortThreaded()
{
  gFolderDisplay.view.showThreaded = true;
}

function MsgGroupBySort()
{
  gFolderDisplay.view.showGroupedBySort = true;
}

function MsgSortUnthreaded()
{
  gFolderDisplay.view.showUnthreaded = true;
}

function MsgSortAscending()
{
  gFolderDisplay.view.sortAscending();
}

function MsgSortDescending()
{
  gFolderDisplay.view.sortDescending();
}

// XXX this should probably migrate into FolderDisplayWidget, or whatever
//  FolderDisplayWidget ends up using if it refactors column management out.
function UpdateSortIndicators(sortType, sortOrder)
{
  // Remove the sort indicator from all the columns
  var treeColumns = document.getElementById('threadCols').childNodes;
  for (var i = 0; i < treeColumns.length; i++)
    treeColumns[i].removeAttribute("sortDirection");

  // show the twisties if the view is threaded
  var threadCol = document.getElementById("threadCol");
  var subjectCol = document.getElementById("subjectCol");
  var sortedColumn;
  // set the sort indicator on the column we are sorted by
  var colID = ConvertSortTypeToColumnID(sortType);
  if (colID)
    sortedColumn = document.getElementById(colID);

  var viewWrapper = gFolderDisplay.view;

  // the thread column is not visible when we are grouped by sort
  document.getElementById("threadCol").collapsed = viewWrapper.showGroupedBySort;

  // show twisties only when grouping or threading
  if (viewWrapper.showGroupedBySort || viewWrapper.showThreaded)
    subjectCol.setAttribute("primary", "true");
  else
    subjectCol.removeAttribute("primary");

  // If threading, set the sort direction on the thread column which causes it
  //  to be able to 'light up' or otherwise indicate threading is active.
  if (viewWrapper.showThreaded)
    threadCol.setAttribute("sortDirection", "ascending");

  if (sortedColumn)
    sortedColumn.setAttribute("sortDirection",
                              sortOrder == nsMsgViewSortOrder.ascending ?
                                "ascending" : "descending");
}

function IsSpecialFolderSelected(flags, checkAncestors)
{
  let folder = GetThreadPaneFolder();
  return folder && folder.isSpecialFolder(flags, checkAncestors);
}

function GetThreadTree()
{
  return document.getElementById("threadTree")
}

function GetThreadPaneFolder()
{
  try {
    return gDBView.msgFolder;
  }
  catch (ex) {
    return null;
  }
}

function ThreadPaneOnLoad()
{
  var tree = GetThreadTree();
  // We won't have the tree if we're in a message window, so exit silently
  if (!tree)
    return;

  tree.addEventListener("click",ThreadPaneOnClick,true);

  // The mousedown event listener below should only be added in the thread
  // pane of the mailnews 3pane window, not in the advanced search window.
  if(tree.parentNode.id == "searchResultListBox")
    return;

  tree.addEventListener("mousedown",TreeOnMouseDown,true);
  let delay = pref.getIntPref("mailnews.threadpane_select_delay");
  document.getElementById("threadTree")._selectDelay = delay;
}

function ThreadPaneSelectionChanged()
{
  UpdateStatusMessageCounts(gFolderDisplay.displayedFolder);
  GetThreadTree().view.selectionChanged();
}

addEventListener("load",ThreadPaneOnLoad,true);
