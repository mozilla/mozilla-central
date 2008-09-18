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

// ctors:
var CalDuration;
var CalPeriod;

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
        // xxx todo: hack
        // the master password prompt is currently not guarded against
        // multiple prompt; this initializes/raises the pw db at early stage.
        var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                        .getService(Components.interfaces.nsIPasswordManager);
        var enumerator = passwordManager.enumerator;
        if (enumerator.hasMoreElements()) {
            enumerator.getNext(); // actually prompts...
        }
    } catch (exc) {
    }
    
    try {        
        // ctors:
        CalDuration = new Components.Constructor("@mozilla.org/calendar/duration;1", "calIDuration");
        CalPeriod = new Components.Constructor("@mozilla.org/calendar/period;1", "calIPeriod");

        initLogging();

        // some string resources:
        g_privateItemTitle = calGetString("wcap", "privateItem.title.text");
        g_confidentialItemTitle = calGetString("wcap", "confidentialItem.title.text");
        g_busyItemTitle = calGetString("wcap", "busyItem.title.text");
        g_busyPhantomItemUuidPrefix = ("PHANTOM_uuid_" + getUUID());

        CACHE_LAST_RESULTS = getPref("calendar.wcap.cache_last_results", 4);
        CACHE_LAST_RESULTS_INVALIDATE = getPref("calendar.wcap.cache_last_results_invalidate", 120);
    } catch (exc) {
        logError(exc, "error in init sequence");
    }
}

var calWcapCalendarFactory = { // nsIFactory:
    lockFactory: function calWcapCalendarFactory_lockFactory(lock) {
    },

    createInstance: function calWcapCalendarFactory_createInstance(outer, iid) {
        if (outer) {
            throw Components.results.NS_ERROR_NO_AGGREGATION;
        }
        return (new calWcapCalendar()).QueryInterface(iid);
    }
};

var g_classInfo = {
    wcapCalendar: { // nsIClassInfo:
        getInterfaces: function ci_wcapCalendar_getInterfaces(count) {
            const ifaces = [calIWcapCalendar,
                            calICalendar,
                            Components.interfaces.calISchedulingSupport,
                            Components.interfaces.calIChangeLog,
                            Components.interfaces.calICalendarProvider,
                            Components.interfaces.nsIClassInfo,
                            nsISupports];
            count.value = ifaces.length;
            return ifaces;
        },
        classDescription: "Sun Java System Calendar Server WCAP Provider",
        contractID: "@mozilla.org/calendar/calendar;1?type=wcap",
        classID: Components.ID("{CF4D93E5-AF79-451a-95F3-109055B32EF0}"),
        getHelperForLanguage: function ci_wcapCalendar_getHelperForLanguage(language) {
            return null;
        },
        implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
        flags: 0
    },

    wcapSession: { // nsIClassInfo:
        getInterfaces: function ci_wcapSession_getInterfaces(count) {
            const ifaces = [calIWcapSession,
                            calIFreeBusyProvider,
                            calICalendarSearchProvider,
                            Components.interfaces.calITimezoneProvider,
                            Components.interfaces.calICalendarManagerObserver,
                            Components.interfaces.nsIClassInfo,
                            nsISupports];
            count.value = ifaces.length;
            return ifaces;
        },
        classDescription: "Sun Java System Calendar Server WCAP Session",
        contractID: "@mozilla.org/calendar/wcap/session;1",
        classID: Components.ID("{CBF803FD-4469-4999-AE39-367AF1C7B077}"),
        getHelperForLanguage: function ci_wcapSession_getHelperForLanguage(language) {
            return null;
        },
        implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
        flags: 0
    },

    wcapNetworkRequest: { // nsIClassInfo:
        getInterfaces: function ci_wcapNetworkRequest_getInterfaces(count) {
            const ifaces = [Components.interfaces.nsIUnicharStreamLoaderObserver,
                            Components.interfaces.nsIInterfaceRequestor,
                            Components.interfaces.nsIChannelEventSink,
                            Components.interfaces.calIOperation,
                            Components.interfaces.nsIClassInfo,
                            nsISupports];
            count.value = ifaces.length;
            return ifaces;
        },
        classDescription: "Sun Java System Calendar Server WCAP Network Request",
        contractID: "@mozilla.org/calendar/wcap/network-request;1",
        classID: Components.ID("{E3C62B37-83CF-41EC-9872-0AF9F952430A}"),
        getHelperForLanguage: function ci_wcapNetworkRequest_getHelperForLanguage(language) {
            return null;
        },
        implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
        flags: 0
    }
};

var calWcapCalendarModule = { // nsIModule:
    
    registerSelf: function calWcapCalendarModule_registerSelf(compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.registerFactoryLocation(g_classInfo.wcapCalendar.classID,
                                        g_classInfo.wcapCalendar.classDescription,
                                        g_classInfo.wcapCalendar.contractID,
                                        fileSpec, location, type);
    },

    unregisterSelf: function calWcapCalendarModule_unregisterSelf(compMgr, fileSpec, location) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
        compMgr.unregisterFactoryLocation(g_classInfo.wcapCalendar.classID, fileSpec);
    },

    m_scriptsLoaded: false,
    getClassObject: function calWcapCalendarModule_getClassObject(compMgr, cid, iid) {
        if (!this.m_scriptsLoaded) {
            // loading extra scripts from ../js:
            const scripts = ["calUtils.js", "calAuthUtils.js",
                             "calProviderUtils.js", "calProviderBase.js", "calProviderUtils.js",
                             "calWcapUtils.js", "calWcapErrors.js",
                             "calWcapRequest.js", "calWcapSession.js",
                             "calWcapCalendar.js", "calWcapCalendarItems.js"];
            var scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                                         .createInstance(Components.interfaces.mozIJSSubScriptLoader);
            var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                      .getService(Components.interfaces.nsIIOService);
            var baseDir = __LOCATION__.parent.parent;
            baseDir.append("js");
            for each (var script in scripts) {
                var scriptFile = baseDir.clone();
                scriptFile.append(script);
                scriptLoader.loadSubScript(ioService.newFileURI(scriptFile).spec, null);
            }
            initWcapProvider();
            this.m_scriptsLoaded = true;
        }

        if (!iid.equals(Components.interfaces.nsIFactory)) {
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }
        if (!cid.equals(g_classInfo.wcapCalendar.classID)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return calWcapCalendarFactory;
    },

    canUnload: function calWcapCalendarModule_canUnload(compMgr) {
        return true;
    }
};

/** module export */
function NSGetModule(compMgr, fileSpec) {
    return calWcapCalendarModule;
}

