/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIScriptableDateFormat = Components.interfaces.nsIScriptableDateFormat;

function calDateTimeFormatter() {
    var strBundleService =
        Components.classes["@mozilla.org/intl/stringbundle;1"]
                  .getService(Components.interfaces.nsIStringBundleService);
    this.mDateStringBundle =  strBundleService.createBundle("chrome://calendar/locale/dateFormat.properties");

    this.mDateService =
        Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                  .getService(nsIScriptableDateFormat);

    // Do does the month or day come first in this locale?
    this.mMonthFirst = false;

    // If LONG FORMATTED DATE is same as short formatted date,
    // then OS has poor extended/long date config, so use workaround.
    this.mUseLongDateService = true;
    var probeDate =
        Components.classes["@mozilla.org/calendar/datetime;1"]
                  .createInstance(Components.interfaces.calIDateTime);
    probeDate.timezone = UTC();
    probeDate.year = 2002;
    probeDate.month = 3;
    probeDate.day = 5;
    try {
        // We're try/catching the calls to nsScriptableDateFormat since it's
        // outside this module. We're also reusing probeDate rather than
        // creating 3 discrete calDateTimes for performance.
        var probeStringA = this.formatDateShort(probeDate);
        var longProbeString = this.formatDateLong(probeDate);
        probeDate.month = 4;
        var probeStringB = this.formatDateShort(probeDate);
        probeDate.month = 3;
        probeDate.day = 6;
        var probeStringC = this.formatDateShort(probeDate);

        // Compare the index of the first differing character between
        // probeStringA to probeStringB and probeStringA to probeStringC.
        for (var i=0; i < probeStringA.length ; i++) {
            if (probeStringA[i] != probeStringB[i]) {
                this.mMonthFirst = true;
                break;
            } else if (probeStringA[i] != probeStringC[i]) {
                this.mMonthFirst = false;
                break;
            }
        }

        // On Unix extended/long date format may be created using %Ex instead
        // of %x. Some systems may not support it and return "Ex" or same as
        // short string. In that case, don't use long date service, use a
        // workaround hack instead.
        if (longProbeString == null ||
            longProbeString.length < 4 ||
            longProbeString == probeStringA)
           this.mUseLongDateService = false;
    } catch (e) {
        this.mUseLongDateService = false;
    }
}

calDateTimeFormatter.prototype = {
    getInterfaces: function getInterfaces(aCount) {
        const interfaces = [Components.interfaces.calIDateTimeFormatter,
                            Components.interfaces.nsIClassInfo,
                            Components.interfaces.nsISupports];

        aCount.value = interfaces.length;
        return interfaces;
    },

    getHelperForLanguage: function cA_getHelperForLanguage(aLang) {
        return null;
    },
    contractID: "@mozilla.org/calendar/datetime-formatter;1",
    classDescription: "Formats Dates and Times",
    classID: Components.ID("{4123da9a-f047-42da-a7d0-cc4175b9f36a}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calDateTimeFormatter.prototype, aIID, null, this);
    },

    formatDate: function formatDate(aDate) {
        // Format the date using user's format preference (long or short)
        let format = cal.getPrefSafe("calendar.date.format", 0);
        return (format == 0 ? this.formatDateLong(aDate) : this.formatDateShort(aDate));
    },

    formatDateShort: function formatDateShort(aDate) {
        return this.mDateService.FormatDate("",
                                            nsIScriptableDateFormat.dateFormatShort,
                                            aDate.year,
                                            aDate.month + 1,
                                            aDate.day);
    },

    formatDateLong: function formatDateLong(aDate) {
        if (this.mUseLongDateService) {
            return this.mDateService.FormatDate("",
                                                nsIScriptableDateFormat.dateFormatLong,
                                                aDate.year,
                                                aDate.month + 1,
                                                aDate.day);
        } else {
            // HACK We are probably on Linux and want a string in long format.
            // dateService.dateFormatLong on Linux may return a short string, so
            // build our own.
            return this.shortDayName(aDate.weekday) + " " +
                   aDate.day + " " +
                   this.shortMonthName(aDate.month) + " " +
                   aDate.year;
        }
    },

    formatDateWithoutYear: function formatDateWithoutYear(aDate) {
        // Doing this the hard way, because nsIScriptableDateFormat doesn't
        // have a way to not include the year.
        if (this.mMonthFirst) {
            return this.shortMonthName(aDate.month) + " " + aDate.day;
        } else {
            return aDate.day + " " + this.shortMonthName(aDate.month);
        }
    },

    formatTime: function formatTime(aDate) {
        if (aDate.isDate)
            return this.mDateStringBundle.GetStringFromName("AllDay");

        return this.mDateService.FormatTime("",
                                            nsIScriptableDateFormat.timeFormatNoSeconds,
                                            aDate.hour,
                                            aDate.minute,
                                            0);
    },

    formatDateTime: function formatDateTime(aDate) {
        let formattedDate = this.formatDate(aDate);
        let formattedTime = this.formatTime(aDate);

        let timeBeforeDate = cal.getPrefSafe("calendar.date.formatTimeBeforeDate", false);
        if (timeBeforeDate) {
            return formattedTime + " " + formattedDate;
        } else {
            return formattedDate + " " + formattedTime;
        }
    },

    formatTimeInterval: function formatTimeInterval(aStartDate, aEndDate) {
        if (!aStartDate && aEndDate) return this.formatTime(aEndDate);
        if (!aEndDate && aStartDate) return this.formatTime(aStartDate);
        if (!aStartDate && !aEndDate) return "";

        // TODO do we need l10n for this?
        // TODO should we check for the same day? The caller should know what
        // he is doing...
        return this.formatTime(aStartDate) + "\u2013" + this.formatTime(aEndDate);
    },

    formatInterval: function formatInterval(aStartDate, aEndDate) {
        // Check for tasks without start and/or due date
        if (aEndDate == null && aStartDate == null ) {
            return calGetString("calendar", "datetimeIntervalTaskWithoutDate");
        } else if (aEndDate == null) {
            let startDateString = this.formatDate(aStartDate);
            let startTime = this.formatTime(aStartDate);
            return calGetString("calendar", "datetimeIntervalTaskWithoutDueDate", [startDateString, startTime]);
        } else if (aStartDate == null) {
            let endDateString = this.formatDate(aEndDate);
            let endTime = this.formatTime(aEndDate);
            return calGetString("calendar", "datetimeIntervalTaskWithoutStartDate", [endDateString, endTime]);
        }
        // Here there are only events or tasks with both start and due date.
        // make sure start and end use the same timezone when formatting intervals:
        let endDate = aEndDate.getInTimezone(aStartDate.timezone);
        let testdate = aStartDate.clone();
        testdate.isDate = true;
        let sameDay = (testdate.compare(endDate) == 0);
        if (aStartDate.isDate) {
            // All-day interval, so we should leave out the time part
            if (sameDay) {
                return this.formatDateLong(aStartDate);
            } else {
                let startDay = aStartDate.day;
                let startYear = aStartDate.year;
                let endDay = endDate.day;
                let endYear = endDate.year;
                if (aStartDate.year != endDate.year) {
                    let startMonthName = cal.formatMonth(aStartDate.month + 1, "calendar", "dayIntervalBetweenYears");
                    let endMonthName = cal.formatMonth(aEndDate.month + 1, "calendar", "dayIntervalBetweenYears");
                    return calGetString("calendar", "dayIntervalBetweenYears", [startMonthName, startDay, startYear, endMonthName, endDay, endYear]);
                } else if (aStartDate.month != endDate.month) {
                    let startMonthName = cal.formatMonth(aStartDate.month + 1, "calendar", "dayIntervalBetweenMonths");
                    let endMonthName = cal.formatMonth(aEndDate.month + 1, "calendar", "dayIntervalBetweenMonths");
                    return calGetString("calendar", "dayIntervalBetweenMonths", [startMonthName, startDay, endMonthName, endDay, endYear]);
                } else {
                    let startMonthName = cal.formatMonth(aStartDate.month + 1, "calendar", "dayIntervalInMonth");
                    return calGetString("calendar", "dayIntervalInMonth", [startMonthName, startDay, endDay, endYear]);
                }
            }
        } else {
            let startDateString = this.formatDate(aStartDate);
            let startTime = this.formatTime(aStartDate);
            let endDateString = this.formatDate(endDate);
            let endTime = this.formatTime(endDate);
            // non-allday, so need to return date and time
            if (sameDay) {
                // End is on the same day as start, so we can leave out the end date
                if (startTime == endTime) {
                    // End time is on the same time as start, so we can leave out the end time
                    // "5 Jan 2006 13:00"
                    return calGetString("calendar", "datetimeIntervalOnSameDateTime", [startDateString, startTime]);
                } else {
                    // still include end time
                    // "5 Jan 2006 13:00 - 17:00"
                    return calGetString("calendar", "datetimeIntervalOnSameDay", [startDateString, startTime, endTime]);
                }
            } else {
                // Spanning multiple days, so need to include date and time
                // for start and end
                // "5 Jan 2006 13:00 - 7 Jan 2006 9:00"
                return calGetString("calendar", "datetimeIntervalOnSeveralDays", [startDateString, startTime, endDateString, endTime]);
            }
        }
    },

    _getItemDates: function _getItemDates(aItem) {
        let start = aItem[calGetStartDateProp(aItem)];
        let end = aItem[calGetEndDateProp(aItem)];
        let kDefaultTimezone = calendarDefaultTimezone();
        // Check for tasks without start and/or due date
        if (start) {
            start = start.getInTimezone(kDefaultTimezone);
        }
        if (end) {
            end = end.getInTimezone(kDefaultTimezone);
        }
        // EndDate is exclusive. For all-day events, we ened to substract one day,
        // to get into a format that's understandable.
        if (start && start.isDate && end) {
            end.day -= 1;
        }

        return [start, end];
    },

    formatItemInterval: function formatItemInterval(aItem) {
        return this.formatInterval.apply(this, this._getItemDates(aItem));
    },

    formatItemTimeInterval: function formatItemTimeInterval(aItem) {
        return this.formatTimeInterval.apply(this, this._getItemDates(aItem));
    },

    monthName: function monthName(aMonthIndex) {
        let oneBasedMonthIndex = aMonthIndex + 1;
        return this.mDateStringBundle.GetStringFromName("month." + oneBasedMonthIndex + ".name" );
    },

    shortMonthName: function shortMonthName(aMonthIndex) {
        let oneBasedMonthIndex = aMonthIndex + 1;
        return this.mDateStringBundle.GetStringFromName("month." + oneBasedMonthIndex + ".Mmm" );
    },

    dayName: function dayName(aDayIndex) {
        let oneBasedDayIndex = aDayIndex + 1;
        return this.mDateStringBundle.GetStringFromName("day." + oneBasedDayIndex + ".name" );
    },

    shortDayName: function shortDayName(aDayIndex) {
        let oneBasedDayIndex = aDayIndex + 1;
        return this.mDateStringBundle.GetStringFromName("day." + oneBasedDayIndex + ".Mmm" );
    }
};
