/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calXMLUtils.jsm");
Components.utils.import("resource://calendar/modules/calPrintUtils.jsm");

/**
 * Prints a two column view of a week of events, much like a paper day-planner
 */
function calWeekPrinter() {
}

calWeekPrinter.prototype = {
    classID: Components.ID("{2d6ec97b-9109-4b92-89c5-d4b4806619ce}"),
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIPrintFormatter]),

    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{2d6ec97b-9109-4b92-89c5-d4b4806619ce}"),
        contractID: "@mozilla.org/calendar/printformatter;1?type=weekplan",
        classDescription: "Calendar Week Print Formatter",
        interfaces: [Components.interfaces.calIPrintFormatter]
    }),

    get name() cal.calGetString("calendar", "weekPrinterName"),

    formatToHtml: function weekPrint_format(aStream, aStart, aEnd, aCount, aItems, aTitle) {
        let dateFormatter = cal.getDateFormatter();
        let document = cal.xml.parseFile("chrome://calendar/skin/printing/calWeekPrinter.html");

        // Set page title
        document.getElementById("title").textContent = aTitle;

        // Table that maps YYYY-MM-DD to the DOM node container where items are to be added
        let dayTable = {};

        // Make sure to create tables from start to end, if passed
        if (aStart && aEnd) {
            let startDate = aStart.clone();
            startDate.isDate = true;

            for (let current = cal.userWeekStart(startDate); current.compare(aEnd) < 0; current.day += 7) {
                this.setupWeek(document, current, dayTable);
            }
        }

        for each (let item in aItems) {
            let boxDate = item[cal.calGetStartDateProp(item)] || item[cal.calGetEndDateProp(item)];

            // Ignore items outside of the range, i.e tasks without start date
            // where the end date is somewhere else.
            if (aStart && aEnd && boxDate &&
                (boxDate.compare(aStart) < 0 || boxDate.compare(aEnd) >= 0)) {
                continue;
            }

            if (boxDate) {
                let boxDateKey = cal.print.getDateKey(boxDate);

                if (!(boxDateKey in dayTable)) {
                    // Doesn't exist, we need to create a new table for it
                    let startOfWeek = boxDate.startOfWeek;
                    this.setupWeek(document, startOfWeek, dayTable);
                }

                cal.print.addItemToDaybox(document, item, dayTable[boxDateKey]);
            } else {
                cal.print.addItemToDayboxNodate(document, item);
            }
        }

        // Remove templates from HTML, no longer needed
        let templates = document.getElementById("templates");
        templates.parentNode.removeChild(templates);

        // Stream out the resulting HTML
        let html = cal.xml.serializeDOM(document);
        let convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIConverterOutputStream);
        convStream.init(aStream, 'UTF-8', 0, 0x0000);
        convStream.writeString(html);
    },

    setupWeek: function setupWeek(document, startOfWeek, dayTable) {
        const weekdayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

        let weekTemplate = document.getElementById("week-template");
        let weekContainer = document.getElementById("week-container");
        let defaultTimezone = cal.calendarDefaultTimezone();

        // Clone the template week and make sure it doesn't have an id
        let currentPage = weekTemplate.cloneNode(true);
        let startOfWeekKey = cal.print.getDateKey(startOfWeek);
        currentPage.removeAttribute("id");
        currentPage.item = startOfWeek.clone();

        // Set up the week number title
        let weekInfo = cal.getWeekInfoService();
        let dateFormatter = cal.getDateFormatter();
        let weekno = weekInfo.getWeekTitle(startOfWeek);
        let weekTitle = cal.calGetString("calendar", 'WeekTitle', [weekno]);
        currentPage.querySelector(".week-number").textContent = weekTitle;


        // Set up the day boxes
        let endOfWeek = cal.userWeekEnd(startOfWeek);
        for (let currentDate = startOfWeek; currentDate.compare(endOfWeek) <= 0; currentDate.day++) {
            let weekday = currentDate.weekday;
            let weekdayName = weekdayMap[weekday];
            let dayOffPrefName = "calendar.week.d" +  weekday + weekdayName + "soff";
            dayTable[cal.print.getDateKey(currentDate)] = currentPage.querySelector("." + weekdayName + "-container");

            let titleNode = currentPage.querySelector("." + weekdayName + "-title");
            titleNode.textContent = dateFormatter.formatDateLong(currentDate.getInTimezone(defaultTimezone));

            if (cal.getPrefSafe(dayOffPrefName, false)) {
                let daysOffNode = currentPage.querySelector("." + weekdayName + "-box");
                daysOffNode.className += " day-off";
            }
        }

        // Now insert the week into the week container, sorting by date (and therefore week number)
        function compareDates(a, b) {
            if (!a || !b) return -1;
            let res = a.compare(b);
            return res;
        }

        cal.binaryInsertNode(weekContainer, currentPage, currentPage.item, compareDates);
    }
};
