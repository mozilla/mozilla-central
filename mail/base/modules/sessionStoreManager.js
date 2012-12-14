/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Session Storage and Restoration
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const EXPORTED_SYMBOLS = ["sessionStoreManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/IOUtils.js");
Cu.import("resource://gre/modules/Services.jsm");

/**
 * asuth arbitrarily chose this value to trade-off powersaving,
 * processor usage, and recency of state in the face of the impossibility of
 * our crashing; he also worded this.
 */
const SESSION_AUTO_SAVE_DEFAULT_MS = 300000; // 5 minutes

/* :::::::: The Module ::::::::::::::: */

var sessionStoreManager =
{
  _initialized: false,

  _sessionAutoSaveTimer: null,

  _sessionAutoSaveTimerIntervalMS: SESSION_AUTO_SAVE_DEFAULT_MS,

  /**
   * The persisted state of the previous session. This is resurrected
   * from disk when the module is initialized and cleared when all
   * required windows have been restored.
   */
  _initialState: null,

  /**
   * The string containing the JSON stringified representation of the last
   * state we wrote to disk.
   */
  _currentStateString: null,

  /**
   * A flag indicating whether the state "just before shutdown" of the current
   * session has been persisted to disk. See |observe| and |unloadingWindow|
   * for justification on why we need this.
   */
  _shutdownStateSaved: false,

  /**
   * This is called on startup, and when a new 3 pane window is opened after
   * the last 3 pane window was closed (e.g., on the mac, closing the last
   * window doesn't shut down the app).
   */
  _init: function ssm_init()
  {
    this._loadSessionFile();

    // we listen for "quit-application-granted" instead of
    // "quit-application-requested" because other observers of the
    // latter can cancel the shutdown.
    Services.obs.addObserver(this, "quit-application-granted", false);

    this.startPeriodicSave();

    this._initialized = true;
  },

  /**
   * Loads the session file into _initialState. This should only be called by
   * _init and a unit test.
   */
  _loadSessionFile: function ssm_loadSessionFile()
  {
    let sessionFile = this.sessionFile;
    if (sessionFile.exists()) {
      // get string containing session state
      let data = IOUtils.loadFileToString(sessionFile);

      // delete the file in case there is something crash-inducing about
      // the restoration process
      sessionFile.remove(false);
      // clear the current state so that subsequent writes won't think
      // the state hasn't changed.
      this._currentStateString = null;

      if (data) {
        try {
          // parse the session state into JS objects
          this._initialState = JSON.parse(data);
        } catch (ex) {}
      }
    }
  },

  /**
   * Opens the windows that were open in the previous session.
   */
  _openOtherRequiredWindows: function ssm_openOtherRequiredWindows(aWindow)
  {
    // XXX we might want to display a restore page and let the user decide
    // whether to restore the other windows, just like Firefox does.

    if (!this._initialState || !this._initialState.windows || !aWindow)
      return;

    for (var i = 0; i < this._initialState.windows.length; ++i)
      aWindow.open(
             "chrome://messenger/content/messenger.xul",
             "_blank",
             "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  },

  /**
   * Writes the state object to disk.
   */
  _saveStateObject: function ssm_saveStateObject(aStateObj)
  {
    let data = JSON.stringify(aStateObj);

    // write to disk only if state changed since last write
    if (data == this._currentStateString)
      return;

    // XXX ideally, we shouldn't be writing to disk on the UI thread,
    // but the session file should be small so it might not be too big a
    // problem.
    let foStream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
                   .createInstance(Ci.nsIFileOutputStream);
    foStream.init(this.sessionFile, -1, -1, 0);
    foStream.write(data, data.length);
    foStream.QueryInterface(Ci.nsISafeOutputStream).finish();
    foStream.close();

    this._currentStateString = data;
  },

  /**
   * @return an empty state object that can be populated with window states.
   */
  _createStateObject: function ssm_createStateObject()
  {
    return {
      rev: 0,
      windows: []
    };
  },

  /**
   * Writes the state of all currently open 3pane windows to disk.
   */
  _saveState: function ssm_saveState()
  {
    let state = this._createStateObject();

    // XXX we'd like to support other window types in future, but for now
    // only get the 3pane windows.
    let enumerator = Services.wm.getEnumerator("mail:3pane");
    while (enumerator.hasMoreElements()) {
      let win = enumerator.getNext();
      if (win && "complete" == win.document.readyState &&
          win.getWindowStateForSessionPersistence)
        state.windows.push(win.getWindowStateForSessionPersistence());
    }

    this._saveStateObject(state);
  },

/* ........ Timer Callback ................*/

  _sessionAutoSaveTimerCallback: function ssm_sessionAutoSaveTimerCallback()
  {
    sessionStoreManager._saveState();
  },

/* ........ Observer Notification Handler ................*/

  observe: function ssm_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
    // This is observed before any windows start unloading if something other
    // than the last 3pane window closing requested the application be
    // shutdown. For example, when the user quits via the file menu.
    case "quit-application-granted":
      if (!this._shutdownStateSaved) {
        this.stopPeriodicSave();
        this._saveState();

        // this is to ensure we don't clobber the saved state when the
        // 3pane windows unload.
        this._shutdownStateSaved = true;
      }
      break;
    }
  },

/* ........ Public API ................*/

  /**
   * Called by each 3pane window instance when it loads.
   *
   * @return a window state object if aWindow was opened as a result of a
   *         session restoration, null otherwise.
   */
  loadingWindow: function ssm_loadingWindow(aWindow)
  {
    let firstWindow = !this._initialized || this._shutdownStateSaved;
    if (firstWindow)
      this._init();

    // If we are seeing a new 3-pane, we are obviously not in a shutdown
    // state anymore.  (This would happen if all the 3panes got closed but
    // we did not quit because another window was open and then a 3pane showed
    // up again.  This can happen in both unit tests and real life.)
    // We treat this case like the first window case, and do a session restore.
    this._shutdownStateSaved = false;

    let windowState = null;
    if (this._initialState && this._initialState.windows) {
      windowState = this._initialState.windows.pop();
      if (0 == this._initialState.windows.length)
        this._initialState = null;
    }

    if (firstWindow)
      this._openOtherRequiredWindows(aWindow);

    return windowState;
  },

  /**
   * Called by each 3pane window instance when it unloads. If aWindow is the
   * last 3pane window, its state is persisted. The last 3pane window unloads
   * first before the "quit-application-granted" event is generated.
   */
  unloadingWindow: function ssm_unloadingWindow(aWindow)
  {
    if (!this._shutdownStateSaved) {
      // determine whether aWindow is the last open window
      let lastWindow = true;
      let enumerator = Services.wm.getEnumerator("mail:3pane");
      while (enumerator.hasMoreElements()) {
        if (enumerator.getNext() != aWindow)
          lastWindow = false;
      }

      if (lastWindow) {
        // last chance to save any state for the current session since
        // aWindow is the last 3pane window and the "quit-application-granted"
        // event is observed AFTER this.
        this.stopPeriodicSave();

        let state = this._createStateObject();
        state.windows.push(aWindow.getWindowStateForSessionPersistence());
        this._saveStateObject(state);

        // XXX this is to ensure we don't clobber the saved state when we
        // observe the "quit-application-granted" event.
        this._shutdownStateSaved = true;
      }
    }
  },

  /**
   * Stops periodic session persistence.
   */
  stopPeriodicSave: function ssm_stopPeriodicSave()
  {
    if (this._sessionAutoSaveTimer) {
      this._sessionAutoSaveTimer.cancel();

      delete this._sessionAutoSaveTimer;
      this._sessionAutoSaveTimer = null;
    }
  },

  /**
   * Starts periodic session persistence.
   */
  startPeriodicSave: function ssm_startPeriodicSave()
  {
    if (!this._sessionAutoSaveTimer) {
      this._sessionAutoSaveTimer = Cc["@mozilla.org/timer;1"]
                                   .createInstance(Ci.nsITimer);

      this._sessionAutoSaveTimer.initWithCallback(
                                   this._sessionAutoSaveTimerCallback,
                                   this._sessionAutoSaveTimerIntervalMS,
                                   Ci.nsITimer.TYPE_REPEATING_SLACK);
    }
  },

  /**
   * Gets the file used for session storage.
   */
  get sessionFile()
  {
    let sessionFile = Services.dirsvc.get("ProfD", Ci.nsIFile);
    sessionFile.append("session.json");
    return sessionFile;
  }
};
