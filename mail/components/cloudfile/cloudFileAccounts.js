/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["cloudFileAccounts"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

const CATEGORY = "cloud-files";
const PREF_ROOT = "mail.cloud_files.";
const ACCOUNT_ROOT = PREF_ROOT + "accounts.";

// The following constants are used to query and insert entries
// into the nsILoginManager.
const PWDMGR_HOST = "chrome://messenger/cloudfile";
const PWDMGR_REALM = "BigFiles Auth Token";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/iteratorUtils.jsm");

var cloudFileAccounts = {
  get kTokenRealm() {
    return PWDMGR_REALM;
  },

  get _accountKeys() {
    let accountKeySet = {};
    let branch = Services.prefs.getBranch(ACCOUNT_ROOT);
    let children = branch.getChildList("", {});
    for (let [,child] in Iterator(children)) {
      let dot = child.indexOf(".");
      let subbranch = dot == -1 ? child : child.slice(0, dot);
      accountKeySet[subbranch] = 1;
    }

    // TODO: sort by ordinal
    return Object.keys(accountKeySet);
  },

  _getInitedProviderForType: function(aAccountKey, aType) {
    let provider = this.getProviderForType(aType);
    if (provider) {
      try {
        provider.init(aAccountKey);
      } catch (e) {
        Components.utils.reportError(e);
        provider = null;
      }
    }
    return provider;
  },

  _createUniqueAccountKey: function() {
    // Pick a unique account key (TODO: this is a dumb way to do it, probably)
    let existingKeys = this._accountKeys;
    for (let n = 1; ; n++) {
  
      if (existingKeys.indexOf("account" + n) == -1)
        return "account" + n;
    }
  },

  /**
   * Ensure that we have the account key for an account. If we already have the
   * key, just return it. If we have the nsIMsgCloudFileProvider, get the key
   * from it.
   *
   * @param aKeyOrAccount the key or the account object
   * @return the account key
   */
  _ensureKey: function(aKeyOrAccount) {
    if (typeof aKeyOrAccount == "string")
      return aKeyOrAccount;
    else if ("accountKey" in aKeyOrAccount)
      return aKeyOrAccount.accountKey;
    else
      throw new Error("string or nsIMsgCloudFileProvider expected");
  },

  getProviderForType: function(aType) {
    try {
      let className = categoryManager.getCategoryEntry(CATEGORY, aType);
      let provider = Cc[className].createInstance(Ci.nsIMsgCloudFileProvider);

      return provider;
    } catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) {
      // If a provider is not available we swallow the error message.
    } catch (e) {
      // Otherwise at least notify, so developers can fix things.
      Cu.reportError(e);
    }

    return null;
  },

  // aExtraPrefs are prefs specific to an account provider.
  createAccount: function(aType, aRequestObserver, aExtraPrefs) {
    let key = this._createUniqueAccountKey();

    try {
      Services.prefs
              .setCharPref(ACCOUNT_ROOT + key + ".type", aType);

      if (aExtraPrefs !== undefined)
        this._processExtraPrefs(key, aExtraPrefs);

      let provider = this._getInitedProviderForType(key, aType);
      if (provider)
        provider.createExistingAccount(aRequestObserver);

      return provider;
    }
    catch(e) {
      Services.prefs.deleteBranch(ACCOUNT_ROOT + key);
      throw e;
    }
  },

  // Set provider-specific prefs
  _processExtraPrefs: function CFA__processExtraPrefs(aAccountKey,
                                                      aExtraPrefs) {
    const kFuncMap = {
      "int": "setIntPref",
      "bool": "setBoolPref",
      "char": "setCharPref",
    };

    for (let prefKey in aExtraPrefs) {
      let type = aExtraPrefs[prefKey].type;
      let value = aExtraPrefs[prefKey].value;

      if (!(type in kFuncMap)) {
        Components.utils.reportError("Did not recognize type: " + type);
        continue;
      }

      let func = kFuncMap[type];
      Services.prefs[func](ACCOUNT_ROOT + aAccountKey + "." + prefKey,
                           value);
    }
  },

  enumerateProviders: function() {
    let providerList = [];
    for (let entry in fixIterator(categoryManager.enumerateCategory(CATEGORY),
                                  Ci.nsISupportsCString)) {
      let provider = this.getProviderForType(entry.data);
      yield [entry.data, provider];
    }
  },

  getAccount: function(aKey) {
    let type = Services.prefs.QueryInterface(Ci.nsIPrefBranch)
                       .getCharPref(ACCOUNT_ROOT + aKey + ".type");
    return this._getInitedProviderForType(aKey, type);
  },

  removeAccount: function(aKeyOrAccount) {
    let key = this._ensureKey(aKeyOrAccount);

    let type = Services.prefs.QueryInterface(Ci.nsIPrefBranch)
                       .deleteBranch(ACCOUNT_ROOT + key);

    // Destroy any secret tokens for this accountKey.
    let logins = Services.logins
                         .findLogins({}, PWDMGR_HOST, null, "");
    for each (let login in logins) {
      if (login.username == key)
        Services.logins.removeLogin(login);
    }
  },

  get accounts() {
    return [this.getAccount(key)
            for each (key in this._accountKeys)
            if (this.getAccount(key) != null)];
  },

  getAccountsForType: function CFA_getAccountsForType(aType) {
    let result = [];

    for (let [, accountKey] in Iterator(this._accountKeys)) {
      let type = Services.prefs.getCharPref(ACCOUNT_ROOT + accountKey
                                            + ".type");
      if (type === aType)
        result.push(this.getAccount(accountKey));
    }

    return result;
  },

  addAccountDialog: function CFA_addAccountDialog() {
    let params = {accountKey: null};
    Services.wm
            .getMostRecentWindow(null)
            .openDialog("chrome://messenger/content/cloudfile/"
                        + "addAccountDialog.xul",
                        "", "chrome, dialog, modal, resizable=yes",
                        params).focus();
    return params.accountKey;
  },

  getDisplayName: function(aKeyOrAccount) {
    try {
      let key = this._ensureKey(aKeyOrAccount);
      return Services.prefs.getCharPref(ACCOUNT_ROOT +
                                        key + ".displayName");
    } catch(e) {
      // If no display name has been set, we return the empty string.
      Components.utils.reportError(e);
      return "";
    }
  },

  setDisplayName: function(aKeyOrAccount, aDisplayName) {
    let key = this._ensureKey(aKeyOrAccount);
    Services.prefs.setCharPref(ACCOUNT_ROOT + key +
                               ".displayName", aDisplayName);
  },

  /**
   * Retrieve a secret value, like an authorization token, for an account.
   *
   * @param aKeyOrAccount an nsIMsgCloudFileProvider, or an accountKey
   *                      for a provider.
   * @param aRealm a human-readable string describing what exactly
   *               was being stored. Should match the realm used when setting
   *               the value.
   */
  getSecretValue: function(aKeyOrAccount, aRealm) {
    let key = this._ensureKey(aKeyOrAccount);

    let loginInfo = this._getLoginInfoForKey(key, aRealm);

    if (loginInfo)
      return loginInfo.password;

    return null;
  },

  /**
   * Store a secret value, like an authorization token, for an account
   * in nsILoginManager.
   *
   * @param aKeyOrAccount an nsIMsgCloudFileProvider, or an accountKey
   *                      for a provider.
   * @param aRealm a human-readable string describing what exactly
   *               is being stored here. To reduce magic strings, you can use
   *               cloudFileAccounts.kTokenRealm for simple auth tokens, and
   *               anything else for custom secret values.
   * @param aToken The token to be saved.  If this is set to null or the
   *               empty string, then the entry for this key will be removed.
   */
  setSecretValue: function(aKeyOrAccount, aRealm, aToken) {
    let key = this._ensureKey(aKeyOrAccount);
    let loginInfo = this._getLoginInfoForKey(key, aRealm);

    if (!aToken) {
      if (!loginInfo)
        return;

      Services.logins.removeLogin(loginInfo);
      return;
    }

    let newLoginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
                       .createInstance(Ci.nsILoginInfo);
    newLoginInfo.init(PWDMGR_HOST, null, aRealm, key,
                      aToken, "", "");

    if (loginInfo)
      Services.logins.modifyLogin(loginInfo, newLoginInfo);
    else
      Services.logins.addLogin(newLoginInfo);
  },

  /**
   * Searches the nsILoginManager for an nsILoginInfo for BigFiles with
   * the username set to aKey, and the realm set to aRealm.
   *
   * @param aKey a key for an nsIMsgCloudFileProvider that we're searching
   *             for login info for.
   * @param aRealm the realm that the login info was stored under.
   */
  _getLoginInfoForKey: function(aKey, aRealm) {
    let logins = Services.logins
                         .findLogins({}, PWDMGR_HOST, null, aRealm);
    for each (let login in logins) {
      if (login.username == aKey)
        return login;
    }
    return null;
  },
};

XPCOMUtils.defineLazyServiceGetter(this, "categoryManager",
                                   "@mozilla.org/categorymanager;1",
                                   "nsICategoryManager");
