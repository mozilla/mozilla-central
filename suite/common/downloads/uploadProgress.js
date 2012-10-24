/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/DownloadUtils.jsm");

const kInterval = 750; // Default to .75 seconds.

var gPersist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                         .createInstance(Components.interfaces.nsIWebBrowserPersist);
var gSource = window.arguments[0].QueryInterface(Components.interfaces.nsIFileURL);
var gTarget = window.arguments[1].QueryInterface(Components.interfaces.nsIURL);
var gFileName = gSource.file.leafName;
var gFileSize = gSource.file.fileSize;
var gPercent = -1;
var gStartTime;
var gLastUpdate;
var gLastSeconds;
var gBundle;
var gStatus;
var gTime;
var gSize;
var gProgress;
var gMeter;

function onLoad()
{
  gBundle = document.getElementById("dmBundle");
  gStatus = document.getElementById("status");
  gTime = document.getElementById("timeElapsed");
  gSize = document.getElementById("size");
  gProgress = document.getElementById("progressText");
  gMeter = document.getElementById("progress");
  var status = gBundle.getString("notStarted");
  document.title =
      gBundle.getFormattedString("progressTitle", [gFileName, status]);
  gStatus.value = status;
  gTime.value = gBundle.getFormattedString("timeSingle",
                                           DownloadUtils.convertTimeUnits(0));
  gSize.value = DownloadUtils.getTransferTotal(0, gFileSize);
  document.getElementById("target").value =
      gBundle.getFormattedString("toTarget", [gTarget.resolve(".")]);
  document.getElementById("source").value =
      gBundle.getFormattedString("fromSource", [gSource.file.leafName]);
  gPersist.progressListener = gProgressListener;
  gPersist.saveURI(gSource, null, null, null, null, gTarget, null);
  document.documentElement.getButton("cancel").focus();
}

function onUnload()
{
  if (gPersist)
    gPersist.cancel(Components.results.NS_BINDING_ABORTED);
  gPersist = null;
}

function setPercent(aPercent, aStatus)
{
  gPercent = aPercent;
  document.title = gBundle.getFormattedString("progressTitlePercent",
      [aPercent, gFileName, aStatus]);
  gProgress.value = gBundle.getFormattedString("percentFormat", [aPercent]);
  gMeter.mode = "normal";
  gMeter.value = aPercent;
}

var gProgressListener = {
  // ----- nsIWebProgressListener methods -----

  // Look for STATE_STOP and close dialog to indicate completion when it happens.
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aRequest instanceof Components.interfaces.nsIChannel &&
        aRequest.URI.equals(gTarget) &&
        aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
      gPersist = null;
      var status = gBundle.getString("finished");
      setPercent(100, status);
      gStatus.value = status;
      gSize.value = DownloadUtils.getTransferTotal(gFileSize, gFileSize);
      setTimeout(window.close, kInterval);
    }
  },

  // Handle progress notifications.
  onProgressChange: function(aWebProgress, aRequest,
                             aCurSelfProgress, aMaxSelfProgress,
                             aCurTotalProgress, aMaxTotalProgress) {
    return this.onProgressChange64(aWebProgress, aRequest,
                                   aCurSelfProgress, aMaxSelfProgress,
                                   aCurTotalProgress, aMaxTotalProgress);
  },

  onProgressChange64: function(aWebProgress, aRequest,
                               aCurSelfProgress, aMaxSelfProgress,
                               aCurTotalProgress, aMaxTotalProgress) {
    if (aRequest instanceof Components.interfaces.nsIChannel &&
        aRequest.URI.equals(gTarget)) {
      // Get current time.
      var now = Date.now();

      // If interval hasn't elapsed, ignore it.
      if (!gStartTime)
        gStartTime = now;
      else if (now - gLastUpdate < kInterval && aCurTotalProgress < gFileSize)
        return;

      // Update this time.
      gLastUpdate = now;

      // Update elapsed time.
      var elapsed = (now - gStartTime) / 1000;

      // Calculate percentage.
      var status = gBundle.getString("uploading");
      var percent = -1;
      if (gFileSize > 0)
        percent = Math.floor(aCurTotalProgress * 100 / gFileSize);
      if (percent != gPercent)
        setPercent(percent, status);

      // Update time remaining.
      var rate = elapsed && aCurTotalProgress / elapsed;
      if (rate && gFileSize) {
        var timeLeft;
        [timeLeft, gLastSeconds] =
            DownloadUtils.getTimeLeft((gFileSize - aCurTotalProgress) / rate,
                                      gLastSeconds);
        status = gBundle.getFormattedString("statusActive", [status, timeLeft]);
      }
      gStatus.value = status;

      // Update dialog's display of elapsed time.
      var timeUnits = DownloadUtils.convertTimeUnits(elapsed);
      var timeString = timeUnits[2] ? "timeDouble" : "timeSingle";
      gTime.value = gBundle.getFormattedString(timeString, timeUnits);

      // Update size (nn KB of mm KB at xx.x KB/sec)
      var size = DownloadUtils.getTransferTotal(aCurTotalProgress, gFileSize);
      if (elapsed)
        size = gBundle.getFormattedString("sizeSpeed", [size,
            gBundle.getFormattedString("speedFormat",
                                       DownloadUtils.convertByteUnits(rate))]);
      gSize.value = size;
    }
  },

  // Look for error notifications and display alert to user.
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
    // Check for error condition (only if dialog is still open).
    if (!Components.results.isSuccessCode(aStatus)) {
      // Display error alert (using text supplied by back-end).
      Services.prompt.alert(window, document.title, aMessage);
      // Close the dialog.
      window.close();
    }
  },

  // Ignore onLocationChange and onSecurityChange notifications.
  onLocationChange: function( aWebProgress, aRequest, aLocation, aFlags ) {
  },

  onSecurityChange: function( aWebProgress, aRequest, aState ) {
  },

  // ---------- nsISupports methods ----------

  QueryInterface: XPCOMUtils.generateQI([
                      Components.interfaces.nsIWebProgressListener2,
                      Components.interfaces.nsIWebProgressListener,
                      Components.interfaces.nsIInterfaceRequestor]),

  // ---------- nsIInterfaceRequestor methods ----------

  getInterface: function(aIID) {
    if (aIID.equals(Components.interfaces.nsIPrompt) ||
        aIID.equals(Components.interfaces.nsIAuthPrompt)) {
      var prompt;
      if (aIID.equals(Components.interfaces.nsIPrompt))
        prompt = Services.ww.getNewPrompter(window);
      else
        prompt = Services.ww.getNewAuthPrompter(window);
      return prompt;
    }

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}
