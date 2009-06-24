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
    sendLaterModule.onMessageSendProgress(0, 0, aPercentage, 0);
  }
};

// This module provides a link between the send later service and the activity
// manager.
let sendLaterModule =
{
  _sendProcess: null,
  _copyProcess: null,
  _identity: null,
  _subject: null,

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

  _displayTextForHeader: function(aLocaleStringBase, aSubject) {
    return aSubject ?
           this.bundle.formatStringFromName(aLocaleStringBase + "WithSubject",
                                            [aSubject], 1) :
           this.bundle.GetStringFromName(aLocaleStringBase);
  },

  _newProcess: function(aLocaleStringBase, aAddSubject) {
    let process =
      new nsActProcess(this._displayTextForHeader(aLocaleStringBase,
                                                  aAddSubject ?
                                                  this._subject :
                                                  ""),
                                   this.activityMgr);

    process.iconClass = "sendMail";
    process.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT;
    process.contextObj = this;
    process.contextType = "SendLater";
    process.contextDisplayText = this.bundle.GetStringFromName("sendingMessages");

    return process;
  },

  // Use this to group an activity by the identity if we have one.
  _applyIdentityGrouping: function(aActivity) {
    if (this._identity) {
      aActivity.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_BYCONTEXT;
      aActivity.contextType = this._identity.key;
      aActivity.contextObj = this._identity;
      let contextDisplayText = this._identity.identityName;
      if (!contextDisplayText)
        contextDisplayText = this._identity.email;

      aActivity.contextDisplayText = contextDisplayText;

    }
    else
      aActivity.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;
  },

  // Replaces the process with an event that reflects a completed process.
  _replaceProcessWithEvent: function(aProcess) {
    this.activityMgr.removeActivity(aProcess.id);

    let event = new nsActEvent(this._displayTextForHeader("sentMessage",
                                                          this._subject),
                               this.activityMgr, null, aProcess.startTime,
                               new Date());

    event.iconClass = "sendMail";
    this._applyIdentityGrouping(event);
 
    this.activityMgr.addActivity(event);
  },

  // Replaces the process with a warning that reflects the failed process.
  _replaceProcessWithWarning: function(aProcess, aCopyOrSend, aStatus, aMsg,
                                       aMessageHeader) {
    this.activityMgr.removeActivity(aProcess.id);

    let warning =
      new nsActWarning(this._displayTextForHeader("failedTo" + aCopyOrSend,
                                                  this._subject),
                       this.activityMgr, "");

    warning.groupingStyle = Ci.nsIActivity.GROUPING_STYLE_STANDALONE;
    this._applyIdentityGrouping(warning);

    this.activityMgr.addActivity(warning);
  },

  onStartSending: function(aTotalMessageCount) {
    if (!aTotalMessageCount) {
      this.log.error("onStartSending called with zero messages\n");
      return;
    }
  },

  onMessageStartSending: function(aCurrentMessage, aTotalMessageCount,
                                  aMessageHeader, aIdentity) {

    // We want to use the identity and subject later, so store them for now.
    this._identity = aIdentity;
    if (aMessageHeader)
      this._subject = aMessageHeader.subject;

    // Create the process to display the send activity.
    let process = this._newProcess("sendingMessage", true);
    this._sendProcess = process;
    this.activityMgr.addActivity(process);

    // Now the one for the copy process.
    process = this._newProcess("copyMessage", false);
    this._copyProcess = process;
    this.activityMgr.addActivity(process);
  },

  onMessageSendProgress: function(aCurrentMessage, aTotalMessageCount,
                                  aMessageSendPercent,
                                  aMessageCopyPercent) {
    if (aMessageSendPercent < 100) {
      // Ensure we are in progress...
      if (this._sendProcess.state != Ci.nsIActivityProcess.STATE_INPROGRESS)
        this._sendProcess.state = Ci.nsIActivityProcess.STATE_INPROGRESS;

      // ... and update the progress.
      this._sendProcess.setProgress(this._sendProcess.lastStatusText,
                                    aMessageSendPercent, 100);
    }
    else if (aMessageSendPercent == 100) {
      if (aMessageCopyPercent == 0) {
        // Set send state to completed
        if (this._sendProcess.state != Ci.nsIActivityProcess.STATE_COMPLETED)
          this._sendProcess.state = Ci.nsIActivityProcess.STATE_COMPLETED;
        this._replaceProcessWithEvent(this._sendProcess);

        // Set copy state to in progress.
        if (this._copyProcess.state != Ci.nsIActivityProcess.STATE_INPROGRESS)
          this._copyProcess.state = Ci.nsIActivityProcess.STATE_INPROGRESS;

        // We don't know the progress of the copy, so just set to 0, and we'll
        // display an undetermined progress meter.
        this._copyProcess.setProgress(this._copyProcess.lastStatusText,
                                      0, 0);
      }
      else if (aMessageCopyPercent < 100) {
      }
      else {
        // We need to set this to completed otherwise activity manager
        // complains.
        if (this._copyProcess.state != Ci.nsIActivityProcess.STATE_COMPLETED)
          this._copyProcess.state = Ci.nsIActivityProcess.STATE_COMPLETED;

        // Just drop the copy process, we don't need it now.
        this.activityMgr.removeActivity(this._copyProcess.id);
        this._sendProcess = null;
        this._copyProcess = null;
      }
    }
  },

  onMessageSendError: function(aCurrentMessage, aMessageHeader, aStatus,
                               aMsg) {
    if (this._sendProcess &&
        this._sendProcess.state != Ci.nsIActivityProcess.STATE_COMPLETED) {
      this._sendProcess.state = Ci.nsIActivityProcess.STATE_COMPLETED;
      this._replaceProcessWithWarning(this._sendProcess, "SendMessage", aStatus, aMsg,
                                      aMessageHeader);
      this._sendProcess = null;

      if (this._copyProcess &&
          this._copyProcess.state != Ci.nsIActivityProcess.STATE_COMPLETED) {
        this._copyProcess.state = Ci.nsIActivityProcess.STATE_COMPLETED;
        this.activityMgr.removeActivity(this._copyProcess.id);
        this._copyProcess = null;
      }
    }
  },

  onMsgStatus: function(aStatusText) {
    this._sendProcess.setProgress(aStatusText, this._sendProcess.workUnitComplete,
                                  this._sendProcess.totalWorkUnits);
  },

  onStopSending: function(aStatus, aMsg, aTotalTried, aSuccessful) {
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
