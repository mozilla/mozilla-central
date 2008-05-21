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
 * The Original Code is Calendar component utils.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/* This file contains commonly used functions in a centralized place so that
 * various components (and other js scopes) don't need to replicate them. Note
 * that loading this file twice in the same scope will throw errors.
 */

/* Returns a clean new calIEvent */
function createEvent() {
    return Components.classes["@mozilla.org/calendar/event;1"].
           createInstance(Components.interfaces.calIEvent);
}

/* Returns a clean new calITodo */
function createTodo() {
    return Components.classes["@mozilla.org/calendar/todo;1"].
           createInstance(Components.interfaces.calITodo);
}

/* Returns a clean new calIDateTime */
function createDateTime() {
    return Components.classes["@mozilla.org/calendar/datetime;1"].
           createInstance(Components.interfaces.calIDateTime);
}

/* Returns a clean new calIRecurrenceInfo */
function createRecurrenceInfo(aItem) {
    var recInfo = Components.classes["@mozilla.org/calendar/recurrence-info;1"].
           createInstance(Components.interfaces.calIRecurrenceInfo);
    recInfo.item = aItem;
    return recInfo;
}

/* Returns a clean new calIRecurrenceRule */
function createRecurrenceRule() {
    return Components.classes["@mozilla.org/calendar/recurrence-rule;1"].
           createInstance(Components.interfaces.calIRecurrenceRule);
}

/* Returns a clean new calIAttendee */
function createAttendee() {
    return Components.classes["@mozilla.org/calendar/attendee;1"].
           createInstance(Components.interfaces.calIAttendee);
}

/* Shortcut to the console service */
function getConsoleService() {
    if (getConsoleService.mObject === undefined) {
        getConsoleService.mObject = Components.classes["@mozilla.org/consoleservice;1"]
                                              .getService(Components.interfaces.nsIConsoleService);
    }
    return getConsoleService.mObject;
}

/* Shortcut to the io service */
function getIOService() {
    if (getIOService.mObject === undefined) {
        getIOService.mObject = Components.classes["@mozilla.org/network/io-service;1"]
                                         .getService(Components.interfaces.nsIIOService2);
    }
    return getIOService.mObject;
}

/* Shortcut to the calendar-manager service */
function getCalendarManager() {
    if (getCalendarManager.mObject === undefined) {
        getCalendarManager.mObject = Components.classes["@mozilla.org/calendar/manager;1"]
                                               .getService(Components.interfaces.calICalendarManager);
    }
    return getCalendarManager.mObject;
}

/* Shortcut to the ICS service */
function getIcsService() {
    if (getIcsService.mObject === undefined) {
        getIcsService.mObject = Components.classes["@mozilla.org/calendar/ics-service;1"]
                                          .getService(Components.interfaces.calIICSService);
    }
    return getIcsService.mObject;
}

/* Shortcut to the timezone service */
function getTimezoneService() {
    if (getTimezoneService.mObject === undefined) {
        getTimezoneService.mObject = Components.classes["@mozilla.org/calendar/timezone-service;1"]
                                               .getService(Components.interfaces.calITimezoneService);
    }
    return getTimezoneService.mObject;
}

/* Shortcut to calendar search service */
function getCalendarSearchService() {
    if (getCalendarSearchService.mObject === undefined) {
        getCalendarSearchService.mObject = Components.classes["@mozilla.org/calendar/calendarsearch-service;1"]
                                                     .getService(Components.interfaces.calICalendarSearchProvider);
    }
    return getCalendarSearchService.mObject;
}

/// @return the UTC timezone.
function UTC() {
    if (UTC.mObject === undefined) {
        UTC.mObject = getTimezoneService().UTC;
    }
    return UTC.mObject;
}

/// @return the floating timezone.
function floating() {
    if (floating.mObject === undefined) {
        floating.mObject = getTimezoneService().floating;
    }
    return floating.mObject;
}

/**
 * Function to get the (cached) best guess at a user's default timezone.  We'll
 * use the value of the calendar.timezone.local preference, if it exists.  If
 * not, we'll do our best guess.
 *
 * @return user's default timezone.
 */
function calendarDefaultTimezone() {
    if (calendarDefaultTimezone.mTz === undefined) {
        var prefTzid = getPrefSafe("calendar.timezone.local", null);
        var tzid = prefTzid;
        if (!tzid) {
            tzid = guessSystemTimezone();
        }
        calendarDefaultTimezone.mTz = getTimezoneService().getTimezone(tzid);
        ASSERT(calendarDefaultTimezone.mTz, "timezone not found: " + tzid);
        // Update prefs if necessary:
        if (calendarDefaultTimezone.mTz && calendarDefaultTimezone.mTz.tzid != prefTzid) {
            setPref("calendar.timezone.local", "CHAR", calendarDefaultTimezone.mTz.tzid);
        }
    }
    return calendarDefaultTimezone.mTz;
}

/**
 * Format the given string to work inside a CSS rule selector
 * (and as part of a non-unicode preference key).
 *
 * Replaces each space ' ' char with '_'.
 * Replaces each char other than ascii digits and letters, with '-uxHHH-'
 * where HHH is unicode in hexadecimal (variable length, terminated by the '-').
 *
 * Ensures: result only contains ascii digits, letters,'-', and '_'.
 * Ensures: result is invertible, so (f(a) = f(b)) implies (a = b).
 *   also means f is not idempotent, so (a != f(a)) implies (f(a) != f(f(a))).
 * Ensures: result must be lowercase.
 * Rationale: preference keys require 8bit chars, and ascii chars are legible
 *              in most fonts (in case user edits PROFILE/prefs.js).
 *            CSS class names in Gecko 1.8 seem to require lowercase,
 *              no punctuation, and of course no spaces.
 *   nmchar		[_a-zA-Z0-9-]|{nonascii}|{escape}
 *   name		{nmchar}+
 *   http://www.w3.org/TR/CSS21/grammar.html#scanner
 *
 * @param aString       The unicode string to format
 * @return              The formatted string using only chars [_a-zA-Z0-9-]
 */
function formatStringForCSSRule(aString) {
    function toReplacement(ch) {
        // char code is natural number (positive integer)
        var nat = ch.charCodeAt(0);
        switch(nat) {
            case 0x20: // space
                return "_";
            default:
                return "-ux" + nat.toString(16) + "-"; // lowercase
        }
    }
    // Result must be lowercase or style rule will not work.
    return aString.toLowerCase().replace(/[^a-zA-Z0-9]/g, toReplacement);
}

/**
 * We're going to do everything in our power, short of rumaging through the
 * user's actual file-system, to figure out the time-zone they're in.  The
 * deciding factors are the offsets given by (northern-hemisphere) summer and
 * winter JSdates.  However, when available, we also use the name of the
 * timezone in the JSdate, or a string-bundle term from the locale.
 *
 * @return a mozilla ICS timezone string.
*/
function guessSystemTimezone() {
    // Probe JSDates for basic OS timezone offsets and names.
    const dateJun = (new Date(2005, 5,20)).toString();
    const dateDec = (new Date(2005,11,20)).toString();
    const tzNameRegex = /[^(]* ([^ ]*) \(([^)]+)\)/;
    const nameDataJun = dateJun.match(tzNameRegex);
    const nameDataDec = dateDec.match(tzNameRegex);
    const tzNameJun = nameDataJun && nameDataJun[2];
    const tzNameDec = nameDataDec && nameDataDec[2];
    const offsetRegex = /[+-]\d{4}/;
    const offsetJun = dateJun.match(offsetRegex)[0];
    const offsetDec = dateDec.match(offsetRegex)[0];

    const tzSvc = getTimezoneService();

    function getIcalString(component, property) {
        return (component &&
                component.getFirstProperty(property).valueAsIcalString);
    }

    // Check if Olson ZoneInfo timezone matches OS/JSDate timezone properties:
    // * standard offset and daylight/summer offset if present (longitude),
    // * if has summer time, direction of change (northern/southern hemisphere)
    // * if has summer time, dates of next transitions
    // * timezone name (such as "Western European Standard Time").
    // Score is 3 if matches dates and names, 2 if matches dates without names,
    // 1 if matches dates within a week (so changes on different weekday),
    // otherwise 0 if no match.
    function checkTZ(tzId) {
        var tz = tzSvc.getTimezone(tzId);

        // Have to handle UTC separately because it has no .component.
        if (tz.isUTC) {
            if (offsetDec == 0 && offsetJun == 0) {
                if (tzNameJun == "UTC" && tzNameDec == "UTC") {
                    return 3;
                } else {
                    return 2;
                }
            } else {
                return 0;
            }
        }
        
        var subComp = tz.component;
        // find currently applicable time period, not just first,
        // because offsets of timezone may be changed over the years.
        var standard = findCurrentTimePeriod(tz, subComp, "STANDARD");
        var standardTZOffset = getIcalString(standard, "TZOFFSETTO");
        var standardName     = getIcalString(standard, "TZNAME");
        var daylight = findCurrentTimePeriod(tz, subComp, "DAYLIGHT");
        var daylightTZOffset = getIcalString(daylight, "TZOFFSETTO");
        var daylightName     = getIcalString(daylight, "TZNAME");

        // Try northern hemisphere cases.
        if (offsetDec == standardTZOffset && offsetDec == offsetJun &&
            !daylight) {
            if (standardName && standardName == tzNameJun) {
                return 3;
            } else {
                return 2;
            }
        }

        if (offsetDec == standardTZOffset && offsetJun == daylightTZOffset &&
            daylight) {
            var dateMatchWt = systemTZMatchesTimeShiftDates(tz, subComp);
            if (dateMatchWt > 0) { 
                if (standardName && standardName == tzNameJun &&
                    daylightName && daylightName == tzNameDec) {
                    return 3;
                } else {
                    return dateMatchWt;
                }
            }
        }

        // Now flip them and check again, to cover southern hemisphere cases.
        if (offsetJun == standardTZOffset && offsetDec == offsetJun &&
            !daylight) {
            if (standardName && standardName == tzNameDec) {
                return 3;
            } else {
                return 2;
            }
        }

        if (offsetJun == standardTZOffset && offsetDec == daylightTZOffset &&
            daylight) {
            var dateMatchWt = systemTZMatchesTimeShiftDates(tz, subComp);
            if (dateMatchWt > 0) { 
                if (standardName && standardName == tzNameJun &&
                    daylightName && daylightName == tzNameDec) {
                    return 3;
                } else {
                    return dateMatchWt;
                }
            }
        }
        return 0;
    }

    // returns 2=match-within-hours, 1=match-within-week, 0=no-match
    function systemTZMatchesTimeShiftDates(tz, subComp) {
        // Verify local autumn and spring shifts also occur in system timezone
        // (jsDate) on correct date in correct direction.
        // (Differs for northern/southern hemisphere.
        //  Local autumn shift is to local winter STANDARD time.
        //  Local spring shift is to local summer DAYLIGHT time.)
        const autumnShiftJSDate =
            findCurrentTimePeriod(tz, subComp, "STANDARD", true);
        const afterAutumnShiftJSDate = new Date(autumnShiftJSDate);
        const beforeAutumnShiftJSDate = new Date(autumnShiftJSDate);
        const springShiftJSDate =
            findCurrentTimePeriod(tz, subComp, "DAYLIGHT", true);
        const beforeSpringShiftJSDate = new Date(springShiftJSDate);
        const afterSpringShiftJSDate = new Date(springShiftJSDate);
        // Try with 6 HOURS fuzz in either direction, since OS and ZoneInfo
        // may disagree on the exact time of shift (midnight, 2am, 4am, etc).
        beforeAutumnShiftJSDate.setHours(autumnShiftJSDate.getHours()-6);
        afterAutumnShiftJSDate.setHours(autumnShiftJSDate.getHours()+6);
        afterSpringShiftJSDate.setHours(afterSpringShiftJSDate.getHours()+6);
        beforeSpringShiftJSDate.setHours(beforeSpringShiftJSDate.getHours()-6);
        if ((beforeAutumnShiftJSDate.getTimezoneOffset() <
             afterAutumnShiftJSDate.getTimezoneOffset()) &&
            (beforeSpringShiftJSDate.getTimezoneOffset() >
             afterSpringShiftJSDate.getTimezoneOffset())) {
            return 2;
        }          
        // Try with 7 DAYS fuzz in either direction, so if no other tz found,
        // will have a nearby tz that disagrees only on the weekday of shift
        // (sunday vs. friday vs. calendar day), or off by exactly one week,
        // (e.g., needed to guess Africa/Cairo on w2k in 2006).
        beforeAutumnShiftJSDate.setDate(autumnShiftJSDate.getDate()-7);
        afterAutumnShiftJSDate.setDate(autumnShiftJSDate.getDate()+7);
        afterSpringShiftJSDate.setDate(afterSpringShiftJSDate.getDate()+7);
        beforeSpringShiftJSDate.setDate(beforeSpringShiftJSDate.getDate()-7);
        if ((beforeAutumnShiftJSDate.getTimezoneOffset() <
             afterAutumnShiftJSDate.getTimezoneOffset()) &&
            (beforeSpringShiftJSDate.getTimezoneOffset() >
             afterSpringShiftJSDate.getTimezoneOffset())) {
            return 1;
        }
        // no match
        return 0;
    }

    const todayUTC = createDateTime(); todayUTC.jsDate = new Date();
    const oneYrUTC = todayUTC.clone(); oneYrUTC.year += 1;
    const periodStartCalDate = createDateTime();
    const periodUntilCalDate = createDateTime(); // until timezone is UTC
    const periodCalRule =
        Components.classes["@mozilla.org/calendar/recurrence-rule;1"]
                  .createInstance(Components.interfaces.calIRecurrenceRule);
    const untilRegex = /UNTIL=(\d{8}T\d{6}Z)/;

    function findCurrentTimePeriod(tz, subComp, standardOrDaylight,
                                   isForNextTransitionDate) { 
        // Iterate through 'STANDARD' declarations or 'DAYLIGHT' declarations
        // (periods in history with different settings.
        //  e.g., US changes daylight start in 2007 (from April to March).)
        // Each period is marked by a DTSTART.
        // Find the currently applicable period: has most recent DTSTART
        // not later than today and no UNTIL, or UNTIL is greater than today.
        for (var period = subComp.getFirstSubcomponent(standardOrDaylight);
             period;
             period = subComp.getNextSubcomponent(standardOrDaylight)) {
            periodStartCalDate.icalString = getIcalString(period, "DTSTART");
            periodStartCalDate.timezone = tz;
            if (oneYrUTC.nativeTime < periodStartCalDate.nativeTime) {
                continue; // period starts too far in future
            }
            // Must examine UNTIL date (not next daylight start) because
            // some zones (e.g., Arizona, Hawaii) may stop using daylight
            // time, so there might not be a next daylight start.
            var rrule = period.getFirstProperty("RRULE");
            if (rrule) { 
                var match = untilRegex.exec(rrule.valueAsIcalString);
                if (match) {
                    periodUntilCalDate.icalString = match[1];
                    if (todayUTC.nativeTime > periodUntilDate.nativeTime) {
                        continue; // period ends too early
                    }
                } // else forever rule
            } // else no daylight rule

            // found period that covers today.
            if (!isForNextTransitionDate) {
                return period;
            } else /*isForNextTranstionDate*/ { 
                if (todayUTC.nativeTime < periodStartCalDate.nativeTime) {
                    // already know periodStartCalDate < oneYr from now,
                    // and transitions are at most once per year, so it is next.
                    return periodStartCalDate.jsDate;
                } else if (rrule) { 
                    // find next occurrence after today
                    periodCalRule.icalProperty = rrule;
                    var nextTransitionDate =
                        periodCalRule.getNextOccurrence(periodStartCalDate,
                                                        todayUTC);
                    // make sure rule doesn't end before next transition date.
                    if (nextTransitionDate)
                        return nextTransitionDate.jsDate;
                }
            }
        }
        // no such period found
        return null; 
    }


    // Try to find a tz that matches OS/JSDate timezone.  If no name match,
    // will use first of probable timezone(s) with highest score.
    var probableTZId = "floating"; // default fallback tz if no tz matches.
    var probableTZScore = 0;
    var probableTZSource = null;

    const sbSvc = 
        Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService);
    const calProperties =
        sbSvc.createBundle("chrome://calendar/locale/calendar.properties");

    // First, try to detect operating system timezone.
    try { 
        var osUserTimeZone = null;
        var zoneInfoIdFromOSUserTimeZone = null;

        if (navigator.oscpu.match(/^Windows/)) {
            var regOSName, fileOSName;
            if (navigator.oscpu.match(/^Windows NT/)) {
                regOSName  = "Windows NT";
                fileOSName = "WindowsNT";
            } else {
                // Note: windows 98 compatibility will be deleted
                // in releases built on Gecko 1.9 or later.
                regOSName  = "Windows";
                fileOSName = "Windows98";
            }                    

            // If on Windows NT (2K/XP/Vista), current timezone only lists its
            // localized name, so to find its registry key name, match localized
            // name to localized names of each windows timezone listed in
            // registry.  Then use the registry key name to see if this
            // timezone has a known ZoneInfo name.
            var wrk = (Components
                       .classes["@mozilla.org/windows-registry-key;1"]
                       .createInstance(Components.interfaces.nsIWindowsRegKey));
            wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,
                     "SYSTEM\\CurrentControlSet\\Control\\TimeZoneInformation",
                     wrk.ACCESS_READ);
            var currentTZStandardName = wrk.readStringValue("StandardName");
            wrk.close()

            wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,
                     ("SOFTWARE\\Microsoft\\"+regOSName+
                      "\\CurrentVersion\\Time Zones"),
                     wrk.ACCESS_READ);

            // Linear search matching localized name of standard timezone
            // to find the non-localized registry key.
            // (Registry keys are sorted by subkeyName, not by localized name
            //  nor offset, so cannot use binary search.)
            for (var i = 0; i < wrk.childCount; i++) {
              var subkeyName  = wrk.getChildName(i);
              var subkey = wrk.openChild(subkeyName, wrk.ACCESS_READ);
              var std = subkey.readStringValue("Std");
              subkey.close();
              if (std == currentTZStandardName) {
                osUserTimeZone = subkeyName;
                break;
              }
            }
            wrk.close();

            if (osUserTimeZone != null) {
                // Lookup timezone registry key in table of known tz keys
                // to convert to ZoneInfo timezone id.
                const regKeyToZoneInfoBundle =
                    sbSvc.createBundle("chrome://calendar/content/"+
                                       fileOSName+"ToZoneInfoTZId.properties");
                zoneInfoIdFromOSUserTimeZone =
                    regKeyToZoneInfoBundle.GetStringFromName(osUserTimeZone);
            }
        } else {
            // Else look for ZoneInfo timezone id in
            // - TZ environment variable value
            // - /etc/localtime symbolic link target path
            // - /etc/TIMEZONE or /etc/timezone file content
            // - /etc/sysconfig/clock file line content.
            // The timezone is set per user via the TZ environment variable.
            // TZ may contain a path that may start with a colon and ends with
            // a ZoneInfo timezone identifier, such as ":America/New_York" or 
            // ":/share/lib/zoneinfo/America/New_York".  The others are
            // in the filesystem so they give one timezone for the system;
            // the values are similar (but cannot have a leading colon).
            // (Note: the OS ZoneInfo database may be a different version from
            // the one we use, so still need to check that DST dates match.)
            var continent = "Africa|America|Antarctica|Asia|Australia|Europe";
            var ocean     = "Arctic|Atlantic|Indian|Pacific";
            var tzRegex   = new RegExp(".*((?:"+continent+"|"+ocean+")"+
                                       "(?:[/][-A-Z_a-z]+)+)");
            const CC = Components.classes;
            const CI = Components.interfaces;
            var envSvc = (CC["@mozilla.org/process/environment;1"]
                          .getService(Components.interfaces.nsIEnvironment));
            function environmentVariableValue(varName) {
                var value = envSvc.get(varName);
                if (!value) return "";
                if (!value.match(tzRegex)) return "";
                return varName+"="+value;
            }
            function symbolicLinkTarget(filepath) {
                try {
                    var file = (CC["@mozilla.org/file/local;1"]
                                .createInstance(CI.nsILocalFile));
                    file.initWithPath(filepath);
                    file.QueryInterface(CI.nsIFile);
                    if (!file.exists()) return "";
                    if (!file.isSymlink()) return "";
                    if (!file.target.match(tzRegex)) return "";
                    return filepath +" -> "+file.target;
                } catch (ex) {
                    Components.utils.reportError(filepath+": "+ex);
                    return "";
                }
            }
            function fileFirstZoneLineString(filepath) {
                // return first line of file that matches tzRegex (ZoneInfo id),
                // or "" if no file or no matching line.
                try {
                    var file = (CC["@mozilla.org/file/local;1"]
                                .createInstance(CI.nsILocalFile));
                    file.initWithPath(filepath);
                    file.QueryInterface(CI.nsIFile);
                    if (!file.exists()) return "";
                    var fileInstream =
                        (CC["@mozilla.org/network/file-input-stream;1"].
                         createInstance(CI.nsIFileInputStream));
                    const PR_RDONLY = 0x1;
                    fileInstream.init(file, PR_RDONLY, 0, 0);
                    fileInstream.QueryInterface(CI.nsILineInputStream);
                    try { 
                        var line = {}, hasMore = true, MAXLINES = 10;
                        for (var i = 0; hasMore && i < MAXLINES; i++) { 
                            hasMore = fileInstream.readLine(line);
                            if (line.value && line.value.match(tzRegex)) { 
                                return filepath+": "+line.value;
                            }
                        }
                        return ""; // not found
                    } finally {
                        fileInstream.close();
                    }
                } catch (ex) {
                    Components.utils.reportError(filepath+": "+ex);
                    return "";
                }
              
            }
            osUserTimeZone = (environmentVariableValue("TZ") ||
                              symbolicLinkTarget("/etc/localtime") ||
                              fileFirstZoneLineString("/etc/TIMEZONE") ||
                              fileFirstZoneLineString("/etc/timezone") ||
                              fileFirstZoneLineString("/etc/sysconfig/clock"));
            var results = osUserTimeZone.match(tzRegex);
            if (results) {
                zoneInfoIdFromOSUserTimeZone = results[1];
            }
        }

        // check how well OS tz matches tz defined in our version of zoneinfo db
        if (zoneInfoIdFromOSUserTimeZone != null) { 
            var tzId = tzSvc.tzidPrefix + zoneInfoIdFromOSUserTimeZone;
            var score = checkTZ(tzId);
            switch(score) {
            case 0:
                // Did not match.
                // Maybe OS or Application is old, and the timezone changed.
                // Or maybe user turned off DST in Date/Time control panel.
                // Will look for a better matching tz, or fallback to floating.
                // (Match OS so alarms go off at time indicated by OS clock.)
                WARN(calProperties.formatStringFromName(
                         "WarningOSTZNoMatch", [osUserTimeZone, zoneInfoIdFromOSUserTimeZone], 2));
                break;
            case 1: case 2:
                // inexact match: OS TZ and our ZoneInfo TZ matched imperfectly.
                // Will keep looking, will use tzId unless another is better.
                // (maybe OS TZ has changed to match a nearby TZ, so maybe
                // another ZoneInfo TZ matches it better).
                probableTZId = tzId;
                probableTZScore = score;
                probableTZSource = (calProperties.formatStringFromName
                                    ("TZFromOS", [osUserTimeZone], 1));
                break;
            case 3:
                // exact match
                return tzId;
            }
        }
    } catch (ex) {
        // zoneInfo id given was not recognized by our ZoneInfo database
        var errMsg = (calProperties.formatStringFromName
                      ("SkippingOSTimezone",
                       [zoneInfoIdFromOSUserTimeZone || osUserTimeZone], 1));
        Components.utils.reportError(errMsg+" "+ex);
    } 

    // Second, give priority to "likelyTimezone"s if provided by locale.
    try {
        // The likelyTimezone property is a comma-separated list of 
        // ZoneInfo timezone ids.
        const bundleTZString =
            calProperties.GetStringFromName("likelyTimezone");
        const bundleTZIds = bundleTZString.split(/\s*,\s*/);
        for each (var bareTZId in bundleTZIds) { 
            var tzId = bareTZId; 
            if (tzId.indexOf("/mozilla.org/") == -1) {
                // Convert a ZoneInfo timezone to a mozilla timezone-string
                tzId = tzSvc.tzidPrefix + tzId;
            }
            try { 
                var score = checkTZ(tzId);

                switch (score) {
                case 0:
                    break;
                case 1: case 2:
                    if (score > probableTZScore) { 
                        probableTZId = tzId;
                        probableTZScore = score;
                        probableTZSource = (calProperties.GetStringFromName
                                            ("TZFromLocale"));
                    }
                    break;
                case 3:
                    return tzId;
                }
            } catch (ex) {
                var errMsg = (calProperties.formatStringFromName
                              ("SkippingLocaleTimezone", [bareTZId], 1));
                Components.utils.reportError(errMsg+" "+ex);
            }
        }
    } catch (ex) { // Oh well, this didn't work, next option...
        Components.utils.reportError(ex);
    }
        
    // Third, try all known timezones.
    const tzIDs = tzSvc.timezoneIds;
    while (tzIDs.hasMore()) {
        var tzId = tzIDs.getNext();
        try {
            var score = checkTZ(tzId);
            switch(score) { 
            case 0: break;
            case 1: case 2:
                if (score > probableTZScore) {
                    probableTZId = tzId;
                    probableTZScore = score;
                    probableTZSource = (calProperties.GetStringFromName
                                        ("TZFromKnownTimezones"));
                }
                break;
            case 3:
                return tzId;
            }
        } catch (ex) { // bug if ics service doesn't recognize own tzid!
            var msg = ("ics-service doesn't recognize own tzid: "+tzId+"\n"+
                       ex);
            Components.utils.reportError(msg);
        }
    }

    // If reach here, there were no score=3 matches, so Warn in console.
    try { 
        switch(probableTZScore) {
        case 0:
            WARN(calProperties.GetStringFromName("warningUsingFloatingTZNoMatch"));
            break;
        case 1: case 2:
            var tzId = probableTZId;
            var tz = tzSvc.getTimezone(tzId);
            var subComp = tz.component;
            var standard = findCurrentTimePeriod(tz, subComp, "STANDARD");
            var standardTZOffset = getIcalString(standard, "TZOFFSETTO");
            var daylight = findCurrentTimePeriod(tz, subComp, "DAYLIGHT");
            var daylightTZOffset = getIcalString(daylight, "TZOFFSETTO");
            var warningDetail;
            if (probableTZScore == 1) {
                // score 1 means has daylight time,
                // but transitions start on different weekday from os timezone.
                function weekday(icsDate) {
                    var calDate = createDateTime();
                    calDate.icalString = icsDate;
                    calDate.timezone = tz;
                    return calDate.jsDate.toLocaleFormat("%a");
                }
                var standardStart = getIcalString(standard, "DTSTART");
                var standardStartWeekday = weekday(standardStart);
                var standardRule  = getIcalString(standard, "RRULE");
                var standardText = 
                    ("  Standard: "+standardStart+" "+standardStartWeekday+"\n"+
                     "            "+standardRule+"\n");
                var daylightStart = getIcalString(daylight, "DTSTART");
                var daylightStartWeekday = weekday(daylightStart);
                var daylightRule  = getIcalString(daylight, "RRULE");
                var daylightText =
                    ("  Daylight: "+daylightStart+" "+daylightStartWeekday+"\n"+
                     "            "+daylightRule+"\n");
                warningDetail =
                    ((standardStart < daylightStart
                      ? standardText + daylightText
                      : daylightText + standardText)+
                     (calProperties.GetStringFromName
                      ("TZAlmostMatchesOSDifferAtMostAWeek")));
            } else {
                warningDetail =
                    (calProperties.GetStringFromName("TZSeemsToMatchOS"));
            }
            var offsetString = (standardTZOffset+
                                 (!daylightTZOffset? "": "/"+daylightTZOffset));
            var warningMsg = (calProperties.formatStringFromName
                              ("WarningUsingGuessedTZ",
                               [tzId, offsetString, warningDetail,
                                probableTZSource], 4));
            WARN(warningMsg);
            break;
        }
    } catch (ex) { // don't abort if error occurs warning user
        Components.utils.reportError(ex);
    }

    // return the guessed timezone
    return probableTZId;
}

/**
 * Shared dialog functions
 * Gets the calendar directory, defaults to <profile-dir>/calendar
 */
function getCalendarDirectory() {
    if (getCalendarDirectory.mDir === undefined) {
        var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                               .getService(Components.interfaces.nsIProperties);
        var dir = dirSvc.get("ProfD", Components.interfaces.nsILocalFile);
        dir.append("calendar-data");
        if (!dir.exists()) {
            try {
                dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
            } catch (exc) {
                ASSERT(false, exc);
                throw exc;
            }
        }
        getCalendarDirectory.mDir = dir;
    }
    return getCalendarDirectory.mDir.clone();
}

/**
 * Check if the specified calendar is writable. This is the case when it is not
 * marked readOnly, we are not offline, or we are offline and the calendar is
 * local.
 *
 * @param aCalendar     The calendar to check
 * @return              True if the calendar is writable
 */
function isCalendarWritable(aCalendar) {
    return (!aCalendar.readOnly &&
           (!getIOService().offline ||
            aCalendar.getProperty("requiresNetwork") === false));
}

/**
 * Opens the Create Calendar wizard
 *
 * @param aCallback  a function to be performed after calendar creation
 */
function openCalendarWizard(aCallback) {
    openDialog("chrome://calendar/content/calendarCreation.xul", "caEditServer",
               "chrome,titlebar,modal", aCallback);
}

/**
 * Opens the calendar properties window for aCalendar
 *
 * @param aCalendar  the calendar whose properties should be displayed
 */
function openCalendarProperties(aCalendar) {
    openDialog("chrome://calendar/content/calendar-properties-dialog.xul",
               "calendar-properties-dialog",
               "chrome,titlebar,modal",
               {calendar: aCalendar});
}

/**
 * Opens the print dialog
 */
function calPrint() {
    openDialog("chrome://calendar/content/printDialog.xul", "Print",
               "centerscreen,chrome,resizable");
}

/**
 * Other functions
 */

/**
 * Takes a string and returns an nsIURI
 *
 * @param aUriString  the string of the address to for the spec of the nsIURI
 *
 * @returns  an nsIURI whose spec is aUriString
 */
function makeURL(aUriString) {
    var ioSvc = Components.classes["@mozilla.org/network/io-service;1"].
                getService(Components.interfaces.nsIIOService);
    return ioSvc.newURI(aUriString, null, null);
}

/**
 * Returns a calIDateTime that corresponds to the current time in the user's
 * default timezone.
 */
function now() {
    var d = createDateTime();
    d.jsDate = new Date();
    return d.getInTimezone(calendarDefaultTimezone());
}

/**
 * Returns a calIDateTime corresponding to a javascript Date.
 *
 * @param aDate     a javascript date
 * @param aTimezone (optional) a timezone that should be enforced
 * @returns         a calIDateTime
 *
 * @warning  Use of this function is strongly discouraged.  calIDateTime should
 *           be used directly whenever possible.
 *           If you pass a timezone, then the passed jsDate's timezone will be ignored,
 *           but only its local time portions are be taken.
 */
function jsDateToDateTime(aDate, aTimezone) {
    var newDate = createDateTime();
    if (aTimezone) {
        newDate.resetTo(aDate.getFullYear(),
                        aDate.getMonth(),
                        aDate.getDate(),
                        aDate.getHours(),
                        aDate.getMinutes(),
                        aDate.getSeconds(),
                        aTimezone);
    } else {
        newDate.jsDate = aDate;
    }
    return newDate;
}

/**
 * Selects an item with id aItemId in the radio group with id aRadioGroupId
 *
 * @param aRadioGroupId  the id of the radio group which contains the item
 * @param aItemId        the item to be selected
 */
function calRadioGroupSelectItem(aRadioGroupId, aItemId) {
    var radioGroup = document.getElementById(aRadioGroupId);
    var items = radioGroup.getElementsByTagName("radio");
    var index;
    for (var i in items) {
        if (items[i].getAttribute("id") == aItemId) {
            index = i;
            break;
        }
    }
    ASSERT(index && index != 0, "Can't find radioGroup item to select.", true);
    radioGroup.selectedIndex = index;
}


/** checks if an item is supported by a Calendar
* @param aCalendar the calendar
* @param aItem the item either a task or an event
* @return true or false
*/
function isItemSupported(aItem, aCalendar) {
    if (isToDo(aItem)) {
        return (aCalendar.getProperty("capabilities.tasks.supported") !== false);
    } else if (isEvent(aItem)) {
        return (aCalendar.getProperty("capabilities.events.supported") !== false);
    }
    return false;
}

/**
 * Determines whether or not the aObject is a calIEvent
 *
 * @param aObject  the object to test
 * @returns        true if the object is a calIEvent, false otherwise
 */
function isEvent(aObject) {
    return aObject instanceof Components.interfaces.calIEvent;
}

/**
 * Determines whether or not the aObject is a calITodo
 *
 * @param aObject  the object to test
 * @returns        true if the object is a calITodo, false otherwise
 */
function isToDo(aObject) {
    return aObject instanceof Components.interfaces.calITodo;
}

/**
 * Normal get*Pref calls will throw if the pref is undefined.  This function
 * will get a bool, int, or string pref.  If the pref is undefined, it will
 * return aDefault.
 *
 * @param aPrefName   the (full) name of preference to get
 * @param aDefault    (optional) the value to return if the pref is undefined
 */
function getPrefSafe(aPrefName, aDefault) {
    const nsIPrefBranch = Components.interfaces.nsIPrefBranch;
    const prefB = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(nsIPrefBranch);
    // Since bug 193332 does not fix the current branch, calling get*Pref will
    // throw NS_ERROR_UNEXPECTED if clearUserPref() was called and there is no
    // default value. To work around that, catch the exception.
    try {
        switch (prefB.getPrefType(aPrefName)) {
            case nsIPrefBranch.PREF_BOOL:
                return prefB.getBoolPref(aPrefName);
            case nsIPrefBranch.PREF_INT:
                return prefB.getIntPref(aPrefName);
            case nsIPrefBranch.PREF_STRING:
                return prefB.getCharPref(aPrefName);
            default: // includes nsIPrefBranch.PREF_INVALID
                return aDefault;
        }
    } catch (e) {
        return aDefault;
    }
}

/**
 * Wrapper for setting prefs of various types
 *
 * @param aPrefName   the (full) name of preference to set
 * @param aPrefType   the type of preference to set.  Valid valuse are:
                        BOOL, INT, and CHAR
 * @param aPrefValue  the value to set the pref to
 */
function setPref(aPrefName, aPrefType, aPrefValue) {
    const nsIPrefBranch = Components.interfaces.nsIPrefBranch;
    const prefB = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(nsIPrefBranch);
    switch (aPrefType) {
        case "BOOL":
            prefB.setBoolPref(aPrefName, aPrefValue);
            break;
        case "INT":
            prefB.setIntPref(aPrefName, aPrefValue);
            break;
        case "CHAR":
            prefB.setCharPref(aPrefName, aPrefValue);
            break;
    }
}

/**
 * Helper function to set a localized (complex) pref from a given string
 *
 * @param aPrefName   the (full) name of preference to set
 * @param aString     the string to which the preference value should be set
 */
function setLocalizedPref(aPrefName, aString) {
    const prefB = Components.classes["@mozilla.org/preferences-service;1"].
                  getService(Components.interfaces.nsIPrefBranch);
    var str = Components.classes["@mozilla.org/supports-string;1"].
              createInstance(Components.interfaces.nsISupportsString);
    str.data = aString;
    prefB.setComplexValue(aPrefName, Components.interfaces.nsISupportsString, str);
}

/**
 * Like getPrefSafe, except for complex prefs (those used for localized data).
 *
 * @param aPrefName   the (full) name of preference to get
 * @param aDefault    (optional) the value to return if the pref is undefined
 */
function getLocalizedPref(aPrefName, aDefault) {
    const pb2 = Components.classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefBranch2);
    var result;
    try {
        result = pb2.getComplexValue(aPrefName, Components.interfaces.nsISupportsString).data;
    } catch(ex) {
        return aDefault;
    }
    return result;
}

/**
 * Get array of category names from preferences or locale default,
 * unescaping any commas in each category name.
 * @return array of category names
 */
function getPrefCategoriesArray() {
    var categories = getLocalizedPref("calendar.categories.names", null);
    // If no categories are configured load a default set from properties file
    if (!categories || categories == "") {
        categories = calGetString("categories", "categories");
        setLocalizedPref("calendar.categories.names", categories);
    }
    return categoriesStringToArray(categories);
}

/**
 * Convert categories string to list of category names.
 *
 * Stored categories may include escaped commas within a name.
 * Split categories string at commas, but not at escaped commas (\,).
 * Afterward, replace escaped commas (\,) with commas (,) in each name.
 * @param aCategoriesPrefValue string from "calendar.categories.names" pref,
 * which may contain escaped commas (\,) in names.
 * @return list of category names
 */
function categoriesStringToArray(aCategories) {
    if (!aCategories) {
        return [];
    }
    // \u001A is the unicode "SUBSTITUTE" character
    function revertCommas(name) { return name.replace(/\u001A/g, ","); }
    return aCategories.replace(/\\,/g, "\u001A").split(",").map(revertCommas);
}

/**
 * Set categories preference, escaping any commas in category names.
 * @param aCategoriesArray array of category names,
 * may contain unescaped commas which will be escaped in combined pref.
 */
function setPrefCategoriesFromArray(aCategoriesArray) {
    setLocalizedPref("calendar.categories.names",
                     categoriesArrayToString(aCategoriesList));
}

/**
 * Convert array of category names to string.
 *
 * Category names may contain commas (,).  Escape commas (\,) in each,
 * then join them in comma separated string for storage.
 * @param aSortedCategoriesArray sorted array of category names,
 * may contain unescaped commas, which will be escaped in combined string.
 */
function categoriesArrayToString(aSortedCategoriesArray) {
    function escapeComma(category) { return category.replace(/,/g,"\\,"); }
    return aSortedCategoriesArray.map(escapeComma).join(",");
}

/**
 * Sort an array of strings according to the current locale.
 * Modifies aStringArray, returning it sorted.
 */
function sortArrayByLocaleCollator(aStringArray) {
    // get a current locale string collator for compareEvents
    var localeService =
        Components
        .classes["@mozilla.org/intl/nslocaleservice;1"]
        .getService(Components.interfaces.nsILocaleService);
    var localeCollator =
        Components
        .classes["@mozilla.org/intl/collation-factory;1"]
        .getService(Components.interfaces.nsICollationFactory)
        .CreateCollation(localeService.getApplicationLocale());
    function compare(a, b) { return localeCollator.compareString(0, a, b); }
    aStringArray.sort(compare);
    return aStringArray;
}

/**
 * Gets the value of a string in a .properties file from the calendar bundle
 *
 * @param aBundleName  the name of the properties file.  It is assumed that the
 *                     file lives in chrome://calendar/locale/
 * @param aStringName  the name of the string within the properties file
 * @param aParams      optional array of parameters to format the string
 * @param aComponent   optional stringbundle component name
 */
function calGetString(aBundleName, aStringName, aParams, aComponent) {
    if (calGetString.mSBS === undefined) {
        calGetString.mSBS = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                      .getService(Components.interfaces.nsIStringBundleService);
    }

    try {
        if (!aComponent) {
            aComponent = "calendar";
        }
        var propName = "chrome://" + aComponent + "/locale/" + aBundleName + ".properties";
        var props = calGetString.mSBS.createBundle(propName);

        if (aParams && aParams.length) {
            return props.formatStringFromName(aStringName, aParams, aParams.length);
        } else {
            return props.GetStringFromName(aStringName);
        }
    } catch (ex) {
        var s = "Failed to read '" + aStringName + "' from " +
                "'chrome://calendar/locale/" + aBundleName + ".properties'.";
        Components.utils.reportError(s + " Error: " + ex);
        return s;
    }
}

/** Returns a best effort at making a UUID.  If we have the UUIDGenerator
 * service available, we'll use that.  If we're somewhere where it doesn't
 * exist, like Lightning in TB 1.5, we'll just use the current time.
 */
function getUUID() {
    if ("@mozilla.org/uuid-generator;1" in Components.classes) {
        var uuidGen = Components.classes["@mozilla.org/uuid-generator;1"].
                      getService(Components.interfaces.nsIUUIDGenerator);
        // generate uuids without braces to avoid problems with 
        // CalDAV servers that don't support filenames with {}
        return uuidGen.generateUUID().toString().replace(/[{}]/g, '');
    }
    // No uuid service (we're on the 1.8.0 branch)
    return "uuid" + (new Date()).getTime();
}

/** Due to a bug in js-wrapping, normal == comparison can fail when we
 * have 2 objects.  Use these functions to force them both to get wrapped
 * the same way, allowing for normal comparison.
 */
 
/**
 * calIItemBase comparer
 */
function compareItems(aItem, aOtherItem) {
    var sip1 = Components.classes["@mozilla.org/supports-interface-pointer;1"].
               createInstance(Components.interfaces.nsISupportsInterfacePointer);
    sip1.data = aItem;
    sip1.dataIID = Components.interfaces.calIItemBase;

    var sip2 = Components.classes["@mozilla.org/supports-interface-pointer;1"].
               createInstance(Components.interfaces.nsISupportsInterfacePointer);
    sip2.data = aOtherItem;
    sip2.dataIID = Components.interfaces.calIItemBase;
    return sip1.data == sip2.data;
}

/**
 * Generic object comparer
 * Use to compare two objects which are not of type calIItemBase, in order
 * to avoid the js-wrapping issues mentioned above.
 *
 * @param aObject        first object to be compared
 * @param aOtherObject   second object to be compared
 * @param aIID           IID to use in comparison, undefined/null defaults to nsISupports
 */
function compareObjects(aObject, aOtherObject, aIID) {
    // xxx todo: seems to work fine e.g. for WCAP, but I still mistrust this trickery...
    //           Anybody knows an official API that could be used for this purpose?
    //           For what reason do clients need to pass aIID since
    //           every XPCOM object has to implement nsISupports?
    //           XPCOM (like COM, like UNO, ...) defines that QueryInterface *only* needs to return
    //           the very same pointer for nsISupports during its lifetime.
    if (!aIID) {
        aIID = Components.interfaces.nsISupports;
    }
    var sip1 = Components.classes["@mozilla.org/supports-interface-pointer;1"].
               createInstance(Components.interfaces.nsISupportsInterfacePointer);
    sip1.data = aObject;
    sip1.dataIID = aIID;

    var sip2 = Components.classes["@mozilla.org/supports-interface-pointer;1"].
               createInstance(Components.interfaces.nsISupportsInterfacePointer);
    sip2.data = aOtherObject;
    sip2.dataIID = aIID;
    return sip1.data == sip2.data;
}

/**
 * Compare two arrays using the passed function.
 */
function compareArrays(aOne, aTwo, compareFunc) {
    if (!aOne && !aTwo)
        return true;
    if (!aOne || !aTwo)
        return false;
    var len = aOne.length;
    if (len != aTwo.length)
        return false;
    for (var i = 0; i < len; ++i) {
        if (!compareFunc(aOne[i], aTwo[i]))
            return false;
    }
    return true;
}

/**
 * Takes care of all QueryInterface business, including calling the QI of any
 * existing parent prototypes.
 *
 * @param aSelf         The object the QueryInterface is being made to
 * @param aProto        Caller's prototype object
 * @param aIID          The IID to check for
 * @param aList         (Optional if aClassInfo is specified) An array of
 *                        interfaces from Components.interfaces
 * @param aClassInfo    (Optional) an Object containing the class info for this
 *                        prototype.
 */
function doQueryInterface(aSelf, aProto, aIID, aList, aClassInfo) {
    if (aClassInfo) {
        if (aIID.equals(Components.interfaces.nsIClassInfo)) {
            return aClassInfo;
        }
        if (!aList) {
            aList = aClassInfo.getInterfaces({});
        }
    }

    for each (var iid in aList) {
        if (aIID.equals(iid)) {
            return aSelf;
        }
    }

    if (aIID.equals(Components.interfaces.nsISupports)) {
        return aSelf;
    }

    if (aProto) {
        var base = aProto.__proto__;
        if (base && base.QueryInterface) {
            // Try to QI the base prototype
            return base.QueryInterface.call(aSelf, aIID);
        }
    }

    throw Components.results.NS_ERROR_NO_INTERFACE;
}

/**
 * Many computations want to work only with date-times, not with dates.  This
 * method will return a proper datetime (set to midnight) for a date object.  If
 * the object is already a datetime, it will simply be returned.
 *
 * @param aDate  the date or datetime to check
 */
function ensureDateTime(aDate) {
    if (!aDate || !aDate.isDate) {
        return aDate;
    }
    var newDate = aDate.clone();
    newDate.isDate = false;
    return newDate;
}

/**
 * Get the default event start date. This is the next full hour, or 23:00 if it
 * is past 23:00.
 *
 * @param aReferenceDate    If passed, the time of this date will be modified,
 *                            keeping the date and timezone intact.
 */
function getDefaultStartDate(aReferenceDate) {
    var startDate = now();
    if (aReferenceDate) {
        var savedHour = startDate.hour;
        startDate = aReferenceDate;
        if (!startDate.isMutable) {
            startDate = startDate.clone();
        }
        startDate.isDate = false;
        startDate.hour = savedHour;
    }

    startDate.second = 0;
    startDate.minute = 0;
    if (startDate.hour < 23) {
        startDate.hour++;
    }
    return startDate;
}

/**
 * Setup the default start and end hours of the given item. This can be a task
 * or an event.
 *
 * @param aItem     The item to set up the start and end date for.
 */
function setDefaultStartEndHour(aItem) {
    aItem[calGetStartDateProp(aItem)] = getDefaultStartDate();

    if (isEvent(aItem)) {
        aItem.endDate = aItem.startDate.clone();
        aItem.endDate.minute += getPrefSafe("calendar.event.defaultlength", 60);
    }
}

/****
 **** debug code
 ****/

/**
 * Logs a string or an object to both stderr and the js-console only in the case 
 * where the calendar.debug.log pref is set to true.
 *
 * @param aArg  either a string to log or an object whose entire set of 
 *              properties should be logged.
 */
function LOG(aArg) {
    var prefB = Components.classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefBranch);
    var shouldLog = false;
    try {
        shouldLog = prefB.getBoolPref("calendar.debug.log");
    } catch(ex) {}

    if (!shouldLog) {
        return;
    }
    ASSERT(aArg, "Bad log argument.", false);
    var string;
    // We should just dump() both String objects, and string primitives.
    if (!(aArg instanceof String) && !(typeof(aArg) == "string")) {
        var string = "Logging object...\n";
        for (var prop in aArg) {
            string += prop + ': ' + aArg[prop] + '\n';
        }
        string += "End object\n";
    } else {
        string = aArg;
    }
 
    dump(string + '\n');
    getConsoleService().logStringMessage(string);
}

/**
 * Dumps a warning to both console and js console.
 *
 * @param aMessage warning message
 */
function WARN(aMessage) {
    dump("Warning: " + aMessage + '\n');
    var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                                .createInstance(Components.interfaces.nsIScriptError);
    scriptError.init(aMessage, null, null, 0, 0,
                     Components.interfaces.nsIScriptError.warningFlag,
                     "component javascript");
    getConsoleService().logMessage(scriptError);
}

/**
 * Returns a string describing the current js-stack with filename and line
 * numbers.
 *
 * @param aDepth (optional) The number of frames to include. Defaults to 5.
 */
function STACK(aDepth) {
    var depth = aDepth || 5;
    var stack = "";
    var frame = Components.stack.caller;
    for (var i = 1; i <= depth && frame; i++) {
        stack += i + ": [" + frame.filename + ":" +
                 frame.lineNumber + "] " + frame.name + "\n";
        frame = frame.caller;
    }
    return stack;
}

/**
 * Logs a message and the current js-stack, if aCondition fails
 *
 * @param aCondition  the condition to test for
 * @param aMessage    the message to report in the case the assert fails
 * @param aCritical   if true, throw an error to stop current code execution
 *                    if false, code flow will continue
 */
function ASSERT(aCondition, aMessage, aCritical) {
    if (aCondition) {
        return;
    }

    var string = "Assert failed: " + aMessage + '\n' + STACK();
    if (aCritical) {
        throw new Error(string);
    } else {
        Components.utils.reportError(string);
    }
}

/**
 * Uses the prompt service to display an error message.
 *
 * @param aMsg The message to be shown
 */
function showError(aMsg) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);

    promptService.alert(window,
                        calGetString("calendar", "errorTitle"),
                        aMsg);
}

/**
 * Pick whichever of "black" or "white" will look better when used as a text
 * color against a background of bgColor. 
 *
 * @param bgColor   the background color as a "#RRGGBB" string
 */
function getContrastingTextColor(bgColor)
{
    var calcColor = bgColor.replace(/#/g, "");
    var red = parseInt(calcColor.substring(0, 2), 16);
    var green = parseInt(calcColor.substring(2, 4), 16);
    var blue = parseInt(calcColor.substring(4, 6), 16);

    // Calculate the brightness (Y) value using the YUV color system.
    var brightness = (0.299 * red) + (0.587 * green) + (0.114 * blue);

    // Consider all colors with less than 56% brightness as dark colors and
    // use white as the foreground color, otherwise use black.
    if (brightness < 144) {
        return "white";
    }

    return "black";
}

/**
 * Returns the property name used for the start date of an item, ie either an
 * event's start date or a task's entry date.
 */
function calGetStartDateProp(aItem) {
    if (isEvent(aItem)) {
        return "startDate";
    } else if (isToDo(aItem)) {
        return "entryDate";
    }
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

/**
 * Returns the property name used for the end date of an item, ie either an
 * event's end date or a task's due date.
 */
function calGetEndDateProp(aItem) {
    if (isEvent(aItem)) {
        return "endDate";
    } else if (isToDo(aItem)) {
        return "dueDate";
    }
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

/**
 * Checks whether the passed item fits into the demanded range.
 *
 * @param item               the item
 * @param rangeStart         (inclusive) range start or null (open range)
 * @param rangeStart         (exclusive) range end or null (open range)
 * @param returnDtstartOrDue returns item's start (or due) date in case
 *                           the item is in the specified Range; null otherwise.
 */
function checkIfInRange(item, rangeStart, rangeEnd, returnDtstartOrDue)
{
    var startDate;
    var endDate;
    if (isEvent(item)) {
        startDate = item.startDate;
        if (!startDate) { // DTSTART mandatory
            // xxx todo: should we assert this case?
            return null;
        }
        endDate = (item.endDate || startDate);
    } else {
        var dueDate = item.dueDate;
        startDate = (item.entryDate || dueDate);
        if (!startDate) {
            if (returnDtstartOrDue) { // DTSTART or DUE mandatory
                return null;
            }
            // 3.6.2. To-do Component
            // A "VTODO" calendar component without the "DTSTART" and "DUE" (or
            // "DURATION") properties specifies a to-do that will be associated
            // with each successive calendar date, until it is completed.
            var completedDate = item.completedDate;
            if (completedDate) {
                var queryStart = ensureDateTime(rangeStart);
                completedDate = ensureDateTime(completedDate);
                return (!queryStart || completedDate.compare(queryStart) > 0);
            }
            return true;
        }
        endDate = (dueDate || startDate);
    }

    var start = ensureDateTime(startDate);
    var end = ensureDateTime(endDate);

    var queryStart = ensureDateTime(rangeStart);
    var queryEnd = ensureDateTime(rangeEnd);

    if (start.compare(end) == 0) {
        if ((!queryStart || start.compare(queryStart) >= 0) &&
            (!queryEnd || start.compare(queryEnd) < 0)) {
            return startDate;
        }
    } else {
        if ((!queryEnd || start.compare(queryEnd) < 0) &&
            (!queryStart || end.compare(queryStart) > 0)) {
            return startDate;
        }
    }
    return null;
}

/**
 * This function return the progress state of a task:
 * completed, overdue, duetoday, inprogress, future
 *
 * @param aTask     The task to check.
 * @return          The progress atom.
 */
function getProgressAtom(aTask) {
    var now = new Date();

    if (aTask.isCompleted)
      return "completed";

    if (aTask.dueDate && aTask.dueDate.isValid) {
        if (aTask.dueDate.jsDate.getTime() < now.getTime()) {
            return "overdue";
        } else if (aTask.dueDate.year == now.getFullYear() &&
                   aTask.dueDate.month == now.getMonth() &&
                   aTask.dueDate.day == now.getDate()) {
            return "duetoday";
        }
    }

    if (aTask.entryDate && aTask.entryDate.isValid &&
        aTask.entryDate.jsDate.getTime() < now.getTime()) {
        return "inprogress";
    }

    return "future";
}

/**
 * Returns true if we are Sunbird (according to our UUID), false otherwise.
 */
function isSunbird()
{
    const kSUNBIRD_UID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
                  getService(Components.interfaces.nsIXULAppInfo);

    return appInfo.ID == kSUNBIRD_UID;
}



function hasPositiveIntegerValue(elementId)
{
    var value = document.getElementById(elementId).value;
    if (value && (parseInt(value) == value) && value > 0) {
        return true;
    }
    return false;
}

function getAtomFromService(aStr) {
    var atomService = Components.classes["@mozilla.org/atom-service;1"]
                      .getService(Components.interfaces.nsIAtomService);
    return atomService.getAtom(aStr);
}

function calInterfaceBag(iid) {
    this.init(iid);
}
calInterfaceBag.prototype = {
    mIid: null,
    mInterfaces: null,

    /// internal:
    init: function calInterfaceBag_init(iid) {
        this.mIid = iid;
        this.mInterfaces = [];
    },

    /// external:
    get size() {
        return this.mInterfaces.length;
    },

    get interfaceArray() {
        return this.mInterfaces;
    },

    add: function calInterfaceBag_add(iface) {
        if (iface) {
            var iid = this.mIid;
            function eq(obj) {
                return compareObjects(obj, iface, iid);
            }
            if (!this.mInterfaces.some(eq)) {
                this.mInterfaces.push(iface);
            }
        }
    },

    remove: function calInterfaceBag_remove(iface) {
        if (iface) {
            var iid = this.mIid;
            function neq(obj) {
                return !compareObjects(obj, iface, iid);
            }
            this.mInterfaces = this.mInterfaces.filter(neq);
        }
    },

    forEach: function calInterfaceBag_forEach(func) {
        this.mInterfaces.forEach(func);
    }
};

function calListenerBag(iid) {
    this.init(iid);
}
calListenerBag.prototype = {
    __proto__: calInterfaceBag.prototype,

    notify: function calListenerBag_notify(func, args) {
        function notifyFunc(iface) {
            try {
                iface[func].apply(iface, args ? args : []);
            }
            catch (exc) {
                Components.utils.reportError(exc + " STACK: " + STACK());
            }
        }
        this.mInterfaces.forEach(notifyFunc);
    }
};

function sendMailTo(aRecipient, aSubject, aBody) {

    if (Components.classes["@mozilla.org/messengercompose;1"]) {
        // We are in Thunderbird, we can use the compose interface directly
        var msgComposeService = Components.classes["@mozilla.org/messengercompose;1"]
                                .getService(Components.interfaces.nsIMsgComposeService);
        var msgParams = Components.classes["@mozilla.org/messengercompose/composeparams;1"]
                        .createInstance(Components.interfaces.nsIMsgComposeParams);
        var composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"]
                            .createInstance(Components.interfaces.nsIMsgCompFields);

        composeFields.to = aRecipient;
        composeFields.subject = aSubject;
        composeFields.body = aBody;

        msgParams.type = Components.interfaces.nsIMsgCompType.New;
        msgParams.format = Components.interfaces.nsIMsgCompFormat.Default;
        msgParams.composeFields = composeFields;

        msgComposeService.OpenComposeWindowWithParams(null, msgParams);
    } else {
        // We are in a place without a composer. Use the external protocol
        // service.
        var protoSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                       .getService(Components.interfaces.nsIExternalProtocolService);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);

        var uriString = "mailto:";
        var uriParams = [];
        if (aRecipient) {
            uriString += aRecipient;
        }

        if (aSubject) {
            uriParams.push("subject=" + encodeURIComponent(aSubject));
        }

        if (aBody) {
            uriParams.push("body=" + encodeURIComponent(aSubject));
        }

        if (uriParams.length > 0) {
            uriString += "?" + uriParams.join("&");
        }

        protoSvc.loadUrl(ioService.newURI(uriString, null, null));
    }
}

/**
 * This object implements calIOperation and could group multiple sub
 * operations into one. You can pass a cancel function which is called once
 * the operation group is cancelled.
 * Users must call notifyCompleted() once all sub operations have been
 * successful, else the operation group will stay pending.
 * The reason for the latter is that providers currently should (but need
 * not) implement (and return) calIOperation handles, thus there may be pending
 * calendar operations (without handle).
 */
function calOperationGroup(cancelFunc) {
    this.wrappedJSObject = this;
    if (calOperationGroup.mOpGroupId === undefined) {
        calOperationGroup.mOpGroupId = 0;
    }
    if (calOperationGroup.mOpGroupPrefix === undefined) {
        calOperationGroup.mOpGroupPrefix = (getUUID() + "-");
    }
    this.mCancelFunc = cancelFunc;
    this.mId = (calOperationGroup.mOpGroupPrefix + calOperationGroup.mOpGroupId++);
    this.mSubOperations = [];
}
calOperationGroup.prototype = {
    mCancelFunc: null,
    mId: null,
    mIsPending: true,
    mStatus: Components.results.NS_OK,
    mSubOperations: null,

    add: function calOperationGroup_add(op) {
        if (op && op.isPending) {
            this.mSubOperations.push(op);
        }
    },

    remove: function calOperationGroup_remove(op) {
        if (op) {
            function filterFunc(op_) {
                return (op.id != op_.id);
            }
            this.mSubOperations = this.mSubOperations.filter(filterFunc);
        }
    },

    get isEmpty() {
        return (this.mSubOperations.length == 0);
    },

    notifyCompleted: function calOperationGroup_notifyCompleted(status) {
        ASSERT(this.isPending, "[calOperationGroup_notifyCompleted] this.isPending");
        if (this.isPending) {
            this.mIsPending = false;
            if (status) {
                this.mStatus = status;
            }
        }
    },

    toString: function calOperationGroup_toString() {
        return ("[calOperationGroup] id=" + this.id);
    },

    // calIOperation:
    get id() {
        return this.mId;
    },

    get isPending() {
        return this.mIsPending;
    },

    get status() {
        return this.mStatus;
    },

    cancel: function calOperationGroup_cancel(status) {
        if (this.isPending) {
            if (!status) {
                status = Components.interfaces.calIErrors.OPERATION_CANCELLED;
            }
            this.notifyCompleted(status);
            var cancelFunc = this.mCancelFunc;
            if (cancelFunc) {
                this.mCancelFunc = null;
                cancelFunc();
            }
            var subOperations = this.mSubOperations;
            this.mSubOperations = [];
            function forEachFunc(op) {
                op.cancel(Components.interfaces.calIErrors.OPERATION_CANCELLED);
            }
            subOperations.forEach(forEachFunc);
        }
    }
};

function sameDay(date1, date2) {
    if (date1 && date2) {
        if ((date1.day == date2.day) &&
            (date1.month == date2.month) &&
            (date1.year == date2.year)) {
              return true;
        }
    }
    return false;
}

/**
 * Centralized funtions for accessing prodid and version
 */
function calGetProductId() {
    return "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
}
function calGetProductVersion() {
    return "2.0";
}

/**
 * This is a centralized function for setting the prodid and version on an
 * ical component.  This should be used whenever you need to set the prodid
 * and version on a calIcalComponent object.
 *
 * @param
 *      aIcalComponent  The ical component to set the prodid and version on.
 */
function calSetProdidVersion(aIcalComponent) {
    // Throw for an invalid parameter
    if (!(aIcalComponent instanceof Components.interfaces.calIIcalComponent)) {
        throw Components.results.NS_ERROR_INVALID_ARG;
    }
    // Set the prodid and version
    aIcalComponent.prodid = calGetProductId();
    aIcalComponent.version = calGetProductVersion();
}

/**
 * This function returns a sibling of a XUL element, that is positioned behind
 * it in the DOM hierarchy *
 * @param
 *      aElement  The XUL element to derive the sibling from
 * @param
 *      aDistance  An integer value denoting how the relative position 
 *                  of the returned sibling within the parent container
 */
function getAdjacentSibling(aElement, aDistance) {
    var retElement = aElement;
    if (aDistance > 0) {
        for (var i = 0; i < aDistance; i++) {
            if (retElement) {
                try {
                    retElement = retElement.nextSibling;
                } catch (e) {
                    retElement = null;
                    i = aDistance;
                }
            }
        }
    }
    return retElement;
}

/**
 * deeply clones a popupmenu
 *
 * @param aMenuPopupId The Id of the popup-menu to be cloned
 * @param aNewPopupId The new id of the cloned popup-menu
 * @param aNewIdPrefix To keep the ids unique the childnodes of the returned 
 * popup-menu are prepended with a prefix
 * @return the cloned popup-menu
 */
function clonePopupMenu(aMenuPopupId, aNewPopupId, aNewIdPrefix) {
    var oldMenuPopup = document.getElementById(aMenuPopupId);
    var retMenuPopup = oldMenuPopup.cloneNode(true);
    retMenuPopup.setAttribute("id", aNewPopupId);
    var menuElements = retMenuPopup.getElementsByAttribute("id", "*");
    for (var i = 0; i < menuElements.length; i++) {
        var lid = menuElements[i].getAttribute("id");
        menuElements[i].setAttribute("id", aNewIdPrefix + lid);
    }
    return retMenuPopup;
}

/**
 * applies a value to all children of a Menu. If the respective childnodes define
 * a command the value is applied to the attribute of thecommand of the childnode
 *
 * @param aElement The parentnode of the elements
 * @param aAttributeName The name of the attribute
 * @param aValue The value of the attribute
 */
function applyAttributeToMenuChildren(aElement, aAttributeName, aValue) {
   var sibling = aElement.firstChild;
   do {
       if (sibling) {
           var domObject = sibling;
           var commandName = null;
           if (sibling.hasAttribute("command")){
               commandName = sibling.getAttribute("command");
           }
           if (commandName) {
               var command = document.getElementById(commandName);
               if (command) {
                   domObject = command;
               }
           }
           domObject.setAttribute(aAttributeName, aValue);
       sibling = sibling.nextSibling;          
       }
    } while (sibling);
  }


/**
 * compares the value of a property of an array of objects and returns 
 * true or false if it is same or not among all array members 
 *
 * @param aObjects An Array of Objects to inspect
 * @param aProperty Name the name of the Property of which the value is compared
 */
function isPropertyValueSame(aObjects, aPropertyName) {
    var value = null;
    for (var i = 0; i < aObjects.length; i++) {
        if (!value) {
            value = aObjects[0][aPropertyName];
        }
        var compValue = aObjects[i][aPropertyName];
        if (compValue != value ) {
            return false;
        }
    }
    return true;
}
  
/**
 * sets the value of a boolean attribute by either setting the value or 
 * removing the attribute
 *
 * @param aXulElement The XulElement the attribute is applied to
 * @param aAttribute the name of the attribute
 * @param aValue the boolean value
 */
function setBooleanAttribute(aXulElement, aAttribute, aValue) {
    if (aXulElement) {
        if (aValue) {
            aXulElement.setAttribute(aAttribute, "true");
        }
        else {
            if (aXulElement.hasAttribute(aAttribute)) {
                aXulElement.removeAttribute(aAttribute);
            }
        }
    }
}

function getParentNode(aNode, aLocalName) {
  var node = aNode;
  do {
      node = node && node.parentNode;      
  } while (node && (node.localName != aLocalName));
  return node;
}

function setItemProperty(item, propertyName, aValue, aCapability) {
    var isSupported = (item.calendar.getProperty("capabilities." + aCapability + ".supported") !== false)
    var value = (aCapability && !isSupported ? null : aValue);

    switch (propertyName) {
        case "startDate":
            if (value.isDate && !item.startDate.isDate ||
                !value.isDate && item.startDate.isDate ||
                !compareObjects(value.timezone, item.startDate.timezone) ||
                value.compare(item.startDate) != 0) {
                item.startDate = value;
            }
            break;
        case "endDate":
            if (value.isDate && !item.endDate.isDate ||
                !value.isDate && item.endDate.isDate ||
                !compareObjects(value.timezone, item.endDate.timezone) ||
                value.compare(item.endDate) != 0) {
                item.endDate = value;
            }
            break;
        case "entryDate":
            if (value == item.entryDate) {
                break;
            }
            if (value && !item.entryDate ||
                !value && item.entryDate ||
                value.isDate != item.entryDate.isDate ||
                !compareObjects(value.timezone, item.entryDate.timezone) ||
                value.compare(item.entryDate) != 0) {
                item.entryDate = value;
            }
            break;
        case "dueDate":
            if (value == item.dueDate) {
                break;
            }
            if (value && !item.dueDate ||
                !value && item.dueDate ||
                value.isDate != item.dueDate.isDate ||
                !compareObjects(value.timezone, item.dueDate.timezone) ||
                value.compare(item.dueDate) != 0) {
                item.dueDate = value;
            }
            break;
        case "isCompleted":
            if (value != item.isCompleted) {
                item.isCompleted = value;
            }
            break;
        case "title":
            if (value != item.title) {
                item.title = value;
            }
            break;
        default:
            if (!value || value == "") {
                item.deleteProperty(propertyName);
            } else if (item.getProperty(propertyName) != value) {
                item.setProperty(propertyName, value);
            }
            break;
    }
}


/**
 * Implements a property bag.
 */
function calPropertyBag() {
    this.mData = {};
}
calPropertyBag.prototype = {
    mData: null,

    setProperty: function cpb_setProperty(aName, aValue) {
        this.mData[aName] = aValue;
    },
    getProperty_: function cpb_getProperty(aName) {
        return this.mData[aName];
    },
    getProperty: function cpb_getProperty(aName) {
        var aValue = this.mData[aName];
        if (aValue === undefined) {
            aValue = null;
        }
        return aValue;
    },
    deleteProperty: function cpb_deleteProperty(aName) {
        delete this.mData[aName];
    },
    get enumerator() {
        return new calPropertyBagEnumerator(this);
    }
};
// implementation part of calPropertyBag
function calPropertyBagEnumerator(bag) {
    this.mIndex = 0;
    this.mBag = bag;
    var keys = [];
    for (var key in bag.mData) {
        keys.push(key);
    }
    this.mKeys = keys;
}
calPropertyBagEnumerator.prototype = {
    mIndex: 0,
    mBag: null,
    mKeys: null,

    // nsISimpleEnumerator:
    getNext: function cpb_enum_getNext() {
        if (!this.hasMoreElements()) { // hasMoreElements is called by intention to skip yet deleted properties
            ASSERT(false, Components.results.NS_ERROR_UNEXPECTED);
            throw Components.results.NS_ERROR_UNEXPECTED;
        }
        var name = this.mKeys[this.mIndex++];
        return { // nsIProperty:
            QueryInterface: function cpb_enum_prop_QueryInterface(aIID) {
                return doQueryInterface(this, null, aIID, [Components.interfaces.nsIProperty]);
            },
            name: name,
            value: this.mCurrentValue
        };
    },
    hasMoreElements: function cpb_enum_hasMoreElements() {
        while (this.mIndex < this.mKeys.length) {
            this.mCurrentValue = this.mBag.mData[this.mKeys[this.mIndex]];
            if (this.mCurrentValue !== undefined) {
                return true;
            }
            ++this.mIndex;
        }
        return false;
    }
};

// Send iTIP invitation
function sendItipInvitation(aItem, aTypeOfInvitation, aRecipientsList) {
    // XXX Until we rethink attendee support and until such support
    // is worked into the event dialog (which has been done in the prototype
    // dialog to a degree) then we are going to simply hack in some attendee
    // support so that we can round-trip iTIP invitations.
    var transportType = aItem.calendar.getProperty("itip.transportType") || "email";

    var transport = Components.classes["@mozilla.org/calendar/itip-transport;1?type=" + transportType]
                           .getService(Components.interfaces.calIItipTransport);

    var itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                             .createInstance(Components.interfaces.calIItipItem);

    var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                        .getService(Components.interfaces.nsIStringBundleService);

    var sb = sbs.createBundle("chrome://lightning/locale/lightning.properties");
    var recipients = [];

    // We have to modify our item a little, so we clone it.
    var item = aItem.clone();

    if (aRecipientsList.length == 0) {
        // Fix up our attendees for invitations using some good defaults
        var itemAtt = item.getAttendees({});
        item.removeAllAttendees();
        for each (var attendee in itemAtt) {
            attendee = attendee.clone();
            attendee.role = "REQ-PARTICIPANT";
            attendee.participationStatus = "NEEDS-ACTION";
            attendee.rsvp = true;
            item.addAttendee(attendee);
            recipients.push(attendee);
        }
    } else {
        recipients = aRecipientsList;
    }

    // XXX The event dialog has no means to set us as the organizer
    // since we defaulted to email above, we know we need to prepend
    // mailto when we convert it to an attendee
    // This also means that when we are Updating an event, we will be making
    // a blatant assumption that you (the updater) are the organizer of the event.
    // This is probably ok since we don't support the iTIP COUNTER method,
    // but it would be better if we didn't allow you to modify an event that you
    // are not the organizer of and send out invitations to it as if you were.
    // For this support, we'll need a real invitation manager component.
    var organizer = Components.classes["@mozilla.org/calendar/attendee;1"]
                              .createInstance(Components.interfaces.calIAttendee);
    organizer.id = transport.scheme + ":" + transport.defaultIdentity;
    organizer.role = "REQ-PARTICIPANT";
    organizer.participationStatus = "ACCEPTED";
    organizer.isOrganizer = true;

    // Add our organizer to the item. Again, the event dialog really doesn't
    // have a mechanism for creating an item with a method, so let's add
    // that too while we're at it.  We'll also fake Sequence ID support.
    item.organizer = organizer;
    item.setProperty("METHOD", aTypeOfInvitation);
    item.setProperty("SEQUENCE", item.generation);

    var summary
    if (item.getProperty("SUMMARY")) {
        summary = item.getProperty("SUMMARY");
    } else {
        summary = "";
    }

    // Initialize and set our properties on the item
    itipItem.init(item.icalString);
    itipItem.isSend = true;
    itipItem.receivedMethod = aTypeOfInvitation;
    itipItem.autoResponse = Components.interfaces.calIItipItem.USER;

    // Get ourselves some default text - when we handle organizer properly
    // We'll need a way to configure the Common Name attribute and we should
    // use it here rather than the email address
    var subjectStringId = "";
    var bodyStringId = "";
    switch (aTypeOfInvitation) {
        case 'REQUEST':
            subjectStringId = "itipRequestSubject";
            bodyStringId = "itipRequestBody";
            break;
        case 'CANCEL':
            subjectStringId = "itipCancelSubject";
            bodyStringId = "itipCancelBody";
            break;
    }
    
    var subject = sb.formatStringFromName(subjectStringId,
                                          [summary], 1);
    var body = sb.formatStringFromName(bodyStringId,
                                       [transport.defaultIdentity, summary],
                                       2);

    // Send it!
    transport.sendItems(recipients.length, recipients, subject, body, itipItem);
}
