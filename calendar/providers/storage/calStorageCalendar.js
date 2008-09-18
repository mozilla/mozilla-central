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
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005, 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Joey Minta <jminta@gmail.com>
 *   Dan Mosedale <dan.mosedale@oracle.com>
 *   Thomas Benisch <thomas.benisch@sun.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Sebastian Schwieger <sebo.moz@googlemail.com>
 *   Fred Jendrzejewski <fred.jen@web.de>
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

const kStorageServiceContractID = "@mozilla.org/storage/service;1";
const kStorageServiceIID = Components.interfaces.mozIStorageService;

const kCalICalendar = Components.interfaces.calICalendar;

const kCalAttendeeContractID = "@mozilla.org/calendar/attendee;1";
const kCalIAttendee = Components.interfaces.calIAttendee;
var CalAttendee;

const kCalRecurrenceInfoContractID = "@mozilla.org/calendar/recurrence-info;1";
const kCalIRecurrenceInfo = Components.interfaces.calIRecurrenceInfo;
var CalRecurrenceInfo;

const kCalRecurrenceRuleContractID = "@mozilla.org/calendar/recurrence-rule;1";
const kCalIRecurrenceRule = Components.interfaces.calIRecurrenceRule;
var CalRecurrenceRule;

const kCalRecurrenceDateSetContractID = "@mozilla.org/calendar/recurrence-date-set;1";
const kCalIRecurrenceDateSet = Components.interfaces.calIRecurrenceDateSet;
var CalRecurrenceDateSet;

const kCalRecurrenceDateContractID = "@mozilla.org/calendar/recurrence-date;1";
const kCalIRecurrenceDate = Components.interfaces.calIRecurrenceDate;
var CalRecurrenceDate;

const kMozStorageStatementWrapperContractID = "@mozilla.org/storage/statement-wrapper;1";
const kMozStorageStatementWrapperIID = Components.interfaces.mozIStorageStatementWrapper;
var MozStorageStatementWrapper;

if (!kMozStorageStatementWrapperIID) {
    dump("*** mozStorage not available, calendar/storage provider will not function\n");
}

function initCalStorageCalendarComponent() {
    CalAttendee = new Components.Constructor(kCalAttendeeContractID, kCalIAttendee);
    CalRecurrenceInfo = new Components.Constructor(kCalRecurrenceInfoContractID, kCalIRecurrenceInfo);
    CalRecurrenceRule = new Components.Constructor(kCalRecurrenceRuleContractID, kCalIRecurrenceRule);
    CalRecurrenceDateSet = new Components.Constructor(kCalRecurrenceDateSetContractID, kCalIRecurrenceDateSet);
    CalRecurrenceDate = new Components.Constructor(kCalRecurrenceDateContractID, kCalIRecurrenceDate);
    MozStorageStatementWrapper = new Components.Constructor(kMozStorageStatementWrapperContractID, kMozStorageStatementWrapperIID);
}

//
// calStorageCalendar.js
//

const CAL_ITEM_TYPE_EVENT = 0;
const CAL_ITEM_TYPE_TODO = 1;

// bitmasks
const CAL_ITEM_FLAG_PRIVATE = 1;
const CAL_ITEM_FLAG_HAS_ATTENDEES = 2;
const CAL_ITEM_FLAG_HAS_PROPERTIES = 4;
const CAL_ITEM_FLAG_EVENT_ALLDAY = 8;
const CAL_ITEM_FLAG_HAS_RECURRENCE = 16;
const CAL_ITEM_FLAG_HAS_EXCEPTIONS = 32;
const CAL_ITEM_FLAG_HAS_ATTACHMENTS = 64;
const CAL_ITEM_FLAG_HAS_RELATIONS = 128;

const USECS_PER_SECOND = 1000000;

var gTransCount = {};
var gTransErr = {};

//
// Storage helpers
//

function createStatement (dbconn, sql) {
    try {
        var stmt = dbconn.createStatement(sql);
        var wrapper = MozStorageStatementWrapper();
        wrapper.initialize(stmt);
        return wrapper;
    } catch (e) {
        Components.utils.reportError(
            "mozStorage exception: createStatement failed, statement: '" + 
            sql + "', error: '" + dbconn.lastErrorString + "' - " + e);
    }

    return null;
}

function getInUtcOrKeepFloating(dt) {
    var tz = dt.timezone;
    if (tz.isFloating || tz.isUTC) {
        return dt;
    } else {
        return dt.getInTimezone(UTC());
    }
}

function textToDate(d) {
    var dval;
    var tz = "UTC";

    if (d[0] == 'Z') {
        var strs = d.substr(2).split(":");
        dval = parseInt(strs[0]);
        tz = strs[1].replace(/%:/g, ":").replace(/%%/g, "%");
    } else {
        dval = parseInt(d.substr(2));
    }

    var date;
    if (d[0] == 'U' || d[0] == 'Z') {
        date = newDateTime(dval, tz);
    } else if (d[0] == 'L') {
        // is local time
        date = newDateTime(dval, "floating");
    }

    if (d[1] == 'D')
        date.isDate = true;
    return date;
}

function dateToText(d) {
    var datestr;
    var tz = null;
    if (!d.timezone.isFloating) {
        if (d.timezone.isUTC) {
            datestr = "U";
        } else {
            datestr = "Z";
            tz = d.timezone.tzid;
        }
    } else {
        datestr = "L";
    }

    if (d.isDate) {
        datestr += "D";
    } else {
        datestr += "T";
    }

    datestr += d.nativeTime;

    if (tz) {
        // replace '%' with '%%', then replace ':' with '%:'
        tz = tz.replace(/%/g, "%%");
        tz = tz.replace(/:/g, "%:");
        datestr += ":" + tz;
    }
    return datestr;
}

// 
// other helpers
//

function calStorageTimezone(comp) {
    this.wrappedJSObject = this;
    this.provider = null;
    this.icalComponent = comp;
    this.tzid = comp.getFirstProperty("TZID").value;
    this.displayName = null;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = null;
    this.longitude = null;
}
calStorageTimezone.prototype = {
    toString: function() {
        return this.icalComponent.toString();
    }
};
var gForeignTimezonesCache = {};

function getTimezone(aTimezone) {
    if (aTimezone.indexOf("BEGIN:VTIMEZONE") == 0) {
        tz = gForeignTimezonesCache[aTimezone]; // using full definition as key
        if (!tz) {
            try {
                // cannot cope without parent VCALENDAR:
                var comp = getIcsService().parseICS("BEGIN:VCALENDAR\n" + aTimezone + "\nEND:VCALENDAR", null);
                tz = new calStorageTimezone(comp.getFirstSubcomponent("VTIMEZONE"));
                gForeignTimezonesCache[aTimezone] = tz;
            } catch (exc) {
                ASSERT(false, exc);
            }
        }
    } else {
        tz = getTimezoneService().getTimezone(aTimezone);
    }
    return tz;
}

function newDateTime(aNativeTime, aTimezone) {
    var t = createDateTime();
    t.nativeTime = aNativeTime;
    if (aTimezone) {
        var tz = getTimezone(aTimezone);
        if (tz) {
            t = t.getInTimezone(tz);
        } else {
            ASSERT(false, "timezone not available: " + aTimezone);
        }
    } else {
        t.timezone = floating();
    }
    return t;
}

//
// calStorageCalendar
//

function calStorageCalendar() {
    this.initProviderBase();
    this.mItemCache = {};
    this.mRecEventCache = {};
    this.mRecTodoCache = {};
}

calStorageCalendar.prototype = {
    __proto__: calProviderBase.prototype,
    //
    // private members
    //
    mDB: null,
    mCalId: 0,
    mItemCache: null,
    mRecItemCacheInited: false,
    mRecEventCache: null,
    mRecTodoCache: null,

    //
    // nsISupports interface
    // 
    QueryInterface: function (aIID) {
        return doQueryInterface(this, calStorageCalendar.prototype, aIID,
                                [Components.interfaces.calICalendarProvider,
                                 Components.interfaces.calISyncCalendar]);
    },

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay() {
        return null;
    },

    get displayName() {
        return calGetString("calendar", "storageName");
    },

    createCalendar: function stor_createCal() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function stor_deleteCal(cal, listener) {
        cal = cal.wrappedJSObject;

        for (var i in this.mDeleteEventExtras) {
            this.mDeleteEventExtras[i].execute();
            this.mDeleteEventExtras[i].reset();
        }

        for (var i in this.mDeleteTodoExtras) {
            this.mDeleteTodoExtras[i].execute();
            this.mDeleteTodoExtras[i].reset();
        }

        this.mDeleteAllEvents.execute();
        this.mDeleteAllEvents.reset();

        this.mDeleteAllTodos.execute();
        this.mDeleteAllTodos.reset();

        this.mDeleteAllMetaData();

        try {
            listener.onDeleteCalendar(cal, Components.results.NS_OK, null);
        } catch (ex) {
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

    getProperty: function stor_getProperty(aName) {
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

    // attribute nsIURI uri;
    get uri() {
        return this.mUri;
    },
    set uri(aUri) {
        // we can only load once
        if (this.mUri) {
            throw Components.results.NS_ERROR_FAILURE;
        }

        var id = 0;

        // check if there's a ?id=
        var path = aUri.path;
        var pos = path.indexOf("?id=");

        if (pos != -1) {
            id = parseInt(path.substr(pos+4));
            path = path.substr(0, pos);
        }

        var dbService;
        if (aUri.scheme == "file") {
            var fileURL = aUri.QueryInterface(Components.interfaces.nsIFileURL);
            if (!fileURL)
                throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

            // open the database
            dbService = Components.classes[kStorageServiceContractID].getService(kStorageServiceIID);
            this.mDB = dbService.openDatabase(fileURL.file);
        } else if (aUri.scheme == "moz-profile-calendar") {
            dbService = Components.classes[kStorageServiceContractID].getService(kStorageServiceIID);
            this.mDB = dbService.openSpecialDatabase("profile");
        }

        this.mCalId = id;
        this.mUri = aUri;

        this.initDB();
    },

    refresh: function() {
        // no-op
    },

    // void addItem( in calIItemBase aItem, in calIOperationListener aListener );
    addItem: function (aItem, aListener) {
        var newItem = aItem.clone();
        return this.adoptItem(newItem, aListener);
    },

    // void adoptItem( in calIItemBase aItem, in calIOperationListener aListener );
    adoptItem: function (aItem, aListener) {
        if (this.readOnly) {
            this.notifyOperationComplete(aListener,
                                         Components.interfaces.calIErrors.CAL_IS_READONLY,
                                         Components.interfaces.calIOperationListener.ADD,
                                         null,
                                         "Calendar is readonly");
            return;
        }
        // Ensure that we're looking at the base item
        // if we were given an occurrence.  Later we can
        // optimize this.
        if (aItem.parentItem != aItem) {
            aItem.parentItem.recurrenceInfo.modifyException(aItem, false);
        }
        aItem = aItem.parentItem;

        if (aItem.id == null) {
            // is this an error?  Or should we generate an IID?
            aItem.id = getUUID();
        } else {
            var olditem = this.getItemById(aItem.id);
            if (olditem) {
                if (this.relaxedMode) {
                    // we possibly want to interact with the user before deleting
                    this.deleteItemById(aItem.id);
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

        aItem.calendar = this.superCalendar;
        aItem.makeImmutable();

        this.flushItem (aItem, null);

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
    modifyItem: function (aNewItem, aOldItem, aListener) {
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

        var this_ = this;
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

        // Ensure that we're looking at the base item if we were given an
        // occurrence.  Later we can optimize this.
        var modifiedItem = aNewItem.parentItem.clone();
        if (aNewItem.parentItem != aNewItem) {
            modifiedItem.recurrenceInfo.modifyException(aNewItem, false);
        }

        if (this.relaxedMode) {
            if (!aOldItem) {
                aOldItem = this.getItemById(aNewItem.id) || aNewItem;
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

            if (aOldItem.generation == modifiedItem.generation) { // has been cloned and modified
                // Only take care of incrementing the generation if relaxed mode is
                // off. Users of relaxed mode need to take care of this themselves.
                modifiedItem.generation += 1;
            }
        }

        modifiedItem.makeImmutable();
        this.flushItem (modifiedItem, aOldItem);

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
    deleteItem: function (aItem, aListener) {
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
    getItem: function (aId, aListener) {
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
        if (isEvent(item))
            item_iid = Components.interfaces.calIEvent;
        else if (isToDo(item))
            item_iid = Components.interfaces.calITodo;
        else {
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
    getItems: function (aItemFilter, aCount,
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
        if (!wantEvents && !wantTodos) {
            // nothing to do
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_OK,
                                         Components.interfaces.calIOperationListener.GET,
                                         null,
                                         null);
            return;
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
            sp = this.mSelectNonRecurringEventsByRange.params;
            sp.range_start = startTime;
            sp.range_end = endTime;
            sp.start_offset = aRangeStart ? aRangeStart.timezoneOffset * USECS_PER_SECOND : 0;
            sp.end_offset = aRangeEnd ? aRangeEnd.timezoneOffset * USECS_PER_SECOND : 0;

            while (this.mSelectNonRecurringEventsByRange.step()) {
                var row = this.mSelectNonRecurringEventsByRange.row;
                var item = this.getEventFromRow(row, {});
                resultItems.push(item);
            }
            this.mSelectNonRecurringEventsByRange.reset();

            // process the non-recurring events:
            for each (var evitem in resultItems) {
                count += handleResultItem(evitem, Components.interfaces.calIEvent);
                if (checkCount()) {
                    return;
                }
            }

            // process the recurring events from the cache
            for each (var evitem in this.mRecEventCache) {
                count += handleResultItem(evitem, Components.interfaces.calIEvent);
                if (checkCount()) {
                    return;
                }
            }
        }

        // if todos are wanted, do them next
        if (wantTodos) {
            var sp;             // stmt params
            var resultItems = [];

            // first get non-recurring todos that happen to fall within the range
            sp = this.mSelectNonRecurringTodosByRange.params;
            sp.range_start = startTime;
            sp.range_end = endTime;
            sp.start_offset = aRangeStart ? aRangeStart.timezoneOffset * USECS_PER_SECOND : 0;
            sp.end_offset = aRangeEnd ? aRangeEnd.timezoneOffset * USECS_PER_SECOND : 0;

            while (this.mSelectNonRecurringTodosByRange.step()) {
                var row = this.mSelectNonRecurringTodosByRange.row;
                resultItems.push(this.getTodoFromRow(row, {}));
            }
            this.mSelectNonRecurringTodosByRange.reset();

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
            for each (var todoitem in this.mRecTodoCache) {
                count += handleResultItem(todoitem, Components.interfaces.calITodo, checkCompleted);
                if (checkCount()) {
                    return;
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

    //
    // Helper functions
    //

    //
    // database handling
    //

    // initialize the database schema.
    // needs to do some version checking
    initDBSchema: function () {
        for (table in sqlTables) {
            try {
                this.mDB.executeSimpleSQL("DROP TABLE " + table);
            } catch (e) { }
            this.mDB.createTable(table, sqlTables[table]);
        }

        // Add a version stamp to the schema
        this.mDB.executeSimpleSQL("INSERT INTO cal_calendar_schema_version VALUES(" + this.DB_SCHEMA_VERSION + ")");
    },

    DB_SCHEMA_VERSION: 14,

    /** 
     * @return      db schema version
     * @exception   various, depending on error
     */
    getVersion: function calStorageGetVersion() {
        var selectSchemaVersion;
        var version = null;

        try {
            selectSchemaVersion = createStatement(this.mDB, 
                                  "SELECT version FROM " +
                                  "cal_calendar_schema_version LIMIT 1");
            if (selectSchemaVersion.step()) {
                version = selectSchemaVersion.row.version;
            }
            selectSchemaVersion.reset();

            if (version !== null) {
                // This is the only place to leave this function gracefully.
                return version;
            }
        } catch (e) {
            if (selectSchemaVersion) {
                selectSchemaVersion.reset();
            }
            dump ("++++++++++++ calStorageGetVersion() error: " +
                  this.mDB.lastErrorString + "\n");
            Components.utils.reportError("Error getting storage calendar " +
                                         "schema version! DB Error: " + 
                                         this.mDB.lastErrorString);
            throw e;
        }

        throw "cal_calendar_schema_version SELECT returned no results";
    },

    upgradeDB: function (oldVersion) {
        // some common helpers
        function addColumn(db, tableName, colName, colType) {
            db.executeSimpleSQL("ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colType);
        }

        if (oldVersion == 2) {
            dump ("**** Upgrading schema from 2 -> 3\n");

            this.mDB.beginTransaction();
            try {
                // the change between 2 and 3 includes the splitting of cal_items into
                // cal_events and cal_todos, and the addition of columns for
                // event_start_tz, event_end_tz, todo_entry_tz, todo_due_tz.
                // These need to default to "UTC" if their corresponding time is
                // given, since that's what the default was for v2 calendars

                // create the two new tables
                try { this.mDB.executeSimpleSQL("DROP TABLE cal_events; DROP TABLE cal_todos;"); } catch (e) { }
                this.mDB.createTable("cal_events", sqlTables["cal_events"]);
                this.mDB.createTable("cal_todos", sqlTables["cal_todos"]);

                // copy stuff over
                var eventCols = ["cal_id", "id", "time_created", "last_modified", "title",
                                 "priority", "privacy", "ical_status", "flags",
                                 "event_start", "event_end", "event_stamp"];
                var todoCols = ["cal_id", "id", "time_created", "last_modified", "title",
                                "priority", "privacy", "ical_status", "flags",
                                "todo_entry", "todo_due", "todo_completed", "todo_complete"];

                this.mDB.executeSimpleSQL("INSERT INTO cal_events(" + eventCols.join(",") + ") " +
                                          "     SELECT " + eventCols.join(",") +
                                          "       FROM cal_items WHERE item_type = 0");
                this.mDB.executeSimpleSQL("INSERT INTO cal_todos(" + todoCols.join(",") + ") " +
                                          "     SELECT " + todoCols.join(",") +
                                          "       FROM cal_items WHERE item_type = 1");

                // now fix up the new _tz columns
                this.mDB.executeSimpleSQL("UPDATE cal_events SET event_start_tz = 'UTC' WHERE event_start IS NOT NULL");
                this.mDB.executeSimpleSQL("UPDATE cal_events SET event_end_tz = 'UTC' WHERE event_end IS NOT NULL");
                this.mDB.executeSimpleSQL("UPDATE cal_todos SET todo_entry_tz = 'UTC' WHERE todo_entry IS NOT NULL");
                this.mDB.executeSimpleSQL("UPDATE cal_todos SET todo_due_tz = 'UTC' WHERE todo_due IS NOT NULL");
                this.mDB.executeSimpleSQL("UPDATE cal_todos SET todo_completed_tz = 'UTC' WHERE todo_completed IS NOT NULL");

                // finally update the version
                this.mDB.executeSimpleSQL("DELETE FROM cal_calendar_schema_version; INSERT INTO cal_calendar_schema_version VALUES (3);");

                this.mDB.commitTransaction();

                oldVersion = 3;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion == 3) {
            dump ("**** Upgrading schema from 3 -> 4\n");

            this.mDB.beginTransaction();
            try {
                // the change between 3 and 4 is the addition of
                // recurrence_id and recurrence_id_tz columns to
                // cal_events, cal_todos, cal_attendees, and cal_properties
                addColumn(this.mDB, "cal_events", "recurrence_id", "INTEGER");
                addColumn(this.mDB, "cal_events", "recurrence_id_tz", "VARCHAR");

                addColumn(this.mDB, "cal_todos", "recurrence_id", "INTEGER");
                addColumn(this.mDB, "cal_todos", "recurrence_id_tz", "VARCHAR");

                addColumn(this.mDB, "cal_attendees", "recurrence_id", "INTEGER");
                addColumn(this.mDB, "cal_attendees", "recurrence_id_tz", "VARCHAR");

                addColumn(this.mDB, "cal_properties", "recurrence_id", "INTEGER");
                addColumn(this.mDB, "cal_properties", "recurrence_id_tz", "VARCHAR");

                this.mDB.executeSimpleSQL("DELETE FROM cal_calendar_schema_version; INSERT INTO cal_calendar_schema_version VALUES (4);");
                this.mDB.commitTransaction();

                oldVersion = 4;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion == 4) {
            dump ("**** Upgrading schema from 4 -> 5\n");

            this.mDB.beginTransaction();
            try {
                // the change between 4 and 5 is the addition of alarm_offset
                // and alarm_last_ack columns.  The alarm_time column is not
                // used in this version, but will likely return in future versions
                // so it is not being removed
                addColumn(this.mDB, "cal_events", "alarm_offset", "INTEGER");
                addColumn(this.mDB, "cal_events", "alarm_related", "INTEGER");
                addColumn(this.mDB, "cal_events", "alarm_last_ack", "INTEGER");

                addColumn(this.mDB, "cal_todos", "alarm_offset", "INTEGER");
                addColumn(this.mDB, "cal_todos", "alarm_related", "INTEGER");
                addColumn(this.mDB, "cal_todos", "alarm_last_ack", "INTEGER");

                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 5;");
                this.mDB.commitTransaction();
                oldVersion = 5;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion == 5) {
            dump ("**** Upgrading schema from 5 -> 6\n");

            this.mDB.beginTransaction();
            try {
                // Schema changes between v5 and v6:
                //
                // - Change all STRING columns to TEXT to avoid SQLite's
                //   "feature" where it will automatically convert strings to
                //   numbers (ex: 10e4 -> 10000). See bug 333688.


                // Create the new tables.
                var tableNames = ["cal_events", "cal_todos", "cal_attendees",
                                  "cal_recurrence", "cal_properties"];

                var query = "";
                try { 
                    for (var i in tableNames) {
                        query += "DROP TABLE " + tableNames[i] + "_v6;"
                    }
                    this.mDB.executeSimpleSQL(query);
                } catch (e) {
                    // We should get exceptions for trying to drop tables
                    // that don't (shouldn't) exist.
                }

                this.mDB.createTable("cal_events_v6", sqlTables["cal_events"]);
                this.mDB.createTable("cal_todos_v6", sqlTables["cal_todos"]);
                this.mDB.createTable("cal_attendees_v6", sqlTables["cal_attendees"]);
                this.mDB.createTable("cal_recurrence_v6", sqlTables["cal_recurrence"]);
                this.mDB.createTable("cal_properties_v6", sqlTables["cal_properties"]);


                // Copy in the data.
                var cal_events_cols = ["cal_id", "id", "time_created",
                                       "last_modified", "title", "priority",
                                       "privacy", "ical_status",
                                       "recurrence_id", "recurrence_id_tz",
                                       "flags", "event_start",
                                       "event_start_tz", "event_end",
                                       "event_end_tz", "event_stamp",
                                       "alarm_time", "alarm_time_tz",
                                       "alarm_offset", "alarm_related",
                                       "alarm_last_ack"];

                var cal_todos_cols = ["cal_id", "id", "time_created",
                                      "last_modified", "title", "priority",
                                      "privacy", "ical_status",
                                      "recurrence_id", "recurrence_id_tz",
                                      "flags", "todo_entry", "todo_entry_tz",
                                      "todo_due", "todo_due_tz",
                                      "todo_completed", "todo_completed_tz",
                                      "todo_complete", "alarm_time",
                                      "alarm_time_tz", "alarm_offset",
                                      "alarm_related", "alarm_last_ack"];

                var cal_attendees_cols = ["item_id", "recurrence_id",
                                          "recurrence_id_tz", "attendee_id",
                                          "common_name", "rsvp", "role",
                                          "status", "type"];

                var cal_recurrence_cols = ["item_id", "recur_index",
                                           "recur_type", "is_negative",
                                           "dates", "count", "end_date",
                                           "interval", "second", "minute",
                                           "hour", "day", "monthday",
                                           "yearday", "weekno", "month",
                                           "setpos"];

                var cal_properties_cols = ["item_id", "recurrence_id",
                                           "recurrence_id_tz", "key",
                                           "value"];

                var theDB = this.mDB;
                function copyDataOver(aTableName, aColumnNames) {
                    theDB.executeSimpleSQL("INSERT INTO " + aTableName + "_v6(" + aColumnNames.join(",") + ") " + 
                                           "     SELECT " + aColumnNames.join(",") + 
                                           "       FROM " + aTableName + ";");
                }

                copyDataOver("cal_events", cal_events_cols);
                copyDataOver("cal_todos", cal_todos_cols);
                copyDataOver("cal_attendees", cal_attendees_cols);
                copyDataOver("cal_recurrence", cal_recurrence_cols);
                copyDataOver("cal_properties", cal_properties_cols);


                // Delete each old table and rename the new ones to use the
                // old tables' names.
                for (var i in tableNames) {
                    this.mDB.executeSimpleSQL("DROP TABLE  " + tableNames[i] + ";" +
                                              "ALTER TABLE " + tableNames[i] + "_v6" + 
                                              "  RENAME TO " + tableNames[i] + ";");
                }


                // Update the version stamp, and commit.
                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 6;");
                this.mDB.commitTransaction();
                oldVersion = 6;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        // add cal_tz_version for all versions 6, 7, 8, 9:
        if (oldVersion >= 6 && oldVersion <= 9) {
            dump ("**** Upgrading schema from 6/7/8/9 -> 10\n");
            this.mDB.beginTransaction();
            try {
                this.mDB.createTable("cal_tz_version", sqlTables.cal_tz_version);
                // Update the version stamp, and commit.
                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 10;");
                this.mDB.commitTransaction();
                oldVersion = 10;
            } catch (e) {
                dump ("+++++++++++++++++ DB Error: " + this.mDB.lastErrorString + "\n");
                Components.utils.reportError("Upgrade failed! DB Error: " +
                                             this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion < 11) {
            this.mDB.beginTransaction();
            try {
                this.mDB.createTable("cal_attachments", sqlTables.cal_attachments);

                // update schema
                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 11;");
                this.mDB.commitTransaction();
                oldVersion = 11;
            } catch (e) {
                ERROR("Upgrade failed! DB Error: " + this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion < 12) {
            this.mDB.beginTransaction();
            try {
                this.mDB.createTable("cal_metadata", sqlTables.cal_metadata);
                addColumn(this.mDB, "cal_attendees", "is_organizer", "BOOLEAN");
                addColumn(this.mDB, "cal_attendees", "properties", "BLOB");

                // update schema
                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 12;");
                this.mDB.commitTransaction();
                oldVersion = 12;
            } catch (e) {
                ERROR("Upgrade failed! DB Error: " + this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion < 13) {
            this.mDB.beginTransaction();
            try {
                // reset cal_metadata's item_id to longer be UNIQUE:
                this.mDB.executeSimpleSQL("DROP TABLE IF EXISTS old_cal_metadata");
                this.mDB.executeSimpleSQL("ALTER TABLE cal_metadata RENAME TO old_cal_metadata");
                this.mDB.createTable("cal_metadata", sqlTables["cal_metadata"]);
                this.mDB.executeSimpleSQL("INSERT INTO cal_metadata"
                                          + " (cal_id, item_id, value) "
                                          + " SELECT cal_id, item_id, value"
                                          + " FROM old_cal_metadata");
                this.mDB.executeSimpleSQL("DROP TABLE old_cal_metadata");

                // match item ids to cal_id:
                var calIds = {};
                for each (var itemTable in ["events", "todos"]) {
                    var stmt = createStatement(this.mDB,
                                               "SELECT id, cal_id FROM cal_" + itemTable);
                    while (stmt.step()) {
                        calIds[stmt.row.id] = stmt.row.cal_id;
                    }
                    stmt.reset();
                }

                for each (var updTable in ["cal_attendees", "cal_recurrence",
                                           "cal_properties", "cal_attachments"]) {
                    try { // some tables might have been created with the
                          // required columns already, see previous upgrade pathes
                        addColumn(this.mDB, updTable, "cal_id", "INTEGER");
                    } catch (ace) {}

                    for (var itemId in calIds) {
                        this.mDB.executeSimpleSQL("UPDATE " + updTable +
                                                  " SET cal_id = " + calIds[itemId] +
                                                  " WHERE item_id = '" + itemId + "'");
                     }
                }

                this.mDB.executeSimpleSQL("DROP INDEX IF EXISTS" +
                                          " idx_cal_properies_item_id");
                this.mDB.executeSimpleSQL("CREATE INDEX IF NOT EXISTS" + 
                                          " idx_cal_properies_item_id" +
                                          " ON cal_properties(cal_id, item_id);");

                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 13;");
                this.mDB.commitTransaction();
                oldVersion = 13;
            } catch (e) {
                ERROR("Upgrade failed! DB Error: " + this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion < 14) {
            this.mDB.beginTransaction();
            try {
                this.mDB.createTable("cal_relations", sqlTables.cal_relations);
                // update schema
                this.mDB.executeSimpleSQL("UPDATE cal_calendar_schema_version SET version = 14;");
                this.mDB.commitTransaction();
                oldVersion = 14;
            } catch (e) {
                ERROR("Upgrade failed! DB Error: " + this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw e;
            }
        }

        if (oldVersion != this.DB_SCHEMA_VERSION) {
            dump ("#######!!!!! calStorageCalendar Schema Update failed -- db version: " + oldVersion + " this version: " + this.DB_SCHEMA_VERSION + "\n");
            throw Components.results.NS_ERROR_FAILURE;
        }
    },

    ensureUpdatedTimezones: function stor_ensureUpdatedTimezones() {
        // check if timezone version has changed:
        var selectTzVersion = createStatement(this.mDB, "SELECT version FROM cal_tz_version LIMIT 1");
        var version;
        try {
            version = (selectTzVersion.step() ? selectTzVersion.row.version : null);
        } finally {
            selectTzVersion.reset();
        }

        var versionComp = 1;
        if (version) {
            versionComp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                    .getService(Components.interfaces.nsIVersionComparator)
                                    .compare(getTimezoneService().version, version);
        }

        if (versionComp < 0) {
            // A timezones downgrade has happened!
            throw Components.interfaces.calIErrors.STORAGE_UNKNOWN_TIMEZONES_ERROR;
        } else if (versionComp > 0) {
            LOG("timezones have been updated, updating calendar data.");

            var zonesToUpdate = [];
            var getZones = createStatement(
                this.mDB,
                "SELECT DISTINCT(zone) FROM ("+
                "SELECT recurrence_id_tz AS zone FROM cal_attendees  WHERE recurrence_id_tz IS NOT NULL UNION " +
                "SELECT recurrence_id_tz AS zone FROM cal_events     WHERE recurrence_id_tz IS NOT NULL UNION " +
                "SELECT event_start_tz   AS zone FROM cal_events     WHERE event_start_tz   IS NOT NULL UNION " +
                "SELECT event_end_tz     AS zone FROM cal_events     WHERE event_end_tz     IS NOT NULL UNION " +
                "SELECT alarm_time_tz    AS zone FROM cal_events     WHERE alarm_time_tz    IS NOT NULL UNION " +
                "SELECT recurrence_id_tz AS zone FROM cal_properties WHERE recurrence_id_tz IS NOT NULL UNION " +
                "SELECT recurrence_id_tz AS zone FROM cal_todos      WHERE recurrence_id_tz IS NOT NULL UNION " +
                "SELECT todo_entry_tz    AS zone FROM cal_todos      WHERE todo_entry_tz    IS NOT NULL UNION " +
                "SELECT todo_due_tz      AS zone FROM cal_todos      WHERE todo_due_tz      IS NOT NULL UNION " +
                "SELECT alarm_time_tz    AS zone FROM cal_todos      WHERE alarm_time_tz    IS NOT NULL" +
                ");");
            try {
                while (getZones.step()) {
                    var zone = getZones.row.zone;
                    // Send the timezones off to the timezone service to attempt conversion:
                    var tz = getTimezone(zone);
                    if (tz) {
                        var refTz = getTimezoneService().getTimezone(tz.tzid);
                        if (refTz && refTz.tzid != zone) {
                            zonesToUpdate.push({ oldTzId: zone, newTzId: refTz.tzid });
                        }
                    }
                }
            } finally {
                getZones.reset();
            }

            this.mDB.beginTransaction();
            try {
                for each (var update in zonesToUpdate) {
                    this.mDB.executeSimpleSQL(
                        "UPDATE cal_attendees  SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                        "UPDATE cal_events     SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                        "UPDATE cal_events     SET event_start_tz   = '" + update.newTzId + "' WHERE event_start_tz   = '" + update.oldTzId + "'; " +
                        "UPDATE cal_events     SET event_end_tz     = '" + update.newTzId + "' WHERE event_end_tz     = '" + update.oldTzId + "'; " +
                        "UPDATE cal_events     SET alarm_time_tz    = '" + update.newTzId + "' WHERE alarm_time_tz    = '" + update.oldTzId + "'; " +
                        "UPDATE cal_properties SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                        "UPDATE cal_todos      SET recurrence_id_tz = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "'; " +
                        "UPDATE cal_todos      SET todo_entry_tz    = '" + update.newTzId + "' WHERE todo_entry_tz    = '" + update.oldTzId + "'; " +
                        "UPDATE cal_todos      SET todo_due_tz      = '" + update.newTzId + "' WHERE todo_due_tz      = '" + update.oldTzId + "'; " +
                        "UPDATE cal_todos      SET alarm_time_tz    = '" + update.newTzId + "' WHERE recurrence_id_tz = '" + update.oldTzId + "';");
                }
                this.mDB.executeSimpleSQL("DELETE FROM cal_tz_version; INSERT INTO cal_tz_version VALUES ('" +
                                          getTimezoneService().version + "');");
                this.mDB.commitTransaction();
            } catch (exc) {
                ASSERT(false, "Timezone update failed! DB Error: " + this.mDB.lastErrorString);
                this.mDB.rollbackTransaction();
                throw exc;
            }
        }
    },

    // database initialization
    // assumes mDB is valid

    initDB: function () {
        ASSERT(this.mDB, "Database has not been opened!", true);
        if (!this.mDB.tableExists("cal_calendar_schema_version")) {
            this.initDBSchema();
        } else {
            var version = this.getVersion();
            if (version < this.DB_SCHEMA_VERSION) {
                this.upgradeDB(version);
            } else if (version > this.DB_SCHEMA_VERSION) {
                throw Components.interfaces.calIErrors.STORAGE_UNKNOWN_SCHEMA_ERROR;
            }
        }

        this.ensureUpdatedTimezones();

        // (Conditionally) add index
        this.mDB.executeSimpleSQL(
            "CREATE INDEX IF NOT EXISTS " + 
            "idx_cal_properies_item_id ON cal_properties(cal_id, item_id);"
            );

        this.mSelectEvent = createStatement (
            this.mDB,
            "SELECT * FROM cal_events " +
            "WHERE id = :id AND cal_id = " + this.mCalId +
            " AND recurrence_id IS NULL " +
            "LIMIT 1"
            );

        this.mSelectTodo = createStatement (
            this.mDB,
            "SELECT * FROM cal_todos " +
            "WHERE id = :id AND cal_id = " + this.mCalId +
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
        this.mSelectNonRecurringEventsByRange = createStatement(
            this.mDB,
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
            " AND cal_id = " + this.mCalId + " AND flags & 16 == 0 AND recurrence_id IS NULL"
            );
       /**
        * WHERE (due > rangeStart AND start < rangeEnd) OR
        *       (due = rangeStart AND start = rangeStart) OR
        *       (due IS NULL AND ((start >= rangeStart AND start < rangeEnd) OR
        *                         (start IS NULL AND 
        *                          (completed > rangeStart OR completed IS NULL))) OR
        *       (start IS NULL AND due >= rangeStart AND due < rangeEnd)
        */

        var floatingTodoEntry = "todo_entry_tz = 'floating' AND todo_entry";
        var nonFloatingTodoEntry = "todo_entry_tz != 'floating' AND todo_entry";
        var floatingTodoDue = "todo_due_tz = 'floating' AND todo_due";
        var nonFloatingTodoDue = "todo_due_tz != 'floating' AND todo_due";
        var floatingCompleted = "todo_completed_tz = 'floating' AND todo_completed";
        var nonFloatingCompleted = "todo_completed_tz != 'floating' AND todo_completed";

        this.mSelectNonRecurringTodosByRange = createStatement(
            this.mDB,
            "SELECT * FROM cal_todos " +
            "WHERE " +
            "(((("+floatingTodoDue+" > :range_start + :start_offset) OR " +
            "   ("+nonFloatingTodoDue+" > :range_start)) AND " +
            "  (("+floatingTodoEntry+" < :range_end + :end_offset) OR " +
            "   ("+nonFloatingTodoEntry+" < :range_end))) OR " +
            " ((("+floatingTodoDue+" = :range_start + :start_offset) OR " +
            "   ("+nonFloatingTodoDue+" = :range_start)) AND " +
            "  (("+floatingTodoEntry+" = :range_start + :start_offset) OR " +
            "   ("+nonFloatingTodoEntry+" = :range_start))) OR " +
            " ((todo_due IS NULL) AND " +
            "  (((("+floatingTodoEntry+" >= :range_start + :start_offset) OR " +
            "    ("+nonFloatingTodoEntry+" >= :range_start)) AND " +
            "    (("+floatingTodoEntry+" < :range_end + :end_offset) OR " +
            "     ("+nonFloatingTodoEntry+" < :range_end))) OR " +
            "   ((todo_entry IS NULL) AND " +
            "    ((("+floatingCompleted+" > :range_start + :start_offset) OR " +
            "      ("+nonFloatingCompleted+" > :range_start)) OR " +
            "     (todo_completed IS NULL))))) OR " +
            " ((todo_entry IS NULL) AND " +
            "  (("+floatingTodoDue+" >= :range_start + :start_offset) OR " +
            "   ("+nonFloatingTodoDue+" >= :range_start)) AND " +
            "  (("+floatingTodoDue+" < :range_end + :end_offset) OR " +
            "   ("+nonFloatingTodoDue+" < :range_end)))) " +
            " AND cal_id = " + this.mCalId + " AND flags & 16 == 0 AND recurrence_id IS NULL"
            );

        this.mSelectEventsWithRecurrence = createStatement(
            this.mDB,
            "SELECT * FROM cal_events " +
            " WHERE flags & 16 == 16 " +
            "   AND cal_id = " + this.mCalId + " AND recurrence_id is NULL"
            );

        this.mSelectTodosWithRecurrence = createStatement(
            this.mDB,
            "SELECT * FROM cal_todos " +
            " WHERE flags & 16 == 16 " +
            "   AND cal_id = " + this.mCalId + " AND recurrence_id IS NULL"
            );

        this.mSelectEventExceptions = createStatement (
            this.mDB,
            "SELECT * FROM cal_events " +
            "WHERE id = :id AND cal_id = " + this.mCalId +
            " AND recurrence_id IS NOT NULL"
            );

        this.mSelectTodoExceptions = createStatement (
            this.mDB,
            "SELECT * FROM cal_todos " +
            "WHERE id = :id AND cal_id = " + this.mCalId +
            " AND recurrence_id IS NOT NULL"
            );

        // For the extra-item data, we used to use mDBTwo, so that
        // these could be executed while a selectItems was running.
        // This no longer seems to be needed and actually causes
        // havoc when transactions are in use.
        this.mSelectAttendeesForItem = createStatement(
            this.mDB,
            "SELECT * FROM cal_attendees " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId +
            " AND recurrence_id IS NULL"
            );

        this.mSelectAttendeesForItemWithRecurrenceId = createStatement(
            this.mDB,
            "SELECT * FROM cal_attendees " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId +
            " AND recurrence_id = :recurrence_id" +
            " AND recurrence_id_tz = :recurrence_id_tz"
            );

        this.mSelectPropertiesForItem = createStatement(
            this.mDB,
            "SELECT * FROM cal_properties " +
            "WHERE item_id = :item_id AND recurrence_id IS NULL"
            );

        this.mSelectPropertiesForItemWithRecurrenceId = createStatement(
            this.mDB,
            "SELECT * FROM cal_properties " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId +
            " AND recurrence_id = :recurrence_id" +
            " AND recurrence_id_tz = :recurrence_id_tz"
            );

        this.mSelectRecurrenceForItem = createStatement(
            this.mDB,
            "SELECT * FROM cal_recurrence " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId +
            " ORDER BY recur_index"
            );

        this.mSelectAttachmentsForItem = createStatement(
            this.mDB,
            "SELECT * FROM cal_attachments " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );

        this.mSelectRelationsForItem = createStatement(
            this.mDB,
            "SELECT * FROM cal_relations " +
            "WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );

        this.mSelectMetaData = createStatement(
            this.mDB,
            "SELECT * FROM cal_metadata"
            + " WHERE item_id = :item_id AND cal_id = " + this.mCalId);

        this.mSelectAllMetaData = createStatement(
            this.mDB,
            "SELECT * FROM cal_metadata"
            + " WHERE cal_id = " + this.mCalId);

        // insert statements
        this.mInsertEvent = createStatement (
            this.mDB,
            "INSERT INTO cal_events " +
            "  (cal_id, id, time_created, last_modified, " +
            "   title, priority, privacy, ical_status, flags, " +
            "   event_start, event_start_tz, event_end, event_end_tz, event_stamp, " +
            "   alarm_time, alarm_time_tz, recurrence_id, recurrence_id_tz, " +
            "   alarm_offset, alarm_related, alarm_last_ack) " +
            "VALUES (" + this.mCalId + ", :id, :time_created, :last_modified, " +
            "        :title, :priority, :privacy, :ical_status, :flags, " +
            "        :event_start, :event_start_tz, :event_end, :event_end_tz, :event_stamp, " +
            "        :alarm_time, :alarm_time_tz, :recurrence_id, :recurrence_id_tz," + 
            "        :alarm_offset, :alarm_related, :alarm_last_ack)"
            );

        this.mInsertTodo = createStatement (
            this.mDB,
            "INSERT INTO cal_todos " +
            "  (cal_id, id, time_created, last_modified, " +
            "   title, priority, privacy, ical_status, flags, " +
            "   todo_entry, todo_entry_tz, todo_due, todo_due_tz, todo_completed, " +
            "   todo_completed_tz, todo_complete, " +
            "   alarm_time, alarm_time_tz, recurrence_id, recurrence_id_tz, " +
            "   alarm_offset, alarm_related, alarm_last_ack)" +
            "VALUES (" + this.mCalId + ", :id, :time_created, :last_modified, " +
            "        :title, :priority, :privacy, :ical_status, :flags, " +
            "        :todo_entry, :todo_entry_tz, :todo_due, :todo_due_tz, " +
            "        :todo_completed, :todo_completed_tz, :todo_complete, " +
            "        :alarm_time, :alarm_time_tz, :recurrence_id, :recurrence_id_tz," + 
            "        :alarm_offset, :alarm_related, :alarm_last_ack)"
            );
        this.mInsertProperty = createStatement (
            this.mDB,
            "INSERT INTO cal_properties (cal_id, item_id, recurrence_id, recurrence_id_tz, key, value) " +
            "VALUES (" + this.mCalId + ", :item_id, :recurrence_id, :recurrence_id_tz, :key, :value)"
            );
        this.mInsertAttendee = createStatement (
            this.mDB,
            "INSERT INTO cal_attendees " +
            "  (cal_id, item_id, recurrence_id, recurrence_id_tz, attendee_id, common_name, rsvp, role, status, type, is_organizer, properties) " +
            "VALUES (" + this.mCalId + ", :item_id, :recurrence_id, :recurrence_id_tz, :attendee_id, :common_name, :rsvp, :role, :status, :type, :is_organizer, :properties)"
            );
        this.mInsertRecurrence = createStatement (
            this.mDB,
            "INSERT INTO cal_recurrence " +
            "  (cal_id, item_id, recur_index, recur_type, is_negative, dates, count, end_date, interval, second, minute, hour, day, monthday, yearday, weekno, month, setpos) " +
            "VALUES (" + this.mCalId + ", :item_id, :recur_index, :recur_type, :is_negative, :dates, :count, :end_date, :interval, :second, :minute, :hour, :day, :monthday, :yearday, :weekno, :month, :setpos)"
            );

        this.mInsertAttachment = createStatement (
            this.mDB,
            "INSERT INTO cal_attachments " + 
            " (cal_id, item_id, data, format_type, encoding) " +
            "VALUES (" + this.mCalId + ", :item_id, :data, :format_type, :encoding)"
            );

        this.mInsertRelation = createStatement (
            this.mDB,
            "INSERT INTO cal_relations " + 
            " (cal_id, item_id, rel_type, rel_id) " +
            "VALUES (" + this.mCalId + ", :item_id, :rel_type, :rel_id)"
            );

        this.mInsertMetaData = createStatement(
            this.mDB,
            "INSERT INTO cal_metadata"
            + " (cal_id, item_id, value)"
            + " VALUES (" + this.mCalId + ", :item_id, :value)");

        // delete statements
        this.mDeleteEvent = createStatement (
            this.mDB,
            "DELETE FROM cal_events WHERE id = :id AND cal_id = " + this.mCalId
            );
        this.mDeleteTodo = createStatement (
            this.mDB,
            "DELETE FROM cal_todos WHERE id = :id AND cal_id = " + this.mCalId
            );
        this.mDeleteAttendees = createStatement (
            this.mDB,
            "DELETE FROM cal_attendees WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );
        this.mDeleteProperties = createStatement (
            this.mDB,
            "DELETE FROM cal_properties WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );
        this.mDeleteRecurrence = createStatement (
            this.mDB,
            "DELETE FROM cal_recurrence WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );
        this.mDeleteAttachments = createStatement (
            this.mDB,
            "DELETE FROM cal_attachments WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );
        this.mDeleteRelations = createStatement (
            this.mDB,
            "DELETE FROM cal_relations WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );
        this.mDeleteMetaData = createStatement(
            this.mDB,
            "DELETE FROM cal_metadata WHERE item_id = :item_id AND cal_id = " + this.mCalId
            );

        // These are only used when deleting an entire calendar
        var extrasTables = [ "cal_attendees", "cal_properties",
                             "cal_recurrence", "cal_attachments",
                             "cal_metadata", "cal_relations" ];

        this.mDeleteEventExtras = new Array();
        this.mDeleteTodoExtras = new Array();

        for (var table in extrasTables) {
            this.mDeleteEventExtras[table] = createStatement (
                this.mDB,
                "DELETE FROM " + extrasTables[table] + " WHERE item_id IN" +
                "  (SELECT id FROM cal_events WHERE cal_id = " + this.mCalId + ")" +
                " AND cal_id = " + this.mCalId
                );
            this.mDeleteTodoExtras[table] = createStatement (
                this.mDB,
                "DELETE FROM " + extrasTables[table] + " WHERE item_id IN" +
                "  (SELECT id FROM cal_todos WHERE cal_id = " + this.mCalId + ")" +
                " AND cal_id = " + this.mCalId
                );
        }

        // Note that you must delete the "extras" _first_ using the above two
        // statements, before you delete the events themselves.
        this.mDeleteAllEvents = createStatement (
            this.mDB,
            "DELETE from cal_events WHERE cal_id = " + this.mCalId
            );
        this.mDeleteAllTodos = createStatement (
            this.mDB,
            "DELETE from cal_todos WHERE cal_id = " + this.mCalId
            );

        this.mDeleteAllMetaData = createStatement(
            this.mDB,
            "DELETE FROM cal_metadata"
            + " WHERE cal_id = " + this.mCalId
            );
    },

    //
    // database reading functions
    //

    // read in the common ItemBase attributes from aDBRow, and stick
    // them on item
    getItemBaseFromRow: function (row, flags, item) {
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

        if (row.alarm_time) {
            // Old (schema version 4) data, need to convert this nicely to the
            // new alarm interface.  Eventually, we're going to want to be able
            // to deal with both types of data in a calIAlarm interface, but
            // not yet.  Leaving this column around though may help ease that
            // transition in the future.
            var alarmTime = newDateTime(row.alarm_time, row.alarm_time_tz);
            var time;
            var related = Components.interfaces.calIItemBase.ALARM_RELATED_START;
            if (isEvent(item)) {
                time = newDateTime(row.event_start, row.event_start_tz);
            } else { //tasks
                if (row.todo_entry) {
                    time = newDateTime(row.todo_entry, row.todo_entry_tz);
                } else if (row.todo_due) {
                    related = Components.interfaces.calIItemBase.ALARM_RELATED_END;
                    time = newDateTime(row.todo_due, row.todo_due_tz);
                }
            }
            if (time) {
                var duration = alarmTime.subtractDate(time);
                item.alarmOffset = duration;
                item.alarmRelated = related;
            } else {
                Components.utils.reportError("WARNING! Couldn't do alarm conversion for item:"+
                                             item.title+','+item.id+"!\n");
            }
        }

        // Alarm offset could be 0, but this is ok, so compare with null
        if (row.alarm_offset != null) {
            var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                                     .createInstance(Components.interfaces.calIDuration);
            duration.inSeconds = row.alarm_offset;
            duration.normalize();

            item.alarmOffset = duration;
            item.alarmRelated = row.alarm_related;
        }
        if (row.alarm_last_ack) {
            // alarm acks are always in utc
            item.alarmLastAck = newDateTime(row.alarm_last_ack, "UTC");
        }

        if (row.recurrence_id)
            item.recurrenceId = newDateTime(row.recurrence_id, row.recurrence_id_tz);

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

    cacheItem: function stor_cacheItem(item) {
        this.mItemCache[item.id] = item;
        if (item.recurrenceInfo) {
            if (isEvent(item)) {
                this.mRecEventCache[item.id] = item;
            } else {
                this.mRecTodoCache[item.id] = item;
            }
        }
    },

    assureRecurringItemCaches: function stor_assureRecurringItemCaches() {
        if (this.mRecItemCacheInited) {
            return;
        }
        // build up recurring event and todo cache, because we need that on every query:
        // for recurring items, we need to query database-wide.. yuck

        sp = this.mSelectEventsWithRecurrence.params;
        while (this.mSelectEventsWithRecurrence.step()) {
            var row = this.mSelectEventsWithRecurrence.row;
            var item = this.getEventFromRow(row, {});
            this.mRecEventCache[item.id] = item;
        }
        this.mSelectEventsWithRecurrence.reset();

        sp = this.mSelectTodosWithRecurrence.params;
        while (this.mSelectTodosWithRecurrence.step()) {
            var row = this.mSelectTodosWithRecurrence.row;
            var item = this.getTodoFromRow(row, {});
            this.mRecTodoCache[item.id] = item;
        }
        this.mSelectTodosWithRecurrence.reset();

        this.mRecItemCacheInited = true;
    },

    // xxx todo: consider removing flags parameter
    getEventFromRow: function stor_getEventFromRow(row, flags, isException) {
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
        if ((row.flags & CAL_ITEM_FLAG_EVENT_ALLDAY) != 0) {
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

    getTodoFromRow: function stor_getTodoFromRow(row, flags, isException) {
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
    
    getAdditionalDataForItem: function (item, flags) {
        // This is needed to keep the modification time intact.
        var savedLastModifiedTime = item.lastModifiedTime;

        if (flags & CAL_ITEM_FLAG_HAS_ATTENDEES) {
            var selectItem = null;
            if (item.recurrenceId == null)
                selectItem = this.mSelectAttendeesForItem;
            else {
                selectItem = this.mSelectAttendeesForItemWithRecurrenceId;
                this.setDateParamHelper(selectItem.params, "recurrence_id", item.recurrenceId);
            }

            selectItem.params.item_id = item.id;

            while (selectItem.step()) {
                var attendee = this.getAttendeeFromRow(selectItem.row);
                if (attendee.isOrganizer) {
                    item.organizer = attendee;
                } else {
                    item.addAttendee(attendee);
                }
            }
            selectItem.reset();
        }

        var row;
        if (flags & CAL_ITEM_FLAG_HAS_PROPERTIES) {
            var selectItem = null;
            if (item.recurrenceId == null)
                selectItem = this.mSelectPropertiesForItem;
            else {
                selectItem = this.mSelectPropertiesForItemWithRecurrenceId;
                this.setDateParamHelper(selectItem.params, "recurrence_id", item.recurrenceId);
            }
                
            selectItem.params.item_id = item.id;
            
            while (selectItem.step()) {
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
            selectItem.reset();
        }

        var i;
        if (flags & CAL_ITEM_FLAG_HAS_RECURRENCE) {
            if (item.recurrenceId)
                throw Components.results.NS_ERROR_UNEXPECTED;

            var rec = null;

            this.mSelectRecurrenceForItem.params.item_id = item.id;
            while (this.mSelectRecurrenceForItem.step()) {
                row = this.mSelectRecurrenceForItem.row;

                var ritem = null;

                if (row.recur_type == null ||
                    row.recur_type == "x-dateset")
                {
                    ritem = new CalRecurrenceDateSet();

                    var dates = row.dates.split(",");
                    for (i = 0; i < dates.length; i++) {
                        var date = textToDate(dates[i]);
                        ritem.addDate(date);
                    }
                } else if (row.recur_type == "x-date") {
                    ritem = new CalRecurrenceDate();
                    var d = row.dates;
                    ritem.date = textToDate(d);
                } else {
                    ritem = new CalRecurrenceRule();

                    ritem.type = row.recur_type;
                    if (row.count) {
                        try {
                            ritem.count = row.count;
                        } catch(exc) {
                        }
                    } else {
                        if (row.end_date)
                            ritem.endDate = newDateTime(row.end_date);
                        else
                            ritem.endDate = null;
                    }
                    try {
                        ritem.interval = row.interval;
                    } catch(exc) {
                    }

                    var rtypes = ["second",
                                  "minute",
                                  "hour",
                                  "day",
                                  "monthday",
                                  "yearday",
                                  "weekno",
                                  "month",
                                  "setpos"];

                    for (i = 0; i < rtypes.length; i++) {
                        var comp = "BY" + rtypes[i].toUpperCase();
                        if (row[rtypes[i]]) {
                            var rstr = row[rtypes[i]].toString().split(",");
                            var rarray = [];
                            for (var j = 0; j < rstr.length; j++) {
                                rarray[j] = parseInt(rstr[j]);
                            }

                            ritem.setComponent (comp, rarray.length, rarray);
                        }
                    }
                }

                if (row.is_negative)
                    ritem.isNegative = true;
                if (rec == null) {
                    rec = new CalRecurrenceInfo();
                    rec.item = item;
                }
                rec.appendRecurrenceItem(ritem);
            }

            if (rec == null) {
                dump ("XXXX Expected to find recurrence, but got no items!\n");
            }
            item.recurrenceInfo = rec;

            this.mSelectRecurrenceForItem.reset();
        }

        if (flags & CAL_ITEM_FLAG_HAS_EXCEPTIONS) {
            // it's safe that we don't run into this branch again for exceptions
            // (getAdditionalDataForItem->get[Event|Todo]FromRow->getAdditionalDataForItem):
            // every excepton has a recurrenceId and isn't flagged as CAL_ITEM_FLAG_HAS_EXCEPTIONS
            if (item.recurrenceId)
                throw Components.results.NS_ERROR_UNEXPECTED;

            var rec = item.recurrenceInfo;

            if (isEvent(item)) {
                this.mSelectEventExceptions.params.id = item.id;
                while (this.mSelectEventExceptions.step()) {
                    var row = this.mSelectEventExceptions.row;
                    var exc = this.getEventFromRow(row, {}, true /*isException*/);
                    rec.modifyException(exc, true);
                }
                this.mSelectEventExceptions.reset();
            } else if (isToDo(item)) {
                this.mSelectTodoExceptions.params.id = item.id;
                while (this.mSelectTodoExceptions.step()) {
                    var row = this.mSelectTodoExceptions.row;
                    var exc = this.getTodoFromRow(row, {}, true /*isException*/);
                    rec.modifyException(exc, true);
                }
                this.mSelectTodoExceptions.reset();
            } else {
                throw Components.results.NS_ERROR_UNEXPECTED;
            }
        }

        if (flags & CAL_ITEM_FLAG_HAS_ATTACHMENTS) {
            var selectAttachment = this.mSelectAttachmentsForItem;
            selectAttachment.params.item_id = item.id;

            while (selectAttachment.step()) {
                var row = selectAttachment.row;
                var attachment = this.getAttachmentFromRow(row);
                item.addAttachment(attachment);
            }
            selectAttachment.reset();
        }

        if (flags & CAL_ITEM_FLAG_HAS_RELATIONS) {
            var selectRelation = this.mSelectRelationsForItem;
            selectRelation.params.item_id = item.id;
            while (selectRelation.step()) {
                var row = selectRelation.row;
                var relation = this.getRelationFromRow(row);
                item.addRelation(relation);
            }
            selectRelation.reset();
        }

        // Restore the saved modification time
        item.setProperty("LAST-MODIFIED", savedLastModifiedTime);
    },

    getAttendeeFromRow: function (row) {
        var a = CalAttendee();

        a.id = row.attendee_id;
        a.commonName = row.common_name;
        a.rsvp = (row.rsvp != 0);
        a.role = row.role;
        a.participationStatus = row.status;
        a.userType = row.type;
        a.isOrganizer = row.is_organizer;
        var props = row.properties;
        if (props) {
            for each (var pair in props.split(",")) {
                [key, value] = pair.split(":");
                a.setProperty(decodeURIComponent(key), decodeURIComponent(value));
            }
        }

        return a;
    },

    getAttachmentFromRow: function (row) {
        var a = createAttachment();
       
        // TODO we don't support binary data here, libical doesn't either.
        a.uri = makeURL(row.data);
        a.formatType = row.format_type;
        a.encoding = row.encoding;
    
        return a;
    },

    getRelationFromRow: function (row) {
        var r = createRelation();
        r.relType = row.rel_type;
        r.relId = row.rel_id;
        return r;
    },

    //
    // get item from db or from cache with given iid
    //
    getItemById: function (aID) {
        this.assureRecurringItemCaches();

        // cached?
        var item = this.mItemCache[aID];
        if (item) {
            return item;
        }

        // not cached; need to read from the db
        var flags = {};

        // try events first
        this.mSelectEvent.params.id = aID;
        if (this.mSelectEvent.step())
            item = this.getEventFromRow(this.mSelectEvent.row, flags);
        this.mSelectEvent.reset();

        // try todo if event fails
        if (!item) {
            this.mSelectTodo.params.id = aID;
            if (this.mSelectTodo.step())
                item = this.getTodoFromRow(this.mSelectTodo.row, flags);
            this.mSelectTodo.reset();
        }

        return item;
    },

    //
    // database writing functions
    //

    setDateParamHelper: function (params, entryname, cdt) {
        if (cdt) {
            params[entryname] = cdt.nativeTime;
            var tz = cdt.timezone;
            var ownTz = getTimezoneService().getTimezone(tz.tzid);
            if (ownTz) { // if we know that TZID, we use it
                params[entryname + "_tz"] = ownTz.tzid;
            } else { // foreign one
                params[entryname + "_tz"] = tz.icalComponent.serializeToICS();
            }
        } else {
            params[entryname] = null;
            params[entryname + "_tz"] = null;
        }
    },

    flushItem: function (item, olditem) {
        ASSERT(!item.recurrenceId, "no parent item passed!", true);

        this.acquireTransaction();
        try {
            this.deleteItemById(olditem ? olditem.id : item.id);
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

    writeItem: function (item, olditem) {
        var flags = 0;

        flags |= this.writeAttendees(item, olditem);
        flags |= this.writeRecurrence(item, olditem);
        flags |= this.writeProperties(item, olditem);
        flags |= this.writeAttachments(item, olditem);
        flags |= this.writeRelations(item, olditem);

        if (isEvent(item))
            this.writeEvent(item, olditem, flags);
        else if (isToDo(item))
            this.writeTodo(item, olditem, flags);
        else
            throw Components.results.NS_ERROR_UNEXPECTED;
    },

    writeEvent: function (item, olditem, flags) {
        var ip = this.mInsertEvent.params;
        this.setupItemBaseParams(item, olditem,ip);

        this.setDateParamHelper(ip, "event_start", item.startDate);
        this.setDateParamHelper(ip, "event_end", item.endDate);

        if (item.startDate.isDate)
            flags |= CAL_ITEM_FLAG_EVENT_ALLDAY;

        ip.flags = flags;

        this.mInsertEvent.execute();
        this.mInsertEvent.reset();
    },

    writeTodo: function (item, olditem, flags) {
        var ip = this.mInsertTodo.params;

        this.setupItemBaseParams(item, olditem,ip);

        this.setDateParamHelper(ip, "todo_entry", item.entryDate);
        this.setDateParamHelper(ip, "todo_due", item.dueDate);
        this.setDateParamHelper(ip, "todo_completed", item.getProperty("COMPLETED"));

        ip.todo_complete = item.getProperty("PERCENT-COMPLETED");

        ip.flags = flags;

        this.mInsertTodo.execute();
        this.mInsertTodo.reset();
    },

    setupItemBaseParams: function (item, olditem, ip) {
        ip.id = item.id;

        if (item.recurrenceId)
            this.setDateParamHelper(ip, "recurrence_id", item.recurrenceId);

        var tmp;

        if ((tmp = item.getProperty("CREATED")))
            ip.time_created = tmp.nativeTime;
        if ((tmp = item.getProperty("LAST-MODIFIED")))
            ip.last_modified = tmp.nativeTime;

        ip.title = item.getProperty("SUMMARY");
        ip.priority = item.getProperty("PRIORITY");
        ip.privacy = item.getProperty("CLASS");
        ip.ical_status = item.getProperty("STATUS");

        if (!item.parentItem)
            ip.event_stamp = item.stampTime.nativeTime;

        if (item.alarmOffset) {
            ip.alarm_offset = item.alarmOffset.inSeconds;
            ip.alarm_related = item.alarmRelated;
        }
        if (item.alarmLastAck) {
            ip.alarm_last_ack = item.alarmLastAck.nativeTime;
        }
    },

    writeAttendees: function (item, olditem) {
        var attendees = item.getAttendees({});
        if (item.organizer) {
            attendees = attendees.concat([]);
            attendees.push(item.organizer);
        }
        if (attendees.length > 0) {
            for each (var att in attendees) {
                var ap = this.mInsertAttendee.params;
                ap.item_id = item.id;
                this.setDateParamHelper(ap, "recurrence_id", item.recurrenceId);
                ap.attendee_id = att.id;
                ap.common_name = att.commonName;
                ap.rsvp = att.rsvp;
                ap.role = att.role;
                ap.status = att.participationStatus;
                ap.type = att.userType;
                ap.is_organizer = att.isOrganizer;

                var props = "";
                var propEnum = att.propertyEnumerator;
                while (propEnum && propEnum.hasMoreElements()) {
                    var prop = propEnum.getNext().QueryInterface(Components.interfaces.nsIProperty);
                    if (props.length) {
                        props += ",";
                    }
                    props += encodeURIComponent(prop.name);
                    props += ":";
                    props += encodeURIComponent(prop.value);
                }
                if (props.length) {
                    ap.properties = props;
                }

                this.mInsertAttendee.execute();
                this.mInsertAttendee.reset();
            }

            return CAL_ITEM_FLAG_HAS_ATTENDEES;
        }

        return 0;
    },

    writeProperty: function stor_writeProperty(item, propName, propValue) {
        var pp = this.mInsertProperty.params;
        pp.key = propName;
        if (calInstanceOf(propValue, Components.interfaces.calIDateTime)) {
            pp.value = propValue.nativeTime;
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
        this.mInsertProperty.execute();
        this.mInsertProperty.reset();
    },
    writeProperties: function (item, olditem) {
        var ret = 0;
        var propEnumerator = item.propertyEnumerator;
        while (propEnumerator.hasMoreElements()) {
            ret = CAL_ITEM_FLAG_HAS_PROPERTIES;
            var prop = propEnumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
            if (item.isPropertyPromoted(prop.name))
                continue;
            this.writeProperty(item, prop.name, prop.value);
        }

        var cats = item.getCategories({});
        if (cats.length > 0) {
            ret = CAL_ITEM_FLAG_HAS_PROPERTIES;
            this.writeProperty(item, "CATEGORIES", categoriesArrayToString(cats));
        }

        return ret;
    },

    writeRecurrence: function (item, olditem) {
        var flags = 0;

        var rec = item.recurrenceInfo;
        if (rec) {
            flags = CAL_ITEM_FLAG_HAS_RECURRENCE;
            var ritems = rec.getRecurrenceItems ({});
            for (i in ritems) {
                var ritem = ritems[i];
                ap = this.mInsertRecurrence.params;
                ap.item_id = item.id;
                ap.recur_index = i;
                ap.is_negative = ritem.isNegative;
                if (calInstanceOf(ritem, kCalIRecurrenceDate)) {
                    ap.recur_type = "x-date";
                    ap.dates = dateToText(getInUtcOrKeepFloating(ritem.date));

                } else if (calInstanceOf(ritem, kCalIRecurrenceDateSet)) {
                    ap.recur_type = "x-dateset";

                    var rdates = ritem.getDates({});
                    var datestr = "";
                    for (j in rdates) {
                        if (j != 0)
                            datestr += ",";

                        datestr += dateToText(getInUtcOrKeepFloating(rdates[j]));
                    }

                    ap.dates = datestr;

                } else if (calInstanceOf(ritem, kCalIRecurrenceRule)) {
                    ap.recur_type = ritem.type;

                    if (ritem.isByCount)
                        ap.count = ritem.count;
                    else
                        ap.end_date = ritem.endDate ? ritem.endDate.nativeTime : null;

                    ap.interval = ritem.interval;

                    var rtypes = ["second",
                                  "minute",
                                  "hour",
                                  "day",
                                  "monthday",
                                  "yearday",
                                  "weekno",
                                  "month",
                                  "setpos"];
                    for (j = 0; j < rtypes.length; j++) {
                        var comp = "BY" + rtypes[j].toUpperCase();
                        var comps = ritem.getComponent(comp, {});
                        if (comps && comps.length > 0) {
                            var compstr = comps.join(",");
                            ap[rtypes[j]] = compstr;
                        }
                    }
                } else {
                    dump ("##### Don't know how to serialize recurrence item " + ritem + "!\n");
                }

                this.mInsertRecurrence.execute();
                this.mInsertRecurrence.reset();
            }

            var exceptions = rec.getExceptionIds ({});
            if (exceptions.length > 0) {
                flags |= CAL_ITEM_FLAG_HAS_EXCEPTIONS;

                // we need to serialize each exid as a separate
                // event/todo; setupItemBase will handle
                // writing the recurrenceId for us
                for each (exid in exceptions) {
                    var ex = rec.getExceptionFor(exid, false);
                    if (!ex)
                        throw Components.results.NS_ERROR_UNEXPECTED;
                    this.writeItem(ex, null);
                }
            }
        }

        return flags;
    },

    writeAttachments: function (item, olditem) {
        var attachments = item.getAttachments({});
        if (attachments && attachments.length > 0) {
            for each (att in attachments) {
                var ap = this.mInsertAttachment.params;
                ap.item_id = item.id;
                ap.data = att.uri.spec;
                ap.format_type = att.formatType;
                ap.encoding = att.encoding;

                this.mInsertAttachment.execute();
                this.mInsertAttachment.reset();
            }
            return CAL_ITEM_FLAG_HAS_ATTACHMENTS;
        }
        return 0;
    },

    writeRelations: function (item, olditem) {
        var relations = item.getRelations({});
        if (relations && relations.length > 0) {
            for each (var rel in relations) {
                var rp = this.mInsertRelation.params;
                rp.item_id = item.id;
                rp.rel_type = rel.relType;
                rp.rel_id = rel.relId;

                this.mInsertRelation.execute();
                this.mInsertRelation.reset();
            }
            return CAL_ITEM_FLAG_HAS_RELATIONS;
        }
        return 0;
    },          

    //
    // delete the item with the given uid
    //
    deleteItemById: function stor_deleteItemById(aID) {
        this.acquireTransaction();
        try {
            this.mDeleteAttendees(aID);
            this.mDeleteProperties(aID);
            this.mDeleteRecurrence(aID);
            this.mDeleteEvent(aID);
            this.mDeleteTodo(aID);
            this.mDeleteAttachments(aID);
            this.mDeleteMetaData(aID);
        } catch (e) {
            this.releaseTransaction(e);
            throw e;
        }
        this.releaseTransaction();

        delete this.mItemCache[aID];
        delete this.mRecEventCache[aID];
        delete this.mRecTodoCache[aID];
    },

    acquireTransaction: function stor_acquireTransaction() {
        var uriKey = this.uri.spec;
        if (!(uriKey in gTransCount)) {
            gTransCount[uriKey] = 0;
        }
        if (gTransCount[uriKey]++ == 0) {
            this.mDB.beginTransaction();
        }
    },
    releaseTransaction: function stor_releaseTransaction(err) {
        var uriKey = this.uri.spec;
        if (err) {
            ERROR("DB error: " + this.mDB.lastErrorString + "\nexc: " + err);
            gTransErr[uriKey] = exc;
        }

        if (gTransCount[uriKey] > 0) {
            if (--gTransCount[uriKey] == 0) {
                if (gTransErr[uriKey]) {
                    this.mDB.rollbackTransaction();
                    delete gTransErr[uriKey];
                } else {
                    this.mDB.commitTransaction();
                }
            }
        } else {
            ASSERT(gTransCount[uriKey] > 0, "unexepcted batch count!");
        }
    },

    startBatch: function stor_startBatch() {
        this.acquireTransaction();
        this.__proto__.__proto__.startBatch.apply(this, arguments);
    },
    endBatch: function stor_endBatch() {
        this.releaseTransaction();
        this.__proto__.__proto__.endBatch.apply(this, arguments);
    },

    //
    // calISyncCalendar interface
    //

    setMetaData: function stor_setMetaData(id, value) {
        this.mDeleteMetaData(id);
        var sp = this.mInsertMetaData.params;
        sp.item_id = id;
        try { 
            sp.value = value;
        } catch (e) {
            // The storage service throws an NS_ERROR_ILLEGAL_VALUE in
            // case pval is something complex (i.e not a string or
            // number). Swallow this error, leaving the value empty.
            if (e.result != Components.results.NS_ERROR_ILLEGAL_VALUE) {
                throw e;
            }
        }
        this.mInsertMetaData.execute();
        this.mInsertMetaData.reset();
    },

    deleteMetaData: function stor_deleteMetaData(id) {
        this.mDeleteMetaData(id);
    },

    getMetaData: function stor_getMetaData(id) {
        var query = this.mSelectMetaData;
        query.params.item_id = id;
        var value = null;
        try {
            if (query.step()) {
                value = query.row.value;
            }
        } finally {
            query.reset();
        }
        return value;
    },

    getAllMetaData: function stor_getAllMetaData(out_count,
                                                 out_ids,
                                                 out_values) {
        var query = this.mSelectAllMetaData;
        var ids = [];
        var values = [];
        try {
            while (query.step()) {
                ids.push(query.row.item_id);
                values.push(query.row.value);
            }
        } finally {
            query.reset();
        }
        out_count.value = ids.length;
        out_ids.value = ids;
        out_values.value = values;
    }
};

//
// sqlTables generated from schema.sql via makejsschema.pl
//

var sqlTables = {
  cal_calendar_schema_version:
    "   version INTEGER" +
    "",

  cal_tz_version:
    "   version TEXT" +
    "",

  cal_events:
    /*  REFERENCES cal_calendars.id, */
    "   cal_id          INTEGER, " +
    /*  ItemBase bits */
    "   id              TEXT," +
    "   time_created    INTEGER," +
    "   last_modified   INTEGER," +
    "   title           TEXT," +
    "   priority        INTEGER," +
    "   privacy         TEXT," +
    "   ical_status     TEXT," +
    "   recurrence_id   INTEGER," +
    "   recurrence_id_tz TEXT," +
    /*  CAL_ITEM_FLAG_PRIVATE = 1 */
    /*  CAL_ITEM_FLAG_HAS_ATTENDEES = 2 */
    /*  CAL_ITEM_FLAG_HAS_PROPERTIES = 4 */
    /*  CAL_ITEM_FLAG_EVENT_ALLDAY = 8 */
    /*  CAL_ITEM_FLAG_HAS_RECURRENCE = 16 */
    /*  CAL_ITEM_FLAG_HAS_EXCEPTIONS = 32 */
    /*  CAL_ITEM_FLAG_HAS_ATTACHMENTS = 64 */
    "   flags           INTEGER," +
    /*  Event bits */
    "   event_start     INTEGER," +
    "   event_start_tz  TEXT," +
    "   event_end       INTEGER," +
    "   event_end_tz    TEXT," +
    "   event_stamp     INTEGER," +
    /*  alarm time */
    "   alarm_time      INTEGER," +
    "   alarm_time_tz   TEXT," +
    "   alarm_offset    INTEGER," +
    "   alarm_related   INTEGER," +
    "   alarm_last_ack  INTEGER" +
    "",

  cal_todos:
    /*  REFERENCES cal_calendars.id, */
    "   cal_id          INTEGER, " +
    /*  ItemBase bits */
    "   id              TEXT," +
    "   time_created    INTEGER," +
    "   last_modified   INTEGER," +
    "   title           TEXT," +
    "   priority        INTEGER," +
    "   privacy         TEXT," +
    "   ical_status     TEXT," +
    "   recurrence_id   INTEGER," +
    "   recurrence_id_tz        TEXT," +
    /*  CAL_ITEM_FLAG_PRIVATE = 1 */
    /*  CAL_ITEM_FLAG_HAS_ATTENDEES = 2 */
    /*  CAL_ITEM_FLAG_HAS_PROPERTIES = 4 */
    /*  CAL_ITEM_FLAG_EVENT_ALLDAY = 8 */
    /*  CAL_ITEM_FLAG_HAS_RECURRENCE = 16 */
    /*  CAL_ITEM_FLAG_HAS_EXCEPTIONS = 32 */
    "   flags           INTEGER," +
    /*  Todo bits */
    /*  date the todo is to be displayed */
    "   todo_entry      INTEGER," +
    "   todo_entry_tz   TEXT," +
    /*  date the todo is due */
    "   todo_due        INTEGER," +
    "   todo_due_tz     TEXT," +
    /*  date the todo is completed */
    "   todo_completed  INTEGER," +
    "   todo_completed_tz TEXT," +
    /*  percent the todo is complete (0-100) */
    "   todo_complete   INTEGER," +
    /*  alarm time */
    "   alarm_time      INTEGER," +
    "   alarm_time_tz   TEXT," +
    "   alarm_offset    INTEGER," +
    "   alarm_related   INTEGER," +
    "   alarm_last_ack  INTEGER" +
    "",

  cal_attendees:
    "   cal_id          INTEGER, " +
    "   item_id         TEXT," +
    "   recurrence_id   INTEGER," +
    "   recurrence_id_tz        TEXT," +
    "   attendee_id     TEXT," +
    "   common_name     TEXT," +
    "   rsvp            INTEGER," +
    "   role            TEXT," +
    "   status          TEXT," +
    "   type            TEXT," +
    "   is_organizer    BOOLEAN," +
    "   properties      BLOB" +
    "",

  cal_recurrence:
    "   cal_id          INTEGER, " +
    "   item_id         TEXT," +
    /*  the index in the recurrence array of this thing */
    "   recur_index     INTEGER, " +
    /*  values from calIRecurrenceInfo; if null, date-based. */
    "   recur_type      TEXT, " +
    "   is_negative     BOOLEAN," +
    /*  */
    /*  these are for date-based recurrence */
    /*  */
    /*  comma-separated list of dates */
    "   dates           TEXT," +
    /*  */
    /*  these are for rule-based recurrence */
    /*  */
    "   count           INTEGER," +
    "   end_date        INTEGER," +
    "   interval        INTEGER," +
    /*  components, comma-separated list or null */
    "   second          TEXT," +
    "   minute          TEXT," +
    "   hour            TEXT," +
    "   day             TEXT," +
    "   monthday        TEXT," +
    "   yearday         TEXT," +
    "   weekno          TEXT," +
    "   month           TEXT," +
    "   setpos          TEXT" +
    "",

  cal_properties:
    "   cal_id          INTEGER, " +
    "   item_id         TEXT," +
    "   recurrence_id   INTEGER," +
    "   recurrence_id_tz TEXT," +
    "   key             TEXT," +
    "   value           BLOB" +
    "",

  cal_attachments:
    "   cal_id          INTEGER, " +
    "   item_id         TEXT," +
    "   data            BLOB," +
    "   format_type     TEXT," +
    "   encoding        TEXT" +
    "",  
  
  cal_relations:
    "   cal_id          INTEGER," +
    "   item_id         TEXT," +
    "   rel_type        TEXT," +
    "   rel_id          TEXT" +
    "",

  cal_metadata:
    "   cal_id          INTEGER, " +
    "   item_id         TEXT," + 
    "   value           BLOB" + 
    ""
};
