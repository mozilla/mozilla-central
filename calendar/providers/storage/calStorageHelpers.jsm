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
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2005, 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Joey Minta <jminta@gmail.com>
 *   Dan Mosedale <dan.mosedale@oracle.com>
 *   Thomas Benisch <thomas.benisch@sun.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Sebastian Schwieger <sebo.moz@googlemail.com>
 *   Fred Jendrzejewski <fred.jen@web.de>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");

var EXPORTED_SYMBOLS = [
    "CAL_ITEM_FLAG",
    "createStatement",
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
};

// The cache of foreign timezones
var gForeignTimezonesCache = {};

/**
 * Create a storage statement on the given database connection with the passed
 * sql statement string.
 *
 * @param aDb       The mozIStorageConnection to create the statement with.
 * @param aSql      A string with the SQL of the statement to create.
 */
function createStatement(aDb, aSql) {
    try {
        // TODO We don't need the wrapper anymore if we get rid of calling
        // statements as functions, i.e mDeleteAttendees(aID);
        let stmt = aDb.createStatement(aSql);
        let wrapper = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
                                .createInstance(Components.interfaces.mozIStorageStatementWrapper);
        wrapper.initialize(stmt);
        return wrapper;
    } catch (e) {
        cal.ERROR("mozStorage exception: createStatement failed, statement: '" +
                  aSql + "', error: '" + aDb.lastErrorString + "' - " + e);
    }

    return null;
}

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
