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
 *   Joey Minta <jminta@gmail.com>
 *
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Willis <mattwillis@gmail.com>
 *   Diego Mira David <diegomd86@gmail.com>
 *   Eduardo Teruo Katayama <eduardo@ime.usp.br>
 *   Glaucus Augustus Grecco Cardoso <glaucus@ime.usp.br>
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

Components.utils.import("resource://calendar/modules/calPrintUtils.jsm");

/**
 * Prints a rough month-grid of events/tasks
 */
function calMonthPrinter() {
}

calMonthPrinter.prototype = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIPrintFormatter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/printformatter;1?type=monthgrid",
    classDescription: "Calendar Month Grid Print Formatter",
    classID: Components.ID("{f42d5132-92c4-487b-b5c8-38bf292d74c1}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calMonthPrinter.prototype, aIID, null, this);
    },

    get name() {
        return cal.calGetString("calendar", "monthPrinterName");
    },

    formatToHtml: function monthPrint_format(aStream, aStart, aEnd, aCount, aItems, aTitle) {
        let html = <html/>
        html.appendChild(
                <head>
                    <title>{aTitle}</title>
                    <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
                    <link rel='stylesheet' type='text/css' href='chrome://calendar/skin/calendar-printing.css'/>
                </head>);
        html.head.style = ".main-table { font-size: 26px; font-weight: bold; }\n";
        html.head.style += ".day-name { border: 1px solid black; background-color: white; font-size: 12px; font-weight: bold; }\n";
        html.head.style += ".day-box { border: 1px solid black; vertical-align: top; }\n";
        html.head.style += ".out-of-month { background-color: white !important; }\n";
        html.head.style += ".day-off { background-color: white !important; }\n";

        // If aStart or aEnd weren't passed in, we need to calculate them based on
        // aItems data.

        let start = aStart;
        let end = aEnd;
        if (!start || !end) {
            for each (let item in aItems) {
                let itemStart = item[cal.calGetStartDateProp(item)];
                let itemEnd = item[cal.calGetEndDateProp(item)];
                if (!start || (itemStart && start.compare(itemStart) == 1)) {
                    start = itemStart;
                }
                if (!end || (itemEnd && end.compare(itemEnd) == -1)) {
                    end = itemEnd;
                }
            }
        }

        // Play around with aStart and aEnd to determine the minimal number of
        // months we can show to still technically meet their requirements.  This
        // is most useful when someone printed 'Current View' in the month view. If
        // we take the aStart and aEnd literally, we'll print 3 months (because of
        // the extra days at the start/end), but we should avoid that.
        //
        // Basically, we check whether aStart falls in the same week as the start
        // of a month (ie aStart  is Jan 29, which often is in the same week as
        // Feb 1), and similarly whether aEnd falls in the same week as the end of
        // a month.
        let weekStart = cal.getPrefSafe("calendar.week.start", 0);
        let maybeNewStart = start.clone();
        maybeNewStart.day = 1;
        maybeNewStart.month = start.month+1;

        let dt = start.clone();

        // First we have to adjust the end date for comparison, as the
        // provided end date is exclusive, i.e. will not be displayed.

        let realEnd = end.clone();
        realEnd.day -= 1;

        if (start.compare(realEnd) <= 0) {
            // Only adjust dates if start date is earlier than end date.

            if ((start.month != realEnd.month) || (start.year != realEnd.year)) {
                // We only need to adjust if start and end are in different months.

                // We want to check whether or not the start day is in the same
                // week as the beginning of the next month. To do this, we take
                // the start date, add seven days and subtract the "day of week"
                // value (which has to be corrected in case we do not start on
                // Sunday).
                let testBegin = start.clone();
                let startWeekday = testBegin.weekday;
                if (startWeekday < weekStart) {
                    startWeekday += 7;
                }
                testBegin.day += 7 + weekStart - startWeekday;
                if (testBegin.compare(maybeNewStart) > 0) {
                    start = maybeNewStart;
                    dt = start.clone();
                }
            }
            if ((start.month != realEnd.month) || (start.year != realEnd.year)) {
                // We only need to adjust if start and end are in different months.

                // Next, we want to check whether or not the end day is in the same
                // week as the end of the previous month. So we have to get the
                // "day of week" value for the end of the previous month, adjust it
                // if necessary (when start of week is not Sunday) and check if the
                // end day is in the same week.

                let lastDayOfPreviousMonth = end.clone();
                lastDayOfPreviousMonth.day = 0;
                let lastDayWeekday = lastDayOfPreviousMonth.weekday;
                if (lastDayWeekday < weekStart) {
                    lastDayWeekday += 7;
                }
                if (dt.month != end.month) {
                    dt.day = 1;
                }
                if ((lastDayWeekday + end.day - 1) < (7 + weekStart)) {
                    dt.day = end.day;
                }

                // Finally, we have to check whether we adjusted the dates too
                // well so that nothing is printed. That happens if you print just
                // one week which has the last day of a month in it.

                if (dt.compare(end) >= 0) {
                    dt.day = 1;
                }
            } else {
                dt.day = 1;
            }
        } else {
             // If start date is after end date, just print empty month.
             dt = realEnd.clone();
        }

        let body = <body/>

        while (dt.compare(end) < 0) {
            let monthName = cal.calGetString("dateFormat", "month." + (dt.month +1) + ".name");
            monthName += " " + dt.year;
            body.appendChild(
                         <table border='0' width='100%' class='main-table'>
                             <tr>
                                 <td align='center' valign='bottom'>{monthName}</td>
                             </tr>
                         </table>);
            body.appendChild(this.getStringForMonth(dt, aItems));
            // Make sure each month gets put on its own page
            body.appendChild(<br style="page-break-after:always;"/>);
            dt.month++;
        }
        let tasks = cal.print.getTasksWithoutDueDate(aItems, dt);
        body.appendChild(tasks);
        html.appendChild(body);
        let convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIConverterOutputStream);
        convStream.init(aStream, 'UTF-8', 0, 0x0000);
        convStream.writeString(html.toXMLString());
    },

    getStringForMonth: function monthPrint_getStringForMonth(aStart, aItems) {
        let weekStart = cal.getPrefSafe("calendar.week.start", 0);

        let monthTable = <table style='border:1px solid black;' width='100%'/>
        let dayNameRow = <tr/>
        for (let i = 0; i < 7; i++) {
            let dayName = cal.calGetString("dateFormat", "day."+ (((weekStart+i)%7)+1) + ".Mmm");
            dayNameRow.appendChild(<td class='day-name' align='center'>{dayName}</td>);
        }
        monthTable.appendChild(dayNameRow);

        // Set up the item-list so it's easy to work with.
        function hasUsableDate(item) item.startDate || item.entryDate || item.dueDate;
        let filteredItems = aItems.filter(hasUsableDate);

        function compareItems(a, b) {
            // Sort tasks before events
            if (cal.isEvent(a) && cal.isToDo(b)) {
                return 1;
            }
            if (cal.isToDo(a) && cal.isEvent(b)) {
                return -1;
            }
            if (cal.isEvent(a)) {
                let startCompare = a.startDate.compare(b.startDate);
                if (startCompare != 0) {
                    return startCompare;
                }
                return a.endDate.compare(b.endDate);
            }
            let aDate = a.entryDate || a.dueDate;
            let bDate = b.entryDate || b.dueDate;
            return aDate.compare(bDate);
        }
        let sortedList = filteredItems.sort(compareItems);
        let firstDate = aStart.startOfMonth.startOfWeek.clone();
        firstDate.day += weekStart;
        if (aStart.startOfMonth.weekday < weekStart) {
            // Go back one week to make sure we display this day
            firstDate.day -= 7;
        }

        let lastDate = aStart.endOfMonth.endOfWeek.clone();
        if (aStart.endOfMonth.weekday < weekStart) {
            // Go back one week so we don't display any extra days
            lastDate.day -= 7;
        }
        firstDate.isDate = true;
        lastDate.isDate = true;

        let dt = firstDate.clone();
        let itemListIndex = 0;
        while (dt.compare(lastDate) != 1) {
            monthTable.appendChild(this.makeHTMLWeek(dt, sortedList, aStart.month));
        }
        return monthTable;
    },

    makeHTMLWeek: function makeHTMLWeek(dt, sortedList, targetMonth) {
        let weekRow = <tr/>;
        const weekPrefix = "calendar.week.";
        let prefNames = ["d0sundaysoff", "d1mondaysoff", "d2tuesdaysoff",
                         "d3wednesdaysoff", "d4thursdaysoff", "d5fridaysoff", "d6saturdaysoff"];
        let defaults = [true, false, false, false, false, false, true];
        let daysOff = [];
        for (let i in prefNames) {
            if (cal.getPrefSafe(weekPrefix+prefNames[i], defaults[i])) {
                daysOff.push(Number(i));
            }
        }

        for (let i = 0; i < 7; i++) {
            let myClass = 'day-box';
            if (dt.month != targetMonth) {
                myClass += ' out-of-month';
            } else if (daysOff.some(function(a) { return a == dt.weekday; })) {
                myClass += ' day-off';
            }
            let day = <td align='left' valign='top' class={myClass} height='100' width='100'/>
            let innerTable = <table valign='top' style='font-size: 10px;'/>
            let dateLabel = <tr valign='top'>
                                <td valign='top' align='left'>{dt.day}</td>
                            </tr>
            innerTable.appendChild(dateLabel);
            let defaultTimezone = cal.calendarDefaultTimezone();
            for each (let item in sortedList) {
                let sDate = item.startDate || item.entryDate || item.dueDate;
                let eDate = item.endDate || item.dueDate || item.entryDate;
                if (sDate) {
                    sDate = sDate.getInTimezone(defaultTimezone);
                }
                if (eDate) {
                    eDate = eDate.getInTimezone(defaultTimezone);
                }

                // end dates are exclusive
                if (sDate.isDate) {
                    eDate = eDate.clone();
                    eDate.day -= 1;
                }
                if (!eDate || eDate.compare(dt) == -1) {
                    continue;
                }
                let itemListIndex = i;
                if (!sDate || sDate.compare(dt) == 1) {
                    break;
                }

                let time = (!sDate.isDate ? cal.getDateFormatter().formatTime(sDate) : "");
                let calColor = item.calendar.getProperty('color') || "#A8C2E1";
                let pb2 = Components.classes["@mozilla.org/preferences-service;1"]
                                    .getService(Components.interfaces.nsIPrefBranch2);
                let catColor;
                for each (let cat in item.getCategories({})) {
                    try {
                        catColor = pb2.getCharPref("calendar.category.color." + cat.toLowerCase());
                        break; // take first matching
                    } catch (ex) {}
                }

                let style = 'font-size: 11px; text-align: left;';
                style += ' background-color: ' + calColor + ';';
                style += ' color: ' + cal.getContrastingTextColor(calColor);
                if (catColor) {
                    style += ' border: solid ' + catColor + ' 2px;';
                }
                let tableRow = <tr><td valign='top' style={style}>{time} {item.title}</td></tr>;
                innerTable.appendChild(tableRow);
            }
            day.appendChild(innerTable);
            weekRow.appendChild(day);
            dt.day++;
        }
        return weekRow;
    }
};
