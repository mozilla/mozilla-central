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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Mike Shaver <shaver@off.net>
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
// calEvent.js
//

//
// constructor
//
function calEvent() {
    this.initItemBase();

    this.eventPromotedProps = {
        "DTSTART": true,
        "DTEND": true,
        "DTSTAMP": true,
        __proto__: this.itemBasePromotedProps
    }
}

var calEventClassInfo = {
    getInterfaces: function (count) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIItemBase,
            Components.interfaces.calIEvent,
            Components.interfaces.calIInternalShallowCopy,
            Components.interfaces.nsIClassInfo
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/event;1",
    classDescription: "Calendar Event",
    classID: Components.ID("{974339d5-ab86-4491-aaaf-2b2ca177c12b}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0
};

calEvent.prototype = {
    __proto__: calItemBase.prototype,

    QueryInterface: function (aIID) {
        return doQueryInterface(this, calEvent.prototype, aIID, null, calEventClassInfo);
    },

    cloneShallow: function (aNewParent) {
        var m = new calEvent();
        this.cloneItemBaseInto(m, aNewParent);

        return m;
    },

    createProxy: function () {
        if (this.mIsProxy) {
            calDebug("Tried to create a proxy for an existing proxy!\n");
            throw Components.results.NS_ERROR_UNEXPECTED;
        }

        var m = new calEvent();
        m.initializeProxy(this);

        return m;
    },

    makeImmutable: function () {
        this.makeItemBaseImmutable();
    },

    get duration() {
        return this.endDate.subtractDate(this.startDate);
    },

    get recurrenceStartDate() {
        return this.startDate;
    },

    icsEventPropMap: [
    { cal: "DTSTART", ics: "startTime" },
    { cal: "DTEND", ics: "endTime" }],

    set icalString(value) {
        this.icalComponent = getIcsService().parseICS(value, null);
    },

    get icalString() {
        var calcomp = getIcsService().createIcalComponent("VCALENDAR");
        calSetProdidVersion(calcomp);
        calcomp.addSubcomponent(this.icalComponent);
        return calcomp.serializeToICS();
    },

    get icalComponent() {
        var icssvc = getIcsService();
        var icalcomp = icssvc.createIcalComponent("VEVENT");
        this.fillIcalComponentFromBase(icalcomp);
        this.mapPropsToICS(icalcomp, this.icsEventPropMap);
        
        var bagenum = this.propertyEnumerator;
        while (bagenum.hasMoreElements()) {
            var iprop = bagenum.getNext().
                QueryInterface(Components.interfaces.nsIProperty);
            try {
                if (!this.eventPromotedProps[iprop.name]) {
                    var icalprop = icssvc.createIcalProperty(iprop.name);
                    icalprop.value = iprop.value;
                    var propBucket = this.mPropertyParams[iprop.name];
                    if (propBucket) {
                        for (paramName in propBucket) {
                            icalprop.setParameter(paramName,
                                                  propBucket[paramName]);
                        }
                    }
                    icalcomp.addProperty(icalprop);
                }
            } catch (e) {
                dump("XXX failed to set " + iprop.name + " to " + iprop.value +
                ": " + e + "\n");
            }
        }
        return icalcomp;
    },

    eventPromotedProps: null,

    set icalComponent(event) {
        this.modify();
        if (event.componentType != "VEVENT") {
            event = event.getFirstSubcomponent("VEVENT");
            if (!event)
                throw Components.results.NS_ERROR_INVALID_ARG;
        }

        this.setItemBaseFromICS(event);
        this.mapPropsFromICS(event, this.icsEventPropMap);

        this.importUnpromotedProperties(event, this.eventPromotedProps);

        // Importing didn't really change anything
        this.mDirty = false;
    },

    isPropertyPromoted: function (name) {
        return (this.eventPromotedProps[name]);
    },

    set startDate(value) {
        this.modify();

        // We're about to change the start date of an item which probably
        // could break the associated calIRecurrenceInfo. We're calling
        // the appropriate method here to adjust the internal structure in
        // order to free clients from worrying about such details.
        if (this.parentItem == this) {
            var rec = this.recurrenceInfo;
            if (rec) {
                rec.onStartDateChange(value,this.startDate);
            }
        }

        this.setProperty("DTSTART", value);
    },

    get startDate() {
        return this.getProperty("DTSTART");
    },

    mEndDate: undefined,
    get endDate() {
        var endDate = this.mEndDate;
        if (endDate === undefined) {
            endDate = this.getProperty("DTEND");
            if (!endDate) {
                endDate = this.startDate.clone();
                var dur = this.getProperty("DURATION");
                if (dur) {
                    // If there is a duration set on the event, calculate the right end time.
                    var icalDur = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                    icalDur.icalString = dur;
                    endDate.addDuration(icalDur);
                } else {
                    // If the start time is a date-time the event ends on the same calendar
                    // date and time of day. If the start time is a date the events
                    // non-inclusive end is the end of the calendar date.
                    if (endDate.isDate) {
                        endDate.day += 1;
                    }
                }
            }
            this.mEndDate = endDate;
        }
        return endDate;
    },

    set endDate(value) {
        this.deleteProperty("DURATION"); // setting endDate once removes DURATION
        this.setProperty("DTEND", value);
        return (this.mEndDate = value);
    }
};

