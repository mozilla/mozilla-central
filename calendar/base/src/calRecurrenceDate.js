/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

function calRecurrenceDate() {
    this.wrappedJSObject = this;
}

const calRecurrenceDateClassID = Components.ID("{806b6423-3aaa-4b26-afa3-de60563e9cec}");
const calRecurrenceDateInterfaces = [Components.interfaces.calIRecurrenceDate];
calRecurrenceDate.prototype = {
    isMutable: true,

    mIsNegative: false,
    mDate: null,

    classID: calRecurrenceDateClassID,
    QueryInterface: XPCOMUtils.generateQI(calRecurrenceDateInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calRecurrenceDateClassID,
        contractID: "@mozilla.org/calendar/recurrence-date;1",
        classDescription: "The date of an occurrence of a recurring item",
        interfaces: calRecurrenceDateInterfaces
    }),
    makeImmutable: function makeImmutable() {
        this.isMutable = false;
    },

    ensureMutable: function ensureMutable() {
        if (!this.isMutable) {
            throw Components.results.NS_ERROR_OBJECT_IS_MUTABLE;
        }
    },

    clone: function clone() {
        let other = new calRecurrenceDate();
        other.mDate = (this.mDate ? this.mDate.clone() : null);
        other.mIsNegative = this.mIsNegative;
        return other;
    },

    get isNegative() this.mIsNegative,
    set isNegative(val) {
        this.ensureMutable();
        return (this.mIsNegative = val);
    },

    get isFinite() true,

    get date() this.mDate,
    set date(val) {
        this.ensureMutable();
        return (this.mDate = val);
    },

    getNextOccurrence: function getNextOccurrence(aStartTime, aOccurrenceTime) {
        if (this.mDate && this.mDate.compare(aStartTime) > 0) {
            return this.mDate;
        } else {
            return null;
        }
    },

    getOccurrences: function getOccurrences(aStartTime, aRangeStart, aRangeEnd, aMaxCount, aCount) {
        if (this.mDate &&
            this.mDate.compare(aRangeStart) >= 0 &&
            (!aRangeEnd || this.mDate.compare(aRangeEnd) < 0)) {
            aCount.value = 1;
            return [this.mDate];
        } else {
            aCount.value = 0;
            return [];
        }
    },

    get icalString() {
        let comp = this.icalProperty;
        return (comp ? comp.icalString : "");
    },
    set icalString(val) {
        let prop = cal.getIcsService().createIcalPropertyFromString(val);
        let propName = prop.propertyName;
        if (propName != "RDATE" && propName != "EXDATE") {
            throw Components.results.NS_ERROR_ILLEGAL_VALUE;
        }

        this.icalProperty = prop;
        return val;
    },

    get icalProperty() {
        let prop = cal.getIcsService().createIcalProperty(this.mIsNegative ? "EXDATE" : "RDATE");
        prop.valueAsDatetime = this.mDate;
        return prop;
    },
    set icalProperty(prop) {
        if (prop.propertyName == "RDATE") {
            this.mIsNegative = false;
            if (prop.getParameter("VALUE") == "PERIOD") {
                let period = Components.classes["@mozilla.org/calendar/period;1"]
                                       .createInstance(Components.interfaces.calIPeriod);
                period.icalString = prop.valueAsIcalString;
                this.mDate = period.start;
            } else {
                this.mDate = prop.valueAsDatetime;
            }
        } else if (prop.propertyName == "EXDATE") {
            this.mIsNegative = true;
            this.mDate = prop.valueAsDatetime;
        }
        return prop;
    }
};
