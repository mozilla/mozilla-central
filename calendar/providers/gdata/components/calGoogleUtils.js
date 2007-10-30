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
 * The Original Code is Google Calendar Provider code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joey Minta <jminta@gmail.com>
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

// This global keeps the session Objects for the usernames
var g_sessionMap;

function getCalendarManager() {
    return Components.classes["@mozilla.org/calendar/manager;1"]
                     .getService(Components.interfaces.calICalendarManager);
}

/**
 * setCalendarPref
 * Helper to set an independant Calendar Preference, since I cannot use the
 * calendar manager because of early initialization Problems.
 *
 * @param aCalendar     The Calendar to set the pref for
 * @param aPrefName     The Preference name
 * @param aPrefType     The type of the preference ("BOOL", "INT", "CHAR")
 * @param aPrefValue    The Preference value
 *
 * @return              The value of aPrefValue
 *
 * @require aCalendar.googleCalendarName
 */
function setCalendarPref(aCalendar, aPrefName, aPrefType, aPrefValue) {

    setPref("calendar.google.calPrefs." + aCalendar.googleCalendarName + "." +
            aPrefName, aPrefType, aPrefValue);

    return aPrefValue;
}

/**
 * getCalendarPref
 * Helper to get an independant Calendar Preference, since I cannot use the
 * calendar manager because of early initialization Problems.
 *
 * @param aCalendar     The calendar to set the pref for
 * @param aPrefName     The preference name
 *
 * @return              The preference value
 *
 * @require aCalendar.googleCalendarName
 */
function getCalendarPref(aCalendar, aPrefName) {
    return getPrefSafe("calendar.google.calPrefs." +
                       aCalendar.googleCalendarName + "."  + aPrefName);
}

/**
 * getFormattedString
 * Returns the string from the properties file, formatted with args
 *
 * @param aBundleName   The .properties file to access
 * @param aStringName   The property to access
 * @param aFormatArgs   An array of arguments to format the string
 * @param aComponent    Optionally, the stringbundle component name
 * @return              The formatted string
 */
function getFormattedString(aBundleName, aStringName, aFormatArgs, aComponent) {
    var bundlesvc = Components.classes["@mozilla.org/intl/stringbundle;1"].
                    getService(Components.interfaces.nsIStringBundleService);

    var component = aComponent || "gdata-provider";
    var bundle = bundlesvc.createBundle("chrome://" + component + "/locale/" +
                                        aBundleName + ".properties");

    if (aFormatArgs) {
        return bundle.formatStringFromName(aStringName,
                                           aFormatArgs,
                                           aFormatArgs.length);
    } else {
        return bundle.GetStringFromName(aStringName);
    }
}

/**
 * getSessionByUsername
 * Gets a session object for the passed username. This object will be created if
 * it does not exist.
 *
 * @param aUsername   This user's session will be returned
 * @return            The session object requested
 */
function getSessionByUsername(aUsername) {

    // Initialize the object
    if (!g_sessionMap) {
        g_sessionMap = {};
    }

    // If the username contains no @, assume @gmail.com
    // XXX Maybe use accountType=GOOGLE and just pass the raw username?
    if (aUsername.indexOf('@') == -1) {
        aUsername += "@gmail.com";
    }

    // Check if the session exists
    if (!g_sessionMap.hasOwnProperty(aUsername)) {
        LOG("Creating session for: " + aUsername);
        g_sessionMap[aUsername] = new calGoogleSession(aUsername);
    } else {
        LOG("Reusing session for: " + aUsername);
    }

    return g_sessionMap[aUsername];
}

/**
 * getCalendarCredentials
 * Tries to get the username/password combination of a specific calendar name
 * from the password manager or asks the user.
 *
 * @param   in  aCalendarName   The calendar name to look up. Can be null.
 * @param   out aUsername       The username that belongs to the calendar.
 * @param   out aPassword       The password that belongs to the calendar.
 * @param   out aSavePassword   Should the password be saved?
 * @return  Could a password be retrieved?
 */
function getCalendarCredentials(aCalendarName,
                                aUsername,
                                aPassword,
                                aSavePassword) {

    if (typeof aUsername != "object" ||
        typeof aPassword != "object" ||
        typeof aSavePassword != "object") {
        throw new Components.Exception("", Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT);
    }

    var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
                  getService(Components.interfaces.nsIWindowWatcher);
    var prompter = watcher.getNewPrompter(null);

    // Retrieve strings from properties file
    var title = getFormattedString("gdata", "loginDialogTitle");

    var text;
    try {
        // Branch uses chrome://necko/locale/necko.properties
        text = getFormattedString("necko",
                                  "EnterUserPasswordFor",
                                  [aCalendarName],
                                  "necko");
    } catch (e) {
        // Trunk uses chrome://global/locale/prompts.properties
        text = getFormattedString("prompts",
                                  "EnterUserPasswordFor",
                                  [aCalendarName],
                                  "global");
    }

    // Only show the save password box if we are supposed to.
    var savepassword;
    if (getPrefSafe("signon.rememberSignons", true)) {
        savepassword = getFormattedString("passwordmgr",
                                          "rememberPassword",
                                          null,
                                          "passwordmgr");
    }

    return prompter.promptUsernameAndPassword(title,
                                              text,
                                              aUsername,
                                              aPassword,
                                              savepassword,
                                              aSavePassword);
}

/**
 * getMozillaTimezone
 * Return mozilla's representation of a timezone
 *
 * @param aICALTimezone The ending string to match against (i.e Europe/Berlin)
 * @return              The same string including /mozilla.org/<date>/
 */
function getMozillaTimezone(aICALTimezone) {

    if (!aICALTimezone ||
        aICALTimezone == "UTC" ||
        aICALTimezone == "floating") {
        return aICALTimezone;
    }
    // TODO A patch to Bug 363191 should make this more efficient.
    // For now we need to go through all timezones and see which timezone
    // ends with aICALTimezone.

    var icsSvc = Components.classes["@mozilla.org/calendar/ics-service;1"].
                 getService(Components.interfaces.calIICSService);

    // Enumerate timezones, set them, check their offset
    var enumerator = icsSvc.timezoneIds;
    while (enumerator.hasMore()) {
        var id = enumerator.getNext();

        if (id.substr(-aICALTimezone.length) == aICALTimezone) {
            return id;
        }
    }
    return null;
}

/**
 * fromRFC3339
 * Convert a RFC3339 compliant Date string to a calIDateTime.
 *
 * @param aStr          The RFC3339 compliant Date String
 * @param aTimezone     The timezone this date string is most likely in
 * @return              A calIDateTime object
 */
function fromRFC3339(aStr, aTimezone) {

    // XXX I have not covered leapseconds (matches[8]), this might need to
    // be done. The only reference to leap seconds I found is bug 227329.

    // Create a DateTime instance (calUtils.js)
    var dateTime = createDateTime();

    // Killer regex to parse RFC3339 dates
    var re = new RegExp("^([0-9]{4})-([0-9]{2})-([0-9]{2})" +
        "([Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]+)?)?" +
        "(([Zz]|([+-])([0-9]{2}):([0-9]{2})))?");

    var matches = re.exec(aStr);
    var moztz = getMozillaTimezone(aTimezone) || "UTC";

    if (!matches) {
        return null;
    }

    // Set usual date components
    dateTime.isDate = (matches[4]==null);

    dateTime.year = matches[1];
    dateTime.month = matches[2] - 1; // Jan is 0
    dateTime.day = matches[3];

    if (!dateTime.isDate) {
        dateTime.hour = matches[5];
        dateTime.minute = matches[6];
        dateTime.second = matches[7];
    }

    // Timezone handling
    if (matches[9] == "Z") {
        // If the dates timezone is "Z", then this is UTC, no matter
        // what timezone was passed
        dateTime.timezone = "UTC";

    } else if (matches[9] == null) {
        // We have no timezone info, only a date. We have no way to
        // know what timezone we are in, so lets assume we are in the
        // timezone of our local calendar, or whatever was passed.

        dateTime.timezone = moztz;

    } else {
        var offset_in_s = (matches[11] == "-" ? -1 : 1) *
            ( (matches[12] * 3600) + (matches[13] * 60) );

        // try local timezone first
        dateTime.timezone = moztz;

        // If offset does not match, go through timezones. This will
        // give you the first tz in the alphabet and kill daylight
        // savings time, but we have no other choice
        if (dateTime.timezoneOffset != offset_in_s) {
            // TODO A patch to Bug 363191 should make this more efficient.

            var icsSvc = Components.classes["@mozilla.org/calendar/ics-service;1"].
                         getService(Components.interfaces.calIICSService);

            // Enumerate timezones, set them, check their offset
            var enumerator = icsSvc.timezoneIds;
            while (enumerator.hasMore()) {
                var id = enumerator.getNext();
                dateTime.timezone = id;
                if (dateTime.timezoneOffset == offset_in_s) {
                    // This is our last step, so go ahead and return
                    return dateTime;
                }
            }
            // We are still here: no timezone was found
            dateTime.timezone = "UTC";
            if (!dateTime.isDate) {
                dateTime.hour += (matches[11] == "-" ? -1 : 1) * matches[12];
                dateTime.minute += (matches[11] == "-" ? -1 : 1) * matches[13];
             }
        }
    }
    return dateTime;
}

/**
 * toRFC3339
 * Convert a calIDateTime to a RFC3339 compliant Date string
 *
 * @param aDateTime     The calIDateTime object
 * @return              The RFC3339 compliant date string
 */
function toRFC3339(aDateTime) {

    if (!aDateTime) {
        return "";
    }

    var tzoffset_hr = Math.floor(aDateTime.timezoneOffset / 3600);

    var tzoffset_mn = ((aDateTime.timezoneOffset / 3600).toFixed(2) -
                       tzoffset_hr) * 60;

    var str = aDateTime.year + "-" +
        ("00" + (aDateTime.month + 1)).substr(-2) +  "-" +
        ("00" + aDateTime.day).substr(-2);

    // Time and Timezone extension
    if (!aDateTime.isDate) {
        str += "T" +
               ("00" + aDateTime.hour).substr(-2) + ":" +
               ("00" + aDateTime.minute).substr(-2) + ":" +
               ("00" + aDateTime.second).substr(-2);
        if (aDateTime.timezoneOffset != 0) {
            str += (tzoffset_hr < 0 ? "-" : "+") +
                   ("00" + Math.abs(tzoffset_hr)).substr(-2) + ":" +
                   ("00" + Math.abs(tzoffset_mn)).substr(-2);
        } else if (aDateTime.timezone == "floating") {
            // RFC3339 Section 4.3 Unknown Local Offset Convention
            str += "-00:00";
        } else {
            // ZULU Time, according to ISO8601's timezone-offset
            str += "Z";
        }
    }
    return str;
}

/**
 * passwordManagerSave
 * Helper to insert an entry to the password manager.
 *
 * @param aUserName     The username to search
 * @param aPassword     The corresponding password
 */
function passwordManagerSave(aUsername, aPassword) {

    ASSERT(aUsername);
    ASSERT(aPassword);

    if (Components.classes["@mozilla.org/passwordmanager;1"]) {
        var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].
                              getService(Components.interfaces.nsIPasswordManager);

        // The realm and the username are the same, since we only save
        // credentials per session, which only needs a user and a password
        passwordManager.addUser(aUsername, aUsername, aPassword);
    } else if (Components.classes["@mozilla.org/login-manager;1"]) {
        // Trunk uses LoginManager
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].
                           getService(Components.interfaces.nsILoginManager);
        var hostname = "chrome://gdata-provider/" +
                       encodeURIComponent(aUsername);
        var logins = loginManager.findLogins({},
                                             hostname,
                                             null,
                                             "Google Calendar");
        if (logins.length > 0) {
            var loginInfo = logins[0].clone();
            loginInfo.password = aPassword;
            loginManager.modifyLogin(logins[0], loginInfo);
        } else {
            var loginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"].
                            createInstance(Components.interfaces.nsILoginInfo);
            loginInfo.init(hostname,
                           null,
                           "Google Calendar",
                           aUsername,
                           aPassword,
                           null,
                           null);
            loginManager.addLogin(loginInfo);
        }
    }
}

/**
 * passwordManagerGet
 * Helper to retrieve an entry from the password manager
 *
 * @param in  aUsername     The username to search
 * @param out aPassword     The corresponding password
 * @return                  Does an entry exist in the password manager
 */
function passwordManagerGet(aUsername, aPassword) {

    ASSERT(aUsername);

    if (typeof aPassword != "object") {
        throw new Components.Exception("", Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT);
    }

    if (Components.classes["@mozilla.org/passwordmanager;1"]) {
        // Branch uses PasswordManager
        var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].
                              getService(Components.interfaces.nsIPasswordManager);

        var enumerator = passwordManager.enumerator;

        while (enumerator.hasMoreElements()) {
            var entry = enumerator.getNext().QueryInterface(Components.interfaces.nsIPassword);

            // We only care about the "host" field, since the username field is the
            // same for our purposes.
            if (entry.host == aUsername) {
                aPassword.value = entry.password;
                return true;
            }
        }
    } else if (Components.classes["@mozilla.org/login-manager;1"]) {
        // Trunk uses LoginManager
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].
                           getService(Components.interfaces.nsILoginManager);
        if (!loginManager.getLoginSavingEnabled(aUsername)) {
            return false;
        }

        // We use the hostname field to save the username, to avoid the need to
        // manually iterate through all google.com logins, and to make it
        // easier to check for per-user per-scheme login saving. Since we are
        // saving on a on a per-account basis, so only the first login is
        // important.
        var hostname = "chrome://gdata-provider/" +
                       encodeURIComponent(aUsername);
        var logins = loginManager.findLogins({},
                                             hostname,
                                             null,
                                             "Google Calendar Login");
        if (logins.length > 0) {
            aPassword.value = logins[0].password;
            return true;
        }
    }
    return false;
}

/**
 * passwordManagerRemove
 * Helper to remove an entry from the password manager
 *
 * @param aUsername     The username to remove.
 * @return              Could the user be removed?
 */
function passwordManagerRemove(aUsername) {

    if (Components.classes["@mozilla.org/passwordmanager;1"]) {
        // Branch uses PasswordManager
        var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].
                              getService(Components.interfaces.nsIPasswordManager);

        // Remove from Password Manager. Again, the host and username is always the
        // same for our purposes.
        try {
            passwordManager.removeUser(aUsername, aUsername);
        } catch (e) {
            return false;
        }
    } else if (Components.classes["@mozilla.org/login-manager;1"]) {
        // Trunk uses LoginManager
        var loginManager = Components.classes["@mozilla.org/login-manager;1"].
                           getService(Components.interfaces.nsILoginManager);
        var hostname = "chrome://gdata-provider/" +
                       encodeURIComponent(aUsername);
        var logins = loginManager.findLogins({},
                                             hostname,
                                             null,
                                             "Google Calendar");
        if (logins.length > 0) {
            for (var i = 0; i < logins.length; i++) {
                loginManager.removeLogin(logins[i]);
            }
        } else {
            return false;
        }
    }
    return true;
}

/**
 * ItemToXMLEntry
 * Converts a calIEvent to a string of xml data.
 *
 * @param aItem         The item to convert
 * @param aAuthorEmail  The email of the author of the event
 * @param aAuthorName   The full name of the author of the event
 * @return              The xml data of the item
 */
function ItemToXMLEntry(aItem, aAuthorEmail, aAuthorName) {

    if (!aItem) {
        throw new Components.Exception("", Components.results.NS_ERROR_INVALID_ARG);
    }

    const kEVENT_SCHEMA = "http://schemas.google.com/g/2005#event.";

    // Namespace definitions
    var gd = new Namespace("gd", "http://schemas.google.com/g/2005");
    var gCal = new Namespace("gCal", "http://schemas.google.com/gCal/2005");
    var atom = new Namespace("", "http://www.w3.org/2005/Atom");
    default xml namespace = atom;

    var entry = <entry xmlns={atom} xmlns:gd={gd} xmlns:gCal={gCal}/>;

    // Basic elements
    entry.category.@scheme = "http://schemas.google.com/g/2005#kind";
    entry.category.@term = "http://schemas.google.com/g/2005#event";

    entry.title.@type = "text";
    entry.title = aItem.title;

    // atom:content
    entry.content = aItem.getProperty("DESCRIPTION") || "";
    entry.content.@type = "text";

    // atom:author
    entry.author.name = aAuthorName;
    entry.author.email = aAuthorEmail;

    // gd:transparency
    var transp = aItem.getProperty("TRANSP") || "opaque";
    transp = kEVENT_SCHEMA + transp.toLowerCase();
    entry.gd::transparency.@value = transp;

    // gd:eventStatus
    var status = aItem.status || "confirmed";

    if (status == "CANCELLED") {
        // If the status is canceled, then the event will be deleted. Since the
        // user didn't choose to delete the event, we will protect him and not
        // allow this status to be set
        throw new Components.Exception("",
                                       Components.results.NS_ERROR_LOSS_OF_SIGNIFICANT_DATA);
    } else if (status == "NONE") {
        status = "CONFIRMED";
    }
    entry.gd::eventStatus.@value = kEVENT_SCHEMA + status.toLowerCase();

    // gd:where
    entry.gd::where.@valueString = aItem.getProperty("LOCATION") || "";

    // gd:who
    var attendees = aItem.getAttendees({});
    if (aItem.organizer) {
        // Taking care of the organizer is the same as taking care of any other
        // attendee. Add the organizer to the local attendees list.
        attendees.push(aItem.organizer);
    }

    const attendeeStatusMap = {
        "REQ-PARTICIPANT": "required",
        "OPT-PARTICIPANT": "optional",
        "NON-PARTICIPANT": null,
        "CHAIR": null,

        "NEEDS-ACTION": "invited",
        "ACCEPTED": "accepted",
        "DECLINED": "declined",
        "TENTATIVE": "tentative",
        "DELEGATED": "tentative"
    };

    for each (var attendee in attendees) {
        if (attendee.userType && attendee.userType != "INDIVIDUAL") {
            // We can only take care of individuals.
            continue;
        }

        var xmlAttendee = <gd:who xmlns:gd={gd}/>;

        // Strip "mailto:" part
        xmlAttendee.@email = attendee.id.substring(7);

        if (attendee.isOrganizer) {
            xmlAttendee.@rel = kEVENT_SCHEMA + "organizer";
        } else {
            xmlAttendee.@rel = kEVENT_SCHEMA + "attendee";
        }

        if (attendee.commonName) {
            xmlAttendee.@valueString = attendee.commonName;
        }

        if (attendeeStatusMap[attendee.role]) {
            xmlAttendee.gd::attendeeType.@value =
                attendeeStatusMap[attendee.role];
        }

        if (attendeeStatusMap[attendee.participationStatus]) {
            xmlAttendee.gd::attendeeStatus.@value =
                attendeeStatusMap[attendee.participationStatus];
        }

        entry.gd::who += xmlAttendee;
    }

    // Notify attendees by default and let google handle this. Use a preference
    // in case the user wants this to be turned off. Support on a per event
    // basis will be taken care of later.
    var notify = getPrefSafe("calendar.google.sendEventNotifications", true);
    entry.gCal::sendEventNotifications.@value = (notify ? "true" : "false");

    // gd:when
    var duration = aItem.endDate.subtractDate(aItem.startDate);
    entry.gd::when.@startTime = toRFC3339(aItem.startDate);

    // Google's documentation says that zero length events should be defined by
    // omitting the end time. This currently does not work though. Workaround is
    // to always pass an end time. See
    // http://code.google.com/p/gdata-issues/issues/detail?id=198
    // for more details.
    entry.gd::when.@endTime = toRFC3339(aItem.endDate);

    // gd:reminder
    if (aItem.alarmOffset) {
        var gdReminder = <gd:reminder xmlns:gd={gd}/>;
        var alarmOffset = aItem.alarmOffset.clone();

        if (aItem.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_END) {
            // Google always uses an alarm offset related to the start time
            alarmOffset.addDuration(duration);
        }

        // Google only accepts certain alarm values. Snap to them. See
        // http://code.google.com/p/google-gdata/issues/detail?id=55
        const alarmValues = [ 300, 600, 900, 1200, 1500, 1800, 2700, 3600, 7200,
                            10800, 86400, 172800, 604800 ];
        var discreteValue = alarmValues[alarmValues.length - 1] / 60;

        for (var i = 0; i < alarmValues.length; i++) {
            if (-aItem.alarmOffset.inSeconds <= alarmValues[i]) {
                discreteValue = alarmValues[i] / 60;
                break;
            }
        }

        gdReminder.@minutes = discreteValue;
        gdReminder.@method = "alert";
        entry.gd::when.gd::reminder += gdReminder;
    }

    // saved alarms
    var otherAlarms = aItem.getProperty("X-GOOGLE-OTHERALARMS");
    for each (var alarm in otherAlarms) {
        entry.gd::when.gd::reminder += new XML(alarm);
    }

    // gd:extendedProperty (alarmLastAck)
    var gdAlarmLastAck = <gd:extendedProperty xmlns:gd={gd}/>;
    gdAlarmLastAck.@name = "X-MOZ-LASTACK";
    gdAlarmLastAck.@value = toRFC3339(aItem.alarmLastAck);
    entry.gd::extendedProperty += gdAlarmLastAck;

    // XXX Google now supports multiple alarms, but since the valid alarms are
    // restricted to discrete values, using a normal alarm to snooze is pretty
    // pointless.

    // gd:extendedProperty (snooze time)
    var gdAlarmSnoozeTime = <gd:extendedProperty xmlns:gd={gd}/>;
    var itemSnoozeTime = aItem.getProperty("X-MOZ-SNOOZE-TIME");
    var icalSnoozeTime = null;
    if (itemSnoozeTime) {
        // The propery is saved as a string, translate back to calIDateTime.
        icalSnoozeTime = createDateTime();
        icalSnoozeTime.icalString = itemSnoozeTime;
    }
    gdAlarmSnoozeTime.@name = "X-MOZ-SNOOZE-TIME";
    gdAlarmSnoozeTime.@value = toRFC3339(icalSnoozeTime);
    entry.gd::extendedProperty += gdAlarmSnoozeTime;

    // gd:visibility
    var privacy = aItem.privacy || "default";
    entry.gd::visibility.@value = kEVENT_SCHEMA + privacy.toLowerCase();

    // categories
    var categories = aItem.getProperty("CATEGORIES");
    if (categories) {
        for each (var cat in categories.split(",")) {
            entry.category += <category term="user-tag" label={cat}/>;
        }
    }

    // TODO gd:recurrenceException: Enhancement tracked in bug 362650
    // TODO gd:comments: Enhancement tracked in bug 362653

    // XXX Google currently has no priority support. See
    // http://code.google.com/p/google-gdata/issues/detail?id=52
    // for details.

    return entry;
}

/**
 * relevantFieldsMatch
 * Tests if all google supported fields match
 *
 * @param a The reference item
 * @param b The comparing item
 * @return  true if all relevant fields match, otherwise false
 */
function relevantFieldsMatch(a, b) {

    // flat values
    if (a.id != b.id ||
        a.title != b.title ||
        a.status != b.status ||
        a.privacy != b.privacy) {
        return false;
    }

    function compareNotNull(prop) {
        var ap = a[prop];
        var bp = b[prop];
        return (ap && !bp || !ap && bp || ap && bp && ap.compare(bp));
    }

    // Object flat values
    if (compareNotNull("alarmOffset") ||
        compareNotNull("alarmLastAck") ||
        /* Compare startDate and endDate */
        (a.startDate && a.startDate.compare(b.startDate)) ||
        (a.endDate && a.endDate.compare(b.endDate)) ||
        (a.startDate.isDate != b.startDate.isDate) ||
        (a.endDate.isDate != b.endDate.isDate)) {
        return false;
    }

    // Properties
    const kPROPERTIES = ["DESCRIPTION", "TRANSP", "X-GOOGLE-EDITURL",
                         "LOCATION", "CATEGORIES", "X-MOZ-SNOOZE-TIME"];

    for each (var p in kPROPERTIES) {
        // null and an empty string should be handled as non-relevant
        if ((a.getProperty(p) || "") != (b.getProperty(p) || "")) {
            return false;
        }
    }

    // attendees and organzier
    var aa = a.getAttendees({});
    var ab = b.getAttendees({});
    if (aa.length != ab.length) {
        return false;
    }

    if ((a.organizer && !b.organizer) ||
        (!a.organizer && b.organizer) ||
        (a.organizer && b.organizer && a.organizer.id != b.organizer.id)) {
        return false;
    }

    // go through attendees in a, check if its id is in b
    for each (var attendee in aa) {
        var ba = b.getAttendeeById(attendee.id);
        if (!ba ||
            ba.participationStatus != attendee.participationStatus ||
            ba.commonName != attendee.commonName ||
            ba.isOrganizer != attendee.isOrganizer ||
            ba.role != attendee.role) {
            return false;
        }
    }

    return true;
}

/**
 * getItemEditURI
 * Helper to get the item's edit URI
 *
 * @param aItem         The item to get it from
 * @return              The edit URI
 */
function getItemEditURI(aItem) {

    ASSERT(aItem);
    var edituri = aItem.getProperty("X-GOOGLE-EDITURL");
    if (!edituri) {
        // If the item has no edit uri, it is read-only
        throw new Components.Exception("", Components.interfaces.calIErrors.CAL_IS_READONLY);
    }
    return edituri;
}

/**
 * XMLEntryToItem
 * Converts a string of xml data to a calIEvent.
 *
 * @param aXMLEntry     The xml data of the item
 * @param aTimezone     The timezone the event is most likely in
 * @param aCalendar     The calendar this item will belong to.
 * @return              The calIEvent with the item data.
 */
function XMLEntryToItem(aXMLEntry, aTimezone, aCalendar) {

    if (aXMLEntry == null) {
        throw new Components.Exception("", Components.results.NS_ERROR_DOM_SYNTAX_ERR);
    }

    var gCal = new Namespace("gCal", "http://schemas.google.com/gCal/2005");
    var gd = new Namespace("gd", "http://schemas.google.com/g/2005");
    var atom = new Namespace("", "http://www.w3.org/2005/Atom");
    default xml namespace = atom;

    var item = Components.classes["@mozilla.org/calendar/event;1"].
               createInstance(Components.interfaces.calIEvent);

    try {
        // id
        var id = aXMLEntry.id.toString();
        item.id = id.substring(id.lastIndexOf('/')+1);

        // link
        // Since Google doesn't set the edit url to be https if the request is
        // https, we need to work around this here.
        var editUrl = aXMLEntry.link.(@rel == 'edit').@href.toString();
        if (aCalendar.uri.schemeIs("https")) {
            editUrl = editUrl.replace(/^http:/, "https:");
        }
        item.setProperty("X-GOOGLE-EDITURL", editUrl);

        // title
        item.title = aXMLEntry.title.(@type == 'text');

        // content
        item.setProperty("DESCRIPTION",
                         aXMLEntry.content.(@type == 'text').toString());

        // gd:transparency
        item.setProperty("TRANSP",
                         aXMLEntry.gd::transparency.@value.toString()
                                  .substring(39).toUpperCase());

        // gd:eventStatus
        item.status = aXMLEntry.gd::eventStatus.@value.toString()
                               .substring(39).toUpperCase();
        if (item.status == "CANCELED") {
            // Google uses the canceled state for deleted events. I
            // don't think this is a good solution, but we need to
            // wait what google says about that.
            return null;
        }

        // gd:when
        for each (var when in aXMLEntry.gd::when) {
            var startDate = fromRFC3339(when.@startTime, aTimezone);
            var endDate = fromRFC3339(when.@endTime, aTimezone);

            if (startDate && endDate) {
                if ((!item.startDate && startDate) ||
                    (item.startDate &&
                     item.startDate.compare(startDate) > 0)) {

                    item.startDate = startDate;
                    item.endDate = endDate;
                } else {
                    // We only need the chronologically first event
                    break;
                }

                if (!item.endDate) {
                    // We have a zero-duration event
                    item.endDate = item.startDate.clone();
                }
            }

            // gd:reminder
            if (aXMLEntry.gd::originalEvent.toString().length > 0) {
                // If the item is an occurrence, we cannot change it until bug
                // 362650 has been fixed. For now, don't set alarms on
                // occurrences.
                continue;
            }

            // Google's alarms are always related to the start
            item.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;

            var lastAlarm;
            var otherAlarms = [];
            for each (var reminder in when.gd::reminder) {
                // We are only intrested in "alert" reminders. Other types
                // include sms and email alerts, but thats not the point here.
                if (reminder.@method == "alert") {
                    var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"]
                                        .createInstance(Components.interfaces.calIDuration);

                    if (reminder.@absoluteTime.toString()) {
                        var absolute = fromRFC3339(reminder.@absoluteTime,
                                                   aTimezone);
                        alarmOffset = startDate.subtractDate(absolute);
                    } else if (reminder.@days.toString()) {
                        alarmOffset.days = -reminder.@days;
                    } else if (reminder.@hours.toString()) {
                        alarmOffset.hours = -reminder.@hours;
                    } else if (reminder.@minutes.toString()) {
                        alarmOffset.minutes = -reminder.@minutes;
                    } else {
                        continue;
                    }
                    alarmOffset.normalize();

                    // If there is more than one alarm, we could either take the
                    // alarm closest to the event or the alarm furthest to the
                    // event. Let the user decide (use a property)
                    var useClosest = getPrefSafe("calendar.google.alarmClosest",
                                                 true);
                    if (!item.alarmOffset ||
                        (useClosest &&
                         alarmOffset.compare(item.alarmOffset) > 0) ||
                        (!useClosest &&
                         alarmOffset.compare(item.alarmOffset) < 0)) {

                        item.alarmOffset = alarmOffset;
                        if (lastAlarm) {
                            // If there was already an alarm, then it is now one
                            // of the other alarms.
                            otherAlarms.push(lastAlarm.toXMLString());
                        }
                        lastAlarm = reminder;
                        // Don't push the reminder below, since we might be
                        // keeping this one as our item's alarmOffset.
                        continue;
                    }
                }
                otherAlarms.push(reminder.toXMLString());
            }

            // Save other alarms that were set so we don't loose them
            item.setProperty("X-GOOGLE-OTHERALARMS", otherAlarms);
        }

        // gd:extendedProperty (alarmLastAck)
        var alarmLastAck = aXMLEntry.gd::extendedProperty
                           .(@name == "X-MOZ-LASTACK")
                           .@value.toString();
        item.alarmLastAck = fromRFC3339(alarmLastAck, aTimezone);

        // gd:extendedProperty (snooze time)
        var xmlSnoozeTime = aXMLEntry.gd::extendedProperty
                         .(@name == "X-MOZ-SNOOZE-TIME").@value.toString();
        var dtSnoozeTime = fromRFC3339(xmlSnoozeTime, aTimezone);
        var snoozeProperty = (dtSnoozeTime ? dtSnoozeTime.icalString : null);
        item.setProperty("X-MOZ-SNOOZE-TIME", snoozeProperty);

        // gd:where
        item.setProperty("LOCATION",
                         aXMLEntry.gd::where.@valueString.toString());
        // gd:who

        // This object can easily translate the Google's values to our values.
        const attendeeStatusMap = {
            // role
            "event.optional": "OPT-PARTICIPANT",
            "event.required": "REQ-PARTICIPANT",

            // Participation Statii
            "event.accepted": "ACCEPTED",
            "event.declined": "DECLINED",
            "event.invited": "NEEDS-ACTION",
            "event.tentative": "TENTATIVE"
        };

        // Iterate all attendee tags.
        for each (var who in aXMLEntry.gd::who) {
            var attendee = Components.classes["@mozilla.org/calendar/attendee;1"]
                           .createInstance(Components.interfaces.calIAttendee);

            var rel = who.@rel.toString().substring(33);
            var type = who.gd::attendeeType.@value.toString().substring(33);
            var status = who.gd::attendeeStatus.@value.toString().substring(33);

            attendee.id = "mailto:" + who.@email.toString();
            attendee.commonName = who.@valueString.toString();
            attendee.rsvp = false;
            attendee.userType = "INDIVIDUAL";
            attendee.isOrganizer = (rel == "event.organizer");
            attendee.participationStatus = attendeeStatusMap[status];
            attendee.role = attendeeStatusMap[type]
            attendee.makeImmutable();

            if (attendee.isOrganizer) {
                item.organizer = attendee;
            } else {
                item.addAttendee(attendee);
            }
        }

        // gd:recurrence
        var recurrenceInfo = aXMLEntry.gd::recurrence.toString();
        var lines = recurrenceInfo.split("\n");

        // Some items don't contain gd:when elements. Those have
        // gd:reccurrence items, which contains some start date
        // info. For now, extract that information so we can display
        // those recurrence events.
        // XXX This code is somewhat preliminary

        var timezone;
        var startDate = createDateTime();
        var endDate;
        for each (var line in lines) {
            var re = new RegExp("^DTSTART;TZID=([^:]*):([0-9T]*)$");
            var matches = re.exec(line);
            if (matches) {
                startDate.icalString = matches[2];
                startDate.timezone = getMozillaTimezone(matches[1]);
                if (!endDate) {
                    endDate = startDate.clone();
                }
                if (!item.startDate) {
                    item.startDate = startDate;
                }
            }
            re = new RegExp("^DURATION:(.*)$");
            matches = re.exec(line);
            if (matches) {
                var offset = Components.classes["@mozilla.org/calendar/duration;1"].
                             createInstance(Components.interfaces.calIDuration);

                offset.icalString = matches[1];
                endDate.addDuration(offset);
                if (!item.endDate) {
                    item.endDate = endDate;
                }
            }
            re = new RegExp("^DTEND;TZID=([^:]*):([0-9T]*)$");
            matches = re.exec(line);
            if (matches) {
                endDate.icalString = matches[2];
                endDate.timezone = getMozillaTimezone(matches[1]);
                if (!item.endDate) {
                    item.endDate = endDate;
                }
            }

            if (line == "BEGIN:VTIMEZONE") {
                // Stop here so we dont falsely use a DTSTART of a
                // timezone element
                break
            }
        }

        // gd:visibility
        item.privacy = aXMLEntry.gd::visibility.@value.toString()
                                .substring(39).toUpperCase();
        if (item.privacy == "DEFAULT") {
            // Currently we will use a preference to substitue the
            // default value
            item.privacy = getPrefSafe("calendar.google.defaultPrivacy",
                                       "private").toUpperCase();
        }

        // category
        var categories = new Array();
        for each (var label in aXMLEntry.category.@label) {
            categories.push(label.toUpperCase());
        }
        item.setProperty("CATEGORIES", categories.join(","));

        // gd:originalEvent
        item.setProperty("X-GOOGLE-ITEM-IS-OCCURRENCE",
                         aXMLEntry.gd::originalEvent.toString().length > 0);

        // published
        item.setProperty("CREATED", fromRFC3339(aXMLEntry.published,
                                                aTimezone));

        // updated (This must be set last!)
        item.setProperty("LAST-MODIFIED", fromRFC3339(aXMLEntry.updated,
                                                      aTimezone));

        // TODO gd:recurrenceException: Enhancement tracked in bug 362650
        // TODO gd:comments: Enhancement tracked in bug 362653

        // XXX Google currently has no priority support. See
        // http://code.google.com/p/google-gdata/issues/detail?id=52
        // for details.
    } catch (e) {
        LOG("Error parsing XML stream" + e);
        throw e;
    }
    return item;
}

/**
 * LOGitem
 * Custom logging functions
 */
function LOGitem(item) {
    if (!item) {
        return;
    }

    var attendees = item.getAttendees({});
    var attendeeString = "";
    for each (var a in attendees) {
        attendeeString += "\n" + LOGattendee(a);
    }

    LOG("Logging calIEvent:" +
        "\n\tid:" + item.id +
        "\n\tediturl:" + item.getProperty("X-GOOGLE-EDITURL") +
        "\n\tcreated:" + item.getProperty("CREATED") +
        "\n\tupdated:" + item.getProperty("LAST-MODIFIED") +
        "\n\ttitle:" + item.title +
        "\n\tcontent:" + item.getProperty("DESCRIPTION") +
        "\n\ttransparency:" + item.getProperty("TRANSP") +
        "\n\tstatus:" + item.status +
        "\n\tstartTime:" + item.startDate.toString() +
        "\n\tendTime:" + item.endDate.toString() +
        "\n\tlocation:" + item.getProperty("LOCATION") +
        "\n\tprivacy:" + item.privacy +
        "\n\talarmOffset:" + item.alarmOffset +
        "\n\talarmLastAck:" + item.alarmLastAck +
        "\n\tsnoozeTime:" + item.getProperty("X-MOZ-SNOOZE-TIME") +
        "\n\tisOccurrence: " + item.getProperty("x-GOOGLE-ITEM-IS-OCCURRENCE") +
        "\n\tOrganizer: " + LOGattendee(item.organizer) +
        "\n\tAttendees: " + attendeeString);
}

function LOGattendee(aAttendee, asString) {
    return aAttendee &&
        ("\n\t\tID: " + aAttendee.id +
         "\n\t\t\tName: " + aAttendee.commonName +
         "\n\t\t\tRsvp: " + aAttendee.rsvp +
         "\n\t\t\tIs Organizer: " +  (aAttendee.isOrganizer ? "yes" : "no") +
         "\n\t\t\tRole: " + aAttendee.role +
         "\n\t\t\tStatus: " + aAttendee.participationStatus);
}
