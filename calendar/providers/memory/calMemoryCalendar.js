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
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
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

//
// calMemoryCalendar.js
//

const calCalendarManagerContractID = "@mozilla.org/calendar/manager;1";
const calICalendarManager = Components.interfaces.calICalendarManager;

function calMemoryCalendar() {
    this.initProviderBase();
    this.initMemoryCalendar();
}

calMemoryCalendar.prototype = {
    __proto__: calProviderBase.prototype,

    //
    // nsISupports interface
    // 
    QueryInterface: function (aIID) {
        return doQueryInterface(this, calMemoryCalendar.prototype, aIID,
                                [Components.interfaces.calISyncCalendar,
                                 Components.interfaces.calICalendarProvider]);
    },

    initMemoryCalendar: function() {
        this.mObservers = new calListenerBag(Components.interfaces.calIObserver);
        this.mItems = { };
    },

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay() {
        return null;
    },

    get displayName() {
        return calGetString("calendar", "memoryName");
    },

    createCalendar: function mem_createCal() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function mem_deleteCal(cal, listener) {
        cal = cal.wrappedJSObject;
        cal.mItems = {};

        try {
            listener.onDeleteCalendar(cal, Components.results.NS_OK, null);
        } catch(ex) {}
    },

    mRelaxedMode: undefined,
    get relaxedMode calMemoryCalendar_relaxedModeGetter() {
        if (this.mRelaxedMode === undefined) {
            this.mRelaxedMode = this.getProperty("relaxedMode");
        }
        return this.mRelaxedMode;
    },

    //
    // calICalendar interface
    //

    getProperty: function calMemoryCalendar_getProperty(aName) {
        switch (aName) {
            case "cache.supported":
            case "requiresNetwork":
                return false;
        }
        return this.__proto__.__proto__.getProperty.apply(this, arguments);
    },

    // readonly attribute AUTF8String type;
    get type() { return "memory"; },

    // void addItem( in calIItemBase aItem, in calIOperationListener aListener );
    addItem: function (aItem, aListener) {
        var newItem = aItem.clone();
        return this.adoptItem(newItem, aListener);
    },
    
    // void adoptItem( in calIItemBase aItem, in calIOperationListener aListener );
    adoptItem: function (aItem, aListener) {
        if (this.readOnly) 
            throw Components.interfaces.calIErrors.CAL_IS_READONLY;
        if (aItem.id == null && aItem.isMutable)
            aItem.id = getUUID();

        if (aItem.id == null) {
            if (aListener)
                aListener.onOperationComplete (this.superCalendar,
                                               Components.results.NS_ERROR_FAILURE,
                                               aListener.ADD,
                                               aItem.id,
                                               "Can't set ID on non-mutable item to addItem");
            return;
        }

        if (this.mItems[aItem.id] != null) {
            if (this.relaxedMode) {
                // we possibly want to interact with the user before deleting
                delete this.mItems[aItem.id];
            }
            else {
                if (aListener) {
                    aListener.onOperationComplete (this.superCalendar,
                                                   Components.interfaces.calIErrors.DUPLICATE_ID,
                                                   aListener.ADD,
                                                   aItem.id,
                                                   "ID already exists for addItem");
                }
                return;
            }
        }

        aItem.calendar = this.superCalendar;
        var rec = aItem.recurrenceInfo;
        if (rec) {
            var exceptions = rec.getExceptionIds({});
            for each (var exid in exceptions) {
                var exception = rec.getExceptionFor(exid, false);
                if (exception) {
                    if (!exception.isMutable) {
                        exception = exception.clone();
                    }
                    exception.calendar = this.superCalendar;
                    rec.modifyException(exception);
                }
            }
        }
        
        aItem.makeImmutable();
        this.mItems[aItem.id] = aItem;

        // notify the listener
        if (aListener)
            aListener.onOperationComplete (this.superCalendar,
                                           Components.results.NS_OK,
                                           aListener.ADD,
                                           aItem.id,
                                           aItem);
        // notify observers
        this.mObservers.notify("onAddItem", [aItem]);
    },

    // void modifyItem( in calIItemBase aNewItem, in calIItemBase aOldItem, in calIOperationListener aListener );
    modifyItem: function (aNewItem, aOldItem, aListener) {
        if (this.readOnly) 
            throw Components.interfaces.calIErrors.CAL_IS_READONLY;
        if (!aNewItem) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        var this_ = this;
        function reportError(errStr, errId) {
            if (aListener) {
                aListener.onOperationComplete(this_.superCalendar,
                                              errId ? errId : Components.results.NS_ERROR_FAILURE,
                                              aListener.MODIFY,
                                              aNewItem.id,
                                              errStr);
            }
            return null;
        }

        if (!aNewItem.id) {
            // this is definitely an error
            return reportError(null, "ID for modifyItem item is null");
        }

        var modifiedItem = aNewItem.clone();
        if (modifiedItem.parentItem != modifiedItem) {
            modifiedItem.parentItem.recurrenceInfo.modifyException(modifiedItem);
            modifiedItem = modifiedItem.parentItem;
        }

        if (this.relaxedMode) {
            if (!aOldItem) {
                aOldItem = (this.mItems[aNewItem.id] || modifiedItem);
            }
            aOldItem = aOldItem.parentItem;
        } else {
            if (!aOldItem || !this.mItems[aNewItem.id]) {
                // no old item found?  should be using addItem, then.
                return reportError("ID for modifyItem doesn't exist, is null, or is from different calendar");
            }

            // do the old and new items match?
            if (aOldItem.id != modifiedItem.id) {
                return reportError("item ID mismatch between old and new items");
            }

            aOldItem = aOldItem.parentItem;
            var storedOldItem = this.mItems[aOldItem.id];

            // compareItems is not suitable here. See bug 418805.
            if (storedOldItem.icalString != aOldItem.icalString) {
                return reportError("old item mismatch in modifyItem");
            }

            if (aOldItem.generation != storedOldItem.generation) {
                return reportError("generation mismatch in modifyItem");
            }

            if (aOldItem.generation == modifiedItem.generation) { // has been cloned and modified
                // Only take care of incrementing the generation if relaxed mode is
                // off. Users of relaxed mode need to take care of this themselves.
                modifiedItem.generation += 1;
            }
        }

        modifiedItem.makeImmutable();
        this.mItems[modifiedItem.id] = modifiedItem;

        if (aListener) {
            aListener.onOperationComplete (this.superCalendar,
                                           Components.results.NS_OK,
                                           aListener.MODIFY,
                                           modifiedItem.id,
                                           modifiedItem);
        }

        // notify observers
        this.mObservers.notify("onModifyItem", [modifiedItem, aOldItem]);
        return null;
    },

    // void deleteItem( in calIItemBase aItem, in calIOperationListener aListener );
    deleteItem: function (aItem, aListener) {
        if (this.readOnly) 
            throw Components.interfaces.calIErrors.CAL_IS_READONLY;
        if (aItem.id == null || this.mItems[aItem.id] == null) {
            if (aListener)
                aListener.onOperationComplete (this.superCalendar,
                                               Components.results.NS_ERROR_FAILURE,
                                               aListener.DELETE,
                                               aItem.id,
                                               "ID is null or is from different calendar in deleteItem");
            return;
        }

        var oldItem = this.mItems[aItem.id];
        if (oldItem.generation != aItem.generation) {
            if (aListener)
                aListener.onOperationComplete (this.superCalendar,
                                               Components.results.NS_ERROR_FAILURE,
                                               aListener.DELETE,
                                               aItem.id,
                                               "generation mismatch in deleteItem");
            return;
        }

        delete this.mItems[aItem.id];

        if (aListener)
            aListener.onOperationComplete (this.superCalendar,
                                           Components.results.NS_OK,
                                           aListener.DELETE,
                                           aItem.id,
                                           aItem);
        // notify observers
        this.mObservers.notify("onDeleteItem", [oldItem]);
    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function (aId, aListener) {
        if (!aListener)
            return;

        if (aId == null ||
            this.mItems[aId] == null) {
            aListener.onOperationComplete(this.superCalendar,
                                          Components.results.NS_ERROR_FAILURE,
                                          aListener.GET,
                                          null,
                                          "IID doesn't exist for getItem");
            return;
        }

        var item = this.mItems[aId];
        var iid = null;

        if (item instanceof Components.interfaces.calIEvent) {
            iid = Components.interfaces.calIEvent;
        } else if (item instanceof Components.interfaces.calITodo) {
            iid = Components.interfaces.calITodo;
        } else {
            aListener.onOperationComplete (this.superCalendar,
                                           Components.results.NS_ERROR_FAILURE,
                                           aListener.GET,
                                           aId,
                                           "Can't deduce item type based on QI");
            return;
        }

        aListener.onGetResult (this.superCalendar,
                               Components.results.NS_OK,
                               iid,
                               null, 1, [item]);

        aListener.onOperationComplete (this.superCalendar,
                                       Components.results.NS_OK,
                                       aListener.GET,
                                       aId,
                                       null);

    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount, 
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function (aItemFilter, aCount,
                        aRangeStart, aRangeEnd, aListener)
    {
        if (!aListener)
            return;

        const calICalendar = Components.interfaces.calICalendar;
        const calIRecurrenceInfo = Components.interfaces.calIRecurrenceInfo;

        var itemsFound = Array();

        //
        // filters
        //

        // item base type
        var wantEvents = ((aItemFilter & calICalendar.ITEM_FILTER_TYPE_EVENT) != 0);
        var wantTodos = ((aItemFilter & calICalendar.ITEM_FILTER_TYPE_TODO) != 0);
        if(!wantEvents && !wantTodos) {
            // bail.
            aListener.onOperationComplete (this.superCalendar,
                                           Components.results.NS_ERROR_FAILURE,
                                           aListener.GET,
                                           null,
                                           "Bad aItemFilter passed to getItems");
            return;
        }

        // completed?
        var itemCompletedFilter = ((aItemFilter & calICalendar.ITEM_FILTER_COMPLETED_YES) != 0);
        var itemNotCompletedFilter = ((aItemFilter & calICalendar.ITEM_FILTER_COMPLETED_NO) != 0);
        function checkCompleted(item) {
            return (item.isCompleted ? itemCompletedFilter : itemNotCompletedFilter);
        }

        // return occurrences?
        var itemReturnOccurrences = ((aItemFilter & calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0);

        // figure out the return interface type
        var typeIID = null;
        if (itemReturnOccurrences) {
            typeIID = Components.interfaces.calIItemBase;
        } else {
            if (wantEvents && wantTodos) {
                typeIID = Components.interfaces.calIItemBase;
            } else if (wantEvents) {
                typeIID = Components.interfaces.calIEvent;
            } else if (wantTodos) {
                typeIID = Components.interfaces.calITodo;
            }
        }

        aRangeStart = ensureDateTime(aRangeStart);
        aRangeEnd = ensureDateTime(aRangeEnd);

        for (var itemIndex in this.mItems) {
            var item = this.mItems[itemIndex];
            var isEvent_ = isEvent(item);
            if (isEvent_) {
                if (!wantEvents) {
                    continue;
                }
            } else if (!wantTodos) {
                continue;
            }

            if (itemReturnOccurrences && item.recurrenceInfo) {
                var occurrences = item.recurrenceInfo.getOccurrences(
                    aRangeStart, aRangeEnd, aCount ? aCount - itemsFound.length : 0, {});
                if (!isEvent_) {
                    occurrences = occurrences.filter(checkCompleted);
                }
                itemsFound = itemsFound.concat(occurrences);
            } else if ((isEvent_ || checkCompleted(item)) &&
                       checkIfInRange(item, aRangeStart, aRangeEnd)) {
                itemsFound.push(item);
            }
            if (aCount && itemsFound.length >= aCount) {
                break;
            }
        }

        aListener.onGetResult (this.superCalendar,
                               Components.results.NS_OK,
                               typeIID,
                               null,
                               itemsFound.length,
                               itemsFound);

        aListener.onOperationComplete (this.superCalendar,
                                       Components.results.NS_OK,
                                       aListener.GET,
                                       null,
                                       null);
    }
};
