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
 *   David Ascher <dascher@mozillamessaging.com>
 *   Emre Birol <emrebirol@gmail.com>
 *   Myk Melez <myk@mozilla.org>
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

const EXPORTED_SYMBOLS = ["glodaIndexerActivity"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

const nsActProcess = Components.Constructor("@mozilla.org/activity-process;1",
                                            "nsIActivityProcess", "init");
const nsActEvent   = Components.Constructor("@mozilla.org/activity-event;1",
                                            "nsIActivityEvent", "init");
const nsActWarning = Components.Constructor("@mozilla.org/activity-warning;1",
                                            "nsIActivityWarning", "init");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/PluralForm.jsm");
Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/indexer.js");

/**
 * Gloda message indexer feedback.
 */
let glodaIndexerActivity =
{
  get log() {
    delete this.log;
    return this.log = Log4Moz.getConfiguredLogger("glodaIndexerActivity");
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

  getString: function(stringName) {
    try {
      return this.bundle.GetStringFromName(stringName);
    } catch (e) {
      this.log.error("error trying to get a string called: " + stringName);
      throw(e);
    }
  },

  init: function() {
    // Register a listener with the Gloda indexer that receives notifications
    // about Gloda indexing status.  We wrap the listener in this function so we
    // can set |this| to the GlodaIndexerActivity object inside the listener.
    function listenerWrapper()
    {
      glodaIndexerActivity.listener.apply(glodaIndexerActivity, arguments);
    };
    GlodaIndexer.addListener(listenerWrapper);
  },

  /**
   * Information about the current job.  An object with these properties:
   *
   *   folder       {String}
   *                the name of the folder being processed by the job
   *   jobNumber    {Number}
   *                the index of the job in the list of jobs
   *   process      {nsIActivityProcess}
   *                the activity process corresponding to the current job
   *   startTime    {Date}
   *                the time at which we were first notified about the job
   *   totalItemNum {Number}
   *                the total number of messages being indexed in the job
   */
  currentJob: null,

  listener: function(aStatus, aFolder, aJobNumber, aItemNumber,
                     aTotalItemNum)
  {
    this.log.debug("Gloda Indexer Folder/Status: " + aFolder + "/" + aStatus);
    this.log.debug("Gloda Indexer Job: " + aJobNumber);
    this.log.debug("Gloda Indexer Item: " + aItemNumber + "/" + aTotalItemNum);

    if (aStatus == Gloda.kIndexerIdle)
    {
      if (this.currentJob)
        this.onJobCompleted();
    }
    else
    {
      // If the job numbers have changed, the indexer has finished the job
      // we were previously tracking, so convert the corresponding process
      // into an event and start a new process to track the new job.
      if (this.currentJob && aJobNumber != this.currentJob.jobNumber)
        this.onJobCompleted();

      // If we aren't tracking a job, either this is the first time we've been
      // called or the last job we were tracking was completed.  Either way,
      // start tracking the new job.
      if (!this.currentJob)
        this.onJobBegun(aFolder, aJobNumber, aTotalItemNum);

      // If there is only one item, don't bother creating a progress item.
      if (aTotalItemNum != 1)
        this.onJobProgress(aFolder, aItemNumber, aTotalItemNum);
    }
  },

  onJobBegun: function(aFolder, aJobNumber, aTotalItemNum) {
    let displayText =
      aFolder ? this.getString("indexingFolder").replace("#1", aFolder)
              : this.getString("indexing");
    let process = new nsActProcess(displayText, Gloda);

    process.iconClass   = "indexMail";
    process.contextType = "account";
    process.contextObj  = aFolder;
    process.addSubject(aFolder);

    this.currentJob = {
      folder:       aFolder,
      jobNumber:    aJobNumber,
      process:      process,
      startTime:    new Date(),
      totalItemNum: aTotalItemNum
    };

    this.activityMgr.addActivity(process);
  },

  onJobProgress: function(aFolder, aItemNumber, aTotalItemNum) {
    this.currentJob.process.state = Ci.nsIActivityProcess.STATE_INPROGRESS;
    // The total number of items being processed in the job can change, as can
    // the folder being processed, since we sometimes get notified about a job
    // before it has determined these things, so we update them here.
    this.currentJob.folder = aFolder;
    this.currentJob.totalItemNum = aTotalItemNum;

    let statusText;
    if (aTotalItemNum == null) {
      statusText = aFolder ? this.getString("indexingFolderStatusVague")
                               .replace("#1", aFolder)
                           : this.getString("indexingStatusVague");
    }
    else {
      let percentComplete =
        aTotalItemNum == 0 ? 100 : parseInt(aItemNumber / aTotalItemNum * 100);
      // Note: we must replace the folder name placeholder last; otherwise,
      // if the name happens to contain another one of the placeholders, we'll
      // hork the name when replacing it.
      statusText = this.getString(aFolder ? "indexingFolderStatusExact"
                                          : "indexingStatusExact");
      statusText = PluralForm.get(aTotalItemNum, statusText)
                     .replace("#1", aItemNumber + 1)
                     .replace("#2", aTotalItemNum)
                     .replace("#3", percentComplete)
                     .replace("#4", aFolder);
    }

    this.currentJob.process.setProgress(statusText, aItemNumber, aTotalItemNum);
  },

  onJobCompleted: function() {
    this.currentJob.process.state = Ci.nsIActivityProcess.STATE_COMPLETED;

    this.activityMgr.removeActivity(this.currentJob.process.id);

    // this.currentJob.totalItemNum might still be null at this point
    // if we were first notified about the job before the indexer determined
    // the number of messages to index and then it didn't find any to index.
    let totalItemNum = this.currentJob.totalItemNum || 0;

    // We only create activity events when specific folders get indexed,
    // since event-driven indexing jobs are too numerous.  We also only create
    // them when we ended up indexing something in the folder, since otherwise
    // we'd spam the activity manager with too many "indexed 0 messages" items
    // that aren't useful enough to justify their presence in the manager.
    // TODO: Aggregate event-driven indexing jobs into batches significant
    // enough for us to create activity events for them.
    if (this.currentJob.folder && totalItemNum > 0) {
      // Note: we must replace the folder name placeholder last; otherwise,
      // if the name happens to contain another one of the placeholders, we'll
      // hork the name when replacing it.
      let displayText = PluralForm.get(totalItemNum,
                                       this.getString("indexedFolder"))
                          .replace("#1", totalItemNum)
                          .replace("#2", this.currentJob.folder);

      let endTime = new Date();
      let secondsElapsed = parseInt((endTime - this.currentJob.startTime)/1000);

      let statusText = PluralForm.get(secondsElapsed,
                                      this.getString("indexedFolderStatus"))
                         .replace("#1", secondsElapsed);

      let event = new nsActEvent(displayText,
                                 Gloda,
                                 statusText,
                                 this.currentJob.startTime,
                                 endTime);
      event.contextType = this.currentJob.contextType;
      event.contextObj = this.currentJob.contextObj;
      event.iconClass   = "indexMail";

      // Transfer subjects.
      let subjects = this.currentJob.process.getSubjects({});
      for each (let [, subject] in Iterator(subjects))
        event.addSubject(subject);

      this.activityMgr.addActivity(event);
    }

    this.currentJob = null;
  }

};
