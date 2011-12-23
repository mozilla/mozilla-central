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
 * The Original Code is Sun Microsystems, Inc. code.
 *
 * The Initial Developers of the Original Code are
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
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

Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");

const calICalendar = Components.interfaces.calICalendar;
const cICL = Components.interfaces.calIChangeLog;

let gNoOpListener = {
    onGetResult: function(calendar, status, itemType, detail, count, items) {
    },

    onOperationComplete: function(calendar, status, opType, id, detail) {
    }
};

function calCachedCalendarObserverHelper(home, isCachedObserver) {
    this.home = home;
    this.isCachedObserver = isCachedObserver;
}
calCachedCalendarObserverHelper.prototype = {
    isCachedObserver: false,

    onStartBatch: function() {
        this.home.mObservers.notify("onStartBatch");
    },

    onEndBatch: function() {
        this.home.mObservers.notify("onEndBatch");
    },

    onLoad: function(calendar) {
        if (this.isCachedObserver) {
            this.home.mObservers.notify("onLoad", [this.home]);
        } else {
            // start sync action after uncached calendar has been loaded.
            // xxx todo, think about:
            // although onAddItem et al have been called, we need to fire
            // an additional onLoad completing the refresh call (->composite)
            var home = this.home;
            home.synchronize(function(status) {
                home.mObservers.notify("onLoad", [home]);
            });
        }
    },

    onAddItem: function(aItem) {
        if (this.isCachedObserver) {
            this.home.mObservers.notify("onAddItem", arguments);
        }
    },

    onModifyItem: function(aNewItem, aOldItem) {
        if (this.isCachedObserver) {
            this.home.mObservers.notify("onModifyItem", arguments);
        }
    },

    onDeleteItem: function(aItem) {
        if (this.isCachedObserver) {
            this.home.mObservers.notify("onDeleteItem", arguments);
        }
    },

    onError: function(aCalendar, aErrNo, aMessage) {
        this.home.mObservers.notify("onError", arguments);
    },

    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
        if (!this.isCachedObserver) {
            this.home.mObservers.notify("onPropertyChanged", [this.home, aName, aValue, aOldValue]);
        }
    },

    onPropertyDeleting: function(aCalendar, aName) {
        if (!this.isCachedObserver) {
            this.home.mObservers.notify("onPropertyDeleting", [this.home, aName]);
        }
    }
};

function calCachedCalendar(uncachedCalendar) {
    this.wrappedJSObject = this;
    this.mSyncQueue = [];
    this.mObservers = new cal.ObserverBag(Components.interfaces.calIObserver);
    uncachedCalendar.superCalendar = this;
    uncachedCalendar.addObserver(new calCachedCalendarObserverHelper(this, false));
    this.mUncachedCalendar = uncachedCalendar;
    this.setupCachedCalendar();
    if (this.supportsChangeLog) {
        uncachedCalendar.offlineStorage = this.mCachedCalendar;
    }
    this.offlineCachedItems = {};
    this.offlineCachedItemFlags = {};
}
calCachedCalendar.prototype = {
    QueryInterface: function cCC_QueryInterface(aIID) {
        if (aIID.equals(Components.interfaces.calISchedulingSupport)) {
            // check whether uncached calendar supports it:
            if (this.mUncachedCalendar.QueryInterface(aIID)) {
                return this;
            }
        }
        return cal.doQueryInterface(this, calCachedCalendar.prototype, aIID,
                                    [Components.interfaces.calICalendar,
                                     Components.interfaces.nsISupports]);
    },

    mCachedCalendar: null,
    mCachedObserver: null,
    mUncachedCalendar: null,
    mObservers: null,
    mSuperCalendar: null,
    offlineCachedItems: null,
    offlineCachedItemFlags: null,

    onCalendarUnregistering: function() {
        if (this.mCachedCalendar) {
            this.mCachedCalendar.removeObserver(this.mCachedObserver);
            // Although this doesn't really follow the spec, we know the
            // storage calendar's deleteCalendar method is synchronous.
            // TODO put changes into a different calendar and delete
            // afterwards.
            this.mCachedCalendar.QueryInterface(Components.interfaces.calICalendarProvider)
                                .deleteCalendar(this.mCachedCalendar, null);
            this.mCachedCalendar = null;
        }
    },

    setupCachedCalendar: function cCC_setupCachedCalendar() {
        try {
            if (this.mCachedCalendar) { // this is actually a resetupCachedCalendar:
                // Although this doesn't really follow the spec, we know the
                // storage calendar's deleteCalendar method is synchronous.
                // TODO put changes into a different calendar and delete
                // afterwards.
                this.mCachedCalendar.QueryInterface(Components.interfaces.calICalendarProvider)
                                    .deleteCalendar(this.mCachedCalendar, null);
                if (this.supportsChangeLog) {
                    // start with full sync:
                    this.mUncachedCalendar.resetLog();
                }
            } else {
                let calType = getPrefSafe("calendar.cache.type", "storage");
                // While technically, the above deleteCalendar should delete the
                // whole calendar, this is nothing more than deleting all events
                // todos and properties. Therefore the initialization can be
                // skipped.
                let cachedCalendar = Components.classes["@mozilla.org/calendar/calendar;1?type=" + calType]
                                               .createInstance(Components.interfaces.calICalendar);
                switch (calType) {
                    case "memory":
                        if (this.supportsChangeLog) {
                            // start with full sync:
                            this.mUncachedCalendar.resetLog();
                        }
                        break;
                    case "storage":
                        let file = getCalendarDirectory();
                        file.append("cache.sqlite");
                        cachedCalendar.uri = getIOService().newFileURI(file);
                        cachedCalendar.id = this.id;
                        break;
                    default:
                        throw new Error("unsupported cache calendar type: " + calType);
                }
                cachedCalendar.transientProperties = true;
                cachedCalendar.setProperty("relaxedMode", true);
                cachedCalendar.superCalendar = this;
                if (!this.mCachedObserver) {
                    this.mCachedObserver = new calCachedCalendarObserverHelper(this, true);
                }
                cachedCalendar.addObserver(this.mCachedObserver);
                this.mCachedCalendar = cachedCalendar;
            }
        } catch (exc) {
            Components.utils.reportError(exc);
        }
    },

    getOfflineAddedItems: function cCC_getOfflineAddedItems(callbackFunc) {
        let this_ = this;
        this_.offlineCachedItems = {};
        let getListener = {
            onGetResult: function cCC_oOC_cL_onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                for each (let item in aItems) {
                    this_.offlineCachedItems[item.hashId] = item;
                    this_.offlineCachedItemFlags[item.hashId] = cICL.OFFLINE_FLAG_CREATED_RECORD;
                }
            },

            onOperationComplete: function cCC_oOC_cL_onOperationComplete(aCalendar, aStatus, aOpType, aId, aDetail) {
                this_.getOfflineModifiedItems(callbackFunc);
            }
        };
        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_ALL_ITEMS | calICalendar.ITEM_FILTER_OFFLINE_CREATED,
                                      0, null, null, getListener);
    },

    getOfflineModifiedItems: function cCC_getOfflineModifiedItems(callbackFunc) {
        let this_ = this;
        let getListener = {
            onGetResult: function cCC_oOC_cL_onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                for each (let item in aItems) {
                    this_.offlineCachedItems[item.hashId] = item;
                    this_.offlineCachedItemFlags[item.hashId] = cICL.OFFLINE_FLAG_MODIFIED_RECORD;
                }
            },

            onOperationComplete: function cCC_oOC_cL_onOperationComplete(aCalendar, aStatus, aOpType, aId, aDetail) {
                this_.getOfflineDeletedItems(callbackFunc);
            }
        };
        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_OFFLINE_MODIFIED | calICalendar.ITEM_FILTER_ALL_ITEMS,
                                      0, null, null, getListener);
    },

    getOfflineDeletedItems: function cCC_getOfflineDeletedItems(callbackFunc) {
        let this_ = this;
        let getListener = {
            onGetResult: function cCC_oOC_cL_onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                for each (let item in aItems) {
                    this_.offlineCachedItems[item.hashId] = item;
                    this_.offlineCachedItemFlags[item.hashId] = cICL.OFFLINE_FLAG_DELETED_RECORD;
                }
            },

            onOperationComplete: function cCC_oOC_cL_onOperationComplete(aCalendar, aStatus, aOpType, aId, aDetail) {
                if (callbackFunc) {
                    callbackFunc();
                }
            }
        };
        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_OFFLINE_DELETED | calICalendar.ITEM_FILTER_ALL_ITEMS,
                                      0, null, null, getListener);
    },

    mPendingSync: null,
    mSyncQueue: null,
    synchronize: function cCC_synchronize(respFunc) {
        var this_ = this;
        if (this.getProperty("disabled")) {
            return emptyQueue(Components.results.NS_OK);
        }

        this.mSyncQueue.push(respFunc);
        if (this.mSyncQueue.length > 1) { // don't use mPendingSync here
            cal.LOG("[calCachedCalendar] sync in action/pending.");
            return this.mPendingSync;
        }

        function emptyQueue(status) {
            var queue = this_.mSyncQueue;
            this_.mSyncQueue = [];
            function execResponseFunc(func) {
                try {
                    func(status);
                } catch (exc) {
                    cal.ASSERT(false, exc);
                }
            }
            queue.forEach(execResponseFunc);
            cal.LOG("[calCachedCalendar] sync queue empty.");
            var op = this_.mPendingSync;
            this_.mPendingSync = null;
            return op;
        }

        if (this.offline) {
            return emptyQueue(Components.results.NS_OK);
        }

        if (this.supportsChangeLog) {
            cal.LOG("[calCachedCalendar] Doing changelog based sync for calendar " + this.uri.spec);
            var opListener = {
                thisCalendar : this,
                onResult: function(op, result) {
                    if (!op || !op.isPending) {
                        var status = (op ? op.status : Components.results.NS_OK);
                        if (!Components.isSuccessCode(status)) {
                            cal.ERROR("[calCachedCalendar] replay action failed: " +
                                      (op ? op.id : "<unknown>")+", uri=" +
                                      this.thisCalendar.uri.spec + ", result=" +
                                      result + ", op=" + op);
                        }
                        cal.LOG("[calCachedCalendar] replayChangesOn finished.");
                        emptyQueue(status);
                    }
                }
            };
            this.mPendingSync = this.mUncachedCalendar.replayChangesOn(opListener);
            return this.mPendingSync;
        }

        cal.LOG("[calCachedCalendar] Doing full sync for calendar " + this.uri.spec);
        let completeListener = {
            modifiedTimes: {},
            hasRenewedCalendar: false,
            onGetResult: function cCC_oOC_cL_onGetResult(aCalendar,
                                                         aStatus,
                                                         aItemType,
                                                         aDetail,
                                                         aCount,
                                                         aItems) {
                if (Components.isSuccessCode(aStatus)) {
                    if (!this.hasRenewedCalendar) {
                        // TODO instead of deleting the calendar and creating a new
                        // one, maybe we want to do a "real" sync between the
                        // existing local calendar and the remote calendar.
                        this_.setupCachedCalendar();
                        this.hasRenewedCalendar = true;
                    }
                    for each (var item in aItems) {
                        // Adding items recd from the Memory Calendar
                        // These may be different than what the cache has
                        this.modifiedTimes[item.id] = item.lastModifiedTime;
                        this_.mCachedCalendar.addItem(item, null);
                    }
                }
            },

            onOperationComplete: function cCC_oOC_cL_onOperationComplete(aCalendar,
                                                                         aStatus,
                                                                         aOpType,
                                                                         aId,
                                                                         aDetail) {
                if (Components.isSuccessCode(aStatus)) {
                    for each (let item in this_.offlineCachedItems) {
                        switch (this_.offlineCachedItemFlags[item.hashId]) {
                            case cICL.OFFLINE_FLAG_CREATED_RECORD:
                                // Created items are not present on the server, so its safe to adopt them
                                this_.adoptOfflineItem(item.clone(), null);
                                break;
                            case cICL.OFFLINE_FLAG_MODIFIED_RECORD:
                                // Two Cases Here:
                                if (item.id in this.modifiedTimes) {
                                    // The item is still on the server, we just retrieved it in the listener above.
                                    if (item.lastModifiedTime.compare(this.modifiedTimes[item.id]) < 0) {
                                        // The item on the server has been modified, ask to overwrite
                                        cal.WARN("[calCachedCalendar] Item '" + item.title + "' at the server seems to be modified recently.");
                                        this_.promptOverwrite("modify", item, null, null);
                                    } else {
                                        // Our item is newer, just modify the item
                                        this_.modifyOfflineItem(item, null, null);
                                    }
                                } else {
                                    // The item has been deleted from the server, ask if it should be added again
                                    cal.WARN("[calCachedCalendar] Item '" + item.title + "' has been deleted from the server");
                                    if (cal.promptOverwrite("modify", item, null, null)) {
                                        this_.adoptOfflineItem(item.clone(), null);
                                    }
                                }
                                break;
                            case cICL.OFFLINE_FLAG_DELETED_RECORD:
                                if (item.id in this.modifiedTimes) {
                                    // The item seems to exist on the server...
                                    if (item.lastModifiedTime.compare(this.modifiedTimes[item.id]) < 0) {
                                        // ...and has been modified on the server. Ask to overwrite
                                        cal.WARN("[calCachedCalendar] Item '" + item.title + "' at the server seems to be modified recently.");
                                        this_.promptOverwrite("delete", item, null, null);
                                    } else {
                                        // ...and has not been modified. Delete it now.
                                        this_.deleteOfflineItem(item, null);
                                    }
                                } else {
                                    // Item has already been deleted from the server, no need to change anything.
                                }
                                break;
                        }
                    }
                    this_.offlineCachedItems = {};
                    this_.offlineCachedItemFlags = {};
                }
                this_.playbackAddedItems(function() {this_.mCachedObserver.onLoad(this_.mCachedCalendar);});
                emptyQueue(aStatus);
            }
        };

        this.getOfflineAddedItems(function(){
            this_.mPendingSync = this_.mUncachedCalendar.getItems(Components.interfaces.calICalendar.ITEM_FILTER_ALL_ITEMS,
                                                                    0, null,  null, completeListener);
        });
        return this.mPendingSync;
    },

    onOfflineStatusChanged: function cCC_onOfflineStatusChanged(aNewState) {
        if (aNewState) {
            // Going offline: (XXX get items before going offline?) => we may ask the user to stay online a bit longer
        } else {
            // Going online (start replaying changes to the remote calendar)
            this.refresh();
        }
    },

    //aOldItem is already in the cache
    promptOverwrite: function cCC_promptOverwrite(aMethod, aItem, aListener, aOldItem) {
        let overwrite = cal.promptOverwrite(aMethod, aItem, aListener, aOldItem);
        if (overwrite) {
            if (aMethod == "modify") {
                this.modifyOfflineItem(aItem, aOldItem, aListener);
            } else {
                this.deleteOfflineItem(aItem, aListener);
            }
        }
    },

    playbackAddedItems: function cCC_playbackAddedItems(callbackFunc) {
        let this_ = this;
        let storage = this.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);

        let resetListener = gNoOpListener;

        let addListener = {
            itemCount: 0,

            onGetResult: function(calendar, status, itemType, detail, count, items) {
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    storage.resetItemOfflineFlag(detail, resetListener);
                } else {
                    cal.LOG("[calCachedCalendar.js] Unable to playback the items to the server. Will try again later. Aborting\n");
                    // TODO does something need to be called back?
                }

                this.itemCount--;
                if (this.itemCount == 0) {
                    this_.playbackModifiedItems(callbackFunc);
                }
            }
        };

        let getListener = {
            items: [],

            onGetResult: function(calendar, status, itemType, detail, count, items) {
                this.items = this.items.concat(items);
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (this_.offline) {
                    cal.LOG("[calCachedCalendar] back to offline mode, reconciliation aborted");
                    callbackFunc();
                } else {
                    cal.LOG("[calCachedCalendar] Adding "  + this.items.length + " items to " + this_.name);
                    if (this.items.length > 0) {
                        addListener.itemCount = this.items.length;
                        for each (let item in this.items) {
                            try {
                                if (this_.supportsChangeLog) {
                                    this_.mUncachedCalendar.addItemOrUseCache(item, false, addListener);
                                } else {
                                    // default mechanism for providers not implementing calIChangeLog
                                    this_.mUncachedCalendar.adoptItem(item.clone(), addListener);
                                }
                            } catch (e) {
                                cal.ERROR("[calCachedCalendar] Could not playback added item " + item.title + ": " + e);
                                addListener.onOperationComplete(thisCalendar,
                                                                e.result,
                                                                Components.interfaces.calIOperationListener.ADD,
                                                                item.id,
                                                                e.message);
                            }
                        }
                    } else {
                        this_.playbackModifiedItems(callbackFunc);
                    }
                }
                delete this.items;
            }
        };

        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_ALL_ITEMS | calICalendar.ITEM_FILTER_OFFLINE_CREATED,
                                      0, null, null, getListener);
    },
    playbackModifiedItems: function cCC_playbackModifiedItems(callbackFunc) {
        let this_ = this;
        let storage = this.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);

        let resetListener = gNoOpListener;

        let modifyListener = {
            itemCount: 0,
            onGetResult: function(calendar, status, itemType, detail, count, items) {},
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    storage.resetItemOfflineFlag(detail, resetListener);
                } else {
                    cal.ERROR("[calCachedCalendar] Could not modify item " + id + " - " + detail);
                }

                this.itemCount--;
                if (this.itemCount == 0) {
                    // All items have been pushed in and this is the last.
                    // Continue with deleted items.
                    this_.playbackDeletedItems(callbackFunc);
                }
            }
        };

        let getListener = {
            items: [],

            onGetResult: function(calendar, status, itemType, detail, count, items) {
                this.items = this.items.concat(items);
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (this_.offline) {
                    cal.LOG("[calCachedCalendar] Returning to offline mode, reconciliation aborted");
                    callbackFunc();
                } else {
                    cal.LOG("[calCachedCalendar] Modifying " + this.items.length + " items in " + this_.name);
                    if (this.items.length > 0) {
                        modifyListener.itemCount = this.items.length;
                        for each (let item in this.items) {
                            try {
                                if (this_.supportsChangeLog) {
                                    // The calendar supports the changelog functions, let it modify the item
                                    // TODO is it ok to not have the old item here? Pass null or the new item?
                                    this_.mUncachedCalendar.modifyItemOrUseCache(item, item, false, modifyListener);
                                } else {
                                    // Default strategy for providers not implementing calIChangeLog
                                    this_.mUncachedCalendar.modifyItem(item, null, modifyListener);
                                }
                            } catch (e) {
                                cal.ERROR("[calCachedCalendar] Could not playback modified item " + item.title + ": " + e);
                                modifyListener.onOperationComplete(thisCalendar,
                                                                   e.result,
                                                                   Components.interfaces.calIOperationListener.MODIFY,
                                                                   item.id,
                                                                   e.message);
                            }
                        }
                    } else {
                        this_.playbackDeletedItems(callbackFunc);
                    }
                }
                delete this.items;
            }
        };

        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_OFFLINE_MODIFIED | calICalendar.ITEM_FILTER_ALL_ITEMS,
                                      0, null, null, getListener);
    },

    playbackDeletedItems: function cCC_playbackDeletedItems(callbackFunc) {
        let this_ = this;
        let storage = this.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);

        let resetListener = this.gNoOpListener;

        let deleteListener = {
            itemCount: 0,
            onGetResult: function(calendar, status, itemType, detail, count, items) {},
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.deleteItem(detail, resetListener);
                    this.itemCount--;
                    if (this.itemCount == 0 && callbackFunc) {
                        callbackFunc();
                    }
                } else {
                    // TODO do something on error
                    cal.WARN("[calCachedCalendar] failed to playback deleted item " + id + " - " + detail);
                }
            }
        };

        let getListener = {
            items: [],

            onGetResult: function(calendar, status, itemType, detail, count, items) {
                this.items = this.items.concat(items);
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (this_.offline) {
                    cal.LOG("[calCachedCalendar] Returning to offline mode, reconciliation aborted");
                    callbackFunc();
                } else {
                    cal.LOG("[calCachedCalendar] Deleting "  + this.items.length + " items from " + this_.name);
                    if (this.items.length > 0) {
                        deleteListener.itemCount = this.items.length;
                        for each (let item in this.items) {
                            try {
                                if (this_.supportsChangeLog) {
                                    this_.mUncachedCalendar.deleteItemOrUseCache(item, false, deleteListener);
                                } else {
                                    // Default strategy for providers not implementing calIChangeLog
                                    this_.mUncachedCalendar.deleteItem(item, deleteListener);
                                }
                            } catch (e) {
                                cal.ERROR("[calCachedCalendar] Could not playback deleted item " + item.title + ": " + e);
                                deleteListener.onOperationComplete(thisCalendar,
                                                                   e.result,
                                                                   Components.interfaces.calIOperationListener.MODIFY,
                                                                   item.id,
                                                                   e.message);
                            }
                        }
                    } else if (callbackFunc) {
                        callbackFunc();
                    }
                }
                delete this.items;
            }
        };

        this.mCachedCalendar.getItems(calICalendar.ITEM_FILTER_OFFLINE_DELETED | calICalendar.ITEM_FILTER_ALL_ITEMS,
                                      0, null, null, getListener);
    },

    get superCalendar() {
        return this.mSuperCalendar && this.mSuperCalendar.superCalendar || this;
    },
    set superCalendar(val) {
        return (this.mSuperCalendar = val);
    },

    get offline() {
        return getIOService().offline;
    },
    get supportsChangeLog() {
        return calInstanceOf(this.mUncachedCalendar, Components.interfaces.calIChangeLog);
    },

    get canRefresh() { // enable triggering sync using the reload button
        return true;
    },
    refresh: function() {
        if (this.offline) {
            this.downstreamRefresh();
        }
        else {
            /* we first ensure that any remaining offline items are reconciled with the calendar server */
            let this_ = this;
            if (this.supportsChangeLog) {
                this.playbackAddedItems(this.downstreamRefresh.bind(this));
            } else {
                this.downstreamRefresh();
            }
        }
    },
    downstreamRefresh: function() {
        if (this.mUncachedCalendar.canRefresh && !this.offline) {
            return this.mUncachedCalendar.refresh(); // will trigger synchronize once the calendar is loaded
        } else {
            var this_ = this;
            return this.synchronize(
                function(status) { // fire completing onLoad for this refresh call
                    this_.mCachedObserver.onLoad(this_.mCachedCalendar);
                });
        }
    },

    addObserver: function(aObserver) {
        this.mObservers.add(aObserver);
    },
    removeObserver: function(aObserver) {
        this.mObservers.remove(aObserver);
    },

    addItem: function(item, listener) {
        return this.adoptItem(item.clone(), listener);
    },
    adoptItem: function(item, listener) {
        if (this.offline) {
            this.adoptOfflineItem(item, listener);
            return;
        }
        // Forwarding add/modify/delete to the cached calendar using the calIObserver
        // callbacks would be advantageous, because the uncached provider could implement
        // a true push mechanism firing without being triggered from within the program.
        // But this would mean the uncached provider fires on the passed
        // calIOperationListener, e.g. *before* it fires on calIObservers
        // (because that order is undefined). Firing onOperationComplete before onAddItem et al
        // would result in this facade firing onOperationComplete even though the modification
        // hasn't yet been performed on the cached calendar (which happens in onAddItem et al).
        // Result is that we currently stick to firing onOperationComplete if the cached calendar
        // has performed the modification, see below:
        var this_ = this;
        var opListener = {
            onGetResult: function(calendar, status, itemType, detail, count, items) {
                cal.ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status) && !this_.supportsChangeLog) {
                    this_.mCachedCalendar.addItem(detail, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        if (this.supportsChangeLog) {
            return this.mUncachedCalendar.addItemOrUseCache(item, true, opListener);
        }
        return this.mUncachedCalendar.adoptItem(item, opListener);
    },
    adoptOfflineItem: function(item, listener) {
        var this_ = this;
        var opListener = {
            onGetResult: function(calendar, status, itemType, detail, count, items) {
                cal.ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    var storage = this_.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);
                    storage.addOfflineItem(detail, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        };
        this.mCachedCalendar.adoptItem(item, opListener);
    },

    modifyItem: function(newItem, oldItem, listener) {
        if (this.offline) {
            this.modifyOfflineItem(newItem, oldItem, listener);
            return;
        }

        // Forwarding add/modify/delete to the cached calendar using the calIObserver
        // callbacks would be advantageous, because the uncached provider could implement
        // a true push mechanism firing without being triggered from within the program.
        // But this would mean the uncached provider fires on the passed
        // calIOperationListener, e.g. *before* it fires on calIObservers
        // (because that order is undefined). Firing onOperationComplete before onAddItem et al
        // would result in this facade firing onOperationComplete even though the modification
        // hasn't yet been performed on the cached calendar (which happens in onAddItem et al).
        // Result is that we currently stick to firing onOperationComplete if the cached calendar
        // has performed the modification, see below:
        var this_ = this;
        var opListener = {
            onGetResult: function(calendar, status, itemType, detail, count, items) {
                cal.ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.modifyItem(detail, oldItem, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        if (this.supportsChangeLog) {
            return this.mUncachedCalendar.modifyItemOrUseCache(newItem, oldItem, true, opListener);
        } else {
            return this.mUncachedCalendar.modifyItem(newItem, oldItem, opListener);
        }
    },
    modifyOfflineItem: function(newItem, oldItem, listener) {
        var this_ = this;
        var opListener = {
            onGetResult: function(calendar, status, itemType, detail, count, items) {
                cal.ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    var storage = this_.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);
                    storage.modifyOfflineItem(detail, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        };

        this.mCachedCalendar.modifyItem(newItem, oldItem, opListener);
    },

    deleteItem: function(item, listener) {
        if (this.offline) {
            this.deleteOfflineItem(item, listener);
            return;
        }
        // Forwarding add/modify/delete to the cached calendar using the calIObserver
        // callbacks would be advantageous, because the uncached provider could implement
        // a true push mechanism firing without being triggered from within the program.
        // But this would mean the uncached provider fires on the passed
        // calIOperationListener, e.g. *before* it fires on calIObservers
        // (because that order is undefined). Firing onOperationComplete before onAddItem et al
        // would result in this facade firing onOperationComplete even though the modification
        // hasn't yet been performed on the cached calendar (which happens in onAddItem et al).
        // Result is that we currently stick to firing onOperationComplete if the cached calendar
        // has performed the modification, see below:
        var this_ = this;
        var opListener = {
            onGetResult: function(calendar, status, itemType, detail, count, items) {
                cal.ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.deleteItem(item, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        if (this.supportsChangeLog) {
            return this.mUncachedCalendar.deleteItemOrUseCache(item, true, opListener);
        }
        return this.mUncachedCalendar.deleteItem(item, opListener);
    },
    deleteOfflineItem: function(item, listener) {
        /* We do not delete the item from the cache, as we will need it when reconciling the cache content and the server content. */
        var storage = this.mCachedCalendar.QueryInterface(Components.interfaces.calIOfflineStorage);
        storage.deleteOfflineItem(item, listener);
    }
};
(function() {
    function defineForwards(proto, targetName, functions, getters, gettersAndSetters) {
        function defineForwardGetter(attr) {
            proto.__defineGetter__(attr, function() { return this[targetName][attr]; });
        }
        function defineForwardGetterAndSetter(attr) {
            defineForwardGetter(attr);
            proto.__defineSetter__(attr, function(value) { return (this[targetName][attr] = value); });
        }
        function defineForwardFunction(funcName) {
            proto[funcName] = function() {
                var obj = this[targetName];
                return obj[funcName].apply(obj, arguments);
            };
        }
        functions.forEach(defineForwardFunction);
        getters.forEach(defineForwardGetter);
        gettersAndSetters.forEach(defineForwardGetterAndSetter);
    }

    defineForwards(calCachedCalendar.prototype, "mUncachedCalendar",
                   ["getProperty", "setProperty", "deleteProperty",
                    "isInvitation", "getInvitedAttendee", "canNotify"],
                   ["type", "aclManager", "aclEntry"],
                   ["id", "name", "uri", "readOnly"]);
    defineForwards(calCachedCalendar.prototype, "mCachedCalendar",
                   ["getItem", "getItems", "startBatch", "endBatch"], [], []);
})();
