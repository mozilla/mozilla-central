/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Constructor of calItipItem object
 */
function calItipItem() {
    this.wrappedJSObject = this;
    this.mCurrentItemIndex = 0;
}
const calItipItemClassID = Components.ID("{f41392ab-dcad-4bad-818f-b3d1631c4d93}");
const calItipItemInterfaces = [Components.interfaces.calIItipItem];
calItipItem.prototype = {
    mIsInitialized: false,

    classID: calItipItemClassID,
    QueryInterface: XPCOMUtils.generateQI(calItipItemInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calItipItemClassID,
        contractID: "@mozilla.org/calendar/itip-item;1",
        classDescription: "Calendar iTIP item",
        interfaces: calItipItemInterfaces
    }),

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
            item.clearAlarms();
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
        for (let item in cal.itemIterator(parser.getItems({}))) {
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
        for each (let prop in parser.getProperties({})) {
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
     * call it is: let itemArray = itipItem.getItemList({ });
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
        if (!aAttendeeId.match(/^mailto:/i)) {
            aAttendeeId = ("mailto:" + aAttendeeId);
        }

        for each (let item in this.mItemList) {
            let attendee = item.getAttendeeById(aAttendeeId);
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
