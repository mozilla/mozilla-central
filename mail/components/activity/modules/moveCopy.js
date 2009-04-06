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

const EXPORTED_SYMBOLS = ['moveCopyModule'];

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



// This module provides a link between the move/copy code and the activity
// manager.
let moveCopyModule =
{

  get log() {
    delete this.log;
    return this.log = Log4Moz.getConfiguredLogger("moveCopyModule");
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

  msgAdded : function(aMsg) {
  },

  msgsDeleted : function(aMsgList) {
    this.log.info("in msgsDeleted");

    let count = aMsgList.length;
    if (count <= 0)
      return;

    // get the folder of the deleted messages
    let folder = aMsgList.queryElementAt(0, Components.interfaces.nsIMsgDBHdr).folder;

    let displayText = PluralForm.get(count, this.getString("deletedMessages"));
    displayText = displayText.replace("#1", count)
    displayText = displayText.replace("#2", folder.prettiestName)

    let statusText = folder.server.prettyName;

    // create an activity event
    let event = new nsActEvent(displayText,
                               folder,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time
          
    for (let i = 0; i < count; i++)
    {
      let msgHdr = aMsgList.queryElementAt(i, Components.interfaces.nsIMsgDBHdr);
      event.addSubject(msgHdr.messageId);
    }

    this.activityMgr.addActivity(event);
  },

  msgsMoveCopyCompleted : function(aMove, aSrcMsgList, aDestFolder) {
    try {
      this.log.info("in msgsMoveCopyCompleted");

      let count = aSrcMsgList.length;
      if (count <= 0)
        return;

      // get the folder of the moved/copied messages
      let folder = aSrcMsgList.queryElementAt(0, Components.interfaces.nsIMsgDBHdr).folder;
      this.log.info("got folder");

      let statusText = '';
      // TODO: localize this string
      if (folder.server != aDestFolder.server)
      {
        statusText = this.getString("fromServerToServer");
        statusText = statusText.replace("#1", folder.server.prettyName);
        statusText = statusText.replace("#2", aDestFolder.server.prettyName);
      }
      else
      {
        statusText = folder.server.prettyName;
      }

      let displayText;
      if (aMove)
        displayText = PluralForm.get(count, this.getString("movedMessages"));
      else
        displayText = PluralForm.get(count, this.getString("copiedMessages"));

      displayText = displayText.replace("#1", count)
      displayText = displayText.replace("#2", folder.prettiestName)
      displayText = displayText.replace("#3", aDestFolder.prettiestName)

      // create an activity event
      let event = new nsActEvent(displayText,
                                 folder,
                                 statusText,
                                 Date.now(),    // start time
                                 Date.now());   // completion time
      for (let i = 0; i < count; i++)
      {
        let msgHdr = aSrcMsgList.queryElementAt(i, Components.interfaces.nsIMsgDBHdr);
        event.addSubject(msgHdr.messageId);
      }
      this.activityMgr.addActivity(event);
    } catch (e) {
      this.log.error("Exception: " + e)
    }
  },

  folderAdded: function(aFolder) {
  },

  folderDeleted : function(aFolder) {
    let displayText = this.getString("deletedFolder").replace("#1", aFolder.prettiestName);
    let statusText = aFolder.server.prettyName;
    
    // create an activity event
    let event = new nsActEvent(displayText,
                               aFolder.server,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.addSubject(aFolder);
        
    this.activityMgr.addActivity(event);
  },

  folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder) {
    this.log.info("in folderMoveCopyCompleted, aMove = " + aMove);

    let displayText;
    if (aMove)
      displayText = this.getString("movedFolder");
    else
      displayText = this.getString("copiedFolder");

    displayText = displayText.replace('#1', aSrcFolder.prettiestName);
    displayText = displayText.replace('#2', aDestFolder.prettiestName);

    let statusText = '';
    if (aSrcFolder.server != aDestFolder.server)
    {
      statusText = this.getString("fromServerToServer");
      statusText = statusText.replace("#1", aSrcFolder.server.prettyName);
      statusText = statusText.replace("#2", aDestFolder.server.prettyName);
    }
    else
    {
      statusText = aSrcFolder.server.prettyName;
    }
    // create an activity event
    let event = new nsActEvent(displayText,
                               aSrcFolder.server,
                               statusText,
                               Date.now(),    // start time
                               Date.now());   // completion time

    event.addSubject(aSrcFolder);
    event.addSubject(aDestFolder);

    this.activityMgr.addActivity(event);
  },

  folderRenamed: function(aOrigFolder, aNewFolder) {
    this.log.info("in folderRenamed, aOrigFolder = "+ aOrigFolder.prettiestName+", aNewFolder = "+ 
             aNewFolder.prettiestName);

    let displayText = this.getString("renamedFolder");
    displayText = displayText.replace("#1", aOrigFolder.prettiestName);
    displayText = displayText.replace("#2", aNewFolder.prettiestName);

    let statusText = aNewFolder.server.prettyName;

    // create an activity event
    let event = new nsActEvent(displayText,
                               aOrigFolder.server,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.addSubject(aOrigFolder);
    event.addSubject(aNewFolder);

    this.activityMgr.addActivity(event);
  },

  itemEvent: function(aItem, aEvent, aData) {
  },

  init: function() {
    // XXX when do we need to remove ourselves?
    let notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                                 .getService(Components.interfaces.nsIMsgFolderNotificationService);
    notificationService.addListener(this,
                                    notificationService.msgsDeleted |
                                    notificationService.msgsMoveCopyCompleted |
                                    notificationService.folderDeleted |
                                    notificationService.folderMoveCopyCompleted |
                                    notificationService.folderRenamed);
  }
}



