/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * Sets up the timezone dialog from the window arguments, also setting up all
 * dialog controls from the window's dates.
 */
function onLoad() {
    var args = window.arguments[0];
    window.time = args.time;
    window.onAcceptCallback = args.onOk;

    var tzProvider = (args.calendar.getProperty("timezones.provider") ||
                      cal.getTimezoneService());
    window.tzProvider = tzProvider;

    var menulist = document.getElementById("timezone-menulist");
    var tzMenuPopup = document.getElementById("timezone-menupopup");

    // floating and UTC (if supported) at the top:
    if (args.calendar.getProperty("capabilities.timezones.floating.supported") !== false) {
        addMenuItem(tzMenuPopup, floating().displayName, floating().tzid);
    }
    if (args.calendar.getProperty("capabilities.timezones.UTC.supported") !== false) {
        addMenuItem(tzMenuPopup, UTC().displayName, UTC().tzid);
    }

    var enumerator = tzProvider.timezoneIds;
    var tzids = {};
    var displayNames = [];
    while (enumerator.hasMore()) {
        var tz = tzProvider.getTimezone(enumerator.getNext());
        if (tz && !tz.isFloating && !tz.isUTC) {
            var displayName = tz.displayName;
            displayNames.push(displayName);
            tzids[displayName] = tz.tzid;
        }
    }
    // the display names need to be sorted
    displayNames.sort(String.localeCompare);
    for (var i = 0; i < displayNames.length; ++i) {
        var displayName = displayNames[i];
        addMenuItem(tzMenuPopup, displayName, tzids[displayName]);
    }

    var index = findTimezone(window.time.timezone);
    if (index < 0) {
        index = findTimezone(calendarDefaultTimezone());
        if (index < 0) {
            index = 0;
        }
    }

    var menulist = document.getElementById("timezone-menulist");
    menulist.selectedIndex = index;

    updateTimezone();

    opener.setCursor("auto");
}

/**
 * Find the index of the timezone menuitem corresponding to the given timezone.
 *
 * @param timezone      The calITimezone to look for.
 * @return              The index of the childnode below "timezone-menulist"
 */
function findTimezone(timezone) {
    var tzid = timezone.tzid;
    var menulist = document.getElementById("timezone-menulist");
    var numChilds = menulist.childNodes[0].childNodes.length;
    for (var i=0; i<numChilds; i++) {
        var menuitem = menulist.childNodes[0].childNodes[i];
        if (menuitem.getAttribute("value") == tzid) {
            return i;
        }
    }
    return -1;
}

/**
 * Handler function to call when the timezone selection has changed. Updates the
 * timezone-time field and the timezone-stack.
 */
function updateTimezone() {
    let menulist = document.getElementById("timezone-menulist");
    let menuitem = menulist.selectedItem;
    let tz = window.tzProvider.getTimezone(menuitem.getAttribute("value"));

    // convert the date/time to the currently selected timezone
    // and display the result in the appropriate control.
    // before feeding the date/time value into the control we need
    // to set the timezone to 'floating' in order to avoid the
    // automatic conversion back into the OS timezone.
    let datetime = document.getElementById("timezone-time");
    let time = window.time.getInTimezone(tz);
    time.timezone = floating();
    datetime.value = time.jsDate;

    // don't highlight any timezone in the map by default
    let standardTZOffset = "none";
    if (tz.isUTC) {
        standardTZOffset = "+0000";
    } else if (!tz.isFloating) {
        let standard = tz.icalComponent.getFirstSubcomponent("STANDARD");
        // any reason why valueAsIcalString is used instead of plain value? xxx todo: ask mickey
        standardTZOffset = standard.getFirstProperty("TZOFFSETTO").valueAsIcalString;
    }

    let image = document.getElementById("highlighter");
    image.setAttribute("tzid", standardTZOffset);
}
/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    var menulist = document.getElementById("timezone-menulist");
    var menuitem = menulist.selectedItem;
    var timezone = menuitem.getAttribute("value");
    var tz = window.tzProvider.getTimezone(timezone);
    var datetime = window.time.getInTimezone(tz);
    window.onAcceptCallback(datetime);
    return true;
}

/**
 * Handler function to be called when the cancel button is pressed.
 *
 */
function onCancel() {
}
