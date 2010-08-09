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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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
