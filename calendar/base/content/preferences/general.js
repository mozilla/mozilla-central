/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Global Object to hold methods for the general pref pane
 */
var gCalendarGeneralPane = {
    /**
     * Initialize the general pref pane. Sets up dialog controls to match the
     * values set in prefs.
     */
    init: function gCGP_init() {
        var df = Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                    .getService(Components.interfaces.calIDateTimeFormatter);

        var dateFormattedLong  = df.formatDateLong(now());
        var dateFormattedShort = df.formatDateShort(now());

        // menu items include examples of current date formats.
        document.getElementById("dateformat-long-menuitem")
                .setAttribute("label", labelLong + ": " + dateFormattedLong);
        document.getElementById("dateformat-short-menuitem")
                .setAttribute("label", labelShort + ": " + dateFormattedShort);

        // deselect and reselect to update visible item title
        updateSelectedLabel("dateformat");
    }
};
