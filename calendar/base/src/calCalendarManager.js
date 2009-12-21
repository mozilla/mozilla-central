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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Michiel van Leeuwen <mvl@exedo.nl>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const REGISTRY_BRANCH = "calendar.registry.";
const DB_SCHEMA_VERSION = 10;

function getPrefBranchFor(id) {
    return (REGISTRY_BRANCH + id + ".");
}

function createStatement(dbconn, sql) {
    let stmt = dbconn.createStatement(sql);
    let wrapper = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
                            .createInstance(Components.interfaces.mozIStorageStatementWrapper);
    wrapper.initialize(stmt);
    return wrapper;
}

function calCalendarManager() {
    this.wrappedJSObject = this;
    this.mObservers = new calListenerBag(Components.interfaces.calICalendarManagerObserver);
    this.setUpStartupObservers();
}

var calCalendarManagerClassInfo = {
    getInterfaces: function (count) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calICalendarManager,
            Components.interfaces.nsIObserver,
            Components.interfaces.nsIClassInfo
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/manager;1",
    classDescription: "Calendar Manager",
    classID: Components.ID("{f42585e7-e736-4600-985d-9624c1c51992}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON
};

calCalendarManager.prototype = {
    QueryInterface: function (aIID) {
        return doQueryInterface(this,
                                calCalendarManager.prototype,
                                aIID,
                                null,
                                calCalendarManagerClassInfo);
    },

    get networkCalendarCount() {
        return this.mNetworkCalendarCount;
    },

    get readOnlyCalendarCount() {
        return this.mReadonlyCalendarCount;
    },

    get calendarCount() {
        return this.mCalendarCount;
    },
    
    setUpStartupObservers: function ccm_setUpStartupObservers() {
        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);

        observerSvc.addObserver(this, "profile-after-change", false);
        observerSvc.addObserver(this, "profile-before-change", false);
        observerSvc.addObserver(this, "em-action-requested", false);
    },
    
    startup: function ccm_startup() {
        this.checkAndMigrateDB();
        this.mCache = null;
        this.mCalObservers = null;
        this.mRefreshTimer = null;
        this.setUpPrefObservers();
        this.setUpRefreshTimer();
        this.setupOfflineObservers();
        if (cal.isSunbird()) {
            this.loginMasterPassword();
        }
        this.mNetworkCalendarCount = 0;
        this.mReadonlyCalendarCount = 0;
        this.mCalendarCount = 0;
    },
    
    shutdown: function ccm_shutdown() {
        for each (var cal in this.mCache) {
            cal.removeObserver(this.mCalObservers[cal.id]);
        }

        this.cleanupPrefObservers();
        this.cleanupOfflineObservers();

        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);

        observerSvc.removeObserver(this, "profile-after-change");
        observerSvc.removeObserver(this, "profile-before-change");
        observerSvc.removeObserver(this, "em-action-requested");
    },

    setUpPrefObservers: function ccm_setUpPrefObservers() {
        var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch2);
        prefBranch.addObserver("calendar.autorefresh.enabled", this, false);
        prefBranch.addObserver("calendar.autorefresh.timeout", this, false);
    },
    
    cleanupPrefObservers: function ccm_cleanupPrefObservers() {
        var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch2);
        prefBranch.removeObserver("calendar.autorefresh.enabled", this);
        prefBranch.removeObserver("calendar.autorefresh.timeout", this);
    },

    setUpRefreshTimer: function ccm_setUpRefreshTimer() {
        if (this.mRefreshTimer) {
            this.mRefreshTimer.cancel();
        }

        var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);

        var refreshEnabled = false;
        try {
            var refreshEnabled = prefBranch.getBoolPref("calendar.autorefresh.enabled");
        } catch (e) {
        }

        // Read and convert the minute-based pref to msecs
        var refreshTimeout = 0;
        try {
            var refreshTimeout = prefBranch.getIntPref("calendar.autorefresh.timeout") * 60000;
        } catch (e) {
        }

        if (refreshEnabled && refreshTimeout > 0) {
            this.mRefreshTimer = Components.classes["@mozilla.org/timer;1"]
                                    .createInstance(Components.interfaces.nsITimer);
            this.mRefreshTimer.init(this, refreshTimeout,
                                   Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
        }
    },

    setupOfflineObservers: function ccm_setupOfflineObservers() {
        var os = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
        os.addObserver(this, "network:offline-status-changed", false);
    },

    cleanupOfflineObservers: function ccm_cleanupOfflineObservers() {
        var os = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
        os.removeObserver(this, "network:offline-status-changed");
    },

    loginMasterPassword: function ccm_loginMasterPassword() {
        // Try to avoid the multiple master password prompts on startup scenario
        // by prompting for the master password upfront.
        let token = Components.classes["@mozilla.org/security/pk11tokendb;1"]
                              .getService(Components.interfaces.nsIPK11TokenDB)
                              .getInternalKeyToken();

        // Only log in to the internal token if it is already initialized,
        // otherwise we get a "Change Master Password" dialog.
        try {
            if (!token.needsUserInit) {
                token.login(false);
            }
        } catch (ex) {
            // If user cancels an exception is expected.
        }
    },

    observe: function ccm_observe(aSubject, aTopic, aData) {
        switch (aTopic) {
            case "profile-after-change":
                this.startup();
                break;
            case "profile-before-change":
                this.shutdown();
                break;
            case "timer-callback":
                // Refresh all the calendars that can be refreshed.
                var cals = this.getCalendars({});
                for each (var cal in cals) {
                    if (!cal.getProperty("disabled") && cal.canRefresh) {
                        cal.refresh();
                    }
                }
                break;
            case "nsPref:changed":
                if (aData == "calendar.autorefresh.enabled" ||
                    aData == "calendar.autorefresh.timeout") {
                    this.setUpRefreshTimer();
                }
                break;
            case "network:offline-status-changed":
                for each (var calendar in this.mCache) {
                    if (calendar instanceof calCachedCalendar) {
                        calendar.onOfflineStatusChanged(aData == "offline");
                    }
                }
                break;
            case "em-action-requested":
                let extension = aSubject.QueryInterface(Components.interfaces.nsIUpdateItem);
                let extMgr = Components.classes["@mozilla.org/extensions/manager;1"]
                                       .getService(Components.interfaces.nsIExtensionManager);
                try {
                    switch (aData) {
                        case "item-disabled":
                            if (!this.queryUninstallProvider(extension)) {
                                // If the extension should not be disabled,
                                // then re-enable it. 
                                extMgr.enableItem(extension.id);
                            }
                            break;
                        case "item-uninstalled":
                            if (!this.queryUninstallProvider(extension)) {
                                // If the extension should not be uninstalled,
                                // then cancel the uninstall
                                extMgr.cancelUninstallItem(extension.id);
                            }
                            break;
                    }
                } catch (e) {
                    // It seems this observer swallows exceptions
                    cal.ERROR(e);
                }
                break;
        }

    },

    queryUninstallProvider: function cCM_queryUninstallProvider(aExtension) {
        const uri = "chrome://calendar/content/calendar-providerUninstall-dialog.xul";
        const features = "chrome,titlebar,resizable,modal";
        let affectedCalendars =
            [ cal for each (cal in this.getCalendars({}))
              if (cal.providerID == aExtension.id) ];
        if (!affectedCalendars.length) {
            // If no calendars are affected, then everything is fine.
            return true;
        }

        let args = { shouldUninstall: false, extension: aExtension };

        // Now find a window. The best choice would be the most recent
        // addons window, otherwise the most recent calendar window, or we
        // create a new toplevel window.
        let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
        let win = wm.getMostRecentWindow("Extension:Manager") ||
                  cal.getCalendarWindow();
        if (win) {
            win.openDialog(uri, "CalendarProviderUninstallDialog", features, args);
        } else {
            // Use the window watcher to open a parentless window.
            let ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                               .getService(Components.interfaces.nsIWindowWatcher);
            ww.openWindow(null, uri, "CalendarProviderUninstallWindow", features, args);
        }


        // Now that we are done, check if the dialog was accepted or canceled.
        return args.shouldUninstall;
    },

    //
    // DB migration code begins here
    //

    upgradeDB: function(oldVersion, db) {
        // some common helpers
        function addColumn(db_, tableName, colName, colType) {
            db_.executeSimpleSQL("ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colType);
        }

        if (oldVersion < 6) {
            dump ("**** Upgrading calCalendarManager schema to 6\n");

            // Schema changes in v6:
            //
            // - Change all STRING columns to TEXT to avoid SQLite's
            //   "feature" where it will automatically convert strings to
            //   numbers (ex: 10e4 -> 10000). See bug 333688.

            // Create the new tables.

            try { 
                db.executeSimpleSQL("DROP TABLE cal_calendars_v6; DROP TABLE cal_calendars_prefs_v6;");
            } catch (e) {
                // We should get exceptions for trying to drop tables
                // that don't (shouldn't) exist.
            }

            db.executeSimpleSQL("CREATE TABLE cal_calendars_v6 " +
                                "(id   INTEGER PRIMARY KEY," +
                                " type TEXT," +
                                " uri  TEXT);");

            db.executeSimpleSQL("CREATE TABLE cal_calendars_prefs_v6 " +
                                "(id       INTEGER PRIMARY KEY," +
                                " calendar INTEGER," +
                                " name     TEXT," +
                                " value    TEXT);");

            // Copy in the data.
            var calendarCols = ["id", "type", "uri"];
            var calendarPrefsCols = ["id", "calendar", "name", "value"];

            db.executeSimpleSQL("INSERT INTO cal_calendars_v6(" + calendarCols.join(",") + ") " +
                                "     SELECT " + calendarCols.join(",") +
                                "       FROM cal_calendars");

            db.executeSimpleSQL("INSERT INTO cal_calendars_prefs_v6(" + calendarPrefsCols.join(",") + ") " +
                                "     SELECT " + calendarPrefsCols.join(",") +
                                "       FROM cal_calendars_prefs");

            // Delete each old table and rename the new ones to use the
            // old tables' names.
            var tableNames = ["cal_calendars", "cal_calendars_prefs"];

            for (var i in tableNames) {
                db.executeSimpleSQL("DROP TABLE " + tableNames[i] + ";" +
                                    "ALTER TABLE " + tableNames[i] + "_v6 " + 
                                    "  RENAME TO " + tableNames[i] + ";");
            }

            oldVersion = 8;
        }

        if (oldVersion < DB_SCHEMA_VERSION) {
            dump ("**** Upgrading calCalendarManager schema to 9/10\n");

            if (db.tableExists("cal_calmgr_schema_version")) {
                // Set only once the last time to v10, so the version check works in calendar 0.8.
                // In calendar 0.9 and following, the provider itself will check its version
                // on initialization and notify the calendar whether it's usable or not.
                db.executeSimpleSQL("UPDATE cal_calmgr_schema_version SET version = " + DB_SCHEMA_VERSION + ";");
            } else {
                // Schema changes in v9:
                //
                // - Decouple schema version from storage calendar
                // Create the new tables.
                db.executeSimpleSQL("CREATE TABLE cal_calmgr_schema_version (version INTEGER);");
                db.executeSimpleSQL("INSERT INTO cal_calmgr_schema_version VALUES(" + DB_SCHEMA_VERSION + ")");
            }
        }
    },

    migrateDB: function calmgr_migrateDB(db) {
        let selectCalendars = createStatement(db, "SELECT * FROM cal_calendars");
        let selectPrefs = createStatement(db, "SELECT name, value FROM cal_calendars_prefs WHERE calendar = :calendar");
        try {
            let sortOrder = {};

            while (selectCalendars.step()) {
                let id = cal.getUUID(); // use fresh uuids
                cal.setPref(getPrefBranchFor(id) + "type", selectCalendars.row.type);
                cal.setPref(getPrefBranchFor(id) + "uri", selectCalendars.row.uri);
                // the former id served as sort position:
                sortOrder[selectCalendars.row.id] = id;
                // move over prefs:
                selectPrefs.params.calendar = selectCalendars.row.id;
                while (selectPrefs.step()) {
                    let name = selectPrefs.row.name.toLowerCase(); // may come lower case, so force it to be
                    let value = selectPrefs.row.value;
                    switch (name) {
                        case "readonly":
                            cal.setPref(getPrefBranchFor(id) + "readOnly", value == "true");
                            break;
                        case "relaxedmode":
                            cal.setPref(getPrefBranchFor(id) + "relaxedMode", value == "true");
                            break;
                        case "suppressalarms":
                            cal.setPref(getPrefBranchFor(id) + "suppressAlarms", value == "true");
                            break;
                        case "disabled":
                        case "cache.supported":
                        case "auto-enabled":
                        case "cache.enabled":
                        case "lightning-main-in-composite":
                        case "calendar-main-in-composite":
                        case "lightning-main-default":
                        case "calendar-main-default":
                            cal.setPref(getPrefBranchFor(id) + name, value == "true");
                            break;
                        case "cache.updatetimer":
                            cal.setPref(getPrefBranchFor(id) + "cache.updateTimer", Number(value));
                            break;
                        case "backup-time":
                        case "uniquenum":
                            cal.setPref(getPrefBranchFor(id) + name, Number(value));
                            break;
                        case "name":
                            cal.setLocalizedPref(getPrefBranchFor(id) + name, value);
                            break;
                        default: // keep as string
                            cal.setPref(getPrefBranchFor(id) + name, value);
                            break;
                    }
                }
                selectPrefs.reset();
            }

            let sortOrderAr = [];
            for each (let s in sortOrder) {
                sortOrderAr.push(s);
            }
            cal.setPref("calendar.list.sortOrder", sortOrderAr.join(" "));

        } finally {
            selectPrefs.reset();
            selectCalendars.reset();
        }
    },

    checkAndMigrateDB: function calmgr_checkAndMigrateDB() {
        let dbService = Components.classes["@mozilla.org/storage/service;1"]
                                  .getService(Components.interfaces.mozIStorageService);
        db = dbService.openSpecialDatabase("profile");

        db.beginTransactionAs(Components.interfaces.mozIStorageConnection.TRANSACTION_EXCLUSIVE);
        try {
            if (db.tableExists("cal_calendars_prefs")) {
                // Check if we need to upgrade:
                let version = this.getSchemaVersion(db);
                //cal.LOG("*** Calendar schema version is: " + version);
                if (version < DB_SCHEMA_VERSION) {
                    this.upgradeDB(version, db);
                }

                this.migrateDB(db);

                db.executeSimpleSQL("DROP TABLE cal_calendars; " +
                                    "DROP TABLE cal_calendars_prefs; " +
                                    "DROP TABLE cal_calmgr_schema_version;");
            }

            if (!db.tableExists("cal_calendars")) {
                // create dummy cal_calendars, so previous versions (pre 1.0pre) run into the schema check:
                db.createTable("cal_calendars", "id INTEGER");
                // let schema checks always fail, we cannot take the shared cal_calendar_schema_version:
                db.createTable("cal_calmgr_schema_version", "version INTEGER");
                db.executeSimpleSQL("INSERT INTO cal_calmgr_schema_version VALUES(" + (DB_SCHEMA_VERSION + 1) + ")");
                db.commitTransaction();
            } else {
                db.rollbackTransaction();
            }
        } catch (exc) {
            db.rollbackTransaction();
            throw exc;
        }
    },

    /** 
     * @return      db schema version
     * @exception   various, depending on error
     */
    getSchemaVersion: function calMgrGetSchemaVersion(db) {
        var stmt;
        var version = null;

        var table;
        if (db.tableExists("cal_calmgr_schema_version")) {
            table = "cal_calmgr_schema_version";
        } else {
            // Fall back to the old schema table
            table = "cal_calendar_schema_version";
        }

        try {
            stmt = createStatement(db, "SELECT version FROM " + table + " LIMIT 1");
            if (stmt.step()) {
                version = stmt.row.version;
            }
            stmt.reset();

            if (version !== null) {
                // This is the only place to leave this function gracefully.
                return version;
            }
        } catch (e) {
            if (stmt) {
                stmt.reset();
            }
            cal.ERROR("++++++++++++ calMgrGetSchemaVersion() error: " + db.lastErrorString);
            Components.utils.reportError("Error getting calendar schema version! DB Error: " + db.lastErrorString);
            throw e;
        }

        throw table + " SELECT returned no results";
    },

    //
    // / DB migration code ends here
    //

    alertAndQuit: function cmgr_alertAndQuit() {
        // If we're Lightning, we want to include the extension name
        // in the error message rather than blaming Thunderbird.
        var errorBoxTitle;
        var errorBoxText;
        var errorBoxButtonLabel;
        var hostAppName = calGetString("brand", "brandShortName", null, "branding");
        if (isSunbird()) {
            errorBoxTitle = calGetString("calendar", "tooNewSchemaErrorBoxTitle", [hostAppName]);
            errorBoxText = calGetString("calendar", "tooNewSchemaErrorBoxTextSunbird", [hostAppName]);
            errorBoxButtonLabel = calGetString("calendar", "tooNewSchemaButtonQuit", [hostAppName]);
        } else {
            var calAppName = calGetString("lightning", "brandShortName", null, "lightning");
            errorBoxTitle = calGetString("calendar", "tooNewSchemaErrorBoxTitle", [calAppName]);
            errorBoxText = calGetString("calendar", "tooNewSchemaErrorBoxTextLightning", [calAppName, hostAppName]);
            errorBoxButtonLabel = calGetString("calendar", "tooNewSchemaButtonRestart", [hostAppName]);
        }

        var promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);

        var errorBoxButtonFlags = (promptSvc.BUTTON_POS_0 *
                                   promptSvc.BUTTON_TITLE_IS_STRING +
                                   promptSvc.BUTTON_POS_0_DEFAULT);

        var choice = promptSvc.confirmEx(null,
                                         errorBoxTitle,
                                         errorBoxText,
                                         errorBoxButtonFlags,
                                         errorBoxButtonLabel,
                                         null, // No second button text
                                         null, // No third button text
                                         null, // No checkbox
                                         { value: false }); // Unnecessary checkbox state

        var startup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                                .getService(Components.interfaces.nsIAppStartup);
        if (isSunbird()) {
            startup.quit(Components.interfaces.nsIAppStartup.eForceQuit);
        } else {
            var em = Components.classes["@mozilla.org/extensions/manager;1"]
                               .getService(Components.interfaces.nsIExtensionManager);
            em.disableItem("{e2fda1a4-762b-4020-b5ad-a41df1933103}"); // i.e. Lightning
            startup.quit(Components.interfaces.nsIAppStartup.eRestart |
                         Components.interfaces.nsIAppStartup.eForceQuit);
        }
    },

    notifyObservers: function(functionName, args) {
        this.mObservers.notify(functionName, args);
    },

    /**
     * calICalendarManager interface
     */
    createCalendar: function cmgr_createCalendar(type, uri) {
        try {
            if (!Components.classes["@mozilla.org/calendar/calendar;1?type=" + type]) {
                // Don't notify the user with an extra dialog if the provider
                // interface is missing.
                return null;
            }
            let calendar = Components.classes["@mozilla.org/calendar/calendar;1?type=" + type]
                                     .createInstance(Components.interfaces.calICalendar);
            calendar.uri = uri;
            return calendar;
        } catch (ex) {
            let rc = ex;
            let uiMessage = ex;
            if (ex instanceof Components.interfaces.nsIException) {
                rc = ex.result;
                uiMessage = ex.message;
            }
            switch (rc) {
                case Components.interfaces.calIErrors.STORAGE_UNKNOWN_SCHEMA_ERROR:
                    // For now we alert and quit on schema errors like we've done before:
                    this.alertAndQuit();
                case Components.interfaces.calIErrors.STORAGE_UNKNOWN_TIMEZONES_ERROR:
                    uiMessage = calGetString("calendar", "unknownTimezonesError", [uri.spec]);
                    break;
                default:
                    uiMessage = calGetString("calendar", "unableToCreateProvider", [uri.spec]);
                    break;
            }
            // Log the original exception via error console to provide more debug info
            cal.ERROR(ex);

            // Log the possibly translated message via the UI.
            let paramBlock = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                                       .createInstance(Components.interfaces.nsIDialogParamBlock);
            paramBlock.SetNumberStrings(3);
            paramBlock.SetString(0, uiMessage);
            paramBlock.SetString(1, "0x" + rc.toString(0x10));
            paramBlock.SetString(2, ex);
            let wWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                     .getService(Components.interfaces.nsIWindowWatcher);
            wWatcher.openWindow(null,
                                "chrome://calendar/content/calErrorPrompt.xul",
                                "_blank",
                                "chrome,dialog=yes,alwaysRaised=yes",
                                paramBlock);
            return null;
        }
    },

    registerCalendar: function(calendar) {
        // bail if this calendar (or one that looks identical to it) is already registered
        cal.ASSERT(calendar.id === null, "[calCalendarManager::registerCalendar] calendar already registered!", true);
        this.assureCache();

        calendar.id = cal.getUUID();
        cal.setPref(getPrefBranchFor(calendar.id) + "type", calendar.type);
        cal.setPref(getPrefBranchFor(calendar.id) + "uri", calendar.uri.spec);

        this.setupCalendar(calendar);

        if (!calendar.getProperty("disabled") && calendar.canRefresh) {
            calendar.refresh();
        }

        this.notifyObservers("onCalendarRegistered", [calendar]);
    },

    setupCalendar: function cmgr_setupCalendar(calendar) {
        this.mCache[calendar.id] = calendar;

        // Add an observer to track readonly-mode triggers
        var newObserver = new calMgrCalendarObserver(calendar, this);
        calendar.addObserver(newObserver);
        this.mCalObservers[calendar.id] = newObserver;

        // Set up statistics
        if (calendar.getProperty("requiresNetwork") !== false) {
            this.mNetworkCalendarCount++;
        }
        if (calendar.readOnly) {
            this.mReadonlyCalendarCount++;
        }
        this.mCalendarCount++;
    },

    unregisterCalendar: function(calendar) {
        this.notifyObservers("onCalendarUnregistering", [calendar]);

        // calendar may be a calICalendar wrapper:
        if (calendar.wrappedJSObject instanceof calCachedCalendar) {
            calendar.wrappedJSObject.onCalendarUnregistering();
        }

        calendar.removeObserver(this.mCalObservers[calendar.id]);

        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch);
        prefService.deleteBranch(getPrefBranchFor(calendar.id));

        if (this.mCache) {
            delete this.mCache[calendar.id];
        }

        if (calendar.readOnly) {
            this.mReadonlyCalendarCount--;
        }

        if (calendar.getProperty("requiresNetwork") !== false) {
            this.mNetworkCalendarCount--;
        }
        this.mCalendarCount--;
    },

    deleteCalendar: function(calendar) {
        /* check to see if calendar is unregistered first... */
        /* delete the calendar for good */
        if (this.mCache && (calendar.id in this.mCache)) {
            throw "Can't delete a registered calendar";
        }
        this.notifyObservers("onCalendarDeleting", [calendar]);

        // XXX This is a workaround for bug 351499. We should remove it once
        // we sort out the whole "delete" vs. "unsubscribe" UI thing.
        //
        // We only want to delete the contents of calendars from local
        // providers (storage and memory). Otherwise we may nuke someone's
        // calendar stored on a server when all they really wanted to do was
        // unsubscribe.
        if (cal.calInstanceOf(calendar, Components.interfaces.calICalendarProvider) &&
            (calendar.type == "storage" || calendar.type == "memory")) {
            try {
                calendar.deleteCalendar(calendar, null);
            } catch (e) {
                Components.utils.reportError("error purging calendar: " + e);
            }
        }
    },

    getCalendars: function cmgr_getCalendars(count) {
        this.assureCache();
        var calendars = [];
        for each (var cal in this.mCache) {
            calendars.push(cal);
        }
        count.value = calendars.length;
        return calendars;
    },

    assureCache: function cmgr_assureCache() {
        if (!this.mCache) {
            this.mCache = {};
            this.mCalObservers = {};

            let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                        .getService(Components.interfaces.nsIPrefBranch);
            let allCals = {};
            for each (let key in prefService.getChildList(REGISTRY_BRANCH, {})) { // merge down all keys
                allCals[key.substring(0, key.indexOf(".", REGISTRY_BRANCH.length))] = true;
            }

            for (let calBranch in allCals) {
                let id = calBranch.substring(REGISTRY_BRANCH.length);
                let ctype = cal.getPrefSafe(calBranch + ".type", null);
                let curi = cal.getPrefSafe(calBranch + ".uri", null);

                try {
                    if (!ctype || !curi) { // sanity check
                        prefService.deleteBranch(calBranch + ".");
                        continue;
                    }

                    let uri = cal.makeURL(curi);
                    let calendar = this.createCalendar(ctype, uri);
                    if (calendar) {
                        calendar.id = id;
                        if (calendar.getProperty("auto-enabled")) {
                            calendar.deleteProperty("disabled");
                            calendar.deleteProperty("auto-enabled");
                        }
 
                        if ((calendar.getProperty("cache.supported") !== false) &&
                            calendar.getProperty("cache.enabled")) {
                            calendar = new calCachedCalendar(calendar);
                        }
                    } else { // create dummy calendar that stays disabled for this run:
                        calendar = new calDummyCalendar(ctype);
                        calendar.id = id;
                        calendar.uri = uri;
                        // try to enable on next startup if calendar has been enabled:
                        if (!calendar.getProperty("disabled")) {
                            calendar.setProperty("auto-enabled", true);
                        }
                        calendar.setProperty("disabled", true);
                    }

                    this.setupCalendar(calendar);
                } catch (exc) {
                    cal.ERROR("Can't create calendar for " + id + " (" + ctype + ", " + curi + "): " + exc);
                }
            }

            // do refreshing in a second step, when *all* calendars are already available
            // via getCalendars():
            for each (let calendar in this.mCache) {
                if (!calendar.getProperty("disabled") && calendar.canRefresh) {
                    calendar.refresh();
                }
            }
        }
    },

    getCalendarPref_: function(calendar, name) {
        cal.ASSERT(calendar, "Invalid Calendar!");
        cal.ASSERT(calendar.id !== null, "Calendar id needs to be set!");
        cal.ASSERT(name && name.length > 0, "Pref Name must be non-empty!");

        let branch = (getPrefBranchFor(calendar.id) + name);

        if ( name === "name" ) {
            return cal.getLocalizedPref(branch, null);
        }
        return cal.getPrefSafe(branch, null);
    },

    setCalendarPref_: function(calendar, name, value) {
        cal.ASSERT(calendar, "Invalid Calendar!");
        cal.ASSERT(calendar.id !== null, "Calendar id needs to be set!");
        cal.ASSERT(name && name.length > 0, "Pref Name must be non-empty!");

        let branch = (getPrefBranchFor(calendar.id) + name);

        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch);
        // delete before to allow pref-type changes:
        prefService.deleteBranch(branch);

        if ( name === "name" ) {
            cal.setLocalizedPref(branch, value);
        } else {
            cal.setPref(branch, value);
        }
    },

    deleteCalendarPref_: function(calendar, name) {
        cal.ASSERT(calendar, "Invalid Calendar!");
        cal.ASSERT(calendar.id !== null, "Calendar id needs to be set!");
        cal.ASSERT(name && name.length > 0, "Pref Name must be non-empty!");

        let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch);
        prefService.deleteBranch(getPrefBranchFor(calendar.id) + name);
    },
    
    mObservers: null,
    addObserver: function(aObserver) {
        this.mObservers.add(aObserver);
    },

    removeObserver: function(aObserver) {
        this.mObservers.remove(aObserver);
    }
};

function equalMessage(msg1, msg2) {
    if (msg1.GetString(0) == msg2.GetString(0) &&
        msg1.GetString(1) == msg2.GetString(1) &&
        msg1.GetString(2) == msg2.GetString(2)) {
        return true;
    }
    return false;
}

function calMgrCalendarObserver(calendar, calMgr) {
    this.calendar = calendar;
    // We compare this to determine if the state actually changed.
    this.storedReadOnly = calendar.readOnly;
    this.announcedMessages = [];
    this.calMgr = calMgr;
}

calMgrCalendarObserver.prototype = {
    calendar: null,
    storedReadOnly: null,
    calMgr: null,

    QueryInterface: function mBL_QueryInterface(aIID) {
        return doQueryInterface(this, calMgrCalendarObserver.prototype, aIID,
                                [Components.interfaces.nsIWindowMediatorListener,
                                 Components.interfaces.calIObserver]);
    },

    // calIObserver:
    onStartBatch: function() {},
    onEndBatch: function() {},
    onLoad: function(calendar) {},
    onAddItem: function(aItem) {},
    onModifyItem: function(aNewItem, aOldItem) {},
    onDeleteItem: function(aDeletedItem) {},
    onError: function(aCalendar, aErrNo, aMessage) {
        this.announceError(aCalendar, aErrNo, aMessage);
    },

    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
        switch (aName) {
            case "requiresNetwork":
                this.calMgr.mNetworkCalendarCount += (aValue ? 1 : -1);
                break;
            case "readOnly":
                this.calMgr.mReadonlyCalendarCount += (aValue ? 1 : -1);
                break;
            case "cache.enabled":
                if (aCalendar.wrappedJSObject instanceof calCachedCalendar) {
                    // any attempt to switch this flag will reset the cached calendar;
                    // could be useful for users in case the cache may be corrupted.
                    aCalendar.wrappedJSObject.setupCachedCalendar();
                }
                break;
            case "disabled":
                if (!aValue && aCalendar.canRefresh) {
                    aCalendar.refresh();
                }
                break;
        }
    },

    onPropertyDeleting: function(aCalendar, aName) {
        this.onPropertyChanged(aCalendar, aName, false, true);
    },

    // Error announcer specific functions

    announceError: function(aCalendar, aErrNo, aMessage) {

        var paramBlock = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                                   .createInstance(Components.interfaces.nsIDialogParamBlock);
        var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService);
        var props = sbs.createBundle("chrome://calendar/locale/calendar.properties");
        var errMsg;
        paramBlock.SetNumberStrings(3);
        if (!this.storedReadOnly && this.calendar.readOnly) {
            // Major errors change the calendar to readOnly
            errMsg = props.formatStringFromName("readOnlyMode", [this.calendar.name], 1);
        } else if (!this.storedReadOnly && !this.calendar.readOnly) {
            // Minor errors don't, but still tell the user something went wrong
            errMsg = props.formatStringFromName("minorError", [this.calendar.name], 1);
        } else {
            // The calendar was already in readOnly mode, but still tell the user
            errMsg = props.formatStringFromName("stillReadOnlyError", [this.calendar.name], 1);
        }

        // When possible, change the error number into its name, to
        // make it slightly more readable.
        var errCode = "0x"+aErrNo.toString(16);
        const calIErrors = Components.interfaces.calIErrors;
        // Check if it is worth enumerating all the error codes.
        if (aErrNo & calIErrors.ERROR_BASE) {
            for (var err in calIErrors) {
                if (calIErrors[err] == aErrNo) {
                    errCode = err;
                }
            }
        }

        var message;
        switch (aErrNo) {
            case calIErrors.CAL_UTF8_DECODING_FAILED:
                message = props.GetStringFromName("utf8DecodeError");
                break;
            case calIErrors.ICS_MALFORMEDDATA:
                message = props.GetStringFromName("icsMalformedError");
                break;
            case calIErrors.MODIFICATION_FAILED:
                errMsg = calGetString("calendar", "errorWriting", [aCalendar.name]);
             default:
                message = aMessage;
         }
 
                
        paramBlock.SetString(0, errMsg);
        paramBlock.SetString(1, errCode);
        paramBlock.SetString(2, message);

        this.storedReadOnly = this.calendar.readOnly;
        var errorCode = calGetString("calendar","errorCode", [errCode]);
        var errorDescription = calGetString("calendar","errorDescription", [message]);
        var summary = errMsg + " " + errorCode + ". " + errorDescription;

        // Log warnings in error console.
        // Report serious errors in both error console and in prompt window.
        var isSerious = (aErrNo == calIErrors.MODIFICATION_FAILED);
        if (!isSerious) {
            WARN(summary);
        } else {
            // Write error to console.
            Components.utils.reportError(summary);

            // silently don't do anything if this message already has
            // been announced without being acknowledged.
            if (this.announcedMessages.some(
                function(element, index, array) {
                    return equalMessage(paramBlock, element);
                })) {
                return;
            }

            // this message hasn't been announced recently, remember the
            // details of the message for future reference.
            this.announcedMessages.push(paramBlock);

            // Display in prompt window.
            var wWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                  .getService(Components.interfaces.nsIWindowWatcher);
            var promptWindow =
                wWatcher.openWindow
                    (null, "chrome://calendar/content/calErrorPrompt.xul",
                     "_blank", "chrome,dialog=yes,alwaysRaised=yes",
                     paramBlock);
            // Will remove paramBlock from announced messages when
            // promptWindow is closed.  (Closing fires unloaded event, but
            // promptWindow is also unloaded [to clean it?] before loading, 
            // so wait for detected load event before detecting unload event
            // that signifies user closed this prompt window.)
            var observer = this;
            function awaitLoad(event) {
                // #2 loaded, remove load listener
                promptWindow.removeEventListener("load", awaitLoad, false);
                function awaitUnload(event) {
                    // #4 unloaded (user closed prompt window),
                    // remove paramBlock and unload listener.
                    try {
                        // remove the message that has been shown from
                        // the list of all announced messages.
                        observer.announcedMessages =
                            observer.announcedMessages.filter(function(msg) {
                                return !equalMessage(msg, paramBlock);
                            });
                        promptWindow.removeEventListener("unload", awaitUnload,
                                                         false);
                    } catch (e) {
                        Components.utils.reportError(e);
                    }
                }
                // #3 add unload listener (wait for user to close promptWindow)
                promptWindow.addEventListener("unload", awaitUnload, false);
            }
            // #1 add load listener
            promptWindow.addEventListener("load", awaitLoad, false);
        }
    }
};

function calDummyCalendar(type) {
    this.initProviderBase();
    this.type = type;
}
calDummyCalendar.prototype = {
    __proto__: cal.ProviderBase.prototype,

    getProperty: function calDummyCalendar_getProperty(aName) {
        switch (aName) {
            case "force-disabled":
                return true;
            default:
                return this.__proto__.__proto__.getProperty.apply(this, arguments);
        }
    }
};
