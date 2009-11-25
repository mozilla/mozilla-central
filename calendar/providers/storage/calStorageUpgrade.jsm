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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * Welcome to the storage database migration.
 *
 * If you would like to change anything in the database schema, you must follow
 * some steps to make sure that upgrading from old versions works fine.
 *
 * First of all you must increment the DB_SCHEMA_VERSION variable below. Then
 * you must write your upgrader. To do this, create a new function and add it to
 * the upgrade object, similar to the existing upgraders below. An example is
 * given below.
 *
 * An upgrader MUST update both the database (if it is passed) AND the table
 * data javascript object. An example for a such object is in the v1/v2
 * upgrader. The process of upgrading calls the latest upgrader with the
 * database object and the current database version. The whole chain of
 * upgraders is then called (down to v1). The first upgrader (v1/v2) provides
 * the basic table data object. Each further upgrader then updates this object
 * to correspond with the database tables and columns. No actual database calls
 * are made until the first upgrader with a higher version than the current
 * database version is called. When this version is arrived, both the table data
 * object and the database are updated. This process continues until the
 * database is at the latest version.
 *
 * Note that your upgrader is not neccessarily called with a database object,
 * for example if the user's database is already at a higher version. In this
 * case your upgrader is called to compile the table data object. To make
 * calling code easier, there are a bunch of helper functions below that can be
 * called with a null database object and only call the database object if it is
 * not null. If you need to call new functions on the database object, check out
 * the createDBDelegate function below.
 *
 * When adding new tables to the table data object, please note that there is a
 * special prefix for indexes. These are also kept in the table data object to
 * make sure that getAllSql also includes CREATE INDEX statements. New tables
 * MUST NOT be prefixed with "idx_". If you would like to add a new index,
 * please use the createIndex function.
 *
 * The basic structure for an upgrader is (NN is current version, XX = NN - 1)
 *
 * upgrader.vNN = function upgrade_vNN(db, version) {
 *     let tbl = upgrade.vXX(version < XX && db, version);
 *     LOGdb(db, "Storage: Upgrading to vNN");
 *
 *     beginTransaction(db);
 *     try {
 *         // Do stuff here
 *         setDbVersionAndCommit(db, NN);
 *     } catch (e) {
 *         throw reportErrorAndRollback(db, e);
 *     }
 *     return tbl;
 * }
 *
 * Regardless of how your upgrader looks, make sure you:
 * - use an sql transaction, if you have a database
 * - If everything succeeds, call setDbVersionAndCommit to update the database
 *     version (setDbVersionAndCommit also commits the transaction)
 * - If something fails, throw reportErrorAndRollback(db, e) to report the
 *     failure and roll back the transaction.
 *
 * If this documentation isn't sufficient to make upgrading understandable,
 * please file a bug.
 */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calStorageHelpers.jsm");

// The current database version. Be sure to increment this when you create a new
// updater.
var DB_SCHEMA_VERSION = 18;

var EXPORTED_SYMBOLS = ["DB_SCHEMA_VERSION", "getSql", "getAllSql", "getSqlTable", "upgradeDB"];

/**
 * Gets the SQL for the given table data and table name. This can be both a real
 * table or the name of an index. Indexes must contain the idx_ prefix.
 *
 * @param tblName       The name of the table or index to retrieve sql for
 * @param tblData       The table data object, as returned from the upgrade_v*
 *                        functions. If null, then the latest table data is
 *                        retrieved.
 * @param alternateName (optional) The table or index name to be used in the
 *                        resulting CREATE statement. If not set, tblName will
 *                        be used.
 * @return              The SQL Statement for the given table or index and
 *                        version as a string.
 */
function getSql(tblName, tblData, alternateName) {
    tblData = tblData || getSqlTable();
    let altName = (alternateName || tblName);
    let sql;
    if (tblName.substr(0, 4) == "idx_") {
        // If this is an index, we need construct the SQL differently
        let idxTbl = tblData[tblName].shift();
        let idxOn = idxTbl + "(" + tblData[tblName].join(",") + ")";
        sql = "CREATE INDEX " + altName + " ON " + idxOn + ";";
    } else {
        sql = "CREATE TABLE " + altName  + " (\n";
        for (let [key, type] in Iterator(tblData[tblName]))  {
            sql += "    " + key + " " + type + ",\n";
        }
    }

    return sql.replace(/,\s*$/, ");");
}

/**
 * Gets all SQL for the given table data
 *
 * @param version       The database schema version to retrieve. If null, the
 *                        latest schema version will be used.
 * @return              The SQL Statement for the given version as a string.
 */
function getAllSql(version) {
    let tblData = getSqlTable(version);
    let sql = "";
    for (let tblName in tblData) {
        sql += getSql(tblName, tblData) + "\n\n";
    }
    cal.LOG("Storage: Full SQL statement is " + sql);
    return sql;
}

/**
 * Get the JS object corresponding to the given schema version. This object will
 * contain both tables and indexes, where indexes are prefixed with "idx_".
 *
 * @param schemaVersion       The schema version to get. If null, the latest
 *                              schema version will be used.
 * @return                    The javascript object containing the table
 *                              definition.
 */
function getSqlTable(schemaVersion) {
    let version = "v" + (schemaVersion || DB_SCHEMA_VERSION);
    if (version in upgrade) {
        return upgrade[version]();
    } else {
        return {};
    }
}

/**
 * Gets the current version of the storage database
 */
function getVersion(db) {
    let selectSchemaVersion;
    let version = null;

    try {
        selectSchemaVersion = createStatement(db,
                              "SELECT version FROM " +
                              "cal_calendar_schema_version LIMIT 1");
        if (selectSchemaVersion.step()) {
            version = selectSchemaVersion.row.version;
        }

        if (version !== null) {
            // This is the only place to leave this function gracefully.
            return version;
        }
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    } finally {
        if (selectSchemaVersion) {
            selectSchemaVersion.reset();
        }
    }

    throw "cal_calendar_schema_version SELECT returned no results";
}

/**
 * Upgrade the passed database.
 *
 * @param db        The database to bring up to date.
 */
function upgradeDB(db) {
    cal.ASSERT(db, "Database has not been opened!", true);
    if (!db.tableExists("cal_calendar_schema_version")) {
        cal.LOG("Storage: Creating tables from scratch");
        beginTransaction(db);
        try {
            executeSimpleSQL(db, getAllSql());
            setDbVersionAndCommit(db, DB_SCHEMA_VERSION);
        } catch (e) {
            reportErrorAndRollback(db, e);
        }
    } else {
        let version = getVersion(db);
        if (version < DB_SCHEMA_VERSION) {
            cal.LOG("Storage: Preparing to upgrade v" + version +
                    " to v" + DB_SCHEMA_VERSION);
            upgrade["v" + DB_SCHEMA_VERSION](db, version);
        } else if (version > DB_SCHEMA_VERSION) {
            throw Components.interfaces.calIErrors.STORAGE_UNKNOWN_SCHEMA_ERROR;
        }
    }

    ensureUpdatedTimezones(db);
}

/**
 * Sets the db version and commits any open transaction.
 *
 * @param db        The mozIStorageConnection to commit on
 * @param version   The version to set
 */
function setDbVersionAndCommit(db, version) {
    executeSimpleSQL(db, "DELETE FROM cal_calendar_schema_version;" +
                         "INSERT INTO cal_calendar_schema_version " +
                         "(version) VALUES (" + version + ")");
    if (db && db.transactionInProgress) {
        commitTransaction(db);
    }
}

/**
 * Creates a function that calls the given function |funcName| on it's passed
 * database. In addition, if no database is passed, the call is ignored.
 *
 * @param funcName      The function name to delegate.
 * @return              The delegate function for the passed named function.
 */
function createDBDelegate(funcName) {
    let func = function(db /* , ... */) {
        if (db) {
            let args = Array.slice(arguments);
            args.shift();
            try {
                return db[funcName].apply(db, args);
            } catch (e) {
                cal.ERROR("Error calling '" + funcName + "' db error: '" +
                          lastErrorString(db) + "'.\nException: " + e);
                cal.WARN(cal.STACK(10));
            }
        }
    };

    func.name = "dbDelegate_" + funcName;
    return func;
}

/**
 * Creates a delegate function for a database getter. Returns a function that
 * can be called to get the specified attribute, if a database is passed. If no
 * database is passed, no error is thrown but null is returned.
 *
 * @param getterAttr        The getter to delegate.
 * @return                  The function that delegates the getter.
 */
function createDBDelegateGetter(getterAttr) {
    let func = function(db) {
        return (db ? db[getterAttr] : null);
    }

    func.name = "dbDelegate_get_" + getterAttr;
    return func;
}

// These functions use the db delegate to allow easier calling of common
// database functions.
var beginTransaction = createDBDelegate("beginTransaction");
var commitTransaction = createDBDelegate("commitTransaction");
var rollbackTransaction = createDBDelegate("rollbackTransaction");
var createStatement = createDBDelegate("createStatement");
var executeSimpleSQL = createDBDelegate("executeSimpleSQL");
var removeFunction = createDBDelegate("removeFunction");
var createFunction = createDBDelegate("createFunction");

var lastErrorString = createDBDelegateGetter("lastErrorString");


/**
 * Helper function to create an index on the database if it doesn't already
 * exist.
 *
 * @param tblData       The table data object to save the index in.
 * @param tblName       The name of the table to index.
 * @param colNameArray  An array of columns to index over.
 * @param db            (optional) The database to create the index on.
 */
function createIndex(tblData, tblName, colNameArray, db) {
    let idxName = "idx_" + tblName + "_" + colNameArray.join("_");
    let idxOn = tblName + "(" + colNameArray.join(",") + ")";

    // Construct the table data for this index
    tblData[idxName] = colNameArray.concat([]);
    tblData[idxName].unshift(tblName);

    // Execute the sql, if there is a db
    return executeSimpleSQL(db, "CREATE INDEX IF NOT EXISTS " + idxName +
                                "                        ON " + idxOn);
}

/**
 * Often in an upgrader we want to log something only if there is a database. To
 * make code less cludgy, here a helper function.
 *
 * @param db        The database, or null if nothing should be logged.
 * @param msg       The message to log.
 */
function LOGdb(db, msg) {
    if (db) {
        cal.LOG(msg);
    }
}

/**
 * Report an error and roll back the last transaction.
 *
 * @param db        The database to roll back on.
 * @param e         The exception to report
 * @return          The passed exception, for chaining.
 */
function reportErrorAndRollback(db, e) {
    if (db && db.transactionInProgress) {
        rollbackTransaction(db);
    }
    cal.ERROR("++++++ Storage error!" +
              "++++++ DB Error: " + lastErrorString(db) + "\n" +
              "++++++ Exception: " + e);
    return e;
}

/**
 * Make sure the timezones of the events in the database are up to date.
 *
 * @param db        The database to bring up to date
 */
function ensureUpdatedTimezones(db) {
    // check if timezone version has changed:
    let selectTzVersion = createStatement(db, "SELECT version FROM cal_tz_version LIMIT 1");
    let version;
    try {
        version = (selectTzVersion.step() ? selectTzVersion.row.version : null);
    } finally {
        selectTzVersion.reset();
    }

    let versionComp = 1;
    if (version) {
        versionComp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                .getService(Components.interfaces.nsIVersionComparator)
                                .compare(cal.getTimezoneService().version, version);
    }

    if (versionComp < 0) {
        // A timezones downgrade has happened!
        throw Components.interfaces.calIErrors.STORAGE_UNKNOWN_TIMEZONES_ERROR;
    } else if (versionComp > 0) {
        cal.LOG("Timezones have been updated, updating calendar data.");

        let zonesToUpdate = [];
        let getZones = createStatement(db,
            "SELECT DISTINCT(zone) FROM ("+
            "SELECT recurrence_id_tz AS zone FROM cal_attendees    WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_events       WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT event_start_tz   AS zone FROM cal_events       WHERE event_start_tz   IS NOT NULL UNION " +
            "SELECT event_end_tz     AS zone FROM cal_events       WHERE event_end_tz     IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_properties   WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_todos        WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT todo_entry_tz    AS zone FROM cal_todos        WHERE todo_entry_tz    IS NOT NULL UNION " +
            "SELECT todo_due_tz      AS zone FROM cal_todos        WHERE todo_due_tz      IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_alarms       WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_relations    WHERE recurrence_id_tz IS NOT NULL UNION " +
            "SELECT recurrence_id_tz AS zone FROM cal_attachments  WHERE recurrence_id_tz IS NOT NULL" +
            ");");
        try {
            while (getZones.step()) {
                let zone = getZones.row.zone;
                // Send the timezones off to the timezone service to attempt conversion:
                let tz = getTimezone(zone);
                if (tz) {
                    let refTz = cal.getTimezoneService().getTimezone(tz.tzid);
                    if (refTz && refTz.tzid != zone) {
                        zonesToUpdate.push({ oldTzId: zone, newTzId: refTz.tzid });
                    }
                }
            }
        } catch (e) {
            cal.ERROR("Error updating timezones: " + e +
                      "\nDB Error " + lastErrorString(db));
        } finally {
            getZones.reset();
        }

        beginTransaction(db);
        try {
            for each (let update in zonesToUpdate) {
                executeSimpleSQL(db,
                    "UPDATE cal_attendees    SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_events       SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_events       SET event_start_tz   = '" + update.newTzId + "' WHERE event_start_tz   = '" + update.oldTzId + "'; " +
                    "UPDATE cal_events       SET event_end_tz     = '" + update.newTzId + "' WHERE event_end_tz     = '" + update.oldTzId + "'; " +
                    "UPDATE cal_properties   SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_todos        SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_todos        SET todo_entry_tz    = '" + update.newTzId + "' WHERE todo_entry_tz    = '" + update.oldTzId + "'; " +
                    "UPDATE cal_todos        SET todo_due_tz      = '" + update.newTzId + "' WHERE todo_due_tz      = '" + update.oldTzId + "'; " +
                    "UPDATE cal_alarms       SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_relations    SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                    "UPDATE cal_attachments  SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "';");
            }
            executeSimpleSQL(db, "DELETE FROM cal_tz_version; " +
                                 "INSERT INTO cal_tz_version VALUES ('" +
                                 cal.getTimezoneService().version + "');");
            commitTransaction(db);
        } catch (e) {
            cal.ASSERT(false, "Timezone update failed! DB Error: " + lastErrorString(db));
            rollbackTransaction(db);
            throw e;
        }
    }
}

/**
 * Adds a column to the given table.
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to add on
 * @param colName       The column name to add
 * @param colType       The type of the column to add
 * @param db            (optional) The database to apply the operation on
 */
function addColumn(tblData, tblName, colName, colType, db) {
    cal.ASSERT(tblName in tblData,
               "Table " + tblName + " is missing from table def",
               true);
    tblData[tblName][colName] = colType;

    executeSimpleSQL(db, "ALTER TABLE " + tblName +
                         "  ADD COLUMN " + colName + " " + colType);
}

/**
 * Deletes columns from the given table.
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to delete on
 * @param colNameArray  An array of colum names to delete
 * @param db            (optional) The database to apply the operation on
 */
function deleteColumns(tblData, tblName, colNameArray, db) {
    for each (let colName in colNameArray) {
        delete tblData[tblName][colName];
    }

    let columns = [ k for (k in tblData[tblName]) ];
    executeSimpleSQL(db, getSql(tblName, tblData, tblName + "_temp"));
    executeSimpleSQL(db, "INSERT INTO " + tblName + "_temp" +
                         "  (" + columns.join(",") + ") " +
                         "SELECT " + columns.join(",") +
                         "  FROM " + tblName + ";");
    executeSimpleSQL(db, "DROP TABLE " + tblName + "; " +
                         "ALTER TABLE " + tblName + "_temp" +
                         "  RENAME TO " + tblName + ";");
}

/**
 * Does a full copy of the given table
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to copy
 * @param newTblName    The target table name.
 * @param db            (optional) The database to apply the operation on
 * @param condition     (optional) The condition to respect when copying
 * @param selectOptions (optional) Extra options for the SELECT, i.e DISTINCT
 */
function copyTable(tblData, tblName, newTblName, db, condition, selectOptions) {
    function objcopy(obj) {
        return eval(obj.toSource());
    }

    tblData[newTblName] = objcopy(tblData[tblName]);

    let columns = [ k for (k in tblData[newTblName]) ];
    executeSimpleSQL(db, getSql(newTblName, tblData));
    executeSimpleSQL(db, "INSERT INTO " + newTblName +
                         "  (" + columns.join(",") + ") " +
                         "SELECT " + selectOptions + " " + columns.join(",") +
                         "  FROM " + tblName + " " +
                              (condition ? condition : "") +
                         ";");
}

/**
 * Alter the type of a certain column
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to alter
 * @param colNameArray  An array of colum names to delete
 * @param newType       The new type of the column
 * @param db            (optional) The database to apply the operation on
 */
function alterTypes(tblData, tblName, colNameArray, newType, db) {
    for each (let colName in colNameArray) {
        tblData[tblName][colName] = newType;
    }

    let columns = [ k for (k in tblData[tblName]) ];
    executeSimpleSQL(db, getSql(tblName, tblData, tblName + "_temp"));
    executeSimpleSQL(db, "INSERT INTO " + tblName + "_temp" +
                         "  (" + columns.join(",") + ") " +
                         "SELECT " + columns.join(",") +
                         "  FROM " + tblName + ";");
    executeSimpleSQL(db, "DROP TABLE " + tblName + "; " +
                         "ALTER TABLE " + tblName + "_temp" +
                         "  RENAME TO " + tblName + ";");
}

/**
 * Renames the given table, giving it a new name.
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to rename.
 * @param newTblName    The new name of the table.
 * @param db            (optional) The database to apply the operation on.
 * @param overwrite     (optional) If true, the target table will be dropped
 *                        before the rename
 */
function renameTable(tblData, tblName, newTblName, db, overwrite) {
    if (overwrite) {
        dropTable(tblData, newTblName, db);
    }
    tblData[newTblName] = tblData[tblName];
    delete tblData[tblName];
    executeSimpleSQL(db, "ALTER TABLE " + tblName +
                         "  RENAME TO " + newTblName);
}

/**
 * Drops the given table.
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to drop.
 * @param db            (optional) The database to apply the operation on.
 */
function dropTable(tblData, tblName, db) {
    delete tblData[tblName];

    executeSimpleSQL(db, "DROP TABLE IF EXISTS " + tblName + ";");
}

/**
 * Creates the given table.
 *
 * @param tblData       The table data object to apply the operation on.
 * @param tblName       The table name to add.
 * @param def           The table definition object.
 * @param db            (optional) The database to apply the operation on.
 */
function addTable(tblData, tblName, def, db) {
    tblData[tblName] = def;

    executeSimpleSQL(db, getSql(tblName, tblData));
}

/** Object holding upgraders */
var upgrade = {};

/**
 * Returns the initial storage database schema. Note this is not the current
 * schema, it will be modified by the upgrade.vNN() functions. This function
 * returns the initial v1 with modifications from v2 applied.
 *
 * No bug - new recurrence system. exceptions supported now, along with
 * everything else ical can throw at us. I hope.
 * p=vlad
 */
upgrade.v2 = upgrade.v1 = function upgrade_v2(db, version) {
    LOGdb(db, "Storage: Upgrading to v1/v2");
    let tblData = {
      cal_calendar_schema_version: {
        version: "INTEGER"
      },

    /* While this table is in v1, actually keeping it in the sql object will
     * cause problems when migrating from storage.sdb to local.sqlite. There,
     * all tables from storage.sdb will be moved to local.sqlite and so starting
     * sunbird again afterwards causes a borked upgrade since its missing tables
     * it expects.
     *
     *  cal_calendars: {
     *   id:  "INTEGER PRIMARY KEY",
     *   name: "STRING"
     * },
     */

      cal_items: {
        cal_id: "INTEGER",
        item_type: "INTEGER",
        id: "STRING",
        time_created: "INTEGER",
        last_modified: "INTEGER",
        title: "STRING",
        priority: "INTEGER",
        privacy: "STRING",
        ical_status: "STRING",
        flags: "INTEGER",
        event_start: "INTEGER",
        event_end: "INTEGER",
        event_stamp: "INTEGER",
        todo_entry: "INTEGER",
        todo_due: "INTEGER",
        todo_completed: "INTEGER",
        todo_complete: "INTEGER",
        alarm_id: "INTEGER"
      },

      cal_attendees: {
        item_id: "STRING",
        attendee_id: "STRING",
        common_name: "STRING",
        rsvp: "INTEGER",
        role: "STRING",
        status: "STRING",
        type: "STRING"
      },

      cal_alarms: {
        id: "INTEGER PRIMARY KEY",
        alarm_data: "BLOB"
      },

      cal_recurrence: {
        item_id: "STRING",
        recur_type: "INTEGER",
        recur_index: "INTEGER",
        is_negative: "BOOLEAN",
        dates: "STRING",
        end_date: "INTEGER",
        count: "INTEGER",
        interval: "INTEGER",
        second: "STRING",
        minute: "STRING",
        hour: "STRING",
        day: "STRING",
        monthday: "STRING",
        yearday: "STRING",
        weekno: "STRING",
        month: "STRING",
        setpos: "STRING"
      },

      cal_properties: {
        item_id: "STRING",
        key: "STRING",
        value: "BLOB"
      }
    };

    for (let tbl in tblData) {
        executeSimpleSQL(db, "DROP TABLE IF EXISTS " + tbl);
    }
    return tblData;
};

/**
 * Upgrade to version 3.
 * Bug 293707, updates to storage provider; calendar manager database locked
 * fix, r=shaver, p=vlad
 * p=vlad
 */
upgrade.v3 = function upgrade_v3(db, version) {
    let tbl = upgrade.v2(version < 2 && db, version);
    LOGdb(db, "Storage: Upgrading to v3");

    beginTransaction(db);
    try {

        copyTable(tbl, "cal_items", "cal_events", db, "item_type = 0");
        copyTable(tbl, "cal_items", "cal_todos", db, "item_type = 1");

        dropTable(tbl, "cal_items", db);

        let removeEventCols = ["item_type",
                               "item_type",
                               "todo_entry",
                               "todo_due",
                               "todo_completed",
                               "todo_complete",
                               "alarm_id"];
        deleteColumns(tbl, "cal_events", removeEventCols, db);

        addColumn(tbl, "cal_events", "event_start_tz", "VARCHAR", db);
        addColumn(tbl, "cal_events", "event_end_tz", "VARCHAR", db);
        addColumn(tbl, "cal_events", "alarm_time", "INTEGER", db);
        addColumn(tbl, "cal_events", "alarm_time_tz", "VARCHAR", db);

        let removeTodoCols = ["item_type",
                              "event_start",
                              "event_end",
                              "event_stamp",
                              "alarm_id"];
        deleteColumns(tbl, "cal_todos", removeTodoCols, db);

        addColumn(tbl, "cal_todos", "todo_entry_tz", "VARCHAR", db);
        addColumn(tbl, "cal_todos", "todo_due_tz", "VARCHAR", db);
        addColumn(tbl, "cal_todos", "todo_completed_tz", "VARCHAR", db);
        addColumn(tbl, "cal_todos", "alarm_time", "INTEGER", db);
        addColumn(tbl, "cal_todos", "alarm_time_tz", "VARCHAR", db);

        dropTable(tbl, "cal_alarms", db);

        // The change between 2 and 3 includes the splitting of cal_items into
        // cal_events and cal_todos, and the addition of columns for
        // event_start_tz, event_end_tz, todo_entry_tz, todo_due_tz.
        // These need to default to "UTC" if their corresponding time is
        // given, since that's what the default was for v2 calendars

        // Fix up the new timezone columns
        function updateSql(tbl, field) {
            executeSimpleSQL(db, "UPDATE " + tbl + " SET " + field + "_tz='UTC'" +
                                 " WHERE " + field + " IS NOT NULL");
        }

        updateSql("cal_events", "event_start");
        updateSql("cal_events", "event_end");
        updateSql("cal_todos", "todo_entry");
        updateSql("cal_todos", "todo_due");
        updateSql("cal_todos", "todo_completed");

        setDbVersionAndCommit(db, 3);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Upgrade to version 4.
 * Bug 293183 - implement exception support for recurrence.
 * r=shaver,p=vlad
 */
upgrade.v4 = function upgrade_v4(db, version) {
    let tbl = upgrade.v3(version < 3 && db, version);
    LOGdb(db, "Storage: Upgrading to v4");

    beginTransaction(db);
    try {
        for each (let tblid in ["events", "todos", "attendees", "properties"]) {
            addColumn(tbl, "cal_" + tblid, "recurrence_id", "INTEGER", db);
            addColumn(tbl, "cal_" + tblid, "recurrence_id_tz", "VARCHAR", db);
        }
        setDbVersionAndCommit(db, 4);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 315051 - Switch to storing alarms based on offsets from start/end time
 * rather than as absolute times. Ensure that missed alarms are fired.
 * r=dmose, p=jminta
 */
upgrade.v5 = function upgrade_v5(db, version) {
    let tbl = upgrade.v4(version < 4 && db, version);
    LOGdb(db, "Storage: Upgrading to v5");

    beginTransaction(db);
    try {
        for each (let tblid in ["events", "todos"]) {
            addColumn(tbl, "cal_" + tblid, "alarm_offset", "INTEGER", db);
            addColumn(tbl, "cal_" + tblid, "alarm_related", "INTEGER", db);
            addColumn(tbl, "cal_" + tblid, "alarm_last_ack", "INTEGER", db);
        }
        setDbVersionAndCommit(db, 5);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 333688 - Converts STRING and VARCHAR columns to TEXT to avoid SQLite's
 * auto-conversion of strings to numbers (10e4 to 10000)
 * r=ctalbert,jminta p=lilmatt
 */
upgrade.v6 = function upgrade_v6(db, version) {
    let tbl = upgrade.v5(version < 5 && db, version);
    LOGdb(db, "Storage: Upgrading to v6");

    beginTransaction(db);
    try {
        let eventCols = ["id", "title", "privacy", "ical_status",
                         "recurrence_id_tz", "event_start_tz",
                         "event_end_tz", "alarm_time_tz"];
        alterTypes(tbl, "cal_events", eventCols, "TEXT", db);

        let todoCols = ["id", "title", "privacy", "ical_status",
                         "recurrence_id_tz", "todo_entry_tz",
                         "todo_due_tz", "todo_completed_tz",
                         "alarm_time_tz"];
        alterTypes(tbl, "cal_todos", todoCols, "TEXT", db);

        let attendeeCols = ["item_id", "recurrence_id_tz", "attendee_id",
                            "common_name", "role", "status", "type"];
        alterTypes(tbl, "cal_attendees", attendeeCols, "TEXT", db);

        let recurrenceCols =  ["item_id", "recur_type", "dates", "second",
                               "minute", "hour", "day", "monthday", "yearday",
                               "weekno", "month", "setpos"];
        alterTypes(tbl, "cal_recurrence", recurrenceCols, "TEXT", db);

        let propertyCols = ["item_id", "recurrence_id_tz", "key"];
        alterTypes(tbl, "cal_properties", propertyCols, "TEXT", db);
        setDbVersionAndCommit(db, 6);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 369010: Migrate all old tzids in storage to new one.
 * r=ctalbert,dmose p=lilmatt
 */
upgrade.v7 = function upgrade_v7(db, version) {
    // No schema changes in v7
    let tbl = upgrade.v6(db, version);
    LOGdb(db, "Storage: Upgrading to v7");
    return tbl;
};

/**
 * Bug 410931 - Update internal timezone definitions
 * r=ctalbert, p=dbo,nth10sd,hb
 */
upgrade.v8 = function upgrade_v8(db, version) {
    // No schema changes in v8
    let tbl = upgrade.v7(db, version);
    LOGdb(db, "Storage: Upgrading to v8");
    return tbl;
};

/**
 * Bug 363191 - Handle Timezones more efficiently (Timezone Database)
 * r=philipp,ctalbert, p=dbo
 */
upgrade.v9 = function upgrade_v9(db, version) {
    // No schema changes in v9
    let tbl = upgrade.v8(db, version);
    LOGdb(db, "Storage: Upgrading to v9");
    return tbl;
};

/**
 * Bug 413908 – Events using internal timezones are no longer updated to
 * recent timezone version;
 * r=philipp, p=dbo
 */
upgrade.v10 = function upgrade_v10(db, version) {
    let tbl = upgrade.v9(version < 9 && db, version);
    LOGdb(db, "Storage: Upgrading to v10");

    beginTransaction(db);
    try {
        addTable(tbl, "cal_tz_version", { version: "TEXT" }, db);
        setDbVersionAndCommit(db, 10);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Fix bug 319909 - Failure to properly serialize/unserialize ics ATTACH
 * properties.
 * r=philipp,p=fred.jen@web.de
 */
upgrade.v11 = function upgrade_v11(db, version) {
    let tbl = upgrade.v10(version < 10 && db, version);
    LOGdb(db, "Storage: Upgrading to v11");

    beginTransaction(db);
    try {
        addTable(tbl, "cal_attachments", {
            item_id: "TEXT",
            data: "BLOB",
            format_type: "TEXT",
            encoding: "TEXT"
        }, db);
        setDbVersionAndCommit(db, 11);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Bug 449031 - Add meta data API to memory/storage
 * r=philipp, p=dbo
 */
upgrade.v12 = function upgrade_v12(db, version) {
    let tbl = upgrade.v11(version < 11 && db, version);
    LOGdb(db, "Storage: Upgrading to v12");

    beginTransaction(db);
    try {
        addColumn(tbl, "cal_attendees", "is_organizer", "BOOLEAN", db);
        addColumn(tbl, "cal_attendees", "properties", "BLOB", db);

        addTable(tbl, "cal_metadata", {
            cal_id: "INTEGER",
            item_id: "TEXT UNIQUE",
            value: "BLOB"
        }, db);
        setDbVersionAndCommit(db, 12);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 449401 - storage provider doesn't cleanly separate items of the same id
 * across different calendars
 * r=dbo,philipp, p=wsourdeau@inverse.ca
 */
upgrade.v13 = function upgrade_v13(db, version) {
    let tbl = upgrade.v12(version < 12 && db, version);
    LOGdb(db, "Storage: Upgrading to v13");

    beginTransaction(db);
    try {
        alterTypes(tbl, "cal_metadata", ["item_id"], "TEXT", db);

        let calIds = {};
        if (db) {
            for each (let itemTable in ["events", "todos"]) {
                let stmt = createStatement(db,
                                           "SELECT id, cal_id FROM cal_" + itemTable);
                while (stmt.step()) {
                    calIds[stmt.row.id] = stmt.row.cal_id;
                }
                stmt.reset();
            }
        }

        for each (let tblid in ["attendees", "recurrence", "properties",
                                "attachments"]) {
            addColumn(tbl, "cal_" + tblid, "cal_id", "INTEGER", db);

            for (let itemId in calIds) {
                executeSimpleSQL(db, "UPDATE cal_" + tblid +
                                     "   SET cal_id = " + calIds[itemId] +
                                     " WHERE item_id = '" + itemId + "'");
            }
        }

        executeSimpleSQL(db, "DROP INDEX IF EXISTS" +
                             " idx_cal_properies_item_id");
        executeSimpleSQL(db, "CREATE INDEX IF NOT EXISTS" +
                             " idx_cal_properies_item_id" +
                             " ON cal_properties(cal_id, item_id);");
        setDbVersionAndCommit(db, 13);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Bug 446303 - use the "RELATED-TO" property.
 * r=philipp,dbo, p=fred.jen@web.de
 */
upgrade.v14 = function upgrade_v14(db, version) {
    let tbl = upgrade.v13(version < 13 && db, version);
    LOGdb(db, "Storage: Upgrading to v14");

    beginTransaction(db);
    try {
        addTable(tbl, "cal_relations", {
            cal_id: "INTEGER",
            item_id: "TEXT",
            rel_type: "TEXT",
            rel_id: "TEXT"
        }, db);
        setDbVersionAndCommit(db, 14);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Bug 463282 - Tasks cannot be created or imported (regression).
 * r=philipp,berend, p=dbo
 */
upgrade.v15 = function upgrade_v15(db, version) {
    let tbl = upgrade.v14(version < 14 && db, version);
    LOGdb(db, "Storage: Upgrading to v15");

    beginTransaction(db);
    try {
        addColumn(tbl, "cal_todos", "todo_stamp", "INTEGER", db);
        setDbVersionAndCommit(db, 15);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }
    return tbl;
};

/**
 * Bug 353492 - support multiple alarms per events/task, support
 * absolute alarms with fixed date/time - Storage Provider support for multiple
 * alarms.
 * r=dbo,ssitter, p=philipp
 *
 * This upgrader is a bit special. To fix bug 494140, we decided to change the
 * upgrading code afterwards to make sure no data is lost for people upgrading
 * from 0.9 -> 1.0b1 and later. The v17 upgrader will merely take care of the
 * upgrade if a user is upgrading from 1.0pre -> 1.0b1 or later.
 */
upgrade.v16 = function upgrade_v16(db, version) {
    let tbl = upgrade.v15(version < 15 && db, version);
    LOGdb(db, "Storage: Upgrading to v16");
    beginTransaction(db);
    try {
        createFunction(db, "translateAlarm", 4, {
            onFunctionCall: function translateAlarm(storArgs) {
                try {
                    let [aOffset, aRelated, aAlarmTime, aTzId] =
                        [0,1,2,3].map(function(i) storArgs.getUTF8String(i));

                    let alarm = cal.createAlarm();
                    if (aOffset) {
                        alarm.related = parseInt(aRelated, 10) + 1;
                        alarm.offset = cal.createDuration();
                        alarm.offset.inSeconds = aOffset;
                    } else if (aAlarmTime) {
                        alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
                        let alarmDate = cal.createDateTime();
                        alarmDate.nativeTime = aAlarmTime;
                        if (aTzId == "floating") {
                            // The current calDateTime code assumes that if a
                            // date is floating then we can just assign the new
                            // timezone. I have the feeling this is wrong so I
                            // filed bug 520463. Since we want to release 1.0b1
                            // soon, I will just fix this on the "client side"
                            // and do the conversion here.
                            alarmDate.timezone = cal.getTimezoneService().defaultTimezone;
                            alarmDate = alarmDate.getInTimezone(cal.UTC());
                        } else {
                            alarmDate.timezone = cal.getTimezoneService().getTimezone(aTzId);
                        }
                        alarm.alarmDate = alarmDate;
                    }
                    return alarm.icalString;
                } catch (e) {
                    // Errors in this function are not really logged. Do this
                    // separately.
                    cal.ERROR("Error converting alarms: " + e);
                    throw e;
                }
            }
        });

        addTable(tbl, "cal_alarms", {
            cal_id: "INTEGER",
            item_id: "TEXT",
            // Note the following two columns were not originally part of the
            // v16 upgrade, see note above function.
            recurrence_id: "INTEGER",
            recurrence_id_tz: "TEXT",
            icalString: "TEXT"
        }, db);

        let copyDataOver = function copyDataOver(tbl) {
            const transAlarm =  "translateAlarm(alarm_offset, " +
                                               "alarm_related, " +
                                               "alarm_time, " +
                                               "alarm_time_tz)";
            executeSimpleSQL(db, "INSERT INTO cal_alarms (cal_id, item_id," +
                                 "                        recurrence_id, " +
                                 "                        recurrence_id_tz, " +
                                 "                        icalString)" +
                                 " SELECT cal_id, id, recurrence_id," +
                                 "        recurrence_id_tz, " + transAlarm +
                                 "   FROM " + tbl +
                                 "  WHERE alarm_offset IS NOT NULL" +
                                 "     OR alarm_time IS NOT NULL;");

        };
        copyDataOver("cal_events");
        copyDataOver("cal_todos");
        removeFunction(db, "translateAlarm");

        // Make sure the alarm flag is set on the item
        executeSimpleSQL(db, "UPDATE cal_events " +
                             "   SET flags = flags | " + CAL_ITEM_FLAG.HAS_ALARMS +
                             " WHERE id IN" +
                             "  (SELECT item_id " +
                             "     FROM cal_alarms " +
                             "    WHERE cal_alarms.cal_id = cal_events.cal_id)");
        executeSimpleSQL(db, "UPDATE cal_todos " +
                             "   SET flags = flags | " + CAL_ITEM_FLAG.HAS_ALARMS +
                             " WHERE id IN" +
                             "  (SELECT item_id " +
                             "     FROM cal_alarms " +
                             "     WHERE cal_alarms.cal_id = cal_todos.cal_id)");

        // Remote obsolete columns
        let cols = ["alarm_time",
                    "alarm_time_tz",
                    "alarm_offset",
                    "alarm_related"];
        for each (let tblid in ["events", "todos"]) {
            deleteColumns(tbl, "cal_" + tblid, cols, db);
        }

        setDbVersionAndCommit(db, 16);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 494140 - Multiple reminders,relations,attachments created by modifying
 * repeating event.
 * r=dbo,ssitter, p=philipp
 *
 * This upgrader is special. In bug 494140 we decided it would be better to fix
 * the v16 upgrader so 0.9 users can update to 1.0b1 and later without dataloss.
 * Therefore all this upgrader does is handle users of 1.0pre before the
 * mentioned bug.
 */
upgrade.v17 = function upgrade_v17(db, version) {
    let tbl = upgrade.v16(version < 16 && db, version);
    LOGdb(db, "Storage: Upgrading to v17");
    beginTransaction(db);
    try {
        for each (let tblName in ["alarms", "relations", "attachments"]) {
            let hasColumns = true;
            try {
                // Stepping this statement will fail if the columns don't exist.
                // We don't use the delegate here since it would show an error to
                // the user, even through we expect the error. If the db is null,
                // then swallowing the error is ok too since the cols will
                // already be added in v16.
                let stmt = db.createStatement("SELECT recurrence_id_tz," +
                                              "       recurrence_id" +
                                              "  FROM cal_" + tblName +
                                              " LIMIT 1");
                stmt.step();
                stmt.finalize();
            } catch (e) {
                // An error happened, which means the cols don't exist
                hasColumns = false;
            }

            // Only add the columns if they are not there yet (i.e added in v16)
            // Since relations were broken all along, also make sure and add the
            // columns to the javascript object if there is no database.
            if (!hasColumns || !db) {
                addColumn(tbl, "cal_" + tblName, "recurrence_id", "INTEGER", db);
                addColumn(tbl, "cal_" + tblName, "recurrence_id_tz", "TEXT", db);
            }

            // Clear out entries that are exactly the same. This corrects alarms
            // created in 1.0pre and relations and attachments created in 0.9.
            copyTable(tbl,
                      "cal_" + tblName,
                      "cal_" + tblName + "_v17",
                      db,
                      null,
                      "DISTINCT");
            renameTable(tbl,
                        "cal_" + tblName + "_v17",
                        "cal_" + tblName,
                        db,
                        true);

        }
        setDbVersionAndCommit(db, 17);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};

/**
 * Bug 529326 -  Create indexes for the local calendar
 * r=mschroeder, p=philipp
 *
 * This bug adds some indexes to improve performance. If you would like to add
 * additional indexes, please read http://www.sqlite.org/optoverview.html first.
 */
upgrade.v18 = function upgrade_v18(db, version) {
    let tbl = upgrade.v17(version < 17 && db, version);
    LOGdb(db, "Storage: Upgrading to v18");
    beginTransaction(db);
    try {
        // These fields are often indexed over
        let simpleIds = ["cal_id", "item_id"];
        let allIds = simpleIds.concat(["recurrence_id", "recurrence_id_tz"]);

        // Alarms, Attachments, Attendees, Relations
        for each (let tblName in ["alarms", "attachments", "attendees", "relations"]) {
            createIndex(tbl, "cal_" + tblName, allIds, db);
        }

        // Events and Tasks
        for each (let tblName in ["events", "todos"]) {
            createIndex(tbl, "cal_" + tblName, ["flags", "cal_id", "recurrence_id"], db);
            createIndex(tbl, "cal_" + tblName, ["id", "cal_id", "recurrence_id"], db);
        }

        // Metadata
        createIndex(tbl, "cal_metadata", simpleIds, db);

        // Properties. Remove the index we used to create first, since our index
        // is much more complete.
        executeSimpleSQL(db, "DROP INDEX IF EXISTS idx_cal_properies_item_id");
        createIndex(tbl, "cal_properties", allIds, db);

        // Recurrence
        createIndex(tbl, "cal_recurrence", simpleIds, db);

        setDbVersionAndCommit(db, 18);
    } catch (e) {
        throw reportErrorAndRollback(db, e);
    }

    return tbl;
};
