/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

function onLoad() {
    let extension = window.arguments[0].extension;
    document.getElementById("provider-name-label").value = extension.name;

    let calendars = cal.getCalendarManager().getCalendars({})
                       .filter(function(x) x.providerID == extension.id);

    document.getElementById("calendar-list-tree").calendars = calendars;
}

function onAccept() {
    // Tell our caller that the extension should be uninstalled.
    let args = window.arguments[0];
    args.shouldUninstall = true;

    // Unsubscribe from all selected calendars
    let calendarList = document.getElementById("calendar-list-tree");
    let calendars = calendarList.selectedCalendars || [];
    let calMgr = cal.getCalendarManager();
    calendars.forEach(calMgr.unregisterCalendar, calMgr);

    return true;
}

function onCancel() {
    let args = window.arguments[0];
    args.shouldUninstall = false;

    return true;
}
