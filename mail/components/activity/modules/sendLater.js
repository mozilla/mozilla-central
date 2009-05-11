/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Thunderbird Activity Manager.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

const EXPORTED_SYMBOLS = ['sendLaterModule'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const nsActProcess = Components.Constructor("@mozilla.org/activity-process;1",
                                            "nsIActivityProcess", "init");
const nsActEvent = Components.Constructor("@mozilla.org/activity-event;1",
                                          "nsIActivityEvent", "init");
const nsActWarning = Components.Constructor("@mozilla.org/activity-warning;1",
                                            "nsIActivityWarning", "init");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://app/modules/gloda/log4moz.js");

/**
 * This really, really, sucks. Due to mailnews widespread use of
 * nsIMsgStatusFeedback we're bound to the UI to get any sensible feedback of
 * mail sending operations. The current send later code can't hook into the
 * progress listener easily to get the state of messages being sent, so we'll
 * just have to do it here.
 */
let sendMsgProgressListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgStatusFeedback,
                                         Ci.nsISupportsWeakReference]),

  showStatusString: function(aStatusText) {
    sendLaterModule.onMsgStatus(aStatusText);
  },

  startMeteors: function() {
  },

  stopMeteors: function() {
  },

  showProgress: function (aPercentage) {
    sendLaterModule.onMsgProgress(aPercentage);
  }
};

// This module provides a link between the send later service and the activity
// manager.
let sendLaterModule =
{
  _process: null,

  get log() {
    delete this.log;
    return this.log = Log4Moz.getConfiguredLogger("sendLaterModule");
  },

  get activityMgr() {
    delete this.activityMgr;
    return this.activityMgr = Cc["@mozilla.org/activity-manager;1"]
                                .getService(Ci.nsIActivityManager);
  },

  get bundle() {
    delete this.bundle;
    let bundleSvc = Cc["@mozilla.org/intl/stringbundle;1"]
                      .getService(Ci.nsIStringBundleService);

    return this.bundle = bundleSvc
      .createBundle("chrome://messenger/locale/activity.properties");
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgSendLaterListener]),

  _newProcess: function(aTo) {
    let displayText;

    if (aTo) {
      displayText = this.bundle.formatStringFromName("sendingMessageTo",
                                                     [aTo], 1);
    }
    else {
      displayText = this.bundle.GetStringFromName("sendingMessage");
    }

    let process = new nsActProcess(displayText, this.activityMgr);

    process.iconClass = "sendMail";
    // XXX For now group these standalone, later we can group by identity or
    // something more meaningful.
    process.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;

    return process;
  },

  // Replaces the process with an event that reflects a completed process.
  _replaceProcessWithEvent: function(aProcess) {
    this.activityMgr.removeActivity(aProcess.id);

    let event = new nsActEvent(this.bundle.GetStringFromName("sentMessage"),
                               this.activityMgr, null, aProcess.startTime,
                               new Date());

    event.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;
    event.iconClass = "sendMail";

    this.activityMgr.addActivity(event);
  },

  // Replaces the process with a warning that reflects the failed process.
  _replaceProcessWithWarning: function(aProcess, aStatus) {
    this.activityMgr.removeActivity(aProcess.id);

    let warning = new nsActWarning(this.bundle.GetStringFromName("failedToSendMessage"),
                                   this.activityMgr, "");

    warning.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;

    this.activityMgr.addActivity(warning);
  },

  onStartSending: function(aTotalMessageCount) {
    try {
      if (!aTotalMessageCount) {
        this.log.error("onStartSending called with zero messages\n");
        return;
      }

      this.currentMsg = 0;

      // Create the first process for the sending
      let process = this._newProcess("");

      this._process = process;

      this.activityMgr.addActivity(process);
    }
    catch (ex) {
      dump(ex);
    }
  },

  onProgress: function(aCurrentMessage, aTotalMessages) {
    if (this._process.state != Ci.nsIActivityProcess.STATE_COMPLETED) {
      this.log.debug("Warning, last send did not reach 100%");
      this._process.state = Ci.nsIActivityProcess.STATE_COMPLETED;
    }

    // When we get onProgress we always know we've been successful in sending
    // the message.
    this._replaceProcessWithEvent(this._process);
    this._process = null;

    if (aCurrentMessage < aTotalMessages) {
      ++this.currentMsg;

      // Create the first process for the sending
      let process = this._newProcess("");

      this._process = process;

      this.activityMgr.addActivity(process);
    }
  },

  onMsgStatus: function(aStatusText) {
    this._process.setProgress(aStatusText, this._process.workUnitComplete,
                              this._process.totalWorkUnits);
  },

  onMsgProgress: function(aCurrentProgress) {
    // For some reason we never get 100%, but we do get 0!
    if (aCurrentProgress == 0 && this._process.workUnitComplete > 0)
      aCurrentProgress = 100;

    if (aCurrentProgress < 100) {
      if (this._process.state != Ci.nsIActivityProcess.STATE_INPROGRESS)
        this._process.state = Ci.nsIActivityProcess.STATE_INPROGRESS;

      this._process.setProgress(this._process.lastStatusText, aCurrentProgress,
                                100);
    }
    else
      this._process.state = Ci.nsIActivityProcess.STATE_COMPLETED;
  },

  onStopSending: function(aStatus, aMsg, aTotalTried, aSuccessful) {
    if (this._process.state != Ci.nsIActivityProcess.STATE_COMPLETED) {
      this.log.debug("Warning, last send did not reach 100%");
      this._process.state = Ci.nsIActivityProcess.STATE_COMPLETED;
    }

    if (aStatus == 0)
      this._replaceProcessWithEvent(this._process);
    else
      this._replaceProcessWithWarning(this._process, aStatus);
    this._process = null;

    this._process = null;
  },

  init: function() {
    // We should need to remove the listener as we're not being held by anyone
    // except by the send later instance.
    let sendLaterService = Cc["@mozilla.org/messengercompose/sendlater;1"]
                             .getService(Ci.nsIMsgSendLater);

    sendLaterService.addListener(this);

    // Also add the nsIMsgStatusFeedback object.
    let statusFeedback = Cc["@mozilla.org/messenger/statusfeedback;1"]
                           .createInstance(Ci.nsIMsgStatusFeedback);

    statusFeedback.setWrappedStatusFeedback(sendMsgProgressListener);

    sendLaterService.statusFeedback = statusFeedback;
  }
};
