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
            home.synchronize(
                function(status) {
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
    this.mObservers = new calListenerBag(Components.interfaces.calIObserver);
    uncachedCalendar.superCalendar = this;
    uncachedCalendar.addObserver(new calCachedCalendarObserverHelper(this, false));
    this.mUncachedCalendar = uncachedCalendar;
    this.setupCachedCalendar();

    if (this.supportsChangeLog) {
        var updateTimer = this.getProperty("cache.updateTimer");
        if (updateTimer === null) {
            updateTimer = 4; // override for changelog based providers
        }
        var timerCallback = {
            mCalendar: this,
            notify: function(timer) {
                LOG("[calCachedCalendar] replay timer");
                if (!this.mCalendar.getProperty("disabled")) {
                    this.mCalendar.refresh();
                }
            }
        };
        this.mReplayTimer = Components.classes["@mozilla.org/timer;1"]
                                      .createInstance(Components.interfaces.nsITimer);
        this.mReplayTimer.initWithCallback(timerCallback,
                                           updateTimer * 60 * 1000,
                                           Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
    }

    if (!this.getProperty("disabled")) {
        // Take care of the inital synchronization
        this.refresh();
    }
}
calCachedCalendar.prototype = {
    QueryInterface: function cCC_QueryInterface(aIID) {
        if (aIID.equals(Components.interfaces.calISchedulingSupport)) {
            // check whether uncached calendar supports it:
            if (this.mUncachedCalendar.QueryInterface(aIID)) {
                return this;
            }
        }
        return doQueryInterface(this, calCachedCalendar.prototype, aIID,
                                [Components.interfaces.calICachedCalendar,
                                 Components.interfaces.calICalendar,
                                 Components.interfaces.nsISupports]);
    },

    mCachedCalendar: null,
    mCachedObserver: null,
    mUncachedCalendar: null,
    mObservers: null,
    mSuperCalendar: null,
    mReplayTimer: null,

    onCalendarUnregistering: function() {
        if (this.mReplayTimer) {
            this.mReplayTimer.cancel();
            this.mReplayTimer = null;
        }
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
                var calType = getPrefSafe("calendar.cache.type", "storage");
                // While technically, the above deleteCalendar should delete the
                // whole calendar, this is nothing more than deleting all events
                // todos and properties. Therefore the initialization can be
                // skipped.
                cachedCalendar = Components.classes["@mozilla.org/calendar/calendar;1?type=" + calType]
                                           .createInstance(Components.interfaces.calICalendar);
                switch (calType) {
                    case "memory":
                        if (this.supportsChangeLog) {
                            // start with full sync:
                            this.mUncachedCalendar.resetLog();
                        }
                        break;
                    case "storage":
                        var file = getCalendarDirectory();
                        file.append("cache.sqlite");
                        var uri = getIOService().newFileURI(file);
                        uri.spec += ("?id=" + this.id);
                        cachedCalendar.uri = uri;
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

    mPendingSync: null,
    mSyncQueue: null,
    synchronize: function cCC_synchronize(respFunc) {
        this.mSyncQueue.push(respFunc);
        if (this.mSyncQueue.length > 1) { // don't use mPendingSync here
            LOG("[calCachedCalendar] sync in action/pending.");
            return this.mPendingSync;
        }

        var this_ = this;
        function emptyQueue(status) {
            var queue = this_.mSyncQueue;
            this_.mSyncQueue = [];
            function execResponseFunc(func) {
                try {
                    func(status);
                } catch (exc) {
                    ASSERT(false, exc);
                }
            }
            queue.forEach(execResponseFunc);
            LOG("[calCachedCalendar] sync queue empty.");
            var op = this_.mPendingSync;
            this_.mPendingSync = null;
            return op;
        }

        if (this.offline) {
            return emptyQueue(Components.results.NS_OK);
        }

        if (this.supportsChangeLog) {
            LOG("[calCachedCalendar] Doing changelog based sync for calendar " + this.uri.spec);
            var opListener = {
                onResult: function(op, result) {
                    if (!op || !op.isPending) {
                        var status = (op ? op.status : Components.results.NS_OK);
                        ASSERT(Components.isSuccessCode(status), "replay action failed: " + (op ? op.id : "<unknown>"));
                        LOG("[calCachedCalendar] replayChangesOn finished.");
                        emptyQueue(status);
                    }
                }
            };
            this.mPendingSync = this.mUncachedCalendar.replayChangesOn(this.mCachedCalendar, opListener);
            return this.mPendingSync;
        }

        LOG("[calCachedCalendar] Doing full sync for calendar " + this.uri.spec);
        // TODO put changes into a different calendar and delete
        // afterwards.
        var completeListener = {
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
                        this_.mCachedCalendar.addItem(item, null);
                    }
                }
            },

            onOperationComplete: function cCC_oOC_cL_onOperationComplete(aCalendar,
                                                                         aStatus,
                                                                         aOpType,
                                                                         aId,
                                                                         aDetail) {
                ASSERT(Components.isSuccessCode(aStatus), "getItems failed: " + aStatus);
                emptyQueue(aStatus);
            }
        };
        this.mPendingSync = this.mUncachedCalendar.getItems(Components.interfaces.calICalendar.ITEM_FILTER_ALL_ITEMS,
                                                            0, null,  null, completeListener);
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
            ASSERT(false, "unexpected!");
            if (listener) {
                listener.onOperationComplete(this, Components.interfaces.calIErrors.CAL_IS_READONLY,
                                             Components.interfaces.calIOperation.ADD, null, null);
            }
            return null;
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
                ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.addItem(detail, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        return this.mUncachedCalendar.adoptItem(item, opListener);
    },

    modifyItem: function(newItem, oldItem, listener) {
        if (this.offline) {
            ASSERT(false, "unexpected!");
            if (listener) {
                listener.onOperationComplete(this, Components.interfaces.calIErrors.CAL_IS_READONLY,
                                             Components.interfaces.calIOperation.MODIFY, null, null);
            }
            return null;
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
                ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.modifyItem(detail, oldItem, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        return this.mUncachedCalendar.modifyItem(newItem, oldItem, opListener);
    },

    deleteItem: function(item, listener) {
        if (this.offline) {
            ASSERT(false, "unexpected!");
            if (listener) {
                listener.onOperationComplete(this, Components.interfaces.calIErrors.CAL_IS_READONLY,
                                             Components.interfaces.calIOperation.DELETE, null, null);
            }
            return null;
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
                ASSERT(false, "unexpected!");
            },
            onOperationComplete: function(calendar, status, opType, id, detail) {
                if (Components.isSuccessCode(status)) {
                    this_.mCachedCalendar.deleteItem(item, listener);
                } else if (listener) {
                    listener.onOperationComplete(this_, status, opType, id, detail);
                }
            }
        }
        return this.mUncachedCalendar.deleteItem(item, opListener);
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
                   ["type"],
                   ["id", "name", "uri", "readOnly"]);
    defineForwards(calCachedCalendar.prototype, "mCachedCalendar",
                   ["getItem", "getItems", "startBatch", "endBatch"], [], []);
})();

