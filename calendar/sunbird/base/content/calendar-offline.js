/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

if (!calendarOfflineManager) {
    Components.utils.reportError("calendar-management.js not included!");
}

// In addition to what the base calendar offline manager does, we need to make
// the offline commands work in sunbird. Extend the offline manager here.
var baseUpdateOfflineUI = calendarOfflineManager.updateOfflineUI;
calendarOfflineManager.updateOfflineUI = function sunbird_updateOfflineUI(aIsOffline) {
    var propName = (aIsOffline ? "offlineTooltip" : "onlineTooltip")
    var tooltip = calGetString("calendar", propName);

    setElementValue("offline-status", aIsOffline && "true", "offline");
    setElementValue("offline-status", tooltip, "tooltiptext");

    baseUpdateOfflineUI(aIsOffline);
};

calendarOfflineManager.toggleOfflineStatus = function sunbird_toggleOfflineStatus() {
    var ioService = Services.io;
    if (ioService.offline) {
        // Going online
        ioService.offline = false;
        try {
            // Alternatively we could check for @mozilla.org/network/network-link-service;1 here
            // instead of using a try-catch block, but the dependency on that service is rather an
            // implementation detail of the IO service.
            ioService.manageOfflineStatus = getPrefSafe("offline.autoDetect", true);
        } catch (exc) {
        }
    } else {
        // Going offline
        ioService.manageOfflineStatus = false;
        ioService.offline = true;
    }
};
