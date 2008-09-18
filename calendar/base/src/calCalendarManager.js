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

const SUNBIRD_UID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
const LIGHTNING_UID = "{e2fda1a4-762b-4020-b5ad-a41df1933103}";

const kStorageServiceContractID = "@mozilla.org/storage/service;1";
const kStorageServiceIID = Components.interfaces.mozIStorageService;

const kMozStorageStatementWrapperContractID = "@mozilla.org/storage/statement-wrapper;1";
const kMozStorageStatementWrapperIID = Components.interfaces.mozIStorageStatementWrapper;
var MozStorageStatementWrapper = null;

function createStatement (dbconn, sql) {
    var stmt = dbconn.createStatement(sql);
    var wrapper = MozStorageStatementWrapper();
    wrapper.initialize(stmt);
    return wrapper;
}

function onCalCalendarManagerLoad() {
    MozStorageStatementWrapper = new Components.Constructor(kMozStorageStatementWrapperContractID, kMozStorageStatementWrapperIID);
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
    },
    
    startup: function ccm_startup() {
        this.initDB();
        this.mCache = null;
        this.mCalObservers = null;
        this.mRefreshTimer = null;
        this.setUpPrefObservers();
        this.setUpRefreshTimer();
        this.setupOfflineObservers();
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
        }

    },

    DB_SCHEMA_VERSION: 10,

    upgradeDB: function (oldVersion) {
        // some common helpers
        function addColumn(db, tableName, colName, colType) {
            db.executeSimpleSQL("ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colType);
        }

        // xxx todo: needs to be resolved with
        //           Bug 377845 - Decouple calendar manager from storage provider
        //
        //           This code always runs before the update code of calStorageCalendar which
        //           needs the old schema version to run.
        //           So this code just updates its schema without updating the version number.
        //
        //           We may run into problems if this code has passed successfully, but the code
        //           in calStorageCalendar hasn't, because on next startup this code will run
        //           into the same section again...

        if (oldVersion < 6) {
            dump ("**** Upgrading calCalendarManager schema to 6\n");

            this.mDB.beginTransaction();
            try {
                // Schema changes in v6:
                //
                // - Change all STRING columns to TEXT to avoid SQLite's
                //   "feature" where it will automatically convert strings to
                //   numbers (ex: 10e4 -> 10000). See bug 333688.

                // Create the new tables.

                try { 
                    this.mDB.executeSimpleSQL("DROP TABLE cal_calendars_v6;" +
                                              "DROP TABLE cal_calendars_prefs_v6;");
                } catch (e) {
                    // We should get exceptions for trying to drop tables
                    // that don't (shouldn't) exist.
                }

                this.mDB.executeSimpleSQL("CREATE TABLE cal_calendars_v6 " +
                                          "(id   INTEGER PRIMARY KEY," +
                                          " type TEXT," +
                                          " uri  TEXT);");

                this.mDB.executeSimpleSQL("CREATE TABLE cal_calendars_prefs_v6 " +
                                          "(id       INTEGER PRIMARY KEY," +
                                          " calendar INTEGER," +
                                          " name     TEXT," +
                                          " value    TEXT);");

                // Copy in the data.
                var calendarCols = ["id", "type", "uri"];
                var calendarPrefsCols = ["id", "calendar", "name", "value"];

                this.mDB.executeSimpleSQL("INSERT INTO cal_calendars_v6(" + calendarCols.join(",") + ") " +
                                          "     SELECT " + calendarCols.join(",") +
                                          "       FROM cal_calendars");

                this.mDB.executeSimpleSQL("INSERT INTO cal_calendars_prefs_v6(" + calendarPrefsCols.join(",") + ") " +
                                          "     SELECT " + calendarPrefsCols.join(",") +
                                          "       FROM cal_calendars_prefs");


                // Delete each old table and rename the new ones to use the
                // old tables' names.
                var tableNames = ["cal_calendars", "cal_calendars_prefs"];

                for (var i in tableNames) {
                    this.mDB.executeSimpleSQL("DROP TABLE " + tableNames[i] + ";" +
                                              "ALTER TABLE " + tableNames[i] + "_v6 " + 
                                              "  RENAME TO " + tableNames[i] + ";");
                }

                this.mDB.commitTransaction();
                oldVersion = 8;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        } 
        
        if (oldVersion < this.DB_SCHEMA_VERSION) {
            dump ("**** Upgrading calCalendarManager schema to 9/10\n");

            this.mDB.beginTransaction();
            try {
                if (this.mDB.tableExists("cal_calmgr_schema_version")) {
                    // Set only once the last time to v10, so the version check works in calendar 0.8.
                    // In calendar 0.9 and following, the provider itself will check its version
                    // on initialization and notify the calendar whether it's usable or not.
                    this.mDB.executeSimpleSQL("UPDATE cal_calmgr_schema_version SET version = " +
                                              this.DB_SCHEMA_VERSION + ";");
                } else {
                    // Schema changes in v9:
                    //
                    // - Decouple schema version from storage calendar
                    // Create the new tables.
                    this.mDB.executeSimpleSQL("CREATE TABLE cal_calmgr_schema_version " +
                                              "(version INTEGER);");
                    this.mDB.executeSimpleSQL("INSERT INTO cal_calmgr_schema_version VALUES(" +
                                              this.DB_SCHEMA_VERSION + ")");
                }
                this.mDB.commitTransaction();
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }
    },

    initDB: function() {
        var dbService = Components.classes[kStorageServiceContractID]
                                  .getService(kStorageServiceIID);
        this.mDB = dbService.openSpecialDatabase("profile");

        var sqlTables = { cal_calendars: "id INTEGER PRIMARY KEY, type TEXT, uri TEXT",
                          cal_calendars_prefs: "id INTEGER PRIMARY KEY, calendar INTEGER, name TEXT, value TEXT",
                          cal_calmgr_schema_version: "version INTEGER"
                        };

        // Should we check the schema version to see if we need to upgrade?
        var checkSchema = true;

        this.mDB.beginTransactionAs(Components.interfaces.mozIStorageConnection.TRANSACTION_EXCLUSIVE);
        try {
            // Check if the tables exists
            if (!this.mDB.tableExists("cal_calendars")) {
                // No table. Initialize the DB
                for (table in sqlTables) {
                    this.mDB.createTable(table, sqlTables[table]);
                }
                // Store the schema version
                this.mDB.executeSimpleSQL("INSERT INTO cal_calmgr_schema_version VALUES(" + this.DB_SCHEMA_VERSION + ")");
                checkSchema = false;
                this.mDB.commitTransaction();
            } else {
                this.mDB.rollbackTransaction();
            }
        } catch (exc) {
            this.mDB.rollbackTransaction();
            throw exc;
        }

        if (checkSchema) {
            // Check if we need to upgrade
            var version = this.getSchemaVersion();
            //dump ("*** Calendar schema version is: " + version + "\n");

            if (version < this.DB_SCHEMA_VERSION) {
                this.upgradeDB(version);
            } else if (version > this.DB_SCHEMA_VERSION) {
                // Schema version is newer than what we know how to deal with.
                // Alert the user, and quit the app.
                this.alertAndQuit();
            }
        }

        this.mSelectCalendars = createStatement (
            this.mDB,
            "SELECT oid,* FROM cal_calendars");

        this.mRegisterCalendar = createStatement (
            this.mDB,
            "INSERT INTO cal_calendars (type, uri) " +
            "VALUES (:type, :uri)"
            );

        this.mUnregisterCalendar = createStatement (
            this.mDB,
            "DELETE FROM cal_calendars WHERE id = :id"
            );

        this.mGetPref = createStatement (
            this.mDB,
            "SELECT value FROM cal_calendars_prefs WHERE calendar = :calendar AND name = :name");

        this.mDeletePref = createStatement (
            this.mDB,
            "DELETE FROM cal_calendars_prefs WHERE calendar = :calendar AND name = :name");

        this.mInsertPref = createStatement (
            this.mDB,
            "INSERT INTO cal_calendars_prefs (calendar, name, value) " +
            "VALUES (:calendar, :name, :value)");

        this.mDeletePrefs = createStatement (
            this.mDB,
            "DELETE FROM cal_calendars_prefs WHERE calendar = :calendar");
    },

    /** 
     * @return      db schema version
     * @exception   various, depending on error
     */
    getSchemaVersion: function calMgrGetSchemaVersion() {
        var stmt;
        var version = null;

        var table;
        if (this.mDB.tableExists("cal_calmgr_schema_version")) {
            table = "cal_calmgr_schema_version";
        } else {
            // Fall back to the old schema table
            table = "cal_calendar_schema_version";
        }

        try {
            stmt = createStatement(this.mDB,
                    "SELECT version FROM " + table + " LIMIT 1");
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
            dump ("++++++++++++ calMgrGetSchemaVersion() error: " +
                  this.mDB.lastErrorString + "\n");
            Components.utils.reportError("Error getting calendar " +
                                         "schema version! DB Error: " + 
                                         this.mDB.lastErrorString);
            throw e;
        }

        throw table + " SELECT returned no results";
    },

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
            em.disableItem(LIGHTNING_UID);
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
            var calendar = Components.classes["@mozilla.org/calendar/calendar;1?type=" + type]
                                     .createInstance(Components.interfaces.calICalendar);
            calendar.uri = uri;
            return calendar;
        } catch (ex) {
            // XXX todo: bug 439620
            // In general, we might consider to keep calendars disabled in case they couldn't
            // be created instead of filtering them out. This leaves the chance to clean up
            // calendar registration, getting rid of error boxes.
            var rc = ex;
            var message = ex;
            if (ex instanceof Components.interfaces.nsIException) {
                rc = ex.result;
                message = ex.message;
            }
            switch (rc) {
                case Components.interfaces.calIErrors.STORAGE_UNKNOWN_SCHEMA_ERROR:
                    // For now we alert and quit on schema errors like we've done before:
                    this.alertAndQuit();
                case Components.interfaces.calIErrors.STORAGE_UNKNOWN_TIMEZONES_ERROR:
                    message = calGetString("calendar", "unknownTimezonesError", [uri.spec]);
                    break;
                default:
                    message = calGetString("calendar", "unableToCreateProvider", [uri.spec]);
                    break;
            }
            ASSERT(false, message);
            var paramBlock = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                                       .createInstance(Components.interfaces.nsIDialogParamBlock);
            paramBlock.SetNumberStrings(3);
            paramBlock.SetString(0, message);
            paramBlock.SetString(1, "0x" + rc.toString(0x10));
            paramBlock.SetString(2, ex);
            var wWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
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
        if (calendar.id > 0) {
            dump ("registerCalendar: calendar already registered\n");
            throw Components.results.NS_ERROR_FAILURE;
        }

        this.assureCache();

        // Add an observer to track readonly-mode triggers
        var newObserver = new calMgrCalendarObserver(calendar, this);
        calendar.addObserver(newObserver);

        var pp = this.mRegisterCalendar.params;
        pp.type = calendar.type;
        pp.uri = calendar.uri.spec;

        this.mRegisterCalendar.step();
        this.mRegisterCalendar.reset();
        
        calendar.id = this.mDB.lastInsertRowID;
        
        //dump("adding [" + this.mDB.lastInsertRowID + "]\n");
        //this.mCache[this.mDB.lastInsertRowID] = calendar;
        this.mCache[calendar.id] = calendar;
        this.mCalObservers[calendar.id] = newObserver;

        // Set up statistics
        if (calendar.getProperty("requiresNetwork") !== false) {
            this.mNetworkCalendarCount++;
        }
        if (calendar.readOnly) {
            this.mReadonlyCalendarCount++;
        }
        this.mCalendarCount++;

        if (!calendar.getProperty("disabled") && calendar.canRefresh) {
            calendar.refresh();
        }

        this.notifyObservers("onCalendarRegistered", [calendar]);
    },

    unregisterCalendar: function(calendar) {
        this.notifyObservers("onCalendarUnregistering", [calendar]);

        // calendar may be a calICalendar wrapper:
        if (calendar.wrappedJSObject instanceof calCachedCalendar) {
            calendar.wrappedJSObject.onCalendarUnregistering();
        }

        var calendarID = calendar.id;

        calendar.removeObserver(this.mCalObservers[calendarID]);

        var pp = this.mUnregisterCalendar.params;
        pp.id = calendarID;
        this.mUnregisterCalendar.step();
        this.mUnregisterCalendar.reset();

        // delete prefs for the calendar too
        pp = this.mDeletePrefs.params;
        pp.calendar = calendarID;
        this.mDeletePrefs.step();
        this.mDeletePrefs.reset();

        if (this.mCache) {
            delete this.mCache[calendarID];
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
        if (calInstanceOf(calendar, Components.interfaces.calICalendarProvider) &&
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

            var stmt = this.mSelectCalendars;
            stmt.reset();
            var newCalendarData = [];
            while (stmt.step()) {
                newCalendarData.push( { id: stmt.row.id, type: stmt.row.type, uri: stmt.row.uri } );
            }
            stmt.reset();

            for each (var caldata in newCalendarData) {
                try {
                    var cal = this.createCalendar(caldata.type, makeURL(caldata.uri));
                    if (!cal) {
                        continue;
                    }
                    cal.id = caldata.id;
                    if ((cal.getProperty("cache.supported") !== false) && cal.getProperty("cache.enabled")) {
                        cal = new calCachedCalendar(cal);
                    }
                    var newObserver = new calMgrCalendarObserver(cal, this);
                    cal.addObserver(newObserver);
                    this.mCalObservers[caldata.id] = newObserver;

                    this.mCache[caldata.id] = cal;

                    // Set up statistics
                    if (cal.getProperty("requiresNetwork") !== false) {
                        this.mNetworkCalendarCount++;
                    }
                    if (cal.readOnly) {
                        this.mReadonlyCalendarCount++;
                    }
                    this.mCalendarCount++;

                    if (!cal.getProperty("disabled") && cal.canRefresh) {
                        cal.refresh();
                    }
                } catch (exc) {
                    Components.utils.reportError(
                        "Can't create calendar for " + caldata.id +
                        " (" + caldata.type + ", " + caldata.uri + "): " + exc);
                }
            }
        }
    },

    getCalendarPref_: function(calendar, name) {
        ASSERT(calendar, "Invalid Calendar");
        ASSERT(calendar.id !== null, "Calendar id needs to be an integer");
        ASSERT(name && name.length > 0, "Pref Name must be non-empty");

        // pref names must be lower case
        name = name.toLowerCase();

        var stmt = this.mGetPref;
        stmt.reset();
        var pp = stmt.params;
        pp.calendar = calendar.id;
        pp.name = name;

        var value = null;
        if (stmt.step()) {
            value = stmt.row.value;
        }
        stmt.reset();
        return value;
    },

    setCalendarPref_: function(calendar, name, value) {
        ASSERT(calendar, "Invalid Calendar");
        ASSERT(calendar.id !== null, "Calendar id needs to be an integer");
        ASSERT(name && name.length > 0, "Pref Name must be non-empty");

        // pref names must be lower case
        name = name.toLowerCase();
       
        var calendarID = calendar.id;

        this.mDB.beginTransaction();

        var pp = this.mDeletePref.params;
        pp.calendar = calendarID;
        pp.name = name;
        this.mDeletePref.step();
        this.mDeletePref.reset();

        pp = this.mInsertPref.params;
        pp.calendar = calendarID;
        pp.name = name;
        pp.value = value;
        this.mInsertPref.step();
        this.mInsertPref.reset();

        this.mDB.commitTransaction();
    },

    deleteCalendarPref_: function(calendar, name) {
        ASSERT(calendar, "Invalid Calendar");
        ASSERT(calendar.id !== null, "Calendar id needs to be an integer");
        ASSERT(name && name.length > 0, "Pref Name must be non-empty");

        // pref names must be lower case
        name = name.toLowerCase();

        var calendarID = calendar.id;

        var pp = this.mDeletePref.params;
        pp.calendar = calendarID;
        pp.name = name;
        this.mDeletePref.step();
        this.mDeletePref.reset();
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
}
