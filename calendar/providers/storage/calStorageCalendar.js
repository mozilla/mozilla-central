/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");
Components.utils.import("resource://calendar/modules/calStorageUpgrade.jsm");
Components.utils.import("resource://calendar/modules/calStorageHelpers.jsm");

const USECS_PER_SECOND = 1000000;
const kCalICalendar = Components.interfaces.calICalendar;
const cICL = Components.interfaces.calIChangeLog;

//
// calStorageCalendar
//

function calStorageCalendar() {
    this.initProviderBase();
    this.mItemCache = {};
    this.mRecEventCache = {};
    this.mRecTodoCache = {};
}
const calStorageCalendarClassID = Components.ID("{b3eaa1c4-5dfe-4c0a-b62a-b3a514218461}");
const calStorageCalendarInterfaces = [
    Components.interfaces.calICalendar,
    Components.interfaces.calICalendarProvider,
    Components.interfaces.calIOfflineStorage,
    Components.interfaces.calISchedulingSupport,
    Components.interfaces.calISyncWriteCalendar,
];
calStorageCalendar.prototype = {
    __proto__: cal.ProviderBase.prototype,
    classID: calStorageCalendarClassID,
    QueryInterface: XPCOMUtils.generateQI(calStorageCalendarInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calStorageCalendarClassID,
        contractID: "@mozilla.org/calendar/calendar;1?type=storage",
        classDescription: "Calendar Storage Provider",
        interfaces: calStorageCalendarInterfaces
    }),

    //
    // private members
    //
    mDB: null,
    mItemCache: null,
    mRecItemCacheInited: false,
    mRecEventCache: null,
    mRecTodoCache: null,
    mLastStatement: null,

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay() {
        return null;
    },

    get displayName() {
        return cal.calGetString("calendar", "storageName");
    },

    createCalendar: function cSC_createCalendar() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function cSC_deleteCalendar(aCalendar, listener) {
        aCalendar = aCalendar.wrappedJSObject;

        for each (let stmt in this.mDeleteEventExtras) {
            try {
                this.prepareStatement(stmt);
                stmt.executeStep();
            } finally {
                stmt.reset();
            }
        }

        for each (let stmt in this.mDeleteTodoExtras) {
            try {
                this.prepareStatement(stmt);
                stmt.executeStep();
            } finally {
                stmt.reset();
            }
        }

        try {
            this.prepareStatement(this.mDeleteAllEvents);
            this.mDeleteAllEvents.executeStep();
        } finally {
            this.mDeleteAllEvents.reset();
        }

        try {
            this.prepareStatement(this.mDeleteAllTodos);
            this.mDeleteAllTodos.executeStep();
        } finally {
            this.mDeleteAllTodos.reset();
        }

        try {
            this.prepareStatement(this.mDeleteAllMetaData);
            this.mDeleteAllMetaData.executeStep();
        } finally {
            this.mDeleteAllMetaData.reset();
        }

        try {
            if (listener) {
                listener.onDeleteCalendar(aCalendar, Components.results.NS_OK, null);
            }
        } catch (ex) {
            this.logError("error calling listener.onDeleteCalendar", ex);
        }
    },

    mRelaxedMode: undefined,
    get relaxedMode() {
        if (this.mRelaxedMode === undefined) {
            this.mRelaxedMode = this.getProperty("relaxedMode");
        }
        return this.mRelaxedMode;
    },

    //
    // calICalendar interface
    //

    getProperty: function cSC_getProperty(aName) {
        switch (aName) {
            case "cache.supported":
                return false;
            case "requiresNetwork":
                return false;
        }
        return this.__proto__.__proto__.getProperty.apply(this, arguments);
    },

    // readonly attribute AUTF8String type;
    get type() { return "storage"; },

    // attribute AUTF8String id;
    get id() {
        return this.__proto__.__proto__.__lookupGetter__("id").call(this);
    },
    set id(val) {
        let id = this.__proto__.__proto__.__lookupSetter__("id").call(this, val);

        if (!this.mDB && this.uri && this.id) {
            // Prepare the database as soon as we have an id and an uri.
            this.prepareInitDB();
        }
        return id;
    },

    // attribute nsIURI uri;
    get uri() {
        return this.__proto__.__proto__.__lookupGetter__("uri").call(this);
    },
    set uri(aUri) {
        // We can only load once
        if (this.uri) {
            throw Components.results.NS_ERROR_FAILURE;
        }

        let uri = this.__proto__.__proto__.__lookupSetter__("uri").call(this, aUri);

        if (!this.mDB && this.uri && this.id) {
            // Prepare the database as soon as we have an id and an uri.
            this.prepareInitDB();
        }

        return uri;
    },

    /**
     * Initialize the Database. This should only be called from the uri or id
     * setter and requires those two attributes to be set.
     */
    prepareInitDB: function cSC_prepareInitDB() {
        if (this.uri.schemeIs("file")) {
            let fileURL = this.uri.QueryInterface(Components.interfaces.nsIFileURL);
            if (!fileURL) {
                throw new Components.Exception("Invalid file", Components.results.NS_ERROR_NOT_IMPLEMENTED);
            }
            // open the database
            this.mDB = Services.storage.openDatabase(fileURL.file);
            this.mDB.executeSimpleSQL("PRAGMA journal_mode=WAL");
            upgradeDB(this.mDB);

        } else if (this.uri.schemeIs("moz-profile-calendar")) {
            // This is an old-style moz-profile-calendar. It requires some
            // migration steps.

            let localDB = cal.getCalendarDirectory();
            localDB.append("local.sqlite");
            localDB = Services.storage.openDatabase(localDB);

            // First, we need to check if this is from 0.9, i.e we need to
            // migrate from storage.sdb to local.sqlite.
            let storageSdb = Services.dirsvc.get("ProfD", Components.interfaces.nsILocalFile);
            storageSdb.append("storage.sdb");
            this.mDB = Services.storage.openDatabase(storageSdb);
            if (this.mDB.tableExists("cal_events")) {
                cal.LOG("[calStorageCalendar] Migrating storage.sdb -> local.sqlite");
                upgradeDB(this.mDB); // upgrade schema before migating data

                let attachStatement;
                try {
                    attachStatement = this.mDB.createStatement("ATTACH DATABASE :file_path AS local_sqlite");
                    attachStatement.params.file_path = localDB.databaseFile.path;
                    attachStatement.executeStep();
                } catch (exc) {
                    this.logError("prepareInitDB attachStatement.execute exception", exc);
                    throw exc;
                } finally {
                    if (attachStatement) {
                        attachStatement.reset();
                    }
                }
                try {
                    // hold lock on storage.sdb until we've migrated data from storage.sdb:
                    this.mDB.beginTransactionAs(Components.interfaces.mozIStorageConnection.TRANSACTION_EXCLUSIVE);
                    try {
                        if (this.mDB.tableExists("cal_events")) { // check again (with lock)
                            // take over data and drop from storage.sdb tables:
                            for (let table in getSqlTable(DB_SCHEMA_VERSION)) {
                                if (table.substr(0, 4) != "idx_") {
                                    this.mDB.executeSimpleSQL("CREATE TABLE local_sqlite." +  table +
                                                              " AS SELECT * FROM " + table +
                                                              "; DROP TABLE IF EXISTS " +  table);
                                }
                            }
                            this.mDB.commitTransaction();
                        } else { // migration done in the meantime
                            this.mDB.rollbackTransaction();
                        }
                    } catch (exc) {
                        this.logError("prepareInitDB storage.sdb migration exception", exc);
                        this.mDB.rollbackTransaction();
                        throw exc;
                    }
                } finally {
                    this.mDB.executeSimpleSQL("DETACH DATABASE local_sqlite");
                }
            }

            // Now that we are through, set the database to the new local.sqlite
            // and start the upgraders.
            this.mDB = localDB;
            upgradeDB(this.mDB);


            // Afterwards, we have to migrate the moz-profile-calendars to the
            // new moz-storage-calendar schema. This is needed due to bug 479867
            // and its regression bug 561735. The first calendar created before
            // v19 already has a moz-profile-calendar:// uri without an ?id=
            // parameter (the id in the databse is 0). We need to migrate this
            // special calendar differently.

            // WARNING: This is a somewhat fragile process. Great care should be
            // taken during future schema upgrades to make sure this still
            // works.
            this.mDB.beginTransactionAs(Components.interfaces.mozIStorageConnection.TRANSACTION_EXCLUSIVE);
            try {
                /**
                 * Helper function to migrate all tables from one id to the next
                 *
                 * @param db        The database to use
                 * @param newCalId  The new calendar id to set
                 * @param oldCalId  The old calendar id to look for
                 */
                function migrateTables(db, newCalId, oldCalId) {
                    for each (let tbl in ["cal_alarms", "cal_attachments",
                                          "cal_attendees", "cal_events",
                                          "cal_metadata", "cal_properties",
                                          "cal_recurrence", "cal_relations",
                                          "cal_todos"]) {
                        let stmt;
                        try {
                            stmt = db.createStatement("UPDATE " + tbl +
                                                      "   SET cal_id = :cal_id" +
                                                      " WHERE cal_id = :old_cal_id");
                            stmt.params.cal_id = newCalId;
                            stmt.params.old_cal_id = oldCalId;
                            stmt.executeStep();
                        } catch (e) {
                            // Pass error through to enclosing try/catch block
                            throw e;
                        } finally {
                            if (stmt) {
                                stmt.reset();
                            }
                        }
                    }
                }

                let id = 0;
                let path = this.uri.path;
                let pos = path.indexOf("?id=");

                if (pos != -1) {
                    // There is an "id" parameter in the uri. This calendar
                    // has not been migrated to using the uuid as its cal_id.
                    pos = this.uri.path.indexOf("?id=");
                    if (pos != -1) {
                        cal.LOG("[calStorageCalendar] Migrating numeric cal_id to uuid");
                        id = parseInt(path.substr(pos + 4), 10);
                        migrateTables(this.mDB, this.id, id);

                        // Now remove the id from the uri to make sure we don't do this
                        // again. Remeber the id, so we can recover in case something
                        // goes wrong.
                        this.setProperty("uri", "moz-storage-calendar://");
                        this.setProperty("old_calendar_id", id);

                        this.mDB.commitTransaction();
                    } else {
                        this.mDB.rollbackTransaction();
                    }
                } else {
                    // For some reason, the first storage calendar before the
                    // v19 upgrade has cal_id=0. If we still have a
                    // moz-profile-calendar here, then this is the one and we
                    // need to move all events with cal_id=0 to this id.
                    cal.LOG("[calStorageCalendar] Migrating stray cal_id=0 calendar to uuid");
                    migrateTables(this.mDB, this.id, 0);
                    this.setProperty("uri", "moz-storage-calendar://");
                    this.setProperty("old_calendar_id", 0);
                    this.mDB.commitTransaction();
                }
            } catch (exc) {
                this.logError("prepareInitDB  moz-profile-calendar migration exception", exc);
                this.mDB.rollbackTransaction();
                throw exc;
            }
        } else if (this.uri.schemeIs("moz-storage-calendar")) {
            // New style uri, no need for migration here
            let localDB = cal.getCalendarDirectory();
            localDB.append("local.sqlite");

            this.mDB = Services.storage.openDatabase(localDB);
            upgradeDB(this.mDB);
        } else {
            throw new Components.Exception("Invalid Scheme " + this.uri.spec);
        }

        this.initDB();
        Services.obs.addObserver(this, "profile-before-change", false);
    },

    observe: function cSC_observe(aSubject, aTopic, aData) {
        if (aTopic == "profile-before-change") {
            Services.obs.removeObserver(this, "profile-before-change");
            this.shutdownDB();
        }
    },

    /**
     * Takes care of necessary preparations for most of our statements.
     *
     * @param aStmt         The statement to prepare.
     */
    prepareStatement: function cSC_prepareStatement(aStmt) {
        try {
            aStmt.params.cal_id = this.id;
            this.mLastStatement = aStmt;
        } catch (e) {
            this.logError("prepareStatement exception", e);
        }
    },

    /**
     * Executes a statement using an item as a parameter.
     *
     * @param aStmt         The statement to execute.
     * @param aIdParam      The name of the parameter refering to the item id.
     * @param aId           The id of the item.
     */
    executeItemStatement: function cSC_executeItemStatement(aStmt, aIdParam, aId) {
        try {
            aStmt.params.cal_id = this.id;
            aStmt.params[aIdParam] = aId;
            aStmt.executeStep();
        } catch (e) {
            this.logError("executeItemStatement exception", e);
            throw e;
        } finally {
            aStmt.reset();
        }
    },

    refresh: function cSC_refresh() {
        // no-op
    },

    // void addItem( in calIItemBase aItem, in calIOperationListener aListener );
    addItem: function cSC_addItem(aItem, aListener) {
        let newItem = aItem.clone();
        return this.adoptItem(newItem, aListener);
    },

    // void adoptItem( in calIItemBase aItem, in calIOperationListener aListener );
    adoptItem: function cSC_adoptItem(aItem, aListener) {
        if (this.readOnly) {
            this.notifyOperationComplete(aListener,
                                         Components.interfaces.calIErrors.CAL_IS_READONLY,
                                         Components.interfaces.calIOperationListener.ADD,
                                         null,
                                         "Calendar is readonly");
            return;
        }

        if (aItem.id == null) {
            // is this an error?  Or should we generate an IID?
            aItem.id = cal.getUUID();
        } else {
            var olditem = this.getItemById(aItem.id);
            if (olditem) {
                if (this.relaxedMode) {
                    // we possibly want to interact with the user before deleting
                    this.deleteItemById(aItem.id, true);
                } else {
                    this.notifyOperationComplete(aListener,
                                                 Components.interfaces.calIErrors.DUPLICATE_ID,
                                                 Components.interfaces.calIOperationListener.ADD,
                                                 aItem.id,
                                                 "ID already exists for addItem");
                    return;
                }
            }
        }

        let parentItem = aItem.parentItem;
        if (parentItem != aItem) {
            parentItem = parentItem.clone();
            parentItem.recurrenceInfo.modifyException(aItem, true);
        }
        parentItem.calendar = this.superCalendar;
        parentItem.makeImmutable();

        this.flushItem(parentItem, null);

        // notify the listener
        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.ADD,
                                     aItem.id,
                                     aItem);

        // notify observers
        this.observers.notify("onAddItem", [aItem]);
    },

    // void modifyItem( in calIItemBase aNewItem, in calIItemBase aOldItem, in calIOperationListener aListener );
    // Actually uses doModifyItem
    modifyItem: function cSC_modifyItem(aNewItem, aOldItem, aListener) {
        let this_ = this;

        // HACK Just modifying the item would clear the offline flag, we need to
        // retrieve the flag and pass it to the real modify function.
        let offlineJournalFlagListener = {
            onGetResult: function (calendar, status, opType, id, detail) {
            },
            onOperationComplete: function (this_, status, opType, id, offlineFlag) {
                this_.doModifyItem(aNewItem, aOldItem, aListener, offlineFlag);
            }
        };
        this.getItemOfflineFlag(aOldItem, offlineJournalFlagListener);
    },

    doModifyItem: function cSC_doModifyItem(aNewItem, aOldItem, aListener, offlineFlag) {
        let oldOfflineFlag = offlineFlag;
        if (this.readOnly) {
            this.notifyOperationComplete(aListener,
                                         Components.interfaces.calIErrors.CAL_IS_READONLY,
                                         Components.interfaces.calIOperationListener.MODIFY,
                                         null,
                                         "Calendar is readonly");
            return null;
        }
        if (!aNewItem) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        let this_ = this;
        function reportError(errStr, errId) {
            this_.notifyOperationComplete(aListener,
                                          errId ? errId : Components.results.NS_ERROR_FAILURE,
                                          Components.interfaces.calIOperationListener.MODIFY,
                                          aNewItem.id,
                                          errStr);
            return null;
        }

        if (aNewItem.id == null) {
            // this is definitely an error
            return reportError("ID for modifyItem item is null");
        }

        let modifiedItem = aNewItem.parentItem.clone();
        if (this.getProperty("capabilities.propagate-sequence")) {
            // Ensure the exception, its parent and the other exceptions have the
            // same sequence number, to make sure we can send our changes to the
            // server if the event has been updated via the blue bar
            let newSequence = aNewItem.getProperty("SEQUENCE");
            this._propagateSequence(modifiedItem, newSequence);
        }

        // Ensure that we're looking at the base item if we were given an
        // occurrence.  Later we can optimize this.
        if (aNewItem.parentItem != aNewItem) {
            modifiedItem.recurrenceInfo.modifyException(aNewItem, false);
        }

        // If no old item was passed, then we should overwrite in any case.
        // Pick up the old item from the database and use this as an old item
        // later on.
        if (!aOldItem) {
            aOldItem = this.getItemById(aNewItem.id);
        }

        if (this.relaxedMode) {
            // We've already filled in the old item above, if this doesn't exist
            // then just take the current item as its old version
            if (!aOldItem) {
                aOldItem = aNewItem;
            }
            aOldItem = aOldItem.parentItem;
        } else {
            var storedOldItem = (aOldItem ? this.getItemById(aOldItem.id) : null);
            if (!aOldItem || !storedOldItem) {
                // no old item found?  should be using addItem, then.
                return reportError("ID does not already exist for modifyItem");
            }
            aOldItem = aOldItem.parentItem;

            if (aOldItem.generation != storedOldItem.generation) {
                return reportError("generation too old for for modifyItem");
            }

            // xxx todo: this only modified master item's generation properties
            //           I start asking myself why we need a separate X-MOZ-GENERATION.
            //           Just for the sake of checking inconsistencies of modifyItem calls?
            if (aOldItem.generation == modifiedItem.generation) { // has been cloned and modified
                // Only take care of incrementing the generation if relaxed mode is
                // off. Users of relaxed mode need to take care of this themselves.
                modifiedItem.generation += 1;
            }
        }

        modifiedItem.makeImmutable();
        this.flushItem(modifiedItem, aOldItem);
        this.setOfflineJournalFlag(aNewItem, oldOfflineFlag);

        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.MODIFY,
                                     modifiedItem.id,
                                     modifiedItem);

        // notify observers
        this.observers.notify("onModifyItem", [modifiedItem, aOldItem]);
        return null;
    },

    // void deleteItem( in string id, in calIOperationListener aListener );
    deleteItem: function cSC_deleteItem(aItem, aListener) {
        if (this.readOnly) {
            this.notifyOperationComplete(aListener,
                                         Components.interfaces.calIErrors.CAL_IS_READONLY,
                                         Components.interfaces.calIOperationListener.DELETE,
                                         null,
                                         "Calendar is readonly");
            return;
        }
        if (aItem.parentItem != aItem) {
            aItem.parentItem.recurrenceInfo.removeExceptionFor(aItem.recurrenceId);
            // xxx todo: would we want to support this case? Removing an occurrence currently results
            //           in a modifyItem(parent)
            return;
        }

        if (aItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.DELETE,
                                         null,
                                         "ID is null for deleteItem");
            return;
        }

        this.deleteItemById(aItem.id);

        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.DELETE,
                                     aItem.id,
                                     aItem);

        // notify observers
        this.observers.notify("onDeleteItem", [aItem]);
    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function cSC_getItem(aId, aListener) {
        if (!aListener)
            return;

        var item = this.getItemById (aId);
        if (!item) {
            // querying by id is a valid use case, even if no item is returned:
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_OK,
                                         Components.interfaces.calIOperationListener.GET,
                                         aId,
                                         null);
            return;
        }

        var item_iid = null;
        if (cal.isEvent(item)) {
            item_iid = Components.interfaces.calIEvent;
        } else if (cal.isToDo(item)) {
            item_iid = Components.interfaces.calITodo;
        } else {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.GET,
                                         aId,
                                         "Can't deduce item type based on QI");
            return;
        }

        aListener.onGetResult (this.superCalendar,
                               Components.results.NS_OK,
                               item_iid, null,
                               1, [item]);

        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.GET,
                                     aId,
                                     null);
    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function cSC_getItems(aItemFilter, aCount,
                                    aRangeStart, aRangeEnd, aListener) {
        let this_ = this;
        cal.postPone(function() {
            this_.getItems_(aItemFilter, aCount, aRangeStart, aRangeEnd, aListener);
        });
    },
    getItems_: function cSC_getItems_(aItemFilter, aCount,
                                      aRangeStart, aRangeEnd, aListener)
    {
        //var profStartTime = Date.now();
        if (!aListener)
            return;

        var self = this;

        var itemsFound = Array();
        var startTime = -0x7fffffffffffffff;
        // endTime needs to be the max value a PRTime can be
        var endTime = 0x7fffffffffffffff;
        var count = 0;
        if (aRangeStart)
            startTime = aRangeStart.nativeTime;
        if (aRangeEnd)
            endTime = aRangeEnd.nativeTime;

        var wantUnrespondedInvitations = ((aItemFilter & kCalICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION) != 0);
        var superCal;
        try {
            superCal = this.superCalendar.QueryInterface(Components.interfaces.calISchedulingSupport);
        } catch (exc) {
            wantUnrespondedInvitations = false;
        }
        function checkUnrespondedInvitation(item) {
            var att = superCal.getInvitedAttendee(item);
            return (att && (att.participationStatus == "NEEDS-ACTION"));
        }

        var wantEvents = ((aItemFilter & kCalICalendar.ITEM_FILTER_TYPE_EVENT) != 0);
        var wantTodos = ((aItemFilter & kCalICalendar.ITEM_FILTER_TYPE_TODO) != 0);
        var asOccurrences = ((aItemFilter & kCalICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0);
        var wantOfflineDeletedItems = ((aItemFilter & kCalICalendar.ITEM_FILTER_OFFLINE_DELETED) != 0);
        var wantOfflineCreatedItems = ((aItemFilter & kCalICalendar.ITEM_FILTER_OFFLINE_CREATED) != 0);
        var wantOfflineModifiedItems = ((aItemFilter & kCalICalendar.ITEM_FILTER_OFFLINE_MODIFIED) != 0);

        if (!wantEvents && !wantTodos) {
            // nothing to do
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_OK,
                                         Components.interfaces.calIOperationListener.GET,
                                         null,
                                         null);
            return;
        }

        // HACK because recurring offline events/todos objects dont have offline_journal information
        // Hence we need to update the mRecEventCacheOfflineFlags and  mRecTodoCacheOfflineFlags hash-tables
        // It can be an expensive operation but is only used in Online Reconciliation mode
        if (wantOfflineCreatedItems | wantOfflineDeletedItems | wantOfflineModifiedItems) {
            this.mRecItemCacheInited = false;
        }

        this.assureRecurringItemCaches();

        var itemCompletedFilter = ((aItemFilter & kCalICalendar.ITEM_FILTER_COMPLETED_YES) != 0);
        var itemNotCompletedFilter = ((aItemFilter & kCalICalendar.ITEM_FILTER_COMPLETED_NO) != 0);

        function checkCompleted(item) {
            return (item.isCompleted ? itemCompletedFilter : itemNotCompletedFilter);
        }

        // sending items to the listener 1 at a time sucks. instead,
        // queue them up.
        // if we ever have more than maxQueueSize items outstanding,
        // call the listener.  Calling with null theItems forces
        // a send and a queue clear.
        var maxQueueSize = 10;
        var queuedItems = [ ];
        var queuedItemsIID;
        function queueItems(theItems, theIID) {
            // if we're about to start sending a different IID,
            // flush the queue
            if (theIID && queuedItemsIID != theIID) {
                if (queuedItemsIID)
                    queueItems(null);
                queuedItemsIID = theIID;
            }

            if (theItems)
                queuedItems = queuedItems.concat(theItems);

            if (queuedItems.length != 0 && (!theItems || queuedItems.length > maxQueueSize)) {
                //var listenerStart = Date.now();
                aListener.onGetResult(self.superCalendar,
                                      Components.results.NS_OK,
                                      queuedItemsIID, null,
                                      queuedItems.length, queuedItems);
                //var listenerEnd = Date.now();
                //dump ("++++ listener callback took: " + (listenerEnd - listenerStart) + " ms\n");

                queuedItems = [ ];
            }
        }

        // helper function to handle converting a row to an item,
        // expanding occurrences, and queue the items for the listener
        function handleResultItem(item, theIID, optionalFilterFunc) {
            var expandedItems = [];
            if (item.recurrenceInfo && asOccurrences) {
                // If the item is recurring, get all ocurrences that fall in
                // the range. If the item doesn't fall into the range at all,
                // this expands to 0 items.
                expandedItems = item.recurrenceInfo.getOccurrences(aRangeStart, aRangeEnd, 0, {});
                if (wantUnrespondedInvitations) {
                    expandedItems = expandedItems.filter(checkUnrespondedInvitation);
                }
            } else if ((!wantUnrespondedInvitations || checkUnrespondedInvitation(item)) &&
                       checkIfInRange(item, aRangeStart, aRangeEnd)) {
                // If no occurrences are wanted, check only the parent item.
                // This will be changed with bug 416975.
                expandedItems = [ item ];
            }

            if (expandedItems.length && optionalFilterFunc) {
                expandedItems = expandedItems.filter(optionalFilterFunc);
            }

            queueItems (expandedItems, theIID);
            return expandedItems.length;
        }

        // check the count and send end if count is exceeded
        function checkCount() {
            if (aCount && count >= aCount) {
                // flush queue
                queueItems(null);

                // send operation complete
                self.notifyOperationComplete(aListener,
                                             Components.results.NS_OK,
                                             Components.interfaces.calIOperationListener.GET,
                                             null,
                                             null);

                // tell caller we're done
                return true;
            }

            return false;
        }

        // First fetch all the events
        if (wantEvents) {
            var sp;             // stmt params
            var resultItems = [];

            // first get non-recurring events that happen to fall within the range
            //
            try {
                this.prepareStatement(this.mSelectNonRecurringEventsByRange);
                sp = this.mSelectNonRecurringEventsByRange.params;
                sp.range_start = startTime;
                sp.range_end = endTime;
                sp.start_offset = aRangeStart ? aRangeStart.timezoneOffset * USECS_PER_SECOND : 0;
                sp.end_offset = aRangeEnd ? aRangeEnd.timezoneOffset * USECS_PER_SECOND : 0;
                sp.offline_journal = null;

                if (wantOfflineDeletedItems) sp.offline_journal = cICL.OFFLINE_FLAG_DELETED_RECORD;
                else if (wantOfflineCreatedItems) sp.offline_journal = cICL.OFFLINE_FLAG_CREATED_RECORD;
                else if (wantOfflineModifiedItems) sp.offline_journal = cICL.OFFLINE_FLAG_MODIFIED_RECORD;

                while (this.mSelectNonRecurringEventsByRange.executeStep()) {
                    let row = this.mSelectNonRecurringEventsByRange.row;
                    resultItems.push(this.getEventFromRow(row, {}));
                }
            } catch (e) {
                this.logError("Error selecting non recurring events by range!\n", e);
            } finally {
                this.mSelectNonRecurringEventsByRange.reset();
            }

            // Process the non-recurring events:
            for each (var evitem in resultItems) {
                count += handleResultItem(evitem, Components.interfaces.calIEvent);
                if (checkCount()) {
                    return;
                }
            }

            // Process the recurring events from the cache
            for each (let evitem in this.mRecEventCache) {
                let offline_journal_flag = this.mRecEventCacheOfflineFlags[evitem.id] || null;
                // No need to return flagged unless asked i.e. sp.offline_journal == offline_journal_flag
                // Return created and modified offline records if sp.offline_journal is null alongwith events that have no flag
                if ((sp.offline_journal == null && offline_journal_flag != cICL.OFFLINE_FLAG_DELETED_RECORD)
                    || (sp.offline_journal != null && offline_journal_flag == sp.offline_journal)) {
                    count += handleResultItem(evitem, Components.interfaces.calIEvent);
                    if (checkCount()) {
                        return;
                    }
                }
            }
        }

        // if todos are wanted, do them next
        if (wantTodos) {
            var sp;             // stmt params
            var resultItems = [];

            // first get non-recurring todos that happen to fall within the range
            try {
                this.prepareStatement(this.mSelectNonRecurringTodosByRange);
                sp = this.mSelectNonRecurringTodosByRange.params;
                sp.range_start = startTime;
                sp.range_end = endTime;
                sp.start_offset = aRangeStart ? aRangeStart.timezoneOffset * USECS_PER_SECOND : 0;
                sp.end_offset = aRangeEnd ? aRangeEnd.timezoneOffset * USECS_PER_SECOND : 0;
                sp.offline_journal = null;
                if (wantOfflineCreatedItems) sp.offline_journal = cICL.OFFLINE_FLAG_CREATED_RECORD;
                if (wantOfflineDeletedItems) sp.offline_journal = cICL.OFFLINE_FLAG_DELETED_RECORD;
                if (wantOfflineModifiedItems) sp.offline_journal = cICL.OFFLINE_FLAG_MODIFIED_RECORD;

                while (this.mSelectNonRecurringTodosByRange.executeStep()) {
                    let row = this.mSelectNonRecurringTodosByRange.row;
                    resultItems.push(this.getTodoFromRow(row, {}));
                }
            } catch (e) {
                this.logError("Error selecting non recurring todos by range", e);
            } finally {
                this.mSelectNonRecurringTodosByRange.reset();
            }

            // process the non-recurring todos:
            for each (var todoitem in resultItems) {
                count += handleResultItem(todoitem, Components.interfaces.calITodo, checkCompleted);
                if (checkCount()) {
                    return;
                }
            }

            // Note: Reading the code, completed *occurrences* seems to be broken, because
            //       only the parent item has been filtered; I fixed that.
            //       Moreover item.todo_complete etc seems to be a leftover...

            // process the recurring todos from the cache
            for each (let todoitem in this.mRecTodoCache) {
                let offline_journal_flag = this.mRecTodoCacheOfflineFlags[todoitem.id] || null;
                if ((sp.offline_journal == null &&
                     (offline_journal_flag == cICL.OFFLINE_FLAG_MODIFIED_RECORD ||
                      offline_journal_flag == cICL.OFFLINE_FLAG_CREATED_RECORD ||
                      offline_journal_flag == null)) ||
                    (sp.offline_journal != null &&
                     (offline_journal_flag == sp.offline_journal))) {

                    count += handleResultItem(todoitem,
                                              Components.interfaces.calITodo,
                                              checkCompleted);
                    if (checkCount()) {
                        return;
                    }
                }
            }
        }

        // flush the queue
        queueItems(null);

        // and finish
        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.GET,
                                     null,
                                     null);

        //var profEndTime = Date.now();
        //dump ("++++ getItems took: " + (profEndTime - profStartTime) + " ms\n");
    },

    getItemOfflineFlag: function cSC_getOfflineJournalFlag(aItem, aListener) {
        let flag = null;
        if (!aItem) {
            // It is possible that aItem can be null, flag provided should be null in this case
            aListener.onOperationComplete(this, Components.results.NS_OK,
                                               Components.interfaces.calIOperationListener.GET, null, flag);
        } else {
            let aID = aItem.id;
            let this_ = this;
            let listener = {
                handleResult: function(aResultSet) {
                        let row = aResultSet.getNextRow();
                        flag = row.getResultByName("offline_journal") || null;
                },
                handleError: function(aError) {
                    this_.logError("Error getting offline flag", aError);
                    aListener.onOperationComplete(this_, Components.results.NS_ERROR_FAILURE,
                                                   Components.interfaces.calIOperationListener.GET, aItem.id, aItem);
                },
                handleCompletion: function(aReason) {
                    aListener.onOperationComplete(this_, Components.results.NS_OK,
                                                   Components.interfaces.calIOperationListener.GET, aItem.id, flag);
                }
            };
            if (cal.isEvent(aItem)) {
                this.prepareStatement(this.mSelectEvent);
                this.mSelectEvent.params.id = aID;
                this.mSelectEvent.executeAsync(listener);
            } else if (cal.isToDo(aItem)) {
                this.prepareStatement(this.mSelectTodo);
                this.mSelectTodo.params.id = aID;
                this.mSelectTodo.executeAsync(listener);
            }
        }
    },

    setOfflineJournalFlag: function cSC_setOfflineJournalFlag(aItem, flag) {
        let aID = aItem.id;
        if (cal.isEvent(aItem)) {
            this.prepareStatement(this.mEditEventOfflineFlag);
            this.mEditEventOfflineFlag.params.id = aID;
            this.mEditEventOfflineFlag.params.offline_journal = flag || null;
            try {
                this.mEditEventOfflineFlag.executeStep();
            } catch (e) {
                this.logError("Error setting offline journal flag for "  + aItem.title, e);
            } finally {
                this.mEditEventOfflineFlag.reset();
            }

        } else if (cal.isToDo(aItem)) {
            this.prepareStatement(this.mEditTodoOfflineFlag);
            this.mEditTodoOfflineFlag.params.id = aID;
            this.mEditTodoOfflineFlag.params.offline_journal = flag || null;
            try {
                this.mEditTodoOfflineFlag.executeStep();
            } catch (e) {
                this.logError("Error setting offline journal flag for "  + aItem.title, e);
            } finally {
                this.mEditTodoOfflineFlag.reset();
            }
        }
    },

    //
    // calIOfflineStorage interface
    //
    addOfflineItem: function(aItem, aListener) {
        let newOfflineJournalFlag = cICL.OFFLINE_FLAG_CREATED_RECORD;
        this.setOfflineJournalFlag(aItem, newOfflineJournalFlag);
        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.ADD,
                                     aItem.id,
                                     aItem);
    },

    modifyOfflineItem: function(aItem, aListener) {
        let this_ = this;
        let opListener = {
            onGetResult: function (calendar, status, itemType, detail, count, items) {
            },
            onOperationComplete: function(calendar, status, opType, id, oldOfflineJournalFlag ) {
                let newOfflineJournalFlag = cICL.OFFLINE_FLAG_MODIFIED_RECORD;
                if (oldOfflineJournalFlag == cICL.OFFLINE_FLAG_CREATED_RECORD || oldOfflineJournalFlag == cICL.OFFLINE_FLAG_DELETED_RECORD) {
                    // Do nothing since a flag of "created" or "deleted" exists
                } else {
                    this_.setOfflineJournalFlag(aItem, newOfflineJournalFlag);
                }
                this_.notifyOperationComplete(aListener,
                                              Components.results.NS_OK,
                                              Components.interfaces.calIOperationListener.MODIFY,
                                              aItem.id,
                                              aItem);
            }
        };
        this.getItemOfflineFlag(aItem, opListener);
    },

    deleteOfflineItem: function(aItem, aListener) {
        let this_ = this;
        let opListener = {
            onGetResult: function (calendar, status, itemType, detail, count, items) {

            },
            onOperationComplete: function(calendar, status, opType, id, oldOfflineJournalFlag) {
                var newOfflineJournalFlag = cICL.OFFLINE_FLAG_DELETED_RECORD;
                if (oldOfflineJournalFlag) {
                    // Delete item if flag is c
                    if (oldOfflineJournalFlag == cICL.OFFLINE_FLAG_CREATED_RECORD) {
                        this_.deleteItemById(aItem.id);
                    } else if (oldOfflineJournalFlag == cICL.OFFLINE_FLAG_MODIFIED_RECORD) {
                        this_.setOfflineJournalFlag(aItem, cICL.OFFLINE_FLAG_DELETED_RECORD);
                    }
                } else {
                    this_.setOfflineJournalFlag(aItem, cICL.OFFLINE_FLAG_DELETED_RECORD);
                }

                this_.notifyOperationComplete(aListener,
                                             Components.results.NS_OK,
                                             Components.interfaces.calIOperationListener.DELETE,
                                             aItem.id,
                                             aItem);
                // notify observers
                this_.observers.notify("onDeleteItem", [aItem]);
            }
        };
        this.getItemOfflineFlag(aItem, opListener);
    },

    resetItemOfflineFlag: function(aItem, aListener) {
        this.setOfflineJournalFlag(aItem,null);
        this.notifyOperationComplete(aListener,
                                     Components.results.NS_OK,
                                     Components.interfaces.calIOperationListener.MODIFY,
                                     aItem.id,
                                     aItem);
    },

    //
    // database handling
    //

    // database initialization
    // assumes mDB is valid

    initDB: function cSC_initDB() {
        cal.ASSERT(this.mDB, "Database has not been opened!", true);

        try {
            this.mSelectEvent = this.mDB.createStatement(
                "SELECT * FROM cal_events " +
                "WHERE id = :id AND cal_id = :cal_id " +
                " AND recurrence_id IS NULL " +
                "LIMIT 1"
                );

            this.mSelectTodo = this.mDB.createStatement(
                "SELECT * FROM cal_todos " +
                "WHERE id = :id AND cal_id = :cal_id " +
                " AND recurrence_id IS NULL " +
                "LIMIT 1"
                );

            // The more readable version of the next where-clause is:
            //   WHERE  ((event_end > :range_start OR
            //           (event_end = :range_start AND
            //           event_start = :range_start))
            //          AND event_start < :range_end)
            //
            // but that doesn't work with floating start or end times. The logic
            // is the same though.
            // For readability, a few helpers:
            var floatingEventStart = "event_start_tz = 'floating' AND event_start"
            var nonFloatingEventStart = "event_start_tz != 'floating' AND event_start"
            var floatingEventEnd = "event_end_tz = 'floating' AND event_end"
            var nonFloatingEventEnd = "event_end_tz != 'floating' AND event_end"
            // The query needs to take both floating and non floating into account
            this.mSelectNonRecurringEventsByRange = this.mDB.createStatement(
                "SELECT * FROM cal_events " +
                "WHERE " +
                " (("+floatingEventEnd+" > :range_start + :start_offset) OR " +
                "  ("+nonFloatingEventEnd+" > :range_start) OR " +
                "  ((("+floatingEventEnd+" = :range_start + :start_offset) OR " +
                "    ("+nonFloatingEventEnd+" = :range_start)) AND " +
                "   (("+floatingEventStart+" = :range_start + :start_offset) OR " +
                "    ("+nonFloatingEventStart+" = :range_start)))) " +
                " AND " +
                "  (("+floatingEventStart+" < :range_end + :end_offset) OR " +
                "   ("+nonFloatingEventStart+" < :range_end)) " +
                " AND cal_id = :cal_id AND flags & 16 == 0 AND recurrence_id IS NULL" +
                " AND ((:offline_journal IS NULL " +
                " AND  (offline_journal IS NULL " +
                "  OR   offline_journal != " + cICL.OFFLINE_FLAG_DELETED_RECORD + ")) " +
                "  OR (offline_journal == :offline_journal))"
                );

            //
            // WHERE (due > rangeStart  AND  (entry IS NULL  OR  entry < rangeEnd)) OR
            //       (due = rangeStart  AND  (entry IS NULL  OR  entry = rangeStart)) OR
            //       (due IS NULL  AND  (entry >= rangeStart  AND  entry < rangeEnd)) OR
            //       (entry IS NULL  AND  (completed > rangeStart  OR  completed IS NULL))
            //
            var floatingTodoEntry = "todo_entry_tz = 'floating' AND todo_entry";
            var nonFloatingTodoEntry = "todo_entry_tz != 'floating' AND todo_entry";
            var floatingTodoDue = "todo_due_tz = 'floating' AND todo_due";
            var nonFloatingTodoDue = "todo_due_tz != 'floating' AND todo_due";
            var floatingCompleted = "todo_completed_tz = 'floating' AND todo_completed";
            var nonFloatingCompleted = "todo_completed_tz != 'floating' AND todo_completed";

            this.mSelectNonRecurringTodosByRange = this.mDB.createStatement(
                "SELECT * FROM cal_todos " +
                "WHERE " +
                "(((("+floatingTodoDue+" > :range_start + :start_offset) OR " +
                "   ("+nonFloatingTodoDue+" > :range_start)) AND " +
                "  ((todo_entry IS NULL) OR " +
                "   (("+floatingTodoEntry+" < :range_end + :end_offset) OR " +
                "    ("+nonFloatingTodoEntry+" < :range_end)))) OR " +
                " ((("+floatingTodoDue+" = :range_start + :start_offset) OR " +
                "   ("+nonFloatingTodoDue+" = :range_start)) AND " +
                "  ((todo_entry IS NULL) OR " +
                "   (("+floatingTodoEntry+" = :range_start + :start_offset) OR " +
                "    ("+nonFloatingTodoEntry+" = :range_start)))) OR " +
                " ((todo_due IS NULL) AND " +
                "  ((("+floatingTodoEntry+" >= :range_start + :start_offset) OR " +
                "    ("+nonFloatingTodoEntry+" >= :range_start)) AND " +
                "   (("+floatingTodoEntry+" < :range_end + :end_offset) OR " +
                "    ("+nonFloatingTodoEntry+" < :range_end)))) OR " +
                " ((todo_entry IS NULL) AND " +
                "  ((("+floatingCompleted+" > :range_start + :start_offset) OR " +
                "    ("+nonFloatingCompleted+" > :range_start)) OR " +
                "   (todo_completed IS NULL)))) " +
                " AND cal_id = :cal_id AND flags & 16 == 0 AND recurrence_id IS NULL " +
                " AND ((:offline_journal IS NULL" +
                " AND  (offline_journal IS NULL" +
                "  OR   offline_journal != " + cICL.OFFLINE_FLAG_DELETED_RECORD + ")) " +
                "  OR (offline_journal == :offline_journal))"
                );

            this.mSelectEventsWithRecurrence = this.mDB.createStatement(
                "SELECT * FROM cal_events " +
                " WHERE flags & 16 == 16 " +
                "   AND cal_id = :cal_id AND recurrence_id is NULL"
                );

            this.mSelectTodosWithRecurrence = this.mDB.createStatement(
                "SELECT * FROM cal_todos " +
                " WHERE flags & 16 == 16 " +
                "   AND cal_id = :cal_id AND recurrence_id IS NULL"
                );

            this.mSelectEventExceptions = this.mDB.createStatement(
                "SELECT * FROM cal_events " +
                "WHERE id = :id AND cal_id = :cal_id" +
                " AND recurrence_id IS NOT NULL"
                );

            this.mSelectTodoExceptions = this.mDB.createStatement(
                "SELECT * FROM cal_todos " +
                "WHERE id = :id AND cal_id = :cal_id" +
                " AND recurrence_id IS NOT NULL"
                );

            // For the extra-item data, we used to use mDBTwo, so that
            // these could be executed while a selectItems was running.
            // This no longer seems to be needed and actually causes
            // havoc when transactions are in use.
            this.mSelectAttendeesForItem = this.mDB.createStatement(
                "SELECT * FROM cal_attendees " +
                "WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id IS NULL"
                );

            this.mSelectAttendeesForItemWithRecurrenceId = this.mDB.createStatement(
                "SELECT * FROM cal_attendees " +
                "WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id = :recurrence_id" +
                " AND recurrence_id_tz = :recurrence_id_tz"
                );

            this.mSelectPropertiesForItem = this.mDB.createStatement(
                "SELECT * FROM cal_properties" +
                " WHERE item_id = :item_id" +
                "   AND cal_id = :cal_id" +
                "   AND recurrence_id IS NULL"
                );

            this.mSelectPropertiesForItemWithRecurrenceId = this.mDB.createStatement(
                "SELECT * FROM cal_properties " +
                "WHERE item_id = :item_id AND cal_id = :cal_id" +
                "  AND recurrence_id = :recurrence_id" +
                "  AND recurrence_id_tz = :recurrence_id_tz"
                );

            this.mSelectRecurrenceForItem = this.mDB.createStatement(
                "SELECT * FROM cal_recurrence " +
                "WHERE item_id = :item_id AND cal_id = :cal_id"
                );

            this.mSelectAttachmentsForItem = this.mDB.createStatement(
                "SELECT * FROM cal_attachments " +
                "WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id IS NULL"
                );
            this.mSelectAttachmentsForItemWithRecurrenceId = this.mDB.createStatement(
                "SELECT * FROM cal_attachments" +
                " WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id = :recurrence_id" +
                " AND recurrence_id_tz = :recurrence_id_tz"
                );

            this.mSelectRelationsForItem = this.mDB.createStatement(
                "SELECT * FROM cal_relations " +
                "WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id IS NULL"
                );
            this.mSelectRelationsForItemWithRecurrenceId = this.mDB.createStatement(
                "SELECT * FROM cal_relations" +
                " WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id = :recurrence_id" +
                " AND recurrence_id_tz = :recurrence_id_tz"
                );

            this.mSelectMetaData = this.mDB.createStatement(
                "SELECT * FROM cal_metadata"
                + " WHERE item_id = :item_id AND cal_id = :cal_id");

            this.mSelectAllMetaData = this.mDB.createStatement(
                "SELECT * FROM cal_metadata"
                + " WHERE cal_id = :cal_id");

            this.mSelectAlarmsForItem = this.mDB.createStatement(
                "SELECT icalString FROM cal_alarms"
                + " WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id IS NULL"
                );

            this.mSelectAlarmsForItemWithRecurrenceId = this.mDB.createStatement(
                "SELECT icalString FROM cal_alarms" +
                " WHERE item_id = :item_id AND cal_id = :cal_id" +
                " AND recurrence_id = :recurrence_id" +
                " AND recurrence_id_tz = :recurrence_id_tz"
                );

            // insert statements
            this.mInsertEvent = this.mDB.createStatement(
                "INSERT INTO cal_events " +
                "  (cal_id, id, time_created, last_modified, " +
                "   title, priority, privacy, ical_status, flags, " +
                "   event_start, event_start_tz, event_end, event_end_tz, event_stamp, " +
                "   recurrence_id, recurrence_id_tz, alarm_last_ack) " +
                "VALUES (:cal_id, :id, :time_created, :last_modified, " +
                "        :title, :priority, :privacy, :ical_status, :flags, " +
                "        :event_start, :event_start_tz, :event_end, :event_end_tz, :event_stamp, " +
                "        :recurrence_id, :recurrence_id_tz, :alarm_last_ack)"
                );

            this.mInsertTodo = this.mDB.createStatement(
                "INSERT INTO cal_todos " +
                "  (cal_id, id, time_created, last_modified, " +
                "   title, priority, privacy, ical_status, flags, " +
                "   todo_entry, todo_entry_tz, todo_due, todo_due_tz, todo_stamp, " +
                "   todo_completed, todo_completed_tz, todo_complete, " +
                "   recurrence_id, recurrence_id_tz, alarm_last_ack)" +
                "VALUES (:cal_id, :id, :time_created, :last_modified, " +
                "        :title, :priority, :privacy, :ical_status, :flags, " +
                "        :todo_entry, :todo_entry_tz, :todo_due, :todo_due_tz, :todo_stamp, " +
                "        :todo_completed, :todo_completed_tz, :todo_complete, " +
                "        :recurrence_id, :recurrence_id_tz, :alarm_last_ack)"
                );
            this.mInsertProperty = this.mDB.createStatement(
                "INSERT INTO cal_properties (cal_id, item_id, recurrence_id, recurrence_id_tz, key, value) " +
                "VALUES (:cal_id, :item_id, :recurrence_id, :recurrence_id_tz, :key, :value)"
                );
            this.mInsertAttendee = this.mDB.createStatement(
                "INSERT INTO cal_attendees " +
                "  (cal_id, item_id, recurrence_id, recurrence_id_tz, icalString) " +
                "VALUES (:cal_id, :item_id, :recurrence_id, :recurrence_id_tz, :icalString)"
                );
            this.mInsertRecurrence = this.mDB.createStatement(
                "INSERT INTO cal_recurrence " +
                "  (cal_id, item_id, icalString) " +
                "VALUES (:cal_id, :item_id, :icalString)"
                );

            this.mInsertAttachment = this.mDB.createStatement(
                "INSERT INTO cal_attachments " +
                " (cal_id, item_id, icalString, recurrence_id, recurrence_id_tz) " +
                "VALUES (:cal_id, :item_id, :icalString, :recurrence_id, :recurrence_id_tz)"
                );

            this.mInsertRelation = this.mDB.createStatement(
                "INSERT INTO cal_relations " +
                " (cal_id, item_id, icalString, recurrence_id, recurrence_id_tz) " +
                "VALUES (:cal_id, :item_id, :icalString, :recurrence_id, :recurrence_id_tz)"
                );

            this.mInsertMetaData = this.mDB.createStatement(
                "INSERT INTO cal_metadata"
                + " (cal_id, item_id, value)"
                + " VALUES (:cal_id, :item_id, :value)");

            this.mInsertAlarm = this.mDB.createStatement(
                "INSERT INTO cal_alarms " +
                "  (cal_id, item_id, icalString, recurrence_id, recurrence_id_tz) " +
                "VALUES  (:cal_id, :item_id, :icalString, :recurrence_id, :recurrence_id_tz)  "
                );
            //Offline Operations
            this.mEditEventOfflineFlag = this.mDB.createStatement(
                "UPDATE cal_events SET offline_journal = :offline_journal" +
                " WHERE id = :id AND cal_id = :cal_id"
            );

            this.mEditTodoOfflineFlag = this.mDB.createStatement(
                "UPDATE cal_todos SET offline_journal = :offline_journal" +
                " WHERE id = :id AND cal_id = :cal_id"
            );

            // delete statements
            this.mDeleteEvent = this.mDB.createStatement(
                "DELETE FROM cal_events WHERE id = :id AND cal_id = :cal_id"
                );
            this.mDeleteTodo = this.mDB.createStatement(
                "DELETE FROM cal_todos WHERE id = :id AND cal_id = :cal_id"
                );
            this.mDeleteAttendees = this.mDB.createStatement(
                "DELETE FROM cal_attendees WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteProperties = this.mDB.createStatement(
                "DELETE FROM cal_properties WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteRecurrence = this.mDB.createStatement(
                "DELETE FROM cal_recurrence WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteAttachments = this.mDB.createStatement(
                "DELETE FROM cal_attachments WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteRelations = this.mDB.createStatement(
                "DELETE FROM cal_relations WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteMetaData = this.mDB.createStatement(
                "DELETE FROM cal_metadata WHERE item_id = :item_id AND cal_id = :cal_id"
                );
            this.mDeleteAlarms = this.mDB.createStatement(
                "DELETE FROM cal_alarms WHERE item_id = :item_id AND cal_id = :cal_id"
                );

            // These are only used when deleting an entire calendar
            var extrasTables = [ "cal_attendees", "cal_properties",
                                 "cal_recurrence", "cal_attachments",
                                 "cal_metadata", "cal_relations",
                                 "cal_alarms"];

            this.mDeleteEventExtras = new Array();
            this.mDeleteTodoExtras = new Array();

            for (var table in extrasTables) {
                this.mDeleteEventExtras[table] = this.mDB.createStatement(
                    "DELETE FROM " + extrasTables[table] + " WHERE item_id IN" +
                    "  (SELECT id FROM cal_events WHERE cal_id = :cal_id)" +
                    " AND cal_id = :cal_id"
                    );
                this.mDeleteTodoExtras[table] = this.mDB.createStatement(
                    "DELETE FROM " + extrasTables[table] + " WHERE item_id IN" +
                    "  (SELECT id FROM cal_todos WHERE cal_id = :cal_id)" +
                    " AND cal_id = :cal_id"
                    );
            }

            // Note that you must delete the "extras" _first_ using the above two
            // statements, before you delete the events themselves.
            this.mDeleteAllEvents = this.mDB.createStatement(
                "DELETE from cal_events WHERE cal_id = :cal_id"
                );
            this.mDeleteAllTodos = this.mDB.createStatement(
                "DELETE from cal_todos WHERE cal_id = :cal_id"
                );

            this.mDeleteAllMetaData = this.mDB.createStatement(
                "DELETE FROM cal_metadata" +
                " WHERE cal_id = :cal_id"
                );
        } catch (e) {
            this.logError("Error initializing statements.", e);
        }
    },

    shutdownDB: function cSC_shutdownDB() {
        try {
            if (this.mDeleteAlarms) { this.mDeleteAlarms.finalize(); }
            if (this.mDeleteAllEvents) { this.mDeleteAllEvents.finalize(); }
            if (this.mDeleteAllMetaData) { this.mDeleteAllMetaData.finalize(); }
            if (this.mDeleteAllTodos) { this.mDeleteAllTodos.finalize(); }
            if (this.mDeleteAttachments) { this.mDeleteAttachments.finalize(); }
            if (this.mDeleteAttendees) { this.mDeleteAttendees.finalize(); }
            if (this.mDeleteEvent) { this.mDeleteEvent.finalize(); }
            if (this.mDeleteMetaData) { this.mDeleteMetaData.finalize(); }
            if (this.mDeleteProperties) { this.mDeleteProperties.finalize(); }
            if (this.mDeleteRecurrence) { this.mDeleteRecurrence.finalize(); }
            if (this.mDeleteRelations) { this.mDeleteRelations.finalize(); }
            if (this.mDeleteTodo) { this.mDeleteTodo.finalize(); }
            if (this.mEditEventOfflineFlag) { this.mEditEventOfflineFlag.finalize(); }
            if (this.mEditTodoOfflineFlag) { this.mEditTodoOfflineFlag.finalize(); }
            if (this.mInsertAlarm) { this.mInsertAlarm.finalize(); }
            if (this.mInsertAttachment) { this.mInsertAttachment.finalize(); }
            if (this.mInsertAttendee) { this.mInsertAttendee.finalize(); }
            if (this.mInsertEvent) { this.mInsertEvent.finalize(); }
            if (this.mInsertMetaData) { this.mInsertMetaData.finalize(); }
            if (this.mInsertProperty) { this.mInsertProperty.finalize(); }
            if (this.mInsertRecurrence) { this.mInsertRecurrence.finalize(); }
            if (this.mInsertRelation) { this.mInsertRelation.finalize(); }
            if (this.mInsertTodo) { this.mInsertTodo.finalize(); }
            if (this.mSelectAlarmsForItem) { this.mSelectAlarmsForItem.finalize(); }
            if (this.mSelectAlarmsForItemWithRecurrenceId) { this.mSelectAlarmsForItemWithRecurrenceId.finalize(); }
            if (this.mSelectAllMetaData) { this.mSelectAllMetaData.finalize(); }
            if (this.mSelectAttachmentsForItem) { this.mSelectAttachmentsForItem.finalize(); }
            if (this.mSelectAttachmentsForItemWithRecurrenceId) { this.mSelectAttachmentsForItemWithRecurrenceId.finalize(); }
            if (this.mSelectAttendeesForItem) { this.mSelectAttendeesForItem.finalize(); }
            if (this.mSelectAttendeesForItemWithRecurrenceId) { this.mSelectAttendeesForItemWithRecurrenceId.finalize(); }
            if (this.mSelectEvent) { this.mSelectEvent.finalize(); }
            if (this.mSelectEventExceptions) { this.mSelectEventExceptions.finalize(); }
            if (this.mSelectEventsWithRecurrence) { this.mSelectEventsWithRecurrence.finalize(); }
            if (this.mSelectMetaData) { this.mSelectMetaData.finalize(); }
            if (this.mSelectNonRecurringEventsByRange) { this.mSelectNonRecurringEventsByRange.finalize(); }
            if (this.mSelectNonRecurringTodosByRange) { this.mSelectNonRecurringTodosByRange.finalize(); }
            if (this.mSelectPropertiesForItem) { this.mSelectPropertiesForItem.finalize(); }
            if (this.mSelectPropertiesForItemWithRecurrenceId) { this.mSelectPropertiesForItemWithRecurrenceId.finalize(); }
            if (this.mSelectRecurrenceForItem) { this.mSelectRecurrenceForItem.finalize(); }
            if (this.mSelectRelationsForItem) { this.mSelectRelationsForItem.finalize(); }
            if (this.mSelectRelationsForItemWithRecurrenceId) { this.mSelectRelationsForItemWithRecurrenceId.finalize(); }
            if (this.mSelectTodo) { this.mSelectTodo.finalize(); }
            if (this.mSelectTodoExceptions) { this.mSelectTodoExceptions.finalize(); }
            if (this.mSelectTodosWithRecurrence) { this.mSelectTodosWithRecurrence.finalize(); }
            if (this.mDeleteEventExtras) {
                for each (let stmt in this.mDeleteEventExtras) { stmt.finalize(); }
            }
            if (this.mDeleteTodoExtras) {
                for each (let stmt in this.mDeleteTodoExtras) { stmt.finalize(); }
            }

            if (this.mDB) { this.mDB.asyncClose(); this.mDB = null; }
        } catch (e) {
            cal.ERROR("Error closing storage database: " + e);
        }
    },

    //
    // database reading functions
    //

    // read in the common ItemBase attributes from aDBRow, and stick
    // them on item
    getItemBaseFromRow: function cSC_getItemBaseFromRow(row, flags, item) {
        item.calendar = this.superCalendar;
        item.id = row.id;
        if (row.title)
            item.title = row.title;
        if (row.priority)
            item.priority = row.priority;
        if (row.privacy)
            item.privacy = row.privacy;
        if (row.ical_status)
            item.status = row.ical_status;

        if (row.alarm_last_ack) {
            // alarm acks are always in utc
            item.alarmLastAck = newDateTime(row.alarm_last_ack, "UTC");
        }

        if (row.recurrence_id) {
            item.recurrenceId = newDateTime(row.recurrence_id, row.recurrence_id_tz);
            if ((row.flags & CAL_ITEM_FLAG.RECURRENCE_ID_ALLDAY) != 0) {
                item.recurrenceId.isDate = true;
            }
        }

        if (flags)
            flags.value = row.flags;

        if (row.time_created) {
            item.setProperty("CREATED", newDateTime(row.time_created, "UTC"));
        }

        // This must be done last because the setting of any other property
        // after this would overwrite it again.
        if (row.last_modified) {
            item.setProperty("LAST-MODIFIED", newDateTime(row.last_modified, "UTC"));
        }
    },

    cacheItem: function cSC_cacheItem(item) {
        this.mItemCache[item.id] = item;
        if (item.recurrenceInfo) {
            if (cal.isEvent(item)) {
                this.mRecEventCache[item.id] = item;
            } else {
                this.mRecTodoCache[item.id] = item;
            }
        }
    },

    mRecEventCacheOfflineFlags: {},
    mRecTodoCacheOfflineFlags : {},
    assureRecurringItemCaches: function cSC_assureRecurringItemCaches() {
        if (this.mRecItemCacheInited) {
            return;
        }
        // build up recurring event and todo cache with its offline flags,
        // because we need that on every query: for recurring items, we need to
        // query database-wide.. yuck

        try {
            this.prepareStatement(this.mSelectEventsWithRecurrence);
            let sp = this.mSelectEventsWithRecurrence.params;
            while (this.mSelectEventsWithRecurrence.executeStep()) {
                let row = this.mSelectEventsWithRecurrence.row;
                let item = this.getEventFromRow(row, {});
                this.mRecEventCache[item.id] = item;
                this.mRecEventCacheOfflineFlags[item.id] = row.offline_journal || null;
            }
        } catch (e) {
            this.logError("Error selecting events with recurrence!", e);
        } finally {
            this.mSelectEventsWithRecurrence.reset();
        }

        try {
            this.prepareStatement(this.mSelectTodosWithRecurrence);
            sp = this.mSelectTodosWithRecurrence.params;
            while (this.mSelectTodosWithRecurrence.executeStep()) {
                var row = this.mSelectTodosWithRecurrence.row;
                var item = this.getTodoFromRow(row, {});
                this.mRecTodoCache[item.id] = item;
                this.mRecTodoCacheOfflineFlags[item.id] = row.offline_journal || null;
            }
        } catch (e) {
            this.logError("Error selecting todos with recurrence!", e);
        } finally {
            this.mSelectTodosWithRecurrence.reset();
        }

        this.mRecItemCacheInited = true;
    },

    // xxx todo: consider removing flags parameter
    getEventFromRow: function cSC_getEventFromRow(row, flags, isException) {
        var item;
        if (!isException) { // only parent items are cached
            item = this.mItemCache[row.id];
            if (item) {
                return item;
            }
        }

        item = createEvent();

        if (row.event_start)
            item.startDate = newDateTime(row.event_start, row.event_start_tz);
        if (row.event_end)
            item.endDate = newDateTime(row.event_end, row.event_end_tz);
        if (row.event_stamp)
            item.setProperty("DTSTAMP", newDateTime(row.event_stamp, "UTC"));
        if ((row.flags & CAL_ITEM_FLAG.EVENT_ALLDAY) != 0) {
            item.startDate.isDate = true;
            item.endDate.isDate = true;
        }

        // This must be done last to keep the modification time intact.
        this.getItemBaseFromRow (row, flags, item);
        this.getAdditionalDataForItem(item, flags.value);

        if (!isException) { // keep exceptions modifyable to set the parentItem
            item.makeImmutable();
            this.cacheItem(item);
        }
        return item;
    },

    getTodoFromRow: function cSC_getTodoFromRow(row, flags, isException) {
        var item;
        if (!isException) { // only parent items are cached
            item = this.mItemCache[row.id];
            if (item) {
                return item;
            }
        }

        item = createTodo();

        if (row.todo_entry)
            item.entryDate = newDateTime(row.todo_entry, row.todo_entry_tz);
        if (row.todo_due)
            item.dueDate = newDateTime(row.todo_due, row.todo_due_tz);
        if (row.todo_stamp)
            item.setProperty("DTSTAMP", newDateTime(row.todo_stamp, "UTC"));
        if (row.todo_completed)
            item.completedDate = newDateTime(row.todo_completed, row.todo_completed_tz);
        if (row.todo_complete)
            item.percentComplete = row.todo_complete;

        // This must be done last to keep the modification time intact.
        this.getItemBaseFromRow (row, flags, item);
        this.getAdditionalDataForItem(item, flags.value);

        if (!isException) { // keep exceptions modifyable to set the parentItem
            item.makeImmutable();
            this.cacheItem(item);
        }
        return item;
    },

    // after we get the base item, we need to check if we need to pull in
    // any extra data from other tables.  We do that here.

    // We used to use mDBTwo for this, so this can be run while a
    // select is executing but this no longer seems to be required.

    getAdditionalDataForItem: function cSC_getAdditionalDataForItem(item, flags) {
        // This is needed to keep the modification time intact.
        var savedLastModifiedTime = item.lastModifiedTime;

        if (flags & CAL_ITEM_FLAG.HAS_ATTENDEES) {
            var selectItem = null;
            if (item.recurrenceId == null) {
                selectItem = this.mSelectAttendeesForItem;
            } else {
                selectItem = this.mSelectAttendeesForItemWithRecurrenceId;
                this.setDateParamHelper(selectItem.params, "recurrence_id", item.recurrenceId);
            }

            try {
                this.prepareStatement(selectItem);
                selectItem.params.item_id = item.id;
                while (selectItem.executeStep()) {
                    let attendee = cal.createAttendee(selectItem.row.icalString);
                    if (attendee && attendee.id) {
                        if (attendee.isOrganizer) {
                            item.organizer = attendee;
                        } else {
                            item.addAttendee(attendee);
                        }
                    } else {
                        cal.WARN("[calStorageCalendar] Skipping invalid attendee for item '" +
                                 item.title + "' (" + item.id + ").");
                    }
                }
            } catch (e) {
                this.logError("Error getting attendees for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                selectItem.reset();
            }
        }

        var row;
        if (flags & CAL_ITEM_FLAG.HAS_PROPERTIES) {
            var selectItem = null;
            if (item.recurrenceId == null) {
                selectItem = this.mSelectPropertiesForItem;
            } else {
                selectItem = this.mSelectPropertiesForItemWithRecurrenceId;
                this.setDateParamHelper(selectItem.params, "recurrence_id", item.recurrenceId);
            }

            try {
                this.prepareStatement(selectItem);
                selectItem.params.item_id = item.id;
                while (selectItem.executeStep()) {
                    row = selectItem.row;
                    var name = row.key;
                    switch (name) {
                        case "DURATION":
                            // for events DTEND/DUE is enforced by calEvent/calTodo, so suppress DURATION:
                            break;
                        case "CATEGORIES": {
                            var cats = categoriesStringToArray(row.value);
                            item.setCategories(cats.length, cats);
                            break;
                        }
                        default:
                            item.setProperty(name, row.value);
                            break;
                    }
                }
            } catch (e) {
                this.logError("Error getting extra properties for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                selectItem.reset();
            }
        }

        var i;
        if (flags & CAL_ITEM_FLAG.HAS_RECURRENCE) {
            if (item.recurrenceId) {
                throw Components.results.NS_ERROR_UNEXPECTED;
            }

            let recInfo = cal.createRecurrenceInfo(item);
            item.recurrenceInfo = recInfo;

            try {
                this.prepareStatement(this.mSelectRecurrenceForItem);
                this.mSelectRecurrenceForItem.params.item_id = item.id;
                while (this.mSelectRecurrenceForItem.executeStep()) {
                    let row = this.mSelectRecurrenceForItem.row;
                    let ritem = this.getRecurrenceItemFromRow(row);
                    recInfo.appendRecurrenceItem(ritem);
                }
            } catch (e) {
                this.logError("Error getting recurrence for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                this.mSelectRecurrenceForItem.reset();
            }
        }

        if (flags & CAL_ITEM_FLAG.HAS_EXCEPTIONS) {
            // it's safe that we don't run into this branch again for exceptions
            // (getAdditionalDataForItem->get[Event|Todo]FromRow->getAdditionalDataForItem):
            // every excepton has a recurrenceId and isn't flagged as CAL_ITEM_FLAG.HAS_EXCEPTIONS
            if (item.recurrenceId)
                throw Components.results.NS_ERROR_UNEXPECTED;

            var rec = item.recurrenceInfo;

            if (cal.isEvent(item)) {
                this.mSelectEventExceptions.params.id = item.id;
                this.prepareStatement(this.mSelectEventExceptions);
                try {
                    while (this.mSelectEventExceptions.executeStep()) {
                        var row = this.mSelectEventExceptions.row;
                        var exc = this.getEventFromRow(row, {}, true /*isException*/);
                        rec.modifyException(exc, true);
                    }
                } catch (e) {
                    this.logError("Error getting exceptions for event '" +
                                  item.title + "' (" + item.id + ")!", e);
                } finally {
                    this.mSelectEventExceptions.reset();
                }
            } else if (cal.isToDo(item)) {
                this.mSelectTodoExceptions.params.id = item.id;
                this.prepareStatement(this.mSelectTodoExceptions);
                try {
                    while (this.mSelectTodoExceptions.executeStep()) {
                        var row = this.mSelectTodoExceptions.row;
                        var exc = this.getTodoFromRow(row, {}, true /*isException*/);
                        rec.modifyException(exc, true);
                    }
                } catch (e) {
                    this.logError("Error getting exceptions for task '" +
                                  item.title + "' (" + item.id + ")!", e);
                } finally {
                    this.mSelectTodoExceptions.reset();
                }
            } else {
                throw Components.results.NS_ERROR_UNEXPECTED;
            }
        }

        if (flags & CAL_ITEM_FLAG.HAS_ATTACHMENTS) {
            let selectAttachment = this.mSelectAttachmentsForItem;
            if (item.recurrenceId != null) {
                selectAttachment = this.mSelectAttachmentsForItemWithRecurrenceId;
                this.setDateParamHelper(selectAttachment.params, "recurrence_id", item.recurrenceId);
            }
            try {
                this.prepareStatement(selectAttachment);
                selectAttachment.params.item_id = item.id;
                while (selectAttachment.executeStep()) {
                    let row = selectAttachment.row;
                    item.addAttachment(cal.createAttachment(row.icalString));
                }
            } catch (e) {
                this.logError("Error getting attachments for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                selectAttachment.reset();
            }
        }

        if (flags & CAL_ITEM_FLAG.HAS_RELATIONS) {
            let selectRelation = this.mSelectRelationsForItem;
            if (item.recurrenceId != null) {
                selectRelation = this.mSelectRelationsForItemWithRecurrenceId;
                this.setDateParamHelper(selectRelation.params, "recurrence_id", item.recurrenceId);
            }
            try {
                this.prepareStatement(selectRelation);
                selectRelation.params.item_id = item.id;
                while (selectRelation.executeStep()) {
                    let row = selectRelation.row;
                    item.addRelation(cal.createRelation(row.icalString));
                }
            } catch (e) {
                this.logError("Error getting relations for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                selectRelation.reset();
            }
        }

        if (flags & CAL_ITEM_FLAG.HAS_ALARMS) {
            let selectAlarm = this.mSelectAlarmsForItem;
            if (item.recurrenceId != null) {
                selectAlarm = this.mSelectAlarmsForItemWithRecurrenceId;
                this.setDateParamHelper(selectAlarm.params, "recurrence_id", item.recurrenceId);
            }
            try {
                selectAlarm.params.item_id = item.id;
                this.prepareStatement(selectAlarm);
                while (selectAlarm.executeStep()) {
                    let row = selectAlarm.row;
                    item.addAlarm(cal.createAlarm(row.icalString));
                }
            } catch (e) {
                this.logError("Error getting alarms for item '" +
                              item.title + "' (" + item.id + ")!", e);
            } finally {
                selectAlarm.reset();
            }
        }

        // Restore the saved modification time
        item.setProperty("LAST-MODIFIED", savedLastModifiedTime);
    },

    getRecurrenceItemFromRow: function cSC_getRecurrenceItemFromRow(row, item) {
        let prop = cal.getIcsService().createIcalPropertyFromString(row.icalString);
        switch (prop.propertyName) {
            case "RDATE":
            case "EXDATE":
                ritem = Components.classes["@mozilla.org/calendar/recurrence-date;1"]
                                  .createInstance(Components.interfaces.calIRecurrenceDate);
                break;
            case "RRULE":
            case "EXRULE":
                ritem = cal.createRecurrenceRule();
                break;
            default:
                throw "Unknown recurrence item: " + prop.propertyName;
                break;
        }

        ritem.icalProperty = prop;
        return ritem;
    },

    //
    // get item from db or from cache with given iid
    //
    getItemById: function cSC_getItemById(aID) {
        this.assureRecurringItemCaches();

        // cached?
        var item = this.mItemCache[aID];
        if (item) {
            return item;
        }

        // not cached; need to read from the db
        var flags = {};

        try {
            // try events first
            this.prepareStatement(this.mSelectEvent);
            this.mSelectEvent.params.id = aID;
            if (this.mSelectEvent.executeStep()) {
                item = this.getEventFromRow(this.mSelectEvent.row, flags);
            }
        } catch (e) {
            this.logError("Error selecting item by id " + aID + "!", e);
        } finally {
            this.mSelectEvent.reset();
        }

        // try todo if event fails
        if (!item) {
            try {
                this.prepareStatement(this.mSelectTodo);
                this.mSelectTodo.params.id = aID;
                if (this.mSelectTodo.executeStep()) {
                    item = this.getTodoFromRow(this.mSelectTodo.row, flags);
                }
            } catch (e) {
                this.logError("Error selecting item by id " + aID + "!", e);
            } finally {
                this.mSelectTodo.reset();
            }
        }

        return item;
    },

    //
    // database writing functions
    //

    setDateParamHelper: function cSC_setDateParamHelper(params, entryname, cdt) {
        if (cdt) {
            params[entryname] = cdt.nativeTime;
            var tz = cdt.timezone;
            var ownTz = cal.getTimezoneService().getTimezone(tz.tzid);
            if (ownTz) { // if we know that TZID, we use it
                params[entryname + "_tz"] = ownTz.tzid;
            } else if (!tz.icalComponent) { // timezone component missing
                params[entryname + "_tz"] = "floating";
            } else { // foreign one
                params[entryname + "_tz"] = tz.icalComponent.serializeToICS();
            }
        } else {
            params[entryname] = null;
            params[entryname + "_tz"] = null;
        }
    },

    flushItem: function cSC_flushItem(item, olditem) {
        ASSERT(!item.recurrenceId, "no parent item passed!", true);

        try {
            this.deleteItemById(olditem ? olditem.id : item.id, true);
            this.acquireTransaction();
            this.writeItem(item, olditem);
        } catch (e) {
            this.releaseTransaction(e);
            throw e;
        }
        this.releaseTransaction();

        this.cacheItem(item);
    },

    //
    // The write* functions execute the database bits
    // to write the given item type.  They're to return
    // any bits they want or'd into flags, which will be passed
    // to writeEvent/writeTodo to actually do the writing.
    //

    writeItem: function cSC_writeItem(item, olditem) {
        var flags = 0;

        flags |= this.writeAttendees(item, olditem);
        flags |= this.writeRecurrence(item, olditem);
        flags |= this.writeProperties(item, olditem);
        flags |= this.writeAttachments(item, olditem);
        flags |= this.writeRelations(item, olditem);
        flags |= this.writeAlarms(item, olditem);

        if (cal.isEvent(item)) {
            this.writeEvent(item, olditem, flags);
        } else if (cal.isToDo(item)) {
            this.writeTodo(item, olditem, flags);
        } else {
            throw Components.results.NS_ERROR_UNEXPECTED;
        }
    },

    writeEvent: function cSC_writeEvent(item, olditem, flags) {
        try {
            this.prepareStatement(this.mInsertEvent);
            let ip = this.mInsertEvent.params;
            this.setupItemBaseParams(item, olditem, ip);

            this.setDateParamHelper(ip, "event_start", item.startDate);
            this.setDateParamHelper(ip, "event_end", item.endDate);
            let dtstamp = item.stampTime;
            if (dtstamp) {
                ip.event_stamp = dtstamp.nativeTime;
            }

            if (item.startDate.isDate) {
                flags |= CAL_ITEM_FLAG.EVENT_ALLDAY;
            }

            ip.flags = flags;

            this.mInsertEvent.executeStep();
        } finally {
            this.mInsertEvent.reset();
        }
    },

    writeTodo: function cSC_writeTodo(item, olditem, flags) {
        try {
            this.prepareStatement(this.mInsertTodo);
            let ip = this.mInsertTodo.params;

            this.setupItemBaseParams(item, olditem, ip);

            this.setDateParamHelper(ip, "todo_entry", item.entryDate);
            this.setDateParamHelper(ip, "todo_due", item.dueDate);
            let dtstamp = item.stampTime;
            if (dtstamp) {
                ip.todo_stamp = dtstamp.nativeTime;
            }
            this.setDateParamHelper(ip, "todo_completed", item.getProperty("COMPLETED"));

            ip.todo_complete = item.getProperty("PERCENT-COMPLETED");

            let someDate = (item.entryDate || item.dueDate);
            if (someDate && someDate.isDate) {
                flags |= CAL_ITEM_FLAG.EVENT_ALLDAY;
            }

            ip.flags = flags;

            this.mInsertTodo.executeStep();
        } finally {
            this.mInsertTodo.reset();
        }
    },

    setupItemBaseParams: function cSC_setupItemBaseParams(item, olditem, ip) {
        ip.id = item.id;

        if (item.recurrenceId) {
            this.setDateParamHelper(ip, "recurrence_id", item.recurrenceId);
        }

        var tmp;

        if ((tmp = item.getProperty("CREATED")))
            ip.time_created = tmp.nativeTime;
        if ((tmp = item.getProperty("LAST-MODIFIED")))
            ip.last_modified = tmp.nativeTime;

        ip.title = item.getProperty("SUMMARY");
        ip.priority = item.getProperty("PRIORITY");
        ip.privacy = item.getProperty("CLASS");
        ip.ical_status = item.getProperty("STATUS");

        if (item.alarmLastAck) {
            ip.alarm_last_ack = item.alarmLastAck.nativeTime;
        }
    },

    writeAttendees: function cSC_writeAttendees(item, olditem) {
        var attendees = item.getAttendees({});
        if (item.organizer) {
            attendees = attendees.concat([]);
            attendees.push(item.organizer);
        }
        if (attendees.length > 0) {
            for each (var att in attendees) {
                var ap = this.mInsertAttendee.params;
                ap.item_id = item.id;
                try {
                    this.prepareStatement(this.mInsertAttendee);
                    this.setDateParamHelper(ap, "recurrence_id", item.recurrenceId);
                    ap.icalString = att.icalString;
                    this.mInsertAttendee.executeStep();
                } finally {
                    this.mInsertAttendee.reset();
                }
            }

            return CAL_ITEM_FLAG.HAS_ATTENDEES;
        }

        return 0;
    },

    writeProperty: function cSC_writeProperty(item, propName, propValue) {
        try {
            this.prepareStatement(this.mInsertProperty);
            var pp = this.mInsertProperty.params;
            pp.key = propName;
            let wPropValue = cal.wrapInstance(propValue, Components.interfaces.calIDateTime);
            if (wPropValue) {
                pp.value = wPropValue.nativeTime;
            } else {
                try {
                    pp.value = propValue;
                } catch (e) {
                    // The storage service throws an NS_ERROR_ILLEGAL_VALUE in
                    // case pval is something complex (i.e not a string or
                    // number). Swallow this error, leaving the value empty.
                    if (e.result != Components.results.NS_ERROR_ILLEGAL_VALUE) {
                        throw e;
                    }
                }
            }
            pp.item_id = item.id;
            this.setDateParamHelper(pp, "recurrence_id", item.recurrenceId);
            this.mInsertProperty.executeStep();
        } finally {
            this.mInsertProperty.reset();
        }
    },

    writeProperties: function cSC_writeProperties(item, olditem) {
        var ret = 0;
        var propEnumerator = item.propertyEnumerator;
        while (propEnumerator.hasMoreElements()) {
            ret = CAL_ITEM_FLAG.HAS_PROPERTIES;
            var prop = propEnumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
            if (item.isPropertyPromoted(prop.name))
                continue;
            this.writeProperty(item, prop.name, prop.value);
        }

        var cats = item.getCategories({});
        if (cats.length > 0) {
            ret = CAL_ITEM_FLAG.HAS_PROPERTIES;
            this.writeProperty(item, "CATEGORIES", categoriesArrayToString(cats));
        }

        return ret;
    },

    writeRecurrence: function cSC_writeRecurrence(item, olditem) {
        var flags = 0;

        var rec = item.recurrenceInfo;
        if (rec) {
            flags = CAL_ITEM_FLAG.HAS_RECURRENCE;
            let ritems = rec.getRecurrenceItems({});
            for each (let ritem in ritems) {
                let ap = this.mInsertRecurrence.params;
                try {
                    this.prepareStatement(this.mInsertRecurrence);
                    ap.item_id = item.id;
                    ap.icalString = ritem.icalString;
                    this.mInsertRecurrence.executeStep();
                } finally {
                    this.mInsertRecurrence.reset();
                }
            }

            var exceptions = rec.getExceptionIds ({});
            if (exceptions.length > 0) {
                flags |= CAL_ITEM_FLAG.HAS_EXCEPTIONS;

                // we need to serialize each exid as a separate
                // event/todo; setupItemBase will handle
                // writing the recurrenceId for us
                for each (let exid in exceptions) {
                    let ex = rec.getExceptionFor(exid);
                    if (!ex)
                        throw Components.results.NS_ERROR_UNEXPECTED;
                    this.writeItem(ex, null);
                }
            }
        } else  if (item.recurrenceId && item.recurrenceId.isDate) {
            flags |= CAL_ITEM_FLAG.RECURRENCE_ID_ALLDAY;
        }

        return flags;
    },

    writeAttachments: function cSC_writeAttachments(item, olditem) {
        let attachments = item.getAttachments({});
        if (attachments && attachments.length > 0) {
            for each (let att in attachments) {
                let ap = this.mInsertAttachment.params;
                try {
                    this.prepareStatement(this.mInsertAttachment);
                    this.setDateParamHelper(ap, "recurrence_id", item.recurrenceId);
                    ap.item_id = item.id;
                    ap.icalString = att.icalString;

                    this.mInsertAttachment.executeStep();
                } finally {
                    this.mInsertAttachment.reset();
                }
            }
            return CAL_ITEM_FLAG.HAS_ATTACHMENTS;
        }
        return 0;
    },

    writeRelations: function cSC_writeRelations(item, olditem) {
        let relations = item.getRelations({});
        if (relations && relations.length > 0) {
            for each (var rel in relations) {
                let rp = this.mInsertRelation.params;
                try {
                    this.prepareStatement(this.mInsertRelation);
                    this.setDateParamHelper(rp, "recurrence_id", item.recurrenceId);
                    rp.item_id = item.id;
                    rp.icalString = rel.icalString;

                    this.mInsertRelation.executeStep();
                } finally {
                    this.mInsertRelation.reset();
                }
            }
            return CAL_ITEM_FLAG.HAS_RELATIONS;
        }
        return 0;
    },

    writeAlarms: function cSC_writeAlarms(item, olditem) {
        let alarms = item.getAlarms({});
        if (alarms.length < 1) {
            return 0;
        }

        for each (let alarm in alarms) {
            let pp = this.mInsertAlarm.params;
            try {
                this.prepareStatement(this.mInsertAlarm);
                this.setDateParamHelper(pp, "recurrence_id", item.recurrenceId);
                pp.item_id = item.id;
                pp.icalString = alarm.icalString;
                this.mInsertAlarm.executeStep();
            } catch (e) {
                this.logError("Error writing alarm for item " + item.title + " (" + item.id + ")", e);
            } finally {
                this.mInsertAlarm.reset();
            }
        }

        return CAL_ITEM_FLAG.HAS_ALARMS;
    },

    /**
     * Deletes the item with the given item id.
     *
     * @param aID           The id of the item to delete.
     * @param aIsModify     If true, then leave in metadata for the item
     */
    deleteItemById: function cSC_deleteItemById(aID, aIsModify) {
        this.acquireTransaction();
        try {
            this.executeItemStatement(this.mDeleteAttendees, "item_id", aID);
            this.executeItemStatement(this.mDeleteProperties, "item_id", aID);
            this.executeItemStatement(this.mDeleteRecurrence, "item_id", aID);
            this.executeItemStatement(this.mDeleteEvent, "id", aID);
            this.executeItemStatement(this.mDeleteTodo, "id", aID);
            this.executeItemStatement(this.mDeleteAttachments, "item_id", aID);
            this.executeItemStatement(this.mDeleteRelations, "item_id", aID);
            if (!aIsModify) {
                this.executeItemStatement(this.mDeleteMetaData, "item_id", aID);
            }
            this.executeItemStatement(this.mDeleteAlarms, "item_id", aID);
        } catch (e) {
            this.releaseTransaction(e);
            throw e;
        }
        this.releaseTransaction();

        delete this.mItemCache[aID];
        delete this.mRecEventCache[aID];
        delete this.mRecTodoCache[aID];
    },

    /**
     * Acquire a transaction for this calendar.
     */
    acquireTransaction: function cSC_acquireTransaction() {
        this.mDB.beginTransaction();
    },

    /**
     * Releases one level of transactions for this calendar.
     *
     * @param err       (optional) If set, the transaction is set to fail when
     *                    the count reaches zero.
     */
    releaseTransaction: function cSC_releaseTransaction(err) {
        if (err) {
            cal.ERROR("[calStorageCalendar] DB error: " + this.mDB.lastErrorString + "\nexc: " + err);
            this.mDB.rollbackTransaction();
        } else {
            this.mDB.commitTransaction();
        }
    },

    //
    // calISyncWriteCalendar interface
    //

    setMetaData: function cSC_setMetaData(id, value) {
        this.executeItemStatement(this.mDeleteMetaData, "item_id", id);
        try {
            this.prepareStatement(this.mInsertMetaData);
            let sp = this.mInsertMetaData.params;
            sp.item_id = id;
            sp.value = value;
            this.mInsertMetaData.executeStep();
        } catch (e if e.result != Components.results.NS_ERROR_ILLEGAL_VALUE) {
            // The storage service throws an NS_ERROR_ILLEGAL_VALUE in
            // case pval is something complex (i.e not a string or
            // number). Swallow this error, leaving the value empty.
            this.logError("Error setting metadata for id " + id + "!", e);
        } finally {
            this.mInsertMetaData.reset();
        }
    },

    deleteMetaData: function cSC_deleteMetaData(id) {
        this.executeItemStatement(this.mDeleteMetaData, "item_id", id);
    },

    getMetaData: function cSC_getMetaData(id) {
        let query = this.mSelectMetaData;
        let value = null;
        try {
            this.prepareStatement(query);
            query.params.item_id = id;

            if (query.executeStep()) {
                value = query.row.value;
            }
        } catch (e) {
            this.logError("Error getting metadata for id " + id + "!", e);
        } finally {
            query.reset();
        }

        return value;
    },

    getAllMetaData: function cSC_getAllMetaData(out_count,
                                                 out_ids,
                                                 out_values) {
        let query = this.mSelectAllMetaData;
        try {
            this.prepareStatement(query);
            let ids = [];
            let values = [];
            while (query.executeStep()) {
                ids.push(query.row.item_id);
                values.push(query.row.value);
            }
            out_count.value = ids.length;
            out_ids.value = ids;
            out_values.value = values;
        } catch (e) {
            this.logError("Error getting all metadata!", e);
        } finally {
            query.reset();
        }
    },
    /**
     * Internal logging function that should be called on any database error,
     * it will log as much info as possible about the database context and
     * last statement so the problem can be investigated more easilly.
     *
     * @param message           Error message to log.
     * @param exception         Exception that caused the error.
     */
    logError: function cSC_logError(message,exception) {
        let logMessage = "Message: " + message;
        if (this.mDB) {
            if (this.mDB.connectionReady) {
              logMessage += "\nConnection Ready: " + this.mDB.connectionReady;
            }
            if (this.mDB.lastError) {
              logMessage += "\nLast DB Error Number: " + this.mDB.lastError;
            }
            if (this.mDB.lastErrorString) {
              logMessage += "\nLast DB Error Message: " + this.mDB.lastErrorString;
            }
            if (this.mDB.databaseFile) {
              logMessage += "\nDatabase File: " + this.mDB.databaseFile.path;
            }
            if (this.mDB.lastInsertRowId) {
              logMessage += "\nLast Insert Row Id: " + this.mDB.lastInsertRowId;
            }
            if (this.mDB.transactionInProgress) {
              logMessage += "\nTransaction In Progress: " + this.mDB.transactionInProgress;
            }
        }

        if (this.mLastStatement) {
            logMessage += "\nLast DB Statement: " + this.mLastStatement;
            if (this.mLastStatement.params) {
                for (let param in this.mLastStatement.params) {
                    logMessage += "\nLast Statement param [" + param + "]: " + this.mLastStatement.params[param];
                }
            }
        }

        if (exception) {
            logMessage += "\nException: " + exception;
        }
        cal.ERROR("[calStorageCalendar] " + logMessage + "\n" + cal.STACK(10));
    },
    /**
     * propagate the given sequence in exceptions. It may be needed by some calendar implementations
     */
    _propagateSequence: function cSC__propagateSequence(aItem, newSequence) {
        if (newSequence) {
            aItem.setProperty("SEQUENCE", newSequence);
        } else {
            aItem.deleteProperty("SEQUENCE");
        }
        var rec = aItem.recurrenceInfo;
        if (rec) {
            var exceptions = rec.getExceptionIds ({});
            if (exceptions.length > 0) {
                for each (exid in exceptions) {
                    let ex = rec.getExceptionFor(exid);
                    if (newSequence) {
                        ex.setProperty("SEQUENCE", newSequence);
                    } else {
                        ex.deleteProperty("SEQUENCE");
                    }
                }
            }
        }
    }
};

/** Module Registration */
const scriptLoadOrder = [
    "calUtils.js",
];

var NSGetFactory = cal.loadingNSGetFactory(scriptLoadOrder, [calStorageCalendar], this);
