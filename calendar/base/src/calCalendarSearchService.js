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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
calCalendarSearchService.prototype = {
    mProviders: null,

    QueryInterface: function calCalendarSearchService_QueryInterface(aIID) {
        return doQueryInterface(this, calCalendarSearchService.prototype, aIID, null, this);
    },

    // nsIClassInfo:
    getInterfaces: function calCalendarSearchService_getInterfaces(count) {
        const ifaces = [Components.interfaces.nsISupports,
                        Components.interfaces.calICalendarSearchProvider,
                        Components.interfaces.calICalendarSearchService,
                        Components.interfaces.nsIClassInfo];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function calCalendarSearchService_getHelperForLanguage(language) {
        return null;
    },
    contractID: "@mozilla.org/calendar/calendarsearch-service;1",
    classDescription: "Calendar Search Service",
    classID: Components.ID("{F5F743CD-8997-428e-BC1B-644E73F61203}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

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
