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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Wei Xian Woo <wei0@gmx.com>
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
 * Session Storage and Restoration
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const EXPORTED_SYMBOLS = ["sessionStoreManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://app/modules/IOUtils.js");

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

  _init: function ssm_init()
  {
    this._loadSessionFile();

    // we listen for "quit-application-granted" instead of
    // "quit-application-requested" because other observers of the
    // latter can cancel the shutdown.
    var observerSvc = Cc["@mozilla.org/observer-service;1"]
                      .getService(Ci.nsIObserverService);
    observerSvc.addObserver(this, "quit-application-granted", false);

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
    let foStream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Ci.nsIFileOutputStream);
    foStream.init(this.sessionFile, -1, -1, 0);
    foStream.write(data, data.length);
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

    let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Ci.nsIWindowMediator);

    // XXX we'd like to support other window types in future, but for now
    // only get the 3pane windows.
    let enumerator = windowMediator.getEnumerator("mail:3pane");
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
    let firstWindow = !this._initialized;
    if (firstWindow)
      this._init();
    
    // If we are seeing a new 3-pane, we are obviously not in a shutdown
    // state anymore.  (This would happen if all the 3panes got closed but
    // we did not quit because another window was open and then a 3pane showed
    // up again.  This can happen in both unit tests and real life.)
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
      let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Ci.nsIWindowMediator);
      let enumerator = windowMediator.getEnumerator("mail:3pane");
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
    let sessionFile = Cc["@mozilla.org/file/directory_service;1"]
                      .getService(Ci.nsIProperties)
                      .get("ProfD", Ci.nsIFile);
    sessionFile.append("session.json");
    return sessionFile;
  }
};
