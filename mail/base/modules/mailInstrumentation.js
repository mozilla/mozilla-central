/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Thunderbird UI Instrumentation, currently just the account setup process.
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const EXPORTED_SYMBOLS = ["mailInstrumentationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const nsIMFNService = Ci.nsIMsgFolderNotificationService;

Cu.import("resource:///modules/IOUtils.js");
Cu.import("resource:///modules/errUtils.js");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");

/* :::::::: The Module ::::::::::::::: */

var mailInstrumentationManager =
{
  // JS object containing the current state object
  _currentState: null,

  /**
   * The string containing the JSON stringified representation of the last
   * state we uploaded.
   */
  _lastStateString: null,

  // if true, need to remove ourselves as a folder notification listener
  _mfnListener: false,

  // if true, we need to remove our observers in uninit.
  _observersRegistered: false,

  observe: function (aSubject, aTopic, aState) {
    if (aTopic == "mail:composeSendSucceeded")
      mailInstrumentationManager.addEvent("msgSent", true);
    else if (aTopic == "mail:setAsDefault")
      mailInstrumentationManager.addEvent("setAsDefault", true);

  },
  msgAdded: function (aMsg) {
    MailServices.mfn.removeListener(this);
    this._mfnListener = false;
    mailInstrumentationManager.addEvent("msgDownloaded", true);
  },

  _accountsChanged: function() {
    // check if there are at least two accounts - one is local folders account
    if (Services.prefs.getCharPref("mail.accountmanager.accounts").contains(',', 1)) {
      mailInstrumentationManager.addEvent("accountAdded", true);
      mailInstrumentationManager._removeObserver(
        "mail.accountmanager.accounts",
        mailInstrumentationManager._accountsChanged);

    }
  },
  _smtpServerAdded: function() {
    mailInstrumentationManager.addEvent("smtpServerAdded", true);
    this._removeObserver("mail.smtpservers", _smtpServerAdded);
  },
  _userOptedIn: function() {
    try {
      if (Services.prefs.getBoolPref("mail.instrumentation.userOptedIn"))
        mailInstrumentationManager._postStateObject();
    } catch (ex) {logException(ex);}
  },

  /**
   * Loads the last saved state. This should only be called by
   * _init and a unit test.
   */
  _loadState: function minst_loadState() {
    let data = Services.prefs.getCharPref("mail.instrumentation.lastNotificationSent");
    if (data) {
      try {
        // parse the session state into JS objects
        this._currentState = JSON.parse(data);
        return;
      } catch (ex) {}
    }
    this._currentState = this._createStateObject();
  },

  /**
   * Writes the state object to disk.
   */
  _postStateObject: function minst_postStateObject() {
    // Getting defaultAccount will throw an exception if no account is set up,
    // so we wrap the whole thing.
    try {
      if (!this._currentState.userEmailHash) {
        let identity = MailServices.accounts.defaultAccount.defaultIdentity;
        if (identity) // When we have only a feed account, there is no identity.
          this._currentState.userEmailHash = this._hashEmailAddress(identity.email);
      }
      let data = JSON.stringify(this._currentState);
      // post data only if state changed since last write.
      if (data == this._lastStateString)
        return;

      this._lastStateString = data;
      let userOptedIn = Services.prefs.getBoolPref("mail.instrumentation.userOptedIn");
      if (userOptedIn)
        this._postData();
    } catch (ex) {logException(ex);}
  },

  /**
   * @return an empty state object that can be populated with window states.
   */
  _createStateObject: function minst_createStateObject() {
    return {
      rev: 0,
      userEmailHash: "",
      // these will be a tuple, time stamp and answer, indexed by question key.
      events: new Object,
    };
  },
  // Convert each hashed byte into 2-hex strings, then combine them.
  _bytesAsHex: function minst_bytesAsHex(bytes) {
    return [("0" + byte.charCodeAt().toString(16)).slice(-2)
            for each (byte in bytes)].join("");
  },
  /**
   * Return sha-256 hash of the passed in e-mail address
   */
  _hashEmailAddress: function minst_hashEmailAddress(address) {
    let ch = Cc["@mozilla.org/security/hash;1"]
               .createInstance(Ci.nsICryptoHash);
    ch.init(ch.SHA256);
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                       .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    let byteArray = converter.convertToByteArray(address, {});
    ch.update(byteArray, byteArray.length);
    let hashedData = ch.finish(false);
    return this._bytesAsHex(hashedData);
  },

  _postData: function minst_postData() {
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let url = Services.prefs.getCharPref("mail.instrumentation.postUrl");
    if (!url.length)
      return;
    let dataToPost = this._lastStateString;
    req.open("POST", url, true);
    req.onerror = this._onError;
    req.onload = this._onLoad;
    req.send(dataToPost);
  },
  _onError: function minst_onError(e) {
    logException(e);
  },
  _onLoad: function minst_onLoad() {
    Services.prefs.setCharPref("mail.instrumentation.lastNotificationSent",
                               this._lastStateString);
  },
  // keeps track of whether or not we've removed the observer for a given
  // pref name.
  _prefsObserved : {},
  _addObserver : function(pref, observer) {
    Services.prefs.addObserver(pref, observer, false);
    this._prefsObserved[pref] = true;
  },
  _removeObserver : function(pref, observer) {
    if (this._prefsObserved[pref]) {
      Services.prefs.removeObserver(pref, observer);
      this._prefsObserved[pref] = false;
    }
  },
/* ........ Public API ................*/
  /**
   * This is called to initialize the instrumentation.
   */
  init: function minst_init() {
    // If we're done with instrumentation, or this is not a first run,
    // we should just return immediately.
    if (!Services.prefs.getBoolPref("mail.instrumentation.askUser"))
      return;
    if (MailServices.accounts.accounts.length > 0)
      return;

    this._loadState();
    Services.obs.addObserver(this, "mail:composeSendSucceeded", false);
    Services.obs.addObserver(this, "mail:setAsDefault", false);
    Services.prefs.addObserver("mail.accountmanager.accounts",
                               this._accountsChanged, false);
    Services.prefs.addObserver("mail.instrumentation.userOptedIn",
                               this._userOptedIn, false);
    Services.prefs.addObserver("mail.smtpservers", this._smtpServerAdded, false);
    MailServices.mfn.addListener(this, nsIMFNService.msgAdded);
    this._observersRegistered = true;
    this._mfnListener = true;
  },
  uninit: function() {
    if (!this._observersRegistered)
      return;
    Services.obs.removeObserver(this, "mail:composeSendSucceeded");
    Services.obs.removeObserver(this, "mail:setAsDefault");
    if (this._mfnListener)
      MailServices.mfn.removeListener(this);
    Services.prefs.removeObserver("mail.accountmanager.accounts", this);
    Services.prefs.removeObserver("mail.instrumentation.userOptedIn", this);
    Services.prefs.removeObserver("mail.smtpservers", this);
  },
  /**
   * This adds an event to the current state, if it doesn't exist.
   */
  addEvent: function minst_addEvent(aEventKey, aData) {
    try {
      if (!(aEventKey in this._currentState.events)) {
        let newEvent = new Object;
        newEvent.time = Date.now();
        newEvent.data = aData;
        this._currentState.events[aEventKey] = newEvent;
        this._postStateObject();
      }
    } catch(ex) {logException(ex);}
  },
};

