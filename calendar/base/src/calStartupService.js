/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Helper function to asynchronously call a certain method on the objects passed
 * in 'services' in order (i.e wait until the first completes before calling the
 * second
 *
 * @param method        The method name to call. Usually startup/shutdown.
 * @param services      The array of service objects to call on.
 */
function callOrderedServices(method, services) {
    let service = services.shift();
    if (service) {
        service[method]({
            onResult: function() {
                callOrderedServices(method, services);
            }
        });
    }
}

function calStartupService() {
    this.wrappedJSObject = this;
    this.setupObservers();
}

const calStartupServiceInterfaces = [Components.interfaces.nsIObserver];
const calStartupServiceClassID = Components.ID("{2547331f-34c0-4a4b-b93c-b503538ba6d6}");
calStartupService.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calStartupServiceInterfaces),
    classID: calStartupServiceClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/startup-service;1",
        classDescription: "Calendar Startup Service",
        classID: calStartupServiceClassID,
        interfaces: calStartupServiceInterfaces,
        flags: Components.interfaces.nsIClassInfo.SINGLETON
    }),

    // Startup Service Methods

    /**
     * Sets up the needed observers for noticing startup/shutdown
     */
    setupObservers: function ccm_setUpStartupObservers() {
        Services.obs.addObserver(this, "profile-after-change", false);
        Services.obs.addObserver(this, "profile-before-change", false);
        Services.obs.addObserver(this, "xpcom-shutdown", false);
    },

    /**
     * Gets the startup order of services. This is an array of service objects
     * that should be called in order at startup.
     *
     * @return      The startup order as an array.
     */
    getStartupOrder: function getStartupOrder() {
        let tzService = Components.classes["@mozilla.org/calendar/timezone-service;1"]
                                  .getService(Components.interfaces.calITimezoneService);
        let calMgr = Components.classes["@mozilla.org/calendar/manager;1"]
                               .getService(Components.interfaces.calICalendarManager);

        // Notification object
        let notify = {
            startup: function(aCompleteListener) {
                Services.obs.notifyObservers(null, "calendar-startup-done", null);
                aCompleteListener.onResult(null, Components.results.NS_OK);
            },
            shutdown: function shutdown(aCompleteListener) {
                // Argh, it would have all been so pretty! Since we just reverse
                // the array, the shutdown notification would happen before the
                // other shutdown calls. For lack of pretty code, I'm
                // leaving this out! Users can still listen to xpcom-shutdown.
                aCompleteListener.onResult(null, Components.results.NS_OK);
            }
        };

        // We need to spin up the timezone service before the calendar manager
        // to ensure we have the timezones initialized. Make sure "notify" is
        // last in this array!
        return [tzService, calMgr, notify];
    },

    /**
     * Observer notification callback
     */
    observe: function observe(aSubject, aTopic, aData) {
        switch (aTopic) {
            case "profile-after-change":
                callOrderedServices("startup", this.getStartupOrder());
                break;
            case "profile-before-change":
                callOrderedServices("shutdown", this.getStartupOrder().reverse());
                break;
            case "xpcom-shutdown":
                Services.obs.removeObserver(this, "profile-after-change");
                Services.obs.removeObserver(this, "profile-before-change");
                Services.obs.removeObserver(this, "xpcom-shutdown");
                break;
        }
    }
};
