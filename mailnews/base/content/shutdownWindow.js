/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var curTaskIndex = 0;
var numTasks = 0;
var stringBundle;

var msgShutdownService = Components.classes["@mozilla.org/messenger/msgshutdownservice;1"]
                           .getService(Components.interfaces.nsIMsgShutdownService);

function onLoad()
{
  numTasks = msgShutdownService.getNumTasks();

  stringBundle = document.getElementById("bundle_shutdown");
  document.title = stringBundle.getString("shutdownDialogTitle");

  updateTaskProgressLabel(1);
  updateProgressMeter(0);

  msgShutdownService.startShutdownTasks();
}

function updateProgressLabel(inTaskName)
{
  var curTaskLabel = document.getElementById("shutdownStatus_label");
  curTaskLabel.value = inTaskName;
}

function updateTaskProgressLabel(inCurTaskNum)
{
  var taskProgressLabel = document.getElementById("shutdownTask_label");
  taskProgressLabel.value = stringBundle.getFormattedString("taskProgress", [inCurTaskNum, numTasks]);
}

function updateProgressMeter(inPercent)
{
  var taskProgressmeter = document.getElementById('shutdown_progressmeter');
  taskProgressmeter.value = inPercent;
}

function onCancel()
{
  msgShutdownService.cancelShutdownTasks();
}

function nsMsgShutdownTaskListener() 
{
  msgShutdownService.setShutdownListener(this);
}

nsMsgShutdownTaskListener.prototype = 
{
  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
  {
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
    {
      window.close();
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
  {
    updateProgressMeter(((aCurTotalProgress / aMaxTotalProgress) * 100));
    updateTaskProgressLabel(aCurTotalProgress + 1);
  },

  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags)
  {
    // we can ignore this notification
  },

  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage)
  {
    if (aMessage)
      updateProgressLabel(aMessage);
  },

  onSecurityChange: function(aWebProgress, aRequest, state)
  {
    // we can ignore this notification
  }
}

var MsgShutdownTaskListener = new nsMsgShutdownTaskListener();

