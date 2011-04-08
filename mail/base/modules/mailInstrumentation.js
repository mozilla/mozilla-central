/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
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

/**
 * Thunderbird UI Instrumentation, currently just the account setup process.
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const EXPORTED_SYMBOLS = ["mailInstrumentationManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const nsIMFNService = Ci.nsIMsgFolderNotificationService;
var gMFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                     .getService(nsIMFNService);

Cu.import("resource:///modules/IOUtils.js");
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
    gMFNService.removeListener(this);
    this._mfnListener = false;
    mailInstrumentationManager.addEvent("msgDownloaded", true);
  },

  _accountsChanged: function() {
    // check if there are at least two accounts - one is local folders account
    if (Services.prefs.getCharPref("mail.accountmanager.accounts").indexOf(',') > 0) {
      mailInstrumentationManager.addEvent("accountAdded", true);
      this._removeObserver("mail.accountmanager.accounts",
                           this._accountsChanged);

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
    // This will throw an exception if no account is set up, so we
    // wrap the whole thing.
    try {
      if (!this._currentState.userEmailHash.length) {
        let email = MailServices.accounts.defaultAccount.defaultIdentity.email;
        this._currentState.userEmailHash = this._hashEmailAddress(email);
      }
      let data = JSON.stringify(this._currentState);
      dump("data to post = " + data + "\n");
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
    if (MailServices.accounts.accounts.Count() > 0)
      return;

    this._loadState();
    Services.obs.addObserver(this, "mail:composeSendSucceeded", false);
    Services.obs.addObserver(this, "mail:setAsDefault", false);
    Services.prefs.addObserver("mail.accountmanager.accounts",
                               this._accountsChanged, false);
    Services.prefs.addObserver("mail.instrumentation.userOptedIn",
                               this._userOptedIn, false);
    Services.prefs.addObserver("mail.smtpservers", this._smtpServerAdded, false);
    gMFNService.addListener(this, nsIMFNService.msgAdded);
    this._observersRegistered = true;
    this._mfnListener = true;
  },
  uninit: function() {
    if (!this._observersRegistered)
      return;
    let os = Cc["@mozilla.org/observer-service;1"]
              .getService(Ci.nsIObserverService);
    Services.obs.removeObserver(this, "mail:composeSendSucceeded");
    Services.obs.removeObserver(this, "mail:setAsDefault");
    if (this._mfnListener)
      gMFNService.removeListener(this);
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

