/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/ical.js");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const UNIX_TIME_TO_PRTIME = 1000000;

function calDateTime(innerObject) {
    this.wrappedJSObject = this;
    this.innerObject = innerObject || ICAL.Time.epochTime.clone();
}

const calDateTimeInterfaces = [Components.interfaces.calIDateTime];
const calDateTimeClassID = Components.ID("{36783242-ec94-4d8a-9248-d2679edd55b9}");
calDateTime.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calDateTimeInterfaces),
    classID: calDateTimeClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/datetime;1",
        classDescription: "Describes a Date/Time Object",
        classID: calDateTimeClassID,
        interfaces: calDateTimeInterfaces
    }),

    isMutable: true,
    makeImmutable: function() this.isMutable = false,
    clone: function() new calDateTime(this.innerObject.clone()),

    isValid: true,
    innerObject: null,

    get nativeTime() this.innerObject.toUnixTime() * UNIX_TIME_TO_PRTIME,
    set nativeTime(val) this.innerObject.fromUnixTime(val / UNIX_TIME_TO_PRTIME),

    get year() this.innerObject.year,
    set year(val) this.innerObject.year = val,

    get month() this.innerObject.month - 1,
    set month(val) this.innerObject.month = val + 1,

    get day() this.innerObject.day,
    set day(val) this.innerObject.day = val,

    get hour() this.innerObject.hour,
    set hour(val) this.innerObject.hour = val,

    get minute() this.innerObject.minute,
    set minute(val) this.innerObject.minute = val,

    get second() this.innerObject.second,
    set second(val) this.innerObject.second = val,

    get timezone() new calICALJSTimezone(this.innerObject.zone),
    set timezone(val) unwrapSetter(ICAL.Timezone, val, function(val) {
        return this.innerObject.zone = val;
    }, this),

    resetTo: function (yr,mo,dy,hr,mi,sc,tz) {
        this.innerObject.fromData({
            year: yr, month: mo + 1, day: dy,
            hour: hr, minute: mi, second: sc,
        });
        this.timezone = tz;
    },

    reset: function() this.innerObject.reset(),

    get timezoneOffset() this.innerObject.utcOffset(),
    get isDate() this.innerObject.isDate,
    set isDate(val) this.innerObject.isDate = val,

    get weekday() this.innerObject.dayOfWeek() - 1,
    get yearday() this.innerObject.dayOfYear(),

    toString: function() this.innerObject.toString(),

    getInTimezone: unwrap(ICAL.Timezone, function(val) {
        return new calDateTime(this.innerObject.convertToZone(val));
    }),

    addDuration: unwrap(ICAL.Duration, function(val) {
        this.innerObject.addDuration(val);
    }),

    subtractDate: unwrap(ICAL.Time, function(val) {
        return new calDuration(this.innerObject.subtractDateTz(val));
    }),

    compare: unwrap(ICAL.Time, function(val) {
        if (this.innerObject.isDate != val.isDate) {
            // Lightning expects 20120101 and 20120101T010101 to be equal
            tz = (this.innerObject.isDate ? val.zone : this.innerObject.zone);
            return this.innerObject.compareDateOnlyTz(val, tz);
        } else {
            // If both are dates or date-times, then just do the normal compare
            return this.innerObject.compare(val);
        }
    }),

    get startOfWeek() new calDateTime(this.innerObject.startOfWeek()),
    get endOfWeek() new calDateTime(this.innerObject.endOfWeek()),
    get startOfMonth() new calDateTime(this.innerObject.startOfMonth()),
    get endOfMonth() new calDateTime(this.innerObject.endOfMonth()),
    get startOfYear() new calDateTime(this.innerObject.startOfYear()),
    get endOfYear() new calDateTime(this.innerObject.endOfYear()),

    get icalString() this.innerObject.toICALString(),
    set icalString(val) {
        let jcalString;
        if (val.length > 10) {
           jcalString = ICAL.design.value["date-time"].fromICAL(val);
        } else {
           jcalString = ICAL.design.value.date.fromICAL(val);
        }
        this.innerObject = ICAL.Time.fromString(jcalString);
    },

    get jsDate() this.innerObject.toJSDate(),
    set jsDate(val) this.innerObject.fromJSDate(val, true)
};
