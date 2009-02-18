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
 *   Emre Birol <ebirol@gmail.com>
 *   David Ascher <dascher@mozillamessaging.com>
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

const EXPORTED_SYMBOLS = ['autosyncModule'];

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

const nsIAutoSyncMgrListener = Components.interfaces.nsIAutoSyncMgrListener;

/**
 * This code aims to mediate between the auto-sync code and the activity mgr.
 *
 * Not every auto-sync activity is directly  mapped to a process or event.
 * To prevent a possible event overflow, Auto-Sync monitor generates one
 * sync'd event per account when after all its _pending_ folders are sync'd,
 * rather than generating one event per folder sync.
 */

let autosyncModule =
{

  _inQFolderList : new Array(),
  _runnning : false,
  _syncInfoPerFolder: {},
  _syncInfoPerServer: {},

  get log() {
    delete this.log;
    return this.log = Log4Moz.getConfiguredLogger("autosyncActivities");
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
      return this.bundle.GetStringFromName(stringName)
    } catch (e) {
      this.log.error("error trying to get a string called: " + stringName);
      throw(e);
    }
  },

  createSyncMailProcess : function(folder) {
    try {
      // create an activity process for this folder
      let msg = this.bundle.formatStringFromName("autosyncProcessDisplayText",
                                                 [folder.prettiestName], 1)
      let process = new nsActProcess(msg, this.autoSyncManager);
      // we want to use default auto-sync icon
      process.iconClass = "syncMail";
      process.addSubject(folder);
      // group processes under folder's imap account
      process.contextType = "account";
      process.contextDisplayText = this.bundle.formatStringFromName("autosyncContextDisplayText",
                                        [folder.server.prettyName], 1)


      process.contextObj = folder.server;

      return process;
    } catch (e) {
      this.log.error("createSyncMailProcess: " + e);
      throw(e);
    }
  },

  createSyncMailEvent : function(syncItem) {
    try {
      // extract the relevant parts
      let process = syncItem.activity;
      let folder = syncItem.syncFolder;

      // create an activity event

      let msg = this.bundle.formatStringFromName("autosyncEventDisplayText",
                                                 [folder.server.prettyName], 1);

      let statusMsg;
      let numOfMessages = this._syncInfoPerServer[folder.server].totalDownloads;
      if (numOfMessages)
        statusMsg = this.bundle.formatStringFromName("autosyncEventStatusText",
                                                     [numOfMessages], 1);
      else
        statusMsg = this.getString("autosyncEventStatusTextNoMsgs");

      let event = new nsActEvent(msg, this.autoSyncManager, statusMsg,
                                 this._syncInfoPerServer[folder.server].startTime,
                                 Date.now());               // completion time

      // since auto-sync events do not have undo option by nature,
      // setting these values are informational only.
      event.contextType = process.contextType;
      event.contextDisplayText = this.bundle.formatStringFromName("autosyncContextDisplayText",
                                        [folder.server.prettyName], 1)
      event.contextObj = process.contextObj;

      // transfer all subjects.
      // same as above, not mandatory
      let subjects = process.getSubjects({});
      for each (let [, subject] in Iterator(subjects))
        event.addSubject(subject);

      return event;
    } catch (e) {
      this.log.error("createSyncMailEvent: " + e);
      throw(e);
    }
  },

  onStateChanged : function(running) {
    try {
      this._runnning = running;
      this.log.info("OnStatusChanged: " + (running ? "running" : "sleeping") + "\n");
    } catch (e) {
      this.log.error("onStateChanged: " + e);
      throw(e);
    }
  },

  onFolderAddedIntoQ : function(queue, folder) {
    try {
      if (folder instanceof Components.interfaces.nsIMsgFolder &&
          queue == nsIAutoSyncMgrListener.PriorityQueue) {
        this._inQFolderList.push(folder);
        this.log.info("Auto_Sync OnFolderAddedIntoQ [" + this._inQFolderList.length + "] " +
                        folder.prettiestName + " of " + folder.server.prettyName);
        // create an activity process for this folder
        let process = this.createSyncMailProcess(folder);

        // create a sync object to keep track of the process of this folder
        let imapFolder = folder.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
        let syncItem = { syncFolder: folder,
                         activity: process,
                         percentComplete: 0,
                         totalDownloaded: 0,
                         pendingMsgCount: imapFolder.autoSyncStateObj.pendingMessageCount
                       };

        // if this is the first folder of this server in the queue, then set the sync start time
        // for activity event
        if (!this._syncInfoPerServer[folder.server]) {
          this._syncInfoPerServer[folder.server] = { startTime: Date.now(),
                                                     totalDownloads: 0
                                                   };
        }

        // associate the sync object with the folder in question
        // use folder.URI as key
        this._syncInfoPerFolder[folder.URI] = syncItem;
      }
    } catch (e) {
      this.log.error("onFolderAddedIntoQ: " + e);
      throw(e);
    }
  },
  onFolderRemovedFromQ : function(queue, folder) {
    try {
      if (folder instanceof Components.interfaces.nsIMsgFolder &&
          queue == nsIAutoSyncMgrListener.PriorityQueue) {
        let i = this._inQFolderList.indexOf(folder);
        if (i > -1)
          this._inQFolderList.splice(i, 1);

        this.log.info("OnFolderRemovedFromQ [" + this._inQFolderList.length + "] " +
                        folder.prettiestName + " of " + folder.server.prettyName + "\n");

        let syncItem = this._syncInfoPerFolder[folder.URI];
        let process = syncItem.activity;
        if (process instanceof Components.interfaces.nsIActivityProcess)
        {
          canceled = (process.state == Components.interfaces.nsIActivityProcess.STATE_CANCELED);
          process.state = Components.interfaces.nsIActivityProcess.STATE_COMPLETED;

          try {
            this.activityMgr.removeActivity(process.id);
          }
          catch(e) {
            // It is OK to end up here; If the folder is queued and the
            // message get manually downloaded by the user, we might get
            // a folder removed notification even before a donwload
            // started for this folder. This behavior stems from the fact
            // that we add activities into the activity manager in
            // onDownloadStarted notification rather than onFolderAddedIntoQ.
            // This is an expected side effect.
          }

          // remove the folder/syncItem association from the table
          delete this._syncInfoPerFolder[folder.URI];
        }

        // if this is the last folder of this server in the queue
        // create a sync event and clean the sync start time
        let found = false;
        for each(let [key, value] in Iterator(this._syncInfoPerFolder))
        {
          if (value.syncFolder.server == folder.server)
          {
            found = true;
            break;
          }
        }
        this.log.info("Auto_Sync OnFolderRemovedFromQ Last folder of the server: " + !found);
        if (!found) {
          // create an sync event for the completed process if it's not canceled
          if (!canceled)
            this.activityMgr.addActivity(this.createSyncMailEvent(syncItem));
            
          delete this._syncInfoPerServer[folder.server];
        }
      }
    } catch (e) {
      this.log.error("onFolderRemovedFromQ: " + e);
      throw(e);
    }
  },
  onDownloadStarted : function(folder, numOfMessages, totalPending) {
    try {
      if (folder instanceof Components.interfaces.nsIMsgFolder) {
        this.log.info("OnDownloadStarted (" + numOfMessages + "/" + totalPending + "): " +
                                folder.prettiestName + " of " + folder.server.prettyName + "\n");

        let syncItem = this._syncInfoPerFolder[folder.URI];
        let process = syncItem.activity;

        // Update the totalPending number. if new messages have been discovered in the folder
        // after we added the folder into the q, totalPending might be greater than what we have
        // initially set
        if (totalPending > syncItem.pendingMsgCount)
          syncItem.pendingMsgCount = totalPending;

        if (process instanceof Components.interfaces.nsIActivityProcess) {
          // if the process has not beed added to activity manager already, add now
          if (!this.activityMgr.containsActivity(process.id)) {
            this.log.info("Auto_Sync OnDownloadStarted: No process, adding a new process");
            this.activityMgr.addActivity(process);
          }

          syncItem.totalDownloaded += numOfMessages;

          process.state = Components.interfaces.nsIActivityProcess.STATE_INPROGRESS;
          let percent = (syncItem.totalDownloaded/syncItem.pendingMsgCount)*100;
          if (percent > syncItem.percentComplete)
            syncItem.percentComplete = percent;

          let msg = this.bundle.formatStringFromName("autosyncProcessProgress",
                                                 [syncItem.totalDownloaded,
                                                  syncItem.pendingMsgCount,
                                                  folder.prettiestName], 3);

          process.setProgress(msg, numOfMessages, totalPending);

          this._syncInfoPerServer[syncItem.syncFolder.server].totalDownloads += numOfMessages;
        }
      }
    } catch (e) {
      this.log.error("onDownloadStarted: " + e);
      throw(e);
    }
  },

  onDownloadCompleted : function(folder) {
    try {
      if (folder instanceof Components.interfaces.nsIMsgFolder) {
        this.log.info("OnDownloadCompleted: " + folder.prettiestName + " of " +
                      folder.server.prettyName);

        let process = this._syncInfoPerFolder[folder.URI].activity;
        if (process instanceof Components.interfaces.nsIActivityProcess &&
           !this._running) {
          this.log.info("OnDownloadCompleted: Auto-Sync Manager is paused, pausing the process");
          process.state = Components.interfaces.nsIActivityProcess.STATE_PAUSED;
        }
      }
    } catch (e) {
      this.log.error("onDownloadCompleted: " + e);
      throw(e);
    }
  },

  onDownloadError : function(folder) {
    if (folder instanceof Components.interfaces.nsIMsgFolder) {
      this.log.error("OnDownloadError: " + folder.prettiestName + " of " +
                     folder.server.prettyName + "\n");
    }
  },

  onDiscoveryQProcessed : function (folder, numOfHdrsProcessed, leftToProcess) {
    this.log.info("onDiscoveryQProcessed: Processed " + numOfHdrsProcessed + "/" +
                  (leftToProcess+numOfHdrsProcessed) + " of " + folder.prettiestName + "\n");
  },

  onAutoSyncInitiated : function (folder) {
      this.log.info("onAutoSyncInitiated: " + folder.prettiestName + " of " +
                    folder.server.prettyName + " has been updated.\n");
  },

  getFolderListString : function() {
    let folderList;
    if (this._inQFolderList.length > 0)
      folderList = this._inQFolderList[0].prettiestName;

    for (let i = 1; i < this._inQFolderList.length; i++)
      folderList = folderList + ", " + this._inQFolderList[i].prettiestName;

    return folderList;
  },

  getAccountListString : function() {
    let accountList;
    if (this._inQFolderList.length > 0)
      accountList = this._inQFolderList[0].server.prettyName;

    for (let i = 1; i < this._inQFolderList.length; i++) {
      // do not include already existing account names
      if (accountList.search(this._inQFolderList[i].server.prettyName) == -1)
        accountList = accountList + ", " + this._inQFolderList[i].server.prettyName;
    }
    return accountList;
  },

  init: function() {
    // XXX when do we need to remove ourselves?
    this.log.info('initing');
    Components.classes["@mozilla.org/imap/autosyncmgr;1"]
      .getService(Components.interfaces.nsIAutoSyncManager).addListener(this);
  },
}
