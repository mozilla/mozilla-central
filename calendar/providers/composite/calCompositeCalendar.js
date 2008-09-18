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
// calCompositeCalendar.js
//

const calIOperationListener = Components.interfaces.calIOperationListener;

function calCompositeCalendarObserverHelper (compCalendar) {
    this.compCalendar = compCalendar;
    this.pendingLoads = {};
}

calCompositeCalendarObserverHelper.prototype = {
    pendingLoads: null,

    onStartBatch: function() {
        this.compCalendar.mObservers.notify("onStartBatch");
    },

    onEndBatch: function() {
        this.compCalendar.mObservers.notify("onEndBatch");
    },

    onLoad: function(calendar) {
        // avoid unnecessary onLoad events:
        if (this.pendingLoads[calendar.id]) {
            // don't forward if caused by composite:
            delete this.pendingLoads[calendar.id];
        } else {
            // any refreshed dependent calendar logically refreshes
            // this composite calendar, thus we send out an onLoad
            // for this composite calendar:
            this.compCalendar.mObservers.notify("onLoad", [this.compCalendar]);
        }
    },

    onAddItem: function(aItem) {
        this.compCalendar.mObservers.notify("onAddItem", arguments);
    },

    onModifyItem: function(aNewItem, aOldItem) {
        this.compCalendar.mObservers.notify("onModifyItem", arguments);
    },

    onDeleteItem: function(aDeletedItem) {
        this.compCalendar.mObservers.notify("onDeleteItem", arguments);
    },

    onError: function(aCalendar, aErrNo, aMessage) {
        this.compCalendar.mObservers.notify("onError", arguments);
    },

    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
        this.compCalendar.mObservers.notify("onPropertyChanged", arguments);
    },

    onPropertyDeleting: function(aCalendar, aName) {
        this.compCalendar.mObservers.notify("onPropertyDeleting", arguments);
    }
};

function calCompositeCalendar () {
    this.mObserverHelper = new calCompositeCalendarObserverHelper(this);
    this.wrappedJSObject = this;

    this.mCalendars = new Array();
    this.mCompositeObservers = new calListenerBag(Components.interfaces.calICompositeObserver);
    this.mObservers = new calListenerBag(Components.interfaces.calIObserver);
    this.mDefaultCalendar = null;
    this.mStatusObserver = null;
}

calCompositeCalendar.prototype = {
    //
    // private members
    //
    mDefaultCalendar: null,

    //
    // nsISupports interface
    //
    QueryInterface: function (aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calICalendarProvider) &&
            !aIID.equals(Components.interfaces.calICalendar) &&
            !aIID.equals(Components.interfaces.calICompositeCalendar))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay() {
        return null;
    },

    get displayName() {
        return calGetString("calendar", "compositeName");
    },

    createCalendar: function comp_createCal() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function comp_deleteCal(cal, listener) {
        // You shouldn't be able to delete from the composite calendar.
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    //
    // calICompositeCalendar interface
    //

    mCalendars: null,
    mDefaultCalendar: null,
    mPrefPrefix: null,
    mDefaultPref: null,
    mActivePref: null,

    get enabledCalendars() {
      return this.mCalendars.filter(
        function(e) { return !e.getProperty("disabled"); }
      );
    },

    set prefPrefix (aPrefPrefix) {
        if (this.mPrefPrefix) {
            this.mCalendars.forEach(this.removeCalendar, this);
        }
        this.mPrefPrefix = aPrefPrefix;
        this.mActivePref = aPrefPrefix + "-in-composite";
        this.mDefaultPref = aPrefPrefix + "-default";
        var mgr = getCalendarManager();
        var cals = mgr.getCalendars({});

        cals.forEach(function (c) {
            if (c.getProperty(this.mActivePref))
                this.addCalendar(c);
            if (c.getProperty(this.mDefaultPref))
                this.setDefaultCalendar(c, false);
        }, this);
    },

    get prefPrefix () {
        return this.mPrefPrefix;
    },

    addCalendar: function (aCalendar) {
        // check if the calendar already exists
        for each (cal in this.mCalendars) {
            if (aCalendar.uri.equals(cal.uri)) {
                // throw exception if calendar already exists?
                return;
            }
        }

        // add our observer helper
        aCalendar.addObserver(this.mObserverHelper); // XXX Never removed!

        this.mCalendars.push(aCalendar);
        if (this.mPrefPrefix) {
            aCalendar.setProperty(this.mActivePref, true);
        }
        this.mCompositeObservers.notify("onCalendarAdded", [aCalendar]);

        // if we have no default calendar, we need one here
        if (this.mDefaultCalendar == null && !aCalendar.getProperty("disabled")) {
            this.setDefaultCalendar(aCalendar, false);
        }
    },

    removeCalendar: function (aServer) {
        var newCalendars = Array();
        var calToRemove = null;
        for each (cal in this.mCalendars) {
            if (!aServer.equals(cal.uri))
                newCalendars.push(cal);
            else
                calToRemove = cal;
        }

        if (calToRemove) {
            this.mCalendars = newCalendars;
            if (this.mPrefPrefix) {
                calToRemove.deleteProperty(this.mActivePref);
                calToRemove.deleteProperty(this.mDefaultPref);
            }
            calToRemove.removeObserver(this.mObserverHelper);
            this.mCompositeObservers.notify("onCalendarRemoved", [calToRemove]);
        }
    },

    getCalendar: function (aServer) {
        for each (cal in this.mCalendars) {
            if (aServer.equals(cal.uri))
                return cal;
        }

        return null;
    },

    getCalendars: function getCalendars(count) {
        count.value = this.mCalendars.length;
        return this.mCalendars;
    },

    get defaultCalendar cCC_get_defaultCalendar() {
        return this.mDefaultCalendar;
    },

    setDefaultCalendar: function (cal, usePref) {
        // Don't do anything if the passed calendar is the default calendar
        if (cal && this.mDefaultCalendar && this.mDefaultCalendar.id == cal.id) {
            return;
        }
        if (usePref && this.mPrefPrefix) {
            if (this.mDefaultCalendar) {
                this.mDefaultCalendar.deleteProperty(this.mDefaultPref);
            }
            // if not null set the new calendar as default in the preferences
            if (cal)  {
                cal.setProperty(this.mDefaultPref, true);
            }
        }
        this.mDefaultCalendar = cal;
        this.mCompositeObservers.notify("onDefaultCalendarChanged", [cal]);
    },

    set defaultCalendar(v) {
        this.setDefaultCalendar(v, true);
    },

    //
    // calICalendar interface
    //
    // Write operations here are forwarded to either the item's
    // parent calendar, or to the default calendar if one is set.
    // Get operations are sent to each calendar.
    //

    get id() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set id(id) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get superCalendar() {
        // There shouldn't be a superCalendar for the composite
        return this;
    },
    set superCalendar(val) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    // this could, at some point, return some kind of URI identifying
    // all the child calendars, thus letting us create nifty calendar
    // trees.
    get uri() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set uri(v) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get readOnly() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set readOnly(bool) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get canRefresh() {
        return true;
    },

    get name() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set name(v) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get type() {
        return "composite";
    },

    getProperty: function(aName) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    setProperty: function(aName, aValue) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    deleteProperty: function(aName) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    // void addObserver( in calIObserver observer );
    mCompositeObservers: null,
    mObservers: null,
    addObserver: function (aObserver) {
        if (calInstanceOf(aObserver, Components.interfaces.calICompositeObserver)) {
            this.mCompositeObservers.add(aObserver);
        }
        this.mObservers.add(aObserver);
    },

    // void removeObserver( in calIObserver observer );
    removeObserver: function (aObserver) {
        if (calInstanceOf(aObserver, Components.interfaces.calICompositeObserver)) {
            this.mCompositeObservers.remove(aObserver);
        }
        this.mObservers.remove(aObserver);
    },

    refresh: function cCC_refresh() {
        if (this.mStatusObserver) {
            this.mStatusObserver.startMeteors(Components.interfaces.calIStatusObserver.DETERMINED_PROGRESS, this.mCalendars.length);
        }
        for each (cal in this.enabledCalendars) {
            try {
                if (cal.canRefresh) {
                    this.mObserverHelper.pendingLoads[cal.id] = true;
                    cal.refresh();
                }
            } catch (e) {
                ASSERT(false, e);
                delete this.mObserverHelper.pendingLoads[cal.id];
            }
        }
        // send out a single onLoad for this composite calendar,
        // although e.g. the ics provider will trigger another
        // onLoad asynchronously; we cannot rely on every calendar
        // sending an onLoad:
        this.mObservers.notify("onLoad", [this]);
    },

    // void modifyItem( in calIItemBase aNewItem, in calIItemBase aOldItem, in calIOperationListener aListener );
    modifyItem: function (aNewItem, aOldItem, aListener) {
        ASSERT(aNewItem.calendar, "Composite can't modify item with null calendar", true);
        ASSERT(aNewItem.calendar != this, "Composite can't modify item with this calendar", true);

        return aNewItem.calendar.modifyItem(aNewItem, aOldItem, aListener);
    },

    // void deleteItem( in string id, in calIOperationListener aListener );
    deleteItem: function (aItem, aListener) {
        ASSERT(aItem.calendar, "Composite can't delete item with null calendar", true);
        ASSERT(aItem.calendar != this, "Composite can't delete item with this calendar", true);

        return aItem.calendar.deleteItem(aItem, aListener);
    },

    // void addItem( in calIItemBase aItem, in calIOperationListener aListener );
    addItem: function (aItem, aListener) {
        return this.mDefaultCalendar.addItem(aItem, aListener);
    },

    // void getItem( in string aId, in calIOperationListener aListener );
    getItem: function (aId, aListener) {
        var enabledCalendars = this.enabledCalendars;
        var cmpListener = new calCompositeGetListenerHelper(this, aListener);
        for each (cal in enabledCalendars) {
            try {
                cmpListener.opGroup.add(cal.getItem(aId, cmpListener));
            } catch (exc) {
                ASSERT(false, exc);
            }
        }
        return cmpListener.opGroup;
    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function (aItemFilter, aCount, aRangeStart, aRangeEnd, aListener) {
        // If there are no calendars, then we just call onOperationComplete
        var enabledCalendars = this.enabledCalendars;
        if (enabledCalendars.length == 0) {
            aListener.onOperationComplete (this,
                                           Components.results.NS_OK,
                                           calIOperationListener.GET,
                                           null,
                                           null);
            return;
        }
        if (this.mStatusObserver) {
            if (this.mStatusObserver.spinning == Components.interfaces.calIStatusObserver.NO_PROGRESS) {
                this.mStatusObserver.startMeteors(Components.interfaces.calIStatusObserver.UNDETERMINED_PROGRESS, -1);
            }
        }
        var cmpListener = new calCompositeGetListenerHelper(this, aListener, aCount);

        for each (var cal in enabledCalendars) {
            try {
                cmpListener.opGroup.add(cal.getItems(aItemFilter,
                                                     aCount,
                                                     aRangeStart,
                                                     aRangeEnd,
                                                     cmpListener));
            } catch (exc) {
                ASSERT(false, exc);
            }
        }
        return cmpListener.opGroup;
    },

    startBatch: function () {
        this.mCompositeObservers.notify("onStartBatch");
    },
    endBatch: function () {
        this.mCompositeObservers.notify("onEndBatch");
    },

    get statusDisplayed() {
        if (!this.mStatusObserver){
            return false;
        } else {
            return this.mStatusObserver.spinning != Components.interfaces.calIStatusObserver.NO_PROGRESS;
        }
    },

    setStatusObserver: function(aStatusObserver, aWindow){
        this.mStatusObserver = aStatusObserver;
        if (this.mStatusObserver) {
            this.mStatusObserver.initialize(aWindow);
        }
    }
};

// composite listener helper
function calCompositeGetListenerHelper(aCompositeCalendar, aRealListener, aMaxItems) {
    this.wrappedJSObject = this;
    this.mCompositeCalendar = aCompositeCalendar;
    this.mNumQueries = aCompositeCalendar.enabledCalendars.length;
    this.mRealListener = aRealListener;
    this.mMaxItems = aMaxItems;
}

calCompositeGetListenerHelper.prototype = {
    mNumQueries: 0,
    mRealListener: null,
    mOpGroup: null,
    mReceivedCompletes: 0,
    mFinished: false,
    mMaxItems: 0,
    mItemsReceived: 0,

    get opGroup() {
        if (!this.mOpGroup) {
            var this_ = this;
            function cancelFunc() { // operation group has been cancelled
                var listener = this_.mRealListener;
                this_.mRealListener = null;
                if (listener) {
                    listener.onOperationComplete(
                        this_, Components.interfaces.calIErrors.OPERATION_CANCELLED,
                        calIOperationListener.GET, null, null);
                    if (this_.mCompositeCalendar.statusDisplayed) {
                        this_.mCompositeCalendar.mStatusObserver.stopMeteors();
                    }
                }
            }
            this.mOpGroup = new calOperationGroup(cancelFunc);
        }
        return this.mOpGroup;
    },

    QueryInterface: function (aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calIOperationListener))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    onOperationComplete: function (aCalendar, aStatus, aOperationType, aId, aDetail) {
        if (!this.mRealListener) {
            // has been cancelled, ignore any providers firing on this...
            return;
        }
        if (this.mFinished) {
            dump ("+++ calCompositeGetListenerHelper.onOperationComplete: called with mFinished == true!");
            return;
        }
        if (this.mCompositeCalendar.statusDisplayed) {
            this.mCompositeCalendar.mStatusObserver.calendarCompleted(aCalendar);
        }
        if (!Components.isSuccessCode(aStatus)) {
            // proxy this to a onGetResult
            // XXX - do we want to give the real calendar? or this?
            // XXX - get rid of iid param
            this.mRealListener.onGetResult(aCalendar, aStatus,
                                           Components.interfaces.nsISupports,
                                           aDetail, 0, []);
        }

        this.mReceivedCompletes++;
        if (this.mReceivedCompletes == this.mNumQueries) {
            if (this.mCompositeCalendar.statusDisplayed) {
                this.mCompositeCalendar.mStatusObserver.stopMeteors();
            }
            // we're done here.
            this.mFinished = true;
            this.opGroup.notifyCompleted();
            this.mRealListener.onOperationComplete (this,
                                                    aStatus,
                                                    calIOperationListener.GET,
                                                    null,
                                                    null);
        }
    },

    onGetResult: function (aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
        if (!this.mRealListener) {
            // has been cancelled, ignore any providers firing on this...
            return;
        }
        if (this.mFinished) {
            dump ("+++ calCompositeGetListenerHelper.onGetResult: called with mFinished == true!");
            return;
        }

        // ignore if we have a max and we're past it
        if (this.mMaxItems && this.mItemsReceived >= this.mMaxItems)
            return;

        if (Components.isSuccessCode(aStatus) &&
            this.mMaxItems &&
            ((this.mItemsReceived + aCount) > this.mMaxItems))
        {
            // this will blow past the limit
            aCount = this.mMaxItems - this.mItemsReceived;
            aItems = aItems.slice(0, aCount);
        }

        // send GetResults to the real listener
        this.mRealListener.onGetResult (aCalendar, aStatus, aItemType, aDetail, aCount, aItems);
        this.mItemsReceived += aCount;
    }

};

// nsIFactory
const calCompositeCalendarFactory = {
    createInstance: function (outer, iid) {
        if (outer != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
        return (new calCompositeCalendar()).QueryInterface(iid);
    }
};

/****
 **** module registration
 ****/

var calCompositeCalendarModule = {
    mCID: Components.ID("{aeff788d-63b0-4996-91fb-40a7654c6224}"),
    mContractID: "@mozilla.org/calendar/calendar;1?type=composite",

    mUtilsLoaded: false,
    loadUtils: function compositeLoadUtils() {
        if (this.mUtilsLoaded)
            return;

        const jssslContractID = "@mozilla.org/moz/jssubscript-loader;1";
        const jssslIID = Components.interfaces.mozIJSSubScriptLoader;

        const iosvcContractID = "@mozilla.org/network/io-service;1";
        const iosvcIID = Components.interfaces.nsIIOService;

        var loader = Components.classes[jssslContractID].getService(jssslIID);
        var iosvc = Components.classes[iosvcContractID].getService(iosvcIID);

        // Note that unintuitively, __LOCATION__.parent == .
        // We expect to find utils in ./../js
        var appdir = __LOCATION__.parent.parent;
        appdir.append("js");
        var scriptName = "calUtils.js";

        var f = appdir.clone();
        f.append(scriptName);

        try {
            var fileurl = iosvc.newFileURI(f);
            loader.loadSubScript(fileurl.spec, this.__parent__.__parent__);
        } catch (e) {
            dump("Error while loading " + fileurl.spec + "\n");
            throw e;
        }

        this.mUtilsLoaded = true;
    },

    registerSelf: function (compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(this.mCID,
                                        "Calendar composite provider",
                                        this.mContractID,
                                        fileSpec,
                                        location,
                                        type);
    },

    getClassObject: function (compMgr, cid, iid) {
        if (!cid.equals(this.mCID))
            throw Components.results.NS_ERROR_NO_INTERFACE;

        if (!iid.equals(Components.interfaces.nsIFactory))
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

        this.loadUtils();

        return calCompositeCalendarFactory;
    },

    canUnload: function(compMgr) {
        return true;
    }
};

function NSGetModule(compMgr, fileSpec) {
    return calCompositeCalendarModule;
}
