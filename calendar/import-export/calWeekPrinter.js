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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matthew Willis <lilmatt@mozilla.com>
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

/**
 * Prints a two column view of a week of events, much like a paper day-planner
 */
Components.utils.import("resource://calendar/modules/calPrintUtils.jsm");

function calWeekPrinter() {
}

calWeekPrinter.prototype = {
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

    contractID: "@mozilla.org/calendar/printformatter;1?type=weekplan",
    classDescription: "Calendar Week Print Formatter",
    classID: Components.ID("{2d6ec97b-9109-4b92-89c5-d4b4806619ce}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calWeekPrinter.prototype, aIID, null, this);
    },

    get name() {
        return cal.calGetString("calendar", "weekPrinterName");
    },

    formatToHtml: function weekPrint_format(aStream, aStart, aEnd, aCount, aItems, aTitle) {
        // Create the e4x framework of the HTML document
        let html = <html/>;
        html.appendChild(
                <head>
                    <title>{aTitle}</title>
                    <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
                    <link rel='stylesheet' type='text/css' href='chrome://calendar/skin/calendar-printing.css'/>
                </head>);

        let body = <body/>;

        // helper: returns the passed item's startDate, entryDate or dueDate, in
        //         that order. If the item doesn't have one of those dates, this
        //         doesn't return.
        function hasUsableDate(item) item.startDate || item.entryDate || item.dueDate;

        // Clean out the item list so it only contains items we will want to
        // include in the printout.
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
            let dateA = a.entryDate || a.dueDate;
            let dateB = b.entryDate || b.dueDate;
            return dateA.compare(dateB);
        }
        let sortedList = filteredItems.sort(compareItems);

        let weekInfo = cal.getWeekInfoService();

        // Start at the beginning of the week that aStart is in, and loop until
        // we're at aEnd. In the loop we build the HTML table for each day, and
        // get the day's items using getDayTd().
        let start = aStart || sortedList[0].startDate || sortedList[0].entryDate ||
                    sortList[0].dueDate;
        cal.ASSERT(start, "can't find a good starting date to print");

        let lastItem = sortedList[sortedList.length-1];
        let end = aEnd || lastItem.startDate || lastItem.entryDate ||
                   lastItem.dueDate;
        cal.ASSERT(end, "can't find a good ending date to print");

        let dt = start.startOfWeek;
        let startOfWeek = cal.getPrefSafe("calendar.week.start", 0);
        dt.day += startOfWeek;
        // Make sure we didn't go too far ahead
        if (dt.compare(start) == 1) {
            dt.day -= 7;
        }

        while (dt.compare(end) == -1) {
            let weekno = weekInfo.getWeekTitle(dt);
            let weekTitle = cal.calGetString("calendar", 'WeekTitle', [weekno]);
            body.appendChild(
                         <table border='0' width='100%' class='main-table'>
                             <tr>
                                 <td align='center' valign='bottom'>{weekTitle}</td>
                             </tr>
                         </table>);
            let mainWeek = <table width='100%' height="90%" border='solid 1px;'/>

            // Create the <td> for each day, and put it into an array.
            let dayTds = [];
            for (let i = 0; i < 7 ; i++) {
                dayTds[dt.weekday] = this.getDayTd(dt, sortedList);
                dt.day += 1;
            }

            let monRow = <tr height="33%"/>;
            monRow.appendChild(dayTds[1]); // Monday
            monRow.appendChild(dayTds[4]); // Thursday
            mainWeek.appendChild(monRow);

            let tueRow = <tr height="33%"/>;
            tueRow.appendChild(dayTds[2]); // Tuesday
            tueRow.appendChild(dayTds[5]); // Friday
            mainWeek.appendChild(tueRow);

            let wedRow = <tr height="33%"/>;
            wedRow.appendChild(dayTds[3]); // Wednesday

            // Saturday and Sunday are half-size
            let satSunTd = <td height="33%"/>;
            let weekendTable = <table border="1" width="100%" height="100%"/>;

            let satRow = <tr valign='top'/>;
            satRow.appendChild(dayTds[6]); // Saturday
            weekendTable.appendChild(satRow);

            let sunRow = <tr valign='top'/>;
            sunRow.appendChild(dayTds[0]); // Sunday
            weekendTable.appendChild(sunRow);

            satSunTd.appendChild(weekendTable);
            wedRow.appendChild(satSunTd);
            mainWeek.appendChild(wedRow);

            body.appendChild(mainWeek);
            // Make sure each month gets put on its own page
            body.appendChild(<br style="page-break-after: always;"/>);
        }
        let tasks = cal.print.getTasksWithoutDueDate(aItems, dt);
        body.appendChild(tasks);
        html.appendChild(body);

        // Stream out the resulting HTML
        let convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIConverterOutputStream);
        convStream.init(aStream, 'UTF-8', 0, 0x0000);
        convStream.writeString(html.toXMLString());
    },

    /**
     * Given a calIDateTime and an array of items, this function creates an HTML
     * table containing the items, using the appropriate formatting and colours.
     */
    getDayTd: function weekPrint_getDayTable(aDate, aItems) {
        // mainTd is the <td> element from the parent HTML table that will hold
        // the child HTML tables containing the date string and this day's items.
        let mainTd = <td border='1px solid black;' width="50%" valign='top'/>
        let dateFormatter = cal.getDateFormatter();
        let defaultTimezone = cal.calendarDefaultTimezone();
        let dateString = dateFormatter.formatDateLong(aDate.getInTimezone(defaultTimezone));

        // Add the formatted date string (in its own child HTML table)
        mainTd.appendChild(
                         <table class='day-name' width='100%' style='background-color:white; border: 1px solid black;'>
                           <tr>
                             <td align='center' valign='bottom'>{dateString}</td>
                           </tr>
                         </table>);

        // Add the formatted items (in their child HTML table)
        let innerTable = <table valign='top' style='font-size: 10px;'/>;
        for each (let item in aItems) {
            let sDate = item.startDate || item.entryDate || item.dueDate;
            let eDate = item.endDate || item.dueDate || item.entryDate;
            if (sDate) {
                sDate = sDate.getInTimezone(defaultTimezone);
            }
            if (eDate) {
                eDate = eDate.getInTimezone(defaultTimezone);
            }

            // End dates are exclusive. Adjust the eDate accordingly.
            if (sDate && sDate.isDate && eDate) {
                eDate = eDate.clone();
                eDate.day -= 1;
            }

            // If the item has no end date, or if the item's end date is aDate or
            // is before aDate, skip to the next item.
            if (!eDate || (eDate.compare(aDate) < 0)) {
                continue;
            }

            // No start date or a start date that's after the date we want is bad.
            if (!sDate || (sDate.compare(aDate) > 0)) {
                break;
            }

            let time = "";
            if (sDate && eDate && !sDate.isDate) {
                time = dateFormatter.formatTime(sDate) + '-' + dateFormatter.formatTime(eDate);
            } else if (sDate && !sDate.isDate) {
                time = dateFormatter.formatTime(sDate);
            } else if (eDate && !eDate.isDate) {
                time = dateFormatter.formatTime(eDate);
            }

            // Get calendar and category colours and apply them to the item's
            // table cell.
            let calColor = item.calendar.getProperty('color') || "#A8C2E1";
            let pb2 = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch2);
            let catColor;
            for each (let cat in item.getCategories({})) {
                try {
                    catColor = pb2.getCharPref("calendar.category.color." + cal.formatStringForCSSRule(cat));
                    break; // take first matching
                } catch (ex) {}
            }

            let style = 'font-size: 11px; background-color: ' + calColor + ';';
            style += ' color: ' + cal.getContrastingTextColor(calColor) + ';';
            if (catColor) {
                style += ' border: solid ' + catColor + ' 2px;';
            }
            let tableRow = <tr><td valign='top' align='left' style={style}>{time} {item.title}</td></tr>;
            innerTable.appendChild(tableRow);
        }
        innerTable.appendChild(<p> </p>);
        mainTd.appendChild(innerTable);
        return mainTd;
    }
};
