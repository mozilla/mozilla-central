/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/ical.js");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function calRecurrenceRule(innerObject) {
    this.innerObject = innerObject || new ICAL.Recur();
    this.wrappedJSObject = this;
}

const calRecurrenceRuleInterfaces = [Components.interfaces.calIRecurrenceRule];
const calRecurrenceRuleClassID = Components.ID("{df19281a-5389-4146-b941-798cb93a7f0d}");
calRecurrenceRule.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calRecurrenceRuleInterfaces),
    classID: calRecurrenceRuleClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/recurrence-rule;1",
        classDescription: "Calendar Recurrence Rule",
        classID: calRecurrenceRuleClassID,
        interfaces: calRecurrenceRuleInterfaces
    }),

    innerObject: null,

    isMutable: true,
    makeImmutable: function() this.isMutable = false,
    clone: function() new calRecurrenceRule(new ICAL.Recur(this.innerObject)),

    isNegative: false, // We don't support EXRULE anymore
    get isFinite() this.innerObject.isFinite(),

    getNextOccurrence: function(aStartTime, aRecId) {
        aStartTime = unwrapSingle(ICAL.Time, aStartTime);
        aRecId = unwrapSingle(ICAL.Time, aRecId);
        return wrapGetter(calDateTime, this.innerObject.getNextOccurrence(aStartTime, aRecId));
    },

    getOccurrences: function(aStartTime, aRangeStart, aRangeEnd, aMaxCount, aCount) {
        aStartTime = unwrapSingle(ICAL.Time, aStartTime);
        aRangeStart = unwrapSingle(ICAL.Time, aRangeStart);
        aRangeEnd = unwrapSingle(ICAL.Time, aRangeEnd);

        if (!aMaxCount && !aRangeEnd && this.count == 0 && this.until == null) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        let occurrences = [];
        let rangeStart = aRangeStart.clone();
        rangeStart.isDate = false;

        let dtend = null;

        if (aRangeEnd) {
            dtend = aRangeEnd.clone();
            dtend.isDate = false;

            // If the start of the recurrence is past the end, we have no dates
            if (aStartTime.compare(dtend) >= 0) {
                aCount.value = 0;
                return [];
            }
        }

        let iter = this.innerObject.iterator(aStartTime);

        for (let next = iter.next(); next ; next = iter.next()) {
            let dtNext  = next.clone();
            dtNext.isDate = false;

            if (dtNext.compare(rangeStart) < 0) {
                continue;
            }

            if (dtend && dtNext.compare(dtend) >= 0) {
                break;
            }

            next = next.clone();

            if (aStartTime.zone) {
                next.zone = aStartTime.zone;
            }

            occurrences.push(new calDateTime(next));

            if (aMaxCount && aMaxCount >= occurrences.length) {
                break;
            }
        }

        aCount.value = occurrences.length;
        return occurrences;
    },

    get icalString() "RRULE:" + this.innerObject.toString() + ICAL.newLineChar,
    set icalString(val) this.innerObject = ICAL.Recur.fromString(val.replace(/^RRULE:/i, "")),

    get icalProperty() {
        let prop = new ICAL.Property("rrule");
        prop.setValue(this.innerObject);
        return new calIcalProperty(prop);
    },
    set icalProperty(val) unwrapSetter(ICAL.Property, val, function(val) {
        this.innerObject = val.getFirstValue();
    }, this),

    get type() this.innerObject.freq,
    set type(val) this.innerObject.freq = val,

    get interval() this.innerObject.interval,
    set interval(val) this.innerObject.interval = val,

    get count() {
        if (!this.isByCount) {
            throw Components.results.NS_ERROR_FAILURE;
        }
        return this.innerObject.count || -1;
    },
    set count(val) this.innerObject.count = (val && val > 0 ? val : null),

    get untilDate() {
        if (this.innerObject.until) {
            return new calDateTime(this.innerObject.until);
        } else {
            return null;
        }
    },
    set untilDate(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.until = val;
    }, this),

    get isByCount() this.innerObject.isByCount(),

    get weekStart() this.innerObject.wkst - 1,
    set weekStart(val) this.innerObject.wkst = val + 1,

    getComponent: function(aType, aCount) {
        return this.innerObject.getComponent(aType, aCount)
                   .map(ICAL.Recur.icalDayToNumericDay);
    },

    setComponent: function(aType, aCount, aValues) {
        let values = aValues.map(ICAL.Recur.numericDayToIcalDay);
        this.innerObject.setComponent(aType, values);
    }
};
