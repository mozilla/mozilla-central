/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Session Storage and Restoration
 *
 * Overview
 * This service reads user's session file at startup, and makes a determination
 * as to whether the session should be restored. It will restore the session
 * under the circumstances described below.
 *
 * Crash Detection
 * The session file stores a session.state property, that
 * indicates whether the browser is currently running. When the browser shuts
 * down, the field is changed to "stopped". At startup, this field is read, and
 * if it's value is "running", then it's assumed that the browser had previously
 * crashed, or at the very least that something bad happened, and that we should
 * restore the session.
 *
 * Forced Restarts
 * In the event that a restart is required due to application update or extension
 * installation, set the browser.sessionstore.resume_session_once pref to true,
 * and the session will be restored the next time the browser starts.
 *
 * Always Resume
 * This service will always resume the session if the integer pref
 * browser.startup.page is set to 3.
*/

/* :::::::: Constants and Helpers ::::::::::::::: */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

const STATE_RUNNING_STR = "running";

function debug(aMsg) {
  Services.console.logStringMessage("SessionStartup: " + aMsg);
}

/* :::::::: The Service ::::::::::::::: */

function SessionStartup() {
}

SessionStartup.prototype = {

  // the state to restore at startup
  _initialState: null,
  _sessionType: Components.interfaces.nsISessionStartup.NO_SESSION,

/* ........ Global Event Handlers .............. */

  /**
   * Initialize the component
   */
  init: function sss_init() {
    // get file references
    let sessionFile = Services.dirsvc.get("ProfD",
                                          Components.interfaces.nsILocalFile);
    sessionFile.append("sessionstore.json");

    let doResumeSession = Services.prefs.getBoolPref("browser.sessionstore.resume_session_once") ||
                          Services.prefs.getIntPref("browser.startup.page") == 3;

    var resumeFromCrash = Services.prefs.getBoolPref("browser.sessionstore.resume_from_crash");

    // only continue if the session file exists
    if (!sessionFile.exists())
      return;

    // get string containing session state
    let iniString = this._readStateFile(sessionFile);
    if (!iniString)
      return;

    try {
      // parse the session state into JS objects
      this._initialState = JSON.parse(iniString);
    }
    catch (ex) {
      doResumeSession = false;
      debug("The session file is invalid: " + ex);
    }

    let lastSessionCrashed =
      this._initialState && this._initialState.session &&
      this._initialState.session.state &&
      this._initialState.session.state == STATE_RUNNING_STR;

    // set the startup type
    if (lastSessionCrashed && resumeFromCrash)
      this._sessionType = Components.interfaces.nsISessionStartup.RECOVER_SESSION;
    else if (!lastSessionCrashed && doResumeSession)
      this._sessionType = Components.interfaces.nsISessionStartup.RESUME_SESSION;
    else if (this._initialState)
      this._sessionType = Components.interfaces.nsISessionStartup.DEFER_SESSION;
    else
      this._initialState = null; // reset the state

    if (this.doRestore()) {
      // wait for the first browser window to open
      Services.obs.addObserver(this, "sessionstore-windows-restored", true);
    }
  },

  /**
   * Handle notifications
   */
  observe: function sss_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
    case "app-startup":
      Services.obs.addObserver(this, "final-ui-startup", true);
      Services.obs.addObserver(this, "quit-application", true);
      break;
    case "final-ui-startup":
      Services.obs.removeObserver(this, "final-ui-startup");
      Services.obs.removeObserver(this, "quit-application");
      this.init();
      break;
    case "quit-application":
      // no reason for initializing at this point (cf. bug 409115)
      Services.obs.removeObserver(this, "final-ui-startup");
      Services.obs.removeObserver(this, "quit-application");
      break;
    case "sessionstore-windows-restored":
      // no need in repeating this, since session type won't change
      Services.obs.removeObserver(this, "sessionstore-windows-restored");
      // free _initialState after nsSessionStore is done with it
      this._initialState = null;
      // reset session type after restore
      this._sessionType = Components.interfaces.nsISessionStartup.NO_SESSION;
      break;
    }
  },

/* ........ Public API ................*/

  /**
   * Get the session state as a string
   */
  get state() {
    return this._initialState;
  },

  /**
   * Determine whether there is a pending session restore.
   * @returns bool
   */
  doRestore: function sss_doRestore() {
    return this._sessionType == Components.interfaces.nsISessionStartup.RECOVER_SESSION ||
           this._sessionType == Components.interfaces.nsISessionStartup.RESUME_SESSION;
  },

  /**
   * Get the type of pending session store, if any.
   */
  get sessionType() {
    return this._sessionType;
  },

/* ........ Storage API .............. */

  /**
   * Reads a session state file into a string and lets
   * observers modify the state before it's being used
   *
   * @param aFile is any nsIFile
   * @returns a session state string
   */
  _readStateFile: function sss_readStateFile(aFile) {
    var stateString = Components.classes["@mozilla.org/supports-string;1"]
                                .createInstance(Components.interfaces.nsISupportsString);
    stateString.data = this._readFile(aFile) || "";

    Services.obs.notifyObservers(stateString, "sessionstore-state-read", "");

    return stateString.data;
  },

  /**
   * reads a file into a string
   * @param aFile
   *        nsIFile
   * @returns string
   */
  _readFile: function sss_readFile(aFile) {
    try {
      var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                             .createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(aFile, 0x01, 0, 0);
      var cvStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                               .createInstance(Components.interfaces.nsIConverterInputStream);
      cvStream.init(stream, "UTF-8", 1024, Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

      var content = "";
      var data = {};
      while (cvStream.readString(4096, data)) {
        content += data.value;
      }
      cvStream.close();

      return content.replace(/\r\n?/g, "\n");
    }
    catch (ex) { Components.utils.reportError(ex); }

    return null;
  },

  /* ........ QueryInterface .............. */
  QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                          Components.interfaces.nsISupportsWeakReference,
                                          Components.interfaces.nsISessionStartup]),
  classID: Components.ID("{4e6c1112-57b6-44ba-adf9-99fb573b0a30}")

};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([SessionStartup]);
