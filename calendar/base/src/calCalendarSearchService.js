/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function calCalendarSearchListener(numOperations, finalListener) {
    this.mFinalListener = finalListener;
    this.mNumOperations = numOperations;
    this.mResults = [];

    var this_ = this;
    function cancelFunc() { // operation group has been cancelled
        this_.notifyResult(null);
    }
    this.opGroup = new calOperationGroup(cancelFunc);
}
calCalendarSearchListener.prototype = {
    mFinalListener: null,
    mNumOperations: 0,
    opGroup: null,

    notifyResult: function calCalendarSearchListener_notifyResult(result) {
        var listener = this.mFinalListener
        if (listener) {
            if (!this.opGroup.isPending) {
                this.mFinalListener = null;
            }
            listener.onResult(this.opGroup, result);
        }
    },

    // calIGenericOperationListener:
    onResult: function calCalendarSearchListener_onResult(aOperation, aResult) {
        if (this.mFinalListener) {
            if (!aOperation || !aOperation.isPending) {
                --this.mNumOperations;
                if (this.mNumOperations == 0) {
                    this.opGroup.notifyCompleted();
                }
            }
            if (aResult) {
                this.notifyResult(aResult);
            }
        }
    }
};

function calCalendarSearchService() {
    this.wrappedJSObject = this;
    this.mProviders = new calInterfaceBag(Components.interfaces.calICalendarSearchProvider);
}
const calCalendarSearchServiceClassID = Components.ID("{f5f743cd-8997-428e-bc1b-644e73f61203}");
const calCalendarSearchServiceInterfaces = [
    Components.interfaces.calICalendarSearchProvider,
    Components.interfaces.calICalendarSearchService
];
calCalendarSearchService.prototype = {
    mProviders: null,

    classID: calCalendarSearchServiceClassID,
    QueryInterface: XPCOMUtils.generateQI(calCalendarSearchServiceInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calCalendarSearchServiceClassID,
        contractID: "@mozilla.org/calendar/calendarsearch-service;1",
        classDescription: "Calendar Search Service",
        interfaces: calCalendarSearchServiceInterfaces,
        flags: Components.interfaces.nsIClassInfo.SINGLETON
    }),

    // calICalendarSearchProvider:
    searchForCalendars: function calCalendarSearchService_searchForCalendars(aString,
                                                                             aHints,
                                                                             aMaxResults,
                                                                             aListener) {
        var groupListener = new calCalendarSearchListener(this.mProviders.size, aListener);
        function searchForCalendars_(provider) {
            try {
                groupListener.opGroup.add(provider.searchForCalendars(aString,
                                                                      aHints,
                                                                      aMaxResults,
                                                                      groupListener));
            } catch (exc) {
                Components.utils.reportError(exc);
                groupListener.onResult(null, []); // dummy to adopt mNumOperations
            }
        }
        this.mProviders.forEach(searchForCalendars_);
        return groupListener.opGroup;
    },

    // calICalendarSearchService:
    getProviders: function calCalendarSearchService_getProviders(out_aCount) {
        var ret = this.mProviders.interfaceArray;
        out_aCount.value = ret.length;
        return ret;
    },
    addProvider: function calCalendarSearchService_addProvider(aProvider) {
        this.mProviders.add(aProvider);
    },
    removeProvider: function calCalendarSearchService_removeProvider(aProvider) {
        this.mProviders.remove(aProvider);
    }
};
