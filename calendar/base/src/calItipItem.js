/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Simdesk Technologies Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Clint Talbert <ctalbert.moz@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
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

/**
 * Constructor of calItipItem object
 */
function calItipItem() {
    this.wrappedJSObject = this;
    this.mCurrentItemIndex = 0;
}

calItipItem.prototype = {
    mIsInitialized: false,

    // nsIClassInfo:
    getInterfaces: function ciiGI(count) {
        var ifaces = [
            Components.interfaces.nsIClassInfo,
            Components.interfaces.nsISupports,
            Components.interfaces.calIItipItem
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function ciiGHFL(aLanguage) {
        return null;
    },

    contractID: "@mozilla.org/calendar/itip-item;1",
    classDescription: "Calendar iTIP item",
    classID: Components.ID("{f41392ab-dcad-4bad-818f-b3d1631c4d93}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function ciiQI(aIID) {
        return doQueryInterface(this, calItipItem.prototype, aIID, null, this);
    },

    mIsSend: false,
    get isSend() {
        return this.mIsSend;
    },
    set isSend(aValue) {
        return (this.mIsSend = aValue);
    },

    mReceivedMethod: "REQUEST",
    get receivedMethod() {
        return this.mReceivedMethod;
    },
    set receivedMethod(aMethod) {
        return (this.mReceivedMethod = aMethod.toUpperCase());
    },

    mResponseMethod: "REPLY",
    get responseMethod() {
        if (!this.mIsInitialized) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        return this.mResponseMethod;
    },
    set responseMethod(aMethod) {
        return (this.mResponseMethod = aMethod.toUpperCase());
    },

    mAutoResponse: null,
    get autoResponse() {
        return this.mAutoResponse;
    },
    set autoResponse(aValue) {
        return (this.mAutoResponse = aValue);
    },

    mTargetCalendar: null,
    get targetCalendar() {
        return this.mTargetCalendar;
    },
    set targetCalendar(aValue) {
        return (this.mTargetCalendar = aValue);
    },

    mIdentity: null,
    get identity() {
        return this.mIdentity;
    },
    set identity(aValue) {
        return (this.mIdentity = aValue);
    },

    mLocalStatus: null,
    get localStatus() {
        return this.mLocalStatus;
    },
    set localStatus(aValue) {
        return (this.mLocalStatus = aValue);
     },

    mItemList: {},

    init: function ciiI(aIcalString) {
        let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                               .createInstance(Components.interfaces.calIIcsParser);
        parser.parseString(aIcalString, null);

        // - User specific alarms as well as X-MOZ- properties are irrelevant w.r.t. iTIP messages,
        //   should not be sent out and should not be relevant for incoming messages
        // - faked master items
        // so clean them out:

        function cleanItem(item) {
            // the following changes will bump LAST-MODIFIED/DTSTAMP, we want to preserve the originals:
            let stamp = item.stampTime;
            let lastModified = item.lastModifiedTime;
            item.alarmOffset = null;
            item.alarmLastAck = null;
            item.deleteProperty("RECEIVED-SEQUENCE");
            item.deleteProperty("RECEIVED-DTSTAMP");
            let propEnum = item.propertyEnumerator;
            while (propEnum.hasMoreElements()) {
                let prop = propEnum.getNext().QueryInterface(Components.interfaces.nsIProperty);
                let pname = prop.name;
                if (pname != "X-MOZ-FAKED-MASTER" && pname.substr(0, "X-MOZ-".length) == "X-MOZ-") {
                    item.deleteProperty(prop.name);
                }
            }
            // never publish an organizer's RECEIVED params:
            item.getAttendees({}).forEach(
                function(att) {
                    att.deleteProperty("RECEIVED-SEQUENCE");
                    att.deleteProperty("RECEIVED-DTSTAMP");
                });
            item.setProperty("DTSTAMP", stamp);
            item.setProperty("LAST-MODIFIED", lastModified); // need to be last to undirty the item
        }

        this.mItemList = [];
        for each (let item in cal.itemIterator(parser.getItems({}))) {
            cleanItem(item);
            // only push non-faked master items or
            // the overridden instances of faked master items
            // to the list:
            if (item == item.parentItem) {
                if (!item.hasProperty("X-MOZ-FAKED-MASTER")) {
                    this.mItemList.push(item);
                }
            } else if (item.parentItem.hasProperty("X-MOZ-FAKED-MASTER")) {
                this.mItemList.push(item);
            }
        }

        // We set both methods now for safety's sake. It's the ItipProcessor's
        // responsibility to properly ascertain what the correct response
        // method is (using user feedback, prefs, etc.) for the given
        // receivedMethod.  The RFC tells us to treat items without a METHOD
        // as if they were METHOD:REQUEST.
        for each (var prop in parser.getProperties({})) {
            if (prop.propertyName == "METHOD") {
                this.mReceivedMethod = prop.value;
                this.mResponseMethod = prop.value;
                break;
            }
        }

        this.mIsInitialized = true;
    },

    clone: function ciiC() {
        let newItem = new calItipItem();
        newItem.mItemList = this.mItemList.map(function(item) { return item.clone(); });
        newItem.mReceivedMethod = this.mReceivedMethod;
        newItem.mResponseMethod = this.mResponseMethod;
        newItem.mAutoResponse = this.mAutoResponse;
        newItem.mTargetCalendar = this.mTargetCalendar;
        newItem.mIdentity = this.mIdentity;
        newItem.mLocalStatus = this.mLocalStatus;
        newItem.mIsSend = this.mIsSend;
        newItem.mIsInitialized = this.mIsInitialized;
        return newItem;
    },

    /**
     * This returns both the array and the number of items. An easy way to
     * call it is: var itemArray = itipItem.getItemList({ });
     */
    getItemList: function ciiGIL(itemCountRef) {
        if (!this.mIsInitialized) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        itemCountRef.value = this.mItemList.length;
        return this.mItemList;
    },

    /**
     * Note that this code forces the user to respond to all items in the same
     * way, which is a current limitation of the spec.
     */
    setAttendeeStatus: function ciiSAS(aAttendeeId, aStatus) {
        // Append "mailto:" to the attendee if it is missing it.
        aAttendeeId = aAttendeeId.toLowerCase();
        if (!aAttendeeId.match(/^mailto:/i)) {
            aAttendeeId = ("mailto:" + aAttendeeId);
        }

        for each (var item in this.mItemList) {
            var attendee = item.getAttendeeById(aAttendeeId);
            if (attendee) {
                // Replies should not have the RSVP property.
                // XXX BUG 351589: workaround for updating an attendee
                item.removeAttendee(attendee);
                attendee = attendee.clone();
                attendee.rsvp = null;
                item.addAttendee(attendee);
            }
        }
    }
};
