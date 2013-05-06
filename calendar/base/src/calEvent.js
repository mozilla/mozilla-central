/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

//
// constructor
//
function calEvent() {
    this.initItemBase();

    this.eventPromotedProps = {
        "DTSTART": true,
        "DTEND": true,
        __proto__: this.itemBasePromotedProps
    }
}
const calEventClassID = Components.ID("{974339d5-ab86-4491-aaaf-2b2ca177c12b}");
const calEventInterfaces = [
    Components.interfaces.calIItemBase,
    Components.interfaces.calIEvent,
    Components.interfaces.calIInternalShallowCopy
];
calEvent.prototype = {
    __proto__: calItemBase.prototype,

    classID: calEventClassID,
    QueryInterface: XPCOMUtils.generateQI(calEventInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calEventClassID,
        contractID: "@mozilla.org/calendar/event;1",
        classDescription: "Calendar Event",
        interfaces: calEventInterfaces
    }),

    cloneShallow: function (aNewParent) {
        let m = new calEvent();
        this.cloneItemBaseInto(m, aNewParent);
        return m;
    },

    createProxy: function calEvent_createProxy(aRecurrenceId) {
        cal.ASSERT(!this.mIsProxy, "Tried to create a proxy for an existing proxy!", true);

        let m = new calEvent();

        // override proxy's DTSTART/DTEND/RECURRENCE-ID
        // before master is set (and item might get immutable):
        let endDate = aRecurrenceId.clone();
        endDate.addDuration(this.duration);
        m.endDate = endDate;
        m.startDate = aRecurrenceId;

        m.initializeProxy(this, aRecurrenceId);
        m.mDirty = false;

        return m;
    },

    makeImmutable: function () {
        this.makeItemBaseImmutable();
    },

    get duration() {
        if (this.endDate && this.startDate) {
            return this.endDate.subtractDate(this.startDate);
        } else {
            // Return a null-duration if we don't have an end date
            return cal.createDuration();
        }
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
                        for (let paramName in propBucket) {
                            try {
                                icalprop.setParameter(paramName, propBucket[paramName]);
                            } catch (e if e.result == Components.results.NS_ERROR_ILLEGAL_VALUE) {
                                // Illegal values should be ignored, but we could log them if
                                // the user has enabled logging.
                                cal.LOG("Warning: Invalid event parameter value " + paramName + "=" + propBucket[paramName]);
                            }
                        }
                    }
                    icalcomp.addProperty(icalprop);
                }
            } catch (e) {
                cal.ERROR("failed to set " + iprop.name + " to " + iprop.value + ": " + e + "\n");
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

        this.mEndDate = undefined;
        this.setItemBaseFromICS(event);
        this.mapPropsFromICS(event, this.icsEventPropMap);

        this.importUnpromotedProperties(event, this.eventPromotedProps);

        // Importing didn't really change anything
        this.mDirty = false;
    },

    isPropertyPromoted: function (name) {
        // avoid strict undefined property warning
        return (this.eventPromotedProps[name] || false);
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

        return this.setProperty("DTSTART", value);
    },

    get startDate() {
        return this.getProperty("DTSTART");
    },

    mEndDate: undefined,
    get endDate() {
        var endDate = this.mEndDate;
        if (endDate === undefined) {
            endDate = this.getProperty("DTEND");
            if (!endDate && this.startDate) {
                endDate = this.startDate.clone();
                var dur = this.getProperty("DURATION");
                if (dur) {
                    // If there is a duration set on the event, calculate the right end time.
                    endDate.addDuration(cal.createDuration(dur));
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

