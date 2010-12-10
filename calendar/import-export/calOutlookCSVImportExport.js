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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 * Jussi Kukkonen <jussi.kukkonen@welho.com>.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michiel van Leeuwen <mvl@exedo.nl>
 *   Ernst Herbst <hb@calen.de>
 *   Philipp Kewisch <mozilla@kewis.ch>
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

Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");

const localeEn = {
    headTitle       : "Subject",
    headStartDate   : "Start Date",
    headStartTime   : "Start Time",
    headEndDate     : "End Date",
    headEndTime     : "End Time",
    headAllDayEvent : "All day event",
    headAlarm       : "Reminder on/off",
    headAlarmDate   : "Reminder Date",
    headAlarmTime   : "Reminder Time",
    headCategories  : "Categories",
    headDescription : "Description",
    headLocation    : "Location",
    headPrivate     : "Private",

    valueTrue       : "True",
    valueFalse      : "False",

    dateRe          : /^(\d+)\/(\d+)\/(\d+)$/,
    dateDayIndex    : 2,
    dateMonthIndex  : 1,
    dateYearIndex   : 3,
    dateFormat      : "%m/%d/%y",

    timeRe          : /^(\d+):(\d+):(\d+) (\w+)$/,
    timeHourIndex   : 1,
    timeMinuteIndex : 2,
    timeSecondIndex : 3,
    timeAmPmIndex   : 4,
    timeAmString    : "AM",
    timePmString    : "PM",
    timeFormat      : "%I:%M:%S %p"
};

const localeNl = {
    headTitle       : "Onderwerp",
    headStartDate   : "Begindatum",
    headStartTime   : "Begintijd",
    headEndDate     : "Einddatum",
    headEndTime     : "Eindtijd",
    headAllDayEvent : "Evenement, duurt hele dag",
    headAlarm       : "Herinneringen aan/uit",
    headAlarmDate   : "Herinneringsdatum",
    headAlarmTime   : "Herinneringstijd",
    headCategories  : "Categorieën",
    headDescription : "Beschrijving",
    headLocation    : "Locatie",
    headPrivate     : "Privé",

    valueTrue       : "Waar",
    valueFalse      : "Onwaar",

    dateRe          : /^(\d+)-(\d+)-(\d+)$/,
    dateDayIndex    : 1,
    dateMonthIndex  : 2,
    dateYearIndex   : 3,
    dateFormat      : "%d-%m-%y",

    timeRe          : /^(\d+):(\d+):(\d+)$/,
    timeHourIndex   : 1,
    timeMinuteIndex : 2,
    timeSecondIndex : 3,
    timeFormat      : "%H:%M:%S"
};

const locales = [localeEn, localeNl];

// Windows line endings, CSV files with LF only can't be read by Outlook.
const exportLineEnding = "\r\n";

// Shared functions
function getOutlookCsvFileTypes(aCount) {
    aCount.value = 1;
    let wildmat = '*.csv';
    let label = cal.calGetString("calendar", 'filterOutlookCsv', [wildmat]);
    return [{ defaultExtension: 'csv',
              extensionFilter: wildmat,
              description: label }];
}

// Importer
function calOutlookCSVImporter() {
}

calOutlookCSVImporter.prototype = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIImporter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/import;1?type=csv",
    classDescription: "Calendar Outlook CSV Importer",
    classID: Components.ID("{64a5d17a-0497-48c5-b54f-72b15c9e9a14}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calOutlookCSVImporter.prototype, aIID, null, this);
    },

    getFileTypes: getOutlookCsvFileTypes,

    /**
     * Takes a text block of Outlook-exported Comma Separated Values and tries to
     * parse that into individual events.
     *
     * First line is field names, all quoted with double quotes.  Field names are
     * locale dependendent.  In English the recognized field names are:
     *   "Title","Start Date","Start Time","End Date","End Time","All day event",
     *   "Reminder on/off","Reminder Date","Reminder Time","Categories",
     *   "Description","Location","Private"
     *  The fields "Title" and "Start Date" are mandatory. If "Start Time" misses
     *  the event is set as all day event. If "End Date" or "End Time" miss the
     *  default durations are set.
     *
     * The rest of the lines are events, one event per line, with fields in the
     * order descibed by the first line.   All non-empty values must be quoted.
     *
     * Returns: an array of parsed calendarEvents.
     *   If the parse is cancelled, a zero length array is returned.
     */
    importFromStream: function csv_importFromStream(aStream, aCount) {
        let scriptableInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
                                              .createInstance(Components.interfaces.nsIScriptableInputStream);
        scriptableInputStream.init(aStream);
        let str = scriptableInputStream.read(-1);

        parse: {
            // parse header line of quoted comma separated column names.
            let trimEndQuotesRegExp = /^"(.*)"$/m;
            let trimResults = trimEndQuotesRegExp.exec( str );
            let header = trimResults && trimResults[1].split(/","/);
            if (header == null) {
                break parse;
            }

            //strip header from string
            str = str.slice(trimResults[0].length);

            let args = {};
            //args.fieldList contains the field names from the first row of CSV
            args.fieldList = header;

            let locale;
            let i;
            for (i in locales) {
                locale = locales[i];
                let knownIndxs = 0;
                args.titleIndex = 0;
                args.startDateIndex = 0;
                for (let i = 1; i <= header.length; ++i) {
                    switch( header[i-1] ) {
                        case locale.headTitle:        args.titleIndex = i;       knownIndxs++; break;
                        case locale.headStartDate:    args.startDateIndex = i;   knownIndxs++; break;
                        case locale.headStartTime:    args.startTimeIndex = i;   knownIndxs++; break;
                        case locale.headEndDate:      args.endDateIndex = i;     knownIndxs++; break;
                        case locale.headEndTime:      args.endTimeIndex = i;     knownIndxs++; break;
                        case locale.headAllDayEvent:  args.allDayIndex = i;      knownIndxs++; break;
                        case locale.headAlarm:        args.alarmIndex = i;       knownIndxs++; break;
                        case locale.headAlarmDate:    args.alarmDateIndex = i;   knownIndxs++; break;
                        case locale.headAlarmTime:    args.alarmTimeIndex = i;   knownIndxs++; break;
                        case locale.headCategories:   args.categoriesIndex = i;  knownIndxs++; break;
                        case locale.headDescription:  args.descriptionIndex = i; knownIndxs++; break;
                        case locale.headLocation:     args.locationIndex = i;    knownIndxs++; break;
                        case locale.headPrivate:      args.privateIndex = i;     knownIndxs++; break;
                    }
                }
                // Were both mandatory fields recognized?
                if (args.titleIndex != 0 && args.startDateIndex != 0) {
                    break;
                }
            }

            if (knownIndxs == 0 && header.length == 22) {
                // set default indexes for a default Outlook2000 CSV file
                args.titleIndex = 1;
                args.startDateIndex = 2;
                args.startTimeIndex = 3;
                args.endDateIndex = 4;
                args.endTimeIndex = 5;
                args.allDayIndex = 6;
                args.alarmIndex = 7;
                args.alarmDateIndex = 8;
                args.alarmTimeIndex = 9;
                args.categoriesIndex = 15;
                args.descriptionIndex = 16;
                args.locationIndex = 17;
                args.privateIndex = 20;
            }

            if (args.titleIndex == 0 || args.startDateIndex == 0) {
                dump("Can't import. Life sucks\n")
                break parse;
            }

            // Construct event regexp according to field indexes. The regexp can
            // be made stricter, if it seems this matches too loosely.
            let regExpStr = "^";
            for (i = 1; i <= header.length; i++) {
                if (i > 1)
                    regExpStr += ",";
                regExpStr += "(?:\"((?:[^\"]|\"\")*)\")?";
            }
            regExpStr += "$";

            // eventRegExp: regexp for reading events (this one'll be constructed on fly)
            const eventRegExp = new RegExp(regExpStr, "gm");

            // match first line
            let eventFields = eventRegExp(str);

            if (eventFields == null)
                break parse;

            args.boolStr = localeEn.valueTrue;
            args.boolIsTrue = true;

            let dateParseConfirmed = false;
            let eventArray = new Array();
            do {
                // At this point eventFields contains following fields. Position
                // of fields is in args.[fieldname]Index.
                //    subject, start date, start time, end date, end time,
                //    all day, alarm on, alarm date, alarm time,
                //    Description, Categories, Location, Private
                // Unused fields (could maybe be copied to Description):
                //    Meeting Organizer, Required Attendees, Optional Attendees,
                //    Meeting Resources, Billing Information, Mileage, Priority,
                //    Sensitivity, Show time as

                let title = ("titleIndex" in args
                             ? this.parseTextField(eventFields[args.titleIndex]) : "");
                let sDate = this.parseDateTime(eventFields[args.startDateIndex],
                                               eventFields[args.startTimeIndex],
                                               locale);
                let eDate = this.parseDateTime(eventFields[args.endDateIndex],
                                               eventFields[args.endTimeIndex],
                                               locale);
                // Create an event only if we have a startDate. No more checks
                // on sDate needed in the following process.
                if (sDate) {
                    let event = cal.createEvent();

                    // Use column head in brackets if event title misses in data.
                    if (title) {
                        event.title = title;
                    } else {
                        event.title = "[" + locale.headTitle + "]";
                    }

                    // Check data for all day event. Additionally sDate.isDate
                    // may have been set in parseDateTime() if no time was found
                    if (eventFields[args.allDayIndex] == locale.valueTrue) {
                        sDate.isDate = true;
                    }
                    if (locale.valueTrue == eventFields[args.privateIndex]) {
                        event.privacy = "PRIVATE";
                    }

                    if (!eDate) {
                        // No endDate was found. All day events last one day and
                        // timed events last the default length.
                        eDate = sDate.clone();
                        if (sDate.isDate) {
                            // end date is exclusive, so set to next day after start.
                            eDate.day += 1;
                        } else {
                            eDate.minute += cal.getPrefSafe("calendar.event.defaultlength", 60);
                        }
                    } else {
                        // An endDate was found.
                        if (sDate.isDate) {
                            // A time part for the startDate is missing or was
                            // not recognized. We have to throw away the endDates
                            // time part too for obtaining a valid event.
                            eDate.isDate = true;
                            // Correct the eDate if duration is less than one day.
                            if (1 > eDate.subtractDate(sDate).days) {
                                eDate = sDate.clone();
                                eDate.day += 1;
                            }
                        } else {
                            // We now have a timed startDate and an endDate. If the
                            // end time is invalid set it to 23:59:00
                            if (eDate.isDate) {
                                eDate.isDate = false;
                                eDate.hour   = 23;
                                eDate.minute = 59;
                            }
                            // Correct the duration to 0 seconds if it is negative.
                            if (eDate.subtractDate(sDate).isNegative ) {
                                eDate = sDate.clone();
                            }
                        }
                    }
                    event.startDate = sDate;
                    event.endDate = eDate;

                    // Exists an alarm true/false column?
                    if ("alarmIndex" in args) {
                        // Is an alarm wanted for this event?
                        if (locale.valueTrue == eventFields[args.alarmIndex]) {
                            let alarmDate =
                                    this.parseDateTime(eventFields[args.alarmDateIndex],
                                                       eventFields[args.alarmTimeIndex],
                                                       locale);
                            // Only set the alarm if a date was parsed
                            if (alarmDate) {
                                let alarm = cal.createAlarm();
                                alarm.related = alarm.ALARM_RELATED_ABSOLUTE;
                                alarm.alarmDate = alarmDate;
                                event.addAlarm(alarm);
                            } else {
                                // XXX Is this really wanted here?
                                cal.alarms.setDefaultValues(event);
                            }
                        }
                    }

                    // Using the "Private" field only for getting privacy status.
                    // "Sensitivity" is neglected for now.
                    if ("privateIndex" in args) {
                        if (locale.valueTrue == eventFields[args.privateIndex]) {
                            event.privacy = "PRIVATE";
                        }
                    }

                    // Avoid setting empty properties
                    let txt = "";
                    if ("descriptionIndex" in args) {
                        txt = this.parseTextField(eventFields[args.descriptionIndex])
                        if (txt) {
                            event.setProperty("DESCRIPTION", txt);
                        }
                    }
                    if ("categoriesIndex" in args) {
                        txt = this.parseTextField(eventFields[args.categoriesIndex])
                        if (txt) {
                            let categories = categoriesStringToArray(txt);
                            event.setCategories(categories.length, categories);
                        }
                    }
                    if ("locationIndex" in args) {
                        txt = this.parseTextField(eventFields[args.locationIndex])
                        if (txt) {
                            event.setProperty("LOCATION", txt);
                        }
                    }

                    //save the event into return array
                    eventArray.push(event);
                }

                //get next events fields
                eventFields = eventRegExp(str);

            } while (eventRegExp.lastIndex != 0);

            // return results
            aCount.value = eventArray.length;
            return eventArray;

        } // end parse

        // The parse was cancelled, return an empty array of events.
        aCount.value = 0;
        return [];
    },

    parseDateTime: function parseDateTime(aDate, aTime, aLocale) {
        let dt = cal.createDateTime();

        //XXX Can we do better?
        dt.timezone = cal.floating();

        let rd = aLocale.dateRe.exec(aDate);
        let rt = aLocale.timeRe.exec(aTime);

        if (!rd || !rt) {
            return null;
        }

        dt.year = rd[aLocale.dateYearIndex];
        dt.month = rd[aLocale.dateMonthIndex] - 1;
        dt.day = rd[aLocale.dateDayIndex];
        if (rt) {
            dt.hour = Number(rt[aLocale.timeHourIndex]);
            dt.minute = rt[aLocale.timeMinuteIndex];
            dt.second = rt[aLocale.timeSecondIndex];
        } else {
            dt.isDate = true;
        }

        if (rt && aLocale.timeAmPmIndex &&
            rt[aLocale.timeAmPmIndex] != aLocale.timePmString) {
            // AM
            if (dt.hour == 12) {
                dt.hour = 0;
            }
        } else {
            // PM
            if (dt.hour < 12) {
               dt.hour += 12;
            }
        }
        return dt;
    },

    parseTextField: function parseTextField(aTextField) {
        return aTextField ? aTextField.replace(/""/g, "\"") : "";
    }
};

// Exporter
function calOutlookCSVExporter() {
}

calOutlookCSVExporter.prototype = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIExporter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/export;1?type=csv",
    classDescription: "Calendar Outlook CSV Exporter",
    classID: Components.ID("{48e6d3a6-b41b-4052-9ed2-40b27800bd4b}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calOutlookCSVExporter.prototype, aIID, null, this);
    },

    getFileTypes: getOutlookCsvFileTypes,

    exportToStream: function csv_exportToStream(aStream, aCount, aItems) {
        // Helper functions
        function dateString(aDateTime) aDateTime.jsDate.toLocaleFormat(localeEn.dateFormat);
        function timeString(aDateTime) aDateTime.jsDate.toLocaleFormat(localeEn.timeFormat);
        function txtString(aString) aString || "";

        let str = "";
        let headers = [];
        // Not using a loop here, since we need to be sure the order here matches
        // with the orders the field data is added later on
        headers.push(localeEn['headTitle']);
        headers.push(localeEn['headStartDate']);
        headers.push(localeEn['headStartTime']);
        headers.push(localeEn['headEndDate']);
        headers.push(localeEn['headEndTime']);
        headers.push(localeEn['headAllDayEvent']);
        headers.push(localeEn['headAlarm']);
        headers.push(localeEn['headAlarmDate']);
        headers.push(localeEn['headAlarmTime']);
        headers.push(localeEn['headCategories']);
        headers.push(localeEn['headDescription']);
        headers.push(localeEn['headLocation']);
        headers.push(localeEn['headPrivate']);
        headers = headers.map(function(v) {
            return '"' + v + '"';
        });
        str = headers.join(',');
        str += exportLineEnding;
        aStream.write(str, str.length);

        for each (item in aItems) {
            if (!cal.isEvent(item)) {
                // XXX TODO: warn the user (once) that tasks are not supported
                // (bug 336175)
                continue;
            }
            let line = [];
            line.push(item.title);
            line.push(dateString(item.startDate));
            line.push(timeString(item.startDate));
            line.push(dateString(item.endDate));
            line.push(timeString(item.endDate));
            line.push(item.startDate.isDate ? localeEn.valueTrue : localeEn.valueFalse);
            let alarmDate;
            let alarms = item.getAlarms({});
            if (alarms.length) {
                alarmDate = cal.alarms.calculateAlarmDate(item, alarms[0]);
            }
            line.push(alarmDate ? localeEn.valueTrue : localeEn.valueFalse);
            line.push(alarmDate ? dateString(alarmDate) : "");
            line.push(alarmDate ? timeString(alarmDate) : "");
            line.push(txtString(categoriesArrayToString(item.getCategories({})))); // xxx todo: what's the correct way to encode ',' in csv?, how are multi-values expressed?
            line.push(txtString(item.getProperty("DESCRIPTION")));
            line.push(txtString(item.getProperty("LOCATION")));
            line.push((item.privacy=="PRIVATE") ? localeEn.valueTrue : localeEn.valueFalse);

            line = line.map(function(v) {
                v = String(v).replace(/"/g,'""');
                return '"'+v+'"';
            })
            str = line.join(',') + exportLineEnding;
            aStream.write(str, str.length);
        }
    }
};
