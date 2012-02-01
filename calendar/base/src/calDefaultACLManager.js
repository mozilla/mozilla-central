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
 * The Original Code is Inverse inc. code.
 *
 * The Initial Developer of the Original Code is
 *  Wolfgang Sourdeau  <wsourdeau@inverse.ca>
 * Portions created by the Initial Developer are
 *  Copyright (C) 2008-2011 Inverse inc. All Rights Reserved.
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/* calDefaultACLManager */
function calDefaultACLManager() {
    this.mCalendarEntries = {};
}

calDefaultACLManager.prototype = {
    mCalendarEntries: null,

    /* nsISupports */
    classID: Components.ID("{7463258c-6ef3-40a2-89a9-bb349596e927}"),
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calICalendarACLManager]),

    /* nsIClassInfo */
    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{7463258c-6ef3-40a2-89a9-bb349596e927}"),
        contractID: "@mozilla.org/calendar/acl-manager;1?type=default",
        classDescription: "Default Calendar ACL Provider",
        interfaces: [Components.interfaces.calICalendarACLManager],
        flags: Components.interfaces.nsIClassInfo.SINGLETON,
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
