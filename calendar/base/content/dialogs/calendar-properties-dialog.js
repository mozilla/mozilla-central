/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

/**
 * The calendar to modify, is retrieved from window.arguments[0].calendar
 */
let gCalendar;

/**
 * This function gets called when the calendar properties dialog gets opened. To
 * open the window, use an object as argument. The object needs a 'calendar'
 * attribute that passes the calendar in question.
 */
function onLoad() {
    gCalendar = window.arguments[0].calendar;

    document.getElementById("calendar-name").value = gCalendar.name;
    let calColor = gCalendar.getProperty('color');
    if (calColor) {
       document.getElementById("calendar-color").color = calColor;
    }
    document.getElementById("calendar-uri").value = gCalendar.uri.spec;
    document.getElementById("read-only").checked = gCalendar.readOnly;

    // Set up refresh interval
    initRefreshInterval();

    // Set up the cache field
    let cacheBox = document.getElementById("cache");
    let canCache = (gCalendar.getProperty("cache.supported") !== false);
    let alwaysCache = (gCalendar.getProperty("cache.always"))
    if (!canCache || alwaysCache) {
        cacheBox.setAttribute("disable-capability", "true");
        cacheBox.hidden = true;
        cacheBox.disabled = true;
    }
    cacheBox.checked = (alwaysCache || (canCache && gCalendar.getProperty("cache.enabled")));

    // Set up the show alarms row and checkbox
    let suppressAlarmsRow = document.getElementById("calendar-suppressAlarms-row");
    let suppressAlarms = gCalendar.getProperty('suppressAlarms');
    document.getElementById("fire-alarms").checked = !suppressAlarms;

    suppressAlarmsRow.hidden =
        (gCalendar.getProperty("capabilities.alarms.popup.supported") === false);

    // Set up the disabled checkbox
    let calendarDisabled = false;
    if (gCalendar.getProperty("force-disabled")) {
        showElement("force-disabled-description");
        disableElement("calendar-enabled-checkbox");
    } else {
        calendarDisabled = gCalendar.getProperty("disabled");
        document.getElementById("calendar-enabled-checkbox").checked = !calendarDisabled;
        hideElement(document.documentElement.getButton("extra1"));
    }
    setupEnabledCheckbox();

    // start focus on title, unless we are disabled
    if (!calendarDisabled) {
        document.getElementById("calendar-name").focus();
    }

    sizeToContent();
}

/**
 * Called when the dialog is accepted, to save settings.
 *
 * @return      Returns true if the dialog should be closed.
 */
function onAcceptDialog() {
    // Save calendar name
    gCalendar.name = document.getElementById("calendar-name").value;

    // Save calendar color
    gCalendar.setProperty("color", document.getElementById("calendar-color").color);

    // Save readonly state
    gCalendar.readOnly = document.getElementById("read-only").checked;

    // Save supressAlarms
    gCalendar.setProperty("suppressAlarms", !document.getElementById("fire-alarms").checked);

    // Save refresh interval
    if (gCalendar.canRefresh) {
        let value = getElementValue("calendar-refreshInterval-menulist");
        gCalendar.setProperty("refreshInterval", value);
    }

    // Save cache options
    let alwaysCache = (gCalendar.getProperty("cache.always"))
    if (!alwaysCache) {
        gCalendar.setProperty("cache.enabled", document.getElementById("cache").checked);
    }

    if (!gCalendar.getProperty("force-disabled")) {
        // Save disabled option (should do this last), remove auto-enabled
        gCalendar.setProperty("disabled", !document.getElementById("calendar-enabled-checkbox").checked);
        gCalendar.deleteProperty("auto-enabled");
    }

    // tell standard dialog stuff to close the dialog
    return true;
}

/**
 * When the calendar is disabled, we need to disable a number of other elements
 */
function setupEnabledCheckbox() {
    let isEnabled = document.getElementById("calendar-enabled-checkbox").checked;
    let els = document.getElementsByAttribute("disable-with-calendar", "true");
    for (let i = 0; i < els.length; i++) {
        els[i].disabled = !isEnabled || (els[i].getAttribute("disable-capability") == "true");
    }
}

/**
 * Called to unsubscribe from a calendar. The button for this function is not
 * shown unless the provider for the calendar is missing (i.e force-disabled)
 */
function unsubscribeCalendar() {
    let calmgr =  cal.getCalendarManager();

    calmgr.unregisterCalendar(gCalendar);
    window.close();
}

function initRefreshInterval() {
    setBooleanAttribute("calendar-refreshInterval-row", "hidden", !gCalendar.canRefresh);

    if (gCalendar.canRefresh) {
        function createMenuItem(minutes) {
            let menuitem = createXULElement("menuitem");
            menuitem.setAttribute("value", minutes);

            let everyMinuteString = cal.calGetString("calendar", "calendarPropertiesEveryMinute");
            let label = PluralForm.get(minutes, everyMinuteString).replace("#1", minutes);
            menuitem.setAttribute("label", label);

            return menuitem;
        }

        let refreshInterval = gCalendar.getProperty("refreshInterval");
        if (refreshInterval === null) refreshInterval = 30;

        let foundValue = false;
        let separator = document.getElementById("calendar-refreshInterval-manual-separator");
        let menulist = document.getElementById("calendar-refreshInterval-menulist");
        for each (let min in [1, 5, 15, 30, 60]) {
            let menuitem = createMenuItem(min);

            separator.parentNode.insertBefore(menuitem, separator);
            if (refreshInterval == min) {
                menulist.selectedItem = menuitem;
                foundValue = true;
            }
        }

        if (refreshInterval == 0) {
            setBooleanAttribute("calendar-refreshInterval-manual", "checked", true);
            foundValue = true;
        }

        if (!foundValue) {
          // Special menuitem in case the user changed the value in the config editor.
          let menuitem = createMenuItem(refreshInterval);
          separator.parentNode.insertBefore(menuitem, separator.nextSibling);
          menulist.selectedItem = menuitem;
        }
    }
}
