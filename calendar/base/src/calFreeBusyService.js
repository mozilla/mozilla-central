/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function calFreeBusyListener(numOperations, finalListener) {
    this.mFinalListener = finalListener;
    this.mNumOperations = numOperations;

    var this_ = this;
    function cancelFunc() { // operation group has been cancelled
        this_.notifyResult(null);
    }
    this.opGroup = new calOperationGroup(cancelFunc);
}
calFreeBusyListener.prototype = {
    mFinalListener: null,
    mNumOperations: 0,
    opGroup: null,

    notifyResult: function calFreeBusyListener_notifyResult(result) {
        var listener = this.mFinalListener
        if (listener) {
            if (!this.opGroup.isPending) {
                this.mFinalListener = null;
            }
            listener.onResult(this.opGroup, result);
        }
    },

    // calIGenericOperationListener:
    onResult: function calFreeBusyListener_onResult(aOperation, aResult) {
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

function calFreeBusyService() {
    this.wrappedJSObject = this;
    this.mProviders = new calInterfaceBag(Components.interfaces.calIFreeBusyProvider);
}
calFreeBusyService.prototype = {
    mProviders: null,

    QueryInterface: function calFreeBusyService_QueryInterface(aIID) {
        return doQueryInterface(this, calFreeBusyService.prototype, aIID, null, this);
    },

    // nsIClassInfo:
    getInterfaces: function calFreeBusyService_getInterfaces(count) {
        const ifaces = [Components.interfaces.nsISupports,
                        Components.interfaces.calIFreeBusyProvider,
                        Components.interfaces.calIFreeBusyService,
                        Components.interfaces.nsIClassInfo];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function calFreeBusyService_getHelperForLanguage(language) {
        return null;
    },
    contractID: "@mozilla.org/calendar/freebusy-service;1",
    classDescription: "Calendar FreeBusy Service",
    classID: Components.ID("{29c56cd5-d36e-453a-acde-0083bd4fe6d3}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    // calIFreeBusyProvider:
    getFreeBusyIntervals: function calFreeBusyService_getFreeBusyIntervals(aCalId,
                                                                           aRangeStart,
                                                                           aRangeEnd,
                                                                           aBusyTypes,
                                                                           aListener) {
        var groupListener = new calFreeBusyListener(this.mProviders.size, aListener);
        function getFreeBusyIntervals_(provider) {
            try {
                groupListener.opGroup.add(provider.getFreeBusyIntervals(aCalId,
                                                                        aRangeStart,
                                                                        aRangeEnd,
                                                                        aBusyTypes,
                                                                        groupListener));
            } catch (exc) {
                Components.utils.reportError(exc);
                groupListener.onResult(null, []); // dummy to adopt mNumOperations
            }
        }
        this.mProviders.forEach(getFreeBusyIntervals_);
        return groupListener.opGroup;
    },

    // calIFreeBusyService:
    addProvider: function calFreeBusyListener_addProvider(aProvider) {
        this.mProviders.add(aProvider);
    },
    removeProvider: function calFreeBusyListener_removeProvider(aProvider) {
        this.mProviders.remove(aProvider);
    }
};
