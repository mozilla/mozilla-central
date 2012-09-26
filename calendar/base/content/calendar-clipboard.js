/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * Test if a writable calendar is selected, and if the clipboard has items that
 * can be pasted into Calendar. The data must be of type "text/calendar" or
 * "text/unicode".
 *
 * @return          If true, pasting is currently possible.
 */
function canPaste() {
    let selectedCal = getSelectedCalendar();
    if (!selectedCal || !cal.isCalendarWritable(selectedCal)) {
        return false;
    }

    const flavors = ["text/calendar", "text/unicode"];
    return Services.clipboard.hasDataMatchingFlavors(flavors,
                                                     flavors.length,
                                                     Components.interfaces.nsIClipboard.kGlobalClipboard);
}

/**
 * Copy the ics data of the current view's selected events to the clipboard and
 * deletes the events on success
 */
function cutToClipboard() {
    if (copyToClipboard()) {
        deleteSelectedItems();
    }
}

/**
 * Copy the ics data of the items in calendarItemArray to the clipboard. Fills
 * both text/unicode and text/calendar mime types.
 *
 * @param calendarItemArray     (optional) an array of items to copy. If not
 *                                passed, the current view's selected items will
 *                                be used.
 * @return                      A boolean indicating if the operation succeeded.
 */
function copyToClipboard(calendarItemArray) {
    if (!calendarItemArray) {
        calendarItemArray = getSelectedItems();
    }

    if (!calendarItemArray.length) {
        cal.LOG("[calendar-clipboard] No items to copy.");
        return false;
    }

    let icsSerializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                  .createInstance(Components.interfaces.calIIcsSerializer);
    icsSerializer.addItems(calendarItemArray, calendarItemArray.length);
    let icsString = icsSerializer.serializeToString();

    let clipboard = Services.clipboard;
    let trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);

    if (trans && clipboard) {
        // Register supported data flavors
        trans.init(null);
        trans.addDataFlavor("text/calendar");
        trans.addDataFlavor("text/unicode");

        // Create the data objects
        let icsWrapper = Components.classes["@mozilla.org/supports-string;1"]
                                   .createInstance(Components.interfaces.nsISupportsString);
        icsWrapper.data = icsString;

        // Add data objects to transferable
        // Both Outlook 2000 client and Lotus Organizer use text/unicode
        // when pasting iCalendar data.
        trans.setTransferData("text/calendar",
                              icsWrapper,
                              icsWrapper.data.length * 2); // double byte data
        trans.setTransferData("text/unicode",
                              icsWrapper,
                              icsWrapper.data.length * 2);

        clipboard.setData(trans,
                          null,
                          Components.interfaces.nsIClipboard.kGlobalClipboard);

        return true;
    }
    return false;
}

/**
 * Reads ics data from the clipboard, parses it into items and inserts the items
 * into the currently selected calendar.
 */
function pasteFromClipboard() {
    if (!canPaste()) {
        return;
    }

    let clipboard = Services.clipboard;
    let trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);

    if (!trans || !clipboard) {
        return;
    }

    // Register the wanted data flavors (highest fidelity first!)
    trans.init(null);
    trans.addDataFlavor("text/calendar");
    trans.addDataFlavor("text/unicode");

    // Get transferable from clipboard
    clipboard.getData(trans, Components.interfaces.nsIClipboard.kGlobalClipboard);

    // Ask transferable for the best flavor.
    let flavor = {};
    let data = {};
    trans.getAnyTransferData(flavor, data, {});
    data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    switch (flavor.value) {
        case "text/calendar":
        case "text/unicode":
            let destCal = getSelectedCalendar();
            if (!destCal) {
                return;
            }

            let icsParser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                                      .createInstance(Components.interfaces.calIIcsParser);
            try {
                icsParser.parseString(data);
            } catch(e) {}

            let items = icsParser.getItems({});
            if (items.length == 0) {
                return;
            }

            // If there are multiple items on the clipboard, the earliest
            // should be set to the selected day and the rest adjusted.
            let earliestDate = null;
            for each (let item in items) {
                let date = null;
                if (item.startDate) {
                    date = item.startDate.clone();
                } else if (item.entryDate) {
                    date = item.entryDate.clone();
                } else if (item.dueDate) {
                    date = item.dueDate.clone();
                }

                if (!date) {
                    continue;
                }

                if (!earliestDate || date.compare(earliestDate) < 0) {
                    earliestDate = date;
                }
            }
            let firstDate = currentView().selectedDay;

            let offset = null;
            if (earliestDate) {
                // Timezones and DT/DST time may differ between the earliest item
                // and the selected day. Determine the offset between the
                // earliestDate in local time and the selected day in whole days.
                earliestDate = earliestDate.getInTimezone(calendarDefaultTimezone());
                earliestDate.isDate = true;
                offset = firstDate.subtractDate(earliestDate);
                let deltaDST = firstDate.timezoneOffset - earliestDate.timezoneOffset;
                offset.inSeconds += deltaDST;
            }

            startBatchTransaction();
            for each (let item in items) {
                let newItem = item.clone();
                // Set new UID to allow multiple paste actions of the same
                // clipboard content.
                newItem.id = cal.getUUID();
                if (offset) {
                    cal.shiftItem(newItem, offset);
                }
                doTransaction('add', newItem, destCal, null, null);
            }
            endBatchTransaction();
            break;
        default:
            break;
    }
}
