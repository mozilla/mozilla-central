/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

//
// init code for globals, prefs:
//

// constants:
const NS_OK = Components.results.NS_OK;
const NS_ERROR_UNEXPECTED = Components.results.NS_ERROR_UNEXPECTED;
const nsIException = Components.interfaces.nsIException;
const nsISupports = Components.interfaces.nsISupports;
const calIWcapSession = Components.interfaces.calIWcapSession;
const calIWcapCalendar = Components.interfaces.calIWcapCalendar;
const calIWcapErrors = Components.interfaces.calIWcapErrors;
const calICalendar = Components.interfaces.calICalendar;
const calIItemBase = Components.interfaces.calIItemBase;
const calIOperationListener = Components.interfaces.calIOperationListener;
const calIFreeBusyProvider = Components.interfaces.calIFreeBusyProvider;
const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;
const calICalendarSearchProvider = Components.interfaces.calICalendarSearchProvider;
const calIErrors = Components.interfaces.calIErrors;

// some string resources:
var g_privateItemTitle;
var g_confidentialItemTitle;
var g_busyItemTitle;
var g_busyPhantomItemUuidPrefix;

// global preferences:

// caching the last data retrievals:
var CACHE_LAST_RESULTS = 4;
// timer secs for invalidation:
var CACHE_LAST_RESULTS_INVALIDATE = 120;

// logging:
var LOG_LEVEL = 0;

function initWcapProvider() {
    try {        
        initLogging();

        // some string resources:
        g_privateItemTitle = calGetString("wcap", "privateItem.title.text");
        g_confidentialItemTitle = calGetString("wcap", "confidentialItem.title.text");
        g_busyItemTitle = calGetString("wcap", "busyItem.title.text");
        g_busyPhantomItemUuidPrefix = ("PHANTOM_uuid_" + cal.getUUID());

        CACHE_LAST_RESULTS = getPref("calendar.wcap.cache_last_results", 4);
        CACHE_LAST_RESULTS_INVALIDATE = getPref("calendar.wcap.cache_last_results_invalidate", 120);
    } catch (exc) {
        logError(exc, "error in init sequence");
    }
}

/** Module Registration */
const scriptLoadOrder = [
    "calUtils.js",
    "calWcapUtils.js",
    "calWcapErrors.js",
    "calWcapRequest.js",
    "calWcapSession.js",
    "calWcapCalendar.js",
    "calWcapCalendarItems.js"
];

function NSGetFactory(cid) {
    try {
    if (!this.scriptsLoaded) {
        Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler)
                .setSubstitution("calendar", Services.io.newFileURI(__LOCATION__.parent.parent));
        Components.utils.import("resource://calendar/modules/calUtils.jsm");
        cal.loadScripts(scriptLoadOrder, Components.utils.getGlobalForObject(this));
        initWcapProvider();
        this.scriptsLoaded = true;

    }

    let components = [
        calWcapCalendar,
        calWcapNetworkRequest,
        calWcapSession
    ];

    return (XPCOMUtils.generateNSGetFactory(components))(cid);

    } catch (e) {
        cal.WARN("ERROR: " + e);
    }
}
