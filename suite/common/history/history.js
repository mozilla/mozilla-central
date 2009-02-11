/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
 *   Seth Spitzer <sspizer@mozilla.org> (port to Places)
 *   Asaf Romano <mano@mozilla.com>
 *   Robert Kaiser <kairo@kairo.at>
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

var gHistoryTree;
var gLastHostname;
var gLastDomain;
var gSearchBox;
var gPrefService;
var gIOService;
var gETLDService;
var gDeleteByHostname;
var gDeleteByDomain;
var gHistoryStatus;
var gHistoryGrouping = "day";

function HistoryCommonInit()
{
  gHistoryTree = document.getElementById("historyTree");
  gDeleteByHostname = document.getElementById("menu_deleteByHostname");
  gDeleteByDomain = document.getElementById("menu_deleteByDomain");
  gHistoryStatus = document.getElementById("statusbar-display");
  gSearchBox = document.getElementById("search-box");

  gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
  PREF = gPrefService;    // need this for bookmarks.js

  try {
    gHistoryGrouping = gPrefService.getCharPref("browser.history.grouping");
  } catch (e) {}

  document.getElementById("GroupBy" + gHistoryGrouping[0].toUpperCase() +
                                      gHistoryGrouping.slice(1))
          .setAttribute("checked", "true");

  searchHistory("");

  if (gHistoryStatus)
    gHistoryTree.focus();

  if (gHistoryTree.view.rowCount > 0)
    gHistoryTree.view.selection.select(0);
  else if (gHistoryStatus)
    updateHistoryCommands();
}

function updateHistoryCommands()
{
  document.commandDispatcher.updateCommands("select");
  goUpdateCommand("placesCmd_open");
  goUpdateCommand("placesCmd_open:window");
  goUpdateCommand("placesCmd_open:tab");
  goUpdateCommand("placesCmd_delete:hostname");
  goUpdateCommand("placesCmd_delete:domain");
}

function historyOnSelect()
{
  gLastHostname = null;
  gLastDomain = null;
  var url = null;

  var selectedNode = gHistoryTree.selectedNode;
  if (selectedNode) {
    if (PlacesUtils.nodeIsURI(selectedNode)) {
      try {
        url = selectedNode.uri;
        if (!gIOService)
          gIOService = Components.classes["@mozilla.org/network/io-service;1"]
                                 .getService(Components.interfaces.nsIIOService);
        gLastHostname = gIOService.newURI(url, null, null).host;
      } catch (e) {}
    } else if (PlacesUtils.nodeIsHost(selectedNode)) {
      gLastHostname = selectedNode.title;
    }
    if (gLastHostname) {
      try {
        if (!gETLDService)
          gETLDService =
            Components.classes["@mozilla.org/network/effective-tld-service;1"]
                      .getService(Components.interfaces.nsIEffectiveTLDService);
        gLastDomain = gETLDService.getBaseDomainFromHost(gLastHostname);
      } catch (e) {}
    }
  }

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
  gPrefService.setCharPref("browser.history.grouping", gHistoryGrouping);
  searchHistory("");
}

// we need bookmarks.js to set bookmarks!
function historyAddBookmarks()
{
  var count = gHistoryTree.view.selection.count;
  if (count == 1)
    BookmarksUtils.addBookmark(gHistoryTree.selectedNode.uri,
                               gHistoryTree.selectedNode.title, null, true);
  else if (count > 1) {
    if (!BMSVC) {
      initServices();
      initBMService();
    }
    selNodes = gHistoryTree.getSelectionNodes();
    for (var i = 0; i < selNodes.length; i++) {
      if (PlacesUtils.nodeIsURI(selNodes[i]))
        BookmarksUtils.addBookmark(selNodes[i].uri, selNodes[i].title, null, false);
    }
  }
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
