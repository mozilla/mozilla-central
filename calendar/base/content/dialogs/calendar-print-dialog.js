/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * Gets the calendar view from the opening window
 */
function getCalendarView() {
    let theView = window.opener.currentView();
    if (!theView.startDay) {
        theView = null;
    }
    return theView;
}

/**
 * Loads the print dialog, setting up all needed elements.
 */
function loadCalendarPrintDialog() {
    // set the datepickers to the currently selected dates
    let theView = getCalendarView();
    if (theView) {
        document.getElementById("start-date-picker").value = theView.startDay.jsDate;
        document.getElementById("end-date-picker").value = theView.endDay.jsDate;
    } else {
        document.getElementById("printCurrentViewRadio").setAttribute("disabled", true);
    }
    if (!theView || !theView.getSelectedItems({}).length) {
        document.getElementById("selected").setAttribute("disabled", true);
    }
    document.getElementById(theView ? "printCurrentViewRadio" : "custom-range")
            .setAttribute("selected", true);

    // Get a list of formatters
    let catman = Components.classes["@mozilla.org/categorymanager;1"]
                           .getService(Components.interfaces.nsICategoryManager);
    let catenum = catman.enumerateCategory("cal-print-formatters");

    // Walk the list, adding items to the layout menupopup
    let layoutList = document.getElementById("layout-field");
    while (catenum.hasMoreElements()) {
        let entry = catenum.getNext();
        entry = entry.QueryInterface(Components.interfaces.nsISupportsCString);
        let contractid = catman.getCategoryEntry("cal-print-formatters", entry);
        let formatter = Components.classes[contractid]
                                  .getService(Components.interfaces.calIPrintFormatter);
        // Use the contractid as value
        layoutList.appendItem(formatter.name, contractid);
    }
    layoutList.selectedIndex = 0;

    opener.setCursor("auto");

    refreshHtml();

    self.focus();
}

/**
 * Retrieves a settings object containing info on what to print. The
 * receiverFunc will be called with the settings object containing various print
 * settings.
 *
 * @param receiverFunc  The callback function to call on completion.
 */
function getPrintSettings(receiverFunc) {
    let tempTitle = document.getElementById("title-field").value;
    let settings = new Object();
    let requiresFetch = true;
    settings.title = (tempTitle || calGetString("calendar", "Untitled"));
    settings.layoutCId = document.getElementById("layout-field").value;
    settings.start = null;
    settings.end = null;
    settings.eventList = [];
    settings.printEvents = document.getElementById("events").checked;
    settings.printTasks = document.getElementById("tasks").checked;
    settings.printCompletedTasks = document.getElementById("completed-tasks").checked;
    settings.printTasksWithNoDueDate = document.getElementById("tasks-with-no-due-date").checked;
    var theView = getCalendarView();
    switch (document.getElementById("view-field").selectedItem.value) {
    case 'currentView':
    case '': //just in case
        settings.start = theView.startDay.clone();
        settings.end = theView.endDay.clone();
        settings.end.day += 1;
        settings.start.isDate = false;
        settings.end.isDate = false;
        break;
    case 'selected': {
        let selectedItems = theView.getSelectedItems({});
        settings.eventList = selectedItems.filter(function(item) {
            if (cal.isEvent(item) && !settings.printEvents) return false;
            if (cal.isToDo(item) && !settings.printTasks) return false;
            return true;
        });

        // If tasks should be printed, also include selected tasks from the
        // opening window.
        if (settings.printTasks) {
            let selectedTasks = window.opener.getSelectedTasks();
            for each (var task in selectedTasks) {
                settings.eventList.push(task);
            }
        }

        // We've set the event list above, no need to fetch items below.
        requiresFetch = false;
        break;
    }
    case 'custom':
        // We return the time from the timepickers using the selected
        // timezone, as not doing so in timezones with a positive offset
        // from UTC may cause the printout to include the wrong days.
        var currentTimezone = calendarDefaultTimezone();
        settings.start = jsDateToDateTime(document.getElementById("start-date-picker").value);
        settings.start = settings.start.getInTimezone(currentTimezone);
        settings.end = jsDateToDateTime(document.getElementById("end-date-picker").value);
        settings.end = settings.end.getInTimezone(currentTimezone);
        settings.end = settings.end.clone();
        settings.end.day += 1;
        break ;
    default:
        dump("Error : no case in printDialog.js::printCalendar()");
    }

    // Some filters above might have filled the events list themselves. If not,
    // then fetch the items here.
    if (requiresFetch) {
        let listener = {
            onOperationComplete:
            function onOperationComplete(aCalendar, aStatus, aOperationType, aId, aDateTime) {
                receiverFunc(settings);
            },
            onGetResult:
            function onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                settings.eventList = settings.eventList.concat(aItems);
                if (!settings.printTasksWithNoDueDate) {
                    eventWithDueDate = [];
                    for each (var item in settings.eventList) {
                        if (item.dueDate || item.endDate) {
                            eventWithDueDate.push(item)
                        }
                    }
                    settings.eventList = eventWithDueDate;
                }
            }
        };
        let filter = getFilter(settings);
        if (filter) {
            window.opener.getCompositeCalendar().getItems(filter, 0, settings.start, settings.end, listener);
        } else {
            // No filter means no items, just complete with the empty list set above
            receiverFunc(settings);
        }
    } else {
        receiverFunc(settings);
    }
}

/**
 * Sets up the filter for a getItems call based on the javascript settings
 * object
 *
 * @param settings      The settings data to base upon
 */
function getFilter(settings) {
    let filter = 0;
    if (settings.printTasks) {
        filter |= Components.interfaces.calICalendar.ITEM_FILTER_TYPE_TODO;
        if (settings.printCompletedTasks) {
            filter |= Components.interfaces.calICalendar.ITEM_FILTER_COMPLETED_ALL;
        } else {
            filter |= Components.interfaces.calICalendar.ITEM_FILTER_COMPLETED_NO;
        }
    }

    if (settings.printEvents) {
        filter |= Components.interfaces.calICalendar.ITEM_FILTER_TYPE_EVENT |
                  Components.interfaces.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES;
    }
    return filter;
}

/**
 * Looks at the selections the user has made (start date, layout, etc.), and
 * updates the HTML in the iframe accordingly. This is also called when a
 * dialog UI element has changed, since we'll want to refresh the preview.
 */
function refreshHtml(finishFunc) {
    getPrintSettings(function getSettingsResponse(settings) {
            document.title = calGetString("calendar", "PrintPreviewWindowTitle", [settings.title]);

            let printformatter = Components.classes[settings.layoutCId]
                                           .createInstance(Components.interfaces.calIPrintFormatter);
            let html = "";
            try {
                let pipe = Components.classes["@mozilla.org/pipe;1"]
                                     .createInstance(Components.interfaces.nsIPipe);
                const PR_UINT32_MAX = 4294967295; // signals "infinite-length"
                pipe.init(true, true, 0, PR_UINT32_MAX, null);
                printformatter.formatToHtml(pipe.outputStream,
                                            settings.start,
                                            settings.end,
                                            settings.eventList.length,
                                            settings.eventList,
                                            settings.title);
                pipe.outputStream.close();
                // convert byte-array to UTF-8 string:
                let convStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                                           .createInstance(Components.interfaces.nsIConverterInputStream);
                convStream.init(pipe.inputStream, "UTF-8", 0,
                                Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
                try {
                    let portion = {};
                    while (convStream.readString(-1, portion)) {
                        html += portion.value;
                    }
                } finally {
                    convStream.close();
                }
            } catch (e) {
                Components.utils.reportError("Calendar print dialog:refreshHtml: " + e);
            }

            let iframeDoc = document.getElementById("content").contentDocument;
            iframeDoc.documentElement.innerHTML = html;
            iframeDoc.title = settings.title;

            if (finishFunc) {
                finishFunc();
            }
        }
    );
}

/**
 * This is a nsIWebProgressListener that closes the dialog on completion, makes
 * sure printing works without issues
 */
var closeOnComplete = {
    onStateChange: function onStateChange(aProgress, aRequest, aStateFlags, aStatus) {

        if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
            // The request is complete, close the window.
            document.documentElement.cancelDialog();
        }
    },

    onProgressChange: function() {},
    onLocationChange: function() {},
    onStatusChange: function() {},
    onSecurityChange: function() {}
};

/**
 * Prints the document and then closes the window
 */
function printAndClose() {
    refreshHtml(
        function finish() {
            var webBrowserPrint = PrintUtils.getWebBrowserPrint();
            var printSettings = PrintUtils.getPrintSettings();

            // Evicts "about:blank" header
            printSettings.docURL = " ";

            // Start the printing, this is just what PrintUtils does, but we
            // apply our own settings.
            try {
                webBrowserPrint.print(printSettings, closeOnComplete);
                if (gPrintSettingsAreGlobal && gSavePrintSettings) {
                    var PSSVC = Components.classes["@mozilla.org/gfx/printsettings-service;1"]
                                          .getService(Components.interfaces.nsIPrintSettingsService);
                    PSSVC.savePrintSettingsToPrefs(printSettings, true,
                                                        printSettings.kInitSaveAll);
                    PSSVC.savePrintSettingsToPrefs(printSettings, false,
                                                   printSettings.kInitSavePrinterName);
                }
            } catch (e if e.result == Components.results.NS_ERROR_ABORT) {
                // Pressing cancel is expressed as an NS_ERROR_ABORT return value,
                // causing an exception to be thrown which we catch here.
            }
        });
    return false; // leave open
}

/**
 * Called when once a date has been selected in the datepicker.
 */
function onDatePick() {
    calRadioGroupSelectItem("view-field", "custom-range");
    setTimeout(refreshHtml, 0);
}
