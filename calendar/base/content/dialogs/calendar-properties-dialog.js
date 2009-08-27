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
 * The Original Code is Calendar Code.
 *
 * The Initial Developer of the Original Code is
 *   Michiel van Leeuwen <mvl@exedo.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * The calendar to modify, is retrieved from window.arguments[0].calendar
 */
var gCalendar;

/**
 * This function gets called when the calendar properties dialog gets opened. To
 * open the window, use an object as argument. The object needs a 'calendar'
 * attribute that passes the calendar in question.
 */
function onLoad() {
    gCalendar = window.arguments[0].calendar;

    document.getElementById("calendar-name").value = gCalendar.name;
    var calColor = gCalendar.getProperty('color');
    if (calColor) {
       document.getElementById("calendar-color").color = calColor;
    }
    document.getElementById("calendar-uri").value = gCalendar.uri.spec;
    document.getElementById("read-only").checked = gCalendar.readOnly;


    // set up the cache field
    var cacheBox = document.getElementById("cache");
    var canCache = (gCalendar.getProperty("cache.supported") !== false);
    if (!canCache) {
        cacheBox.setAttribute("disable-capability", "true");
        cacheBox.disabled = true;
    }
    cacheBox.checked = (canCache && gCalendar.getProperty("cache.enabled"));

    // Set up the show alarms row and checkbox
    var suppressAlarmsRow = document.getElementById("calendar-suppressAlarms-row");
    var suppressAlarms = gCalendar.getProperty('suppressAlarms');
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

    // Save cache options
    gCalendar.setProperty("cache.enabled", document.getElementById("cache").checked);

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
    var isEnabled = document.getElementById("calendar-enabled-checkbox").checked;
    var els = document.getElementsByAttribute("disable-with-calendar", "true");
    for (var i = 0; i < els.length; i++) {
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
