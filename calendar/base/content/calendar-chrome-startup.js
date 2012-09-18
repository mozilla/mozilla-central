/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Common initialization steps for calendar chrome windows.
 */
function commonInitCalendar() {
    // Move around toolbarbuttons and whatever is needed in the UI.
    migrateCalendarUI();

    // Load the Calendar Manager
    loadCalendarManager();

    // Restore the last shown calendar view
    switchCalendarView(getLastCalendarView(), false);

    // set up the unifinder
    prepareCalendarToDoUnifinder();

    // Make sure we update ourselves if the program stays open over midnight
    scheduleMidnightUpdate(refreshUIBits);

    // Set up the command controller from calendar-common-sets.js
    injectCalendarCommandController();

    // Set up item and day selection listeners
    getViewDeck().addEventListener("dayselect", observeViewDaySelect, false);
    getViewDeck().addEventListener("itemselect", calendarController.onSelectionChanged, true);

    // Start alarm service
    Components.classes["@mozilla.org/calendar/alarm-service;1"]
              .getService(Components.interfaces.calIAlarmService)
              .startup();
    document.getElementById("calsidebar_splitter").addEventListener("command", onCalendarViewResize, false);
    window.addEventListener("resize", onCalendarViewResize, true);

    // Set up the category colors
    categoryManagement.initCategories();

    // Set up window pref observers
    calendarWindowPrefs.init();

    /* Ensure the new items commands state can be setup properly even when no
     * calendar support refreshes (i.e. the "onLoad" notification) or when none
     * are active. In specific cases such as for file-based ICS calendars can
     * happen, the initial "onLoad" will already have been triggered at this
     * point (see bug 714431 comment 29). We thus inconditionnally invoke
     * calendarUpdateNewItemsCommand until somebody writes code that enables the
     * checking of the calendar readiness (getProperty("ready") ?).
     */
    calendarUpdateNewItemsCommand();
}

/**
 * Common unload steps for calendar chrome windows.
 */
function commonFinishCalendar() {
    // Unload the calendar manager
    unloadCalendarManager();

    // clean up the unifinder
    finishCalendarToDoUnifinder();

    // Remove the command controller
    removeCalendarCommandController();

    document.getElementById("calsidebar_splitter").removeEventListener("command", onCalendarViewResize, false);
    window.removeEventListener("resize", onCalendarViewResize, true);

    // Clean up the category colors
    categoryManagement.cleanupCategories();

    // Clean up window pref observers
    calendarWindowPrefs.cleanup();
}

/**
 * Handler function to create |viewtype + "viewresized"| events that are
 * dispatched through the calendarviewBroadcaster.
 *
 * XXX this has nothing to do with startup, needs to go somewhere else.
 */
function onCalendarViewResize(aEvent) {
    let event = document.createEvent('Events');
    event.initEvent(currentView().type + "viewresized", true, false);
    document.getElementById("calendarviewBroadcaster").dispatchEvent(event);
}

/**
 * TODO: The systemcolors pref observer really only needs to be set up once, so
 * ideally this code should go into a component. This should be taken care of when
 * there are more prefs that need to be observed on a global basis that don't fit
 * into the calendar manager.
 */
var calendarWindowPrefs = {

    /** nsISupports QueryInterface */
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),

    /** Initialize the preference observers */
    init: function() {
        Services.prefs.addObserver("calendar.view.useSystemColors", this, false);
        Services.ww.registerNotification(this);

        // Trigger setting pref on all open windows
        this.observe(null, "nsPref:changed", "calendar.view.useSystemColors");
    },

    /**  Cleanup the preference observers */
    cleanup: function() {
        Services.prefs.removeObserver("calendar.view.useSystemColors", this);
        Services.ww.unregisterNotification(this);
    },

    /**
     * Observer function called when a pref has changed
     *
     * @see nsIObserver
     */
    observe: function (aSubject, aTopic, aData) {
        if (aTopic == "nsPref:changed") {
            switch (aData) {
                case "calendar.view.useSystemColors": {
                    let attributeValue = cal.getPrefSafe("calendar.view.useSystemColors", false) && "true";
                    for each (let win in fixIterator(Services.ww.getWindowEnumerator())) {
                        setElementValue(win.document.documentElement, attributeValue , "systemcolors");
                    }
                    break;
                }
            }
        } else if (aTopic == "domwindowopened") {
            let win = aSubject.QueryInterface(Components.interfaces.nsIDOMWindow);
            win.addEventListener("load", function() {
                let attributeValue = cal.getPrefSafe("calendar.view.useSystemColors", false) && "true";
                setElementValue(win.document.documentElement, attributeValue , "systemcolors");
            }, false);
        }
    }
}

/**
 * Migrate calendar UI. This function is called at each startup and can be used
 * to change UI items that require js code intervention
 */
function migrateCalendarUI() {
    const UI_VERSION = 1;
    let currentUIVersion = cal.getPrefSafe("calendar.ui.version");

    if (currentUIVersion >= UI_VERSION) {
        return;
    }

    try {
        if (currentUIVersion < 1) {
            let calbar = document.getElementById("calendar-toolbar2");
            calbar.insertItem("calendar-appmenu-button");
            let taskbar = document.getElementById("task-toolbar2");
            taskbar.insertItem("task-appmenu-button");
        }

        cal.setPref("calendar.ui.version", UI_VERSION);
    } catch (e) {
        cal.ERROR("Error upgrading UI from " + currentUIVersion + " to " +
                  UI_VERSION + ": " + e);
    }
}
