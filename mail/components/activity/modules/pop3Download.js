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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozillamessaging.com>
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

const EXPORTED_SYMBOLS = ['pop3DownloadModule'];

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

// This module provides a link between the pop3 service code and the activity
// manager.
let pop3DownloadModule =
{
  // hash table of most recent download items per folder
  _mostRecentActivityForFolder: {},
  // hash table of prev download items per folder, so we can
  // coalesce consecutive no new message events.
  _prevActivityForFolder: {},

  get log() {
    delete this.log;
    return this.log = Log4Moz.getConfiguredLogger("pop3DownloadsModule");
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

  onDownloadStarted : function(aFolder) {
    this.log.info("in onDownloadStarted");

    let displayText = this.bundle
                          .formatStringFromName("pop3EventStartDisplayText",
                                               [aFolder.prettiestName], 1);
    // remember the prev activity for this folder, if any.
    this._prevActivityForFolder[aFolder.URI] =
      this._mostRecentActivityForFolder[aFolder.URI];
    let statusText = aFolder.server.prettyName;

    // create an activity event
    let event = new nsActEvent(displayText,
                               aFolder,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.iconClass = "syncMail";

    let downloadItem = {};
    downloadItem.eventID = this.activityMgr.addActivity(event);
    this._mostRecentActivityForFolder[aFolder.URI] = downloadItem;
  },

  onDownloadProgress : function(aFolder, aNumMsgsDownloaded, aTotalMsgs) {
    this.log.info("in onDownloadProgress");
  },

  onDownloadCompleted : function(aFolder, aNumMsgsDownloaded) {
    this.log.info("in onDownloadCompleted");

    this.activityMgr.removeActivity(this._mostRecentActivityForFolder[aFolder.URI].eventID);

    let displayText;
    if (aNumMsgsDownloaded > 0)
    {
      displayText = PluralForm.get(aNumMsgsDownloaded, this.getString("pop3EventStatusText"));
      displayText = displayText.replace("#1", aNumMsgsDownloaded);
    }
    else
      displayText = this.getString("pop3EventStatusTextNoMsgs");

    let statusText = aFolder.server.prettyName;

    // create an activity event
    let event = new nsActEvent(displayText,
                               aFolder,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.iconClass = "syncMail";

    let downloadItem = {numMsgsDownloaded: aNumMsgsDownloaded};
    this._mostRecentActivityForFolder[aFolder.URI] = downloadItem;
    downloadItem.eventID = this.activityMgr.addActivity(event);
    if (!aNumMsgsDownloaded) {
      // if we didn't download any messages this time, and the prev event
      // for this folder also didn't download any messages, remove the
      // prev event from the activity manager.
      let prevItem = this._prevActivityForFolder[aFolder.URI];
      if (prevItem != undefined && !prevItem.numMsgsDownloaded)
        this.activityMgr.removeActivity(prevItem.eventID);
    }
  },
  init: function() {
    // XXX when do we need to remove ourselves?
    pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                     .getService(Ci.nsIPop3Service);
    pop3Service.addListener(this);
  }
};

