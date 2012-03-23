/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/imServices.jsm");

function imIncomingServer() { }

imIncomingServer.prototype = {
  get wrappedJSObject() this,
  _imAccount: null,
  get imAccount() {
    if (this._imAccount)
      return this._imAccount;

    let id = this.getCharValue("imAccount");
    if (!id)
      return null;
    Services.core.init();
    return (this._imAccount = Services.accounts.getAccountById(id));
  },
  set imAccount(aImAccount) {
    this._imAccount = aImAccount;
    this.setCharValue("imAccount", aImAccount.id);
  },
  _prefBranch: null,
  valid: true,
  _key: "",
  get key() this._key,
  set key(aKey) {
    this._key = aKey;
    this._prefBranch = Services.prefs.getBranch("mail.server." + aKey + ".");
  },
  equals: function(aServer)
    "wrappedJSObject" in aServer && aServer.wrappedJSObject == this,

  clearAllValues: function() {
    Services.accounts.deleteAccount(this.imAccount.id);
    this._prefBranch.deleteBranch("");
    delete this._prefBranch;
    delete this._imAccount;
  },
  // called by nsMsgAccountManager while deleting an account:
  forgetSessionPassword: function() { },

  // Shown in the "Remove Account" confirm prompt.
  get prettyName() this.imAccount.protocol.name + " - " + this.imAccount.name,

  //XXX Flo: I don't think these 2 names are visible in the UI:
  get constructedPrettyName() "constructedPrettyName FIXME",
  realHostName: "realHostName FIXME",

  port: 0,
  accountManagerChrome: "am-im.xul",


  //FIXME need a new imIIncomingService iface + classinfo for these 3 properties :(
  get password() this.imAccount.password,
  set password(aPassword) {
    this.imAccount.password = aPassword;
  },
  get alias() this.imAccount.alias,
  set alias(aAlias) {
    this.imAccount.alias = aAlias;
  },
  get autojoin() {
    try {
      let prefName = "messenger.account." + this.imAccount.id + ".autoJoin";
      return Services.prefs.getCharPref(prefName);
    } catch (e) {
      return "";
    }
  },
  set autojoin(aAutojoin) {
    let prefName = "messenger.account." + this.imAccount.id + ".autoJoin";
    Services.prefs.setCharPref(prefName, aAutojoin);
  },

  // This is used for user-visible advanced preferences.
  setUnicharValue: function(aPrefName, aValue) {
    if (aPrefName == "autojoin")
      this.autojoin = aValue;
    else if (aPrefName == "alias")
      this.alias = aValue;
    else if (aPrefName == "password")
      this.password = aValue;
    else
      this.imAccount.setString(aPrefName, aValue);
  },
  getUnicharValue: function(aPrefName) {
    if (aPrefName == "autojoin")
      return this.autojoin;
    if (aPrefName == "alias")
      return this.alias;
    if (aPrefName == "password")
      return this.password;

    try {
      let prefName =
        "messenger.account." + this.imAccount.id + ".options." + aPrefName;
      return Services.prefs.getCharPref(prefName);
    } catch (x) {
      return this._getDefault(aPrefName);
    }
  },
  setBoolValue: function(aPrefName, aValue) {
    this.imAccount.setBool(aPrefName, aValue);
  },
  getBoolValue: function(aPrefName) {
    try {
      let prefName =
        "messenger.account." + this.imAccount.id + ".options." + aPrefName;
      return Services.prefs.getBoolPref(prefName);
    } catch (x) {
      return this._getDefault(aPrefName);
    }
  },
  setIntValue: function(aPrefName, aValue) {
    this.imAccount.setInt(aPrefName, aValue);
  },
  getIntValue: function(aPrefName) {
    try {
      let prefName =
        "messenger.account." + this.imAccount.id + ".options." + aPrefName;
      return Services.prefs.getIntPref(prefName);
    } catch (x) {
      return this._getDefault(aPrefName);
    }
  },
  _defaultOptionValues: null,
  _getDefault: function(aPrefName) {
    if (this._defaultOptionValues)
      return this._defaultOptionValues[aPrefName];

    this._defaultOptionValues = {};
    let options = this.imAccount.protocol.getOptions();
    while (options.hasMoreElements()) {
      let opt = options.getNext();
      let type = opt.type;
      if (type == opt.typeBool)
        this._defaultOptionValues[opt.name] = opt.getBool();
      else if (type == opt.typeInt)
        this._defaultOptionValues[opt.name] = opt.getInt();
      else if (type == opt.typeString)
        this._defaultOptionValues[opt.name] = opt.getString();
      else if (type == opt.typeList)
        this._defaultOptionValues[opt.name] = opt.getListDefault();
    }
    return this._defaultOptionValues[aPrefName];
  },

  // the "Char" type will be used only for "imAccount" and internally.
  setCharValue: function(aPrefName, aValue) {
    this._prefBranch.setCharPref(aPrefName, aValue);
  },
  getCharValue: function(aPrefName) {
    try {
      return this._prefBranch.getCharPref(aPrefName);
    } catch (x) {
      return "";
    }
  },

  get type() this._prefBranch.getCharPref("type"),
  set type(aType) {
    this._prefBranch.setCharPref("type", aType);
  },

  get username() this._prefBranch.getCharPref("userName"),
  set username(aUsername) {
    if (!aUsername) {
      // nsMsgAccountManager::GetIncomingServer expects the pref to
      // be named userName but some early test versions with IM had
      // the pref named username.
      return;
    }
    this._prefBranch.setCharPref("userName", aUsername);
  },

  get hostName() this._prefBranch.getCharPref("hostname"),
  set hostName(aHostName) {
    this._prefBranch.setCharPref("hostname", aHostName);
  },

  writeToFolderCache: function() { },
  closeCachedConnections: function() { },
  shutdown: function() { },
  setFilterList: function() { },

  get canBeDefaultServer() false,

  // AccountManager.js verifies that spamSettings is non-null before
  // using the initialize method, but we can't just use a null value
  // because that would crash nsMsgPurgeService::PerformPurge which
  // only verifies the nsresult return value of the spamSettings
  // getter before accessing the level property.
  get spamSettings() {
    return {
      level: 0,
      initialize: function(aServer) {}
    };
  },

  // nsMsgDBFolder.cpp crashes in HandleAutoCompactEvent if this doesn't exist:
  msgStore: {
    supportsCompaction: false
  },

  get serverURI() "im://" + this.imAccount.protocol.id + "/" + this.imAccount.normalizedName,
  _rootFolder: null,
  get rootFolder() {
    if (this._rootFolder)
      return this._rootFolder;

    return (this._rootFolder = {
      isServer: true,
      server: this,
      get prettyName() this.server.prettyName, // used in the account manager tree
      get prettiestName() this.server.prettyName + " prettiestName", // never displayed?
      get name() this.server.prettyName + " name", // never displayed?
      // used in the folder pane tree, if we don't hide the IM accounts:
      get abbreviatedName() this.server.prettyName + "abbreviatedName",
      AddFolderListener: function() {},
      RemoveFolderListener: function() {},
      ListDescendents: function(descendents) {},
      getFolderWithFlags: function(aFlags) null,
      getFoldersWithFlags: function(aFlags)
        Components.classes["@mozilla.org/array;1"]
                  .createInstance(Components.interfaces.nsIMutableArray),
      get subFolders() EmptyEnumerator,
      getStringProperty: function(aPropertyName) "",
      getNumUnread: function(aDeep) 0,
      Shutdown: function() {}
    });
  },

  classDescription: "IM Msg Incoming Server implementation",
  classID: Components.ID("{9dd7f36b-5960-4f0a-8789-f5f516bd083d}"),
  contractID: "@mozilla.org/messenger/server;1?type=im",
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgIncomingServer])
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([imIncomingServer]);
