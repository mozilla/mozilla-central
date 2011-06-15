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
 * The Original Code is SeaMonkey Upload Progress Dialog.
 *
 * The Initial Developer of the Original Code is
 * Neil Rashbrook <neil@parkwaycc.co.uk>
 * Portions created by the Initial Developer are Copyright (C) 2010
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
  gPersist.saveURI(gSource, null, null, null, null, gTarget);
  document.documentElement.getButton("cancel").focus();
}

function onUnload()
{
  const NS_BINDING_ABORTED = 0x804b0002;
  if (gPersist)
    gPersist.cancel(NS_BINDING_ABORTED);
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
  onLocationChange: function( aWebProgress, aRequest, aLocation, aDownload ) {
  },

  onSecurityChange: function( aWebProgress, aRequest, aState, aDownload ) {
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
