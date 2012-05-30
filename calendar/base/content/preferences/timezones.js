/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * Global Object to hold methods for the timezones dialog.
 */
var gTimezonesPane = {
    /**
     * Initialize the timezones pref pane. Sets up dialog controls to match the
     * values set in prefs.
     */
    init: function gTP_init() {
        var tzMenuList = document.getElementById("calendar-timezone-menulist");
        var tzMenuPopup = document.getElementById("calendar-timezone-menupopup");

        var tzService = cal.getTimezoneService();
        var enumerator = tzService.timezoneIds;
        var tzids = {};
        var displayNames = [];
        // don't rely on what order the timezone-service gives you
        while (enumerator.hasMore()) {
            var tz = tzService.getTimezone(enumerator.getNext());
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

        var prefValue = document.getElementById("calendar-timezone-local").value;
        if (!prefValue) {
            prefValue = calendarDefaultTimezone().tzid;
        }
        tzMenuList.value = prefValue;
    }
};
