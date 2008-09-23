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
 * The Original Code is Mozilla addressbook.
 *
 * The Initial Developer of the Original Code is
 * Seth Spitzer <sspitzer@netscape.com>.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
 * Use of items in this file require:
 *
 * gSearchInput
 *   global variable to be set up pointing to the search input box
 * GetSelectedDirectory()
 *   returns the URI of the selected directory
 * AbResultsPaneDoubleClick(card)
 *   Is called when the results pane is double-clicked, with the clicked card.
 * AbEditCard(card)
 *   Is called when a card is to be edited, with the card as the parameter.
 *
 * The following function is only required if ResultsPaneController is used:
 * 
 * goSetMenuValue()
 *   Core function in globalOverlay.js
 */

// List/card selections in the results pane.
const kNothingSelected = 0;
const kListsAndCards = 1;
const kMultipleListsOnly = 2;
const kSingleListOnly = 3;
const kCardsOnly = 4;

// Global Variables

// gAbView holds an object with an nsIAbView interface
var gAbView = null;
// Holds a reference to the "abResultsTree" document element. Initially
// set up by SetAbView.
var gAbResultsTree = null;

function SetAbView(aURI)
{
  // If we don't have a URI, just clear the view and leave everything else
  // alone.
  if (!aURI) {
    gAbView.clearView();
    return;
  }

  // If we do have a URI, we want to allow updating the review even if the
  // URI is the same, as the search results may be different.

  var sortColumn = kDefaultSortColumn;
  var sortDirection = kDefaultAscending;

  if (!gAbResultsTree) {
    gAbResultsTree = document.getElementById("abResultsTree");
    gAbResultsTree.controllers.appendController(ResultsPaneController);
  }

  if (gAbView) {
    sortColumn = gAbView.sortColumn;
    sortDirection = gAbView.sortDirection;
  }
  else {
    if (gAbResultsTree.hasAttribute("sortCol"))
      sortColumn = gAbResultsTree.getAttribute("sortCol");
    if (gAbResultsTree.hasAttribute("sortDirection"))
      sortDirection = gAbResultsTree.getAttribute("sortDirection");
  }

  var directory = GetDirectoryFromURI(aURI);

  if (!gAbView)
    gAbView = Components.classes["@mozilla.org/addressbook/abview;1"]
                        .createInstance(Components.interfaces.nsIAbView);

  var actualSortColumn = gAbView.setView(directory, GetAbViewListener(),
					 sortColumn, sortDirection);

  gAbResultsTree.treeBoxObject.view =
    gAbView.QueryInterface(Components.interfaces.nsITreeView);

  UpdateSortIndicators(actualSortColumn, sortDirection);
}

function CloseAbView()
{
  if (gAbView)
    gAbView.clearView();
}

function GetOneOrMoreCardsSelected()
{
  return (gAbView && (gAbView.selection.getRangeCount() > 0));
}

function GetSelectedAddresses()
{
  return GetAddressesForCards(GetSelectedAbCards());
}

function GetNumSelectedCards()
{
 try {
   return gAbView.selection.count;
 }
 catch (ex) {
 }

 // if something went wrong, return 0 for the count.
 return 0;
}

function GetSelectedCardTypes()
{
  var cards = GetSelectedAbCards();
  if (!cards)
    return kNothingSelected; // no view

  var count = cards.length;
  if (count == 0)
    return kNothingSelected;  // nothing selected

  var mailingListCnt = 0;
  var cardCnt = 0;
  for (var i = 0; i < count; i++) {
    if (cards[i].isMailList)
      mailingListCnt++;
    else
      cardCnt++;
  }
  return (mailingListCnt == 0) ? kCardsOnly :
           (cardCnt > 0) ? kListsAndCards :
             (mailingListCnt == 1) ? kSingleListOnly :
               kMultipleListsOnly;
}

// NOTE, will return -1 if more than one card selected, or no cards selected.
function GetSelectedCardIndex()
{
  if (!gAbView)
    return -1;

  var treeSelection = gAbView.selection;
  if (treeSelection.getRangeCount() == 1) {
    var start = new Object;
    var end = new Object;
    treeSelection.getRangeAt(0, start, end);
    if (start.value == end.value)
      return start.value;
  }

  return -1;
}

// NOTE, returns the card if exactly one card is selected, null otherwise
function GetSelectedCard()
{
  var index = GetSelectedCardIndex();
  return (index == -1) ? null : gAbView.getCardFromRow(index);
}

function GetSelectedAbCards()
{
  var abView = gAbView;

  // if sidebar is open, and addressbook panel is open and focused,
  // then use the ab view from sidebar (gCurFrame is from sidebarOverlay.js)
  if (document.getElementById("sidebar-box")) {
    const abPanelUrl =
            "chrome://messenger/content/addressbook/addressbook-panel.xul";
    if (gCurFrame && 
        gCurFrame.getAttribute("src") == abPanelUrl &&
        document.commandDispatcher.focusedWindow == gCurFrame.contentDocument.defaultView)
      abView = gCurFrame.contentDocument.defaultView.gAbView;
  }

  if (!abView)
    return null;

  var cards = new Array(abView.selection.count);
  var i, j;
  var count = abView.selection.getRangeCount();
  var current = 0;
  for (i = 0; i < count; ++i) {
    var start = new Object;
    var end = new Object;
    abView.selection.getRangeAt(i,start,end);
    for (j = start.value; j <= end.value; ++j)
      cards[current++] = abView.getCardFromRow(j);
  }
  return cards;
}

// XXX todo
// an optimization might be to make this return
// the selected ranges, which would be faster
// when the user does large selections, but for now, let's keep it simple.
function GetSelectedRows()
{
  var selectedRows = "";

  if (!gAbView)
    return selectedRows;

  var i, j;
  var rangeCount = gAbView.selection.getRangeCount();
  for (i = 0; i < rangeCount; ++i) {
    var start = new Object;
    var end = new Object;
    gAbView.selection.getRangeAt(i, start, end);
    for (j = start.value;j <= end.value; ++j) {
      if (selectedRows)
        selectedRows += ",";
      selectedRows += j;
    }
  }

  return selectedRows;
}

function AbSwapFirstNameLastName()
{
  if (gAbView)
    gAbView.swapFirstNameLastName();
}

function AbEditSelectedCard()
{
  AbEditCard(GetSelectedCard());
}

function AbResultsPaneOnClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0) return;

  // all we need to worry about here is double clicks
  // and column header clicks.
  //
  // we get in here for clicks on the "treecol" (headers)
  // and the "scrollbarbutton" (scrollbar buttons)
  // we don't want those events to cause a "double click"

  var t = event.originalTarget;

  if (t.localName == "treecol") {
    var sortDirection;
    var currentDirection = t.getAttribute("sortDirection");

    sortDirection = currentDirection == kDefaultDescending ?
                                        kDefaultAscending : kDefaultDescending;

    SortAndUpdateIndicators(t.id, sortDirection);
  }
  else if (t.localName == "treechildren") {
    // figure out what row the click was in
    var row = gAbResultsTree.treeBoxObject.getRowAt(event.clientX,
						    event.clientY);
    if (row == -1)
      return;

    if (event.detail == 2)
      AbResultsPaneDoubleClick(gAbView.getCardFromRow(row));
  }
}

function AbSortAscending()
{
  var sortColumn = gAbResultsTree.getAttribute("sortCol");
  SortAndUpdateIndicators(sortColumn, kDefaultAscending);
}

function AbSortDescending()
{
  var sortColumn = gAbResultsTree.getAttribute("sortCol");
  SortAndUpdateIndicators(sortColumn, kDefaultDescending);
}

function SortResultPane(sortColumn)
{
  var sortDirection = kDefaultAscending;
  if (gAbView)
     sortDirection = gAbView.sortDirection;

  SortAndUpdateIndicators(sortColumn, sortDirection);
}

function SortAndUpdateIndicators(sortColumn, sortDirection)
{
  UpdateSortIndicators(sortColumn, sortDirection);

  if (gAbView)
    gAbView.sortBy(sortColumn, sortDirection);
}

function UpdateSortIndicators(colID, sortDirection)
{
  var sortedColumn = null;

  // set the sort indicator on the column we are sorted by
  if (colID) {
    sortedColumn = document.getElementById(colID);
    if (sortedColumn) {
      sortedColumn.setAttribute("sortDirection",sortDirection);
      gAbResultsTree.setAttribute("sortCol", colID);
    }
  }

  // remove the sort indicator from all the columns
  // except the one we are sorted by
  var currCol = gAbResultsTree.firstChild.firstChild;
  while (currCol) {
    if (currCol != sortedColumn && currCol.localName == "treecol")
      currCol.removeAttribute("sortDirection");
    currCol = currCol.nextSibling;
  }
}

function InvalidateResultsPane()
{
  if (gAbResultsTree)
    gAbResultsTree.treeBoxObject.invalidate();
}

// Controller object for Results Pane
var ResultsPaneController =
{
  supportsCommand: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
      case "cmd_delete":
      case "button_delete":
      case "button_edit":
      case "cmd_newlist":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
        return true;
      case "cmd_delete":
      case "button_delete":
        var numSelected;
        var enabled = false;
        if (gAbView && gAbView.selection) {
          if (gAbView.directory)
            enabled = !gAbView.directory.readOnly;
          numSelected = gAbView.selection.count;
        }
        else
          numSelected = 0;

        // fix me, don't update on isCommandEnabled
        if (command == "cmd_delete") {
          switch (GetSelectedCardTypes()) {
            case kSingleListOnly:
              goSetMenuValue(command, "valueList");
              break;
            case kMultipleListsOnly:
              goSetMenuValue(command, "valueLists");
              break;
            case kListsAndCards:
              goSetMenuValue(command, "valueItems");
              break;
            case kCardsOnly:
            default:
              if (numSelected < 2)
                goSetMenuValue(command, "valueCard");
              else
                goSetMenuValue(command, "valueCards");
              break;
          }
        }
        return (enabled && (numSelected > 0));
      case "button_edit":
        return (GetSelectedCardIndex() != -1);
      case "cmd_newlist":
        var selectedDir = GetSelectedDirectory();
        if (selectedDir) {
          var abDir = GetDirectoryFromURI(selectedDir);
          if (abDir) {
            return abDir.supportsMailingLists;
          }
        }
        return false;
      default:
        return false;
    }
  },

  doCommand: function(command)
  {
    switch (command) {
      case "cmd_selectAll":
        if (gAbView)
          gAbView.selectAll();
        break;
      case "cmd_delete":
      case "button_delete":
        AbDelete();
        break;
      case "button_edit":
        AbEditSelectedCard();
        break;
      case "cmd_newlist":
        AbNewList();
        break;
    }
  },

  onEvent: function(event)
  {
    // on blur events set the menu item texts back to the normal values
    if (event == "blur")
      goSetMenuValue("cmd_delete", "valueDefault");
  }
};

function SelectFirstCard()
{
  if (gAbView && gAbView.selection)
    gAbView.selection.select(0);
}
