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
 * The Original Code is the SeaMonkey internet suite code.
 *
 * The Initial Developer of the Original Code is
 * the SeaMonkey project at mozilla.org.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://gre/modules/PluralForm.jsm");

const nsIDownloadManager = Components.interfaces.nsIDownloadManager;

const nsLocalFile = Components.Constructor("@mozilla.org/file/local;1",
                                           "nsILocalFile", "initWithPath");

var gDownloadTree;
var gDownloadTreeView;
var gDownloadManager = Components.classes["@mozilla.org/download-manager;1"]
                                 .getService(nsIDownloadManager);
var gDownloadStatus;
var gDownloadListener;
var gSearchBox;
var gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch);

function dmStartup()
{
  gDownloadTree = document.getElementById("downloadTree");
  gDownloadStatus = document.getElementById("statusbar-display");
  gSearchBox = document.getElementById("search-box");

  // Insert as first controller on the whole window
  window.controllers.insertControllerAt(0, dlTreeController);

  // We need to keep the oview object around globally to access "local"
  // non-nsITreeView methods
  gDownloadTreeView = new DownloadTreeView(gDownloadManager);
  gDownloadTree.view = gDownloadTreeView;

  let obs = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);
  obs.addObserver(gDownloadObserver, "download-manager-remove-download", false);

  // The DownloadProgressListener (DownloadProgressListener.js) handles
  // progress notifications.
  gDownloadListener = new DownloadProgressListener();
  gDownloadManager.addListener(gDownloadListener);

  // correct keybinding command attributes which don't do our business yet
  var key = document.getElementById("key_delete");
  if (key.hasAttribute("command"))
    key.setAttribute("command", "cmd_stop");
  key = document.getElementById("key_delete2");
  if (key.hasAttribute("command"))
    key.setAttribute("command", "cmd_stop");

  gDownloadTree.focus();

  if (gDownloadTree.view.rowCount > 0)
    gDownloadTree.view.selection.select(0);
}

function dmShutdown()
{
  gDownloadManager.removeListener(gDownloadListener);
  let obs = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);
  obs.removeObserver(gDownloadObserver, "download-manager-remove-download");
  window.controllers.removeController(dlTreeController);
}

function searchDownloads(aInput)
{
  gDownloadTreeView.searchView(aInput);
}

function sortDownloads(aEventTarget)
{
  var column = aEventTarget;
  var colID = column.id;
  var sortDirection = null;

  // If the target is a menuitem, handle it and forward to a column
  if (/^menu_SortBy/.test(colID)) {
    colID = colID.replace(/^menu_SortBy/, "");
    column = document.getElementById(colID);
    var sortedColumn = gDownloadTree.columns.getSortedColumn();
    if (sortedColumn && sortedColumn.id == colID)
      sortDirection = sortedColumn.element.getAttribute("sortDirection");
    else
      sortDirection = "ascending";
  }
  else if (colID == "menu_Unsorted") {
    // calling .sortView() with an "unsorted" colID returns us to original order
    colID = "unsorted";
    column = null;
    sortDirection = "ascending";
  }
  else if (colID == "menu_SortAscending" || colID == "menu_SortDescending") {
    sortDirection = colID.replace(/^menu_Sort/, "").toLowerCase();
    var sortedColumn = gDownloadTree.columns.getSortedColumn();
    if (sortedColumn) {
      colID = sortedColumn.id;
      column = sortedColumn.element;
    }
  }

  // Abort if this is still no column
  if (column && column.localName != "treecol")
    return;

  // Abort on cyler columns, we don't sort them
  if (column && column.getAttribute("cycler") == "true")
    return;

  if (!sortDirection) {
    // If not set above already, toggle the current direction
    sortDirection = column.getAttribute("sortDirection") == "ascending" ?
                    "descending" : "ascending";
  }

  // Clear attributes on all columns, we're setting them again after sorting
  for (let node = document.getElementById("Name"); node; node = node.nextSibling) {
    node.removeAttribute("sortActive");
    node.removeAttribute("sortDirection");
  }

  // Actually sort the tree view
  gDownloadTreeView.sortView(colID, sortDirection);

  if (column) {
    // Set attributes to the sorting we did
    column.setAttribute("sortActive", "true");
    column.setAttribute("sortDirection", sortDirection);
  }
}

function pauseDownload(aDownloadID)
{
  gDownloadManager.pauseDownload(aDownloadID);
}

function resumeDownload(aDownloadID)
{
  gDownloadManager.resumeDownload(aDownloadID);
}

function retryDownload(aDownloadID)
{
  gDownloadManager.retryDownload(aDownloadID);
  if (gDownloadTreeView)
    gDownloadTreeView.removeDownload(aDownloadID);
}

function cancelDownload(aDownload)
{
  gDownloadManager.cancelDownload(aDownload.id);
  // delete the file if it exists
  var file = aDownload.targetFile;
  if (file.exists())
    file.remove(false);
}

function removeDownload(aDownloadID)
{
  gDownloadManager.removeDownload(aDownloadID);
}

function openDownload(aDownload)
{
  var name = aDownload.displayName;
  var file = aDownload.targetFile;

  if (file.isExecutable()) {
    var alertOnEXEOpen = true;
    try {
      alertOnEXEOpen = gPrefService.getBoolPref("browser.download.manager.alertOnEXEOpen");
    } catch (e) { }

    // On Vista and above, we rely on native security prompting for
    // downloaded content.
    try {
      var sysInfo = Components.classes["@mozilla.org/system-info;1"]
                              .getService(Components.interfaces.nsIPropertyBag2);
      if (/^Windows/.test(sysInfo.getProperty("name")) &&
          (parseFloat(sysInfo.getProperty("version")) >= 6))
        alertOnEXEOpen = false;
    } catch (ex) { }

    if (alertOnEXEOpen) {
      var dlbundle = document.getElementById("dmBundle");
      var message = dlbundle.getFormattedString("fileExecutableSecurityWarning", [name, name]);

      var title = dlbundle.getString("fileExecutableSecurityWarningTitle");
      var dontAsk = dlbundle.getString("fileExecutableSecurityWarningDontAsk");

      var promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
      var checkbox = { value: false };
      var open = promptSvc.confirmCheck(window, title, message, dontAsk, checkbox);

      if (!open)
        return;
      gPrefService.setBoolPref("browser.download.manager.alertOnEXEOpen", !checkbox.value);
    }
  }
  try {
    file.launch();
  } catch (ex) {
    // If launch fails, try sending it through the system's external
    // file: URL handler
    var uri = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService)
                        .newFileURI(file);
    var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                .getService(Components.interfaces.nsIExternalProtocolService);
    protocolSvc.loadUrl(uri);
  }
}

function showDownload(aDownload)
{
  var file = aDownload.targetFile;

  try {
    // Show the directory containing the file and select the file
    file.reveal();
  } catch (e) {
    // If reveal fails for some reason (e.g., it's not implemented on unix or
    // the file doesn't exist), try using the parent if we have it.
    var parent = file.parent.QueryInterface(Components.interfaces.nsILocalFile);

    try {
      // "Double click" the parent directory to show where the file should be
      parent.launch();
    } catch (e) {
      // If launch also fails (probably because it's not implemented), let the
      // OS handler try to open the parent
      var uri = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService)
                          .newFileURI(parent);
      var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                  .getService(Components.interfaces.nsIExternalProtocolService);
      protocolSvc.loadUrl(uri);
    }
  }
}

function onTreeSelect(aEvent)
{
  var selectionCount = gDownloadTreeView.selection.count;
  if (selectionCount == 1) {
    var selItemData = gDownloadTreeView.getRowData(gDownloadTree.currentIndex);
    var file = getLocalFileFromNativePathOrUrl(selItemData.file);
    gDownloadStatus.label = file.path;
  } else {
    gDownloadStatus.label = "";
  }

  window.updateCommands("tree-select");
}

function onUpdateViewColumns(aMenuItem)
{
  while (aMenuItem) {
    // Each menuitem should be checked if its column is not hidden.
    var colID = aMenuItem.id.replace(/^menu_Toggle/, "");
    var column = document.getElementById(colID);
    aMenuItem.setAttribute("checked", !column.hidden);
    aMenuItem = aMenuItem.nextSibling;
  }
}

function toggleColumn(aMenuItem)
{
  var colID = aMenuItem.id.replace(/^menu_Toggle/, "");
  var column = document.getElementById(colID);
  column.setAttribute("hidden", !column.hidden);
}

function onUpdateViewSort(aMenuItem)
{
  var unsorted = true;
  var ascending = true;
  while (aMenuItem) {
    switch (aMenuItem.id) {
      case "": // separator
        break;
      case "menu_Unsorted":
        if (unsorted) // this would work even if Unsorted was last
          aMenuItem.setAttribute("checked", "true");
        break;
      case "menu_SortAscending":
        aMenuItem.setAttribute("disabled", unsorted);
        if (!unsorted && ascending)
          aMenuItem.setAttribute("checked", "true");
        break;
      case "menu_SortDescending":
        aMenuItem.setAttribute("disabled", unsorted);
        if (!unsorted && !ascending)
          aMenuItem.setAttribute("checked", "true");
        break;
      default:
        var colID = aMenuItem.id.replace(/^menu_SortBy/, "");
        var column = document.getElementById(colID);
        var direction = column.getAttribute("sortDirection");
        if (column.getAttribute("sortActive") == "true" && direction) {
          // We've found a sorted column. Remember its direction.
          ascending = direction == "ascending";
          unsorted = false;
          aMenuItem.setAttribute("checked", "true");
        }
    }
    aMenuItem = aMenuItem.nextSibling;
  }
}

// This is called by the progress listener.
var gLastComputedMean = -1;
var gLastActiveDownloads = 0;
function onUpdateProgress()
{
  var numActiveDownloads = gDownloadManager.activeDownloadCount;

  // Use the default title and reset "last" values if there's no downloads
  if (numActiveDownloads == 0) {
    document.title = document.documentElement.getAttribute("statictitle");
    gLastComputedMean = -1;
    gLastActiveDownloads = 0;

    return;
  }

  // Establish the mean transfer speed and amount downloaded.
  var mean = 0;
  var base = 0;
  var dls = gDownloadManager.activeDownloads;
  while (dls.hasMoreElements()) {
    var dl = dls.getNext().QueryInterface(Components.interfaces.nsIDownload);
    if (dl.percentComplete < 100 && dl.size > 0) {
      mean += dl.amountTransferred;
      base += dl.size;
    }
  }

  // Calculate the percent transferred, unless we don't have a total file size
  var dlbundle = document.getElementById("dmBundle");
  if (base != 0)
    mean = Math.floor((mean / base) * 100);

  // Update title of window
  if (mean != gLastComputedMean || gLastActiveDownloads != numActiveDownloads) {
    gLastComputedMean = mean;
    gLastActiveDownloads = numActiveDownloads;

    var title;
    if (base == 0)
      title = dlbundle.getFormattedString("downloadsTitleFiles",
                                          [numActiveDownloads]);
    else
      title = dlbundle.getFormattedString("downloadsTitlePercent",
                                          [numActiveDownloads, mean]);

    // Get the correct plural form and insert number of downloads and percent
    title = PluralForm.get(numActiveDownloads, title);

    document.title = title;
  }
}

// -- copied from downloads.js: getLocalFileFromNativePathOrUrl()
// we should be using real URLs all the time, but until
// bug 239948 is fully fixed, this will do...
//
// note, this will thrown an exception if the native path
// is not valid (for example a native Windows path on a Mac)
// see bug #392386 for details
function getLocalFileFromNativePathOrUrl(aPathOrUrl)
{
  if (/^file:\/\//.test(aPathOrUrl)) {
    // if this is a URL, get the file from that
    var ioSvc = Components.classes["@mozilla.org/network/io-service;1"].
                getService(Components.interfaces.nsIIOService);

    const fileUrl = ioSvc.newURI(aPathOrUrl, null, null).
                    QueryInterface(Components.interfaces.nsIFileURL);
    return fileUrl.file.clone().QueryInterface(Components.interfaces.nsILocalFile);
  } else {
    // if it's a pathname, create the nsILocalFile directly
    var f = new nsLocalFile(aPathOrUrl);

    return f;
  }
}

var gDownloadObserver = {
  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "download-manager-remove-download":
        if (aSubject instanceof Components.interfaces.nsISupportsPRUint32)
          // We have a single download.
          gDownloadTreeView.removeDownload(aSubject.data);
        else
          // A null subject here indicates "remove multiple", so we just rebuild.
          gDownloadTreeView.initTree();
      break;
    }
  }
};

var dlTreeController = {
  supportsCommand: function(aCommand)
  {
    switch (aCommand) {
      case "cmd_play":
      case "cmd_pause":
      case "cmd_resume":
      case "cmd_retry":
      case "cmd_cancel":
      case "cmd_remove":
      case "cmd_stop":
      case "cmd_open":
      case "cmd_show":
      case "cmd_openReferrer":
      case "cmd_copyLocation":
      case "cmd_selectAll":
      case "cmd_clearList":
        return true;
    }
    return false;
  },

  isCommandEnabled: function(aCommand)
  {
    var selectionCount = 0;
    if (gDownloadTreeView && gDownloadTreeView.selection)
      selectionCount = gDownloadTreeView.selection.count;

    var selItemData = selectionCount ?
                      gDownloadTreeView.getRowData(gDownloadTree.currentIndex) :
                      null;

    switch (aCommand) {
      case "cmd_play":
         return selectionCount == 1 &&
                ((selItemData.resumable &&
                 (selItemData.isActive ||
                  selItemData.state == nsIDownloadManager.DOWNLOAD_PAUSED)) ||
                (selItemData.state == nsIDownloadManager.DOWNLOAD_CANCELED ||
                 selItemData.state == nsIDownloadManager.DOWNLOAD_FAILED));
      case "cmd_pause":
        return selectionCount == 1 &&
               selItemData.isActive &&
               selItemData.state != nsIDownloadManager.DOWNLOAD_PAUSED &&
               selItemData.resumable;
      case "cmd_resume":
        return selectionCount == 1 &&
               selItemData.state == nsIDownloadManager.DOWNLOAD_PAUSED &&
               selItemData.resumable;
      case "cmd_open":
      case "cmd_show":
        // we can't reveal until the download is complete, because we have not given
        // the file its final name until them.
        return selectionCount == 1 &&
               selItemData.state == nsIDownloadManager.DOWNLOAD_FINISHED &&
               getLocalFileFromNativePathOrUrl(selItemData.file).exists();
      case "cmd_cancel":
        return selectionCount == 1 && selItemData.isActive;
      case "cmd_retry":
        return selectionCount == 1 &&
               (selItemData.state == nsIDownloadManager.DOWNLOAD_CANCELED ||
                selItemData.state == nsIDownloadManager.DOWNLOAD_FAILED);
      case "cmd_remove":
        return selectionCount == 1 && !selItemData.isActive;
      case "cmd_stop":
        return selectionCount == 1;
      case "cmd_openReferrer":
        return selectionCount == 1 && !!selItemData.referrer;
      case "cmd_copyLocation":
        return selectionCount > 0;
      case "cmd_selectAll":
        return gDownloadTreeView.rowCount != selectionCount;
      case "cmd_clearList":
        return gDownloadTreeView.rowCount && gDownloadManager.canCleanUp;
      default:
        return false;
    }
  },

  doCommand: function(aCommand) {
    var selectionCount = 0;
    if (gDownloadTreeView && gDownloadTreeView.selection)
      selectionCount = gDownloadTreeView.selection.count;
    var selIdx = selectionCount == 1 ? gDownloadTree.currentIndex : -1;
    var selItemData = selectionCount == 1 ? gDownloadTreeView.getRowData(selIdx) : null;

    var m_selIdx = [];
    if (selectionCount) {
      m_selIdx = [];
      // walk all selected rows
      let start = {};
      let end = {};
      let numRanges = gDownloadTreeView.selection.getRangeCount();
      for (let rg = 0; rg < numRanges; rg++){
        gDownloadTreeView.selection.getRangeAt(rg, start, end);
        for (let row = start.value; row <= end.value; row++){
          m_selIdx.push(row);
        }
      }
    }

    switch (aCommand) {
      case "cmd_play":
        switch (selItemData.state) {
          case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
            pauseDownload(selItemData.dlid);
            break;
          case nsIDownloadManager.DOWNLOAD_PAUSED:
            resumeDownload(selItemData.dlid);
            break;
          case nsIDownloadManager.DOWNLOAD_FAILED:
          case nsIDownloadManager.DOWNLOAD_CANCELED:
            retryDownload(selItemData.dlid);
            break;
         }
         break;
      case "cmd_pause":
        pauseDownload(selItemData.dlid);
        break;
      case "cmd_resume":
        resumeDownload(selItemData.dlid);
        break;
      case "cmd_retry":
        retryDownload(selItemData.dlid);
        break;
      case "cmd_cancel":
        // fake an nsIDownload with the properties needed by that function
        cancelDownload({id: selItemData.dlid,
                        targetFile: getLocalFileFromNativePathOrUrl(selItemData.file)});
        break;
      case "cmd_remove":
        removeDownload(selItemData.dlid);
        break;
      case "cmd_stop":
        if (selItemData.isActive)
          // fake an nsIDownload with the properties needed by that function
          cancelDownload({id: selItemData.dlid,
                          targetFile: getLocalFileFromNativePathOrUrl(selItemData.file)});
        else
          removeDownload(selItemData.dlid);
        break;
      case "cmd_open":
        // fake an nsIDownload with the properties needed by that function
        openDownload({displayName: selItemData.target,
                      targetFile: getLocalFileFromNativePathOrUrl(selItemData.file)});
        break;
      case "cmd_show":
        // fake an nsIDownload with the properties needed by that function
        showDownload({targetFile: getLocalFileFromNativePathOrUrl(selItemData.file)});
        break;
      case "cmd_openReferrer":
        openUILink(selItemData.referrer);
        break;
      case "cmd_copyLocation":
        var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                                  .getService(Components.interfaces.nsIClipboardHelper);
        var uris = [];
        for each (let idx in m_selIdx) {
          let dldata = gDownloadTreeView.getRowData(idx);
          uris.push(dldata.uri);
        }
        clipboard.copyString(uris.join("\n"));
        break;
      case "cmd_selectAll":
        gDownloadTreeView.selection.selectAll();
        break;
      case "cmd_clearList":
        // Clear the whole list if there's no search
        if (gSearchBox.value == "") {
          gDownloadManager.cleanUp();
          return;
        }

        // Remove each download starting from the end until we hit a download
        // that is in progress
        for (let idx = gDownloadTreeView.rowCount - 1; idx >= 0; idx--) {
          let dldata = gDownloadTreeView.getRowData(idx);
          if (!dldata.isActive) {
            removeDownload(dldata.dlid);
          }
        }

        // Clear the input as if the user did it and move focus to the list
        gSearchBox.value = "";
        searchDownloads("");
        gDownloadTree.focus();
        break;
    }
  },

  onEvent: function(aEvent){
    switch (aEvent) {
    case "tree-select":
      this.onCommandUpdate();
    }
  },

  onCommandUpdate: function() {
    var cmds = ["cmd_play", "cmd_pause", "cmd_resume", "cmd_retry",
                "cmd_cancel", "cmd_remove", "cmd_stop", "cmd_open", "cmd_show",
                "cmd_openReferrer", "cmd_copyLocation", "cmd_selectAll",
                "cmd_clearList"];
    for (let command in cmds)
      goUpdateCommand(cmds[command]);
  }
};
