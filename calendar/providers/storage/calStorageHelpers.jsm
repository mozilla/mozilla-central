/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

var EXPORTED_SYMBOLS = [
    "CAL_ITEM_FLAG",
    "getInUtcOrKeepFloating",
    "dateToText",
    "textToDate",
    "calStorageTimezone",
    "getTimezone",
    "newDateTime"
];

// Storage flags. These are used in the Database |flags| column to give
// information about the item's features. For example, if the item has
// attachments, the HAS_ATTACHMENTS flag is added to the flags column.
var CAL_ITEM_FLAG = {
    PRIVATE: 1,
    HAS_ATTENDEES: 2,
    HAS_PROPERTIES: 4,
    EVENT_ALLDAY: 8,
    HAS_RECURRENCE: 16,
    HAS_EXCEPTIONS: 32,
    HAS_ATTACHMENTS: 64,
    HAS_RELATIONS: 128,
    HAS_ALARMS: 256,
    RECURRENCE_ID_ALLDAY: 512
};

// The cache of foreign timezones
var gForeignTimezonesCache = {};

/**
 * Returns the passed date in UTC, unless it is floating. In this case, it is
 * kept floating.
 *
 * @param dt        The calIDateTime to convert.
 * @return          The possibly converted calIDateTime.
 */
function getInUtcOrKeepFloating(dt) {
    let tz = dt.timezone;
    if (tz.isFloating || tz.isUTC) {
        return dt;
    } else {
        return dt.getInTimezone(cal.UTC());
    }
}

/**
 * Transforms a date object to a text which is suitable for the database
 *
 * @param d     The calIDateTime to transform.
 * @return      The string representation of the date object.
 */
function dateToText(d) {
    let datestr;
    let tz = null;

    datestr = (d.timezone.isFloating ? "L" :
                 (d.timezone.isUTC ? "U" : "Z")) +
              (d.isDate ? "D" : "T") + d.nativeTime;
    if (!d.timezone.isFloating && ! d.timezone.isUTC) {
        datestr += ":" + d.timezone.tzid.replace(/%/g, "%%").replace(/:/g, "%:");
    }
    return datestr;
}

/**
 * Transforms the text representation of this date object to a calIDateTime
 * object.
 *
 * @param d     The text to transform.
 * @return      The resulting calIDateTime.
 */
function textToDate(d) {
    let dval;
    let tz = "UTC";

    if (d[0] == 'Z') {
        let strs = d.substr(2).split(":");
        dval = parseInt(strs[0]);
        tz = strs[1].replace(/%:/g, ":").replace(/%%/g, "%");
    } else {
        dval = parseInt(d.substr(2));
    }

    let date;
    if (d[0] == 'U' || d[0] == 'Z') {
        date = newDateTime(dval, tz);
    } else if (d[0] == 'L') {
        // is local time
        date = newDateTime(dval, "floating");
    }

    if (d[1] == 'D')
        date.isDate = true;
    return date;
}

//
// other helpers
//

/**
 * Prototype definition for foreign timezone.
 */
function calStorageTimezone(comp) {
    this.wrappedJSObject = this;
    this.provider = null;
    this.icalComponent = comp;
    this.tzid = comp.getFirstProperty("TZID").value;
    this.displayName = null;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = null;
    this.longitude = null;
}
calStorageTimezone.prototype = {
    toString: function() {
        return this.icalComponent.toString();
    }
};

/**
 * Gets the timezone for the given definition or identifier
 *
 * @param aTimezone     The timezone data
 * @return              The calITimezone object
 */
function getTimezone(aTimezone) {
    let tz = null;
    if (aTimezone.indexOf("BEGIN:VTIMEZONE") == 0) {
        tz = gForeignTimezonesCache[aTimezone]; // using full definition as key
        if (!tz) {
            try {
                // cannot cope without parent VCALENDAR:
                let comp = cal.getIcsService().parseICS("BEGIN:VCALENDAR\n" + aTimezone + "\nEND:VCALENDAR", null);
                tz = new calStorageTimezone(comp.getFirstSubcomponent("VTIMEZONE"));
                gForeignTimezonesCache[aTimezone] = tz;
            } catch (e) {
                cal.ASSERT(false, e);
            }
        }
    } else {
        tz = cal.getTimezoneService().getTimezone(aTimezone);
    }
    return tz;
}

/**
 * Creates a new calIDateTime from the given native time and optionally
 * the passed timezone. The timezone can either be the TZID of the timezone (in
 * this case the timezone service will be asked for the definition), or a string
 * representation of the timezone component (i.e a VTIMEZONE component).
 *
 * @param aNativeTime       The native time, in microseconds
 * @param aTimezone         The timezone identifier or definition.
 */
function newDateTime(aNativeTime, aTimezone) {
    let t = cal.createDateTime();

    // Bug 751821 - Dates before 1970 were incorrectly stored with an unsigned nativeTime value, we need to
    // convert back to a negative value
    if (aNativeTime > 0x7fffffffffffffff) {
        cal.WARN("[calStorageCalendar] Converting invalid native time value: " + aNativeTime);
        aNativeTime = -0x7fffffffffffffff + (aNativeTime - 0x7fffffffffffffff);
        // Round to nearest second to fix microsecond rounding errors
        aNativeTime = Math.round(aNativeTime / 1000000) * 1000000;
    }

    t.nativeTime = aNativeTime;
    if (aTimezone) {
        let tz = getTimezone(aTimezone);
        if (tz) {
            t = t.getInTimezone(tz);
        } else {
            cal.ASSERT(false, "Timezone not available: " + aTimezone);
        }
    } else {
        t.timezone = cal.floating();
    }
    return t;
}
