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
 * The Original Code is the Instantbird messenging client, released
 * 2011.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "categoryManager",
                                   "@mozilla.org/categorymanager;1",
                                   "nsICategoryManager");

const kQuitApplicationGranted = "quit-application-granted";
const kProtocolPluginCategory = "im-protocol-plugin";

const kPrefReportIdle =        "messenger.status.reportIdle";
const kPrefUserIconFilename =  "messenger.status.userIconFileName";
const kPrefUserDisplayname =   "messenger.status.userDisplayName";
const kPrefTimeBeforeIdle =    "messenger.status.timeBeforeIdle";
const kPrefAwayWhenIdle =      "messenger.status.awayWhenIdle";
const kPrefDefaultMessage =    "messenger.status.defaultIdleAwayMessage";

const NS_IOSERVICE_GOING_OFFLINE_TOPIC = "network:offline-about-to-go-offline";
const NS_IOSERVICE_OFFLINE_STATUS_TOPIC = "network:offline-status-changed";

function UserStatus()
{
  this._observers = [];

  if (Services.prefs.getBoolPref(kPrefReportIdle))
    this._addIdleObserver();
  Services.prefs.addObserver(kPrefReportIdle, this, false);

  if (Services.io.offline)
    this._offlineStatusType = Ci.imIStatusInfo.STATUS_OFFLINE;
  Services.obs.addObserver(this, NS_IOSERVICE_GOING_OFFLINE_TOPIC, false);
  Services.obs.addObserver(this, NS_IOSERVICE_OFFLINE_STATUS_TOPIC, false);
}
UserStatus.prototype = {
  __proto__: ClassInfo("imIUserStatusInfo", "User status info"),

  unInit: function() {
    this._observers = [];
    Services.prefs.removeObserver(kPrefReportIdle, this);
    if (this._observingIdleness)
      this._removeIdleObserver();
    Services.obs.removeObserver(this, NS_IOSERVICE_GOING_OFFLINE_TOPIC);
    Services.obs.removeObserver(this, NS_IOSERVICE_OFFLINE_STATUS_TOPIC);
  },
  _observingIdleness: false,
  _addIdleObserver: function() {
    this._observingIdleness = true;
    this._idleService =
      Cc["@mozilla.org/widget/idleservice;1"].getService(Ci.nsIIdleService);
    Services.obs.addObserver(this, "im-sent", false);

    this._timeBeforeIdle = Services.prefs.getIntPref(kPrefTimeBeforeIdle);
    if (this._timeBeforeIdle < 0)
      this._timeBeforeIdle = 0;
    Services.prefs.addObserver(kPrefTimeBeforeIdle, this, false);
    if (this._timeBeforeIdle)
      this._idleService.addIdleObserver(this, this._timeBeforeIdle);
  },
  _removeIdleObserver: function() {
    if (this._timeBeforeIdle)
      this._idleService.removeIdleObserver(this, this._timeBeforeIdle);

    Services.prefs.removeObserver(kPrefTimeBeforeIdle, this);
    delete this._timeBeforeIdle;

    Services.obs.removeObserver(this, "im-sent");
    delete this._idleService;
    delete this._observingIdleness;
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "nsPref:changed") {
      if (aData == kPrefReportIdle) {
        let reportIdle = Services.prefs.getBoolPref(kPrefReportIdle);
        if (reportIdle && !this._observingIdleness)
          this._addIdleObserver();
        else if (!reportIdle && this._observingIdleness)
        this._removeIdleObserver();
      }
      else if (aData == kPrefTimeBeforeIdle) {
        let timeBeforeIdle = Services.prefs.getIntPref(kPrefTimeBeforeIdle);
        if (timeBeforeIdle != this._timeBeforeIdle) {
          if (this._timeBeforeIdle)
            this._idleService.removeIdleObserver(this, this._timeBeforeIdle);
          this._timeBeforeIdle = timeBeforeIdle;
          if (this._timeBeforeIdle)
            this._idleService.addIdleObserver(this, this._timeBeforeIdle);
        }
      }
      else
        throw Cr.NS_ERROR_UNEXPECTED;
    }
    else if (aTopic == NS_IOSERVICE_GOING_OFFLINE_TOPIC)
      this.offline = true;
    else if (aTopic == NS_IOSERVICE_OFFLINE_STATUS_TOPIC && aData == "online")
      this.offline = false;
    else
      this._checkIdle();
  },

  _offlineStatusType: Ci.imIStatusInfo.STATUS_AVAILABLE,
  set offline(aOffline) {
    let statusType = this.statusType;
    let statusText = this.statusText;
    if (aOffline)
      this._offlineStatusType = Ci.imIStatusInfo.STATUS_OFFLINE;
    else
      delete this._offlineStatusType;
    if (this.statusType != statusType || this.statusText != statusText)
      this._notifyObservers("status-changed", this.statusText);
  },

  _idleTime: 0,
  get idleTime() this._idleTime,
  set idleTime(aIdleTime) {
    this._idleTime = aIdleTime;
    this._notifyObservers("idle-time-changed", aIdleTime);
  },
  _idle: false,
  _idleStatusText: "",
  _idleStatusType: Ci.imIStatusInfo.STATUS_AVAILABLE,
  _checkIdle: function() {
    let idleTime = Math.floor(this._idleService.idleTime / 1000);
    let idle = this._timeBeforeIdle && idleTime >= this._timeBeforeIdle;
    if (idle == this._idle)
      return;

    let statusType = this.statusType;
    let statusText = this.statusText;
    this._idle = idle;
    if (idle) {
      this.idleTime = idleTime;
      if (Services.prefs.getBoolPref(kPrefAwayWhenIdle)) {
        this._idleStatusType = Ci.imIStatusInfo.STATUS_AWAY;
        this._idleStatusText =
          Services.prefs.getComplexValue(kPrefDefaultMessage,
                                         Ci.nsIPrefLocalizedString).data;
      }
    }
    else {
      this.idleTime = 0;
      delete this._idleStatusType;
      delete this._idleStatusText;
    }
    if (this.statusType != statusType || this.statusText != statusText)
      this._notifyObservers("status-changed", this.statusText);
  },

  _statusText: "",
  get statusText() this._statusText || this._idleStatusText,
  _statusType: Ci.imIStatusInfo.STATUS_AVAILABLE,
  get statusType() Math.min(this._statusType, this._idleStatusType, this._offlineStatusType),
  setStatus: function(aStatus, aMessage) {
    if (aStatus != Ci.imIStatusInfo.STATUS_UNKNOWN)
      this._statusType = aStatus;
    if (aStatus != Ci.imIStatusInfo.STATUS_OFFLINE)
      this._statusText = aMessage;
    this._notifyObservers("status-changed", aMessage);
  },

  _getProfileDir: function()
    Services.dirsvc.get("ProfD", Ci.nsIFile),
  setUserIcon: function(aIconFile) {
    let folder = this._getProfileDir();

    let newName = "";
    if (aIconFile) {
      // Get the extension (remove trailing dots - invalid Windows extension).
      let ext = aIconFile.leafName.replace(/.*(\.[a-z0-9]+)\.*/i, "$1");
      // newName = userIcon-<timestamp(now)>.<aIconFile.extension>
      newName = "userIcon-" + Math.floor(Date.now() / 1000) + ext;

      // Copy the new icon file to newName in the profile folder.
      aIconFile.copyTo(folder, newName);
    }

    // Get the previous file name before saving the new file name.
    let oldFileName = Services.prefs.getCharPref(kPrefUserIconFilename);
    Services.prefs.setCharPref(kPrefUserIconFilename, newName);

    // Now that the new icon has been copied to the profile directory
    // and the pref value changed, we can remove the old icon. Ignore
    // failures so that we always fire the user-icon-changed notification.
    try {
      if (oldFileName) {
        folder.append(oldFileName);
        if (folder.exists())
          folder.remove(false);
      }
    } catch (e) {
      Cu.reportError(e);
    }

    this._notifyObservers("user-icon-changed", newName);
  },
  getUserIcon: function() {
    let filename = Services.prefs.getCharPref(kPrefUserIconFilename);
    if (!filename)
      return null; // No icon has been set.

    let file = this._getProfileDir();
    file.append(filename);

    if (!file.exists()) {
      Services.console.logStringMessage("Invalid userIconFileName preference");
      return null;
    }

    return Services.io.newFileURI(file);
  },

  get displayName() Services.prefs.getComplexValue(kPrefUserDisplayname,
                                                   Ci.nsISupportsString).data,
  set displayName(aDisplayName) {
    let str = Cc["@mozilla.org/supports-string;1"]
              .createInstance(Ci.nsISupportsString);
    str.data = aDisplayName;
    Services.prefs.setComplexValue(kPrefUserDisplayname, Ci.nsISupportsString,
                                   str);
    this._notifyObservers("user-display-name-changed", aDisplayName);
  },

  addObserver: function(aObserver) {
    if (this._observers.indexOf(aObserver) == -1)
      this._observers.push(aObserver);
  },
  removeObserver: function(aObserver) {
    this._observers = this._observers.filter(function(o) o !== aObserver);
  },
  _notifyObservers: function(aTopic, aData) {
    for each (let observer in this._observers)
      observer.observe(this, aTopic, aData);
  }
};

var gCoreService;
function CoreService() { gCoreService = this; }
CoreService.prototype = {
  globalUserStatus: null,

  _initialized: false,
  get initialized() this._initialized,
  init: function() {
    if (this._initialized)
      return;

    Services.obs.addObserver(this, kQuitApplicationGranted, false);
    this._initialized = true;

    Services.cmd.initCommands();
    this._protos = {};

    this.globalUserStatus = new UserStatus();
    this.globalUserStatus.addObserver({
      observe: function(aSubject, aTopic, aData) {
        Services.obs.notifyObservers(aSubject, aTopic, aData);
      }
    });

    let accounts = Services.accounts;
    accounts.initAccounts();
    Services.contacts.initContacts();
    Services.conversations.initConversations();
    Services.obs.notifyObservers(this, "prpl-init", null);

    if (accounts.autoLoginStatus == Ci.imIAccountsService.AUTOLOGIN_ENABLED)
      accounts.processAutoLogin();
  },
  observe: function(aObject, aTopic, aData) {
    if (aTopic == kQuitApplicationGranted)
      this.quit();
  },
  quit: function() {
    if (!this._initialized)
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    Services.obs.removeObserver(this, kQuitApplicationGranted);
    Services.obs.notifyObservers(this, "prpl-quit", null);

    Services.conversations.unInitConversations();
    Services.accounts.unInitAccounts();
    Services.contacts.unInitContacts();
    Services.cmd.unInitCommands();

    this.globalUserStatus.unInit();
    delete this.globalUserStatus;
    delete this._protos;
    delete this._initialized;
  },

  getProtocols: function() {
    if (!this._initialized)
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    let protocols = [];
    let entries = categoryManager.enumerateCategory(kProtocolPluginCategory);
    while (entries.hasMoreElements()) {
      let id = entries.getNext().QueryInterface(Ci.nsISupportsCString).data;
      let proto = this.getProtocolById(id);
      if (proto)
        protocols.push(proto);
    }
    return new nsSimpleEnumerator(protocols);
  },

  getProtocolById: function(aPrplId) {
    if (!this._initialized)
      throw Cr.NS_ERROR_NOT_INITIALIZED;

    if (this._protos.hasOwnProperty(aPrplId))
      return this._protos[aPrplId];

    let cid;
    try {
      cid = categoryManager.getCategoryEntry(kProtocolPluginCategory, aPrplId);
    } catch (e) {
      return null; // no protocol registered for this id.
    }

    let proto = null;
    try {
      proto = Cc[cid].createInstance(Ci.prplIProtocol);
    } catch (e) {
      // This is a real error, the protocol is registered and failed to init.
      let error = "failed to create an instance of " + cid + ": " + e;
      dump(error + "\n");
      Cu.reportError(error);
    }
    if (!proto)
      return null;

    try {
      proto.init(aPrplId);
    } catch (e) {
      Cu.reportError(e);
      return null;
    }

    this._protos[aPrplId] = proto;
    return proto;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.imICoreService]),
  classDescription: "Core",
  classID: Components.ID("{073f5953-853c-4a38-bd81-255510c31c2e}"),
  contractID: "@mozilla.org/chat/core-service;1"
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([CoreService]);
