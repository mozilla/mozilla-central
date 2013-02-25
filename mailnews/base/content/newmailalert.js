/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

// Copied from nsILookAndFeel.h, see comments on eMetric_AlertNotificationOrigin
const NS_ALERT_HORIZONTAL = 1;
const NS_ALERT_LEFT = 2;
const NS_ALERT_TOP = 4;

var gNumNewMsgsToShowInAlert = 4; // the more messages we show in the alert, the larger it will be
var gOpenTime = 4000; // total time the alert should stay up once we are done animating.

var gAlertListener = null;
var gPendingPreviewFetchRequests = 0;
var gUserInitiated = false;
var gOrigin = 0; // Default value: alert from bottom right.

function prefillAlertInfo()
{
  const Ci = Components.interfaces;
  // unwrap all the args....
  // arguments[0] --> nsIArray of folders with new mail
  // arguments[1] --> the observer to call back with notifications about the alert
  // arguments[2] --> user initiated boolean. true if the user initiated opening the alert
  //                 (which means skip the fade effect and don't auto close the alert)
  // arguments[3] --> the alert origin returned by the look and feel
  var foldersWithNewMail = window.arguments[0];
  gAlertListener = window.arguments[1];
  gUserInitiated = window.arguments[2];
  gOrigin = window.arguments[3];

  // For now just grab the first folder which should be a root folder
  // for the account that has new mail. If we can't find a folder, just
  // return to avoid the exception and empty dialog in upper left-hand corner.
  if (!foldersWithNewMail || foldersWithNewMail.length < 1)
    return;
  let rootFolder = foldersWithNewMail.queryElementAt(0, Ci.nsIWeakReference)
                                     .QueryReferent(Ci.nsIMsgFolder);

  // Generate an account label string based on the root folder.
  var label = document.getElementById('alertTitle');
  var totalNumNewMessages = rootFolder.getNumNewMessages(true);
  var message = totalNumNewMessages == 1 ? "newMailNotification_message"
                                         : "newMailNotification_messages";
  label.value = document.getElementById('bundle_messenger')
                        .getFormattedString(message,
                                            [rootFolder.prettiestName,
                                             totalNumNewMessages]);

  // This is really the root folder and we have to walk through the list to
  // find the real folder that has new mail in it...:(
  let allFolders = rootFolder.descendants;
  var folderSummaryInfoEl = document.getElementById('folderSummaryInfo');
  folderSummaryInfoEl.mMaxMsgHdrsInPopup = gNumNewMsgsToShowInAlert;
  for (let folder in fixIterator(allFolders, Components.interfaces.nsIMsgFolder))
  {
    if (folder.hasNewMessages && !folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
    {
      var asyncFetch = {};
      folderSummaryInfoEl.parseFolder(folder, new urlListener(folder), asyncFetch);
      if (asyncFetch.value)
        gPendingPreviewFetchRequests++;
    }
  }
}

function urlListener(aFolder)
{
  this.mFolder = aFolder;
}

urlListener.prototype =
{
  OnStartRunningUrl: function(aUrl)
  {
  },

  OnStopRunningUrl: function(aUrl, aExitCode)
  {
    var folderSummaryInfoEl = document.getElementById('folderSummaryInfo');
    folderSummaryInfoEl.parseFolder(this.mFolder, null, {});
    gPendingPreviewFetchRequests--;

    // when we are done running all of our urls for fetching the preview text,
    // start the alert.
    if (!gPendingPreviewFetchRequests)
      showAlert();
  }
}

function onAlertLoad()
{
  prefillAlertInfo();
  // read out our initial settings from prefs.
  try
  {
    gOpenTime = Services.prefs.getIntPref("alerts.totalOpenTime");
  } catch (ex) {}

  // bogus call to make sure the window is moved offscreen until we are ready for it.
  resizeAlert(true);

  // if we aren't waiting to fetch preview text, then go ahead and
  // start showing the alert.
  if (!gPendingPreviewFetchRequests)
    setTimeout(showAlert, 0); // let the JS thread unwind, to give layout
                              // a chance to recompute the styles and widths for our alert text.
}

// If the user initiated the alert, show it right away, otherwise start opening the alert with
// the fade effect.
function showAlert()
{
  if (!document.getElementById("folderSummaryInfo").hasMessages) {
    closeAlert(); // no mail, so don't bother showing the alert...
    return;
  }

  // resize the alert based on our current content
  resizeAlert(false);

  var alertContainer = document.getElementById("alertContainer");
  // Don't fade in if the user opened the alert or the pref is true.
  if (gUserInitiated ||
      Services.prefs.getBoolPref("alerts.disableSlidingEffect")) {
    alertContainer.setAttribute("noanimation", true);
    setTimeout(closeAlert, gOpenTime);
    return;
  }

  alertContainer.addEventListener("animationend", function hideAlert(event) {
    if (event.animationName == "fade-in") {
      alertContainer.removeEventListener("animationend", hideAlert, false);
      let remaining = Math.max(Math.round(gOpenTime - event.elapsedTime * 1000), 0);
      setTimeout(fadeOutAlert, remaining);
    }
  }, false);
  alertContainer.setAttribute("fade-in", true);
}

function resizeAlert(aMoveOffScreen)
{
  var alertTextBox = document.getElementById("alertTextBox");
  var alertImageBox = document.getElementById("alertImageBox");
  alertImageBox.style.minHeight = alertTextBox.scrollHeight + "px";

  sizeToContent();

  // leftover hack to get the window properly hidden when we first open it
  if (aMoveOffScreen)
    window.outerHeight = 1;

  // Determine position
  var x = gOrigin & NS_ALERT_LEFT ? screen.availLeft :
          screen.availLeft + screen.availWidth - window.outerWidth;
  var y = gOrigin & NS_ALERT_TOP ? screen.availTop :
          screen.availTop + screen.availHeight - window.outerHeight;

  // Offset the alert by 10 pixels from the edge of the screen
  y += gOrigin & NS_ALERT_TOP ? 10 : -10;
  x += gOrigin & NS_ALERT_LEFT ? 10 : -10;

  window.moveTo(x, y);
}

function fadeOutAlert()
{
  var alertContainer = document.getElementById("alertContainer");
  alertContainer.addEventListener("animationend", function fadeOut(event) {
    if (event.animationName == "fade-out") {
      alertContainer.removeEventListener("animationend", fadeOut, false);
      closeAlert();
    }
  }, false);
  alertContainer.setAttribute("fade-out", true);
}

function closeAlert()
{
  if (gAlertListener)
    gAlertListener.observe(null, "alertfinished", "");
  window.close();
}
