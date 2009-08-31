/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Karsten Düsterloh <mnyromyr@tprac.de>
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
  // we may want to open the message in a new tab on middle click
  if (event.button == kMouseButtonMiddle)
  {
    if (AllowOpenTabOnMiddleClick())
    {
      // we don't allow new tabs in the search dialog
      if ("RestoreSelectionWithoutContentLoad" in window)
      {
        MsgOpenNewTabForMessage();
        RestoreSelectionWithoutContentLoad(GetThreadTree());
      }
      return;
    }
  }

  // otherwise, we only care about left click events
  if (event.button != kMouseButtonLeft)
    return;

  // We are already handling marking as read and flagging in nsMsgDBView.cpp,
  // so all we need to worry about here is double clicks and column header.
  // We also get in here for clicks on the "treecol" (headers) and the
  // "scrollbarbutton" (scrollbar buttons), but we don't want those events to
  // cause a "double click".
  var t = event.originalTarget;
  if (t.localName == "treecol")
  {
    HandleColumnClick(t.id);
  }
  else if (t.localName == "treechildren")
  {
    let row = {}, col = {}, childElt = {};
    let tree = GetThreadTree();
    // figure out what cell the click was in
    tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, childElt);
    if (row.value == -1)
      return;

    // If the cell is in a "cycler" column or if the user double clicked on the
    // twisty, don't open the message in a new window.
    if (event.detail == 2 && !col.value.cycler && (childElt.value != "twisty"))
    {
      ThreadPaneDoubleClick();
      // Double clicking should not toggle the open/close state of the thread.
      // This will happen if we don't prevent the event from bubbling to the
      // default handler in tree.xml.
      event.stopPropagation();
    }
    else if (col.value.id == "junkStatusCol")
    {
      MsgJunkMailInfo(true);
    }
    else if (col.value.id == "threadCol" && !event.shiftKey && (event.ctrlKey || event.metaKey))
    {
      gDBView.ExpandAndSelectThreadByIndex(row.value, true);
      event.stopPropagation();
    }
  }
}

function nsMsgDBViewCommandUpdater()
{}

nsMsgDBViewCommandUpdater.prototype = 
{
  updateCommandStatus : function()
    {
      // the back end is smart and is only telling us to update command status
      // when the # of items in the selection has actually changed.
      UpdateMailToolbar("dbview driven, thread pane");
    },

  displayMessageChanged : function(aFolder, aSubject, aKeywords)
  {
    if (!gDBView.suppressMsgDisplay)
      setTitleFromFolder(aFolder, aSubject);
    ClearPendingReadTimer(); // we are loading / selecting a new message so kill the mark as read timer for the currently viewed message
    gHaveLoadedMessage = true;
    goUpdateCommand("button_delete");
    goUpdateCommand("button_junk");
  },

  updateNextMessageAfterDelete : function()
  {
    SetNextMessageAfterDelete();
  },

  summarizeSelection: function() {return false},

  QueryInterface : function(iid)
   {
     if (iid.equals(Components.interfaces.nsIMsgDBViewCommandUpdater) ||
         iid.equals(Components.interfaces.nsISupports))
       return this;
	  
     throw Components.results.NS_NOINTERFACE;
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

      // it exists - save this column ID in the customSortCol property of
      // dbFolderInfo for later use (see nsIMsgDBView.cpp)
      gDBView.db.dBFolderInfo.setProperty('customSortCol', columnID);
        
      sortType = "byCustom";
    } catch(err) {
        dump("unsupported sort column: " + columnID + " - no custom handler installed. (Error was: " + err + ")\n");
        return; // bail out
    }
  }

  var dbview = GetDBView();
  var simpleColumns = false;
  try {
    simpleColumns = !pref.getBoolPref("mailnews.thread_pane_column_unthreads");
  }
  catch (ex) {
  }
  if (sortType == "byThread") {
    if (simpleColumns)
      MsgToggleThreaded();
    else if (dbview.viewFlags & nsMsgViewFlagsType.kThreadedDisplay)
      MsgReverseSortThreadPane();
    else
      MsgSortByThread();
  }
  else {
    if (!simpleColumns && (dbview.viewFlags & nsMsgViewFlagsType.kThreadedDisplay)) {
      dbview.viewFlags &= ~nsMsgViewFlagsType.kThreadedDisplay;
      MsgSortThreadPane(sortType);
    }
    else if (dbview.sortType == nsMsgViewSortType[sortType]) {
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
  if (IsSpecialFolderSelected(nsMsgFolderFlags.Drafts, true))
  {
    MsgComposeDraftMessage();
  }
  else if(IsSpecialFolderSelected(nsMsgFolderFlags.Templates, true))
  {
    var loadedFolder = GetLoadedMsgFolder();
    var messageArray = GetSelectedMessages();
    ComposeMessage(Components.interfaces.nsIMsgCompType.Template,
                   Components.interfaces.nsIMsgCompFormat.Default,
                   loadedFolder, messageArray);
  }
  else if (AllowOpenTabOnDoubleClick())
  {
    // open the message in a new tab on double click
    MsgOpenNewTabForMessage();
    RestoreSelectionWithoutContentLoad(GetThreadTree());
  }
  else
  {
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
  var dbview = GetDBView();
  dbview.viewFlags |= nsMsgViewFlagsType.kThreadedDisplay;
  dbview.viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
  MsgSortThreadPane('byDate');
}

function MsgSortThreadPane(sortName)
{
  var sortType = nsMsgViewSortType[sortName];
  var dbview = GetDBView();

  // turn off grouping
  dbview.viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;

  dbview.sort(sortType, nsMsgViewSortOrder.ascending);
  UpdateSortIndicators(sortType, nsMsgViewSortOrder.ascending);
}

function MsgReverseSortThreadPane()
{
  var dbview = GetDBView();
  if (dbview.sortOrder == nsMsgViewSortOrder.ascending) {
    MsgSortDescending();
  }
  else {
    MsgSortAscending();
  }
}

function MsgToggleThreaded()
{
    var dbview = GetDBView();
    var newViewFlags = dbview.viewFlags ^ nsMsgViewFlagsType.kThreadedDisplay;
    newViewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
    dbview.viewFlags = newViewFlags;

    dbview.sort(dbview.sortType, dbview.sortOrder);
    UpdateSortIndicators(dbview.sortType, dbview.sortOrder);
}

function MsgSortThreaded()
{
    var dbview = GetDBView();
    var viewFlags = dbview.viewFlags;
    let wasGrouped = viewFlags & nsMsgViewFlagsType.kGroupBySort;
    dbview.viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
    // if we were grouped, and not a saved search, just rebuild the view
    if (wasGrouped && !(gMsgFolderSelected.flags & 
                       Components.interfaces.nsMsgFolderFlags.Virtual))
      SwitchView("cmd_viewAllMsgs");
    // Toggle if not already threaded.
    else if ((viewFlags & nsMsgViewFlagsType.kThreadedDisplay) == 0)
        MsgToggleThreaded();
}

function MsgGroupBySort()
{
  var dbview = GetDBView();
  var viewFlags = dbview.viewFlags;
  var sortOrder = dbview.sortOrder;
  var sortType = dbview.sortType;
  var count = new Object;
  var msgFolder = dbview.msgFolder;

  var sortTypeSupportsGrouping = (sortType == nsMsgViewSortType.byAuthor 
         || sortType == nsMsgViewSortType.byDate || sortType == nsMsgViewSortType.byReceived || sortType == nsMsgViewSortType.byPriority
         || sortType == nsMsgViewSortType.bySubject || sortType == nsMsgViewSortType.byTags
         || sortType == nsMsgViewSortType.byStatus  || sortType == nsMsgViewSortType.byRecipient
         || sortType == nsMsgViewSortType.byAccount || sortType == nsMsgViewSortType.byFlagged
         || sortType == nsMsgViewSortType.byAttachments);

  if (!sortTypeSupportsGrouping)
    return; // we shouldn't be trying to group something we don't support grouping for...

  viewFlags |= nsMsgViewFlagsType.kThreadedDisplay | nsMsgViewFlagsType.kGroupBySort;
  if (gDBView &&
      gMsgFolderSelected.flags & Components.interfaces.nsMsgFolderFlags.Virtual)
  {
    gDBView.viewFlags = viewFlags;
    UpdateSortIndicators(sortType, nsMsgViewSortOrder.ascending);
    return;
  }
  // null this out, so we don't try sort.
  if (gDBView) {
    gDBView.close();
    gDBView = null;
  }
  gDBView = Components.classes["@mozilla.org/messenger/msgdbview;1?type=group"]
                                .createInstance(Components.interfaces.nsIMsgDBView);

  if (!gThreadPaneCommandUpdater)
    gThreadPaneCommandUpdater = new nsMsgDBViewCommandUpdater();


  gDBView.init(messenger, msgWindow, gThreadPaneCommandUpdater);
  gDBView.open(msgFolder, sortType, sortOrder, viewFlags, count);
  RerootThreadPane();
  UpdateSortIndicators(sortType, nsMsgViewSortOrder.ascending);
  Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .notifyObservers(msgFolder, "MsgCreateDBView",
             Components.interfaces.nsMsgViewType.eShowAllThreads + ":" + viewFlags);
}

function MsgSortUnthreaded()
{
    // Toggle if not already unthreaded.
    if ((GetDBView().viewFlags & nsMsgViewFlagsType.kThreadedDisplay) != 0)
        MsgToggleThreaded();
}

function MsgSortAscending()
{
  var dbview = GetDBView();
  dbview.sort(dbview.sortType, nsMsgViewSortOrder.ascending);
  UpdateSortIndicators(dbview.sortType, nsMsgViewSortOrder.ascending);
}

function MsgSortDescending()
{
  var dbview = GetDBView();
  dbview.sort(dbview.sortType, nsMsgViewSortOrder.descending);
  UpdateSortIndicators(dbview.sortType, nsMsgViewSortOrder.descending);
}

function groupedBySortUsingDummyRow()
{
  return (gDBView.viewFlags & nsMsgViewFlagsType.kGroupBySort) && 
         (gDBView.sortType != nsMsgViewSortType.bySubject);
}

function UpdateSortIndicators(sortType, sortOrder)
{
  // Remove the sort indicator from all the columns
  var treeColumns = document.getElementById('threadCols').childNodes;
  for (var i = 0; i < treeColumns.length; i++)
    treeColumns[i].removeAttribute('sortDirection');

  // show the twisties if the view is threaded
  var threadCol = document.getElementById("threadCol");
  var sortedColumn;
  // set the sort indicator on the column we are sorted by
  var colID = ConvertSortTypeToColumnID(sortType);
  if (colID)
    sortedColumn = document.getElementById(colID);

  var dbview = GetDBView();
  var currCol = dbview.viewFlags & nsMsgViewFlagsType.kGroupBySort 
    ? sortedColumn : document.getElementById("subjectCol");

  if (dbview.viewFlags & nsMsgViewFlagsType.kGroupBySort)
  {
    var threadTree = document.getElementById("threadTree");  
    var subjectCol = document.getElementById("subjectCol");

    if (groupedBySortUsingDummyRow())
    {
      currCol.removeAttribute("primary");
      subjectCol.setAttribute("primary", "true");
    }

    // hide the threaded column when in grouped view since you can't do 
    // threads inside of a group.
    document.getElementById("threadCol").collapsed = true;
  }

  // clear primary attribute from group column if going to a non-grouped view.
  if (!(dbview.viewFlags & nsMsgViewFlagsType.kGroupBySort))
    document.getElementById("threadCol").collapsed = false;

  if ((dbview.viewFlags & nsMsgViewFlagsType.kThreadedDisplay) && !groupedBySortUsingDummyRow()) {
    threadCol.setAttribute("sortDirection", "ascending");
    currCol.setAttribute("primary", "true");
  }
  else {
    threadCol.removeAttribute("sortDirection");
    currCol.removeAttribute("primary");
  }

  if (sortedColumn) {
    if (sortOrder == nsMsgViewSortOrder.ascending) {
      sortedColumn.setAttribute("sortDirection","ascending");
    }
    else {
      sortedColumn.setAttribute("sortDirection","descending");
    }
  }
}

function IsSpecialFolderSelected(flags, checkAncestors)
{
  var folder = GetThreadPaneFolder();
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

function EnsureRowInThreadTreeIsVisible(index)
{
  if (index < 0)
    return;

  var tree = GetThreadTree();
  tree.treeBoxObject.ensureRowIsVisible(index); 
}

function RerootThreadPane()
{
  SetNewsFolderColumns();

  var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
  if (treeView)
  {
    var tree = GetThreadTree();
    tree.boxObject.QueryInterface(Components.interfaces.nsITreeBoxObject).view = treeView;
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
  var delay = pref.getIntPref("mailnews.threadpane_select_delay");
  document.getElementById("threadTree")._selectDelay = delay;
}

function ThreadPaneSelectionChanged()
{
  UpdateStatusMessageCounts(gMsgFolderSelected);
  if (!gRightMouseButtonDown)
    GetThreadTree().view.selectionChanged();
}

addEventListener("load",ThreadPaneOnLoad,true);
