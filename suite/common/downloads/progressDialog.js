/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/DownloadUtils.jsm");

// nsIDownloadManager, gDownloadManager, gDownloadListener
// are defined in downloadmanager.js

var gDownload;
var gDownloadBundle;
var gTkDlBundle;

var gDlStatus;
var gDlSize;
var gTimeElapsed;
var gProgressMeter;
var gProgressText;
var gCloseWhenDone;

var gLastSec = Infinity;
var gStartTime = 0;
var gEndTime = Date.now(); // gets corrected below for calls from dlmgr
var gDlActive = false;
var gRetrying = false;

function progressStartup() {
  gDownload = window.arguments[0];

  var recentDMWindow = Services.wm.getMostRecentWindow("Download:Manager");
  if (recentDMWindow &&
      gDownload.guid in recentDMWindow.gDownloadTreeView._dlMap)
    // we have been opened by a download manager, get the end time from there
    gEndTime = recentDMWindow.gDownloadTreeView._dlMap[gDownload.guid].endTime;

  // cache elements to save .getElementById() calls
  gDownloadBundle = document.getElementById("dmBundle");
  gTkDlBundle = document.getElementById("tkdlBundle");
  gDlStatus = document.getElementById("dlStatus");
  gDlSize = document.getElementById("dlSize");
  gTimeElapsed = document.getElementById("timeElapsed");
  gProgressMeter = document.getElementById("progressMeter");
  gProgressText = document.getElementById("progressText");
  gCloseWhenDone = document.getElementById("closeWhenDone");

  // Insert as first controller on the whole window
  window.controllers.insertControllerAt(0, ProgressDlgController);

  if (gDownload.isPrivate)
    gCloseWhenDone.hidden = true;
  else
    gCloseWhenDone.checked = Services.prefs.getBoolPref("browser.download.progress.closeWhenDone");

  switch (gDownload.state) {
    case nsIDownloadManager.DOWNLOAD_NOTSTARTED:
    case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
    case nsIDownloadManager.DOWNLOAD_PAUSED:
    case nsIDownloadManager.DOWNLOAD_QUEUED:
    case nsIDownloadManager.DOWNLOAD_SCANNING:
      gDlActive = true;
      break;
    case nsIDownloadManager.DOWNLOAD_FINISHED:
      if (gCloseWhenDone.checked && window.arguments[1])
        window.close();
    default:
      gDlActive = false;
      break;
  }

  var fName = document.getElementById("fileName");
  var fSource = document.getElementById("fileSource");
  fName.label = gDownload.displayName;
  fName.tooltipText = gDownload.target.spec;
  var fromString;
  try {
    fromString = gDownload.source.host;
  }
  catch (e) { }
  if (!fromString)
    fromString = gDownload.source.prePath;
  fSource.label = gDownloadBundle.getFormattedString("fromSource", [fromString]);
  fSource.tooltipText = gDownload.source.spec;

  // The DlProgressListener handles progress notifications.
  gDownloadListener = new DlProgressListener();
  gDownloadManager.addPrivacyAwareListener(gDownloadListener);

  updateDownload();
  updateButtons();
  window.updateCommands("dlstate-change");

  // Send a notification that we finished
  setTimeout(function()
    Services.obs.notifyObservers(window, "download-manager-ui-done", null), 0);
}

function progressShutdown() {
  gDownloadManager.removeListener(gDownloadListener);
  window.controllers.removeController(ProgressDlgController);
  if (!gCloseWhenDone.hidden)
    Services.prefs.setBoolPref("browser.download.progress.closeWhenDone",
                               gCloseWhenDone.checked);
}

function updateDownload() {
  switch (gDownload.state) {
    case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
      // At this point, we know if we are an indeterminate download or not.
      if (gDownload.percentComplete == -1) {
        gProgressText.hidden = true;
        gProgressMeter.mode = "undetermined";
      }
      else if (gProgressText.hidden) {
        // If it was undetermined before, unhide text and switch mode.
        gProgressText.hidden = false;
        gProgressMeter.mode = "determined";
      }
    case nsIDownloadManager.DOWNLOAD_NOTSTARTED:
    case nsIDownloadManager.DOWNLOAD_PAUSED:
    case nsIDownloadManager.DOWNLOAD_QUEUED:
    case nsIDownloadManager.DOWNLOAD_SCANNING:
      gDlActive = true;
      gProgressMeter.style.opacity = 1;
      break;
    default:
      gDlActive = false;
      gProgressMeter.style.opacity = 0.5;
      break;
  }
  if (gDownload.size >= 0) {
    gProgressMeter.value = gDownload.percentComplete;
    gProgressText.value = gDownloadBundle.getFormattedString("percentFormat",
                                                             [gDownload.percentComplete]);
  }
  // Update window title
  var statusString;
  switch (gDownload.state) {
    case nsIDownloadManager.DOWNLOAD_PAUSED:
      statusString = gDownloadBundle.getString("paused");
      break;
    case nsIDownloadManager.DOWNLOAD_DOWNLOADING:
      statusString = gDownloadBundle.getString("downloading");
      break;
    case nsIDownloadManager.DOWNLOAD_FINISHED:
      statusString = gDownloadBundle.getString("finished");
      break;
    case nsIDownloadManager.DOWNLOAD_FAILED:
      statusString = gDownloadBundle.getString("failed");
      break;
    case nsIDownloadManager.DOWNLOAD_CANCELED:
      statusString = gDownloadBundle.getString("canceled");
      break;
    case nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL: // Parental Controls
    case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:   // Security Zone Policy
    case nsIDownloadManager.DOWNLOAD_DIRTY:            // possible virus/spyware
      statusString = gDownloadBundle.getString("blocked");
      break;
    default:
      statusString = gDownloadBundle.getString("notStarted");
      break;
  }
  var file = GetFileFromString(gDownload.target.spec);
  if (gDownload.size > 0) {
    document.title = gDownloadBundle.getFormattedString("progressTitlePercent",
                                                        [gDownload.percentComplete,
                                                         file.leafName, statusString]);
  }
  else {
    document.title = gDownloadBundle.getFormattedString("progressTitle",
                                                        [file.leafName, statusString]);
  }

  // download size
  var transfer = DownloadUtils.getTransferTotal(gDownload.amountTransferred,
                                                gDownload.size);
  if (gDownload.state == nsIDownloadManager.DOWNLOAD_DOWNLOADING) {
    var [rate, unit] = DownloadUtils.convertByteUnits(gDownload.speed);
    var dlSpeed = gDownloadBundle.getFormattedString("speedFormat", [rate, unit]);
    gDlSize.value = gDownloadBundle.getFormattedString("sizeSpeed",
                                                       [transfer, dlSpeed]);
  }
  else
    gDlSize.value = transfer;

  // download status
  if (gDlActive) {
    // Calculate the time remaining if we have valid values
    var seconds = (gDownload.speed > 0) && (gDownload.size > 0)
                  ? (gDownload.size - gDownload.amountTransferred) / gDownload.speed
                  : -1;
    var [timeLeft, newLast] = DownloadUtils.getTimeLeft(seconds, gLastSec);
    gLastSec = newLast;
  }
  switch (gDownload.state) {
    case nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL: // Parental Controls
      gDlStatus.value = gTkDlBundle.getString("stateBlocked");
      break;
    case nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY:   // Security Zone Policy
      gDlStatus.value = gTkDlBundle.getString("stateBlockedPolicy");
      break;
    case nsIDownloadManager.DOWNLOAD_DIRTY:            // possible virus/spyware
      gDlStatus.value = gTkDlBundle.getString("stateDirty");
      break;
    default:
      if (gDlActive)
        gDlStatus.value = gDownloadBundle.getFormattedString("statusActive",
                                                             [statusString, timeLeft]);
      else
        gDlStatus.value = statusString;
      break;
  }

  // time elapsed
  if (!gStartTime && gDownload.startTime)
    gStartTime = Math.round(gDownload.startTime / 1000)
  if (gDlActive)
    gEndTime = Date.now();
  if (gStartTime && gEndTime && (gEndTime > gStartTime)) {
    var seconds = (gEndTime - gStartTime) / 1000;
    var [time1, unit1, time2, unit2] =
      DownloadUtils.convertTimeUnits(seconds);
    if (seconds < 3600 || time2 == 0)
      gTimeElapsed.value = gDownloadBundle.getFormattedString("timeElapsedSingle", [time1, unit1]);
    else
      gTimeElapsed.value = gDownloadBundle.getFormattedString("timeElapsedDouble", [time1, unit1, time2, unit2]);
  }
  else {
    gTimeElapsed.value = "";
  }
}

function updateButtons() {
  document.getElementById("pauseButton").hidden = !ProgressDlgController.isCommandEnabled("cmd_pause");
  document.getElementById("resumeButton").hidden = !ProgressDlgController.isCommandEnabled("cmd_resume");
  document.getElementById("retryButton").hidden = !ProgressDlgController.isCommandEnabled("cmd_retry");
  document.getElementById("cancelButton").hidden = !ProgressDlgController.isCommandEnabled("cmd_cancel");
}

/**
 * DlProgressListener "class" is used to help update download items shown
 * in the progress dialog such as displaying amount transferred, transfer
 * rate, and time left for the download.
 *
 * This class implements the nsIDownloadProgressListener interface.
 */
function DlProgressListener() {}

DlProgressListener.prototype = {
  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIDownloadProgressListener]),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDownloadProgressListener

  onDownloadStateChange: function(aState, aDownload) {
    // first, check if we are retrying and this is the new download starting
    if (gRetrying &&
        (aDownload.state == nsIDownloadManager.DOWNLOAD_QUEUED ||
         aDownload.state == nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY) &&
        aDownload.source.spec == gDownload.source.spec &&
        aDownload.target.spec == gDownload.target.spec) {
      gRetrying = false;
      gDownload = aDownload;
    }
    if (aDownload == gDownload) {
      if (gCloseWhenDone.checked &&
          (aDownload.state == nsIDownloadManager.DOWNLOAD_FINISHED)) {
        window.close();
      }
      updateDownload();
      updateButtons();
      window.updateCommands("dlstate-change");
    }
  },

  onProgressChange: function(aWebProgress, aRequest,
                             aCurSelfProgress, aMaxSelfProgress,
                             aCurTotalProgress, aMaxTotalProgress, aDownload) {
    if (aDownload == gDownload)
      updateDownload();
  },

  onStateChange: function(aWebProgress, aRequest, aState, aStatus, aDownload) {
  },

  onSecurityChange: function(aWebProgress, aRequest, aState, aDownload) {
  }
};

var ProgressDlgController = {
  supportsCommand: function(aCommand) {
    switch (aCommand) {
      case "cmd_pause":
      case "cmd_resume":
      case "cmd_retry":
      case "cmd_cancel":
      case "cmd_open":
      case "cmd_show":
      case "cmd_openReferrer":
      case "cmd_copyLocation":
        return true;
    }
    return false;
  },

  isCommandEnabled: function(aCommand) {
    switch (aCommand) {
      case "cmd_pause":
        return gDlActive &&
               gDownload.state != nsIDownloadManager.DOWNLOAD_PAUSED &&
               gDownload.resumable;
      case "cmd_resume":
        return gDownload.state == nsIDownloadManager.DOWNLOAD_PAUSED &&
               gDownload.resumable;
      case "cmd_open":
        return gDownload.state == nsIDownloadManager.DOWNLOAD_FINISHED &&
               gDownload.targetFile.exists();
      case "cmd_show":
        return gDownload.targetFile.exists();
      case "cmd_cancel":
        return gDlActive;
      case "cmd_retry":
        return gDownload.state == nsIDownloadManager.DOWNLOAD_CANCELED ||
               gDownload.state == nsIDownloadManager.DOWNLOAD_FAILED;
      case "cmd_openReferrer":
        return !!gDownload.referrer;
      case "cmd_copyLocation":
        return true;
      default:
        return false;
    }
  },

  doCommand: function(aCommand) {
    switch (aCommand) {
      case "cmd_pause":
        gDownload.pause();
        break;
      case "cmd_resume":
        gDownload.resume();
        break;
      case "cmd_retry":
        gRetrying = true;
        retryDownload(gDownload);
        break;
      case "cmd_cancel":
        cancelDownload(gDownload);
        break;
      case "cmd_open":
        openDownload(gDownload);
        break;
      case "cmd_show":
        showDownload(gDownload);
        break;
      case "cmd_openReferrer":
        openUILink(gDownload.referrer.spec);
        break;
      case "cmd_copyLocation":
        var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                                  .getService(Components.interfaces.nsIClipboardHelper);
        clipboard.copyString(gDownload.source.spec, document);
        break;
    }
  },

  onEvent: function(aEvent) {
  },

  onCommandUpdate: function() {
    var cmds = ["cmd_pause", "cmd_resume", "cmd_retry", "cmd_cancel",
                "cmd_open", "cmd_show", "cmd_openReferrer", "cmd_copyLocation"];
    for (let command in cmds)
      goUpdateCommand(cmds[command]);
  }
};
