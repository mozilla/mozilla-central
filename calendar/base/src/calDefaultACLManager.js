/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/* calDefaultACLManager */
function calDefaultACLManager() {
    this.mCalendarEntries = {};
}

const calDefaultACLManagerClassID = Components.ID("{7463258c-6ef3-40a2-89a9-bb349596e927}");
const calDefaultACLManagerInterfaces = [Components.interfaces.calICalendarACLManager];
calDefaultACLManager.prototype = {
    mCalendarEntries: null,

    /* nsISupports, nsIClassInfo */
    classID: calDefaultACLManagerClassID,
    QueryInterface: XPCOMUtils.generateQI(calDefaultACLManagerInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calDefaultACLManagerClassID,
        contractID: "@mozilla.org/calendar/acl-manager;1?type=default",
        classDescription: "Default Calendar ACL Provider",
        interfaces: calDefaultACLManagerInterfaces,
        flags: Components.interfaces.nsIClassInfo.SINGLETON
    }),

    /* calICalendarACLManager */
    _getCalendarEntryCached: function cDACLM__getCalendarEntryCached(aCalendar) {
        let calUri = aCalendar.uri.spec;
        if (!(calUri in this.mCalendarEntries)) {
            this.mCalendarEntries[calUri] = new calDefaultCalendarACLEntry(this, aCalendar);
        }

        return this.mCalendarEntries[calUri];
    },
    getCalendarEntry: function cDACLM_getCalendarEntry(aCalendar, aListener) {
        let entry = this._getCalendarEntryCached(aCalendar);
        aListener.onOperationComplete(aCalendar, Components.results.NS_OK,
                                      Components.interfaces.calIOperationListener.GET,
                                      null,
                                      entry);
    },
    getItemEntry: function cDACLM_getItemEntry(aItem) {
        let calEntry = this._getCalendarEntryCached(aItem.calendar);
        return new calDefaultItemACLEntry(calEntry);
    },

};

function calDefaultCalendarACLEntry(aMgr, aCalendar) {
    this.mACLManager = aMgr;
    this.mCalendar = aCalendar;
}

calDefaultCalendarACLEntry.prototype = {
    mACLManager: null,

    /* nsISupports */
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calICalendarACLEntry]),

    /* calICalendarACLCalendarEntry */
    get aclManager() {
        return this.mACLManager;
    },

    hasAccessControl: false,
    userIsOwner: true,
    userCanAddItems: true,
    userCanDeleteItems: true,

    _getIdentities: function calDefaultCalendarACLEntry_getUserAddresses(aCount) {
        let identities = [];
        cal.calIterateEmailIdentities(function (id, ac) { identities.push(id); });
        aCount.value = identities.length;
        return identities;
    },

    getUserAddresses: function calDefaultCalendarACLEntry_getUserAddresses(aCount) {
        let identities = this.getUserIdentities(aCount);
        let addresses = [ id.email for each (id in identities) ];
        return addresses;
    },

    getUserIdentities: function calDefaultCalendarACLEntry_getUserIdentities(aCount) {
        let identity = cal.getEmailIdentityOfCalendar(this.mCalendar);
        if (identity) {
            aCount.value = 1;
            return [identity];
        } else {
            return this._getIdentities(aCount);
        }
    },
    getOwnerIdentities: function calDefaultCalendarACLEntry_getOwnerIdentities(aCount) {
        return this._getIdentities(aCount);
    },

    refresh: function calDefaultCalendarACLEntry_refresh() {
    }
};

function calDefaultItemACLEntry(aCalendarEntry) {
    this.calendarEntry = aCalendarEntry;
};

calDefaultItemACLEntry.prototype = {
    /* nsISupports */
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIItemACLEntry]),

    /* calIItemACLEntry */
    calendarEntry: null,
    userCanModify: true,
    userCanRespond: true,
    userCanViewAll: true,
    userCanViewDateAndTime: true,
};

/** Module Registration */
var NSGetFactory = XPCOMUtils.generateNSGetFactory([calDefaultACLManager]);
