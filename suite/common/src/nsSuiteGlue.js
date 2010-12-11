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
 * The Original Code is the Browser Search Service.
 *
 * The Initial Developer of the Original Code is
 * Giorgio Maone.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Giorgio Maone <g.maone@informaction.com>
 *   Seth Spitzer <sspitzer@mozilla.com>
 *   Asaf Romano <mano@mozilla.com>
 *   Robert Kaiser <kairo@kairo.at>
 *   Nils Maier <maierman@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/Sanitizer.jsm");
Components.utils.import("resource:///modules/mailnewsMigrator.js");

// We try to backup bookmarks at idle times, to avoid doing that at shutdown.
// Number of idle seconds before trying to backup bookmarks.  15 minutes.
const BOOKMARKS_BACKUP_IDLE_TIME = 15 * 60;
// Minimum interval in milliseconds between backups.
const BOOKMARKS_BACKUP_INTERVAL = 86400 * 1000;
// Maximum number of backups to create.  Old ones will be purged.
const BOOKMARKS_BACKUP_MAX_BACKUPS = 10;

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
  _isPlacesInitObserver: false,
  _isPlacesLockedObserver: false,
  _isPlacesShutdownObserver: false,
  _isPlacesDatabaseLocked: false,

  _setPrefToSaveSession: function()
  {
    Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
  },

  // nsIObserver implementation
  observe: function(subject, topic, data)
  {
    switch(topic) {
      case "xpcom-shutdown":
        this._dispose();
        break;
      case "final-ui-startup":
        this._onProfileStartup();
        this._promptForMasterPassword();
        this._checkForNewAddons();
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
      case "session-save":
        this._setPrefToSaveSession();
        subject.QueryInterface(Components.interfaces.nsISupportsPRBool);
        subject.data = true;
        break;
      case "dl-done":
        this._playDownloadSound();
        break;
      case "places-init-complete":
        this._initPlaces();
        Services.obs.removeObserver(this, "places-init-complete");
        this._isPlacesInitObserver = false;
        // No longer needed, since history was initialized completely.
        Services.obs.removeObserver(this, "places-database-locked");
        this._isPlacesLockedObserver = false;
        break;
      case "places-database-locked":
        this._isPlacesDatabaseLocked = true;
        // Stop observing, so further attempts to load history service
        // will not show the prompt.
        Services.obs.removeObserver(this, "places-database-locked");
        this._isPlacesLockedObserver = false;
        break;
      case "places-shutdown":
        if (this._isPlacesShutdownObserver) {
          Services.obs.removeObserver(this, "places-shutdown");
          this._isPlacesShutdownObserver = false;
        }
        // places-shutdown is fired when the profile is about to disappear.
        this._onProfileShutdown();
        break;
      case "idle":
        if (this._idleService.idleTime > BOOKMARKS_BACKUP_IDLE_TIME * 1000)
          this._backupBookmarks();
        break;
      case "bookmarks-restore-success":
      case "bookmarks-restore-failed":
        Services.obs.removeObserver(this, "bookmarks-restore-success");
        Services.obs.removeObserver(this, "bookmarks-restore-failed");
        if (topic == "bookmarks-restore-success" && data == "html-initial")
          this.ensurePlacesDefaultQueriesInitialized();
        break;
    }
  },

  // initialization (called on application startup)
  _init: function()
  {
    // observer registration
    Services.obs.addObserver(this, "xpcom-shutdown", false);
    Services.obs.addObserver(this, "final-ui-startup", false);
    Services.obs.addObserver(this, "sessionstore-windows-restored", false);
    Services.obs.addObserver(this, "browser:purge-session-history", false);
    Services.obs.addObserver(this, "quit-application-requested", false);
    Services.obs.addObserver(this, "quit-application-granted", false);
    Services.obs.addObserver(this, "browser-lastwindow-close-requested", false);
    Services.obs.addObserver(this, "browser-lastwindow-close-granted", false);
    Services.obs.addObserver(this, "session-save", false);
    Services.obs.addObserver(this, "dl-done", false);
    Services.obs.addObserver(this, "places-init-complete", false);
    this._isPlacesInitObserver = true;
    Services.obs.addObserver(this, "places-database-locked", false);
    this._isPlacesLockedObserver = true;
    Services.obs.addObserver(this, "places-shutdown", false);
    this._isPlacesShutdownObserver = true;
    try {
      tryToClose = Components.classes["@mozilla.org/appshell/trytoclose;1"]
                             .getService(Components.interfaces.nsIObserver);
      Services.obs.removeObserver(tryToClose, "quit-application-requested");
      Services.obs.addObserver(tryToClose, "quit-application-requested", true);
    } catch (e) {}
  },

  // cleanup (called on application shutdown)
  _dispose: function()
  {
    // observer removal
    Services.obs.removeObserver(this, "xpcom-shutdown");
    Services.obs.removeObserver(this, "final-ui-startup");
    Services.obs.removeObserver(this, "sessionstore-windows-restored");
    Services.obs.removeObserver(this, "browser:purge-session-history");
    Services.obs.removeObserver(this, "quit-application-requested");
    Services.obs.removeObserver(this, "quit-application-granted");
    Services.obs.removeObserver(this, "browser-lastwindow-close-requested");
    Services.obs.removeObserver(this, "browser-lastwindow-close-granted");
    Services.obs.removeObserver(this, "session-save");
    Services.obs.removeObserver(this, "dl-done");
    if (this._isIdleObserver)
      this._idleService.removeIdleObserver(this, BOOKMARKS_BACKUP_IDLE_TIME);
    if (this._isPlacesInitObserver)
      Services.obs.removeObserver(this, "places-init-complete");
    if (this._isPlacesLockedObserver)
      Services.obs.removeObserver(this, "places-database-locked");
    if (this._isPlacesShutdownObserver)
      Services.obs.removeObserver(this, "places-shutdown");
  },

  // profile startup handler (contains profile initialization routines)
  _onProfileStartup: function()
  {
    this._updatePrefs();
    migrateMailnews(); // mailnewsMigrator.js

    Sanitizer.checkAndSanitize();

    if (Services.prefs.prefHasUserValue("privacy.sanitize.didShutdownSanitize")) {
      Services.prefs.clearUserPref("privacy.sanitize.didShutdownSanitize");
      // We need to persist this preference change, since we want to
      // check it at next app start even if the browser exits abruptly
      Services.prefs.savePrefFile(null);
    }

    // once we support a safe mode popup, it should be called here
  },

  // Browser startup complete. All initial windows have opened.
  _onBrowserStartup: function(aWindow)
  {
    // Show about:rights notification, if needed.
    if (this._shouldShowRights())
      this._showRightsNotification(aWindow);

    // Load the "more info" page for a locked places.sqlite
    // This property is set earlier in the startup process:
    // nsPlacesDBFlush loads after profile-after-change and initializes
    // the history service, which sends out places-database-locked
    // which sets this property.
    if (this._isPlacesDatabaseLocked) {
      this._showPlacesLockedNotificationBox(aWindow);
    }
    // Detect if updates are off and warn for outdated builds.
    if (this._shouldShowUpdateWarning())
      this._showUpdateWarning(aWindow);
  },

  // profile shutdown handler (contains profile cleanup routines)
  _onProfileShutdown: function()
  {
    this._shutdownPlaces();
    Sanitizer.checkAndSanitize();
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

  _showRightsNotification: function(aSubject) {
    // Stick the notification onto the selected tab of the active browser window.
    aSubject.getBrowser().getNotificationBox().showRightsNotification();

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

  _showUpdateWarning: function(aSubject) {
    // Stick the notification onto the selected tab of the active browser window.
    var brandBundle  = Services.strings.createBundle("chrome://branding/locale/brand.properties");
    var applicationName = brandBundle.GetStringFromName("brandShortName");
    var notificationBundle = Services.strings.createBundle("chrome://communicator/locale/notification.properties");
    var title = notificationBundle.GetStringFromName("updatePrompt.title");
    var text = notificationBundle.formatStringFromName("updatePrompt.text", [applicationName], 1);
    var buttonText = notificationBundle.GetStringFromName("updatePromptCheckButton.label");
    var accessKey = notificationBundle.GetStringFromName("updatePromptCheckButton.accessKey");

    var buttons = [{
      label: buttonText,
      accessKey: accessKey,
      popup: null,
      callback: function(aNotificationBar, aButton) {
        Components.classes["@mozilla.org/updates/update-prompt;1"]
                  .createInstance(Components.interfaces.nsIUpdatePrompt)
                  .checkForUpdates();
      }
    }];

    var notifyBox = aSubject.getBrowser().getNotificationBox();
    var box = notifyBox.appendNotification(text, title, null,
                                           notifyBox.PRIORITY_CRITICAL_MEDIUM,
                                           buttons);
    box.persistence = -1; // Until user closes it
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
  _initPlaces: function() {
    // We must instantiate the history service since it will tell us if we
    // need to import or restore bookmarks due to first-run, corruption or
    // forced migration (due to a major schema change).
    var histsvc = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                            .getService(Components.interfaces.nsINavHistoryService);

    Components.utils.import("resource://gre/modules/PlacesUtils.jsm");
    var bookmarksBackupFile = PlacesUtils.backups.getMostRecent("json");

    // If the database is corrupt or has been newly created we should
    // import bookmarks. Same if we don't have any JSON backups, which
    // probably means that we never have used bookmarks in places yet.
    var databaseStatus = histsvc.databaseStatus;
    var importBookmarks = databaseStatus == histsvc.DATABASE_STATUS_CREATE ||
                          databaseStatus == histsvc.DATABASE_STATUS_CORRUPT ||
                          !bookmarksBackupFile;

    if (databaseStatus == histsvc.DATABASE_STATUS_CREATE ||
        !bookmarksBackupFile) {
      // If the database has just been created or we miss a JSON backup, but
      // we already have any bookmark despite that, this is not the initial
      // import. This can happen after a migration from a different browser
      // since migrators run before us, or when someone cleaned out backups.
      // In such a case we should not import, unless some pref has been set.
      var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                            .getService(Components.interfaces.nsINavBookmarksService);
      if (bmsvc.getIdForItemAt(bmsvc.bookmarksMenuFolder, 0) != -1 ||
          bmsvc.getIdForItemAt(bmsvc.toolbarFolder, 0) != -1)
        importBookmarks = false;
    }

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
      else {
        // We have created a new database but we don't have any backup available.
        importBookmarks = true;
        var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
                                   .getService(Components.interfaces.nsIProperties);
        var bookmarksHTMLFile = dirService.get("BMarks", Components.interfaces.nsILocalFile);
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

      // Get bookmarks.html file location.
      var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
                                 .getService(Components.interfaces.nsIProperties);

      var bookmarksFile = null;
      if (restoreDefaultBookmarks) {
        // User wants to restore bookmarks.html file from default profile folder.
        bookmarksFile = dirService.get("profDef", Components.interfaces.nsILocalFile);
        bookmarksFile.append("bookmarks.html");
      }
      else
        bookmarksFile = dirService.get("BMarks", Components.interfaces.nsILocalFile);

      if (bookmarksFile.exists()) {
        // Add an import observer.  It will ensure that smart bookmarks are
        // created once the operation is complete.
        Services.obs.addObserver(this, "bookmarks-restore-success", false);
        Services.obs.addObserver(this, "bookmarks-restore-failed", false);

        // Import from bookmarks.html file.
        try {
          var importer = Components.classes["@mozilla.org/browser/places/import-export-service;1"]
                                   .getService(Components.interfaces.nsIPlacesImportExportService);
          importer.importHTMLFromFile(bookmarksFile, true /* overwrite existing */);
        }
        catch(ex) {
          // Report the error, but ignore it.
          Components.utils.reportError("bookmarks.html file could be corrupt. " + err);
          Services.obs.removeObserver(importObserver, "bookmarks-restore-success");
          Services.obs.removeObserver(importObserver, "bookmarks-restore-failed");
        }
      }
      else
        Components.utils.reportError("Unable to find bookmarks.html file.");

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
   *
   * Note: quit-application-granted notification is received twice
   *       so replace this method with a no-op when first called.
   */
  _shutdownPlaces: function() {
    if (this._isIdleObserver) {
      this._idleService.removeIdleObserver(this, BOOKMARKS_BACKUP_IDLE_TIME);
      this._isIdleObserver = false;
    }
    this._backupBookmarks();

    // Backup bookmarks to bookmarks.html to support apps that depend
    // on the legacy format.
    var autoExportHTML = false;
    try {
      autoExportHTML = Services.prefs.getBoolPref("browser.bookmarks.autoExportHTML");
    } catch(ex) { /* Don't export */ }

    if (autoExportHTML) {
      Components.classes["@mozilla.org/browser/places/import-export-service;1"]
                .getService(Components.interfaces.nsIPlacesImportExportService)
                .backupBookmarksFile();
    }
  },

  /**
   * Backup bookmarks if needed.
   */
  _backupBookmarks: function() {
    Components.utils.import("resource://gre/modules/PlacesUtils.jsm");

    let lastBackupFile = PlacesUtils.backups.getMostRecent();

    // Backup bookmarks if there are no backups or the maximum interval between
    // backups elapsed.
    if (!lastBackupFile ||
        new Date() - PlacesUtils.backups.getDateForFile(lastBackupFile) > BOOKMARKS_BACKUP_INTERVAL) {
      let maxBackups = BOOKMARKS_BACKUP_MAX_BACKUPS;
      try {
        maxBackups = Services.prefs.getIntPref("browser.bookmarks.max_backups");
      } catch(ex) { /* Use default. */ }

      PlacesUtils.backups.create(maxBackups); // Don't force creation.
    }
  },

  /**
   * Show the notificationBox for a locked places database.
   */
  _showPlacesLockedNotificationBox: function(aSubject) {
    // Stick the notification onto the selected tab of the active browser window.
    var brandBundle  = Services.strings.createBundle("chrome://branding/locale/brand.properties");
    var applicationName = brandBundle.GetStringFromName("brandShortName");
    var placesBundle = Services.strings.createBundle("chrome://communicator/locale/places/places.properties");
    var title = placesBundle.GetStringFromName("lockPrompt.title");
    var text = placesBundle.formatStringFromName("lockPrompt.text", [applicationName], 1);
    var buttonText = placesBundle.GetStringFromName("lockPromptInfoButton.label");
    var accessKey = placesBundle.GetStringFromName("lockPromptInfoButton.accessKey");

    var helpTopic = "places-locked";
    var helpRDF = "chrome://communicator/locale/help/suitehelp.rdf";

    var buttons = [{
      label: buttonText,
      accessKey: accessKey,
      popup: null,
      callback: function(aNotificationBar, aButton) {
        aSubject.openHelp(helpTopic, helpRDF);
      }
    }];

    var notifyBox = aSubject.getBrowser().getNotificationBox();
    var box = notifyBox.appendNotification(text, title, null,
                                           notifyBox.PRIORITY_CRITICAL_MEDIUM,
                                           buttons);
    box.persistence = -1; // Until user closes it
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
    const SMART_BOOKMARKS_VERSION = 2;
    const SMART_BOOKMARKS_ANNO = "Places/SmartBookmark";
    const SMART_BOOKMARKS_PREF = "browser.places.smartBookmarksVersion";

    // TODO bug 399268: should this be a pref?
    const MAX_RESULTS = 10;

    // Get current smart bookmarks version.
    // By default, if the pref is not set up, we must create Smart Bookmarks.
    var smartBookmarksCurrentVersion = 0;
    try {
      smartBookmarksCurrentVersion = Services.prefs.getIntPref(SMART_BOOKMARKS_PREF);
    } catch(ex) { /* no version set, new profile */ }

    // Bail out if we don't have to create or update Smart Bookmarks.
    if (smartBookmarksCurrentVersion == -1 ||
        smartBookmarksCurrentVersion >= SMART_BOOKMARKS_VERSION)
      return;

    var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                          .getService(Components.interfaces.nsINavBookmarksService);
    var annosvc = Components.classes["@mozilla.org/browser/annotation-service;1"]
                            .getService(Components.interfaces.nsIAnnotationService);

    var callback = {
      _uri: function BG_EPDQI__uri(aSpec) {
        return Services.io.newURI(aSpec, null, null);
      },

      runBatched: function BG_EPDQI_runBatched() {
        var smartBookmarks = [];
        var bookmarksMenuIndex = 0;
        var bookmarksToolbarIndex = 0;

        var placesBundle = Services.strings.createBundle("chrome://communicator/locale/places/places.properties");

        // MOST VISITED
        var smart = {queryId: "MostVisited", // don't change this
                     itemId: null,
                     title: placesBundle.GetStringFromName("mostVisitedTitle"),
                     uri: this._uri("place:redirectsMode=" +
                                    Components.interfaces.nsINavHistoryQueryOptions.REDIRECTS_MODE_TARGET +
                                    "&sort=" +
                                    Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING +
                                    "&maxResults=" + MAX_RESULTS),
                     parent: bmsvc.toolbarFolder,
                     position: bookmarksToolbarIndex++,
                     newInVersion: 1 };
        smartBookmarks.push(smart);

        // RECENTLY BOOKMARKED
        smart = {queryId: "RecentlyBookmarked", // don't change this
                 itemId: null,
                 title: placesBundle.GetStringFromName("recentlyBookmarkedTitle"),
                 uri: this._uri("place:folder=BOOKMARKS_MENU" +
                                "&folder=UNFILED_BOOKMARKS" +
                                "&folder=TOOLBAR" +
                                "&queryType=" +
                                Components.interfaces.nsINavHistoryQueryOptions.QUERY_TYPE_BOOKMARKS +
                                "&sort=" +
                                Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_DATEADDED_DESCENDING +
                                "&excludeItemIfParentHasAnnotation=livemark%2FfeedURI" +
                                "&maxResults=" + MAX_RESULTS +
                                "&excludeQueries=1"),
                 parent: bmsvc.bookmarksMenuFolder,
                 position: bookmarksMenuIndex++,
                 newInVersion: 1 };
        smartBookmarks.push(smart);

        // RECENT TAGS
        smart = {queryId: "RecentTags", // don't change this
                 itemId: null,
                 title: placesBundle.GetStringFromName("recentTagsTitle"),
                 uri: this._uri("place:"+
                    "type=" +
                    Components.interfaces.nsINavHistoryQueryOptions.RESULTS_AS_TAG_QUERY +
                    "&sort=" +
                    Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_LASTMODIFIED_DESCENDING +
                    "&maxResults=" + MAX_RESULTS),
                 parent: bmsvc.bookmarksMenuFolder,
                 position: bookmarksMenuIndex++,
                 newInVersion: 1 };
        smartBookmarks.push(smart);

        var smartBookmarkItemIds = annosvc.getItemsWithAnnotation(SMART_BOOKMARKS_ANNO);
        // Set current itemId, parent and position if Smart Bookmark exists,
        // we will use these informations to create the new version at the same
        // position.
        for each(var itemId in smartBookmarkItemIds) {
          var queryId = annosvc.getItemAnnotation(itemId, SMART_BOOKMARKS_ANNO);
          for (var i = 0; i < smartBookmarks.length; i++){
            if (smartBookmarks[i].queryId == queryId) {
              smartBookmarks[i].found = true;
              smartBookmarks[i].itemId = itemId;
              smartBookmarks[i].parent = bmsvc.getFolderIdForItem(itemId);
              smartBookmarks[i].position = bmsvc.getItemIndex(itemId);
              // Remove current item, since it will be replaced.
              bmsvc.removeItem(itemId);
              break;
            }
            // We don't remove old Smart Bookmarks because user could still
            // find them useful, or could have personalized them.
            // Instead we remove the Smart Bookmark annotation.
            if (i == smartBookmarks.length - 1)
              annosvc.removeItemAnnotation(itemId, SMART_BOOKMARKS_ANNO);
          }
        }

        // Create smart bookmarks.
        for each(var smartBookmark in smartBookmarks) {
          // We update or create only changed or new smart bookmarks.
          // Also we respect user choices, so we won't try to create a smart
          // bookmark if it has been removed.
          if (smartBookmarksCurrentVersion > 0 &&
              smartBookmark.newInVersion <= smartBookmarksCurrentVersion &&
              !smartBookmark.found)
            continue;

          smartBookmark.itemId = bmsvc.insertBookmark(smartBookmark.parent,
                                                      smartBookmark.uri,
                                                      smartBookmark.position,
                                                      smartBookmark.title);
          annosvc.setItemAnnotation(smartBookmark.itemId,
                                    SMART_BOOKMARKS_ANNO, smartBookmark.queryId,
                                    0, annosvc.EXPIRE_NEVER);
        }

        // If we are creating all Smart Bookmarks from ground up, add a
        // separator below them in the bookmarks menu.
        if (smartBookmarksCurrentVersion == 0 &&
            smartBookmarkItemIds.length == 0) {
          let id = bmsvc.getIdForItemAt(bmsvc.bookmarksMenuFolder,
                                        bookmarksMenuIndex);
          // Don't add a separator if the menu was empty or there is one already.
          if (id != -1 && bmsvc.getItemType(id) != bmsvc.TYPE_SEPARATOR)
            bmsvc.insertSeparator(bmsvc.bookmarksMenuFolder, bookmarksMenuIndex);
       }
      }
    };

    try {
      bmsvc.runInBatchMode(callback, null);
    }
    catch(ex) {
      Components.utils.reportError(ex);
    }
    finally {
      Services.prefs.setIntPref(SMART_BOOKMARKS_PREF, SMART_BOOKMARKS_VERSION);
      Services.prefs.savePrefFile(null);
    }
  },


  // for XPCOM
  classID: Components.ID("{bbbbe845-5a1b-40ee-813c-f84b8faaa07c}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                         Components.interfaces.nsISupportsWeakReference,
                                         Components.interfaces.nsISuiteGlue])

}

function ContentPermissionPrompt() {}

ContentPermissionPrompt.prototype = {
  classID: Components.ID("{9d4c845d-3f09-402a-b66d-50f291d7d50f}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIContentPermissionPrompt]),

  prompt: function(aRequest)
  {
    if (aRequest.type != "geolocation")
      return;

    var path, host;
    var requestingURI = aRequest.uri;
    if (requestingURI instanceof Components.interfaces.nsIFileURL)
      path = requestingURI.file.path;
    else if (requestingURI instanceof Components.interfaces.nsIStandardURL)
      host = requestingURI.host;
    // Ignore requests from non-nsIStandardURLs
    else
      return;

    switch (Services.perms.testExactPermission(requestingURI, "geo")) {
      case Services.perms.ALLOW_ACTION:
        aRequest.allow();
        return;
      case Services.perms.DENY_ACTION:
        aRequest.cancel();
        return;
    }

    function allowCallback(remember) {
      if (remember)
        Services.perms.add(requestingURI, "geo", Services.perms.ALLOW_ACTION);
      aRequest.allow();
    }

    function cancelCallback(remember) {
      if (remember)
        Services.perms.add(requestingURI, "geo", Services.perms.DENY_ACTION);
      aRequest.cancel();
    }

    aRequest.window
            .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIWebNavigation)
            .QueryInterface(Components.interfaces.nsIDocShell)
            .chromeEventHandler.parentNode.wrappedJSObject
            .showGeolocationPrompt(path, host,
                                   "chrome://communicator/skin/icons/geo.png",
                                   allowCallback,
                                   cancelCallback);
  },
};

//module initialization
var NSGetFactory = XPCOMUtils.generateNSGetFactory([SuiteGlue, ContentPermissionPrompt]);
