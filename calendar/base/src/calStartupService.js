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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
Components.utils.import("resource://gre/modules/Services.jsm");

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
    this.setupObservers();
}

calStartupService.prototype = {
    // nsIClassInfo
    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    classDescription: "Calendar Startup Service",
    contractID: "@mozilla.org/calendar/startup-service;1",
    classID: Components.ID("{2547331f-34c0-4a4b-b93c-b503538ba6d6}"),
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    // nsISupports
    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calStartupService.prototype, aIID, null, this);
    },

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

