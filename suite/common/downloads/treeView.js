/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/DownloadUtils.jsm");

const nsITreeView = Components.interfaces.nsITreeView;
// const nsIDownloadManager is already defined in downloadmanager.js

function DownloadTreeView(aDownloadManager) {
  this._dm = aDownloadManager;
  this._dlList = [];
  this._dlMap = {};
  this._searchTerms = [];
}

DownloadTreeView.prototype = {
  QueryInterface: XPCOMUtils.generateQI([nsITreeView,
                             Components.interfaces.nsIDownloadManagerResult]),

  // ***** nsITreeView attributes and methods *****
  get rowCount() {
    return this._dlList.length;
  },

  selection: null,

  getRowProperties: function(aRow) {
    var dl = this._dlList[aRow];
    // (in)active
    var properties = dl.isActive ? "active": "inactive";
    // resumable
    if (dl.resumable)
      properties += " resumable";
    // Download states
    switch (dl.state) {
      case nsIDownloadManager.DOWNLOAD_PAUSED:
        properties += " paused";
        break;
      case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
        properties += " downloading";
        break;
      case nsIDownloadManager.DOWNLOAD_FINISHED:
        properties += " finished";
        break;
      case nsIDownloadManager.DOWNLOAD_FAILED:
        properties += " failed";
        break;
      case nsIDownloadManager.DOWNLOAD_CANCELED:
        properties += " canceled";
        break;
      case nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL: // Parental Controls
      case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:   // Security Zone Policy
      case nsIDownloadManager.DOWNLOAD_DIRTY:            // possible virus/spyware
        properties += " blocked";
        break;
    }
    return properties;
  },
  getCellProperties: function(aRow, aColumn) {
    // Append all row properties to the cell
    return this.getRowProperties(aRow);
  },
  getColumnProperties: function(aColumn) { return ""; },
  isContainer: function(aRow) { return false; },
  isContainerOpen: function(aRow) { return false; },
  isContainerEmpty: function(aRow) { return false; },
  isSeparator: function(aRow) { return false; },
  isSorted: function() { return false; },
  canDrop: function(aIdx, aOrientation) { return false; },
  drop: function(aIdx, aOrientation) { },
  getParentIndex: function(aRow) { return -1; },
  hasNextSibling: function(aRow, aAfterIdx) { return false; },
  getLevel: function(aRow) { return 0; },

  getImageSrc: function(aRow, aColumn) {
    if (aColumn.id == "Name")
      return "moz-icon://" + this._dlList[aRow].file + "?size=16";
    return "";
  },

  getProgressMode: function(aRow, aColumn) {
    if (aColumn.id == "Progress")
      return this._dlList[aRow].progressMode;
    return nsITreeView.PROGRESS_NONE;
  },

  getCellValue: function(aRow, aColumn) {
    if (aColumn.id == "Progress")
      return this._dlList[aRow].progress;
    return "";
  },

  getCellText: function(aRow, aColumn) {
    var dl = this._dlList[aRow];
    switch (aColumn.id) {
      case "Name":
        return dl.target;
      case "Status":
        switch (dl.state) {
          case nsIDownloadManager.DOWNLOAD_PAUSED:
            return this._dlbundle.getString("paused");
          case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
            return this._dlbundle.getString("downloading");
          case nsIDownloadManager.DOWNLOAD_FINISHED:
            return this._dlbundle.getString("finished");
          case nsIDownloadManager.DOWNLOAD_FAILED:
            return this._dlbundle.getString("failed");
          case nsIDownloadManager.DOWNLOAD_CANCELED:
            return this._dlbundle.getString("canceled");
          case nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL: // Parental Controls
          case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:   // Security Zone Policy
          case nsIDownloadManager.DOWNLOAD_DIRTY:            // possible virus/spyware
            return this._dlbundle.getString("blocked");
        }
        return this._dlbundle.getString("notStarted");
      case "Progress":
        if (dl.isActive)
          return dl.progress;
        switch (dl.state) {
          case nsIDownloadManager.DOWNLOAD_FINISHED:
            return this._dlbundle.getString("finished");
          case nsIDownloadManager.DOWNLOAD_FAILED:
            return this._dlbundle.getString("failed");
          case nsIDownloadManager.DOWNLOAD_CANCELED:
            return this._dlbundle.getString("canceled");
          case nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL: // Parental Controls
          case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:   // Security Zone Policy
          case nsIDownloadManager.DOWNLOAD_DIRTY:            // possible virus/spyware
            return this._dlbundle.getString("blocked");
        }
        return this._dlbundle.getString("notStarted");
      case "ProgressPercent":
        return dl.progress;
      case "TimeRemaining":
        if (dl.isActive) {
          var dld = dl.dld;
          var lastSec = (dl.lastSec == null) ? Infinity : dl.lastSec;
          // Calculate the time remaining if we have valid values
          var seconds = (dld.speed > 0) && (dl.maxBytes > 0)
                        ? (dl.maxBytes - dl.currBytes) / dld.speed
                        : -1;
          var [timeLeft, newLast] = DownloadUtils.getTimeLeft(seconds, lastSec);
          this._dlList[aRow].lastSec = newLast;
          return timeLeft;
        }
        return "";
      case "Transferred":
        return DownloadUtils.getTransferTotal(dl.currBytes, dl.maxBytes);
      case "TransferRate":
        switch (dl.state) {
          case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
            var speed = dl.dld.speed;
            this._dlList[aRow]._speed = speed; // used for sorting
            var [rate, unit] = DownloadUtils.convertByteUnits(speed);
            return this._dlbundle.getFormattedString("speedFormat", [rate, unit]);
          case nsIDownloadManager.DOWNLOAD_PAUSED:
            return this._dlbundle.getString("paused");
          case nsIDownloadManager.DOWNLOAD_NOTSTARTED:
          case nsIDownloadManager.DOWNLOAD_QUEUED:
            return this._dlbundle.getString("notStarted");
        }
        return "";
      case "TimeElapsed":
        if (dl.endTime && dl.startTime && (dl.endTime > dl.startTime)) {
          var seconds = (dl.endTime - dl.startTime) / 1000;
          var [time1, unit1, time2, unit2] =
            DownloadUtils.convertTimeUnits(seconds);
          if (seconds < 3600 || time2 == 0)
            return this._dlbundle.getFormattedString("timeSingle", [time1, unit1]);
          return this._dlbundle.getFormattedString("timeDouble", [time1, unit1, time2, unit2]);
        }
        return "";
      case "StartTime":
        if (dl.startTime)
          return this._convertTimeToString(dl.startTime);
        return "";
      case "EndTime":
        if (dl.endTime)
          return this._convertTimeToString(dl.endTime);
        return "";
      case "Source":
        return dl.uri;
    }
    return "";
  },

  setTree: function(aTree) {
    this._tree = aTree;
    this._dlbundle = document.getElementById("dmBundle");

    this.initTree();
  },

  toggleOpenState: function(aRow) { },
  cycleHeader: function(aColumn) { },
  selectionChanged: function() { },
  cycleCell: function(aRow, aColumn) {
    var dl = this._dlList[aRow];
    switch (aColumn.id) {
      case "ActionPlay":
        switch (dl.state) {
          case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
            dl.dld.pause();
            break;
          case nsIDownloadManager.DOWNLOAD_PAUSED:
            dl.dld.resume();
            break;
          case nsIDownloadManager.DOWNLOAD_FAILED:
          case nsIDownloadManager.DOWNLOAD_CANCELED:
            retryDownload(dl.dld);
            break;
        }
        break;
      case "ActionStop":
        if (dl.isActive)
          cancelDownload(dl.dld);
        else
          dl.dld.remove();
        break;
    }
  },
  isEditable: function(aRow, aColumn) { return false; },
  isSelectable: function(aRow, aColumn) { return false; },
  setCellValue: function(aRow, aColumn, aText) { },
  setCellText: function(aRow, aColumn, aText) { },
  performAction: function(aAction) { },
  performActionOnRow: function(aAction, aRow) { },
  performActionOnCell: function(aAction, aRow, aColumn) { },

  // ***** local public methods *****

  addDownload: function(aDownload) {
    var attrs = {
      guid: aDownload.guid,
      file: aDownload.target.spec,
      target: aDownload.displayName,
      uri: aDownload.source.spec,
      state: aDownload.state,
      progress: aDownload.percentComplete,
      progressMode: nsITreeView.PROGRESS_NONE,
      resumable: aDownload.resumable,
      startTime: Math.round(aDownload.startTime / 1000),
      endTime: Date.now(),
      referrer: null,
      currBytes: aDownload.amountTransferred,
      maxBytes: aDownload.size,
      lastSec: Infinity, // For calculations of remaining time
      dld: aDownload
    };
    switch (attrs.state) {
      case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
        // At this point, we know if we are an indeterminate download or not.
        attrs.progressMode = attrs.progress == -1 ?
                                               nsITreeView.PROGRESS_UNDETERMINED :
                                               nsITreeView.PROGRESS_NORMAL;
        // We also know the referrer at this point.
        var referrer = aDownload.referrer;
        if (referrer)
            attrs.referrer = referrer.spec;
      case nsIDownloadManager.DOWNLOAD_NOTSTARTED:
      case nsIDownloadManager.DOWNLOAD_PAUSED:
      case nsIDownloadManager.DOWNLOAD_QUEUED:
      case nsIDownloadManager.DOWNLOAD_SCANNING:
        attrs.isActive = 1;
        break;
      default:
        attrs.isActive = 0;
        break;
    }

    // prepend in natural sorting
    attrs.listIndex = this._lastListIndex--;

    // Prepend data to the download list
    this._dlList.unshift(attrs);
    this._dlMap[attrs.guid] = attrs;

    // Tell the tree we added 1 row at index 0
    this._tree.rowCountChanged(0, 1);

    // Data has changed, so re-sorting might be needed
    this.sortView("", "", attrs, 0);

    window.updateCommands("tree-select");
  },

  updateDownload: function(aDownload) {
    var row = this._getIdxForGUID(aDownload.guid);
    if (row == -1) {
      // No download row found to update, but as it's obviously going on,
      // add it to the list now (can happen with very fast, e.g. local dls)
      this.addDownload(aDownload);
      return;
    }
    var dl = this._dlList[row];
    if (dl.currBytes != aDownload.amountTransferred) {
      dl.endTime = Date.now();
      dl.currBytes = aDownload.amountTransferred;
      dl.maxBytes = aDownload.size;
      dl.progress = aDownload.percentComplete;
    }
    if (dl.state != aDownload.state) {
      dl.state = aDownload.state;
      dl.resumable = aDownload.resumable;
      switch (dl.state) {
        case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
          // At this point, we know if we are an indeterminate download or not.
          dl.progressMode = dl.progress == -1 ?
                                           nsITreeView.PROGRESS_UNDETERMINED :
                                           nsITreeView.PROGRESS_NORMAL;
          // We also know the referrer at this point.
          var referrer = aDownload.referrer;
          if (referrer)
            dl.referrer = referrer.spec;
        case nsIDownloadManager.DOWNLOAD_NOTSTARTED:
        case nsIDownloadManager.DOWNLOAD_PAUSED:
        case nsIDownloadManager.DOWNLOAD_QUEUED:
        case nsIDownloadManager.DOWNLOAD_SCANNING:
          dl.isActive = 1;
          break;
        default:
          dl.isActive = 0;
          dl.progressMode = nsITreeView.PROGRESS_NONE;
          gDMUI.getAttention();
          break;
      }
    }

    // Repaint the tree row
    this._tree.invalidateRow(row);

    // Data has changed, so re-sorting might be needed
    this.sortView("", "", dl, row);

    window.updateCommands("tree-select");
  },

  removeDownload: function(aGUID) {
    var row = this._getIdxForGUID(aGUID);
    // Make sure we have an item to remove
    if (row < 0) return;

    var index = this.selection.currentIndex;
    var wasSingleSelection = this.selection.count == 1;

    // Remove data from the download list
    this._dlList.splice(row, 1);
    delete this._dlMap[aGUID];

    // Tell the tree we removed 1 row at the given row index
    this._tree.rowCountChanged(row, -1);

    // Update selection if only removed download was selected
    if (wasSingleSelection && this.selection.count == 0) {
      index = Math.min(index, this.rowCount - 1);
      if (index >= 0)
        this.selection.select(index);
    }

    window.updateCommands("tree-select");
  },

  initTree: function() {
    if (!this._tree)
      return
    // We're resetting the whole list, either because we're creating the tree
    // or because we need to recreate it
    this._tree.beginUpdateBatch();
    this._dlList = [];
    this._dlMap = {};
    this._lastListIndex = 0;

    this.selection.clearSelection();

    // sort in reverse and prepend to the list to get continuous list indexes
    // with increasing negative numbers for default-sort in ascending order
    var statement = this._dm.DBConnection.createStatement(
      "SELECT guid, target, name, source, state, startTime, endTime, referrer" +
           ", currBytes, maxBytes, state IN (?1, ?2, ?3, ?4, ?5) AS isActive " +
      "FROM moz_downloads " +
      "ORDER BY isActive ASC, endTime ASC, startTime ASC, id DESC");

    statement.bindByIndex(0, nsIDownloadManager.DOWNLOAD_NOTSTARTED);
    statement.bindByIndex(1, nsIDownloadManager.DOWNLOAD_DOWNLOADING);
    statement.bindByIndex(2, nsIDownloadManager.DOWNLOAD_PAUSED);
    statement.bindByIndex(3, nsIDownloadManager.DOWNLOAD_QUEUED);
    statement.bindByIndex(4, nsIDownloadManager.DOWNLOAD_SCANNING);

    while (statement.executeStep()) {
      // Try to get the attribute values from the statement
      let attrs = {
        guid: statement.getString(0),
        file: statement.getString(1),
        target: statement.getString(2),
        uri: statement.getString(3),
        state: statement.getInt32(4),
        progress: 100,
        progressMode: nsITreeView.PROGRESS_NONE,
        resumable: false,
        startTime: Math.round(statement.getInt64(5) / 1000),
        endTime: Math.round(statement.getInt64(6) / 1000),
        referrer: statement.getString(7),
        currBytes: statement.getInt64(8),
        maxBytes: statement.getInt64(9),
        isActive: statement.getInt32(10),
        lastSec: Infinity, // For calculations of remaining time
        dld: null
      };

      // Only actually add item to the tree if it's active or matching search
      let matchSearch = true;
      if (this._searchTerms) {
        // Search through the download attributes that are shown to the user and
        // make it into one big string for easy combined searching
        // XXX: toolkit uses the target, status and dateTime attributes of their XBL item
        let combinedSearch = attrs.file.toLowerCase() + " " + attrs.uri.toLowerCase();
        if (attrs.target)
          combinedSearch = combinedSearch + " " + attrs.target.toLowerCase();

        if (!attrs.isActive)
          for (let term of this._searchTerms)
            if (combinedSearch.indexOf(term) == -1)
              matchSearch = false;
      }

      // matchSearch is always true for active downloads, see above
      if (matchSearch) {
        attrs.listIndex = this._lastListIndex--;
        this._dlList.unshift(attrs);
        this._dlMap[attrs.guid] = attrs;
      }
    }
    statement.finalize();
    // now read active downloads
    var downloads = this._dm.activeDownloads;
    while (downloads.hasMoreElements()) {
      let dld = downloads.getNext()
                         .QueryInterface(Components.interfaces.nsIDownload);
      if (dld.guid in this._dlMap) {
        var dl = this._dlMap[dld.guid];
        dl.progress = dld.percentComplete;
        dl.progressMode = dl.progress == -1 ?
                          nsITreeView.PROGRESS_UNDETERMINED :
                          nsITreeView.PROGRESS_NORMAL;
        dl.resumable = dld.resumable;
        dl.dld = dld;
      }
    }
    // find sorted column and sort the tree
    var sortedColumn = this._tree.columns.getSortedColumn();
    if (sortedColumn) {
      var direction = sortedColumn.element.getAttribute("sortDirection");
      this.sortView(sortedColumn.id, direction);
    }
    this._tree.endUpdateBatch();

    window.updateCommands("tree-select");

    // ask for nsIDownload objects for finished downloads
    for (let dl of this._dlList)
      if (!dl.dld)
        this._dm.getDownloadByGUID(dl.guid, this);

    // Send a notification that we finished
    setTimeout(function()
      Services.obs.notifyObservers(window, "download-manager-ui-done", null), 0);
  },

  handleResult: function(aStatus, aDownload) {
    if (aDownload)
      this._dlMap[aDownload.guid].dld = aDownload;
  },

  searchView: function(aInput) {
    // Stringify the previous search
    var prevSearch = this._searchTerms.join(" ");

    // Array of space-separated lower-case search terms
    this._searchTerms = aInput.trim().toLowerCase().split(/\s+/);

    // Don't rebuild the download list if the search didn't change
    if (this._searchTerms.join(" ") == prevSearch)
      return;

    // Cache the current selection
    this._cacheSelection();

    // Rebuild the tree with set search terms
    this.initTree();

    // Restore the selection
    this._restoreSelection();
  },

  sortView: function(aColumnID, aDirection, aDownload, aRow) {
    var sortAscending = aDirection != "descending";

    if (aColumnID == "" && aDirection == "") {
      // Re-sort in already selected/cached order
      var sortedColumn = this._tree.columns.getSortedColumn();
      if (sortedColumn) {
        aColumnID = sortedColumn.id;
        sortAscending = sortedColumn.element.getAttribute("sortDirection") != "descending";
      }
      // no need for else, use default case of switch, sortAscending is true
    }

    // Compare function for two _dlList items
    var compfunc = function(a, b) {
      // Active downloads are always at the beginning
      // i.e. 0 for .isActive is larger (!) than 1
      if (a.isActive < b.isActive)
        return 1;
      if (a.isActive > b.isActive)
        return -1;
      // Same active/inactive state, sort normally
      var comp_a = null;
      var comp_b = null;
      switch (aColumnID) {
        case "Name":
          comp_a = a.target.toLowerCase();
          comp_b = b.target.toLowerCase();
          break;
        case "Status":
          comp_a = a.state;
          comp_b = b.state;
          break;
        case "Progress":
        case "ProgressPercent":
          // Use original sorting for inactive entries
          // Use only one isActive to be sure we do the same
          comp_a = a.isActive ? a.progress : a.listIndex;
          comp_b = a.isActive ? b.progress : b.listIndex;
          break;
        case "TimeRemaining":
          comp_a = a.isActive ? a.lastSec : a.listIndex;
          comp_b = a.isActive ? b.lastSec : b.listIndex;
          break;
        case "Transferred":
          comp_a = a.currBytes;
          comp_b = b.currBytes;
          break;
        case "TransferRate":
          comp_a = a.isActive ? a._speed : a.listIndex;
          comp_b = a.isActive ? b._speed : b.listIndex;
          break;
        case "TimeElapsed":
          comp_a = (a.endTime && a.startTime && (a.endTime > a.startTime))
                   ? a.endTime - a.startTime
                   : 0;
          comp_b = (b.endTime && b.startTime && (b.endTime > b.startTime))
                   ? b.endTime - b.startTime
                   : 0;
          break;
        case "StartTime":
          comp_a = a.startTime;
          comp_b = b.startTime;
          break;
        case "EndTime":
          comp_a = a.endTime;
          comp_b = b.endTime;
          break;
        case "Source":
          comp_a = a.uri;
          comp_b = b.uri;
          break;
        case "unsorted": // Special case for reverting to original order
        default:
          comp_a = a.listIndex;
          comp_b = b.listIndex;
      }
      if (comp_a > comp_b)
        return sortAscending ? 1 : -1;
      if (comp_a < comp_b)
        return sortAscending ? -1 : 1;
      return 0;
    }

    // Cache the current selection
    this._cacheSelection();

    // Do the actual sorting of the array
    this._dlList.sort(compfunc);

    var row = this._dlList.indexOf(aDownload);
    if (row == -1)
      // Repaint the tree
      this._tree.invalidate();
    else if (row == aRow)
      // No effect
      this._selectionCache = null;
    else if (row < aRow)
      // Download moved up from aRow to row
      this._tree.invalidateRange(row, aRow);
    else
      // Download moved down from aRow to row
      this._tree.invalidateRange(aRow, row)

    // Restore the selection
    this._restoreSelection();
  },

  getRowData: function(aRow) {
    return this._dlList[aRow];
  },

  // ***** local member vars *****

  _tree: null,
  _dlBundle: null,
  _lastListIndex: 0,
  _selectionCache: null,
  __dateService: null,

  // ***** local helper functions *****

  get _dateService() {
    if (!this.__dateService) {
      this.__dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                                     .getService(Components.interfaces.nsIScriptableDateFormat);
    }
    return this.__dateService;
  },

  // Get array index in _dlList for a given download ID
  _getIdxForGUID: function(aGUID) {
    if (aGUID in this._dlMap)
      return this._dlList.indexOf(this._dlMap[aGUID]);
    return -1;
  },

  // Cache IDs of selected downloads for later restoration
  _cacheSelection: function() {
    // Abort if there's already something cached
    if (this._selectionCache)
      return;

    this._selectionCache = [];
    if (this.selection.count < 1)
      return;

    // Walk all selected rows and cache theior download IDs
    var start = {};
    var end = {};
    var numRanges = this.selection.getRangeCount();
    for (let rg = 0; rg < numRanges; rg++){
      this.selection.getRangeAt(rg, start, end);
      for (let row = start.value; row <= end.value; row++){
        this._selectionCache.push(this._dlList[row].guid);
      }
    }
  },

  // Restore selection from cached IDs (as possible)
  _restoreSelection: function() {
    // Abort if the cache is empty
    if (!this._selectionCache)
      return;

    this.selection.clearSelection();
    for (let guid of this._selectionCache) {
      // Find out what row this is now and if possible, add it to the selection
      var row = this._getIdxForGUID(guid);
      if (row != -1)
        this.selection.rangedSelect(row, row, true);
    }
    // Work done, clear the cache
    this._selectionCache = null;
  },

  _convertTimeToString: function(aTime) {
    var timeObj = new Date(aTime);

    // Check if it is today and only display the time.  Only bother
    // checking for today if it's within the last 24 hours, since
    // computing midnight is not really cheap. Sometimes we may get dates
    // in the future, so always show those.
    var ago = Date.now() - aTime;
    var dateFormat = Components.interfaces.nsIScriptableDateFormat.dateFormatShort;
    if (ago > -10000 && ago < (1000 * 24 * 60 * 60)) {
      var midnight = new Date();
      midnight.setHours(0);
      midnight.setMinutes(0);
      midnight.setSeconds(0);
      midnight.setMilliseconds(0);

      if (aTime > midnight.getTime())
        dateFormat = Components.interfaces.nsIScriptableDateFormat.dateFormatNone;
    }

    return (this._dateService.FormatDateTime("", dateFormat,
      Components.interfaces.nsIScriptableDateFormat.timeFormatNoSeconds,
      timeObj.getFullYear(), timeObj.getMonth() + 1,
      timeObj.getDate(), timeObj.getHours(),
      timeObj.getMinutes(), timeObj.getSeconds()));
  },

};
