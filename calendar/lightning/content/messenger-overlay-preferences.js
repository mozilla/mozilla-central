/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gLightningPane = {
    mInitialized: false,

    init: function lnPaneInit() {
        var preference = document.getElementById("calendar.preferences.lightning.selectedTabIndex");
        if (preference.value) {
            var ltnPrefs = document.getElementById("calPreferencesTabbox");
            ltnPrefs.selectedIndex = preference.value;
        }
        this.mInitialized = true;
    },

    tabSelectionChanged: function lnPaneTabSelectionChanged() {
        if (!this.mInitialized) {
            return;
        }
        var ltnPrefs = document.getElementById("calPreferencesTabbox");
        var preference = document.getElementById("calendar.preferences.lightning.selectedTabIndex");
        preference.valueFromPreferences = ltnPrefs.selectedIndex;
    }
};
