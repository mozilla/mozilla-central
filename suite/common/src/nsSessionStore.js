/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Session Storage and Restoration
 *
 * Overview
 * This service keeps track of a user's session, storing the various bits
 * required to return the browser to its current state. The relevant data is
 * stored in memory, and is periodically saved to disk in a file in the
 * profile directory. The service is started at first window load, in
 * delayedStartup, and will restore the session from the data received from
 * the nsSessionStartup service.
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const STATE_STOPPED = 0;
const STATE_RUNNING = 1;
const STATE_QUITTING = -1;

const STATE_STOPPED_STR = "stopped";
const STATE_RUNNING_STR = "running";

const TAB_STATE_NEEDS_RESTORE = 1;
const TAB_STATE_RESTORING = 2;

const PRIVACY_NONE = 0;
const PRIVACY_ENCRYPTED = 1;
const PRIVACY_FULL = 2;

const NOTIFY_WINDOWS_RESTORED = "sessionstore-windows-restored";
const NOTIFY_BROWSER_STATE_RESTORED = "sessionstore-browser-state-restored";

// global notifications observed
const OBSERVING = [
  "domwindowclosed",
  "quit-application-requested", "quit-application-granted", "quit-application",
  "browser-lastwindow-close-granted", "browser:purge-session-history"
];

/*
XUL Window properties to (re)store
Restored in restoreDimensions()
*/
const WINDOW_ATTRIBUTES = {
  width: "outerWidth",
  height: "outerHeight",
  screenX: "screenX",
  screenY: "screenY",
  sizemode: "windowState"
};

/*
Hideable window features to (re)store
Restored in restoreWindowFeatures()
*/
const WINDOW_HIDEABLE_FEATURES = [
  "menubar", "toolbar", "locationbar",
  "personalbar", "statusbar", "scrollbars"
];

/*
docShell capabilities to (re)store
Restored in restoreHistory()
eg: browser.docShell["allow" + aCapability] = false;

XXX keep these in sync with all the attributes starting
    with "allow" in /docshell/base/nsIDocShell.idl
*/
const CAPABILITIES = [
  "Subframes", "Plugins", "Javascript", "MetaRedirects", "Images",
  "DNSPrefetch", "Auth", "WindowControl"
];

// These are tab events that we listen to.
const TAB_EVENTS = ["TabOpen", "TabClose", "TabSelect", "TabShow", "TabHide"];

#ifndef XP_WIN
#define BROKEN_WM_Z_ORDER
#endif

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
// debug.js adds NS_ASSERT. cf. bug 669196
Components.utils.import("resource://gre/modules/debug.js");

#ifdef MOZ_CRASH_REPORTER
XPCOMUtils.defineLazyServiceGetter(this, "CrashReporter",
  "@mozilla.org/xre/app-info;1", "nsICrashReporter");
#endif

XPCOMUtils.defineLazyServiceGetter(this, "SecMan",
  "@mozilla.org/scriptsecuritymanager;1", "nsIScriptSecurityManager");
XPCOMUtils.defineLazyServiceGetter(this, "gScreenManager",
  "@mozilla.org/gfx/screenmanager;1", "nsIScreenManager");

function debug(aMsg) {
  Services.console.logStringMessage("SessionStore: " + aMsg);
}

/* :::::::: The Service ::::::::::::::: */

function SessionStoreService() {
  XPCOMUtils.defineLazyGetter(this, "_prefBranch", function () {
    return Services.prefs.getBranch("browser.");
  });

  // minimal interval between two save operations (in milliseconds)
  XPCOMUtils.defineLazyGetter(this, "_interval", function () {
    // used often, so caching/observing instead of fetching on-demand
    this._prefBranch.addObserver("sessionstore.interval", this, true);
    return this._prefBranch.getIntPref("sessionstore.interval");
  });

  // when crash recovery is disabled, session data is not written to disk
  XPCOMUtils.defineLazyGetter(this, "_resume_from_crash", function () {
    // get crash recovery state from prefs and allow for proper reaction to state changes
    this._prefBranch.addObserver("sessionstore.resume_from_crash", this, true);
    return this._prefBranch.getBoolPref("sessionstore.resume_from_crash");
  });
}

SessionStoreService.prototype = {
  classID: Components.ID("{d37ccdf1-496f-4135-9575-037180af010d}"),
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISessionStore,
                                         Components.interfaces.nsIDOMEventListener,
                                         Components.interfaces.nsIObserver,
                                         Components.interfaces.nsISupportsWeakReference]),

  // xul:tab attributes to (re)store (extensions might want to hook in here);
  // the favicon is always saved for the about:sessionrestore page
  xulAttributes: {"image": true},

  // set default load state
  _loadState: STATE_STOPPED,

  // During the initial restore and setBrowserState calls tracks the number of windows yet to be restored
  _restoreCount: 0,

  // whether a setBrowserState call is in progress
  _browserSetState: false,

  // time in milliseconds (Date.now()) when the session was last written to file
  _lastSaveTime: 0,

  // time in milliseconds when the session was started (saved across sessions),
  // defaults to now if no session was restored or timestamp doesn't exist
  _sessionStartTime: Date.now(),

  // states for all currently opened windows
  _windows: {},
  
  // internal states for all open windows (data we need to associate, but not write to disk)
  _internalWindows: {},

  // states for all recently closed windows
  _closedWindows: [],

  // not-"dirty" windows usually don't need to have their data updated
  _dirtyWindows: {},

  // collection of session states yet to be restored
  _statesToRestore: {},

  // counts the number of crashes since the last clean start
  _recentCrashes: 0,

  // whether the last window was closed and should be restored
  _restoreLastWindow: false,

  // tabs to restore in order
  _tabsToRestore: { visible: [], hidden: [] },
  _tabsRestoringCount: 0,

  // number of tabs to restore concurrently, pref controlled.
  _maxConcurrentTabRestores: null,

  // The state from the previous session (after restoring pinned tabs)
  _lastSessionState: null,

  // Whether we've been initialized
  _initialized: false,

/* ........ Public Getters .............. */

  get canRestoreLastSession() {
    // Always disallow restoring the previous session when in private browsing
    return this._lastSessionState;
  },

  set canRestoreLastSession(val) {
    // Cheat a bit; only allow false.
    if (!val)
      this._lastSessionState = null;
  },

/* ........ Global Event Handlers .............. */

  /**
   * Initialize the component
   */
  initService: function() {
    OBSERVING.forEach(function(aTopic) {
      Services.obs.addObserver(this, aTopic, true);
    }, this);

    // observe prefs changes so we can modify stored data to match
    this._prefBranch.addObserver("sessionstore.max_tabs_undo", this, true);
    this._prefBranch.addObserver("sessionstore.max_windows_undo", this, true);

    // this pref is only read at startup, so no need to observe it
    this._sessionhistory_max_entries =
      this._prefBranch.getIntPref("sessionhistory.max_entries");

    this._maxConcurrentTabRestores =
      this._prefBranch.getIntPref("sessionstore.max_concurrent_tabs");
    this._prefBranch.addObserver("sessionstore.max_concurrent_tabs", this, true);

    // Make sure gRestoreTabsProgressListener has a reference to sessionstore
    // so that it can make calls back in
    gRestoreTabsProgressListener.ss = this;

    // get file references
    this._sessionFile = Services.dirsvc.get("ProfD", Components.interfaces.nsILocalFile);
    this._sessionFileBackup = this._sessionFile.clone();
    this._sessionFile.append("sessionstore.json");
    this._sessionFileBackup.append("sessionstore.bak");

    // get string containing session state
    var ss = Components.classes["@mozilla.org/suite/sessionstartup;1"]
                       .getService(Components.interfaces.nsISessionStartup);
    try {
      if (ss.sessionType != Components.interfaces.nsISessionStartup.NO_SESSION)
        this._initialState = ss.state;
    }
    catch(ex) { dump(ex + "\n"); } // no state to restore, which is ok

    if (this._initialState) {
      try {
        // If we're doing a DEFERRED session, then we want to pull pinned tabs
        // out so they can be restored.
        if (ss.sessionType == Components.interfaces.nsISessionStartup.DEFER_SESSION) {
          let [iniState, remainingState] = this._prepDataForDeferredRestore(this._initialState);
          // If we have a iniState with windows, that means that we have windows
          // with app tabs to restore.
          if (iniState.windows.length)
            this._initialState = iniState;
          else
            this._initialState = null;
          if (remainingState.windows.length)
            this._lastSessionState = remainingState;
        }
        else {
          let lastSessionCrashed =
            this._initialState.session && this._initialState.session.state &&
            this._initialState.session.state == STATE_RUNNING_STR;
          if (lastSessionCrashed) {
            this._recentCrashes = (this._initialState.session &&
                                   this._initialState.session.recentCrashes || 0) + 1;
            
            if (this._needsRestorePage(this._initialState, this._recentCrashes)) {
              // replace the crashed session with a restore-page-only session
              let pageData = {
                url: "about:sessionrestore",
                formdata: { "#sessionData": JSON.stringify(this._initialState) }
              };
              this._initialState = { windows: [{ tabs: [{ entries: [pageData] }] }] };
            }
          }

          // Load the session start time from the previous state
          this._sessionStartTime = this._initialState.session &&
                                   this._initialState.session.startTime ||
                                   this._sessionStartTime;

          // make sure that at least the first window doesn't have anything hidden
          delete this._initialState.windows[0].hidden;
          // Since nothing is hidden in the first window, it cannot be a popup
          delete this._initialState.windows[0].isPopup;
          // clear any lastSessionWindowID attributes since those don't matter
          // during normal restore
          this._initialState.windows.forEach(function(aWindow) {
            delete aWindow.__lastSessionWindowID;
          });
        }
      }
      catch (ex) { debug("The session file is invalid: " + ex); }
    }

    if (this._resume_from_crash) {
      // create a backup if the session data file exists
      try {
        if (this._sessionFileBackup.exists())
          this._sessionFileBackup.remove(false);
        if (this._sessionFile.exists())
          this._sessionFile.copyTo(null, this._sessionFileBackup.leafName);
      }
      catch (ex) { Components.utils.reportError(ex); } // file was write-locked?
    }

    // at this point, we've as good as resumed the session, so we can
    // clear the resume_session_once flag, if it's set
    if (this._loadState != STATE_QUITTING &&
        this._prefBranch.getBoolPref("sessionstore.resume_session_once"))
      this._prefBranch.setBoolPref("sessionstore.resume_session_once", false);

    this._initialized = true;
  },

  /**
   * Start tracking a window.
   * This function also initializes the component if it's not already
   * initialized.
   */
  init: function sss_init(aWindow) {
    // Initialize the service if needed.
    if (!this._initialized)
      this.initService();

    // If init is being called with a null window, it's possible that we
    // just want to tell sessionstore that a session is live (as is the case
    // with starting Firefox with -private, for example; see bug 568816),
    // so we should mark the load state as running to make sure that
    // things like setBrowserState calls will succeed in restoring the session.
    if (!aWindow) {
      if (this._loadState == STATE_STOPPED)
        this._loadState = STATE_RUNNING;
      return;
    }

    this.onLoad(aWindow);
  },

  /**
   * Called on application shutdown, after notifications:
   * quit-application-granted, quit-application
   */
  _uninit: function sss_uninit() {
    // save all data for session resuming
    this.saveState(true);

    // clear out _tabsToRestore in case it's still holding refs
    this._tabsToRestore.visible = null;
    this._tabsToRestore.hidden = null;

    // remove the ref to us from the progress listener
    gRestoreTabsProgressListener.ss = null;

    // Make sure to break our cycle with the save timer
    if (this._saveTimer) {
      this._saveTimer.cancel();
      this._saveTimer = null;
    }
  },

  /**
   * Handle notifications
   */
  observe: function sss_observe(aSubject, aTopic, aData) {
    // for event listeners
    var _this = this;

    switch (aTopic) {
    case "domwindowclosed": // catch closed windows
      this.onClose(aSubject);
      break;
    case "quit-application-requested":
      // get a current snapshot of all windows
      this._forEachBrowserWindow(function(aWindow) {
        this._collectWindowData(aWindow);
      });
      this._dirtyWindows = [];
      break;
    case "quit-application-granted":
      // freeze the data at what we've got (ignoring closing windows)
      this._loadState = STATE_QUITTING;
      break;
    case "browser-lastwindow-close-granted":
      // last browser window is quitting.
      // remember to restore the last window when another browser window is openend
      // do not account for pref(resume_session_once) at this point, as it might be
      // set by another observer getting this notice after us
      this._restoreLastWindow = true;
      break;
    case "quit-application":
      if (aData == "restart" && !this._isSwitchingProfile()) {
        this._prefBranch.setBoolPref("sessionstore.resume_session_once", true);
        // The browser:purge-session-history notification fires after the
        // quit-application notification so unregister the
        // browser:purge-session-history notification to prevent clearing
        // session data on disk on a restart.  It is also unnecessary to
        // perform any other sanitization processing on a restart as the
        // browser is about to exit anyway.
        Services.obs.removeObserver(this, "browser:purge-session-history");
      }
      this._loadState = STATE_QUITTING; // just to be sure
      this._uninit();
      break;
    case "browser:purge-session-history": // catch sanitization
      this._clearDisk();
      // If the browser is shutting down, simply return after clearing the
      // session data on disk as this notification fires after the
      // quit-application notification so the browser is about to exit.
      if (this._loadState == STATE_QUITTING)
        return;
      this._lastSessionState = null;
      let openWindows = {};
      this._forEachBrowserWindow(function(aWindow) {
        //Hide "Restore Last Session" menu item
        let restoreItem = aWindow.document.getElementById("historyRestoreLastSession");
        restoreItem.setAttribute("disabled", "true");

        Array.forEach(aWindow.getBrowser().tabs, function(aTab) {
          delete aTab.linkedBrowser.__SS_data;
          delete aTab.linkedBrowser.__SS_tabStillLoading;
          delete aTab.linkedBrowser.__SS_formDataSaved;
          delete aTab.linkedBrowser.__SS_hostSchemeData;
          if (aTab.linkedBrowser.__SS_restoreState)
            this._resetTabRestoringState(aTab);
        });
        openWindows[aWindow.__SSi] = true;
      });
      // also clear all data about closed tabs and windows
      for (let ix in this._windows) {
        if (ix in openWindows) {
          this._windows[ix]._closedTabs = [];
        }
        else {
          delete this._windows[ix];
          delete this._internalWindows[ix];
        }
      }
      // also clear all data about closed windows
      this._closedWindows = [];
      // give the tabbrowsers a chance to clear their histories first
      var win = this._getMostRecentBrowserWindow();
      if (win)
        win.setTimeout(function() { _this.saveState(true); }, 0);
      else if (this._loadState == STATE_RUNNING)
        this.saveState(true);
      break;
    case "nsPref:changed": // catch pref changes
      switch (aData) {
      // if the user decreases the max number of closed tabs they want
      // preserved update our internal states to match that max
      case "sessionstore.max_tabs_undo":
        for (let ix in this._windows) {
          this._windows[ix]._closedTabs.splice(this._prefBranch.getIntPref("sessionstore.max_tabs_undo"), this._windows[ix]._closedTabs.length);
        }
        break;
      case "sessionstore.max_windows_undo":
        this._capClosedWindows();
        break;
      case "sessionstore.interval":
        this._interval = this._prefBranch.getIntPref("sessionstore.interval");
        // reset timer and save
        if (this._saveTimer) {
          this._saveTimer.cancel();
          this._saveTimer = null;
        }
        this.saveStateDelayed(null, -1);
        break;
      case "sessionstore.resume_from_crash":
        this._resume_from_crash = this._prefBranch.getBoolPref("sessionstore.resume_from_crash");
        // either create the file with crash recovery information or remove it
        // (when _loadState is not STATE_RUNNING, that file is used for session resuming instead)
        if (this._resume_from_crash)
          this.saveState(true);
        else if (this._loadState == STATE_RUNNING)
          this._clearDisk();
        break;
      case "sessionstore.max_concurrent_tabs":
        this._maxConcurrentTabRestores =
          this._prefBranch.getIntPref("sessionstore.max_concurrent_tabs");
        break;
      }
      break;
    case "timer-callback": // timer call back for delayed saving
      this._saveTimer = null;
      this.saveState();
      break;
    }
  },

/* ........ Window Event Handlers .............. */

  /**
   * Implement nsIDOMEventListener for handling various window and tab events
   */
  handleEvent: function sss_handleEvent(aEvent) {
    var win = aEvent.currentTarget.ownerDocument.defaultView;
    switch (aEvent.type) {
      case "load":
        // If __SS_restore_data is set, then we need to restore the document
        // (form data, scrolling, etc.). This will only happen when a tab is
        // first restored.
        if (aEvent.currentTarget.__SS_restore_data)
          this.restoreDocument(win, aEvent.currentTarget, aEvent);
        // We still need to call onTabLoad, so fall through to "pageshow" case.
      case "pageshow":
        this.onTabLoad(win, aEvent.currentTarget, aEvent);
        break;
      case "change":
      case "input":
      case "DOMAutoComplete":
        this.onTabInput(win, aEvent.currentTarget);
        break;
      case "TabOpen":
        this.onTabAdd(win, aEvent.originalTarget);
        break;
      case "TabClose":
        // aEvent.detail determines if the tab was closed by moving to a different window
        if (!aEvent.detail)
          this.onTabClose(win, aEvent.originalTarget);
        this.onTabRemove(win, aEvent.originalTarget);
        break;
      case "TabSelect":
        this.onTabSelect(win);
        break;
      case "TabShow":
        this.onTabShow(aEvent.originalTarget);
        break;
      case "TabHide":
        this.onTabHide(aEvent.originalTarget);
        break;
    }
  },

  /**
   * If it's the first window load since app start...
   * - determine if we're reloading after a crash or a forced-restart
   * - restore window state
   * - restart downloads
   * Set up event listeners for this window's tabs
   * @param aWindow
   *        Window reference
   */
  onLoad: function sss_onLoad(aWindow) {
    // return if window has already been initialized
    if (aWindow && aWindow.__SSi && this._windows[aWindow.__SSi])
      return;

    // ignore non-browser windows and windows opened while shutting down
    if (aWindow.document.documentElement.getAttribute("windowtype") != "navigator:browser" ||
        this._loadState == STATE_QUITTING)
      return;

    // assign it a unique identifier (timestamp)
    aWindow.__SSi = "window" + Date.now();

    // and create its data object
    this._windows[aWindow.__SSi] = { tabs: [], selected: 0, _closedTabs: [] };

    // and create its internal data object
    this._internalWindows[aWindow.__SSi] = { hosts: {} }

    if (!this._isWindowLoaded(aWindow))
      this._windows[aWindow.__SSi]._restoring = true;
    if (!aWindow.toolbar.visible)
      this._windows[aWindow.__SSi].isPopup = true;

    // perform additional initialization when the first window is loading
    if (this._loadState == STATE_STOPPED) {
      this._loadState = STATE_RUNNING;
      this._lastSaveTime = Date.now();

      // restore a crashed session resp. resume the last session if requested
      if (this._initialState) {
        // make sure that the restored tabs are first in the window
        this._initialState._firstTabs = true;
        this._restoreCount = this._initialState.windows ? this._initialState.windows.length : 0;
        this.restoreWindow(aWindow, this._initialState,
                           this._isCmdLineEmpty(aWindow));
        delete this._initialState;

        // _loadState changed from "stopped" to "running"
        // force a save operation so that crashes happening during startup are correctly counted
        this.saveState(true);
      }
      else {
        // Nothing to restore, notify observers things are complete.
        Services.obs.notifyObservers(aWindow, NOTIFY_WINDOWS_RESTORED, "");

        // the next delayed save request should execute immediately
        this._lastSaveTime -= this._interval;
      }
    }
    // this window was opened by _openWindowWithState
    else if (!this._isWindowLoaded(aWindow)) {
      let followUp = this._statesToRestore[aWindow.__SS_restoreID].windows.length == 1;
      this.restoreWindow(aWindow, this._statesToRestore[aWindow.__SS_restoreID], true, followUp);
    }
    else if (this._restoreLastWindow && aWindow.toolbar.visible &&
             this._closedWindows.length) {
      // default to the most-recently closed window
      // don't use popup windows
      let closedWindowState = null;
      let closedWindowIndex;
      for (let i = 0; i < this._closedWindows.length; i++) {
        // Take the first non-popup, point our object at it, and break out.
        if (!this._closedWindows[i].isPopup) {
          closedWindowState = this._closedWindows[i];
          closedWindowIndex = i;
          break;
        }
      }

      if (closedWindowState) {
        let newWindowState;
#ifndef XP_MACOSX
        if (!this._doResumeSession()) {
#endif
          // We want to split the window up into pinned tabs and unpinned tabs.
          // Pinned tabs should be restored. If there are any remaining tabs,
          // they should be added back to _closedWindows.
          // We'll cheat a little bit and reuse _prepDataForDeferredRestore
          // even though it wasn't built exactly for this.
          let [appTabsState, normalTabsState] =
            this._prepDataForDeferredRestore({ windows: [closedWindowState] });

          // These are our pinned tabs, which we should restore
          if (appTabsState.windows.length) {
            newWindowState = appTabsState.windows[0];
            delete newWindowState.__lastSessionWindowID;
          }

          // In case there were no unpinned tabs, remove the window from _closedWindows
          if (!normalTabsState.windows.length) {
            this._closedWindows.splice(closedWindowIndex, 1);
          }
          // Or update _closedWindows with the modified state
          else {
            delete normalTabsState.windows[0].__lastSessionWindowID;
            this._closedWindows[closedWindowIndex] = normalTabsState.windows[0];
          }
#ifndef XP_MACOSX
        }
        else {
          // If we're just restoring the window, make sure it gets removed from
          // _closedWindows.
          this._closedWindows.splice(closedWindowIndex, 1);
          newWindowState = closedWindowState;
          delete newWindowState.hidden;
        }
#endif
        if (newWindowState) {
          // Ensure that the window state isn't hidden
          this._restoreCount = 1;
          let state = { windows: [newWindowState] };
          this.restoreWindow(aWindow, state, this._isCmdLineEmpty(aWindow));
        }
      }
      // we actually restored the session just now.
      this._prefBranch.setBoolPref("sessionstore.resume_session_once", false);
    }
    if (this._restoreLastWindow && aWindow.toolbar.visible) {
      // always reset (if not a popup window)
      // we don't want to restore a window directly after, for example,
      // undoCloseWindow was executed.
      this._restoreLastWindow = false;
    }

    var tabbrowser = aWindow.getBrowser();

    // add tab change listeners to all already existing tabs
    for (let i = 0; i < tabbrowser.tabs.length; i++) {
      this.onTabAdd(aWindow, tabbrowser.tabs[i], true);
    }
    // notification of tab add/remove/selection/show/hide
    TAB_EVENTS.forEach(function(aEvent) {
      tabbrowser.tabContainer.addEventListener(aEvent, this, true);
    }, this);
  },

  /**
   * On window close...
   * - remove event listeners from tabs
   * - save all window data
   * @param aWindow
   *        Window reference
   */
  onClose: function sss_onClose(aWindow) {
    // this window was about to be restored - conserve its original data, if any
    let isFullyLoaded = this._isWindowLoaded(aWindow);
    if (!isFullyLoaded) {
      if (!aWindow.__SSi)
        aWindow.__SSi = "window" + Date.now();
      this._windows[aWindow.__SSi] = this._statesToRestore[aWindow.__SS_restoreID];
      delete this._statesToRestore[aWindow.__SS_restoreID];
      delete aWindow.__SS_restoreID;
    }

    // ignore windows not tracked by SessionStore
    if (!aWindow.__SSi || !this._windows[aWindow.__SSi]) {
      return;
    }

    if (this.windowToFocus && this.windowToFocus == aWindow) {
      delete this.windowToFocus;
    }

    var tabbrowser = aWindow.getBrowser();

    TAB_EVENTS.forEach(function(aEvent) {
      tabbrowser.tabContainer.removeEventListener(aEvent, this, true);
    }, this);

    // remove the progress listener for this window
    try {
     tabbrowser.removeTabsProgressListener(gRestoreTabsProgressListener);
    } catch (ex) {};

    let winData = this._windows[aWindow.__SSi];
    if (this._loadState == STATE_RUNNING) { // window not closed during a regular shut-down
      // update all window data for a last time
      this._collectWindowData(aWindow);

      if (isFullyLoaded) {
        winData.title = aWindow.content.document.title || tabbrowser.selectedTab.label;
        winData.title = this._replaceLoadingTitle(winData.title, tabbrowser,
                                                  tabbrowser.selectedTab);
        let windows = {};
        windows[aWindow.__SSi] = winData;
        this._updateCookies(windows);
      }

      // save the window if it has multiple tabs or a single saveable tab
      if (winData.tabs.length > 1 ||
          (winData.tabs.length == 1 && this._shouldSaveTabState(winData.tabs[0]))) {
        this._closedWindows.unshift(winData);
        this._capClosedWindows();
      }

      // clear this window from the list
      delete this._windows[aWindow.__SSi];
      delete this._internalWindows[aWindow.__SSi];

      // save the state without this window to disk
      this.saveStateDelayed();
    }

    for (let i = 0; i < tabbrowser.tabs.length; i++) {
      this.onTabRemove(aWindow, tabbrowser.tabs[i], true);
    }

    // Cache the window state until it is completely gone.
    DyingWindowCache.set(aWindow, winData);

    delete aWindow.__SSi;
  },

  /**
   * set up listeners for a new tab
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   * @param aNoNotification
   *        bool Do not save state if we're updating an existing tab
   */
  onTabAdd: function sss_onTabAdd(aWindow, aTab, aNoNotification) {
    let browser = aTab.linkedBrowser;
    browser.addEventListener("load", this, true);
    browser.addEventListener("pageshow", this, true);
    browser.addEventListener("change", this, true);
    browser.addEventListener("input", this, true);
    browser.addEventListener("DOMAutoComplete", this, true);

    if (!aNoNotification) {
      this.saveStateDelayed(aWindow);
    }

    this._updateCrashReportURL(aWindow);
  },

  /**
   * remove listeners for a tab
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   * @param aNoNotification
   *        bool Do not save state if we're updating an existing tab
   */
  onTabRemove: function sss_onTabRemove(aWindow, aTab, aNoNotification) {
    let browser = aTab.linkedBrowser;
    browser.removeEventListener("load", this, true);
    browser.removeEventListener("pageshow", this, true);
    browser.removeEventListener("change", this, true);
    browser.removeEventListener("input", this, true);
    browser.removeEventListener("DOMAutoComplete", this, true);

    delete browser.__SS_data;
    delete browser.__SS_tabStillLoading;
    delete browser.__SS_formDataSaved;
    delete browser.__SS_hostSchemeData;

    // If this tab was in the middle of restoring or still needs to be restored,
    // we need to reset that state. If the tab was restoring, we will attempt to
    // restore the next tab.
    let previousState = browser.__SS_restoreState;
    if (previousState) {
      this._resetTabRestoringState(aTab);
      if (previousState == TAB_STATE_RESTORING)
        this.restoreNextTab();
    }

    if (!aNoNotification) {
      this.saveStateDelayed(aWindow);
    }
  },

  /**
   * When a tab closes, collect its properties
   * @param aWindow
   *        Window reference
   * @param aTab
   *        Tab reference
   */
  onTabClose: function sss_onTabClose(aWindow, aTab) {
    // notify the tabbrowser that the tab state will be retrieved for the last time
    // (so that extension authors can easily set data on soon-to-be-closed tabs)
    var event = aWindow.document.createEvent("Events");
    event.initEvent("SSTabClosing", true, false);
    aTab.dispatchEvent(event);

    var maxTabsUndo = this._prefBranch.getIntPref("sessionstore.max_tabs_undo");
    // don't update our internal state if we don't have to
    if (maxTabsUndo == 0) {
      return;
    }

    // make sure that the tab related data is up-to-date
    var tabState = this._collectTabData(aTab);
    this._updateTextAndScrollDataForTab(aWindow, aTab.linkedBrowser, tabState);

    // store closed-tab data for undo
    if (this._shouldSaveTabState(tabState)) {
      aTab.tabData = { state: tabState };
      var closedTabs = this._windows[aWindow.__SSi]._closedTabs;
      closedTabs.unshift(aTab.tabData);
      if (closedTabs.length > maxTabsUndo)
        closedTabs.length = maxTabsUndo;
    };
  },

  /**
   * When a tab loads, save state.
   * @param aWindow
   *        Window reference
   * @param aBrowser
   *        Browser reference
   * @param aEvent
   *        Event obj
   */
  onTabLoad: function sss_onTabLoad(aWindow, aBrowser, aEvent) {
    // react on "load" and solitary "pageshow" events (the first "pageshow"
    // following "load" is too late for deleting the data caches)
    // It's possible to get a load event after calling stop on a browser (when
    // overwriting tabs). We want to return early if the tab hasn't been restored yet.
    if ((aEvent.type != "load" && !aEvent.persisted) ||
        (aBrowser.__SS_restoreState &&
         aBrowser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE)) {
      return;
    }

    delete aBrowser.__SS_data;
    delete aBrowser.__SS_tabStillLoading;
    delete aBrowser.__SS_formDataSaved;
    this.saveStateDelayed(aWindow);

    // attempt to update the current URL we send in a crash report
    this._updateCrashReportURL(aWindow);
  },

  /**
   * Called when a browser sends the "input" notification
   * @param aWindow
   *        Window reference
   * @param aBrowser
   *        Browser reference
   */
  onTabInput: function sss_onTabInput(aWindow, aBrowser) {
    // deleting __SS_formDataSaved will cause us to recollect form data
    delete aBrowser.__SS_formDataSaved;

    this.saveStateDelayed(aWindow, 3000);
  },

  /**
   * When a tab is selected, save session data
   * @param aWindow
   *        Window reference
   */
  onTabSelect: function sss_onTabSelect(aWindow) {
    if (this._loadState == STATE_RUNNING) {
      this._windows[aWindow.__SSi].selected = aWindow.getBrowser().tabContainer.selectedIndex;

      let tab = aWindow.getBrowser().selectedTab;
      // If __SS_restoreState is still on the browser and it is
      // TAB_STATE_NEEDS_RESTORE, then then we haven't restored
      // this tab yet. Explicitly call restoreTab to kick off the restore.
      if (tab.linkedBrowser.__SS_restoreState &&
          tab.linkedBrowser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE)
        this.restoreTab(tab);

      // attempt to update the current URL we send in a crash report
      this._updateCrashReportURL(aWindow);
    }
  },

  onTabShow: function sss_onTabShow(aTab) {
    // If the tab hasn't been restored yet, move it into the right _tabsToRestore bucket
    if (aTab.linkedBrowser.__SS_restoreState &&
        aTab.linkedBrowser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE) {
      this._tabsToRestore.hidden.splice(this._tabsToRestore.hidden.indexOf(aTab), 1);
      // Just put it at the end of the list of visible tabs;
      this._tabsToRestore.visible.push(aTab);
    }
  },

  onTabHide: function sss_onTabHide(aTab) {
    // If the tab hasn't been restored yet, move it into the right _tabsToRestore bucket
    if (aTab.linkedBrowser.__SS_restoreState &&
        aTab.linkedBrowser.__SS_restoreState == TAB_STATE_NEEDS_RESTORE) {
      this._tabsToRestore.visible.splice(this._tabsToRestore.visible.indexOf(aTab), 1);
      // Just put it at the end of the list of hidden tabs;
      this._tabsToRestore.hidden.push(aTab);
    }
  },

/* ........ nsISessionStore API .............. */

  getBrowserState: function sss_getBrowserState() {
    return this._toJSONString(this._getCurrentState());
  },

  setBrowserState: function sss_setBrowserState(aState) {
    this._handleClosedWindows();

    try {
      var state = JSON.parse(aState);
    }
    catch (ex) { /* invalid state object - don't restore anything */ }
    if (!state || !state.windows)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    this._browserSetState = true;

    // Make sure _tabsToRestore is emptied out
    this._resetRestoringState();

    var window = this._getMostRecentBrowserWindow();
    if (!window) {
      this._restoreCount = 1;
      this._openWindowWithState(state);
      return;
    }

    // close all other browser windows
    this._forEachBrowserWindow(function(aWindow) {
      if (aWindow != window) {
        aWindow.close();
        this.onClose(aWindow);
      }
    });

    // make sure closed window data isn't kept
    this._closedWindows = [];

    // determine how many windows are meant to be restored
    this._restoreCount = state.windows ? state.windows.length : 0;

    // restore to the given state
    this.restoreWindow(window, state, true);
  },

  getWindowState: function sss_getWindowState(aWindow) {
    if ("__SSi" in aWindow) {
      return this._toJSONString(this._getWindowState(aWindow));
    }

    if (DyingWindowCache.has(aWindow)) {
      let data = DyingWindowCache.get(aWindow);
      return this._toJSONString({ windows: [data] });
    }

    throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);
  },

  setWindowState: function sss_setWindowState(aWindow, aState, aOverwrite) {
    if (!aWindow.__SSi)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    this.restoreWindow(aWindow, aState, aOverwrite);
  },

  getTabState: function sss_getTabState(aTab) {
    if (!aTab.ownerDocument || !aTab.ownerDocument.defaultView.__SSi)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    var tabState = this._collectTabData(aTab);

    var window = aTab.ownerDocument.defaultView;
    this._updateTextAndScrollDataForTab(window, aTab.linkedBrowser, tabState);

    return this._toJSONString(tabState);
  },

  setTabState: function sss_setTabState(aTab, aState) {
    var tabState = JSON.parse(aState);
    if (!tabState.entries || !aTab.ownerDocument || !aTab.ownerDocument.defaultView.__SSi)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    var window = aTab.ownerDocument.defaultView;
    this._sendWindowStateEvent(window, "Busy");
    this.restoreHistoryPrecursor(window, [aTab], [tabState], 0, 0, 0);
  },

  duplicateTab: function sss_duplicateTab(aWindow, aTab, aDelta, aRelated) {
    if (!aTab.ownerDocument || !aTab.ownerDocument.defaultView.__SSi ||
        aWindow && !aWindow.getBrowser)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    var tabState = this._collectTabData(aTab, true);
    var sourceWindow = aTab.ownerDocument.defaultView;
    this._updateTextAndScrollDataForTab(sourceWindow, aTab.linkedBrowser, tabState, true);
    tabState.index += aDelta;
    tabState.index = Math.max(1, Math.min(tabState.index, tabState.entries.length));

    if (aWindow) {
      this._sendWindowStateEvent(aWindow, "Busy");
      var newTab = aWindow.getBrowser()
                          .addTab(null, { relatedToCurrent: aRelated });
      this.restoreHistoryPrecursor(aWindow, [newTab], [tabState], 0, 0, 0);
      return newTab;
    }

    var state = { windows: [{ tabs: [tabState] }] };
    this.windowToFocus = this._openWindowWithState(state);
    return null;
  },

  _getClosedTabs: function sss_getClosedTabs(aWindow) {
    if (!aWindow.__SSi)
      return this._toJSONString(aWindow.__SS_dyingCache._closedTabs);

    var closedTabs = this._windows[aWindow.__SSi]._closedTabs;
    closedTabs = closedTabs.concat(aWindow.getBrowser().savedBrowsers);
    closedTabs = closedTabs.filter(function(aTabData, aIndex, aArray) {
      return aArray.indexOf(aTabData) == aIndex;
    });
    return closedTabs;
  },

  getClosedTabCount: function sss_getClosedTabCount(aWindow) {
    if ("__SSi" in aWindow) {
      return this._windows[aWindow.__SSi]._closedTabs.length;
    }

    if (DyingWindowCache.has(aWindow)) {
      return DyingWindowCache.get(aWindow)._closedTabs.length;
    }

    throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);
  },

  getClosedTabData: function sss_getClosedTabData(aWindow) {
    if ("__SSi" in aWindow) {
      return this._toJSONString(this._windows[aWindow.__SSi]._closedTabs);
    }

    if (DyingWindowCache.has(aWindow)) {
      let data = DyingWindowCache.get(aWindow);
      return this._toJSONString(data._closedTabs);
    }

    throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);
  },

  undoCloseTab: function sss_undoCloseTab(aWindow, aIndex) {
    if (!aWindow.__SSi)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    var closedTabs = this._getClosedTabs(aWindow);
    if (!(aIndex in closedTabs))
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    // fetch the data of closed tab, while removing it from the array
    let closedTab = closedTabs[aIndex];
    if (aIndex in this._windows[aWindow.__SSi]._closedTabs)
      this._windows[aWindow.__SSi]._closedTabs.splice(aIndex, 1);
    var tabbrowser = aWindow.getBrowser();
    var index = tabbrowser.savedBrowsers.indexOf(closedTab);
    this._sendWindowStateEvent(aWindow, "Busy");
    if (index != -1)
      // SeaMonkey has its own undoclosetab functionality
      return tabbrowser.restoreTab(index);

    // create a new tab
    var tab = tabbrowser.addTab();

    // restore the tab's position
    tabbrowser.moveTabTo(tab, closedTab.pos);

    // restore tab content
    this.restoreHistoryPrecursor(aWindow, [tab], [closedTab.state], 1, 0, 0);

    // focus the tab's content area (bug 342432)
    tab.linkedBrowser.focus();

    return tab;
  },

  forgetClosedTab: function sss_forgetClosedTab(aWindow, aIndex) {
    if (!aWindow.__SSi)
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    var closedTabs = this._getClosedTabs(aWindow);
    if (!(aIndex in closedTabs))
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);

    // remove closed tab from the array
    var closedTab = closedTabs[aIndex];
    if (aIndex in this._windows[aWindow.__SSi]._closedTabs)
      this._windows[aWindow.__SSi]._closedTabs.splice(aIndex, 1);
    var tabbrowser = aWindow.getBrowser();
    var index = tabbrowser.savedBrowsers.indexOf(closedTab);
    if (index != -1)
      tabbrowser.forgetSavedBrowser(aIndex);
  },

  getClosedWindowCount: function sss_getClosedWindowCount() {
    return this._closedWindows.length;
  },

  getClosedWindowData: function sss_getClosedWindowData() {
    return this._toJSONString(this._closedWindows);
  },

  undoCloseWindow: function sss_undoCloseWindow(aIndex) {
    if (!(aIndex in this._closedWindows))
      return null;

    // reopen the window
    let state = { windows: this._closedWindows.splice(aIndex, 1) };
    let window = this._openWindowWithState(state);
    this.windowToFocus = window;
    return window;
  },

  getWindowValue: function sss_getWindowValue(aWindow, aKey) {
    if ("__SSi" in aWindow) {
      var data = this._windows[aWindow.__SSi].extData || {};
      return data[aKey] || "";
    }
    if (DyingWindowCache.has(aWindow)) {
      let data = DyingWindowCache.get(aWindow).extData || {};
      return data[aKey] || "";
    }
    throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);
  },

  setWindowValue: function sss_setWindowValue(aWindow, aKey, aStringValue) {
    if (aWindow.__SSi) {
      if (!this._windows[aWindow.__SSi].extData) {
        this._windows[aWindow.__SSi].extData = {};
      }
      this._windows[aWindow.__SSi].extData[aKey] = aStringValue;
      this.saveStateDelayed(aWindow);
    }
    else {
      throw (Components.returnCode = Components.results.NS_ERROR_INVALID_ARG);
    }
  },

  deleteWindowValue: function sss_deleteWindowValue(aWindow, aKey) {
    if (aWindow.__SSi && this._windows[aWindow.__SSi].extData &&
        this._windows[aWindow.__SSi].extData[aKey])
      delete this._windows[aWindow.__SSi].extData[aKey];
  },

  getTabValue: function sss_getTabValue(aTab, aKey) {
    let data = {};
    if (aTab.__SS_extdata) {
      data = aTab.__SS_extdata;
    }
    else if (aTab.linkedBrowser.__SS_data && aTab.linkedBrowser.__SS_data.extData) {
      // If the tab hasn't been fully restored, get the data from the to-be-restored data
      data = aTab.linkedBrowser.__SS_data.extData;
    }
    return data[aKey] || "";
  },

  setTabValue: function sss_setTabValue(aTab, aKey, aStringValue) {
    // If the tab hasn't been restored, then set the data there, otherwise we
    // could lose newly added data.
    let saveTo;
    if (aTab.__SS_extdata) {
      saveTo = aTab.__SS_extdata;
    }
    else if (aTab.linkedBrowser.__SS_data && aTab.linkedBrowser.__SS_data.extData) {
      saveTo = aTab.linkedBrowser.__SS_data.extData;
    }
    else {
      aTab.__SS_extdata = {};
      saveTo = aTab.__SS_extdata;
    }
    saveTo[aKey] = aStringValue;
    this.saveStateDelayed(aTab.ownerDocument.defaultView);
  },

  deleteTabValue: function sss_deleteTabValue(aTab, aKey) {
    // We want to make sure that if data is accessed early, we attempt to delete
    // that data from __SS_data as well. Otherwise we'll throw in cases where
    // data can be set or read.
    let deleteFrom = null;
    if (aTab.__SS_extdata) {
      deleteFrom = aTab.__SS_extdata;
    }
    else if (aTab.linkedBrowser.__SS_data && aTab.linkedBrowser.__SS_data.extData) {
      deleteFrom = aTab.linkedBrowser.__SS_data.extData;
    }

    if (deleteFrom && deleteFrom[aKey])
      delete deleteFrom[aKey];
  },

  persistTabAttribute: function sss_persistTabAttribute(aName) {
    if (aName in this.xulAttributes)
      return; // this attribute is already being tracked

    this.xulAttributes[aName] = true;
    this.saveStateDelayed();
  },

  doRestoreLastWindow: function sss_doRestoreLastWindow() {
    let state = null;
    this._closedWindows.forEach(function(aWinState) {
      if (!state && !aWinState.isPopup) {
        state = aWinState;
      }
    });
    return (this._restoreLastWindow && state &&
            this._doResumeSession());
  },

  /**
   * Restores the session state stored in _lastSessionState. This will attempt
   * to merge data into the current session. If a window was opened at startup
   * with pinned tab(s), then the remaining data from the previous session for
   * that window will be opened into that winddow. Otherwise new windows will
   * be opened.
   */
  restoreLastSession: function sss_restoreLastSession() {
    // Use the public getter since it also checks PB mode
    if (!this.canRestoreLastSession)
      throw (Components.returnCode = Components.results.NS_ERROR_FAILURE);

    // First collect each window with its id...
    let windows = {};
    this._forEachBrowserWindow(function(aWindow) {
      if (aWindow.__SS_lastSessionWindowID)
        windows[aWindow.__SS_lastSessionWindowID] = aWindow;
    });

    let lastSessionState = this._lastSessionState;

    // This shouldn't ever be the case...
    if (!lastSessionState.windows.length)
      throw (Components.returnCode = Components.results.NS_ERROR_UNEXPECTED);

    // We're technically doing a restore, so set things up so we send the
    // notification when we're done. We want to send "sessionstore-browser-state-restored".
    this._restoreCount = lastSessionState.windows.length;
    this._browserSetState = true;

    // We want to re-use the last opened window instead of opening a new one in
    // the case where it's "empty" and not associated with a window in the session.
    // We will do more processing via _prepWindowToRestoreInto if we need to use
    // the lastWindow.
    let lastWindow = this._getMostRecentBrowserWindow();
    let canUseLastWindow = lastWindow &&
                           !lastWindow.__SS_lastSessionWindowID;

    // Restore into windows or open new ones as needed.
    for (let i = 0; i < lastSessionState.windows.length; i++) {
      let winState = lastSessionState.windows[i];
      let lastSessionWindowID = winState.__lastSessionWindowID;
      // delete lastSessionWindowID so we don't add that to the window again
      delete winState.__lastSessionWindowID;

      // See if we can use an open window. First try one that is associated with
      // the state we're trying to restore and then fallback to the last selected
      // window.
      let windowToUse = windows[lastSessionWindowID];
      if (!windowToUse && canUseLastWindow) {
        windowToUse = lastWindow;
        canUseLastWindow = false;
      }

      let [canUseWindow, canOverwriteTabs] = this._prepWindowToRestoreInto(windowToUse);

      // If there's a window already open that we can restore into, use that
      if (canUseWindow) {
        // Since we're not overwriting existing tabs, we want to merge _closedTabs,
        // putting existing ones first. Then make sure we're respecting the max pref.
        if (winState._closedTabs && winState._closedTabs.length) {
          let curWinState = this._windows[windowToUse.__SSi];
          curWinState._closedTabs = curWinState._closedTabs.concat(winState._closedTabs);
          curWinState._closedTabs.splice(this._prefBranch.getIntPref("sessionstore.max_tabs_undo"), curWinState._closedTabs.length);
        }

        // Restore into that window - pretend it's a followup since we'll already
        // have a focused window.
        //XXXzpao This is going to merge extData together (taking what was in
        //        winState over what is in the window already. The hack we have
        //        in _preWindowToRestoreInto will prevent most (all?) Panorama
        //        weirdness but we will still merge other extData.
        //        Bug 588217 should make this go away by merging the group data.
        this.restoreWindow(windowToUse, { windows: [winState] }, canOverwriteTabs, true);
      }
      else {
        this._openWindowWithState({ windows: [winState] });
      }
    }

    // Merge closed windows from this session with ones from last session
    if (lastSessionState._closedWindows) {
      this._closedWindows = this._closedWindows.concat(lastSessionState._closedWindows);
      this._capClosedWindows();
    }

    // Set data that persists between sessions
    this._recentCrashes = lastSessionState.session &&
                          lastSessionState.session.recentCrashes || 0;
    this._sessionStartTime = lastSessionState.session &&
                             lastSessionState.session.startTime ||
                             this._sessionStartTime;

    this._lastSessionState = null;
  },

  /**
   * See if aWindow is usable for use when restoring a previous session via
   * restoreLastSession. If usable, prepare it for use.
   *
   * @param aWindow
   *        the window to inspect & prepare
   * @returns [canUseWindow, canOverwriteTabs]
   *          canUseWindow: can the window be used to restore into
   *          canOverwriteTabs: all of the current tabs are home pages and we
   *                            can overwrite them
   */
  _prepWindowToRestoreInto: function sss__prepWindowToRestoreInto(aWindow) {
    if (!aWindow)
      return [false, false];

    // We might be able to overwrite the existing tabs instead of just adding
    // the previous session's tabs to the end. This will be set if possible.
    let canOverwriteTabs = false;

    // Step 1 of processing:
    // Inspect extData for Panorama identifiers. If found, then we want to
    // inspect further. If there is a single group, then we can use this
    // window. If there are multiple groups then we won't use this window.
    let data = this.getWindowValue(aWindow, "tabview-group");
    if (data) {
      data = JSON.parse(data);

      // Multiple keys means multiple groups, which means we don't want to use this window.
      if (Object.keys(data).length > 1) {
        return [false, false];
      }
      else {
        // If there is only one group, then we want to ensure that its group id
        // is 0. This is how Panorama forces group merging when new tabs are opened.
        //XXXzpao This is a hack and the proper fix really belongs in Panorama.
        let groupKey = Object.keys(data)[0];
        if (groupKey !== "0") {
          data["0"] = data[groupKey];
          delete data[groupKey];
          this.setWindowValue(aWindow, "tabview-groups", JSON.stringify(data));
        }
      }
    }

    // Step 2 of processing:
    // If we're still here, then the window is usable. Look at the open tabs in
    // comparison to home pages. If all the tabs are home pages then we'll end
    // up overwriting all of them. Otherwise we'll just close the tabs that
    // match home pages.
    let homePages = aWindow.getHomePage();
    let removableTabs = [];
    let tabbrowser = aWindow.getBrowser();
    let normalTabsLen = tabbrowser.tabs.length - tabbrowser._numPinnedTabs;
    for (let i = 0; i < tabbrowser.tabs.length; i++) {
      let tab = tabbrowser.tabs[i];
      if (homePages.indexOf(tab.linkedBrowser.currentURI.spec) != -1) {
        removableTabs.push(tab);
      }
    }

    if (tabbrowser.tabs.length == removableTabs.length) {
      canOverwriteTabs = true;
    }
    else {
      // If we're not overwriting all of the tabs, then close the home tabs.
      for (let i = removableTabs.length - 1; i >= 0; i--) {
        tabbrowser.removeTab(removableTabs.pop(), { animate: false });
      }
    }

    return [true, canOverwriteTabs];
  },

/* ........ Saving Functionality .............. */

  /**
   * Store all session data for a window
   * @param aWindow
   *        Window reference
   */
  _saveWindowHistory: function sss_saveWindowHistory(aWindow) {
    var tabbrowser = aWindow.getBrowser();
    var tabs = tabbrowser.tabs;
    var tabsData = this._windows[aWindow.__SSi].tabs = [];

    for (var i = 0; i < tabs.length; i++)
      tabsData.push(this._collectTabData(tabs[i]));

    this._windows[aWindow.__SSi].selected = tabbrowser.mTabBox.selectedIndex + 1;
  },

  /**
   * Collect data related to a single tab
   * @param aTab
   *        tabbrowser tab
   * @param aFullData
   *        always return privacy sensitive data (use with care)
   * @returns object
   */
  _collectTabData: function sss_collectTabData(aTab, aFullData) {
    var tabData = { entries: [] };
    var browser = aTab.linkedBrowser;

    if (!browser || !browser.currentURI)
      // can happen when calling this function right after .addTab()
      return tabData;
    else if (browser.__SS_data && browser.__SS_tabStillLoading) {
      // use the data to be restored when the tab hasn't been completely loaded
      tabData = browser.__SS_data;
      if (aTab.pinned)
        tabData.pinned = true;
      else
        delete tabData.pinned;
      tabData.hidden = aTab.hidden;

      // If __SS_extdata is set then we'll use that since it might be newer.
      if (aTab.__SS_extdata)
        tabData.extData = aTab.__SS_extdata;
      // If it exists but is empty then a key was likely deleted. In that case just
      // delete extData.
      if (tabData.extData && !Object.keys(tabData.extData).length)
        delete tabData.extData;
      return tabData;
    }

    var history = null;
    try {
      history = browser.sessionHistory;
    }
    catch (ex) { } // this could happen if we catch a tab during (de)initialization

    // XXXzeniko anchor navigation doesn't reset __SS_data, so we could reuse
    //           data even when we shouldn't (e.g. Back, different anchor)
    if (history && browser.__SS_data &&
        browser.__SS_data.entries[history.index] &&
        browser.__SS_data.entries[history.index].url == browser.currentURI.spec &&
        history.index < this._sessionhistory_max_entries - 1 && !aFullData) {
      tabData = browser.__SS_data;
      tabData.index = history.index + 1;
    }
    else if (history && history.count > 0) {
      browser.__SS_hostSchemeData = [];
      try {
        for (var j = 0; j < history.count; j++) {
          let entry = this._serializeHistoryEntry(history.getEntryAtIndex(j, false),
                                                  aFullData, aTab.pinned, browser.__SS_hostSchemeData);
          tabData.entries.push(entry);
        }
        // If we make it through the for loop, then we're ok and we should clear
        // any indicator of brokenness.
        delete aTab.__SS_broken_history;
      }
      catch (ex) {
        // In some cases, getEntryAtIndex will throw. This seems to be due to
        // history.count being higher than it should be. By doing this in a
        // try-catch, we'll update history to where it breaks, assert for
        // non-release builds, and still save sessionstore.js. We'll track if
        // we've shown the assert for this tab so we only show it once.
        // cf. bug 669196.
        if (!aTab.__SS_broken_history) {
          // First Focus the window & tab we're having trouble with.
          aTab.ownerDocument.defaultView.focus();
          aTab.ownerDocument.defaultView.getBrowser().selectedTab = aTab;
          NS_ASSERT(false, "SessionStore failed gathering complete history " +
                           "for the focused window/tab. See bug 669196.");
          aTab.__SS_broken_history = true;
        }
      }
      tabData.index = history.index + 1;

      // make sure not to cache privacy sensitive data which shouldn't get out
      if (!aFullData)
        browser.__SS_data = tabData;
    }
    else if (browser.currentURI.spec != "about:blank" ||
             browser.contentDocument.body.hasChildNodes()) {
      tabData.entries[0] = { url: browser.currentURI.spec };
      tabData.index = 1;
    }

    // If there is a userTypedValue set, then either the user has typed something
    // in the URL bar, or a new tab was opened with a URI to load. userTypedClear
    // is used to indicate whether the tab was in some sort of loading state with
    // userTypedValue.
    if (browser.userTypedValue) {
      tabData.userTypedValue = browser.userTypedValue;
      tabData.userTypedClear = browser.userTypedClear;
    } else {
      delete tabData.userTypedValue;
      delete tabData.userTypedClear;
    }

    var disallow = [];
    for (var i = 0; i < CAPABILITIES.length; i++)
      if (!browser.docShell["allow" + CAPABILITIES[i]])
        disallow.push(CAPABILITIES[i]);
    if (disallow.length > 0)
      tabData.disallow = disallow.join(",");
    else if (tabData.disallow)
      delete tabData.disallow;

    tabData.attributes = {};
    for (let name in this.xulAttributes) {
      if (aTab.hasAttribute(name))
        tabData.attributes[name] = aTab.getAttribute(name);
    }

    if (aTab.__SS_extdata)
      tabData.extData = aTab.__SS_extdata;
    else if (tabData.extData)
      delete tabData.extData;

    if (history && browser.docShell instanceof Components.interfaces.nsIDocShell)
      this._serializeSessionStorage(tabData, history, browser.docShell, aFullData,
                                    false);

    return tabData;
  },

  /**
   * Get an object that is a serialized representation of a History entry
   * Used for data storage
   * @param aEntry
   *        nsISHEntry instance
   * @param aFullData
   *        always return privacy sensitive data (use with care)
   * @param aIsPinned
   *        the tab is pinned and should be treated differently for privacy
   * @param aHostSchemeData
   *        an array of objects with host & scheme keys
   * @returns object
   */
  _serializeHistoryEntry:
    function sss_serializeHistoryEntry(aEntry, aFullData, aIsPinned, aHostSchemeData) {
    var entry = { url: aEntry.URI.spec };

    try {
      aHostSchemeData.push({ host: aEntry.URI.host, scheme: aEntry.URI.scheme });
    }
    catch (ex) {
      // We just won't attempt to get cookies for this entry.
    }

    if (aEntry.title && aEntry.title != entry.url) {
      entry.title = aEntry.title;
    }
    if (aEntry.isSubFrame) {
      entry.subframe = true;
    }
    if (!(aEntry instanceof Components.interfaces.nsISHEntry)) {
      return entry;
    }

    var cacheKey = aEntry.cacheKey;
    if (cacheKey && cacheKey instanceof Components.interfaces.nsISupportsPRUint32 &&
        cacheKey.data != 0) {
      // XXXbz would be better to have cache keys implement
      // nsISerializable or something.
      entry.cacheKey = cacheKey.data;
    }
    entry.ID = aEntry.ID;
    entry.docshellID = aEntry.docshellID;

    if (aEntry.referrerURI)
      entry.referrer = aEntry.referrerURI.spec;

    if (aEntry.contentType)
      entry.contentType = aEntry.contentType;

    var x = {}, y = {};
    aEntry.getScrollPosition(x, y);
    if (x.value != 0 || y.value != 0)
      entry.scroll = x.value + "," + y.value;

    try {
      var prefPostdata = this._prefBranch.getIntPref("sessionstore.postdata");
      if (aEntry.postData && (aFullData || prefPostdata &&
            this._checkPrivacyLevel(aEntry.URI.schemeIs("https"), aIsPinned))) {
        aEntry.postData.QueryInterface(Components.interfaces.nsISeekableStream)
                       .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, 0);
        var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
                               .createInstance(Components.interfaces.nsIBinaryInputStream);
        stream.setInputStream(aEntry.postData);
        var postBytes = stream.readByteArray(stream.available());
        var postdata = String.fromCharCode.apply(null, postBytes);
        if (aFullData || prefPostdata == -1 ||
            postdata.replace(/^(Content-.*\r\n)+(\r\n)*/, "").length <=
              prefPostdata) {
          // We can stop doing base64 encoding once our serialization into JSON
          // is guaranteed to handle all chars in strings, including embedded
          // nulls.
          entry.postdata_b64 = btoa(postdata);
        }
      }
    }
    catch (ex) { debug(ex); } // POSTDATA is tricky - especially since some extensions don't get it right

    if (aEntry.owner) {
      // Not catching anything specific here, just possible errors
      // from writeCompoundObject and the like.
      try {
        var binaryStream = Components.classes["@mozilla.org/binaryoutputstream;1"]
                                     .createInstance(Components.interfaces.nsIObjectOutputStream);
        var pipe = Components.classes["@mozilla.org/pipe;1"].createInstance(Components.interfaces.nsIPipe);
        pipe.init(false, false, 0, 0xffffffff, null);
        binaryStream.setOutputStream(pipe.outputStream);
        binaryStream.writeCompoundObject(aEntry.owner, Components.interfaces.nsISupports, true);
        binaryStream.close();

        // Now we want to read the data from the pipe's input end and encode it.
        var scriptableStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                                         .createInstance(Components.interfaces.nsIBinaryInputStream);
        scriptableStream.setInputStream(pipe.inputStream);
        var ownerBytes =
          scriptableStream.readByteArray(scriptableStream.available());
        // We can stop doing base64 encoding once our serialization into JSON
        // is guaranteed to handle all chars in strings, including embedded
        // nulls.
        entry.owner_b64 = btoa(String.fromCharCode.apply(null, ownerBytes));
      }
      catch (ex) { debug(ex); }
    }

    entry.docIdentifier = aEntry.BFCacheEntry.ID;

    if (aEntry.stateData) {
      entry.structuredCloneState = aEntry.stateData.getDataAsBase64();
      entry.structuredCloneVersion = aEntry.stateData.formatVersion;
    }

    if (!(aEntry instanceof Components.interfaces.nsISHContainer)) {
      return entry;
    }

    if (aEntry.childCount > 0) {
      entry.children = [];
      for (var i = 0; i < aEntry.childCount; i++) {
        var child = aEntry.GetChildAt(i);
        if (child) {
          entry.children.push(this._serializeHistoryEntry(child, aFullData, aIsPinned, aHostSchemeData));
        }
        else { // to maintain the correct frame order, insert a dummy entry
          entry.children.push({ url: "about:blank" });
        }
        // don't try to restore framesets containing wyciwyg URLs (cf. bug 424689 and bug 450595)
        if (/^wyciwyg:\/\//.test(entry.children[i].url)) {
          delete entry.children;
          break;
        }
      }
    }

    return entry;
  },

  /**
   * Updates all sessionStorage "super cookies"
   * @param aTabData
   *        The data object for a specific tab
   * @param aHistory
   *        That tab's session history
   * @param aDocShell
   *        That tab's docshell (containing the sessionStorage)
   * @param aFullData
   *        always return privacy sensitive data (use with care)
   * @param aIsPinned
   *        the tab is pinned and should be treated differently for privacy
   */
  _serializeSessionStorage:
    function sss_serializeSessionStorage(aTabData, aHistory, aDocShell, aFullData, aIsPinned) {
    let storageData = {};
    let hasContent = false;

    for (let i = 0; i < aHistory.count; i++) {
      let principal;
      try {
        let uri = aHistory.getEntryAtIndex(i, false).URI;
        principal = SecMan.getDocShellCodebasePrincipal(uri, aDocShell);
      }
      catch (ex) {
        // Chances are that this is getEntryAtIndex throwing, as seen in bug 669196.
        // We've already asserted in _collectTabData, so we won't show that again.
        continue;
      }
      // sessionStorage is saved per origin (cf. nsDocShell::GetSessionStorageForURI)
      let origin = principal.extendedOrigin;
      if (storageData[origin])
        continue;

      let isHTTPS = principal.uri && principal.url.schemeIs("https");
      if (!(aFullData || this._checkPrivacyLevel(isHTTPS, aIsPinned)))
        continue;

      let storage, storageItemCount = 0;
      try {
        storage = aDocShell.getSessionStorageForPrincipal(principal, "", false);
        if (storage)
          storageItemCount = storage.length;
      }
      catch (ex) { /* sessionStorage might throw if it's turned off, see bug 458954 */ }
      if (storageItemCount == 0)
        continue;

      let data = storageData[origin] = {};
      for (let j = 0; j < storageItemCount; j++) {
        try {
          let key = storage.key(j);
          let item = storage.getItem(key);
          data[key] = item;
        }
        catch (ex) { /* XXXzeniko this currently throws for secured items (cf. bug 442048) */ }
      }
      hasContent = true;
    }

    if (hasContent)
      aTabData.storage = storageData;
  },

  /**
   * go through all tabs and store the current scroll positions
   * and innerHTML content of WYSIWYG editors
   * @param aWindow
   *        Window reference
   */
  _updateTextAndScrollData: function sss_updateTextAndScrollData(aWindow) {
    var browsers = aWindow.getBrowser().browsers;
    for (var i = 0; i < browsers.length; i++) {
      try {
        var tabData = this._windows[aWindow.__SSi].tabs[i];
        if (browsers[i].__SS_data &&
            browsers[i].__SS_tabStillLoading)
          continue; // ignore incompletely initialized tabs
        this._updateTextAndScrollDataForTab(aWindow, browsers[i], tabData);
      }
      catch (ex) { debug(ex); } // get as much data as possible, ignore failures (might succeed the next time)
    }
  },

  /**
   * go through all frames and store the current scroll positions
   * and innerHTML content of WYSIWYG editors
   * @param aWindow
   *        Window reference
   * @param aBrowser
   *        single browser reference
   * @param aTabData
   *        tabData object to add the information to
   * @param aFullData
   *        always return privacy sensitive data (use with care)
   */
  _updateTextAndScrollDataForTab:
    function sss_updateTextAndScrollDataForTab(aWindow, aBrowser, aTabData, aFullData) {
    var tabIndex = (aTabData.index || aTabData.entries.length) - 1;
    // entry data needn't exist for tabs just initialized with an incomplete session state
    if (!aTabData.entries[tabIndex])
      return;

    let selectedPageStyle = aBrowser.markupDocumentViewer.authorStyleDisabled ? "_nostyle" :
                            this._getSelectedPageStyle(aBrowser.contentWindow);
    if (selectedPageStyle)
      aTabData.pageStyle = selectedPageStyle;
    else if (aTabData.pageStyle)
      delete aTabData.pageStyle;

    this._updateTextAndScrollDataForFrame(aWindow, aBrowser.contentWindow,
                                          aTabData.entries[tabIndex],
                                          !aBrowser.__SS_formDataSaved, aFullData,
                                          !!aTabData.pinned);
    aBrowser.__SS_formDataSaved = true;
    if (aBrowser.currentURI.spec == "about:config")
      aTabData.entries[tabIndex].formdata = {
        "#textbox": aBrowser.contentDocument.getElementById("textbox").value
      };
  },

  /**
   * go through all subframes and store all form data, the current
   * scroll positions and innerHTML content of WYSIWYG editors
   * @param aWindow
   *        Window reference
   * @param aContent
   *        frame reference
   * @param aData
   *        part of a tabData object to add the information to
   * @param aUpdateFormData
   *        update all form data for this tab
   * @param aFullData
   *        always return privacy sensitive data (use with care)
   * @param aIsPinned
   *        the tab is pinned and should be treated differently for privacy
   */
  _updateTextAndScrollDataForFrame:
    function sss_updateTextAndScrollDataForFrame(aWindow, aContent, aData,
                                                 aUpdateFormData, aFullData, aIsPinned) {
    for (var i = 0; i < aContent.frames.length; i++) {
      if (aData.children && aData.children[i])
        this._updateTextAndScrollDataForFrame(aWindow, aContent.frames[i],
                                              aData.children[i], aUpdateFormData,
                                              aFullData, aIsPinned);
    }
    var isHTTPS = this._getURIFromString((aContent.parent || aContent).
                                         document.location.href).schemeIs("https");
    if (aFullData || this._checkPrivacyLevel(isHTTPS, aIsPinned) ||
        aContent.top.document.location.href == "about:sessionrestore") {
      if (aFullData || aUpdateFormData) {
        let formData = this._collectFormDataForFrame(aContent.document);
        if (formData)
          aData.formdata = formData;
        else if (aData.formdata)
          delete aData.formdata;
      }

      // designMode is undefined e.g. for XUL documents (as about:config)
      if ((aContent.document.designMode || "") == "on") {
        if (aData.innerHTML === undefined && !aFullData) {
          // we get no "input" events from iframes - listen for keypress here
          let _this = this;
          aContent.addEventListener("keypress", function(aEvent) {
            _this.saveStateDelayed(aWindow, 3000);
          }, true);
        }
        aData.innerHTML = aContent.document.body.innerHTML;
      }
    }

    // get scroll position from nsIDOMWindowUtils, since it allows avoiding a
    // flush of layout
    let domWindowUtils = aContent.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                 .getInterface(Components.interfaces.nsIDOMWindowUtils);
    let scrollX = {}, scrollY = {};
    domWindowUtils.getScrollXY(false, scrollX, scrollY);
    aData.scroll = scrollX.value + "," + scrollY.value;
  },

  /**
   * determine the title of the currently enabled style sheet (if any)
   * and recurse through the frameset if necessary
   * @param   aContent is a frame reference
   * @returns the title style sheet determined to be enabled (empty string if none)
   */
  _getSelectedPageStyle: function sss_getSelectedPageStyle(aContent) {
    const forScreen = /(?:^|,)\s*(?:all|screen)\s*(?:,|$)/i;
    for (let i = 0; i < aContent.document.styleSheets.length; i++) {
      let ss = aContent.document.styleSheets[i];
      let media = ss.media.mediaText;
      if (!ss.disabled && ss.title && (!media || forScreen.test(media)))
        return ss.title
    }
    for (let i = 0; i < aContent.frames.length; i++) {
      let selectedPageStyle = this._getSelectedPageStyle(aContent.frames[i]);
      if (selectedPageStyle)
        return selectedPageStyle;
    }
    return "";
  },

  /**
   * collect the state of all form elements
   * @param aDocument
   *        document reference
   */
  _collectFormDataForFrame: function sss_collectFormDataForFrame(aDocument) {
    let formNodes = aDocument.evaluate(XPathHelper.restorableFormNodes, aDocument,
                                       XPathHelper.resolveNS,
                                       Components.interfaces.nsIDOMXPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    let node = formNodes.iterateNext();
    if (!node)
      return null;

    const MAX_GENERATED_XPATHS = 100;
    let generatedCount = 0;

    let data = {};
    do {
      let nId = node.id;
      let hasDefaultValue = true;
      let value;

      // Only generate a limited number of XPath expressions for perf reasons (cf. bug 477564)
      if (!nId && generatedCount > MAX_GENERATED_XPATHS)
        continue;

      if (node instanceof Components.interfaces.nsIDOMHTMLInputElement ||
          node instanceof Components.interfaces.nsIDOMHTMLTextAreaElement) {
        switch (node.type) {
          case "checkbox":
          case "radio":
            value = node.checked;
            hasDefaultValue = value == node.defaultChecked;
            break;
          case "file":
            value = { type: "file", fileList: node.mozGetFileNameArray() };
            hasDefaultValue = !value.fileList.length;
            break;
          default: // text, textarea
            value = node.value;
            hasDefaultValue = value == node.defaultValue;
            break;
        }
      }
      else if (!node.multiple) {
        // <select>s without the multiple attribute are hard to determine the
        // default value, so assume we don't have the default.
        hasDefaultValue = false;
        value = node.selectedIndex;
      }
      else {
        // <select>s with the multiple attribute are easier to determine the
        // default value since each <option> has a defaultSelected
        let options = Array.map(node.options, function(aOpt, aIx) {
          let oSelected = aOpt.selected;
          hasDefaultValue = hasDefaultValue && (oSelected == aOpt.defaultSelected);
          return oSelected ? aIx : -1;
        });
        value = options.filter(function(aIx) aIx >= 0);
      }
      // In order to reduce XPath generation (which is slow), we only save data
      // for form fields that have been changed. (cf. bug 537289)
      if (!hasDefaultValue) {
        if (nId) {
          data["#" + nId] = value;
        }
        else {
          generatedCount++;
          data[XPathHelper.generate(node)] = value;
        }
      }

    } while ((node = formNodes.iterateNext()));

    return data;
  },

  /**
   * extract the base domain from a history entry and its children
   * @param aEntry
   *        the history entry, serialized
   * @param aHosts
   *        the hash that will be used to store hosts eg, { hostname: true }
   * @param aCheckPrivacy
   *        should we check the privacy level for https
   * @param aIsPinned
   *        is the entry we're evaluating for a pinned tab; used only if
   *        aCheckPrivacy
   */
  _extractHostsForCookiesFromEntry:
    function sss__extractHostsForCookiesFromEntry(aEntry, aHosts, aCheckPrivacy, aIsPinned) {
 
    if (aEntry.children) {
      aEntry.children.forEach(function(entry) {
        this._extractHostsForCookiesFromEntry(entry, aHosts, aCheckPrivacy, aIsPinned);
      }, this);
    }
  },

  /**
   * extract the base domain from a host & scheme
   * @param aHost
   *        the host of a uri (usually via nsIURI.host)
   * @param aScheme
   *        the scheme of a uri (usually via nsIURI.scheme)
   * @param aHosts
   *        the hash that will be used to store hosts eg, { hostname: true }
   * @param aCheckPrivacy
   *        should we check the privacy level for https
   * @param aIsPinned
   *        is the entry we're evaluating for a pinned tab; used only if
   *        aCheckPrivacy
   */
  _extractHostsForCookiesFromHostScheme:
    function sss__extractHostsForCookiesFromHostScheme(aHost, aScheme, aHosts, aCheckPrivacy, aIsPinned) {
    // host and scheme may not be set (for about: urls for example), in which
    // case testing scheme will be sufficient.
    if (/https?/.test(aScheme) && !aHosts[aHost] &&
        (!aCheckPrivacy ||
         this._checkPrivacyLevel(aScheme == "https", aIsPinned))) {
      // By setting this to true or false, we can determine when looking at
      // the host in _updateCookies if we should check for privacy.
      aHosts[aHost] = aIsPinned;
    }
    else if (aScheme == "file") {
      aHosts[aHost] = true;
    }
  },

  /**
   * store all hosts for a URL
   * @param aWindow
   *        Window reference
   */
  _updateCookieHosts: function sss_updateCookieHosts(aWindow) {
    var hosts = this._internalWindows[aWindow.__SSi].hosts = {};

    // Since _updateCookiesHosts is only ever called for open windows during a
    // session, we can call into _extractHostsForCookiesFromHostScheme directly
    // using data that is attached to each browser.
    for (let i = 0; i < aWindow.gBrowser.tabs.length; i++) {
      let tab = aWindow.gBrowser.tabs[i];
      let hostSchemeData = tab.linkedBrowser.__SS_hostSchemeData || [];
      for (let j = 0; j < hostSchemeData.length; j++) {
        this._extractHostsForCookiesFromHostScheme(hostSchemeData[j].host,
                                                   hostSchemeData[j].scheme,
                                                   hosts, true, tab.pinned);
      }
    }
  },

  /**
   * Serialize cookie data
   * @param aWindows
   *        JS object containing window data references
   *        { id: winData, etc. }
   */
  _updateCookies: function sss_updateCookies(aWindows) {
    var jscookies = {};
    var _this = this;
    // MAX_EXPIRY should be 2^63-1, but JavaScript can't handle that precision
    var MAX_EXPIRY = Math.pow(2, 62);

    for (let [id, window] in Iterator(aWindows)) {
      window.cookies = [];
      let internalWindow = this._internalWindows[id];
      if (!internalWindow.hosts)
        return;
      for (var [host, isPinned] in Iterator(internalWindow.hosts)) {
        try {
          var list = Services.cookies.getCookiesFromHost(host);
          while (list.hasMoreElements()) {
            var cookie = list.getNext().QueryInterface(Components.interfaces.nsICookie2);
            // window._hosts will only have hosts with the right privacy rules,
            // so there is no need to do anything special with this call to
            // _checkPrivacyLevel.
            if (cookie.isSession && _this._checkPrivacyLevel(cookie.isSecure, isPinned)) {
              // use the cookie's host, path, and name as keys into a hash,
              // to make sure we serialize each cookie only once

              // lazily build up a 3-dimensional hash, with
              // host, path, and name as keys
              if (!jscookies[cookie.host])
                jscookies[cookie.host] = {};
              if (!jscookies[cookie.host][cookie.path])
                jscookies[cookie.host][cookie.path] = {};

              if (!jscookies[cookie.host][cookie.path][cookie.name]) {
                var jscookie = { "host": cookie.host, "value": cookie.value };
                // only add attributes with non-default values (saving a few bits)
                if (cookie.path) jscookie.path = cookie.path;
                if (cookie.name) jscookie.name = cookie.name;
                if (cookie.isSecure) jscookie.secure = true;
                if (cookie.isHttpOnly) jscookie.httponly = true;
                if (cookie.expiry < MAX_EXPIRY) jscookie.expiry = cookie.expiry;

                jscookies[cookie.host][cookie.path][cookie.name] = jscookie;
              }
            window.cookies.push(jscookies[cookie.host][cookie.path][cookie.name]);
            }
          }
        }
        catch (ex) {
          debug("getCookiesFromHost failed. Host: " + host);
        }
      }

      // don't include empty cookie sections
      if (!window.cookies.length)
        delete window.cookies;
    }
  },

  /**
   * Store window dimensions, visibility, sidebar
   * @param aWindow
   *        Window reference
   */
  _updateWindowFeatures: function sss_updateWindowFeatures(aWindow) {
    var winData = this._windows[aWindow.__SSi];

    for (var aAttr in WINDOW_ATTRIBUTES)
      winData[aAttr] = this._getWindowDimension(aWindow, aAttr);

    var hidden = WINDOW_HIDEABLE_FEATURES.filter(function(aItem) {
      return aWindow[aItem] && !aWindow[aItem].visible;
    });
    if (hidden.length != 0)
      winData.hidden = hidden.join(",");
    else if (winData.hidden)
      delete winData.hidden;

    var sidebar = aWindow.document.getElementById("sidebar-box").getAttribute("sidebarcommand");
    if (sidebar)
      winData.sidebar = sidebar;
    else if (winData.sidebar)
      delete winData.sidebar;
  },

  /**
   * serialize session data as Ini-formatted string
   * @param aUpdateAll
   *        Bool update all windows
   * @returns string
   */
  _getCurrentState: function sss_getCurrentState(aUpdateAll) {
    this._handleClosedWindows();

    var activeWindow = this._getMostRecentBrowserWindow();

    if (this._loadState == STATE_RUNNING) {
      // update the data for all windows with activities since the last save operation
      this._forEachBrowserWindow(function(aWindow) {
        if (!this._isWindowLoaded(aWindow)) // window data is still in _statesToRestore
          return;
        if (aUpdateAll || this._dirtyWindows[aWindow.__SSi] || aWindow == activeWindow) {
          this._collectWindowData(aWindow);
        }
        else { // always update the window features (whose change alone never triggers a save operation)
          this._updateWindowFeatures(aWindow);
        }
      });
      this._dirtyWindows = [];
    }

    // collect the data for all windows
    var total = [], windows = {}, ids = [];
    var nonPopupCount = 0;
    var ix;
    for (ix in this._windows) {
      if (this._windows[ix]._restoring) // window data is still in _statesToRestore
        continue;
      total.push(this._windows[ix]);
      ids.push(ix);
      windows[ix] = this._windows[ix];
      if (!this._windows[ix].isPopup)
        nonPopupCount++;
    }
    this._updateCookies(windows);

    // collect the data for all windows yet to be restored
    for (ix in this._statesToRestore) {
      for each (let winData in this._statesToRestore[ix].windows) {
        total.push(winData);
        if (!winData.isPopup)
          nonPopupCount++;
      }
    }

    // shallow copy this._closedWindows to preserve current state
    let lastClosedWindowsCopy = this._closedWindows.slice();

#ifndef XP_MACOSX
    // If no non-popup browser window remains open, return the state of the last
    // closed window(s). We only want to do this when we're actually "ending"
    // the session.
    //XXXzpao We should do this for _restoreLastWindow == true, but that has
    //        its own check for popups. c.f. bug 597619
    if (nonPopupCount == 0 && lastClosedWindowsCopy.length > 0 &&
        this._loadState == STATE_QUITTING) {
      // prepend the last non-popup browser window, so that if the user loads more tabs
      // at startup we don't accidentally add them to a popup window
      do {
        total.unshift(lastClosedWindowsCopy.shift())
      } while (total[0].isPopup)
    }
#endif

    if (activeWindow) {
      this.activeWindowSSiCache = activeWindow.__SSi || "";
    }
    ix = ids.indexOf(this.activeWindowSSiCache);
    // We don't want to restore focus to a minimized window.
    if (ix != -1 && total[ix].sizemode == "minimized")
      ix = -1;

    let session = {
      state: this._loadState == STATE_RUNNING ? STATE_RUNNING_STR : STATE_STOPPED_STR,
      lastUpdate: Date.now(),
      startTime: this._sessionStartTime,
      recentCrashes: this._recentCrashes
    };

    return {
      windows: total,
      selectedWindow: ix + 1,
      _closedWindows: lastClosedWindowsCopy,
      session: session
    };
  },

  /**
   * serialize session data for a window
   * @param aWindow
   *        Window reference
   * @returns string
   */
  _getWindowState: function sss_getWindowState(aWindow) {
    if (!this._isWindowLoaded(aWindow))
      return this._statesToRestore[aWindow.__SS_restoreID];

    if (this._loadState == STATE_RUNNING) {
      this._collectWindowData(aWindow);
    }

    var winData = this._windows[aWindow.__SSi];
    let windows = {};
    windows[aWindow.__SSi] = winData;
    this._updateCookies(windows);

    return { windows: [winData] };
  },

  _collectWindowData: function sss_collectWindowData(aWindow) {
    if (!this._isWindowLoaded(aWindow))
      return;

    // update the internal state data for this window
    this._saveWindowHistory(aWindow);
    this._updateTextAndScrollData(aWindow);
    this._updateCookieHosts(aWindow);
    this._updateWindowFeatures(aWindow);

    // Make sure we keep __SS_lastSessionWindowID around for cases like entering
    // or leaving PB mode.
    if (aWindow.__SS_lastSessionWindowID)
      this._windows[aWindow.__SSi].__lastSessionWindowID =
        aWindow.__SS_lastSessionWindowID;

    this._dirtyWindows[aWindow.__SSi] = false;
  },

/* ........ Restoring Functionality .............. */

  /**
   * restore features to a single window
   * @param aWindow
   *        Window reference
   * @param aState
   *        JS object or its eval'able source
   * @param aOverwriteTabs
   *        bool overwrite existing tabs w/ new ones
   * @param aFollowUp
   *        bool this isn't the restoration of the first window
   */
  restoreWindow: function sss_restoreWindow(aWindow, aState, aOverwriteTabs, aFollowUp) {
    if (!aFollowUp) {
      this.windowToFocus = aWindow;
    }
    // initialize window if necessary
    if (aWindow && (!aWindow.__SSi || !this._windows[aWindow.__SSi]))
      this.onLoad(aWindow);

    try {
      var root = typeof aState == "string" ? JSON.parse(aState) : aState;
      if (!root.windows[0]) {
        this._sendRestoreCompletedNotifications();
        return; // nothing to restore
      }
    }
    catch (ex) { // invalid state object - don't restore anything
      debug(ex);
      this._sendRestoreCompletedNotifications();
      return;
    }

    // We're not returning from this before we end up calling restoreHistoryPrecursor
    // for this window, so make sure we send the SSWindowStateBusy event.
    this._sendWindowStateEvent(aWindow, "Busy");

    if (root._closedWindows)
      this._closedWindows = root._closedWindows;

    var winData;
    if (!aState.selectedWindow || aState.selectedWindow > aState.windows.length) {
      aState.selectedWindow = 0;
    }
    // open new windows for all further window entries of a multi-window session
    // (unless they don't contain any tab data)
    for (var w = 1; w < root.windows.length; w++) {
      winData = root.windows[w];
      if (winData && winData.tabs && winData.tabs[0]) {
        var window = this._openWindowWithState({ windows: [winData] });
        if (w == aState.selectedWindow - 1) {
          this.windowToFocus = window;
        }
      }
    }
    winData = root.windows[0];
    if (!winData.tabs) {
      winData.tabs = [];
    }
    // don't restore a single blank tab when we've had an external
    // URL passed in for loading at startup (cf. bug 357419)
    else if (root._firstTabs && !aOverwriteTabs && winData.tabs.length == 1 &&
             (!winData.tabs[0].entries || winData.tabs[0].entries.length == 0)) {
      winData.tabs = [];
    }

    var tabbrowser = aWindow.getBrowser();
    var openTabCount = aOverwriteTabs ? tabbrowser.browsers.length : -1;
    var newTabCount = winData.tabs.length;
    var tabs = [];

    // disable smooth scrolling while adding, moving, removing and selecting tabs
    var tabstrip = tabbrowser.tabContainer.mTabstrip;
    var smoothScroll = tabstrip.smoothScroll;
    tabstrip.smoothScroll = false;
    
    // make sure that the selected tab won't be closed in order to
    // prevent unnecessary flickering
    if (aOverwriteTabs && tabbrowser.tabContainer.selectedIndex >= newTabCount)
      tabbrowser.moveTabTo(tabbrowser.selectedTab, newTabCount - 1);

    for (var t = 0; t < newTabCount; t++) {
      tabs.push(t < openTabCount ?
                tabbrowser.tabs[t] :
                // Ftr, SeaMonkey doesn't support animation (yet).
                tabbrowser.addTab("about:blank"));
      // when resuming at startup: add additionally requested pages to the end
      if (!aOverwriteTabs && root._firstTabs) {
        tabbrowser.moveTabTo(tabs[t], t);
      }
    }

    // If overwriting tabs, we want to reset each tab's "restoring" state. Since
    // we're overwriting those tabs, they should no longer be restoring. The
    // tabs will be rebuilt and marked if they need to be restored after loading
    // state (in restoreHistoryPrecursor).
    if (aOverwriteTabs) {
      for (let i = 0; i < tabbrowser.tabs.length; i++) {
        if (tabbrowser.browsers[i].__SS_restoreState)
          this._resetTabRestoringState(tabbrowser.tabs[i]);
      }
    }

    // We want to set up a counter on the window that indicates how many tabs
    // in this window are unrestored. This will be used in restoreNextTab to
    // determine if gRestoreTabsProgressListener should be removed from the window.
    // If we aren't overwriting existing tabs, then we want to add to the existing
    // count in case there are still tabs restoring.
    if (!aWindow.__SS_tabsToRestore)
      aWindow.__SS_tabsToRestore = 0;
    if (aOverwriteTabs)
      aWindow.__SS_tabsToRestore = newTabCount;
    else
      aWindow.__SS_tabsToRestore += newTabCount;

    // We want to correlate the window with data from the last session, so
    // assign another id if we have one. Otherwise clear so we don't do
    // anything with it.
    delete aWindow.__SS_lastSessionWindowID;
    if (winData.__lastSessionWindowID)
      aWindow.__SS_lastSessionWindowID = winData.__lastSessionWindowID;

    // when overwriting tabs, remove all superflous ones
    for (t = openTabCount - 1; t >= newTabCount; t--) {
      tabbrowser.removeTab(tabbrowser.tabs[t]);
    }

    if (aOverwriteTabs) {
      this.restoreWindowFeatures(aWindow, winData);
      delete this._windows[aWindow.__SSi].extData;
    }
    if (winData.cookies) {
      this.restoreCookies(winData.cookies);
    }
    if (winData.extData) {
      if (!this._windows[aWindow.__SSi].extData) {
        this._windows[aWindow.__SSi].extData = {};
      }
      for (var key in winData.extData) {
        this._windows[aWindow.__SSi].extData[key] = winData.extData[key];
      }
    }
    if (aOverwriteTabs || root._firstTabs) {
      this._windows[aWindow.__SSi]._closedTabs = winData._closedTabs || [];
    }

    this.restoreHistoryPrecursor(aWindow, tabs, winData.tabs,
      (aOverwriteTabs ? (parseInt(winData.selected) || 1) : 0), 0, 0);

    // set smoothScroll back to the original value
    tabstrip.smoothScroll = smoothScroll;

    this._sendRestoreCompletedNotifications();
  },

  /**
   * Manage history restoration for a window
   * @param aWindow
   *        Window to restore the tabs into
   * @param aTabs
   *        Array of tab references
   * @param aTabData
   *        Array of tab data
   * @param aSelectTab
   *        Index of selected tab
   * @param aIx
   *        Index of the next tab to check readyness for
   * @param aCount
   *        Counter for number of times delaying b/c browser or history aren't ready
   */
  restoreHistoryPrecursor:
    function sss_restoreHistoryPrecursor(aWindow, aTabs, aTabData, aSelectTab, aIx, aCount) {
    var tabbrowser = aWindow.getBrowser();

    // make sure that all browsers and their histories are available
    // - if one's not, resume this check in 100ms (repeat at most 10 times)
    for (var t = aIx; t < aTabs.length; t++) {
      try {
        if (!tabbrowser.getBrowserForTab(aTabs[t]).webNavigation.sessionHistory) {
          throw new Error();
        }
      }
      catch (ex) { // in case browser or history aren't ready yet
        if (aCount < 10) {
          var restoreHistoryFunc = function(self) {
            self.restoreHistoryPrecursor(aWindow, aTabs, aTabData, aSelectTab, aIx, aCount + 1);
          }
          aWindow.setTimeout(restoreHistoryFunc, 100, this);
          return;
        }
      }
    }

    if (!this._isWindowLoaded(aWindow)) {
      // from now on, the data will come from the actual window
      delete this._statesToRestore[aWindow.__SS_restoreID];
      delete aWindow.__SS_restoreID;
      delete this._windows[aWindow.__SSi]._restoring;
    }

    if (aTabs.length == 0) {
      // this is normally done in restoreHistory() but as we're returning early
      // here we need to take care of it.
      this._sendWindowStateEvent(aWindow, "Ready");
      return;
    }

    if (aTabs.length > 1) {
      // Load hidden tabs last, by pushing them to the end of the list
      let unhiddenTabs = aTabs.length;
      for (let t = 0; t < unhiddenTabs; ) {
        if (aTabData[t].hidden) {
          aTabs = aTabs.concat(aTabs.splice(t, 1));
          aTabData = aTabData.concat(aTabData.splice(t, 1));
          if (aSelectTab > t)
            --aSelectTab;
          --unhiddenTabs;
          continue;
        }
        ++t;
      }

      // Determine if we can optimize & load visible tabs first
      let maxVisibleTabs = Math.ceil(tabbrowser.tabContainer.mTabstrip.scrollClientSize /
                                     aTabs[unhiddenTabs - 1].getBoundingClientRect().width);

      // make sure we restore visible tabs first, if there are enough
      if (maxVisibleTabs < unhiddenTabs && aSelectTab > 1) {
        let firstVisibleTab = 0;
        if (unhiddenTabs - maxVisibleTabs > aSelectTab) {
          // aSelectTab is leftmost since we scroll to it when possible
          firstVisibleTab = aSelectTab - 1;
        } else {
          // aSelectTab is rightmost or no more room to scroll right
          firstVisibleTab = unhiddenTabs - maxVisibleTabs;
        }
        aTabs = aTabs.splice(firstVisibleTab, maxVisibleTabs).concat(aTabs);
        aTabData = aTabData.splice(firstVisibleTab, maxVisibleTabs).concat(aTabData);
        aSelectTab -= firstVisibleTab;
      }
    }

    // make sure to restore the selected tab first (if any)
    if (aSelectTab-- && aTabs[aSelectTab]) {
      aTabs.unshift(aTabs.splice(aSelectTab, 1)[0]);
      aTabData.unshift(aTabData.splice(aSelectTab, 1)[0]);
      tabbrowser.selectedTab = aTabs[0];
    }

    // Prepare the tabs so that they can be properly restored. We'll pin/unpin
    // and show/hide tabs as necessary. We'll also set the labels, user typed
    // value, and attach a copy of the tab's data in case we close it before
    // it's been restored.
    for (t = 0; t < aTabs.length; t++) {
      let tab = aTabs[t];
      let browser = tabbrowser.getBrowserForTab(tab);
      let tabData = aTabData[t];

      tab.hidden = tabData.hidden;

      for (let name in tabData.attributes)
        this.xulAttributes[name] = true;

      browser.__SS_tabStillLoading = true;

      // keep the data around to prevent dataloss in case
      // a tab gets closed before it's been properly restored
      browser.__SS_data = tabData;
      browser.__SS_restoreState = TAB_STATE_NEEDS_RESTORE;

      // Make sure that set/getTabValue will set/read the correct data by
      // wiping out any current value in tab.__SS_extdata.
      delete tab.__SS_extdata;

      if (!tabData.entries || tabData.entries.length == 0) {
        // make sure to blank out this tab's content
        // (just purging the tab's history won't be enough)
        browser.contentDocument.location = "about:blank";
        continue;
      }

      browser.stop(); // in case about:blank isn't done yet

      // wall-paper fix for bug 439675: make sure that the URL to be loaded
      // is always visible in the address bar
      let activeIndex = (tabData.index || tabData.entries.length) - 1;
      let activePageData = tabData.entries[activeIndex] || null;
      let uri = activePageData ? activePageData.url || null : null;
      browser.userTypedValue = uri;

      // Also make sure currentURI is set so that switch-to-tab works before
      // the tab is restored. We'll reset this to about:blank when we try to
      // restore the tab to ensure that docshell doeesn't get confused.
      if (uri)
        browser.docShell.setCurrentURI(this._getURIFromString(uri));

      // If the page has a title, set it.
      if (activePageData) {
        if (activePageData.title) {
          tab.label = activePageData.title;
          tab.crop = "end";
        } else if (activePageData.url != "about:blank") {
          tab.label = activePageData.url;
          tab.crop = "center";
        }
      }
    }

    // helper hashes for ensuring unique frame IDs and unique document
    // identifiers.
    var idMap = { used: {} };
    var docIdentMap = {};
    this.restoreHistory(aWindow, aTabs, aTabData, idMap, docIdentMap);
  },

  /**
   * Restore history for a window
   * @param aWindow
   *        Window reference
   * @param aTabs
   *        Array of tab references
   * @param aTabData
   *        Array of tab data
   * @param aIdMap
   *        Hash for ensuring unique frame IDs
   */
  restoreHistory:
    function sss_restoreHistory(aWindow, aTabs, aTabData, aIdMap, aDocIdentMap) {
    var _this = this;
    // if the tab got removed before being completely restored, then skip it
    while (aTabs.length > 0 && (!aTabs[0].parentNode || !aTabs[0].linkedBrowser ||
                                !aTabs[0].linkedBrowser.__SS_tabStillLoading)) {
      aTabs.shift();
      aTabData.shift();
    }
    if (aTabs.length == 0) {
      // At this point we're essentially ready for consumers to read/write data
      // via the sessionstore API so we'll send the SSWindowStateReady event.
      this._sendWindowStateEvent(aWindow, "Ready");
      return; // no more tabs to restore
    }

    var tab = aTabs.shift();
    var tabData = aTabData.shift();

    var browser = aWindow.getBrowser().getBrowserForTab(tab);
    var history = browser.webNavigation.sessionHistory;

    if (history.count > 0) {
      history.PurgeHistory(history.count);
    }
    history.QueryInterface(Components.interfaces.nsISHistoryInternal);

    browser.__SS_shistoryListener = new SessionStoreSHistoryListener(this, tab);
    history.addSHistoryListener(browser.__SS_shistoryListener);

    if (!tabData.entries) {
      tabData.entries = [];
    }
    if (tabData.extData) {
      tab.__SS_extdata = {};
      for (let key in tabData.extData)
        tab.__SS_extdata[key] = tabData.extData[key];
    }
    else
      delete tab.__SS_extdata;

    for (var i = 0; i < tabData.entries.length; i++) {
      //XXXzpao Wallpaper patch for bug 509315
      if (!tabData.entries[i].url)
        continue;
      history.addEntry(this._deserializeHistoryEntry(tabData.entries[i],
                                                     aIdMap, aDocIdentMap), true);
    }

    // make sure to reset the capabilities and attributes, in case this tab gets reused
    var disallow = (tabData.disallow)?tabData.disallow.split(","):[];
    CAPABILITIES.forEach(function(aCapability) {
      browser.docShell["allow" + aCapability] = disallow.indexOf(aCapability) == -1;
    });
    for (let name in this.xulAttributes)
      tab.removeAttribute(name);
    for (let name in tabData.attributes)
      tab.setAttribute(name, tabData.attributes[name]);

    if (tabData.storage && browser.docShell instanceof Components.interfaces.nsIDocShell)
      this._deserializeSessionStorage(tabData.storage, browser.docShell);

    // notify the tabbrowser that the tab chrome has been restored
    var event = aWindow.document.createEvent("Events");
    event.initEvent("SSTabRestoring", true, false);
    tab.dispatchEvent(event);

    // Restore the history in the next tab
    aWindow.setTimeout(function(){
      _this.restoreHistory(aWindow, aTabs, aTabData, aIdMap, aDocIdentMap);
    }, 0);

    // This could cause us to ignore the max_concurrent_tabs pref a bit, but
    // it ensures each window will have its selected tab loaded.
    if (aWindow.getBrowser().selectedBrowser == browser) {
      this.restoreTab(tab);
    }
    else {
      // Put the tab into the right bucket
      if (tabData.hidden)
        this._tabsToRestore.hidden.push(tab);
      else
        this._tabsToRestore.visible.push(tab);
      this.restoreNextTab();
    }
  },

  /**
   * Restores the specified tab. If the tab can't be restored (eg, no history or
   * calling gotoIndex fails), then state changes will be rolled back.
   * This method will check if gTabsProgressListener is attached to the tab's
   * window, ensuring that we don't get caught without one.
   * This method removes the session history listener right before starting to
   * attempt a load. This will prevent cases of "stuck" listeners.
   * If this method returns false, then it is up to the caller to decide what to
   * do. In the common case (restoreNextTab), we will want to then attempt to
   * restore the next tab. In the other case (selecting the tab, reloading the
   * tab), the caller doesn't actually want to do anything if no page is loaded.
   *
   * @param aTab
   *        the tab to restore
   *
   * @returns true/false indicating whether or not a load actually happened
   */
  restoreTab: function sss_restoreTab(aTab) {
    let window = aTab.ownerDocument.defaultView;
    let browser = aTab.linkedBrowser;
    let tabData = browser.__SS_data;

    // There are cases within where we haven't actually started a load. In that
    // that case we'll reset state changes we made and return false to the caller
    // can handle appropriately.
    let didStartLoad = false;

    // Make sure that the tabs progress listener is attached to this window
    this._ensureTabsProgressListener(window);

    // Make sure that this tab is removed from _tabsToRestore
    this._removeTabFromTabsToRestore(aTab);

    // Increase our internal count.
    this._tabsRestoringCount++;

    // Set this tab's state to restoring
    browser.__SS_restoreState = TAB_STATE_RESTORING;

    // Remove the history listener, since we no longer need it once we start restoring
    this._removeSHistoryListener(aTab);

    let activeIndex = (tabData.index || tabData.entries.length) - 1;
    if (activeIndex >= tabData.entries.length)
      activeIndex = tabData.entries.length - 1;

    // Reset currentURI.
    browser.webNavigation.setCurrentURI(this._getURIFromString("about:blank"));

    // Attach data that will be restored on "load" event, after tab is restored.
    if (activeIndex > -1) {
      let curSHEntry = browser.webNavigation.sessionHistory
                              .getEntryAtIndex(activeIndex, false)
                              .QueryInterface(Components.interfaces.nsISHEntry);

      // restore those aspects of the currently active documents which are not
      // preserved in the plain history entries (mainly scroll state and text data)
      browser.__SS_restore_data = tabData.entries[activeIndex] || {};
      browser.__SS_restore_pageStyle = tabData.pageStyle || "";
      browser.__SS_restore_tab = aTab;

      didStartLoad = true;
      try {
        // In order to work around certain issues in session history, we need to
        // force session history to update its internal index and call reload
        // instead of gotoIndex. See bug 597315.
        var sessionHistory = browser.webNavigation.sessionHistory;
        sessionHistory.getEntryAtIndex(activeIndex, true);
        sessionHistory.reloadCurrentEntry();
      }
      catch (ex) {
        // ignore page load errors
        aTab.removeAttribute("busy");
        didStartLoad = false;
      }
    }

    // Handle userTypedValue. Setting userTypedValue seems to update gURLbar
    // as needed. Calling loadURI will cancel form filling in restoreDocument
    if (tabData.userTypedValue) {
      browser.userTypedValue = tabData.userTypedValue;
      if (tabData.userTypedClear) {
        // Make it so that we'll enter restoreDocument on page load. We will
        // fire SSTabRestored from there. We don't have any form data to restore
        // so we can just set the URL to null.
        browser.__SS_restore_data = { url: null };
        browser.__SS_restore_tab = aTab;
        didStartLoad = true;
        browser.loadURI(tabData.userTypedValue, null, null, true);
      }
    }

    // If we didn't start a load, then we won't reset this tab through the usual
    // channel (via the progress listener), so reset the tab ourselves. We will
    // also send SSTabRestored since this tab has technically been restored.
    if (!didStartLoad) {
      this._sendTabRestoredNotification(aTab);
      this._resetTabRestoringState(aTab);
    }

    return didStartLoad;
  },

  /**
   * This _attempts_ to restore the next available tab. If the restore fails,
   * then we will attempt the next one.
   * There are conditions where this won't do anything:
   *   if we're in the process of quitting
   *   if there are no tabs to restore
   *   if we have already reached the limit for number of tabs to restore
   */
  restoreNextTab: function sss_restoreNextTab() {
    // If we call in here while quitting, we don't actually want to do anything
    if (this._loadState == STATE_QUITTING)
      return;

    // If it's not possible to restore anything, then just bail out.
    if (this._maxConcurrentTabRestores >= 0 &&
        this._tabsRestoringCount >= this._maxConcurrentTabRestores)
      return;

    // Look in visible, then hidden
    let nextTabArray;
    if (this._tabsToRestore.visible.length) {
      nextTabArray = this._tabsToRestore.visible;
    }
    else if (this._tabsToRestore.hidden.length) {
      nextTabArray = this._tabsToRestore.hidden;
    }

    if (nextTabArray) {
      let tab = nextTabArray.shift();
      let didStartLoad = this.restoreTab(tab);
      // If we don't start a load in the restored tab (eg, no entries) then we
      // want to attempt to restore the next tab.
      if (!didStartLoad)
        this.restoreNextTab();
    }
  },

  /**
   * expands serialized history data into a session-history-entry instance
   * @param aEntry
   *        Object containing serialized history data for a URL
   * @param aIdMap
   *        Hash for ensuring unique frame IDs
   * @returns nsISHEntry
   */
  _deserializeHistoryEntry:
    function sss_deserializeHistoryEntry(aEntry, aIdMap, aDocIdentMap) {

    var shEntry = Components.classes["@mozilla.org/browser/session-history-entry;1"]
                            .createInstance(Components.interfaces.nsISHEntry);

    shEntry.setURI(this._getURIFromString(aEntry.url));
    shEntry.setTitle(aEntry.title || aEntry.url);
    if (aEntry.subframe)
      shEntry.setIsSubFrame(aEntry.subframe || false);
    shEntry.loadType = Components.interfaces.nsIDocShellLoadInfo.loadHistory;
    if (aEntry.contentType)
      shEntry.contentType = aEntry.contentType;
    if (aEntry.referrer)
      shEntry.referrerURI = this._getURIFromString(aEntry.referrer);

    if (aEntry.cacheKey) {
      var cacheKey = Components.classes["@mozilla.org/supports-PRUint32;1"]
                               .createInstance(Components.interfaces.nsISupportsPRUint32);
      cacheKey.data = aEntry.cacheKey;
      shEntry.cacheKey = cacheKey;
    }

    if (aEntry.ID) {
      // get a new unique ID for this frame (since the one from the last
      // start might already be in use)
      var id = aIdMap[aEntry.ID] || 0;
      if (!id) {
        for (id = Date.now(); id in aIdMap.used; id++);
        aIdMap[aEntry.ID] = id;
        aIdMap.used[id] = true;
      }
      shEntry.ID = id;
    }

    if (aEntry.docshellID)
      shEntry.docshellID = aEntry.docshellID;

    if (aEntry.structuredCloneState && aEntry.structuredCloneVersion) {
      shEntry.stateData =
        Components.classes["@mozilla.org/docshell/structured-clone-container;1"]
                  .createInstance(Components.interfaces.nsIStructuredCloneContainer);

      shEntry.stateData.initFromBase64(aEntry.structuredCloneState,
                                       aEntry.structuredCloneVersion);
    }

    if (aEntry.scroll) {
      var scrollPos = (aEntry.scroll || "0,0").split(",");
      scrollPos = [parseInt(scrollPos[0]) || 0, parseInt(scrollPos[1]) || 0];
      shEntry.setScrollPosition(scrollPos[0], scrollPos[1]);
    }

    if (aEntry.postdata_b64) {
      var postdata = atob(aEntry.postdata_b64);
      var stream = Components.classes["@mozilla.org/io/string-input-stream;1"]
                             .createInstance(Components.interfaces.nsIStringInputStream);
      stream.setData(postdata, postdata.length);
      shEntry.postData = stream;
    }

    let childDocIdents = {};
    if (aEntry.docIdentifier) {
      // If we have a serialized document identifier, try to find an SHEntry
      // which matches that doc identifier and adopt that SHEntry's
      // BFCacheEntry.  If we don't find a match, insert shEntry as the match
      // for the document identifier.
      let matchingEntry = aDocIdentMap[aEntry.docIdentifier];
      if (!matchingEntry) {
        matchingEntry = {shEntry: shEntry, childDocIdents: childDocIdents};
        aDocIdentMap[aEntry.docIdentifier] = matchingEntry;
      }
      else {
        shEntry.adoptBFCacheEntry(matchingEntry.shEntry);
        childDocIdents = matchingEntry.childDocIdents;
      }
    }

    if (aEntry.owner_b64) {
      var ownerInput = Components.classes["@mozilla.org/io/string-input-stream;1"]
                                 .createInstance(Components.interfaces.nsIStringInputStream);
      var binaryData = atob(aEntry.owner_b64);
      ownerInput.setData(binaryData, binaryData.length);
      var binaryStream = Components.classes["@mozilla.org/binaryinputstream;1"]
                                   .createInstance(Components.interfaces.nsIObjectInputStream);
      binaryStream.setInputStream(ownerInput);
      try { // Catch possible deserialization exceptions
        shEntry.owner = binaryStream.readObject(true);
      } catch (ex) { debug(ex); }
    }

    if (aEntry.children && shEntry instanceof Components.interfaces.nsISHContainer) {
      for (var i = 0; i < aEntry.children.length; i++) {
        //XXXzpao Wallpaper patch for bug 509315
        if (!aEntry.children[i].url)
          continue;

        // We're mysteriously getting sessionrestore.js files with a cycle in
        // the doc-identifier graph.  (That is, we have an entry where doc
        // identifier A is an ancestor of doc identifier B, and another entry
        // where doc identifier B is an ancestor of A.)
        //
        // If we were to respect these doc identifiers, we'd create a cycle in
        // the SHEntries themselves, which causes the docshell to loop forever
        // when it looks for the root SHEntry.
        //
        // So as a hack to fix this, we restrict the scope of a doc identifier
        // to be a node's siblings and cousins, and pass childDocIdents, not
        // aDocIdents, to _deserializeHistoryEntry.  That is, we say that two
        // SHEntries with the same doc identifier have the same document iff
        // they have the same parent or their parents have the same document.

        shEntry.AddChild(this._deserializeHistoryEntry(aEntry.children[i], aIdMap,
                                                       childDocIdents), i);
      }
    }

    return shEntry;
  },

  /**
   * restores all sessionStorage "super cookies"
   * @param aStorageData
   *        Storage data to be restored
   * @param aDocShell
   *        A tab's docshell (containing the sessionStorage)
   */
  _deserializeSessionStorage: function sss_deserializeSessionStorage(aStorageData, aDocShell) {
    for (let url in aStorageData) {
      let uri = this._getURIFromString(url);
      let principal = SecMan.getDocShellCodebasePrincipal(uri, aDocShell);
      let storage = aDocShell.getSessionStorageForPrincipal(principal, "", true);
      for (let key in aStorageData[url]) {
        try {
          storage.setItem(key, aStorageData[url][key]);
        }
        catch (ex) { Components.utils.reportError(ex); } // throws e.g. for URIs that can't have sessionStorage
      }
    }
  },

  /**
   * Restore properties to a loaded document
   */
  restoreDocument: function sss_restoreDocument(aWindow, aBrowser, aEvent) {
    // wait for the top frame to be loaded completely
    if (!aEvent || !aEvent.originalTarget || !aEvent.originalTarget.defaultView || aEvent.originalTarget.defaultView != aEvent.originalTarget.defaultView.top) {
      return;
    }

    // always call this before injecting content into a document!
    function hasExpectedURL(aDocument, aURL)
      !aURL || aURL.replace(/#.*/, "") == aDocument.location.href.replace(/#.*/, "");

    function restoreFormData(aDocument, aData, aURL) {
      for (let key in aData) {
        if (!hasExpectedURL(aDocument, aURL))
          return;

        let node = key.charAt(0) == "#" ? aDocument.getElementById(key.slice(1)) :
                                          XPathHelper.resolve(aDocument, key);
        if (!node)
          continue;

        let eventType;
        let value = aData[key];
        if (typeof value == "string" && node.type != "file") {
          if (node.value == value)
            continue; // don't dispatch an input event for no change

          node.value = value;
          eventType = "input";
        }
        else if (typeof value == "boolean") {
          if (node.checked == value)
            continue; // don't dispatch a change event for no change

          node.checked = value;
          eventType = "change";
        }
        else if (typeof value == "number") {
          // We saved the value blindly since selects take more work to determine
          // default values. So now we should check to avoid unnecessary events.
          if (node.selectedIndex == value)
            continue;

          try {
            node.selectedIndex = value;
            eventType = "change";
          } catch (ex) { /* throws for invalid indices */ }
        }
        else if (value && value.fileList && value.type == "file" && node.type == "file") {
          node.mozSetFileNameArray(value.fileList, value.fileList.length);
          eventType = "input";
        }
        else if (value && typeof value.indexOf == "function" && node.options) {
          Array.forEach(node.options, function(aOpt, aIx) {
            aOpt.selected = value.indexOf(aIx) > -1;

            // Only fire the event here if this wasn't selected by default
            if (!aOpt.defaultSelected)
              eventType = "change";
          });
        }

        // Fire events for this node if applicable
        if (eventType) {
          let event = aDocument.createEvent("UIEvents");
          event.initUIEvent(eventType, true, true, aDocument.defaultView, 0);
          node.dispatchEvent(event);
        }
      }
    }

    let selectedPageStyle = aBrowser.__SS_restore_pageStyle;
    function restoreTextDataAndScrolling(aContent, aData, aPrefix) {
      if (aData.formdata)
        restoreFormData(aContent.document, aData.formdata, aData.url);
      if (aData.innerHTML) {
        aWindow.setTimeout(function() {
          if (aContent.document.designMode == "on" &&
              hasExpectedURL(aContent.document, aData.url)) {
            aContent.document.body.innerHTML = aData.innerHTML;
          }
        }, 0);
      }
      var match;
      if (aData.scroll && (match = /(\d+),(\d+)/.exec(aData.scroll)) != null) {
        aContent.scrollTo(match[1], match[2]);
      }
      Array.forEach(aContent.document.styleSheets, function(aSS) {
        aSS.disabled = aSS.title && aSS.title != selectedPageStyle;
      });
      for (var i = 0; i < aContent.frames.length; i++) {
        if (aData.children && aData.children[i] &&
          hasExpectedURL(aContent.document, aData.url)) {
          restoreTextDataAndScrolling(aContent.frames[i], aData.children[i], aPrefix + i + "|");
        }
      }
    }

    // don't restore text data and scrolling state if the user has navigated
    // away before the loading completed (except for in-page navigation)
    if (hasExpectedURL(aEvent.originalTarget, aBrowser.__SS_restore_data.url)) {
      var content = aEvent.originalTarget.defaultView;
      restoreTextDataAndScrolling(content, aBrowser.__SS_restore_data, "");
      aBrowser.markupDocumentViewer.authorStyleDisabled = selectedPageStyle == "_nostyle";
    }

    // notify the tabbrowser that this document has been completely restored
    this._sendTabRestoredNotification(aBrowser.__SS_restore_tab);

    delete aBrowser.__SS_restore_data;
    delete aBrowser.__SS_restore_pageStyle;
    delete aBrowser.__SS_restore_tab;
  },

  /**
   * Restore visibility and dimension features to a window
   * @param aWindow
   *        Window reference
   * @param aWinData
   *        Object containing session data for the window
   */
  restoreWindowFeatures: function sss_restoreWindowFeatures(aWindow, aWinData) {
    var hidden = (aWinData.hidden)?aWinData.hidden.split(","):[];
    WINDOW_HIDEABLE_FEATURES.forEach(function(aItem) {
      aWindow[aItem].visible = hidden.indexOf(aItem) == -1;
    });

    if (aWinData.isPopup)
      this._windows[aWindow.__SSi].isPopup = true;
    else
      delete this._windows[aWindow.__SSi].isPopup;

    var _this = this;
    aWindow.setTimeout(function() {
      _this.restoreDimensions.apply(_this, [aWindow,
        +aWinData.width || 0,
        +aWinData.height || 0,
        "screenX" in aWinData ? +aWinData.screenX : NaN,
        "screenY" in aWinData ? +aWinData.screenY : NaN,
        aWinData.sizemode || "", aWinData.sidebar || ""]);
    }, 0);
  },

  /**
   * Restore a window's dimensions
   * @param aWidth
   *        Window width
   * @param aHeight
   *        Window height
   * @param aLeft
   *        Window left
   * @param aTop
   *        Window top
   * @param aSizeMode
   *        Window size mode (eg: maximized)
   * @param aSidebar
   *        Sidebar command
   */
  restoreDimensions: function sss_restoreDimensions(aWindow, aWidth, aHeight, aLeft, aTop, aSizeMode, aSidebar) {
    var win = aWindow;
    var _this = this;
    function win_(aName) { return _this._getWindowDimension(win, aName); }

    // find available space on the screen where this window is being placed
    let screen = gScreenManager.screenForRect(aLeft, aTop, aWidth, aHeight);
    if (screen) {
      let screenLeft = {}, screenTop = {}, screenWidth = {}, screenHeight = {};
      screen.GetAvailRectDisplayPix(screenLeft, screenTop, screenWidth, screenHeight);
      // constrain the dimensions to the actual space available
      if (aWidth > screenWidth.value) {
        aWidth = screenWidth.value;
      }
      if (aHeight > screenHeight.value) {
        aHeight = screenHeight.value;
      }
      // and then pull the window within the screen's bounds
      if (aLeft < screenLeft.value) {
        aLeft = screenLeft.value;
      } else if (aLeft + aWidth > screenLeft.value + screenWidth.value) {
        aLeft = screenLeft.value + screenWidth.value - aWidth;
      }
      if (aTop < screenTop.value) {
        aTop = screenTop.value;
      } else if (aTop + aHeight > screenTop.value + screenHeight.value) {
        aTop = screenTop.value + screenHeight.value - aHeight;
      }
    }
 
    // only modify those aspects which aren't correct yet
    if (aWidth && aHeight && (aWidth != win_("width") || aHeight != win_("height"))) {
      aWindow.resizeTo(aWidth, aHeight);
    }
    if (!isNaN(aLeft) && !isNaN(aTop) && (aLeft != win_("screenX") || aTop != win_("screenY"))) {
      aWindow.moveTo(aLeft, aTop);
    }
    if (aSizeMode && win_("sizemode") != aSizeMode)
    {
      switch (aSizeMode)
      {
      case "maximized":
        aWindow.maximize();
        break;
      case "minimized":
        aWindow.minimize();
        break;
      case "normal":
        aWindow.restore();
        break;
      }
    }
    var sidebar = aWindow.document.getElementById("sidebar-box");
    if (sidebar.getAttribute("sidebarcommand") != aSidebar) {
      aWindow.toggleSidebar(aSidebar);
    }
    // since resizing/moving a window brings it to the foreground,
    // we might want to re-focus the last focused window
    if (this.windowToFocus && this.windowToFocus.content) {
      this.windowToFocus.content.focus();
    }
  },

  /**
   * Restores cookies
   * @param aCookies
   *        Array of cookie objects
   */
  restoreCookies: function sss_restoreCookies(aCookies) {
    // MAX_EXPIRY should be 2^63-1, but JavaScript can't handle that precision
    var MAX_EXPIRY = Math.pow(2, 62);
    for (let i = 0; i < aCookies.length; i++) {
      var cookie = aCookies[i];
      try {
        Services.cookies.add(cookie.host, cookie.path || "", cookie.name || "",
                             cookie.value, !!cookie.secure, !!cookie.httponly,
                             true,
                             "expiry" in cookie ? cookie.expiry : MAX_EXPIRY);
      }
      catch (ex) { Components.utils.reportError(ex); } // don't let a single cookie stop recovering
    }
  },

/* ........ Disk Access .............. */

  /**
   * save state delayed by N ms
   * marks window as dirty (i.e. data update can't be skipped)
   * @param aWindow
   *        Window reference
   * @param aDelay
   *        Milliseconds to delay
   */
  saveStateDelayed: function sss_saveStateDelayed(aWindow, aDelay) {
    if (aWindow) {
      this._dirtyWindows[aWindow.__SSi] = true;
    }

    if (!this._saveTimer && this._resume_from_crash) {
      // interval until the next disk operation is allowed
      var minimalDelay = this._lastSaveTime + this._interval - Date.now();

      // if we have to wait, set a timer, otherwise saveState directly
      aDelay = Math.max(minimalDelay, aDelay || 2000);
      if (aDelay > 0) {
        this._saveTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
        this._saveTimer.init(this, aDelay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
      }
      else {
        this.saveState();
      }
    }
  },

  /**
   * save state to disk
   * @param aUpdateAll
   *        Bool update all windows
   */
  saveState: function sss_saveState(aUpdateAll) {
    // if crash recovery is disabled, only save session resuming information
    if (!this._resume_from_crash && this._loadState == STATE_RUNNING)
      return;

    // If crash recovery is disabled, we only want to resume with pinned tabs
    // if we crash.
    let pinnedOnly = this._loadState == STATE_RUNNING && !this._resume_from_crash;

    var oState = this._getCurrentState(aUpdateAll);
    if (!oState)
      return;

    this._saveStateObject(oState);
  },

  /**
   * write a state object to disk
   */
  _saveStateObject: function sss_saveStateObject(aStateObj) {
    var stateString = Components.classes["@mozilla.org/supports-string;1"]
                                .createInstance(Components.interfaces.nsISupportsString);
    // parentheses are for backwards compatibility with older sessionstore files
    stateString.data = this._toJSONString(aStateObj);

    Services.obs.notifyObservers(stateString, "sessionstore-state-write", "");

    // don't touch the file if an observer has deleted all state data
    if (stateString.data)
      this._writeFile(this._sessionFile, stateString.data);

    this._lastSaveTime = Date.now();
  },

  /**
   * delete session datafile and backup
   */
  _clearDisk: function sss_clearDisk() {
    if (this._sessionFile.exists()) {
      try {
        this._sessionFile.remove(false);
      }
      catch (ex) { dump(ex + '\n'); } // couldn't remove the file - what now?
    }
    if (this._sessionFileBackup.exists()) {
      try {
        this._sessionFileBackup.remove(false);
      }
      catch (ex) { dump(ex + '\n'); } // couldn't remove the file - what now?
    }
  },

/* ........ Auxiliary Functions .............. */

  /**
   * call a callback for all currently opened browser windows
   * (might miss the most recent one)
   * @param aFunc
   *        Callback each window is passed to
   */
  _forEachBrowserWindow: function sss_forEachBrowserWindow(aFunc) {
    var windowsEnum = Services.wm.getEnumerator("navigator:browser");

    while (windowsEnum.hasMoreElements()) {
      var window = windowsEnum.getNext();
      if (!window.closed && window.__SSi) {
        aFunc.call(this, window);
      }
    }
  },

  /**
   * Returns most recent window
   * @returns Window reference
   */
  _getMostRecentBrowserWindow: function sss_getMostRecentBrowserWindow() {
    var win = Services.wm.getMostRecentWindow("navigator:browser");
    if (!win)
      return null;
    if (!win.closed)
      return win;

#ifdef BROKEN_WM_Z_ORDER
    win = null;
    var windowsEnum = Services.wm.getEnumerator("navigator:browser");
    // this is oldest to newest, so this gets a bit ugly
    while (windowsEnum.hasMoreElements()) {
      let nextWin = windowsEnum.getNext();
      if (!nextWin.closed)
        win = nextWin;
    }
    return win;
#else
    var windowsEnum =
      Services.wm.getZOrderDOMWindowEnumerator("navigator:browser", true);
    while (windowsEnum.hasMoreElements()) {
      win = windowsEnum.getNext();
      if (!win.closed)
        return win;
    }
    return null;
#endif
  },

  /**
   * Calls onClose for windows that are determined to be closed but aren't
   * destroyed yet, which would otherwise cause getBrowserState and
   * setBrowserState to treat them as open windows.
   */
  _handleClosedWindows: function sss_handleClosedWindows() {
    var windowsEnum = Services.wm.getEnumerator("navigator:browser");

    while (windowsEnum.hasMoreElements()) {
      var window = windowsEnum.getNext();
      if (window.closed) {
        this.onClose(window);
      }
    }
  },

  /**
   * open a new browser window for a given session state
   * called when restoring a multi-window session
   * @param aState
   *        Object containing session data
   */
  _openWindowWithState: function sss_openWindowWithState(aState) {
    var argString = Components.classes["@mozilla.org/supports-string;1"]
                              .createInstance(Components.interfaces.nsISupportsString);
    argString.data = "about:blank";

    var features = "chrome,dialog=no,macsuppressanimation,all";
    var winState = aState.windows[0];
    for (var aAttr in WINDOW_ATTRIBUTES) {
      // Use !isNaN as an easy way to ignore sizemode and check for numbers
      if (aAttr in winState && !isNaN(winState[aAttr]))
        features += "," + WINDOW_ATTRIBUTES[aAttr] + "=" + winState[aAttr];
    }

    var window =
      Services.ww.openWindow(null, this._prefBranch.getCharPref("chromeURL"),
                             "_blank", features, argString);

    do {
      var ID = "window" + Math.random();
    } while (ID in this._statesToRestore);
    this._statesToRestore[(window.__SS_restoreID = ID)] = aState;

    return window;
  },

  /**
   * Gets the tab for the given browser. This should be marginally better
   * than using tabbrowser's getTabForContentWindow. This assumes the browser
   * is the linkedBrowser of a tab, not a dangling browser.
   *
   * @param aBrowser
   *        The browser from which to get the tab.
   */
  _getTabForBrowser: function sss_getTabForBrowser(aBrowser) {
    let windowTabs = aBrowser.ownerDocument.defaultView.getBrowser().tabs;
    for (let i = 0; i < windowTabs.length; i++) {
      let tab = windowTabs[i];
      if (tab.linkedBrowser == aBrowser)
        return tab;
    }
  },

  /**
   * Whether or not to resume session, if not recovering from a crash.
   * @returns bool
   */
  _doResumeSession: function sss_doResumeSession() {
    return this._prefBranch.getIntPref("startup.page") == 3 ||
      this._prefBranch.getBoolPref("sessionstore.resume_session_once");
  },

  /**
   * Are we restarting to switch profile.
   * @returns bool
   */
  _isSwitchingProfile: function sss_isSwitchingProfile() {
    var env = Components.classes["@mozilla.org/process/environment;1"]
                        .getService(Components.interfaces.nsIEnvironment);
    return env.exists("XRE_PROFILE_NAME");
  },

  /**
   * whether the user wants to load any other page at startup
   * (except the homepage) - needed for determining whether to overwrite the current tabs
   * C.f.: nsBrowserContentHandler's defaultArgs implementation.
   * @returns bool
   */
  _isCmdLineEmpty: function sss_isCmdLineEmpty(aWindow) {
    return "arguments" in aWindow && aWindow.arguments.length &&
      aWindow.arguments[0] == "about:blank";
  },

  /**
   * don't save sensitive data if the user doesn't want to
   * (distinguishes between encrypted and non-encrypted sites)
   * @param aIsHTTPS
   *        Bool is encrypted
   * @param aUseDefaultPref
   *        don't do normal check for deferred
   * @returns bool
   */
  _checkPrivacyLevel: function sss_checkPrivacyLevel(aIsHTTPS, aUseDefaultPref) {
    let pref = "sessionstore.privacy_level";
    // If we're in the process of quitting and we're not autoresuming the session
    // then we should treat it as a deferred session. We have a different privacy
    // pref for that case.
    if (!aUseDefaultPref && this._loadState == STATE_QUITTING && !this._doResumeSession())
      pref = "sessionstore.privacy_level_deferred";
    return this._prefBranch.getIntPref(pref) < (aIsHTTPS ? PRIVACY_ENCRYPTED : PRIVACY_FULL);
  },

  /**
   * on popup windows, the XULWindow's attributes seem not to be set correctly
   * we use thus JSDOMWindow attributes for sizemode and normal window attributes
   * (and hope for reasonable values when maximized/minimized - since then
   * outerWidth/outerHeight aren't the dimensions of the restored window)
   * @param aWindow
   *        Window reference
   * @param aAttribute
   *        String sizemode | width | height | other window attribute
   * @returns string
   */
  _getWindowDimension: function sss_getWindowDimension(aWindow, aAttribute) {
    var dimension = aWindow[WINDOW_ATTRIBUTES[aAttribute]];
    if (aAttribute == "sizemode") {
      switch (dimension) {
      case aWindow.STATE_MAXIMIZED:
        return "maximized";
      case aWindow.STATE_MINIMIZED:
        return "minimized";
      default:
        return "normal";
      }
    }

    if (aWindow.windowState == aWindow.STATE_NORMAL) {
      return dimension;
    }
    return aWindow.document.documentElement.getAttribute(aAttribute) || dimension;
  },

  /**
   * Get nsIURI from string
   * @param string
   * @returns nsIURI
   */
  _getURIFromString: function sss_getURIFromString(aString) {
    return Services.io.newURI(aString, null, null);
  },

  /**
   * Annotate a breakpad crash report with the currently selected tab's URL.
   */
  _updateCrashReportURL: function sss_updateCrashReportURL(aWindow) {
#ifdef MOZ_CRASH_REPORTER
    try {
      var currentURI = aWindow.getBrowser().currentURI.clone();
      // if the current URI contains a username/password, remove it
      try {
        currentURI.userPass = "";
      }
      catch (ex) { } // ignore failures on about: URIs

      CrashReporter.annotateCrashReport("URL", currentURI.spec);
    }
    catch (ex) {
      // don't make noise when crashreporter is built but not enabled
      if (ex.result != Components.results.NS_ERROR_NOT_INITIALIZED)
        debug(ex);
    }
#endif
  },

  /**
   * @param aState is a session state
   * @param aRecentCrashes is the number of consecutive crashes
   * @returns whether a restore page will be needed for the session state
   */
  _needsRestorePage: function sss_needsRestorePage(aState, aRecentCrashes) {
    const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000;

    // don't display the page when there's nothing to restore
    if (!aState.windows || !aState.windows.length)
      return false;

    // don't wrap a single about:sessionrestore page
    let winData = aState.windows;
    if (winData.length == 1 && winData[0].tabs &&
        winData[0].tabs.length == 1 && winData[0].tabs[0].entries &&
        winData[0].tabs[0].entries.length == 1 &&
        winData[0].tabs[0].entries[0].url == "about:sessionrestore")
      return false;

    // don't automatically restore in Safe Mode
    if (Services.appinfo.inSafeMode)
      return true;

    let max_resumed_crashes =
      this._prefBranch.getIntPref("sessionstore.max_resumed_crashes");
    let sessionAge = aState.session && aState.session.lastUpdate &&
                     (Date.now() - aState.session.lastUpdate);

    return max_resumed_crashes != -1 &&
           (aRecentCrashes > max_resumed_crashes ||
            sessionAge && sessionAge >= SIX_HOURS_IN_MS);
  },

  /**
   * Determine if the tab state we're passed is something we should save. This
   * is used when closing a tab or closing a window with a single tab
   *
   * @param aTabState
   *        The current tab state
   * @returns boolean
   */
  _shouldSaveTabState: function sss__shouldSaveTabState(aTabState) {
    // If the tab has only the transient about:blank history entry, no other
    // session history, and no userTypedValue, then we don't actually want to
    // store this tab's data.
    return aTabState.entries.length &&
           !(aTabState.entries.length == 1 &&
             aTabState.entries[0].url == "about:blank" &&
             !aTabState.userTypedValue);
  },

  /**
   * This is going to take a state as provided at startup (via
   * nsISessionStartup.state) and split it into 2 parts. The first part
   * (defaultState) will be a state that should still be restored at startup,
   * while the second part (state) is a state that should be saved for later.
   * defaultState will be comprised of windows with only pinned tabs, extracted
   * from state. It will contain the cookies that go along with the history
   * entries in those tabs. It will also contain window position information.
   *
   * defaultState will be restored at startup. state will be placed into
   * this._lastSessionState and will be kept in case the user explicitly wants
   * to restore the previous session (publicly exposed as restoreLastSession).
   *
   * @param state
   *        The state, presumably from nsISessionStartup.state
   * @returns [defaultState, state]
   */
  _prepDataForDeferredRestore: function sss__prepDataForDeferredRestore(state) {
    let defaultState = { windows: [], selectedWindow: 1 };

    state.selectedWindow = state.selectedWindow || 1;

    // Look at each window, remove pinned tabs, adjust selectedindex,
    // remove window if necessary.
    for (let wIndex = 0; wIndex < state.windows.length;) {
      let window = state.windows[wIndex];
      window.selected = window.selected || 1;
      // We're going to put the state of the window into this object
      let pinnedWindowState = { tabs: [], cookies: []};
      for (let tIndex = 0; tIndex < window.tabs.length;) {
        if (window.tabs[tIndex].pinned) {
          // Adjust window.selected
          if (tIndex + 1 < window.selected)
            window.selected -= 1;
          else if (tIndex + 1 == window.selected)
            pinnedWindowState.selected = pinnedWindowState.tabs.length + 2;
            // + 2 because the tab isn't actually in the array yet

          // Now add the pinned tab to our window
          pinnedWindowState.tabs =
            pinnedWindowState.tabs.concat(window.tabs.splice(tIndex, 1));
          // We don't want to increment tIndex here.
          continue;
        }
        tIndex++;
      }

      // At this point the window in the state object has been modified (or not)
      // We want to build the rest of this new window object if we have pinnedTabs.
      if (pinnedWindowState.tabs.length) {
        // First get the other attributes off the window
        WINDOW_ATTRIBUTES.forEach(function(attr) {
          if (attr in window) {
            pinnedWindowState[attr] = window[attr];
            delete window[attr];
          }
        });
        // We're just copying position data into the pinned window.
        // Not copying over:
        // - _closedTabs
        // - extData
        // - isPopup
        // - hidden

        // Assign a unique ID to correlate the window to be opened with the
        // remaining data
        window.__lastSessionWindowID = pinnedWindowState.__lastSessionWindowID
                                     = "" + Date.now() + Math.random();

        // Extract the cookies that belong with each pinned tab
        this._splitCookiesFromWindow(window, pinnedWindowState);

        // Actually add this window to our defaultState
        defaultState.windows.push(pinnedWindowState);
        // Remove the window from the state if it doesn't have any tabs
        if (!window.tabs.length) {
         if (wIndex + 1 <= state.selectedWindow)
            state.selectedWindow -= 1;
          else if (wIndex + 1 == state.selectedWindow)
            defaultState.selectedIndex = defaultState.windows.length + 1;

          state.windows.splice(wIndex, 1);
          // We don't want to increment wIndex here.
          continue;
        }


      }
      wIndex++;
    }

    return [defaultState, state];
  },

  /**
   * Splits out the cookies from aWinState into aTargetWinState based on the
   * tabs that are in aTargetWinState.
   * This alters the state of aWinState and aTargetWinState.
   */
  _splitCookiesFromWindow:
    function sss_splitCookiesFromWindow(aWinState, aTargetWinState) {
    if (!aWinState.cookies || !aWinState.cookies.length)
      return;

    // Get the hosts for history entries in aTargetWinState
    let cookieHosts = {};
    aTargetWinState.tabs.forEach(function(tab) {
      tab.entries.forEach(function(entry) {
        this._extractHostsForCookiesFromEntry(entry, cookieHosts, false);
      }, this);
    }, this);

    // By creating a regex we reduce overhead and there is only one loop pass
    // through either array (cookieHosts and aWinState.cookies).
    let hosts = Object.keys(cookieHosts).join("|").replace("\\.", "\\.", "g");
    let cookieRegex = new RegExp(".*(" + hosts + ")");
    for (let cIndex = 0; cIndex < aWinState.cookies.length;) {
      if (cookieRegex.test(aWinState.cookies[cIndex].host)) {
        aTargetWinState.cookies =
          aTargetWinState.cookies.concat(aWinState.cookies.splice(cIndex, 1));
        continue;
      }
      cIndex++;
    }
  },

  /**
   * Converts a JavaScript object into a JSON string
   * (see http://www.json.org/ for more information).
   *
   * The inverse operation consists of JSON.parse(JSON_string).
   *
   * @param aJSObject is the object to be converted
   * @returns the object's JSON representation
   */
  _toJSONString: function sss_toJSONString(aJSObject) {
    return JSON.stringify(aJSObject);
  },

  _sendRestoreCompletedNotifications: function sss_sendRestoreCompletedNotifications() {
    if (this._restoreCount) {
      this._restoreCount--;
      if (this._restoreCount == 0) {
        // This was the last window restored at startup, notify observers.
        Services.obs.notifyObservers(this.windowToFocus,
          this._browserSetState ? NOTIFY_BROWSER_STATE_RESTORED : NOTIFY_WINDOWS_RESTORED,
          "");
        this._browserSetState = false;
      }
    }
  },

  /**
   * Dispatch an SSWindowState_____ event for the given window.
   * @param aWindow the window
   * @param aType the type of event, SSWindowState will be prepended to this string
   */
  _sendWindowStateEvent: function sss_sendWindowStateEvent(aWindow, aType) {
    let event = aWindow.document.createEvent("Events");
    event.initEvent("SSWindowState" + aType, true, false);
    aWindow.dispatchEvent(event);
  },

  /**
   * Dispatch the SSTabRestored event for the given tab.
   * @param aTab the which has been restored
   */
  _sendTabRestoredNotification: function sss_sendTabRestoredNotification(aTab) {
    let event = aTab.ownerDocument.createEvent("Events");
    event.initEvent("SSTabRestored", true, false);
    aTab.dispatchEvent(event);
  },

  /**
   * @param aWindow
   *        Window reference
   * @returns whether this window's data is still cached in _statesToRestore
   *          because it's not fully loaded yet
   */
  _isWindowLoaded: function sss_isWindowLoaded(aWindow) {
    return !aWindow.__SS_restoreID;
  },

  /**
   * Replace "Loading..." with the tab label (with minimal side-effects)
   * @param aString is the string the title is stored in
   * @param aTabbrowser is a tabbrowser object, containing aTab
   * @param aTab is the tab whose title we're updating & using
   *
   * @returns aString that has been updated with the new title
   */
  _replaceLoadingTitle : function sss_replaceLoadingTitle(aString, aTabbrowser, aTab) {
    if (aString == aTabbrowser.mStringBundle.getString("tabs.loading")) {
      aTabbrowser.setTabTitle(aTab);
      [aString, aTab.label] = [aTab.label, aString];
    }
    return aString;
  },

  /**
   * Resize this._closedWindows to the value of the pref, except in the case
   * where we don't have any non-popup windows on Windows and Linux. Then we must
   * resize such that we have at least one non-popup window.
   */
  _capClosedWindows : function sss_capClosedWindows() {
    let maxWindowsUndo = this._prefBranch.getIntPref("sessionstore.max_windows_undo");
    if (this._closedWindows.length <= maxWindowsUndo)
      return;
    let spliceTo = maxWindowsUndo;
#ifndef XP_MACOSX
    let normalWindowIndex = 0;
    // try to find a non-popup window in this._closedWindows
    while (normalWindowIndex < this._closedWindows.length &&
           this._closedWindows[normalWindowIndex].isPopup)
      normalWindowIndex++;
    if (normalWindowIndex >= maxWindowsUndo)
      spliceTo = normalWindowIndex + 1;
#endif
    this._closedWindows.splice(spliceTo, this._closedWindows.length);
  },

  /**
   * Reset state to prepare for a new session state to be restored.
   */
  _resetRestoringState: function sss_initRestoringState() {
    this._tabsToRestore = { visible: [], hidden: [] };
    this._tabsRestoringCount = 0;
  },

  /**
   * Reset the restoring state for a particular tab. This will be called when
   * removing a tab or when a tab needs to be reset (it's being overwritten).
   *
   * @param aTab
   *        The tab that will be "reset"
   */
  _resetTabRestoringState: function sss_resetTabRestoringState(aTab) {
    let window = aTab.ownerDocument.defaultView;
    let browser = aTab.linkedBrowser;

    // Keep the tab's previous state for later in this method
    let previousState = browser.__SS_restoreState;

    // The browser is no longer in any sort of restoring state.
    delete browser.__SS_restoreState;

    // We want to decrement window.__SS_tabsToRestore here so that we always
    // decrement it AFTER a tab is done restoring or when a tab gets "reset".
    window.__SS_tabsToRestore--;

    // Remove the progress listener if we should.
    this._removeTabsProgressListener(window);

    if (previousState == TAB_STATE_RESTORING) {
      if (this._tabsRestoringCount)
        this._tabsRestoringCount--;
    }
    else if (previousState == TAB_STATE_NEEDS_RESTORE) {
      // Make sure the session history listener is removed. This is normally
      // done in restoreTab, but this tab is being removed before that gets called.
      this._removeSHistoryListener(aTab);

      // Make sure that the tab is removed from the list of tabs to restore.
      // Again, this is normally done in restoreTab, but that isn't being called
      // for this tab.
      this._removeTabFromTabsToRestore(aTab);
    }
  },

  /**
   * Remove the tab from this._tabsToRestore[visible/hidden]
   *
   * @param aTab
   */
  _removeTabFromTabsToRestore: function sss_removeTabFromTabsToRestore(aTab) {
    let arr = this._tabsToRestore[aTab.hidden ? "hidden" : "visible"];
    let index = arr.indexOf(aTab);
    if (index > -1)
      arr.splice(index, 1);
  },

  /**
   * Add the tabs progress listener to the window if it isn't already
   *
   * @param aWindow
   *        The window to add our progress listener to
   */
  _ensureTabsProgressListener: function sss_ensureTabsProgressListener(aWindow) {
    let tabbrowser = aWindow.getBrowser();
    try {
      tabbrowser.addTabsProgressListener(gRestoreTabsProgressListener);
    } catch (ex) { }
  },

  /**
   * Attempt to remove the tabs progress listener from the window.
   *
   * @param aWindow
   *        The window from which to remove our progress listener from
   */
  _removeTabsProgressListener: function sss_removeTabsProgressListener(aWindow) {
    // If there are no tabs left to restore (or restoring) in this window, then
    // we can safely remove the progress listener from this window.
    if (!aWindow.__SS_tabsToRestore)
      try {
        aWindow.getBrowser().removeTabsProgressListener(gRestoreTabsProgressListener);
      } catch (ex) { }
  },

  /**
   * Remove the session history listener from the tab's browser if there is one.
   *
   * @param aTab
   *        The tab who's browser to remove the listener
   */
  _removeSHistoryListener: function sss_removeSHistoryListener(aTab) {
    let browser = aTab.linkedBrowser;
    if (browser.__SS_shistoryListener) {
      browser.webNavigation.sessionHistory.
                            removeSHistoryListener(browser.__SS_shistoryListener);
      delete browser.__SS_shistoryListener;
    }
  },

/* ........ Storage API .............. */

  /**
   * write file to disk
   * @param aFile
   *        nsIFile
   * @param aData
   *        String data
   */
  _writeFile: function sss_writeFile(aFile, aData) {
    // Initialize the file output stream.
    var ostream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
                            .createInstance(Components.interfaces.nsIFileOutputStream);
    ostream.init(aFile, 0x02 | 0x08 | 0x20, parseInt("0600", 8), ostream.DEFER_OPEN);

    // Obtain a converter to convert our data to a UTF-8 encoded input stream.
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                              .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    // Asynchronously copy the data to the file.
    var istream = converter.convertToInputStream(aData);
    var ObserverService = this._observerService;
    NetUtil.asyncCopy(istream, ostream, function(rc) {
      if (Components.isSuccessCode(rc)) {
        Services.obs.notifyObservers(null,
                                     "sessionstore-state-write-complete",
                                     "");
      }
    });
  }
};

let XPathHelper = {
  // these two hashes should be kept in sync
  namespaceURIs:     { "xhtml": "http://www.w3.org/1999/xhtml" },
  namespacePrefixes: { "http://www.w3.org/1999/xhtml": "xhtml" },

  /**
   * Generates an approximate XPath query to an (X)HTML node
   */
  generate: function sss_xph_generate(aNode) {
    // have we reached the document node already?
    if (!aNode.parentNode)
      return "";

    // Access localName, namespaceURI just once per node since it's expensive.
    let nNamespaceURI = aNode.namespaceURI;
    let nLocalName = aNode.localName;

    let prefix = this.namespacePrefixes[nNamespaceURI] || null;
    let tag = (prefix ? prefix + ":" : "") + this.escapeName(nLocalName);

    // stop once we've found a tag with an ID
    if (aNode.id)
      return "//" + tag + "[@id=" + this.quoteArgument(aNode.id) + "]";

    // count the number of previous sibling nodes of the same tag
    // (and possible also the same name)
    let count = 0;
    let nName = aNode.name || null;
    for (let n = aNode; (n = n.previousSibling); )
      if (n.localName == nLocalName && n.namespaceURI == nNamespaceURI &&
          (!nName || n.name == nName))
        count++;

    // recurse until hitting either the document node or an ID'd node
    return this.generate(aNode.parentNode) + "/" + tag +
           (nName ? "[@name=" + this.quoteArgument(nName) + "]" : "") +
           (count ? "[" + (count + 1) + "]" : "");
  },

  /**
   * Resolves an XPath query generated by XPathHelper.generate
   */
  resolve: function sss_xph_resolve(aDocument, aQuery) {
    let xptype = Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE;
    return aDocument.evaluate(aQuery, aDocument, this.resolveNS, xptype, null).singleNodeValue;
  },

  /**
   * Namespace resolver for the above XPath resolver
   */
  resolveNS: function sss_xph_resolveNS(aPrefix) {
    return XPathHelper.namespaceURIs[aPrefix] || null;
  },

  /**
   * @returns valid XPath for the given node (usually just the local name itself)
   */
  escapeName: function sss_xph_escapeName(aName) {
    // we can't just use the node's local name, if it contains
    // special characters (cf. bug 485482)
    return /^\w+$/.test(aName) ? aName :
           "*[local-name()=" + this.quoteArgument(aName) + "]";
  },

  /**
   * @returns a properly quoted string to insert into an XPath query
   */
  quoteArgument: function sss_xph_quoteArgument(aArg) {
    return !/'/.test(aArg) ? "'" + aArg + "'" :
           !/"/.test(aArg) ? '"' + aArg + '"' :
           "concat('" + aArg.replace(/'+/g, "',\"$&\",'") + "')";
  },

  /**
   * @returns an XPath query to all savable form field nodes
   */
  get restorableFormNodes() {
    // for a comprehensive list of all available <INPUT> types see
    // http://mxr.mozilla.org/mozilla-central/search?string=kInputTypeTable
    let ignoreTypes = ["password", "hidden", "button", "image", "submit", "reset"];
    // XXXzeniko work-around until lower-case has been implemented (bug 398389)
    let toLowerCase = '"ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"';
    let ignore = "not(translate(@type, " + toLowerCase + ")='" +
      ignoreTypes.join("' or translate(@type, " + toLowerCase + ")='") + "')";
    let formNodesXPath = "//textarea|//select|//xhtml:textarea|//xhtml:select|" +
      "//input[" + ignore + "]|//xhtml:input[" + ignore + "]";

    delete this.restorableFormNodes;
    return (this.restorableFormNodes = formNodesXPath);
  }
};

// A map storing a closed window's state data until it goes aways (is GC'ed).
// This ensures that API clients can still read (but not write) states of
// windows they still hold a reference to but we don't.
let DyingWindowCache = {
  _data: new WeakMap(),

  has: function (window) {
    return this._data.has(window);
  },

  get: function (window) {
    return this._data.get(window);
  },

  set: function (window, data) {
    this._data.set(window, data);
  },

  remove: function (window) {
    this._data.delete(window);
  }
};

// This is used to help meter the number of restoring tabs. This is the control
// point for telling the next tab to restore. It gets attached to each gBrowser
// via gBrowser.addTabsProgressListener
let gRestoreTabsProgressListener = {
  ss: null,
  onStateChange: function (aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    // Ignore state changes on browsers that we've already restored and state
    // changes that aren't applicable.
    if (aBrowser.__SS_restoreState == TAB_STATE_RESTORING &&
        aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP &&
        aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK &&
        aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_WINDOW) {
      // We need to reset the tab before starting the next restore.
      let tab = this.ss._getTabForBrowser(aBrowser);
      this.ss._resetTabRestoringState(tab);
      this.ss.restoreNextTab();
    }
  }
}

// A SessionStoreSHistoryListener will be attached to each browser before it is
// restored. We need to catch reloads that occur before the tab is restored
// because otherwise, docShell will reload an old URI (usually about:blank).
function SessionStoreSHistoryListener(ss, aTab) {
  this.tab = aTab;
  this.ss = ss;
}

SessionStoreSHistoryListener.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISHistoryListener,
                                         Components.interfaces.nsISupportsWeakReference]),
  browser: null,
  ss: null,
  tab: null,
  OnHistoryNewEntry: function(aNewURI) { },
  OnHistoryGoBack: function(aBackURI) { return true; },
  OnHistoryGoForward: function(aForwardURI) { return true; },
  OnHistoryGotoIndex: function(aIndex, aGotoURI) { return true; },
  OnHistoryPurge: function(aNumEntries) { return true; },
  OnHistoryReload: function(aReloadURI, aReloadFlags) {
    // On reload, we want to make sure that session history loads the right
    // URI. In order to do that, we will just call restoreTab. That will remove
    // the history listener and load the right URI.
    this.ss.restoreTab(this.tab);
    // Returning false will stop the load that docshell is attempting.
    return false;
  }
}


var NSGetFactory = XPCOMUtils.generateNSGetFactory([SessionStoreService]);
