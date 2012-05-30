/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Shows the filepicker and creates a new calendar with a local file using the ICS
 * provider.
 */
function openLocalCalendar() {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, calGetString("calendar", "Open"), nsIFilePicker.modeOpen);
    let wildmat = "*.ics";
    let description = calGetString("calendar", "filterIcs", [wildmat]);
    fp.appendFilter(description, wildmat);
    fp.appendFilters(nsIFilePicker.filterAll);

    if (fp.show() != nsIFilePicker.returnOK) {
        return;
    }

    let calMgr = getCalendarManager();
    let calendars = calMgr.getCalendars({});
    if (calendars.some(function(x) x.uri == fp.fileURL)) {
        // The calendar already exists, select it and return.
        document.getElementById("calendar-list-tree-widget")
                .tree.view.selection.select(index);
        return;
    }

    let openCalendar = calMgr.createCalendar("ics", fp.fileURL);

    // Strip ".ics" from filename for use as calendar name, taken from
    // calendarCreation.js
    let fullPathRegex = new RegExp("([^/:]+)[.]ics$");
    let prettyName = fp.fileURL.spec.match(fullPathRegex);
    let name;

    if (prettyName && prettyName.length >= 1) {
        name = decodeURIComponent(prettyName[1]);
    } else {
        name = calGetString("calendar", "untitledCalendarName");
    }
    openCalendar.name = name;

    calMgr.registerCalendar(openCalendar);
}
