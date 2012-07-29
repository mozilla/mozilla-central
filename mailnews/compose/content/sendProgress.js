/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var nsIMsgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;

// dialog is just an array we'll use to store various properties from the dialog document...
var dialog;

// the msgProgress is a nsIMsgProgress object
var msgProgress = null;

// random global variables...
var itsASaveOperation = false;
var gSendProgressStringBundle;

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
    {
      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
      {
        // Put progress meter in undetermined mode.
        dialog.progress.setAttribute("mode", "undetermined");
      }

      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      {
        // we are done sending/saving the message...
        // Indicate completion in status area.
        var msg;
        if (itsASaveOperation)
          msg = gSendProgressStringBundle.getString("messageSaved");
        else
          msg = gSendProgressStringBundle.getString("messageSent");
        dialog.status.setAttribute("value", msg);

        // Put progress meter at 100%.
        dialog.progress.setAttribute("value", 100);
        dialog.progress.setAttribute("mode", "normal");
        var percentMsg = gSendProgressStringBundle.getFormattedString("percentMsg", [100]);
        dialog.progressText.setAttribute("value", percentMsg);

        window.close();
      }
    },

    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
    {
      // Calculate percentage.
      var percent;
      if (aMaxTotalProgress > 0)
      {
        percent = Math.round(aCurTotalProgress / aMaxTotalProgress * 100);
        if (percent > 100)
          percent = 100;

        dialog.progress.removeAttribute("mode");

        // Advance progress meter.
        dialog.progress.setAttribute("value", percent);

        // Update percentage label on progress meter.
        var percentMsg = gSendProgressStringBundle.getFormattedString("percentMsg", [percent]);
        dialog.progressText.setAttribute("value", percentMsg);
      }
      else
      {
        // Progress meter should be barber-pole in this case.
        dialog.progress.setAttribute("mode", "undetermined");
        // Update percentage label on progress meter.
        dialog.progressText.setAttribute("value", "");
      }
    },

    onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags)
    {
      // we can ignore this notification
    },

    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage)
    {
      if (aMessage != "")
        dialog.status.setAttribute("value", aMessage);
    },

    onSecurityChange: function(aWebProgress, aRequest, state)
    {
      // we can ignore this notification
    },

    QueryInterface : function(iid)
    {
      if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
          iid.equals(Components.interfaces.nsISupportsWeakReference) ||
          iid.equals(Components.interfaces.nsISupports))
        return this;

      throw Components.results.NS_NOINTERFACE;
    }
};

function onLoad()
{
    // Set global variables.
    let subject = "";
    gSendProgressStringBundle = document.getElementById("sendProgressStringBundle");

    msgProgress = window.arguments[0];
    if (!msgProgress)
    {
      Components.utils.reportError("Invalid argument to sendProgress.xul.");
      window.close();
      return;
    }

    if (window.arguments[1])
    {
      let progressParams = window.arguments[1].QueryInterface(Components.interfaces.nsIMsgComposeProgressParams);
      if (progressParams)
      {
        itsASaveOperation = (progressParams.deliveryMode != nsIMsgCompDeliverMode.Now);
        subject = progressParams.subject;
      }
    }

    if (subject) {
      let title = itsASaveOperation ? "titleSaveMsgSubject" : "titleSendMsgSubject";
      document.title = gSendProgressStringBundle.getFormattedString(title, [subject]);
    } else {
      let title = itsASaveOperation ? "titleSaveMsg" : "titleSendMsg";
      document.title = gSendProgressStringBundle.getString(title);
    }

    dialog = {};
    dialog.status       = document.getElementById("dialog.status");
    dialog.progress     = document.getElementById("dialog.progress");
    dialog.progressText = document.getElementById("dialog.progressText");

    // set our web progress listener on the helper app launcher
    msgProgress.registerListener(progressListener);
}

function onUnload()
{
  if (msgProgress)
  {
    try
    {
      msgProgress.unregisterListener(progressListener);
      msgProgress = null;
    } catch (e) {}
  }
}

// If the user presses cancel, tell the app launcher and close the dialog...
function onCancel()
{
  // Cancel app launcher.
  try
  {
    msgProgress.processCanceledByUser = true;
  } catch (e)
  {
    return true;
  }

  // don't Close up dialog by returning false, the backend will close the dialog when everything will be aborted.
  return false;
}
