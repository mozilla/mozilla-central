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

/* Shortcut to the calendar-manager service */
function getCalendarManager() {
    return Components.classes["@mozilla.org/calendar/manager;1"].
           getService(Components.interfaces.calICalendarManager);
}

/**
 * Function to get the (cached) best guess at a user's default timezone.  We'll
 * use the value of the calendar.timezone.local preference, if it exists.  If
 * not, we'll do our best guess.
 *
 * @returns  a string of the Mozilla TZID for the user's default timezone.
 */
var gDefaultTimezone;
function calendarDefaultTimezone() {
    if (!gDefaultTimezone) {
        gDefaultTimezone = getPrefSafe("calendar.timezone.local", null);
        if (!gDefaultTimezone) {
            gDefaultTimezone = guessSystemTimezone();
        } else {
            var icsSvc = Components.classes["@mozilla.org/calendar/ics-service;1"].
                         getService(Components.interfaces.calIICSService);

            // Update this tzid if necessary.
            if (icsSvc.latestTzId(gDefaultTimezone).length) {
                gDefaultTimezone = icsSvc.latestTzId(gDefaultTimezone);
                setPref("calendar.timezone.local", "CHAR", gDefaultTimezone);
            }
        }
    }
    return gDefaultTimezone;
}

/**
 * We're going to do everything in our power, short of rumaging through the
 * user's actual file-system, to figure out the time-zone they're in.  The
 * deciding factors are the offsets given by (northern-hemisphere) summer and
 * winter JSdates.  However, when available, we also use the name of the
 * timezone in the JSdate, or a string-bundle term from the locale.
 *
 * @returns  a ICS timezone string.
*/
function guessSystemTimezone() {
    var probableTZ = null;
    var TZname1 = null;
    var TZname2 = null;
    var Date1 = (new Date(2005,6,20)).toString();
    var Date2 = (new Date(2005,12,20)).toString();
    var nameData1 = Date1.match(/[^(]* ([^ ]*) \(([^)]+)\)/);
    var nameData2 = Date2.match(/[^(]* ([^ ]*) \(([^)]+)\)/);

    if (nameData1 && nameData1[2]) {
        TZname1 = nameData1[2];
    }
    if (nameData2 && nameData2[2]) {
        TZname2 = nameData2[2];
    }

    var index = Date1.indexOf('+');
    if (index < 0) {
        index = Date2.indexOf('-');
    }

    // the offset is always 5 characters long
    var TZoffset1 = Date1.substr(index, 5);
    index = Date2.indexOf('+');
    if (index < 0) {
        index = Date2.indexOf('-');
    }
    // the offset is always 5 characters long
    var TZoffset2 = Date2.substr(index, 5);

    dump("Guessing system timezone:\n");
    dump("TZoffset1: " + TZoffset1 + "\nTZoffset2: " + TZoffset2 + "\n");
    if (TZname1 && TZname2) {
        dump("TZname1: " + TZname1 + "\nTZname2: " + TZname2 + "\n");
    }

    var icsSvc = Components.classes["@mozilla.org/calendar/ics-service;1"].
                 getService(Components.interfaces.calIICSService);

    // returns 0=definitely not, 1=maybe, 2=likely
    function checkTZ(someTZ)
    {
        var comp = icsSvc.getTimezone(someTZ);
        var subComp = comp.getFirstSubcomponent("VTIMEZONE");
        var standard = subComp.getFirstSubcomponent("STANDARD");
        var standardTZOffset = standard.getFirstProperty("TZOFFSETTO").valueAsIcalString;
        var standardNameProp = standard.getFirstProperty("TZNAME");
        var standardName = standardNameProp &&
                           standardNameProp.valueAsIcalString;
        var daylight = subComp.getFirstSubcomponent("DAYLIGHT");
        var daylightTZOffset = null;
        var daylightNameProp = null;
        var daylightName = null;
        if (daylight) {
            daylightTZOffset = daylight.getFirstProperty("TZOFFSETTO").valueAsIcalString;
            daylightNameProp = daylight.getFirstProperty("TZNAME");
            daylightName = daylightNameProp &&
                           daylightNameProp.valueAsIcalString;
        }

        if (TZoffset2 == standardTZOffset && TZoffset2 == TZoffset1 &&
           !daylight) {
            if (!standardName || standardName == TZname1) {
                return 2;
            }
            return 1;
        }

        if (TZoffset2 == standardTZOffset && TZoffset1 == daylightTZOffset) {
            if ((!standardName || standardName == TZname1) &&
                (!daylightName || daylightName == TZname2)) {
                return 2;
            }
            return 1;
        }

        // Now flip them and check again, to cover the southern hemisphere case
        if (TZoffset1 == standardTZOffset && TZoffset2 == TZoffset1 &&
           !daylight) {
            if (!standardName || standardName == TZname2) {
                return 2;
            }
            return 1;
        }

        if (TZoffset1 == standardTZOffset && TZoffset2 == daylightTZOffset) {
            if ((!standardName || standardName == TZname2) &&
                (!daylightName || daylightName == TZname1)) {
                return 2;
            }
            return 1;
        }
        return 0;
    }

    try {
        var stringBundleTZ = calGetString("calendar", "likelyTimezone");

        if (stringBundleTZ.indexOf("/mozilla.org/") == -1) {
            // This happens if the l10n team didn't know how to get a time from
            // tzdata.c.  To convert an Olson time to a ics-timezone-string we
            // need to append this prefix.
            // XXX Get this prefix from calIICSService.tzIdPrefix
            stringBundleTZ = "/mozilla.org/20070129_1/" + stringBundleTZ;
        }

        switch (checkTZ(stringBundleTZ)) {
            case 0:
                break;
            case 1:
                if (!probableTZ)
                    probableTZ = stringBundleTZ;
                break;
            case 2:
                return stringBundleTZ;
        }
    }
    catch (ex) { // Oh well, this didn't work, next option...
    }
        
    var tzIDs = icsSvc.timezoneIds;
    while (tzIDs.hasMore()) {
        var theTZ = tzIDs.getNext();
        try {
            switch (checkTZ(theTZ)) {
                case 0: break;
                case 1: 
                    if (!probableTZ) {
                        probableTZ = theTZ;
                    }
                    break;
                case 2:
                    return theTZ;
            }
        }
        catch (ex) {
        }
    }

    // If we get to this point, should we alert the user?
    if (probableTZ) {
        return probableTZ;
    }

    // Everything failed, so this is our only option.
    return "floating";
}

/**
 * Shared dialog functions
 */

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
 * @param aCallback  function that should be run when the dialog is accepted
 */
function openCalendarProperties(aCalendar, aCallback) {
    openDialog("chrome://calendar/content/calendarProperties.xul",
               "caEditServer", "chrome,titlebar,modal",
               {calendar: aCalendar, onOk: aCallback});
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
 * Gets the value of a string in a .properties file
 *
 * @param aBundleName  the name of the properties file.  It is assumed that the
 *                     file lives in chrome://calendar/locale/
 * @param aStringName  the name of the string within the properties file
 * @param aParams      optional array of parameters to format the string
 */
function calGetString(aBundleName, aStringName, aParams) {
    try {
        var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService);
        var props = sbs.createBundle("chrome://calendar/locale/"+aBundleName+".properties");

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
 * @param aIID           IID to use in comparison
 */
function compareObjects(aObject, aOtherObject, aIID) {
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
 * Ensures the passed IID is in the list, else throws Components.results.NS_ERROR_NO_INTERFACE.
 */
function ensureIID(aList, aIID) {
    function checkIID(iid) {
        return iid.equals(aIID);
    }
    if (!aList.some(checkIID)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
}

/**
 * Takes care of all QueryInterface business, including calling the QI of any
 * existing parent prototypes.
 *
 * @param aSelf         The object the QueryInterface is being made to
 * @param aProto        Caller's prototype object
 * @param aIID          The IID to check for
 * @param aList         An array of interfaces from Components.interfaces
 * @param aClassInfo    (Optional) an Object containing the class info for this
 *                      prototype.
 */
function doQueryInterface(aSelf, aProto, aIID, aList, aClassInfo) {
    if (aClassInfo && aIID.equals(Components.interfaces.nsIClassInfo)) {
        return aClassInfo;
    }

    function checkIID(iid) {
        return iid.equals(aIID);
    }
    if (aList.some(checkIID)) {
        // Does the current prototype offer this implementation?
        return aSelf;
    }

    var base = aProto.__proto__;

    if (base && base.QueryInterface) {
        // Try to QI the base prototype
        return base.QueryInterface.call(aSelf, aIID);
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
    var consoleSvc = Components.classes["@mozilla.org/consoleservice;1"].
                     getService(Components.interfaces.nsIConsoleService);
    consoleSvc.logStringMessage(string);
}

/**
 * Returns a string describing the current js-stack.  Note that this is
 * different than Components.stack, in that STACK just returns that js
 * functions that were called on the way to this function.
 *
 * @param aDepth (optional) The number of frames to include
 */
function STACK(aDepth) {
    var depth = aDepth || 5;
    var stack = "";
    var frame = arguments.callee.caller;
    for (var i = 1; i <= depth; i++) {
        stack += i+": "+ frame.name+ "\n";
        frame = frame.arguments.callee.caller;
        if (!frame) {
            break;
        }
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
 * Auth prompt implementation - Uses password manager if at all possible.
 */
function calAuthPrompt() {
    // use the window watcher service to get a nsIAuthPrompt impl
    this.mPrompter = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                               .getService(Components.interfaces.nsIWindowWatcher)
                               .getNewAuthPrompter(null);
    this.mTriedStoredPassword = false;
}

calAuthPrompt.prototype = {
    prompt: function capP(aDialogTitle, aText, aPasswordRealm, aSavePassword,
                          aDefaultText, aResult) {
        return this.mPrompter.prompt(aDialogTitle, aText, aPasswordRealm,
                                     aSavePassword, aDefaultText, aResult);
    },

    getPasswordInfo: function capGPI(aPasswordRealm) {
        var username;
        var password;
        var found = false;
        var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                        .getService(Components.interfaces.nsIPasswordManager);
        var pwenum = passwordManager.enumerator;
        // step through each password in the password manager until we find the one we want:
        while (pwenum.hasMoreElements()) {
            try {
                var pass = pwenum.getNext().QueryInterface(Components.interfaces.nsIPassword);
                if (pass.host == aPasswordRealm) {
                     // found it!
                     username = pass.user;
                     password = pass.password;
                     found = true;
                     break;
                }
            } catch (ex) {
                // don't do anything here, ignore the password that could not
                // be read
            }
        }
        return {found: found, username: username, password: password};
    },

    promptUsernameAndPassword: function capPUAP(aDialogTitle, aText,
                                                aPasswordRealm,aSavePassword,
                                                aUser, aPwd) {
        var pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(aPasswordRealm);
        }

        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aUser.value = pw.username;
            aPwd.value = pw.password;
            return true;
        } else {
            return this.mPrompter.promptUsernameAndPassword(aDialogTitle, aText,
                                                            aPasswordRealm,
                                                            aSavePassword,
                                                            aUser, aPwd);
        }
    },

    // promptAuth is needed/used on trunk only
    promptAuth: function capPA(aChannel, aLevel, aAuthInfo) {
        // need to match the way the password manager stores host/realm
        var hostRealm = aChannel.URI.host + ":" + aChannel.URI.port + " (" +
                        aAuthInfo.realm + ")";
        var pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(hostRealm);
        }

        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aAuthInfo.username = pw.username;
            aAuthInfo.password = pw.password;
            return true;
        } else {
            var prompter2 = 
                Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                          .getService(Components.interfaces.nsIPromptFactory)
                          .getPrompt(null, Components.interfaces.nsIAuthPrompt2);
            return prompter2.promptAuth(aChannel, aLevel, aAuthInfo);
        }
    },

    promptPassword: function capPP(aDialogTitle, aText, aPasswordRealm,
                             aSavePassword, aPwd) {
        var found = false;
        var pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(aPasswordRealm);
        }

        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aPwd.value = pw.password;
            return true;
        } else {
            return this.mPrompter.promptPassword(aDialogTitle, aText,
                                                 aPasswordRealm, aSavePassword,
                                                 aPwd);
        }
    }
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
 * Returns the start date of an item, ie either an event's start date or a task's entry date.
 */
function calGetStartDate(aItem)
{
    return (isEvent(aItem) ? aItem.startDate : aItem.entryDate);
}

/**
 * Returns the end date of an item, ie either an event's end date or a task's due date.
 */
function calGetEndDate(aItem)
{
    return (isEvent(aItem) ? aItem.endDate : aItem.dueDate);
}

/**
 * Returns the item's start (or due) date if the item is in the specified Range;
 * null otherwise.
 */
function checkIfInRange(item, rangeStart, rangeEnd)
{
    var dueDate = null;
    var startDate = (item.getProperty("DTSTART") ||
                     (dueDate = item.getProperty("DUE")));
    if (!startDate) {
        // DTSTART or DUE mandatory
        return null;
    }
    var endDate = (item.getProperty("DTEND") ||
                   (dueDate ? dueDate : item.getProperty("DUE")) ||
                   startDate);

    var start = ensureDateTime(startDate);
    var end = ensureDateTime(endDate);

    var queryStart = ensureDateTime(rangeStart);
    var queryEnd = ensureDateTime(rangeEnd);

    if (start.compare(end) == 0) {
        if (!queryStart || start.compare(queryStart) >= 0 &&
            (!queryEnd || start.compare(queryEnd) < 0)) {
            return startDate;
        }
    } else {
        if (!queryEnd || start.compare(queryEnd) < 0 &&
            (!queryStart || end.compare(queryStart) > 0)) {
            return startDate;
        }
    }
    return null;
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

function showElement(elementId)
{
    try {
        document.getElementById(elementId).removeAttribute("hidden");
    } catch (e) {
        dump("showElement: Couldn't remove hidden attribute from " + elementId + "\n");
    }
}


function hideElement(elementId)
{
    try {
        document.getElementById(elementId).setAttribute("hidden", "true");
    } catch (e) {
        dump("hideElement: Couldn't set hidden attribute on " + elementId + "\n");
    }
}


function enableElement(elementId)
{
    try {
        //document.getElementById(elementId).setAttribute("disabled", "false");

        // call remove attribute beacuse some widget code checks for the presense of a 
        // disabled attribute, not the value.
        document.getElementById(elementId).removeAttribute("disabled");
    } catch (e) {
        dump("enableElement: Couldn't remove disabled attribute on " + elementId + "\n");
    }
}


function disableElement(elementId)
{
    try {
        document.getElementById(elementId).setAttribute( "disabled", "true");
    } catch (e) {
        dump("disableElement: Couldn't set disabled attribute to true on " +
             elementId + "\n");
    }
}


/**
*   Helper function for filling the form,
*   Set the value of a property of a XUL element
*
* PARAMETERS
*      elementId     - ID of XUL element to set
*      newValue      - value to set property to ( if undefined no change is made )
*      propertyName  - OPTIONAL name of property to set, default is "value",
*                      use "checked" for radios & checkboxes, "data" for
*                      drop-downs
*/
function setElementValue(elementId, newValue, propertyName)
{
    var undefined;

    if (newValue !== undefined) {
        var field = document.getElementById(elementId);

        if (newValue === false) {
            try {
                field.removeAttribute(propertyName);
            } catch (e) {
                dump("setFieldValue: field.removeAttribute couldn't remove " +
                propertyName + " from " + elementId + " e: " + e + "\n");
            }
        } else if (propertyName) {
            try {
                field.setAttribute(propertyName, newValue);
            } catch (e) {
                dump("setFieldValue: field.setAttribute couldn't set " +
                propertyName + " from " + elementId + " to " + newValue +
                " e: " + e + "\n");
            }
        } else {
            field.value = newValue;
        }
    }
}


/**
*   Helper function for getting data from the form,
*   Get the value of a property of a XUL element
*
* PARAMETERS
*      elementId     - ID of XUL element to get from
*      propertyName  - OPTIONAL name of property to set, default is "value",
*                      use "checked" for radios & checkboxes, "data" for
*                      drop-downs
*   RETURN
*      newValue      - value of property
*/
function getElementValue(elementId, propertyName)
{
    var field = document.getElementById(elementId);

    if (propertyName) {
        return field[propertyName];
    }
    return field.value;
}


function processEnableCheckbox(checkboxId, elementId)
{
    if (document.getElementById(checkboxId).checked) {
        enableElement(elementId);
    } else {
        disableElement(elementId);
    }
}


/*
 *  Enable/disable button if there are children in a listbox
 */
function updateListboxDeleteButton(listboxId, buttonId)
{
    if (document.getElementById(listboxId).getRowCount() > 0) {
        enableElement(buttonId);
    } else {
        disableElement(buttonId);
    }
}


/*
 *  Update plural singular menu items
 */
function updateMenuLabels(lengthFieldId, menuId )
{
    var field = document.getElementById(lengthFieldId);
    var menu  = document.getElementById(menuId);

    // figure out whether we should use singular or plural
    var length = field.value;

    var newLabelNumber;

    // XXX This assumes that "0 days, minutes, etc." is plural in other languages.
    if ( (Number(length) == 0) || (Number(length) > 1) ) {
        newLabelNumber = "label2"
    } else {
        newLabelNumber = "label1"
    }

    // see what we currently show and change it if required
    var oldLabelNumber = menu.getAttribute("labelnumber");

    if (newLabelNumber != oldLabelNumber) {
        // remember what we are showing now
        menu.setAttribute("labelnumber", newLabelNumber);

        // update the menu items
        var items = menu.getElementsByTagName("menuitem");

        for(var i = 0; i < items.length; ++i) {
            var menuItem = items[i];
            var newLabel = menuItem.getAttribute(newLabelNumber);
            menuItem.label = newLabel;
            menuItem.setAttribute("label", newLabel);
        }

        // force the menu selection to redraw
        var saveSelectedIndex = menu.selectedIndex;
        menu.selectedIndex = -1;
        menu.selectedIndex = saveSelectedIndex;
    }
}


/** Select value in menuList.  Throws string if no such value. **/

function menuListSelectItem(menuListId, value)
{
    var menuList = document.getElementById(menuListId);
    var index = menuListIndexOf(menuList, value);
    if (index != -1) {
        menuList.selectedIndex = index;
    } else {
        throw "menuListSelectItem: No such Element: "+value;
    }
}


/** Find index of menuitem with the given value, or return -1 if not found. **/

function menuListIndexOf(menuList, value)
{
    var items = menuList.menupopup.childNodes;
    var index = -1;
    for (var i = 0; i < items.length; i++) {
        var element = items[i];
        if (element.nodeName == "menuitem") {
            index++;
        }
        if (element.getAttribute("value") == value) {
            return index;
        }
    }
    return -1; // not found
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
                Components.utils.reportError(exc);
            }
        }
        this.mInterfaces.forEach(notifyFunc);
    }
};

function sendMailTo(aRecipient, aSubject, aBody) {
    if (!aRecipient || aRecipient.length < 1) {
        return;
    }

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

        var uriString = "mailto:" + aRecipient;
        var uriParams = [];

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

var gOpGroupPrefix;
var gOpGroupId = 0;

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
    if (!gOpGroupPrefix) {
        gOpGroupPrefix = (getUUID() + "-");
    }
    this.mCancelFunc = cancelFunc;
    this.mId = (gOpGroupPrefix + gOpGroupId);
    ++gOpGroupId;
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
 * This is a centralized function for setting the prodid and version on an
 * ical components.  This should be used whenever you need to set the prodid
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
    aIcalComponent.prodid = "-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN";
    aIcalComponent.version = "2.0";
}
