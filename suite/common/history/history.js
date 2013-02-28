/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gHistoryTree;
var gLastHostname;
var gLastDomain;
var gSearchBox;
var gDeleteByHostname;
var gDeleteByDomain;
var gHistoryStatus;
var gHistoryGrouping = "day";

function HistoryCommonInit()
{
  gHistoryTree = document.getElementById("historyTree");
  gDeleteByHostname = document.getElementById("placesCmd_delete:hostname");
  gDeleteByDomain = document.getElementById("placesCmd_delete:domain");
  gHistoryStatus = document.getElementById("statusbar-display");
  gSearchBox = document.getElementById("search-box");

  try {
    gHistoryGrouping = Services.prefs.getCharPref("browser.history.grouping");
  } catch (e) {}

  document.getElementById("GroupBy" + gHistoryGrouping[0].toUpperCase() +
                                      gHistoryGrouping.slice(1))
          .setAttribute("checked", "true");

  searchHistory("");

  if (gHistoryStatus)
    gHistoryTree.focus();

  if (gHistoryTree.view.rowCount > 0)
    gHistoryTree.view.selection.select(0);
}

function updateHistoryCommands(aCommand)
{
  document.commandDispatcher.updateCommands("select");
  for (; aCommand; aCommand = aCommand.nextSibling)
    goUpdateCommand(aCommand.id);
}

function historyOnSelect()
{
  gLastHostname = null;
  gLastDomain = null;
  var url = "";

  var selectedNode = gHistoryTree.selectedNode;
  if (selectedNode) {
    if (PlacesUtils.nodeIsURI(selectedNode)) {
      try {
        url = selectedNode.uri;
        gLastHostname = Services.io.newURI(url, null, null).host;
      } catch (e) {}
    } else if (PlacesUtils.nodeIsHost(selectedNode)) {
      gLastHostname = selectedNode.title;
    }
    if (gLastHostname) {
      try {
        gLastDomain = Services.eTLD.getBaseDomainFromHost(gLastHostname);
      } catch (e) {}
    }
  }

  if (gHistoryStatus)
    gHistoryStatus.label = url;

  updateHistoryCommands();
}

function UpdateViewColumns(aMenuItem)
{
  while (aMenuItem) {
    // Each menuitem should be checked if its column is not hidden.
    var colid = aMenuItem.id.replace(/Toggle/, "");
    var column = document.getElementById(colid);
    aMenuItem.setAttribute("checked", !column.hidden);
    aMenuItem = aMenuItem.nextSibling;
  }
}

function UpdateViewSort(aMenuItem)
{
  // Note: consider building this by reading the result's sortingMode instead.
  var unsorted = true;
  var ascending = true;
  while (aMenuItem) {
    switch (aMenuItem.id) {
      case "": // separator
        break;
      case "Unsorted":
        if (unsorted) // this would work even if Unsorted was last
          aMenuItem.setAttribute("checked", "true");
        break;
      case "SortAscending":
        aMenuItem.setAttribute("disabled", unsorted);
        if (ascending)
          aMenuItem.setAttribute("checked", "true");
        break;
      case "SortDescending":
        aMenuItem.setAttribute("disabled", unsorted);
        if (!ascending)
          aMenuItem.setAttribute("checked", "true");
        break;
      default:
        var colid = aMenuItem.id.replace(/SortBy/, "");
        var column = document.getElementById(colid);
        var direction = column.getAttribute("sortDirection");
        if (direction) {
          // We've found a sorted column. Remember its direction.
          ascending = direction == "ascending";
          unsorted = false;
          aMenuItem.setAttribute("checked", "true");
        }
    }
    aMenuItem = aMenuItem.nextSibling;
  }
}

function ToggleColumn(aMenuItem)
{
  var colid = aMenuItem.id.replace(/Toggle/, "");
  var column = document.getElementById(colid);
  column.setAttribute("hidden", !column.hidden);
}

function GroupBy(aMenuItem)
{
  gSearchBox.value = "";
  gHistoryGrouping = aMenuItem.id.replace(/GroupBy/, "").toLowerCase();
  Services.prefs.setCharPref("browser.history.grouping", gHistoryGrouping);
  searchHistory("");
}

function historyAddBookmarks()
{
  // HACK: as we're importing the actual PlacesUIUtils but that name is taken
  // by a cut-down history-specific version, store that latter one temporarily
  var HistoryUtils = PlacesUIUtils;
  Components.utils.import("resource:///modules/PlacesUIUtils.jsm");
  var count = gHistoryTree.view.selection.count;
  if (count == 1)
    PlacesUIUtils.showMinimalAddBookmarkUI(PlacesUtils._uri(gHistoryTree.selectedNode.uri),
                                           gHistoryTree.selectedNode.title);
  else if (count > 1) {
    selNodes = gHistoryTree.getSelectionNodes();
    var tabList = [];
    for (var i = 0; i < selNodes.length; i++) {
      if (PlacesUtils.nodeIsURI(selNodes[i]))
        tabList.push(PlacesUtils._uri(selNodes[i].uri));
    }
    PlacesUIUtils.showMinimalAddMultiBookmarkUI(tabList);
  }
  // restore the PlacesUIUtils the history UI actually wants
  PlacesUIUtils = HistoryUtils;
}

function searchHistory(aInput)
{
  var query = PlacesUtils.history.getNewQuery();
  var options = PlacesUtils.history.getNewQueryOptions();

  const NHQO = Components.interfaces.nsINavHistoryQueryOptions;
  options.sortingMode = gHistoryTree.sortingMode;
  options.queryType = NHQO.QUERY_TYPE_HISTORY;

  if (aInput) {
    query.searchTerms = aInput;
    options.resultType = NHQO.RESULTS_AS_URI;
  }
  else {
    switch (gHistoryGrouping) {
      case "none":
        options.resultType = NHQO.RESULTS_AS_URI;
        break;
      case "both":
        options.resultType = NHQO.RESULTS_AS_DATE_SITE_QUERY;
        break;
      case "site":
        options.resultType = NHQO.RESULTS_AS_SITE_QUERY;
        break;
      case "day":
        options.resultType = NHQO.RESULTS_AS_DATE_QUERY;
        break;
    }
  }

  var titleColumn = document.getElementById("Name");
  if (options.resultType == NHQO.RESULTS_AS_URI)
    titleColumn.removeAttribute("primary");
  else
    titleColumn.setAttribute("primary", "true");

  gHistoryTree.load([query], options);
}
