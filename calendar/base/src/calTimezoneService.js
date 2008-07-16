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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Gekacheka <gekacheka@yahoo.com>
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

var g_stringBundle = null;

function calIntrinsicTimezone(tzid, component, latitude, longitude) {
    this.wrappedJSObject = this;
    this.tzid = tzid;
    this.mComponent = component;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = latitude;
    this.longitude = longitude;
}
calIntrinsicTimezone.prototype = {
    toString: function calIntrinsicTimezone_toString() {
        return (this.component ? this.component.toString() : this.tzid);
    },

    get icalComponent calIntrinsicTimezone_get_icalcomponent() {
        var comp = this.mComponent;
        if (comp && (typeof(comp) == "string")) {
            this.mComponent = getIcsService().parseICS("BEGIN:VCALENDAR\r\n" + comp + "END:VCALENDAR\r\n", null)
                                             .getFirstSubcomponent("VTIMEZONE");
        }
        return this.mComponent;
    },

    get displayName calIntrinsicTimezone_get_displayName() {
        if (this.mDisplayName === undefined) {
            try {
                this.mDisplayName = g_stringBundle.GetStringFromName("pref.timezone." + this.tzid.replace(/\//g, "."));
            } catch (exc) {
                ASSERT(false, exc);
                this.mDisplayName = null;
            }
        }
        return this.mDisplayName;
    },

    get provider calIntrinsicTimezone_get_provider() {
        return getTimezoneService();
    }
};

function calStringEnumerator(stringArray) {
    this.mIndex = 0;
    this.mStringArray = stringArray;
}
calStringEnumerator.prototype = {
    // nsIUTF8StringEnumerator:
    hasMore: function calStringEnumerator_hasMore() {
        return (this.mIndex < this.mStringArray.length);
    },
    getNext: function calStringEnumerator_getNext() {
        if (!this.hasMore()) {
            throw Components.results.NS_ERROR_UNEXPECTED;
        }
        return this.mStringArray[this.mIndex++];
    }
};

function calTimezoneService() {
    this.wrappedJSObject = this;

    // floating
    this.floating = new calIntrinsicTimezone("floating", null, "", "");
    this.floating.isFloating = true;
    // UTC
    this.UTC = new calIntrinsicTimezone("UTC", null, "", "");
    this.UTC.isUTC = true;

    this.mTimezoneCache = {};
    this.mBlacklist = {};
    this.mTimezoneCache.floating = this.floating;
    this.mTimezoneCache.UTC = this.UTC;
    this.mTimezoneCache.utc = this.UTC;
}
calTimezoneService.prototype = {
    mTimezoneCache: null,
    mBlacklist: null,
    mDefaultTimezone: null,
    mHasSetupObservers: false,
    floating: null,
    UTC: null,

    createStatement: function calTimezoneService_createStatement(sql) {
        var statement = this.mDb.createStatement(sql);
        var ret = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
                            .createInstance(Components.interfaces.mozIStorageStatementWrapper);
        ret.initialize(statement);
        return ret;
    },

    ensureInitialized: function calTimezoneService_ensureInitialized() {
        if (!this.mDb) {
            // Calendar-timezones.xpi is preinstalled into the application, but
            // lightning.xpi yet doesn't contain the calendar-timezones.xpi, thus we package up
            // the timezones.sqlite as well as the timezones.properties into lightning for now.

            const kCalendarTimezonesXpiId = "calendar-timezones@mozilla.org";
            var sqlTzFile;
            var bundleURL;

            try {
                var extMgr = Components.classes["@mozilla.org/extensions/manager;1"]
                                       .getService(Components.interfaces.nsIExtensionManager);
                sqlTzFile = extMgr.getInstallLocation(kCalendarTimezonesXpiId).getItemLocation(kCalendarTimezonesXpiId);
                bundleURL = "chrome://calendar-timezones/locale/timezones.properties";
            } catch (exc) {
                try {
                    if (!isSunbird()) { // probe for lightning; xxx todo, this will vanish when we repackage lightning
                        const kLightningXpiId = "{e2fda1a4-762b-4020-b5ad-a41df1933103}";
                        sqlTzFile = extMgr.getInstallLocation(kLightningXpiId).getItemLocation(kLightningXpiId);
                        bundleURL = "chrome://lightning/locale/timezones.properties";
                    }
                } catch (exc) { // we land here in case of the unit tests:
                    var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                                           .getService(Components.interfaces.nsIProperties);
                    sqlTzFile = dirSvc.get("CurProcD", Components.interfaces.nsILocalFile);
                    sqlTzFile.append("extensions");
                    sqlTzFile.append(kCalendarTimezonesXpiId);
                    WARN("\### USING " + sqlTzFile.path);
                    var bundleFile = sqlTzFile.clone();
                    bundleFile.append("chrome");
                    bundleFile.append("calendar-timezones-en-US.jar");
                    bundleURL = "jar:" + getIOService().newFileURI(bundleFile).spec + "!/locale/en-US/timezones.properties";
                }
            }

            try {
                sqlTzFile.append("timezones.sqlite");
                LOG("using " + sqlTzFile.path);
                var dbService = Components.classes["@mozilla.org/storage/service;1"]
                                          .getService(Components.interfaces.mozIStorageService);
                this.mDb = dbService.openDatabase(sqlTzFile);
                this.mSelectByTzid = this.createStatement("SELECT * FROM tz_data WHERE tzid = :tzid LIMIT 1");

                var selectVersion = this.createStatement("SELECT version FROM tz_version LIMIT 1");
                try {
                    if (selectVersion.step()) {
                        this.mVersion = selectVersion.row.version;
                    }
                } finally {
                    selectVersion.reset();
                }
                LOG("timezones version: " + this.mVersion);

                g_stringBundle = calGetStringBundle(bundleURL);
            } catch (exc) {
                var msg = calGetString("calendar", "missingCalendarTimezonesError");
                Components.utils.reportError(msg);
                showError(msg);
            }
        }
    },

    // nsIClassInfo:
    getInterfaces: function calTimezoneService_getInterfaces(count) {
        const ifaces = [Components.interfaces.calITimezoneService,
                        Components.interfaces.calITimezoneProvider,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    classDescription: "Calendar Timezone Service",
    contractID: "@mozilla.org/calendar/timezone-service;1",
    classID: Components.ID("{1a23ace4-a0dd-43b4-96a8-b3cd419a14a5}"),
    getHelperForLanguage: function calTimezoneService_getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    QueryInterface: function calTimezoneService_QueryInterface(aIID) {
        return doQueryInterface(this, calTimezoneService.prototype, aIID, null, this);
    },

    // calITimezoneProvider:
    getTimezone: function calTimezoneService_getTimezone(tzid) {
        if (tzid.indexOf("/mozilla.org/") == 0) {
            // We know that our former tzids look like "/mozilla.org/<dtstamp>/continent/..."
            // The ending of the mozilla prefix is the index of that slash before the
            // continent. Therefore, we start looking for the prefix-ending slash
            // after position 13.
            tzid = tzid.substring(tzid.indexOf("/", 13) + 1);
        }

        var tz = this.mTimezoneCache[tzid];
        if (!tz && !this.mBlacklist[tzid]) {
            this.ensureInitialized();
            this.mSelectByTzid.params.tzid = tzid;
            if (this.mSelectByTzid.step()) {
                var row = this.mSelectByTzid.row;
                var alias = row.alias;
                if (alias && alias.length > 0) {
                    tz = alias; // resolve later
                } else {
                    tz = new calIntrinsicTimezone(row.tzid, row.component, row.latitude, row.longitude);
                }
            }
            this.mSelectByTzid.reset();
            if (tz && typeof(tz) == "string") {
                tz = this.getTimezone(tz); // resolve alias
            }
            if (tz) {
                this.mTimezoneCache[tzid] = tz;
            } else {
                this.mBlacklist[tzid] = true;
            }
        }
        return tz;
    },

    get timezoneIds calTimezoneService_get_timezoneIds() {
        if (!this.mTzids) {
            var tzids = [];
            this.ensureInitialized();
            var selectAllButAlias = this.createStatement("SELECT * FROM tz_data WHERE alias IS NULL");
            try {
                while (selectAllButAlias.step()) {
                    tzids.push(selectAllButAlias.row.tzid);
                }
            } finally {
                selectAllButAlias.reset();
            }
            this.mTzids = tzids;
        }
        return new calStringEnumerator(this.mTzids);
    },

    get version calTimezoneService_get_version() {
        this.ensureInitialized();
        return this.mVersion;
    },

    get defaultTimezone calTimezoneService_get_defaulTimezone() {
        if (!this.mDefaultTimezone) {
            var prefTzid = getPrefSafe("calendar.timezone.local", null);
            var tzid = prefTzid;
            if (!tzid) {
                tzid = guessSystemTimezone();
            }
            this.mDefaultTimezone = this.getTimezone(tzid);
            ASSERT(this.mDefaultTimezone, "Timezone not found: " + tzid);
            // Update prefs if necessary:
            if (this.mDefaultTimezone && this.mDefaultTimezone.tzid != prefTzid) {
                setPref("calendar.timezone.local", "CHAR", this.mDefaultTimezone.tzid);
            }

            // We need to observe the timezone preference to update the default
            // timezone if needed.
            this.setupObservers();
        }
        return this.mDefaultTimezone;
    },

    setupObservers: function calTimezoneService_setupObservers() {
        if (this.mHasSetupObservers) {
            return;
        }
        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);
        var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);
        var branch = prefService.getBranch("").QueryInterface(Components.interfaces.nsIPrefBranch2);
        branch.addObserver("calendar.timezone.local", this, false);
        observerSvc.addObserver(this, "xpcom-shutdown", false);
        this.mHasSetupObservers = true;
    },

    observe: function calTimezoneService_observe(aSubject, aTopic, aData) {
        if (aTopic == "xpcom-shutdown") {
            var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                              .getService(Components.interfaces.nsIObserverService);
            var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService);
            var branch = prefService.getBranch("")
                                    .QueryInterface(Components.interfaces.nsIPrefBranch2);

            branch.removeObserver("calendar.timezone.local", this);
            observerSvc.removeObserver(this, "xpcom-shutdown");
        } else if (aTopic == "nsPref:changed" && aData == "calendar.timezone.local") {
            // Unsetting the default timezone will make the next call to the
            // default timezone getter set up the correct timezone again.
            this.mDefaultTimezone = null;
        }
    }
};

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
        var prop = (component && component.getFirstProperty(property));
        return (prop ? prop.valueAsIcalString : null);
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

        // Have to handle UTC separately because it has no .icalComponent.
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

        var subComp = tz.icalComponent;
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
    const periodCalRule = createRecurrenceRule();
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

    const calProperties = calGetStringBundle("chrome://calendar/locale/calendar.properties");

    // First, try to detect operating system timezone.
    try {
        var osUserTimeZone = null;
        var zoneInfoIdFromOSUserTimeZone = null;
        var handler = Components.classes["@mozilla.org/network/protocol;1?name=http"]
                                .getService(Components.interfaces.nsIHttpProtocolHandler);

        if (handler.oscpu.match(/^Windows/)) {
            var regOSName, fileOSName;
            if (handler.oscpu.match(/^Windows NT/)) {
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
                const regKeyToZoneInfoBundle = calGetStringBundle("chrome://calendar/content/"+
                                                                  fileOSName + "ToZoneInfoTZId.properties");
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
            var tzId = zoneInfoIdFromOSUserTimeZone;
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
            var subComp = tz.icalComponent;
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
