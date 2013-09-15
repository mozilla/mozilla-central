/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/LoginManagerContent.jsm");
Components.utils.import("resource:///modules/Sanitizer.jsm");
Components.utils.import("resource:///modules/mailnewsMigrator.js");

var onContentLoaded = LoginManagerContent.onContentLoaded.bind(LoginManagerContent);
var onFormPassword = LoginManagerContent.onFormPassword.bind(LoginManagerContent);
var onUsernameInput = LoginManagerContent.onUsernameInput.bind(LoginManagerContent);

XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "UserAgentOverrides",
                                  "resource://gre/modules/UserAgentOverrides.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesBackups",
                                  "resource://gre/modules/PlacesBackups.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "BookmarkHTMLUtils",
                                  "resource://gre/modules/BookmarkHTMLUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "DebuggerServer",
                                  "resource://gre/modules/devtools/dbg-server.jsm");

// We try to backup bookmarks at idle times, to avoid doing that at shutdown.
// Number of idle seconds before trying to backup bookmarks.  15 minutes.
const BOOKMARKS_BACKUP_IDLE_TIME = 15 * 60;
// Minimum interval in milliseconds between backups.
const BOOKMARKS_BACKUP_INTERVAL = 86400 * 1000;
// Maximum number of backups to create.  Old ones will be purged.
const BOOKMARKS_BACKUP_MAX_BACKUPS = 10;
// Devtools Preferences
const DEBUGGER_REMOTE_ENABLED = "devtools.debugger.remote-enabled";
const DEBUGGER_REMOTE_PORT = "devtools.debugger.remote-port";

// Constructor

function SuiteGlue() {
  XPCOMUtils.defineLazyServiceGetter(this, "_idleService",
                                     "@mozilla.org/widget/idleservice;1",
                                     "nsIIdleService");

  this._init();
}

SuiteGlue.prototype = {
  _saveSession: false,
  _sound: null,
  _isIdleObserver: false,
  _isPlacesDatabaseLocked: false,
  _migrationImportsDefaultBookmarks: false,

  _setPrefToSaveSession: function()
  {
    Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
  },

  _logConsoleAPI: function(aEvent)
  {
    const nsIScriptError = Components.interfaces.nsIScriptError;
    var flg = nsIScriptError.errorFlag;
    switch (aEvent.level) {
      case "warn":
        flg = nsIScriptError.warningFlag;
      case "error":
        var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                                    .createInstance(nsIScriptError);
        scriptError.initWithWindowID(Array.slice(aEvent.arguments),
                                     aEvent.filename, "", aEvent.lineNumber, 0,
                                     flg, "content javascript", aEvent.innerID);
        Services.console.logMessage(scriptError);
        break;
      case "log":
      case "info":
        Services.console.logStringMessage(Array.slice(aEvent.arguments));
        break;
    }
  },

  _setSyncAutoconnectDelay: function BG__setSyncAutoconnectDelay() {
    // Assume that a non-zero value for services.sync.autoconnectDelay should override
    if (Services.prefs.prefHasUserValue("services.sync.autoconnectDelay")) {
      let prefDelay = Services.prefs.getIntPref("services.sync.autoconnectDelay");

      if (prefDelay > 0)
        return;
    }

    // delays are in seconds
    const MAX_DELAY = 300;
    let delay = 3;
    let browserEnum = Services.wm.getEnumerator("navigator:browser");
    while (browserEnum.hasMoreElements()) {
      delay += browserEnum.getNext().gBrowser.tabs.length;
    }
    delay = delay <= MAX_DELAY ? delay : MAX_DELAY;

    Components.utils.import("resource://services-sync/main.js");
    Weave.Service.scheduler.delayedAutoConnect(delay);
  },

  // nsIObserver implementation
  observe: function(subject, topic, data)
  {
    switch(topic) {
      case "nsPref:changed":
        switch (data) {
          case DEBUGGER_REMOTE_ENABLED:
            if (this.dbgIsEnabled)
              this.dbgStart();
            else
              this.dbgStop();
            break;
          case DEBUGGER_REMOTE_PORT:
            /**
             * If the server is not on, port changes have nothing to affect.
             * The new value will be picked up if the server is started.
             */
            if (this.dbgIsEnabled)
              this.dbgRestart();
            break;
        }
        break;
      case "profile-before-change":
        this._onProfileShutdown();
        break;
      case "profile-after-change":
        this._onProfileAfterChange();
        break;
      case "final-ui-startup":
        this._onProfileStartup();
        this._promptForMasterPassword();
        this._checkForNewAddons();
        Services.search.init();
        break;
      case "sessionstore-windows-restored":
        this._onBrowserStartup(subject);
        break;
      case "browser:purge-session-history":
        // reset the console service's error buffer
        Services.console.logStringMessage(null); // clear the console (in case it's open)
        Services.console.reset();
        break;
      case "quit-application-requested":
        this._onQuitRequest(subject, data);
        break;
      case "quit-application-granted":
        if (this._saveSession) {
          this._setPrefToSaveSession();
        }
        Sanitizer.checkSettings();
        break;
      case "browser-lastwindow-close-requested":
        // The application is not actually quitting, but the last full browser
        // window is about to be closed.
        this._onQuitRequest(subject, "lastwindow");
        break;
      case "browser-lastwindow-close-granted":
        if (this._saveSession)
          this._setPrefToSaveSession();
        break;
      case "console-api-log-event":
        if (Services.prefs.getBoolPref("browser.dom.window.console.enabled"))
          this._logConsoleAPI(subject.wrappedJSObject);
        break;
      case "weave:service:ready":
        this._setSyncAutoconnectDelay();
        break;
      case "weave:engine:clients:display-uri":
        this._onDisplaySyncURI(subject);
        break;
      case "session-save":
        this._setPrefToSaveSession();
        subject.QueryInterface(Components.interfaces.nsISupportsPRBool);
        subject.data = true;
        break;
      case "dl-done":
        this._playDownloadSound();
        break;
      case "places-init-complete":
        if (!this._migrationImportsDefaultBookmarks)
          this._initPlaces(false);

        Services.obs.removeObserver(this, "places-init-complete");
        // No longer needed, since history was initialized completely.
        Services.obs.removeObserver(this, "places-database-locked");
        break;
      case "places-database-locked":
        this._isPlacesDatabaseLocked = true;
        // Stop observing, so further attempts to load history service
        // will not show the prompt.
        Services.obs.removeObserver(this, "places-database-locked");
        break;
      case "places-shutdown":
        Services.obs.removeObserver(this, "places-shutdown");
        // places-shutdown is fired when the profile is about to disappear.
        this._onPlacesShutdown();
        break;
      case "idle":
        if (this._idleService.idleTime > BOOKMARKS_BACKUP_IDLE_TIME * 1000)
          this._backupBookmarks();
        break;
      case "initial-migration":
        this._initialMigrationPerformed = true;
        break;
      case "browser-search-engine-modified":
        if (data != "engine-default" && data != "engine-current") {
          break;
        }
        // Enforce that the search service's defaultEngine is always equal to
        // its currentEngine. The search service will notify us any time either
        // of them are changed (either by directly setting the relevant prefs,
        // i.e. if add-ons try to change this directly, or if the
        // nsIBrowserSearchService setters are called).
        var ss = Services.search;
        if (ss.currentEngine.name == ss.defaultEngine.name)
          return;
        if (data == "engine-current")
          ss.defaultEngine = ss.currentEngine;
        else
          ss.currentEngine = ss.defaultEngine;
        break;
    }
  },

  // nsIWebProgressListener partial implementation
  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags)
  {
    if (aWebProgress.isTopLevel &&
        aWebProgress instanceof Components.interfaces.nsIDocShell &&
        aWebProgress.loadType & Components.interfaces.nsIDocShell.LOAD_CMD_NORMAL &&
        aWebProgress.useGlobalHistory &&
        aWebProgress instanceof Components.interfaces.nsILoadContext &&
        !aWebProgress.usePrivateBrowsing) {
      switch (aLocation.scheme) {
        case "about":
        case "imap":
        case "news":
        case "mailbox":
        case "moz-anno":
        case "view-source":
        case "chrome":
        case "resource":
        case "data":
        case "wyciwyg":
        case "javascript":
          break;
        default:
          var str = Components.classes["@mozilla.org/supports-string;1"]
                              .createInstance(Components.interfaces.nsISupportsString);
          str.data = aLocation.spec;
          Services.prefs.setComplexValue("browser.history.last_page_visited",
                                         Components.interfaces.nsISupportsString, str);
          break;
      }
    }
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    aWebProgress.DOMWindow.addEventListener("DOMContentLoaded", onContentLoaded, true);
    aWebProgress.DOMWindow.addEventListener("DOMFormHasPassword", onFormPassword, true);
    aWebProgress.DOMWindow.addEventListener("DOMAutoComplete", onUsernameInput, true);
    aWebProgress.DOMWindow.addEventListener("change", onUsernameInput, true);
  },

  // initialization (called on application startup)
  _init: function()
  {
    // observer registration
    Services.obs.addObserver(this, "profile-before-change", true);
    Services.obs.addObserver(this, "profile-after-change", true);
    Services.obs.addObserver(this, "final-ui-startup", true);
    Services.obs.addObserver(this, "sessionstore-windows-restored", true);
    Services.obs.addObserver(this, "browser:purge-session-history", true);
    Services.obs.addObserver(this, "quit-application-requested", true);
    Services.obs.addObserver(this, "quit-application-granted", true);
    Services.obs.addObserver(this, "browser-lastwindow-close-requested", true);
    Services.obs.addObserver(this, "browser-lastwindow-close-granted", true);
    Services.obs.addObserver(this, "console-api-log-event", true);
    Services.obs.addObserver(this, "weave:service:ready", true);
    Services.obs.addObserver(this, "weave:engine:clients:display-uri", true);
    Services.obs.addObserver(this, "session-save", true);
    Services.obs.addObserver(this, "dl-done", true);
    Services.obs.addObserver(this, "places-init-complete", true);
    Services.obs.addObserver(this, "places-database-locked", true);
    Services.obs.addObserver(this, "places-shutdown", true);
    Services.obs.addObserver(this, "browser-search-engine-modified", true);
    Services.prefs.addObserver("devtools.debugger.", this, true);
    Components.classes['@mozilla.org/docloaderservice;1']
              .getService(Components.interfaces.nsIWebProgress)
              .addProgressListener(this, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION | Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  },

  // profile is available
  _onProfileAfterChange: function()
  {
    // check if we're in safe mode
    if (Services.appinfo.inSafeMode) {
      Services.ww.openWindow(null, "chrome://communicator/content/safeMode.xul", 
                             "_blank", "chrome,centerscreen,modal,resizable=no", null);
    }
  },

  // profile startup handler (contains profile initialization routines)
  _onProfileStartup: function()
  {
    this._updatePrefs();
    migrateMailnews(); // mailnewsMigrator.js

    Sanitizer.checkSettings();
    Sanitizer.doPendingSanitize();

    if (Services.prefs.prefHasUserValue("privacy.sanitize.didShutdownSanitize")) {
      Services.prefs.clearUserPref("privacy.sanitize.didShutdownSanitize");
      // We need to persist this preference change, since we want to
      // check it at next app start even if the browser exits abruptly
      Services.prefs.savePrefFile(null);
    }

    this._setUpUserAgentOverrides();
  },

  _setUpUserAgentOverrides: function ()
  {
    UserAgentOverrides.init();

    function addMoodleOverride(aHttpChannel, aOriginalUA)
    {
      var cookies;
      try {
        cookies = aHttpChannel.getRequestHeader("Cookie");
      } catch (e) { /* no cookie sent */ }

      if (cookies && cookies.contains("MoodleSession"))
        return aOriginalUA.replace(/Gecko\/[^ ]*/, "Gecko/20100101");
      return null;
    }

    if (Services.prefs.getBoolPref("general.useragent.complexOverride.moodle"))
      UserAgentOverrides.addComplexOverride(addMoodleOverride);
  },

  // Browser startup complete. All initial windows have opened.
  _onBrowserStartup: function(aWindow)
  {
    if (Services.prefs.getBoolPref("plugins.update.notifyUser"))
      this._showPluginUpdatePage(aWindow);

    // For any add-ons that were installed disabled and can be enabled offer
    // them to the user.
    var browser = aWindow.getBrowser();
    var changedIDs = AddonManager.getStartupChanges(AddonManager.STARTUP_CHANGE_INSTALLED);
    if (changedIDs.length) {
      AddonManager.getAddonsByIDs(changedIDs, function(aAddons) {
        aAddons.forEach(function(aAddon) {
          // If the add-on isn't user disabled or can't be enabled then skip it.
          if (!aAddon.userDisabled || !(aAddon.permissions & AddonManager.PERM_CAN_ENABLE))
            return;

          browser.selectedTab = browser.addTab("about:newaddon?id=" + aAddon.id);
        })
      });
    }

    var notifyBox = browser.getNotificationBox();

    // Show about:rights notification, if needed.
    if (this._shouldShowRights())
      this._showRightsNotification(notifyBox);

    if ("@mozilla.org/windows-taskbar;1" in Components.classes &&
        Components.classes["@mozilla.org/windows-taskbar;1"]
                  .getService(Components.interfaces.nsIWinTaskbar).available) {
      let temp = {};
      Components.utils.import("resource:///modules/WindowsJumpLists.jsm", temp);
      temp.WinTaskbarJumpList.startup();
    }

    // Load the "more info" page for a locked places.sqlite
    // This property is set earlier by places-database-locked topic.
    if (this._isPlacesDatabaseLocked)
      notifyBox.showPlacesLockedWarning();

    // Detect if updates are off and warn for outdated builds.
    if (this._shouldShowUpdateWarning())
      notifyBox.showUpdateWarning();

    this._checkForDefaultClient(aWindow);
  },

  /**
   * Profile shutdown handler (contains profile cleanup routines).
   * All components depending on Places should be shut down in
   * _onPlacesShutdown() and not here.
   */
  _onProfileShutdown: function()
  {
    UserAgentOverrides.uninit()
  },

  _promptForMasterPassword: function()
  {
    if (!Services.prefs.getBoolPref("signon.startup.prompt"))
      return;

    // Try to avoid the multiple master password prompts on startup scenario
    // by prompting for the master password upfront.
    let token = Components.classes["@mozilla.org/security/pk11tokendb;1"]
                          .getService(Components.interfaces.nsIPK11TokenDB)
                          .getInternalKeyToken();

    // Only log in to the internal token if it is already initialized,
    // otherwise we get a "Change Master Password" dialog.
    try {
      if (!token.needsUserInit)
        token.login(false);
    } catch (ex) {
      // If user cancels an exception is expected.
    }
  },

  // If new add-ons were installed during startup, open the add-ons manager.
  _checkForNewAddons: function()
  {
    const PREF_EM_NEW_ADDONS_LIST = "extensions.newAddons";

    if (!Services.prefs.prefHasUserValue(PREF_EM_NEW_ADDONS_LIST))
      return;

    const args = Components.classes["@mozilla.org/array;1"]
                           .createInstance(Components.interfaces.nsIMutableArray);
    let str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(Components.interfaces.nsISupportsString);
    args.appendElement(str, false);
    str = Components.classes["@mozilla.org/supports-string;1"]
                    .createInstance(Components.interfaces.nsISupportsString);
    str.data = Services.prefs.getCharPref(PREF_EM_NEW_ADDONS_LIST);
    args.appendElement(str, false);
    const EMURL = "chrome://mozapps/content/extensions/extensions.xul";
    // This window is the "first" to open.
    // 'alwaysRaised' makes sure it stays in the foreground (though unfocused)
    //   so it is noticed.
    const EMFEATURES = "all,dialog=no,alwaysRaised";
    Services.ww.openWindow(null, EMURL, "_blank", EMFEATURES, args);

    Services.prefs.clearUserPref(PREF_EM_NEW_ADDONS_LIST);
  },

  _onQuitRequest: function(aCancelQuit, aQuitType)
  {
    // If user has already dismissed quit request, then do nothing
    if ((aCancelQuit instanceof Components.interfaces.nsISupportsPRBool) && aCancelQuit.data)
      return;

    var windowcount = 0;
    var pagecount = 0;
    var browserEnum = Services.wm.getEnumerator("navigator:browser");
    while (browserEnum.hasMoreElements()) {
      windowcount++;

      var browser = browserEnum.getNext();
      var tabbrowser = browser.document.getElementById("content");
      if (tabbrowser)
        pagecount += tabbrowser.browsers.length;
    }

    this._saveSession = false;
    if (pagecount < 2)
      return;

    if (aQuitType != "restart")
      aQuitType = "quit";

    var showPrompt = true;
    try {
      // browser.warnOnQuit is a hidden global boolean to override all quit prompts
      // browser.warnOnRestart specifically covers app-initiated restarts where we restart the app
      // browser.tabs.warnOnClose is the global "warn when closing multiple tabs" pref
      if (Services.prefs.getIntPref("browser.startup.page") == 3 ||
          Services.prefs.getBoolPref("browser.sessionstore.resume_session_once") ||
          !Services.prefs.getBoolPref("browser.warnOnQuit"))
        showPrompt = false;
      else if (aQuitType == "restart")
        showPrompt = Services.prefs.getBoolPref("browser.warnOnRestart");
      else
        showPrompt = Services.prefs.getBoolPref("browser.tabs.warnOnClose");
    } catch (ex) {}

    if (showPrompt) {
      var quitBundle = Services.strings.createBundle("chrome://communicator/locale/quitDialog.properties");
      var brandBundle = Services.strings.createBundle("chrome://branding/locale/brand.properties");

      var appName = brandBundle.GetStringFromName("brandShortName");
      var quitDialogTitle = quitBundle.formatStringFromName(aQuitType + "DialogTitle",
                                                              [appName], 1);

      var message;
      if (aQuitType == "restart")
        message = quitBundle.formatStringFromName("messageRestart",
                                                  [appName], 1);
      else if (windowcount == 1)
        message = quitBundle.formatStringFromName("messageNoWindows",
                                                  [appName], 1);
      else
        message = quitBundle.formatStringFromName("message",
                                                  [appName], 1);

      var flags = Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
                  Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1 +
                  Services.prompt.BUTTON_POS_0_DEFAULT;

      var neverAsk = {value:false};
      var button0Title, button1Title, button2Title;
      var neverAskText = quitBundle.GetStringFromName("neverAsk");

      if (aQuitType == "restart") {
        button0Title = quitBundle.GetStringFromName("restartNowTitle");
        button1Title = quitBundle.GetStringFromName("restartLaterTitle");
      } else {
        flags += Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_2;
        button0Title = quitBundle.GetStringFromName("saveTitle");
        button1Title = quitBundle.GetStringFromName("cancelTitle");
        button2Title = quitBundle.GetStringFromName("quitTitle");
      }

      var mostRecentBrowserWindow = Services.wm.getMostRecentWindow("navigator:browser");
      var buttonChoice = Services.prompt.confirmEx(mostRecentBrowserWindow, quitDialogTitle, message,
                                                   flags, button0Title, button1Title, button2Title,
                                                   neverAskText, neverAsk);

      switch (buttonChoice) {
      case 2:
        if (neverAsk.value)
          Services.prefs.setBoolPref("browser.tabs.warnOnClose", false);
        break;
      case 1:
        aCancelQuit.QueryInterface(Components.interfaces.nsISupportsPRBool);
        aCancelQuit.data = true;
        break;
      case 0:
        this._saveSession = true;
        if (neverAsk.value) {
          if (aQuitType == "restart")
            Services.prefs.setBoolPref("browser.warnOnRestart", false);
          else {
            // always save state when shutting down
            Services.prefs.setIntPref("browser.startup.page", 3);
          }
        }
        break;
      }
    }
  },

  _playDownloadSound: function()
  {
    if (Services.prefs.getBoolPref("browser.download.finished_download_sound")) {
      if (!this._sound)
        this._sound = Components.classes["@mozilla.org/sound;1"]
                                .createInstance(Components.interfaces.nsISound);
      try {
        var url = Services.prefs.getComplexValue("browser.download.finished_sound_url",
                                                 Components.interfaces.nsISupportsString);
        this._sound.play(Services.io.newURI(url.data, null, null));
      } catch (e) {
        this._sound.beep();
      }
    }
  },

  _showPluginUpdatePage: function(aWindow) {
    Services.prefs.setBoolPref("plugins.update.notifyUser", false);

    var url = Services.urlFormatter.formatURLPref("plugins.update.url");

    aWindow.getBrowser().addTab(url, { focusNewTab: true });
  },

  /*
   * _shouldShowRights - Determines if the user should be shown the
   * about:rights notification. The notification should *not* be shown if
   * we've already shown the current version, or if the override pref says to
   * never show it. The notification *should* be shown if it's never been seen
   * before, if a newer version is available, or if the override pref says to
   * always show it.
   */
  _shouldShowRights: function () {
    // Look for an unconditional override pref. If set, do what it says.
    // (true --> never show, false --> always show)
    try {
      return !Services.prefs.getBoolPref("browser.rights.override");
    } catch (e) { }
    // Ditto, for the legacy EULA pref (tinderbox testing profile sets this).
    try {
      return !Services.prefs.getBoolPref("browser.EULA.override");
    } catch (e) { }

    // Look to see if the user has seen the current version or not.
    var currentVersion = Services.prefs.getIntPref("browser.rights.version");
    try {
      return !Services.prefs.getBoolPref("browser.rights." + currentVersion + ".shown");
    } catch (e) { }

    // We haven't shown the notification before, so do so now.
    return true;
  },

  _showRightsNotification: function(aNotifyBox) {
    // Stick the notification onto the selected tab of the active browser window.
    aNotifyBox.showRightsNotification();

    // Set pref to indicate we've shown the notficiation.
    var currentVersion = Services.prefs.getIntPref("browser.rights.version");
    Services.prefs.setBoolPref("browser.rights." + currentVersion + ".shown", true);
  },

  /*
   * _shouldShowUpdateWarning - Determines if the user should be warned about
   * having updates off and an old build that likely should be updated.
   */
  _shouldShowUpdateWarning: function () {
    // Look for an unconditional override pref. If set, do what it says.
    // (true --> never show, false --> always show)
    try {
      return !Services.prefs.getBoolPref("app.updatecheck.override");
    } catch (e) { }
    // If updates are enabled, we don't need to worry.
    if (Services.prefs.getBoolPref("app.update.enabled"))
      return false;
    var maxAge = 90 * 86400; // 90 days
    var now = Math.round(Date.now() / 1000);
    // If there was an automated update tried in the interval, don't worry.
    var lastUpdateTime = Services.prefs.getIntPref("app.update.lastUpdateTime.background-update-timer");
    if (lastUpdateTime + maxAge > now)
      return false;

    var buildID = Services.appinfo.appBuildID;
    // construct build date from ID
    var buildDate = new Date(buildID.substr(0, 4),
                             buildID.substr(4, 2) - 1,
                             buildID.substr(6, 2));
    var buildTime = Math.round(buildDate / 1000);
    // We should warn if the build is older than the max age.
    return (buildTime + maxAge <= now);
  },

  // This method gets the shell service and has it check its settings.
  // This will do nothing on platforms without a shell service.
  _checkForDefaultClient: function checkForDefaultClient(aWindow)
  {
    const NS_SHELLSERVICE_CID = "@mozilla.org/suite/shell-service;1";
    if (NS_SHELLSERVICE_CID in Components.classes) try {
      const nsIShellService = Components.interfaces.nsIShellService;

      var shellService = Components.classes[NS_SHELLSERVICE_CID]
                                   .getService(nsIShellService);
      var appTypes = shellService.shouldBeDefaultClientFor;

      // Show the default client dialog only if we should check for the default
      // client and we aren't already the default for the stored app types in
      // shell.checkDefaultApps.
      if (appTypes && shellService.shouldCheckDefaultClient &&
          !shellService.isDefaultClient(true, appTypes)) {
        aWindow.openDialog("chrome://communicator/content/defaultClientDialog.xul",
                           "DefaultClient",
                           "modal,centerscreen,chrome,resizable=no");
      }
    } catch (e) {}
  },

  /**
   * Initialize Places
   * - imports the bookmarks html file if bookmarks database is empty, try to
   *   restore bookmarks from a JSON backup if the backend indicates that the
   *   database was corrupt.
   *
   * These prefs can be set up by the frontend:
   *
   * WARNING: setting these preferences to true will overwite existing bookmarks
   *
   * - browser.places.importBookmarksHTML
   *   Set to true will import the bookmarks.html file from the profile folder.
   * - browser.places.smartBookmarksVersion
   *   Set during HTML import to indicate that Smart Bookmarks were created.
   *   Set to -1 to disable Smart Bookmarks creation.
   *   Set to 0 to restore current Smart Bookmarks.
   * - browser.bookmarks.restore_default_bookmarks
   *   Set to true by safe-mode dialog to indicate we must restore default
   *   bookmarks.
   */
  _initPlaces: function(aInitialMigrationPerformed) {
    // We must instantiate the history service since it will tell us if we
    // need to import or restore bookmarks due to first-run, corruption or
    // forced migration (due to a major schema change).
    var bookmarksBackupFile = PlacesBackups.getMostRecent("json");

    // If the database is corrupt or has been newly created we should
    // import bookmarks. Same if we don't have any JSON backups, which
    // probably means that we never have used bookmarks in places yet.
    var dbStatus = PlacesUtils.history.databaseStatus;
    var importBookmarks = !aInitialMigrationPerformed &&
                          (dbStatus == PlacesUtils.history.DATABASE_STATUS_CREATE ||
                           dbStatus == PlacesUtils.history.DATABASE_STATUS_CORRUPT ||
                           !bookmarksBackupFile);

    // Check if user or an extension has required to import bookmarks.html
    var importBookmarksHTML = false;
    try {
      importBookmarksHTML =
        Services.prefs.getBoolPref("browser.places.importBookmarksHTML");
      if (importBookmarksHTML)
        importBookmarks = true;
    } catch(ex) {}

    // Check if Safe Mode or the user has required to restore bookmarks from
    // default profile's bookmarks.html
    var restoreDefaultBookmarks = false;
    try {
      restoreDefaultBookmarks =
        Services.prefs.getBoolPref("browser.bookmarks.restore_default_bookmarks");
      if (restoreDefaultBookmarks) {
        // Ensure that we already have a bookmarks backup for today.
        this._backupBookmarks();
        importBookmarks = true;
      }
    } catch(ex) {}

    // If the user did not require to restore default bookmarks, or import
    // from bookmarks.html, we will try to restore from JSON.
    if (importBookmarks && !restoreDefaultBookmarks && !importBookmarksHTML) {
      // Get latest JSON backup.
      if (bookmarksBackupFile) {
        // Restore from JSON backup.
        PlacesUtils.restoreBookmarksFromJSONFile(bookmarksBackupFile);
        importBookmarks = false;
      }
      else if (dbStatus == PlacesUtils.history.DATABASE_STATUS_OK) {
        importBookmarks = false;
      }
      else {
        // We have created a new database but we don't have any backup available.
        importBookmarks = true;
        var bookmarksHTMLFile = Services.dirsvc.get("BMarks", Components.interfaces.nsILocalFile);
        if (bookmarksHTMLFile.exists()) {
          // If bookmarks.html is available in current profile import it...
          importBookmarksHTML = true;
        }
        else {
          // ...otherwise we will restore defaults.
          restoreDefaultBookmarks = true;
        }
      }
    }

    // If bookmarks are not imported, then initialize smart bookmarks.  This
    // happens during a common startup.
    // Otherwise, if any kind of import runs, smart bookmarks creation should be
    // delayed till the import operations has finished.  Not doing so would
    // cause them to be overwritten by the newly imported bookmarks.
    if (!importBookmarks) {
      this.ensurePlacesDefaultQueriesInitialized();
    }
    else {
      // An import operation is about to run.
      // Don't try to recreate smart bookmarks if autoExportHTML is true or
      // smart bookmarks are disabled.
      var autoExportHTML = false;
      try {
        autoExportHTML = Services.prefs.getBoolPref("browser.bookmarks.autoExportHTML");
      } catch(ex) {}
      var smartBookmarksVersion = 0;
      try {
        smartBookmarksVersion = Services.prefs.getIntPref("browser.places.smartBookmarksVersion");
      } catch(ex) {}
      if (!autoExportHTML && smartBookmarksVersion != -1)
        Services.prefs.setIntPref("browser.places.smartBookmarksVersion", 0);

      var bookmarksURI = null;
      if (restoreDefaultBookmarks) {
        // User wants to restore bookmarks.html file from default profile folder.
        bookmarksURI = Services.io.newURI("resource:///defaults/profile/bookmarks.html", null, null);
      }
      else {
        // Get bookmarks.html file location.
        var bookmarksFile = Services.dirsvc.get("BMarks", Components.interfaces.nsILocalFile);
        if (bookmarksFile.exists())
          bookmarksURI = Services.io.newFileURI(bookmarksFile);
      }

      if (bookmarksURI) {
        // Import from bookmarks.html file.
        try {
          BookmarkHTMLUtils.importFromURL(bookmarksURI.spec, true).then(null,
            function onFailure() {
              Components.utils.reportError("Bookmarks.html file could be corrupt.");
            }
          ).then(
            // Ensure that smart bookmarks are created once the operation is
            // complete.
            this.ensurePlacesDefaultQueriesInitialized.bind(this)
          );
        }
        catch(ex) {
          Components.utils.reportError("bookmarks.html file could be corrupt. " + ex);
        }
      }
      else {
        Components.utils.reportError("Unable to find bookmarks.html file.");
      }

      // Reset preferences, so we won't try to import again at next run.
      if (importBookmarksHTML)
        Services.prefs.setBoolPref("browser.places.importBookmarksHTML", false);
      if (restoreDefaultBookmarks)
        Services.prefs.setBoolPref("browser.bookmarks.restore_default_bookmarks",
                                   false);
    }

    // Initialize bookmark archiving on idle.
    // Once a day, either on idle or shutdown, bookmarks are backed up.
    if (!this._isIdleObserver) {
      this._idleService.addIdleObserver(this, BOOKMARKS_BACKUP_IDLE_TIME);
      this._isIdleObserver = true;
    }
  },

  /**
   * Places shut-down tasks
   * - back up bookmarks if needed.
   * - export bookmarks as HTML, if so configured.
   * - finalize components depending on Places.
   */
  _onPlacesShutdown: function() {
    if (this._isIdleObserver) {
      this._idleService.removeIdleObserver(this, BOOKMARKS_BACKUP_IDLE_TIME);
      this._isIdleObserver = false;
    }
    this._backupBookmarks();

    // Backup bookmarks to bookmarks.html to support apps that depend
    // on the legacy format.
    try {
      // If this fails to get the preference value, we don't export.
      if (Services.prefs.getBoolPref("browser.bookmarks.autoExportHTML")) {
        // Exceptionally, since this is a non-default setting and HTML format is
        // discouraged in favor of the JSON backups, we spin the event loop on
        // shutdown, to wait for the export to finish.  We cannot safely spin
        // the event loop on shutdown until we include a watchdog to prevent
        // potential hangs (bug 518683).  The asynchronous shutdown operations
        // will then be handled by a shutdown service (bug 435058).
        var shutdownComplete = false;
        BookmarkHTMLUtils.exportToFile(FileUtils.getFile("BMarks", [])).then(
          function onSuccess() {
            shutdownComplete = true;
          },
          function onFailure() {
            // There is no point in reporting errors since we are shutting down.
            shutdownComplete = true;
          }
        );
        var thread = Services.tm.currentThread;
        while (!shutdownComplete) {
          thread.processNextEvent(true);
        }
      }
    } catch(ex) { /* Don't export */ }

    if (!Sanitizer.doPendingSanitize())
      Services.prefs.setBoolPref("privacy.sanitize.didShutdownSanitize", true);
  },

  /**
   * Backup bookmarks if needed.
   */
  _backupBookmarks: function() {
    let lastBackupFile = PlacesBackups.getMostRecent();

    // Backup bookmarks if there are no backups or the maximum interval between
    // backups elapsed.
    if (!lastBackupFile ||
        new Date() - PlacesBackups.getDateForFile(lastBackupFile) > BOOKMARKS_BACKUP_INTERVAL) {
      let maxBackups = BOOKMARKS_BACKUP_MAX_BACKUPS;
      try {
        maxBackups = Services.prefs.getIntPref("browser.bookmarks.max_backups");
      } catch(ex) { /* Use default. */ }

      PlacesBackups.create(maxBackups); // Don't force creation.
    }
  },

  _updatePrefs: function()
  {
    // Get the preferences service
    if (Services.prefs.getPrefType("browser.download.dir") == Services.prefs.PREF_INVALID ||
        Services.prefs.getPrefType("browser.download.lastDir") != Services.prefs.PREF_INVALID)
      return; //Do nothing if .dir does not exist, or if it exists and lastDir does not

    try {
      Services.prefs.setComplexValue("browser.download.lastDir",
                                     Components.interfaces.nsILocalFile,
                                     Services.prefs.getComplexValue("browser.download.dir",
                                                                    Components.interfaces.nsILocalFile));
    } catch (ex) {
      // Ensure that even if we don't end up migrating to a lastDir that we
      // don't attempt another update. This will throw when QI'ed to
      // nsILocalFile, but it does fallback gracefully.
      Services.prefs.setCharPref("browser.download.lastDir", "");
    }

    try {
      Services.prefs.setBoolPref("browser.download.useDownloadDir",
                                 Services.prefs.getBoolPref("browser.download.autoDownload"));
    } catch (ex) {}

    try {
      Services.prefs.setIntPref("browser.download.manager.behavior",
                                Services.prefs.getIntPref("browser.downloadmanager.behavior"));
    } catch (ex) {}

    try {
      Services.prefs.setBoolPref("browser.download.progress.closeWhenDone",
                                 !Services.prefs.getBoolPref("browser.download.progressDnldDialog.keepAlive"));
    } catch (e) {}
  },

  /**
   * Devtools Debugger
   */
  get dbgIsEnabled()
  {
    return Services.prefs.getBoolPref(DEBUGGER_REMOTE_ENABLED);
  },

  dbgStart: function()
  {
    var port = Services.prefs.getIntPref(DEBUGGER_REMOTE_PORT);
    if (!DebuggerServer.initialized) {
      DebuggerServer.init();
      DebuggerServer.addBrowserActors();
    }
    DebuggerServer.openListener(port);
  },

  dbgStop: function()
  {
    if (DebuggerServer.initialized)
      DebuggerServer.closeListener();
  },

  dbgRestart: function()
  {
    this.dbgStop();
    this.dbgStart();
  },

  // ------------------------------
  // public nsISuiteGlue members
  // ------------------------------

  sanitize: function(aParentWindow)
  {
    // call the Sanitizer object's sanitize, which might return errors
    // but do not forward them anywhere, as we are defined as void here
    Sanitizer.sanitize(aParentWindow);
  },

  ensurePlacesDefaultQueriesInitialized:
  function BG_ensurePlacesDefaultQueriesInitialized() {
    // This is actual version of the smart bookmarks, must be increased every
    // time smart bookmarks change.
    // When adding a new smart bookmark below, its newInVersion property must
    // be set to the version it has been added in, we will compare its value
    // to users' smartBookmarksVersion and add new smart bookmarks without
    // recreating old deleted ones.
    const SMART_BOOKMARKS_VERSION = 4;
    const SMART_BOOKMARKS_ANNO = "Places/SmartBookmark";
    const SMART_BOOKMARKS_PREF = "browser.places.smartBookmarksVersion";

    // TODO bug 399268: should this be a pref?
    const MAX_RESULTS = 10;

    // Get current smart bookmarks version.  If not set, create them.
    let smartBookmarksCurrentVersion = 0;
    try {
      smartBookmarksCurrentVersion = Services.prefs.getIntPref(SMART_BOOKMARKS_PREF);
    } catch(ex) {}

    // If version is current or smart bookmarks are disabled, just bail out.
    if (smartBookmarksCurrentVersion == -1 ||
        smartBookmarksCurrentVersion >= SMART_BOOKMARKS_VERSION) {
      return;
    }

    let batch = {
      runBatched: function BG_EPDQI_runBatched() {
        let menuIndex = 0;
        let toolbarIndex = 0;
        let bundle = Services.strings.createBundle("chrome://communicator/locale/places/places.properties");

        let smartBookmarks = {
          MostVisited: {
            title: bundle.GetStringFromName("mostVisitedTitle"),
            uri: NetUtil.newURI("place:sort=" +
                                Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING +
                                "&maxResults=" + MAX_RESULTS),
            parent: PlacesUtils.toolbarFolderId,
            position: toolbarIndex++,
            newInVersion: 1
          },
          RecentlyBookmarked: {
            title: bundle.GetStringFromName("recentlyBookmarkedTitle"),
            uri: NetUtil.newURI("place:folder=BOOKMARKS_MENU" +
                                "&folder=UNFILED_BOOKMARKS" +
                                "&folder=TOOLBAR" +
                                "&queryType=" +
                                Components.interfaces.nsINavHistoryQueryOptions.QUERY_TYPE_BOOKMARKS +
                                "&sort=" +
                                Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_DATEADDED_DESCENDING +
                                "&maxResults=" + MAX_RESULTS +
                                "&excludeQueries=1"),
            parent: PlacesUtils.bookmarksMenuFolderId,
            position: menuIndex++,
            newInVersion: 1
          },
          RecentTags: {
            title: bundle.GetStringFromName("recentTagsTitle"),
            uri: NetUtil.newURI("place:"+
                                "type=" +
                                Components.interfaces.nsINavHistoryQueryOptions.RESULTS_AS_TAG_QUERY +
                                "&sort=" +
                                Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_LASTMODIFIED_DESCENDING +
                                "&maxResults=" + MAX_RESULTS),
            parent: PlacesUtils.bookmarksMenuFolderId,
            position: menuIndex++,
            newInVersion: 1
          }
        };

        // Set current itemId, parent and position if Smart Bookmark exists,
        // we will use these informations to create the new version at the same
        // position.
        let smartBookmarkItemIds = PlacesUtils.annotations.getItemsWithAnnotation(SMART_BOOKMARKS_ANNO);
        smartBookmarkItemIds.forEach(function (itemId) {
          let queryId = PlacesUtils.annotations.getItemAnnotation(itemId, SMART_BOOKMARKS_ANNO);
          if (queryId in smartBookmarks) {
            let smartBookmark = smartBookmarks[queryId];
            smartBookmark.itemId = itemId;
            smartBookmark.parent = PlacesUtils.bookmarks.getFolderIdForItem(itemId);
            smartBookmark.position = PlacesUtils.bookmarks.getItemIndex(itemId);
          } else {
            // We don't remove old Smart Bookmarks because user could still
            // find them useful, or could have personalized them.
            // Instead we remove the Smart Bookmark annotation.
            PlacesUtils.annotations.removeItemAnnotation(itemId, SMART_BOOKMARKS_ANNO);
          }
        });

        for (let queryId in smartBookmarks) {
          let smartBookmark = smartBookmarks[queryId];

          // We update or create only changed or new smart bookmarks.
          // Also we respect user choices, so we won't try to create a smart
          // bookmark if it has been removed.
          if (smartBookmarksCurrentVersion > 0 &&
              smartBookmark.newInVersion <= smartBookmarksCurrentVersion &&
              !smartBookmark.itemId)
            continue;

          // Remove old version of the smart bookmark if it exists, since it
          // will be replaced in place.
          if (smartBookmark.itemId) {
            PlacesUtils.bookmarks.removeItem(smartBookmark.itemId);
          }

          // Create the new smart bookmark and store its updated itemId.
          smartBookmark.itemId =
            PlacesUtils.bookmarks.insertBookmark(smartBookmark.parent,
                                                 smartBookmark.uri,
                                                 smartBookmark.position,
                                                 smartBookmark.title);
          PlacesUtils.annotations.setItemAnnotation(smartBookmark.itemId,
                                                    SMART_BOOKMARKS_ANNO,
                                                    queryId, 0,
                                                    PlacesUtils.annotations.EXPIRE_NEVER);
        }

        // If we are creating all Smart Bookmarks from ground up, add a
        // separator below them in the bookmarks menu.
        if (smartBookmarksCurrentVersion == 0 &&
            smartBookmarkItemIds.length == 0) {
          let id = PlacesUtils.bookmarks.getIdForItemAt(PlacesUtils.bookmarksMenuFolderId,
                                                        menuIndex);
          // Don't add a separator if the menu was empty or there is one already.
          if (id != -1 &&
              PlacesUtils.bookmarks.getItemType(id) != PlacesUtils.bookmarks.TYPE_SEPARATOR) {
            PlacesUtils.bookmarks.insertSeparator(PlacesUtils.bookmarksMenuFolderId,
                                                  menuIndex);
          }
        }
      }
    };

    try {
      PlacesUtils.bookmarks.runInBatchMode(batch, null);
    }
    catch(ex) {
      Components.utils.reportError(ex);
    }
    finally {
      Services.prefs.setIntPref(SMART_BOOKMARKS_PREF, SMART_BOOKMARKS_VERSION);
      Services.prefs.savePrefFile(null);
    }
  },

  /**
   * Called as an observer when Sync's "display URI" notification is fired.
   */
  _onDisplaySyncURI: function _onDisplaySyncURI(data) {
    try {
      var url = data.wrappedJSObject.object.uri;
      var mostRecentBrowserWindow = Services.wm.getMostRecentWindow("navigator:browser");
      if (mostRecentBrowserWindow) {
        mostRecentBrowserWindow.getBrowser().addTab(url, { focusNewTab: true });
        mostRecentBrowserWindow.content.focus();
      } else {
        var args = Components.classes["@mozilla.org/supports-string;1"]
                             .createInstance(Components.interfaces.nsISupportsString);
        args.data = url;
        var chromeURL = Services.prefs.getCharPref("browser.chromeURL");
        Services.ww.openWindow(null, chromeURL, "_blank", "chrome,all,dialog=no", args);
      }
    } catch (e) {
      Components.utils.reportError("Error displaying tab received by Sync: " + e);
    }
  },

  // for XPCOM
  classID: Components.ID("{bbbbe845-5a1b-40ee-813c-f84b8faaa07c}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                         Components.interfaces.nsIWebProgressListener,
                                         Components.interfaces.nsISupportsWeakReference,
                                         Components.interfaces.nsISuiteGlue])

}

function ContentPermissionPrompt() {}

ContentPermissionPrompt.prototype = {
  classID: Components.ID("{9d4c845d-3f09-402a-b66d-50f291d7d50f}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIContentPermissionPrompt]),

  prompt: function(aRequest)
  {
    const kFeatureKeys = { "geolocation" : "geo",
                           "desktop-notification" : "desktop-notification",
                         };

    // Make sure that we support the request.
    if (!(aRequest.type in kFeatureKeys))
      return;

    var path, host;
    var requestingPrincipal = aRequest.principal;
    var requestingURI = requestingPrincipal.URI;

    if (requestingURI instanceof Components.interfaces.nsIFileURL)
      path = requestingURI.file.path;
    else if (requestingURI instanceof Components.interfaces.nsIStandardURL)
      host = requestingURI.host;
    // Ignore requests from non-nsIStandardURLs
    else
      return;

    var perm = kFeatureKeys[aRequest.type];
    switch (Services.perms.testExactPermissionFromPrincipal(requestingPrincipal, perm)) {
      case Services.perms.ALLOW_ACTION:
        aRequest.allow();
        return;
      case Services.perms.DENY_ACTION:
        aRequest.cancel();
        return;
    }

    function allowCallback(remember, expireType) {
      if (remember)
        Services.perms.addFromPrincipal(requestingPrincipal, perm,
                                        Services.perms.ALLOW_ACTION,
                                        expireType);
      aRequest.allow();
    }

    function cancelCallback(remember, expireType) {
      if (remember)
        Services.perms.addFromPrincipal(requestingPrincipal, perm,
                                        Services.perms.DENY_ACTION,
                                        expireType);
      aRequest.cancel();
    }

    var nb = aRequest.window
                     .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIWebNavigation)
                     .QueryInterface(Components.interfaces.nsIDocShell)
                     .chromeEventHandler.parentNode;

    // Show the prompt.
    switch (aRequest.type) {
      case "geolocation":
        nb.showGeolocationPrompt(path, host, allowCallback, cancelCallback);
        break;
      case "desktop-notification":
        if (host)
          nb.showWebNotificationPrompt(host, allowCallback, cancelCallback);
        break;
    }
  },
};

//module initialization
var NSGetFactory = XPCOMUtils.generateNSGetFactory([SuiteGlue, ContentPermissionPrompt]);
