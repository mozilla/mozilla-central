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
 *   Sun Microsystems, Inc.
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

var g_bShutdown = false;

function initLogging() {
    initLogging.mLogTimezone = calendarDefaultTimezone();
    if (initLogging.mLogFilestream) {
        try {
            initLogging.mLogFilestream.close();
        } catch (exc) {
            ASSERT(false, exc);
        }
        initLogging.mLogFilestream = null;
    }
    
    LOG_LEVEL = getPref("calendar.wcap.log_level", 0);
    if (LOG_LEVEL < 1 && getPref("calendar.debug.log", false)) {
        LOG_LEVEL = 1; // at least basic logging when calendar.debug.log is set
    }

    if (LOG_LEVEL > 0) {
        var logFileName = getPref("calendar.wcap.log_file", null);
        if (logFileName) {
            try {
                // set up file:
                var logFile = Components.classes["@mozilla.org/file/local;1"]
                                        .createInstance(Components.interfaces.nsILocalFile);
                logFile.initWithPath(logFileName);
                // create output stream:
                var logFileStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                              .createInstance(Components.interfaces.nsIFileOutputStream);
                logFileStream.init(logFile,
                                   0x02 /* PR_WRONLY */ |
                                   0x08 /* PR_CREATE_FILE */ |
                                   (getPref("calendar.wcap.log_file_append", false)
                                    ? 0x10 /* PR_APPEND */ : 0x20 /* PR_TRUNCATE */),
                                   0700 /* read, write, execute/search by owner */,
                                   0 /* unused */);
                initLogging.mLogFilestream = logFileStream;
            } catch (exc) {
                logError(exc, "init logging");
            }
        }
        log("################################# NEW WCAP LOG #################################", "init logging");
        logWarning("WCAP logging enabled! level=" + LOG_LEVEL +
                   (initLogging.mLogFilestream ? (", file=" + logFileName) : ""));
    }
    if (!initLogging.mLogPrefObserver) {
        initLogging.mLogPrefObserver = { // nsIObserver:
            observe: function logPrefObserver_observe(subject, topic, data) {
                if (topic == "nsPref:changed") {
                    switch (data) {
                        case "calendar.wcap.log_level":
                        case "calendar.wcap.log_file":
                        case "calendar.debug.log":
                            initLogging();
                            break;
                    }
                }
            }
        };
        var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                   .getService(Components.interfaces.nsIPrefBranch2);
        prefBranch.addObserver("calendar.wcap.log_level", initLogging.mLogPrefObserver, false);
        prefBranch.addObserver("calendar.wcap.log_file", initLogging.mLogPrefObserver, false);
        prefBranch.addObserver("calendar.debug.log", initLogging.mLogPrefObserver, false);

        var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                        .getService(Components.interfaces.nsIObserverService);
        var appObserver = { // nsIObserver:
            observe: function app_observe(subject, topic, data) {
                if (topic == "quit-application") {
                    prefBranch.removeObserver("calendar.", initLogging.mLogPrefObserver);
                }
            }
        };
        observerService.addObserver(appObserver, "quit-application", false);
    }
}

function log(msg, context, bForce) {
    if (bForce || LOG_LEVEL > 0) {
        var ret = "";
        if (context) {
            ret += ("[" + context + "]");
        }
        if (ret.length > 0) {
            ret += "\n";
        }
        ret += msg;
        var now = getTime();
        if (now && initLogging.mLogTimezone) {
            now = now.getInTimezone(initLogging.mLogTimezone);
        }
        var str = ("### WCAP log entry: " + now + "\n" + ret);
        getConsoleService().logStringMessage(str);
        str = ("\n" + str + "\n");
        dump(str);
        if (initLogging.mLogFilestream) {
            try {
                // xxx todo?
                // assuming ANSI chars here, for logging sufficient:
                initLogging.mLogFilestream.write(str, str.length);
            } catch (exc) { // catching any io errors here:
                var err = ("error writing log file: " + errorToString(exc));
                Components.utils.reportError(exc);
                getConsoleService().logStringMessage(err);
                dump(err  + "\n\n");
            }
        }
        return ret;
    } else {
        return msg;
    }
}

function logWarning(err, context) {
    var msg = errorToString(err);
    var scriptError = Components.classes["@mozilla.org/scripterror;1"]
                                .createInstance(Components.interfaces.nsIScriptError);
    scriptError.init(log("warning: " + msg, context, true),
                     null, null, 0, 0,
                     Components.interfaces.nsIScriptError.warningFlag,
                     "component javascript");
    getConsoleService().logMessage(scriptError);
    return msg;
}

function logError(err, context) {
    var msg = errorToString(err);
    Components.utils.reportError(log("error: " + msg + "\nstack:\n" + STACK(10), context, true));
    debugger;
    return msg;
}

// late-inited service accessors:

function getWindowWatcher() {
    if (!getWindowWatcher.m_obj) {
        getWindowWatcher.m_obj = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                           .getService(Components.interfaces.nsIWindowWatcher);
    }
    return getWindowWatcher.m_obj;
}

function getCalendarSearchService() {
    if (!getCalendarSearchService.m_obj) {
        getCalendarSearchService.m_obj = Components.classes["@mozilla.org/calendar/calendarsearch-service;1"]
                                                   .getService(Components.interfaces.calICalendarSearchService);
    }
    return getCalendarSearchService.m_obj;
}

function getDomParser() {
    if (!getDomParser.m_obj) {
        getDomParser.m_obj = Components.classes["@mozilla.org/xmlextras/domparser;1"]
                                       .getService(Components.interfaces.nsIDOMParser);
    }
    return getDomParser.m_obj;
}

function isParent(item) {
    if (item.id != item.parentItem.id) {
        throw new Components.Exception("proxy has different id than its parent!");
    }
    return (!item.recurrenceId);
}

function forEachIcalComponent(icalRootComp, componentType, func, maxResults) {
    var itemCount = 0;
    // libical returns the vcalendar component if there is just
    // one vcalendar. If there are multiple vcalendars, it returns
    // an xroot component, with those vcalendar childs. We need to
    // handle both.
    for (var calComp = (icalRootComp.componentType == "VCALENDAR"
                        ? icalRootComp : icalRootComp.getFirstSubcomponent("VCALENDAR"));
         calComp != null && (!maxResults || itemCount < maxResults);
         calComp = icalRootComp.getNextSubcomponent("VCALENDAR")) {

        for (var subComp = calComp.getFirstSubcomponent(componentType);
             subComp != null && (!maxResults || itemCount < maxResults);
             subComp = calComp.getNextSubcomponent(componentType)) {

            func(subComp);
            ++itemCount;
        }
    }
}

function filterXmlNodes(name, rootNode) {
    var ret = [];
    if (rootNode) {
        var nodeList = rootNode.getElementsByTagName(name);
        for (var i = 0; i < nodeList.length; ++i) {
            var node = nodeList.item(i);
            ret.push(trimString(node.textContent));
        }
    }
    return ret;
}

function trimString(str) {
    return str.replace(/(^\s+|\s+$)/g, "");
}

function getTime() {
    if (g_bShutdown) {
        return null;
    }
    var ret = createDateTime();
    ret.jsDate = new Date();
    return ret;
}

function getIcalUTC(dt) {
    if (!dt || !dt.isValid) {
        return "0";
    } else {
        var dtz = dt.timezone;
        if (dtz.isUTC || dtz.isFloating) {
            return dt.icalString;
        } else {
            return dt.getInTimezone(UTC()).icalString;
        }
    }
}

function getDatetimeFromIcalString(val) {
    if (!val || val.length == 0 || val == "0") {
        return null;
    }
    // assuming timezone is known:
    var dt = createDateTime();
    dt.icalString = val;
    return dt;
}

function getDatetimeFromIcalProp(prop) {
    if (!prop) {
        return null;
    }
    return getDatetimeFromIcalString(prop.valueAsIcalString);
}

function getPref(prefName, defaultValue) {
    var ret = getPrefSafe(prefName, defaultValue);
    log(ret, "getPref(): prefName=" + prefName);
    return ret;
}

