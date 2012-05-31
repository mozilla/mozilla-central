/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
const nsMsgFolderFlags = Ci.nsMsgFolderFlags;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource:///modules/gloda/log4moz.js");

// This module provides a link between the move/copy code and the activity
// manager.
let moveCopyModule =
{
  lastMessage: {},
  lastFolder: {},

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
    return this.bundle = Services.strings
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

    let displayCount = count;
    // get the folder of the deleted messages
    let folder = aMsgList.queryElementAt(0, Components.interfaces.nsIMsgDBHdr).folder;

    let activities = this.activityMgr.getActivities({})
    if (activities.length > 0 &&
        activities[activities.length-1].id == this.lastMessage.id &&
        this.lastMessage.type == "deleteMail" &&
        this.lastMessage.folder == folder.prettiestName)
    {
      displayCount += this.lastMessage.count;
      this.activityMgr.removeActivity(this.lastMessage.id);
    }

    this.lastMessage = {};
    let displayText = PluralForm.get(displayCount, this.getString("deletedMessages2"));
    displayText = displayText.replace("#1", displayCount)
    this.lastMessage.count = displayCount;
    displayText = displayText.replace("#2", folder.prettiestName)
    this.lastMessage.folder = folder.prettiestName;

    let statusText = folder.server.prettyName;

    // create an activity event
    let event = new nsActEvent(displayText,
                               folder,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.iconClass = "deleteMail";
    this.lastMessage.type = event.iconClass;

    for (let i = 0; i < count; i++)
    {
      let msgHdr = aMsgList.queryElementAt(i, Components.interfaces.nsIMsgDBHdr);
      event.addSubject(msgHdr.messageId);
    }

    this.lastMessage.id = this.activityMgr.addActivity(event);
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

      let displayCount = count;

      let activities = this.activityMgr.getActivities({})
      if (activities.length > 0 &&
          activities[activities.length-1].id == this.lastMessage.id &&
          this.lastMessage.type == aMove ? "moveMail" : "copyMail" &&
          this.lastMessage.sourceFolder == folder.prettiestName &&
          this.lastMessage.destFolder == aDestFolder.prettiestName)
      {
        displayCount += this.lastMessage.count;
        this.activityMgr.removeActivity(this.lastMessage.id);
      }

      let statusText = '';
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

      this.lastMessage = {};
      let displayText;
      if (aMove)
        displayText = PluralForm.get(displayCount,
                                     this.getString("movedMessages"));
      else
        displayText = PluralForm.get(displayCount,
                                     this.getString("copiedMessages"));

      displayText = displayText.replace("#1", displayCount)
      this.lastMessage.count = displayCount;
      displayText = displayText.replace("#2", folder.prettiestName)
      this.lastMessage.sourceFolder = folder.prettiestName;
      displayText = displayText.replace("#3", aDestFolder.prettiestName)
      this.lastMessage.destFolder = aDestFolder.prettiestName;

      // create an activity event
      let event = new nsActEvent(displayText,
                                 folder,
                                 statusText,
                                 Date.now(),    // start time
                                 Date.now());   // completion time
      event.iconClass = aMove ? "moveMail" : "copyMail";
      this.lastMessage.type = event.iconClass;

      for (let i = 0; i < count; i++)
      {
        let msgHdr = aSrcMsgList.queryElementAt(i, Components.interfaces.nsIMsgDBHdr);
        event.addSubject(msgHdr.messageId);
      }
      this.lastMessage.id = this.activityMgr.addActivity(event);
    } catch (e) {
      this.log.error("Exception: " + e)
    }
  },

  folderAdded: function(aFolder) {
  },

  folderDeleted : function(aFolder) {
    let server = aFolder.server;
    // If the account has been removed, we're going to ignore this notification.
    try {
      MailServices.accounts.FindServer(server.username, server.hostName, server.type);
    }
    catch(ex) {return;}

    let displayText;
    let statusText = aFolder.server.prettyName;

    // Display a different message depending on whether we emptied the trash
    // or actually deleted a folder
    if (aFolder.isSpecialFolder(nsMsgFolderFlags.Trash, false))
      displayText = this.getString("emptiedTrash");
    else
      displayText = this.getString("deletedFolder").replace("#1", aFolder.prettiestName);

    // create an activity event
    let event = new nsActEvent(displayText,
                               aFolder.server,
                               statusText,
                               Date.now(),  // start time
                               Date.now()); // completion time

    event.addSubject(aFolder);
    event.iconClass = "deleteMail";

    // When we rename, we get a delete event as well as a rename, so store
    // the last folder we deleted
    this.lastFolder = {};
    this.lastFolder.URI = aFolder.URI;
    this.lastFolder.event = this.activityMgr.addActivity(event);
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
    event.iconClass = aMove ? "moveMail" : "copyMail";

    this.activityMgr.addActivity(event);
  },

  folderRenamed: function(aOrigFolder, aNewFolder) {
    this.log.info("in folderRenamed, aOrigFolder = "+ aOrigFolder.prettiestName+", aNewFolder = "+ 
             aNewFolder.prettiestName);

    let displayText;
    let statusText = aNewFolder.server.prettyName;

    // Display a different message depending on whether we moved the folder
    // to the trash or actually renamed the folder.
    if (aNewFolder.isSpecialFolder(nsMsgFolderFlags.Trash, true))
    {
      displayText = this.getString("movedFolderToTrash");
      displayText = displayText.replace("#1", aOrigFolder.prettiestName);
    }
    else
    {
      displayText = this.getString("renamedFolder");
      displayText = displayText.replace("#1", aOrigFolder.prettiestName);
      displayText = displayText.replace("#2", aNewFolder.prettiestName);
    }

    // When renaming a folder, a delete event is always fired first
    if (this.lastFolder.URI == aOrigFolder.URI)
      this.activityMgr.removeActivity(this.lastFolder.event);

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
    MailServices.mfn.addListener(this,
                                 MailServices.mfn.msgsDeleted |
                                 MailServices.mfn.msgsMoveCopyCompleted |
                                 MailServices.mfn.folderDeleted |
                                 MailServices.mfn.folderMoveCopyCompleted |
                                 MailServices.mfn.folderRenamed);
  }
}
