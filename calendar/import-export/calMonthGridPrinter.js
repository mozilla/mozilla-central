/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Willis <mattwillis@gmail.com>
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

/**
 * Prints a rough month-grid of events/tasks
 */

function calMonthPrinter() {
    this.wrappedJSObject = this;
}

calMonthPrinter.prototype.QueryInterface =
function QueryInterface(aIID) {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.calIPrintFormatter)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }

    return this;
};

calMonthPrinter.prototype.getName =
function monthPrint_getName() {
    return calGetString("calendar", "monthPrinterName");
};
calMonthPrinter.prototype.__defineGetter__("name", calMonthPrinter.prototype.getName);

calMonthPrinter.prototype.formatToHtml =
function monthPrint_format(aStream, aStart, aEnd, aCount, aItems, aTitle) {
    var html = <html/>
    html.appendChild(
            <head>
                <title>{aTitle}</title>
                <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
                <style type='text/css'/>
            </head>);
    html.head.style = ".main-table { font-size: 26px; font-weight: bold; }\n";
    html.head.style += ".day-name { border: 1px solid black; background-color: #e0e0e0; font-size: 12px; font-weight: bold; }\n";
    html.head.style += ".day-box { border: 1px solid black; vertical-align: top; }\n";
    html.head.style += ".out-of-month { background-color: gray !important; }\n";
    html.head.style += ".day-off { background-color: #D3D3D3 !important; }\n";

    // If aStart or aEnd weren't passed in, we need to calculate them based on
    // aItems data.

    var start = aStart;
    var end = aEnd;
    if (!start || !end) {
        for each (var item in aItems) {
            var itemStart = item.startDate || item.entryDate;
            var itemEnd = item.endDate || item.dueDate;
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
    var weekStart = getPrefSafe("calendar.week.start", 0);
    maybeNewStart = start.clone();
    maybeNewStart.day = 1;
    maybeNewStart.month = start.month+1;
    maybeNewStart.normalize();

    var date = start.clone();

    // First we have to adjust the end date for comparison, as the
    // provided end date is exclusive, i.e. will not be displayed.

    var realEnd = end.clone();
    realEnd.day -= 1;
    realEnd.normalize();

    if (start.compare(realEnd) <= 0) {
        // Only adjust dates if start date is earlier than end date.

        if ((start.month != realEnd.month) || (start.year != realEnd.year)) {
            // We only need to adjust if start and end are in different months.

            // We want to check whether or not the start day is in the same
            // week as the beginning of the next month. To do this, we take
            // the start date, add seven days and subtract the "day of week"
            // value (which has to be corrected in case we do not start on
            // Sunday).
            var testBegin = start.clone();
            var startWeekday = testBegin.weekday;
            if (startWeekday < weekStart) {
                startWeekday += 7;
                startWeekday.normalize();
            }
            testBegin.day += 7 + weekStart - startWeekday;
            testBegin.normalize();
            if (testBegin.compare(maybeNewStart) > 0) {
                start = maybeNewStart;
                date = start.clone();
            }
        }
        if ((start.month != realEnd.month) || (start.year != realEnd.year)) {
            // We only need to adjust if start and end are in different months.

            // Next, we want to check whether or not the end day is in the same
            // week as the end of the previous month. So we have to get the
            // "day of week" value for the end of the previous month, adjust it
            // if necessary (when start of week is not Sunday) and check if the
            // end day is in the same week.

            var lastDayOfPreviousMonth = end.clone();
            lastDayOfPreviousMonth.day = 0;
            lastDayOfPreviousMonth.normalize();
            var lastDayWeekday = lastDayOfPreviousMonth.weekday;
            if (lastDayWeekday < weekStart) {
                lastDayWeekday += 7;
                lastDayWeekday.normalize();
            }
            if (date.month != end.month) {
                date.day = 1;
                date.normalize();
            }
            if ((lastDayWeekday + end.day - 1) < (7 + weekStart)) {
                date.day = end.day;
                date.normalize();
            }

            // Finally, we have to check whether we adjusted the dates too
            // well so that nothing is printed. That happens if you print just
            // one week which has the last day of a month in it.

            if (date.compare(end) >= 0) {
                date.day = 1;
                date.normalize();
            }
        } else {
            date.day = 1;
            date.normalize();
        }
    } else {
         // If start date is after end date, just print empty month.
         date = realEnd.clone();
    }

    var body = <body/>

    while (date.compare(end) < 0) {
        var monthName = calGetString("dateFormat", "month." + (date.month +1)+ ".name");
        monthName += " " + date.year;
        body.appendChild(
                     <table border='0' width='100%' class='main-table'>
                         <tr> 
                             <td align='center' valign='bottom'>{monthName}</td>
                         </tr>
                     </table>);
        body.appendChild(this.getStringForMonth(date, aItems));
        // Make sure each month gets put on its own page
        body.appendChild(<br style="page-break-after:always;"/>);
        date.month++;
        date.normalize();
    }
    html.appendChild(body);

    var convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                               .getService(Components.interfaces.nsIConverterOutputStream);
    convStream.init(aStream, 'UTF-8', 0, 0x0000);
    convStream.writeString(html.toXMLString());
};

calMonthPrinter.prototype.getStringForMonth =
function monthPrint_getHTML(aStart, aItems) {
    var weekStart = getPrefSafe("calendar.week.start", 0);

    var monthTable = <table style='border:1px solid black;' width='100%'/>
    var dayNameRow = <tr/>
    for (var i = 0; i < 7; i++) {
        var dayName = calGetString("dateFormat", "day."+ (((weekStart+i)%7)+1) + ".Mmm");
        dayNameRow.appendChild(<td class='day-name' align='center'>{dayName}</td>);
    }
    monthTable.appendChild(dayNameRow);

    // Set up the item-list so it's easy to work with.
    function hasUsableDate(item) {
        return item.startDate || item.entryDate || item.dueDate;
    }
    var filteredItems = aItems.filter(hasUsableDate);

    var calIEvent = Components.interfaces.calIEvent;
    var calITodo = Components.interfaces.calITodo
    function compareItems(a, b) {
        // Sort tasks before events
        if (a instanceof calIEvent && b instanceof calITodo) {
            return 1;
        }
        if (a instanceof calITodo && b instanceof calIEvent) {
            return -1;
        }
        if (a instanceof calIEvent) {
            var startCompare = a.startDate.compare(b.startDate);
            if (startCompare != 0) {
                return startCompare;
            }
            return a.endDate.compare(b.endDate);
        }
        var aDate = a.entryDate || a.dueDate;
        var bDate = b.entryDate || b.dueDate;
        return aDate.compare(bDate);
    }
    var sortedList = filteredItems.sort(compareItems);
    var firstDate = aStart.startOfMonth.startOfWeek.clone();
    firstDate.day += weekStart;
    firstDate.normalize();
    if (aStart.startOfMonth.weekday < weekStart) {
        // Go back one week to make sure we display this day
        firstDate.day -= 7;
        firstDate.normalize();
    }

    var lastDate = aStart.endOfMonth.endOfWeek.clone();
    if (aStart.endOfMonth.weekday < weekStart) {
        // Go back one week so we don't display any extra days
        lastDate.day -= 7;
        lastDate.normalize();
    }
    firstDate.isDate = true;
    lastDate.isDate = true;

    var date = firstDate.clone();
    var itemListIndex = 0;
    while (date.compare(lastDate) != 1) {
        monthTable.appendChild(this.makeHTMLWeek(date, sortedList, aStart.month));
    }
    return monthTable;
};

calMonthPrinter.prototype.makeHTMLWeek =
function makeHTMLWeek(date, sortedList, targetMonth) {
    var weekRow = <tr/>;
    const weekPrefix = "calendar.week.";
    var prefNames = ["d0sundaysoff", "d1mondaysoff", "d2tuesdaysoff",
                     "d3wednesdaysoff", "d4thursdaysoff", "d5fridaysoff", "d6saturdaysoff"];
    var defaults = [true, false, false, false, false, false, true];
    var daysOff = new Array();
    for (var i in prefNames) {
        if (getPrefSafe(weekPrefix+prefNames[i], defaults[i])) {
            daysOff.push(Number(i));
        }
    }

    for (var i = 0; i < 7; i++) {
        var myClass = 'day-box';
        if (date.month != targetMonth) {
            myClass += ' out-of-month';
        } else if (daysOff.some(function(a) { return a == date.weekday; })) {
            myClass += ' day-off';
        }
        var day = <td align='left' valign='top' class={myClass} height='100' width='100'/>
        var innerTable = <table valign='top' style='font-size: 10px;'/>
        var dateLabel = <tr valign='top'>
                            <td valign='top' align='left'>{date.day}</td>
                        </tr>
        innerTable.appendChild(dateLabel);
        for each (var item in sortedList) {
            var sDate = item.startDate || item.entryDate || item.dueDate;
            var eDate = item.endDate || item.dueDate || item.entryDate;

            // end dates are exclusive
            if (sDate.isDate) {
                eDate = eDate.clone();
                eDate.day -= 1;
                eDate.normalize();
            }
            if (!eDate || eDate.compare(date) == -1) {
                continue;
            }
            itemListIndex = i;
            if (!sDate || sDate.compare(date) == 1) {
                break;
            }
            var dateFormatter = 
                    Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                              .getService(Components.interfaces.calIDateTimeFormatter);


            function getStringForDate(date) {
                var dstring;
                if (!date.isDate) {
                    return dateFormatter.formatTime(sDate);
                }
                return calGetString("dateFormat", "AllDay");
            }

            var time;
            if (sDate) {
                time = getStringForDate(sDate);
            }

            var calMgr = Components.classes["@mozilla.org/calendar/manager;1"]
                                   .getService(Components.interfaces.calICalendarManager);
            var calColor = calMgr.getCalendarPref(item.calendar, 'color');
            if (!calColor) {
                calColor = "#A8C2E1";
            }
            var pb2 = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch2);
            var catColor;
            try {
                catColor = pb2.getCharPref("calendar.category.color."+item.getProperty("CATEGORIES").toLowerCase());
            } catch(ex) {}

            var style = 'font-size: 11px; text-align: left;';
            style += ' background-color: ' + calColor + ';';
            style += ' color: ' + getContrastingTextColor(calColor);
            if (catColor) {
                style += ' border: solid ' + catColor + ' 2px;';
            }
            var item = <tr>
                           <td valign='top' style={style}>{time} {item.title}</td>
                       </tr>;
            innerTable.appendChild(item);
        }
        day.appendChild(innerTable);
        weekRow.appendChild(day);
        date.day++;
        date.normalize();
    }
    return weekRow;
};
