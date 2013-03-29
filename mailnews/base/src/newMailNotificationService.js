/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* platform-independent code to count new and unread messages and pass the information to
 * platform-specific notification modules
 *
 * Logging for this module uses the TB version of log4moz. Default logging is at the Warn
 * level. Other possibly interesting messages are at Error, Info and Debug. To configure, set the
 * preferences "mail.notification.logging.console" (for the error console) or
 * "mail.notification.logging.dump" (for stderr) to the string indicating the level you want.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/iteratorUtils.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const NMNS = Ci.mozINewMailNotificationService;

const countInboxesPref = "mail.notification.count.inbox_only";
// Old name for pref
const countNewMessagesPref = "mail.biff.use_new_count_in_mac_dock";
// When we go cross-platform we should migrate to
// const countNewMessagesPref = "mail.notification.count.new";

// Helper function to retrieve a boolean preference with a default
function getBoolPref(pref, defaultValue) {
  try {
    return Services.prefs.getBoolPref(pref);
  }
  catch(e) {
    return defaultValue;
  }
}


// constructor
function NewMailNotificationService() {
  this._mUnreadCount = 0;
  this._mNewCount = 0;
  this._listeners = [];
  this.wrappedJSObject = this;

  this._log = Log4Moz.getConfiguredLogger("mail.notification",
                                          Log4Moz.Level.Warn,
                                          Log4Moz.Level.Warn,
                                          Log4Moz.Level.Warn);

  // Listen for mail-startup-done to do the rest of our setup after folders are initialized
  Services.obs.addObserver(this, "mail-startup-done", false);
}

NewMailNotificationService.prototype = {
  classDescription: "Maintain counts of new and unread messages",
  classID:              Components.ID("{740880E6-E299-4165-B82F-DF1DCAB3AE22}"),
  contractID:           "@mozilla.org/newMailNotificationService;1",
  QueryInterface:       XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsIFolderListener, Ci.mozINewMailNotificationService]),
  _xpcom_factory: XPCOMUtils.generateSingletonFactory(NewMailNotificationService),
  
  _mUnreadCount: 0,
  _mNewCount: 0,
  _listeners: null,
  _log: null,

  get countNew() {
    return getBoolPref(countNewMessagesPref, false);
  },

  observe: function NMNS_Observe(aSubject, aTopic, aData) {
    // Set up to catch updates to unread count
    this._log.info("NMNS_Observe: " + aTopic);

    try {
      if (aTopic == "mail-startup-done") {
        try {
          Services.obs.removeObserver(this, "mail-startup-done");
        }
        catch (e) {
          this._log.error("NMNS_Observe: unable to deregister mail-startup-done listener: " + e);
        }
        Services.obs.addObserver(this, "xpcom-shutdown", false);
        MailServices.mailSession.AddFolderListener(this, Ci.nsIFolderListener.intPropertyChanged |
                                                         Ci.nsIFolderListener.added |
                                                         Ci.nsIFolderListener.removed |
                                                         Ci.nsIFolderListener.propertyFlagChanged);
        this._initUnreadCount();
      }
      else if (aTopic == "xpcom-shutdown") {
        try {
          MailServices.mailSession.RemoveFolderListener(this);
          Services.obs.removeObserver(this, "xpcom-shutdown");
        }
        catch (e) {
          this._log.error("NMNS_Observe: unable to deregister listeners at shutdown: " + e);
        }
      }
    } catch (error) {
      this._log.error("NMNS_Observe failed: " + error);
    }
  },

  _initUnreadCount: function NMNS_initUnreadCount() {
    let total = 0;
    let allServers = MailServices.accounts.allServers;
    for (let i = 0; i < allServers.length; i++) {
      let currentServer = allServers.queryElementAt(i, Ci.nsIMsgIncomingServer);
      this._log.debug("NMNS_initUnread: server " + currentServer.prettyName + " type " + currentServer.type);
      // Don't bother counting RSS or NNTP servers
      let type = currentServer.type;
      if (type == "rss" || type == "nntp")
        continue;

      let rootFolder = currentServer.rootFolder;
      if (rootFolder) {
        total += this._countUnread(rootFolder);
      }
    }
    this._mUnreadCount = total;
    if (!this.countNew) {
      this._log.info("NMNS_initUnread notifying listeners: " + total + " total unread messages");
      this._notifyListeners(NMNS.count, "onCountChanged", total);
    }
  },

  // Count all the unread messages below the given folder
  _countUnread: function NMNS_countUnread(folder) {
    this._log.trace("NMNS_countUnread: parent folder " + folder.URI);
    let unreadCount = 0;

    if (this.confirmShouldCount(folder)) {
      let count = folder.getNumUnread(false);
      this._log.debug("NMNS_countUnread: folder " + folder.URI + ", " + count + " unread");
      if (count > 0)
        unreadCount += count;
    }

    let allFolders = folder.descendants;
    for (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
      if (this.confirmShouldCount(folder)) {
        let count = folder.getNumUnread(false);
        this._log.debug("NMNS_countUnread: folder " + folder.URI + ", " + count + " unread");
        if (count > 0)
          unreadCount += count;
      }
    }
    return unreadCount;
  },

  // Filter out special folders and then ask for observers to see if
  // we should monitor unread messages in this folder
  confirmShouldCount: function NMNS_confirmShouldCount(aFolder) {
    let shouldCount = Cc['@mozilla.org/supports-PRBool;1'].createInstance(Ci.nsISupportsPRBool);
    shouldCount.data = true;
    this._log.trace("NMNS_confirmShouldCount: folder " + aFolder.URI + " flags " + aFolder.flags);
    let srv = null;

    // If it's not a mail folder we don't count it by default
    if (!(aFolder.flags & Ci.nsMsgFolderFlags.Mail))
      shouldCount.data = false;

    // For whatever reason, RSS folders have the 'Mail' flag
    else if ((srv = aFolder.server) && (srv.type == "rss"))
      shouldCount.data = false;

    // If it's a special folder *other than the inbox* we don't count it by default
    else if ((aFolder.flags & Ci.nsMsgFolderFlags.SpecialUse)
        && !(aFolder.flags & Ci.nsMsgFolderFlags.Inbox))
      shouldCount.data = false;

    else if (aFolder.flags & Ci.nsMsgFolderFlags.Virtual)
      shouldCount.data = false;

    // if we're only counting inboxes and it's not an inbox...
    else
      try {
      // If we can't get this pref, just leave it as the default
      let onlyCountInboxes = Services.prefs.getBoolPref(countInboxesPref);
      if (onlyCountInboxes && !(aFolder.flags & Ci.nsMsgFolderFlags.Inbox))
        shouldCount.data = false;
      } catch (error) {}

    this._log.trace("NMNS_confirmShouldCount: before observers " + shouldCount.data);
    Services.obs.notifyObservers(shouldCount, "before-count-unread-for-folder", aFolder.URI);
    this._log.trace("NMNS_confirmShouldCount: after observers " + shouldCount.data);

    return shouldCount.data;
  },

  OnItemIntPropertyChanged: function NMNS_OnItemIntPropertyChanged(folder, property, oldValue, newValue) {
    try {
      if (property == "FolderSize")
        return;
      this._log.trace("NMNS_OnItemIntPropertyChanged: folder " + folder.URI + " " + property + " " + oldValue + " " + newValue);
      if (property == "BiffState") {
        this._biffStateChanged(folder, oldValue, newValue);
      }
      else if (property == "TotalUnreadMessages") {
        this._updateUnreadCount(folder, oldValue, newValue);
      }
      else if (property == "NewMailReceived") {
        this._newMailReceived(folder, oldValue, newValue);
      }
    } catch (error) {
      this._log.error("NMNS_OnItemIntPropertyChanged: exception " + error);
    }
  },

  _biffStateChanged: function NMNS_biffStateChanged(folder, oldValue, newValue) {
    if (newValue == Ci.nsIMsgFolder.nsMsgBiffState_NewMail) {
      if (folder.server && !folder.server.performingBiff) {
        this._log.debug("NMNS_biffStateChanged: folder " + folder.URI + " notified, but server not performing biff");
        return;
      }

      // Biff notifications come in for the top level of the server, we need to look for
      // the folder that actually contains the new mail

      let allFolders = folder.descendants;
      let numFolders = allFolders.length;

      this._log.trace("NMNS_biffStateChanged: folder " + folder.URI + " New mail, " + numFolders + " subfolders");
      let newCount = 0;

      if (this.confirmShouldCount(folder)) {
        let folderNew = folder.getNumNewMessages(false);
        this._log.debug("NMNS_biffStateChanged: folder " + folder.URI + " new messages: " + folderNew);
        if (folderNew > 0)
          newCount += folderNew;
      }

      for (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
        if (this.confirmShouldCount(folder)) {
          let folderNew = folder.getNumNewMessages(false);
          this._log.debug("NMNS_biffStateChanged: folder " + folder.URI + " new messages: " + folderNew);
          if (folderNew > 0)
            newCount += folderNew;
        }
      }
      if (newCount > 0) {
        this._mNewCount += newCount;
        this._log.debug("NMNS_biffStateChanged: " + folder.URI + " New mail count " + this._mNewCount);
        if (this.countNew)
          this._notifyListeners(NMNS.count, "onCountChanged", this._mNewCount);
      }
    }
    else if (newValue == Ci.nsIMsgFolder.nsMsgBiffState_NoMail) {
      // Dodgy - when any folder tells us it has no mail, clear all unread mail
      this._mNewCount = 0;
      this._log.debug("NMNS_biffStateChanged: " + folder.URI + " New mail count 0");
      if (this.countNew)
        this._notifyListeners(NMNS.count, "onCountChanged", this._mNewCount);
    }
  },

  _newMailReceived: function NMNS_newMailReceived(folder, oldValue, newValue) {
    if (!this.confirmShouldCount(folder))
      return;

    if (!oldValue || (oldValue < 0))
      oldValue = 0;
    let oldTotal = this._mNewCount;
    this._mNewCount += (newValue - oldValue);
    this._log.debug("NMNS_newMailReceived: " + folder.URI +
                    " Old folder " + oldValue + " New folder " + newValue +
                    " Old total " + oldTotal + " New total " + this._mNewCount);
    if (this.countNew)
      this._notifyListeners(NMNS.count, "onCountChanged", this._mNewCount);
  },

  _updateUnreadCount: function NMNS_updateUnreadCount(folder, oldValue, newValue) {
    if (!this.confirmShouldCount(folder))
      return;

    // treat "count unknown" as zero
    if (oldValue < 0)
      oldValue = 0;
    if (newValue < 0)
      newValue = 0;

    this._mUnreadCount += (newValue - oldValue);
    if (!this.countNew) {
      this._log.info("NMNS_updateUnreadCount notifying listeners: unread count " + this._mUnreadCount);
      this._notifyListeners(NMNS.count, "onCountChanged", this._mUnreadCount);
    }
  },

  OnItemAdded: function NMNS_OnItemAdded(parentItem, item) {
    if (item instanceof Ci.nsIMsgDBHdr) {
      if (this.confirmShouldCount(item.folder)) {
        this._log.trace("NMNS_OnItemAdded: item " + item.folder.getUriForMsg(item) + " added to " + item.folder.folderURL);
      }
    }
  },

  OnItemPropertyFlagChanged: function NMNS_OnItemPropertyFlagChanged(item,
                                                                    property,
                                                                    oldFlag,
                                                                    newFlag) {
    if (item instanceof Ci.nsIMsgDBHdr) {
      if ((oldFlag & Ci.nsMsgMessageFlags.New)
          && !(newFlag & Ci.nsMsgMessageFlags.New)) {
        this._log.trace("NMNS_OnItemPropertyFlagChanged: item " + item.folder.getUriForMsg(item) + " marked read");
      }
      else if (newFlag & Ci.nsMsgMessageFlags.New) {
        this._log.trace("NMNS_OnItemPropertyFlagChanged: item " + item.folder.getUriForMsg(item) + " marked unread");
      }
    }
  },

  OnItemRemoved: function NMNS_OnItemRemoved(parentItem, item) {
    if (item instanceof Ci.nsIMsgDBHdr && !item.isRead) {
      this._log.trace("NMNS_OnItemRemoved: unread item " + item.folder.getUriForMsg(item) + " removed from " + item.folder.folderURL);
    }
  },
  

  // Implement mozINewMailNotificationService

  get messageCount() {
    if (this.countNew)
      return this._mNewCount;
    return this._mUnreadCount;
  },

  addListener: function NMNS_addListener(aListener, flags) {
    this._log.trace("NMNS_addListener: listener " + aListener.toSource + " flags " + flags);
    for (let i = 0; i < this._listeners.length; i++) {
      let l = this._listeners[i];
      if (l.obj === aListener) {
        l.flags = flags;
        return;
      }
    }
    // If we get here, the listener wasn't already in the list
    this._listeners.push({obj: aListener, flags: flags});
  },

  removeListener: function NMNS_removeListener(aListener) {
    this._log.trace("NMNS_removeListener: listener " + aListener.toSource);
    for (let i = 0; i < this._listeners.length; i++) {
      let l = this._listeners[i];
      if (l.obj === aListener) {
        this._listeners.splice(i, 1);
        return;
      }
    }
  },

  _listenersForFlag: function NMNS_listenersForFlag(flag) {
    this._log.trace("NMNS_listenersForFlag " + flag + " length " + this._listeners.length + " " + this._listeners.toSource());
    let list = [];
    for (let i = 0; i < this._listeners.length; i++) {
      let l = this._listeners[i];
      if (l.flags & flag) {
        list.push(l.obj);
      }
    }
    return list;
  },

  _notifyListeners: function NMNS_notifyListeners(flag, func, value) {
    let list = this._listenersForFlag(flag);
    for (let i = 0; i < list.length; i++) {
      this._log.debug("NMNS_notifyListeners " + flag + " " + func + " " + value);
      list[i][func].call(list[i], value);
    }
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([NewMailNotificationService]);
