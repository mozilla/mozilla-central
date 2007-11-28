/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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

function calWcapCalendar(/*optional*/session, /*optional*/calProps) {
    this.initProviderBase();
    this.m_session = session;
    this.m_calProps = calProps;
    this.m_observers = new calListenerBag(Components.interfaces.calIObserver);
}
calWcapCalendar.prototype = {
    __proto__: calProviderBase.prototype,

    m_ifaces: [ calIWcapCalendar,
                calICalendar,
                Components.interfaces.calICalendarProvider,
                Components.interfaces.nsIInterfaceRequestor,
                Components.interfaces.nsIClassInfo,
                nsISupports ],

    // nsISupports:
    QueryInterface: function calWcapCalendar_QueryInterface(iid) {
        return doQueryInterface(this, calWcapCalendar.prototype, iid, this.m_ifaces, this);
    },

    // nsIClassInfo:
    getInterfaces: function calWcapCalendar_getInterfaces(count) {
        count.value = this.m_ifaces.length;
        return this.m_ifaces;
    },
    get classDescription() {
        return calWcapCalendarModule.WcapCalendarInfo.classDescription;
    },
    get contractID() {
        return calWcapCalendarModule.WcapCalendarInfo.contractID;
    },
    get classID() {
        return calWcapCalendarModule.WcapCalendarInfo.classID;
    },
    getHelperForLanguage: function calWcapCalendar_getHelperForLanguage(language) { return null; },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,
    
    // nsIInterfaceRequestor:
    getInterface: function calWcapCalendar_getInterface(iid, instance)
    {
        if (iid.equals(Components.interfaces.nsIAuthPrompt)) {
            // use the window watcher service to get a nsIAuthPrompt impl
            return getWindowWatcher().getNewAuthPrompter(null);
        }
        else if (iid.equals(Components.interfaces.nsIPrompt)) {
            // use the window watcher service to get a nsIPrompt impl
            return getWindowWatcher().getNewPrompter(null);
        }
        Components.returnCode = Components.results.NS_ERROR_NO_INTERFACE;
        return null;
    },
    
    toString: function calWcapCalendar_toString() {
        var str = this.session.toString();
        if (this.m_calId)
            str += (", calId=" + this.calId);
        else
            str += ", default calendar";
        return str;
    },
    notifyError_: function calWcapCalendar_notifyError_(err, context, suppressOnError)
    {
        var rc = getResultCode(err);
        if ((rc == calIErrors.OPERATION_CANCELLED) ||
            (rc == NS_ERROR_OFFLINE)) { // no real error
            return;
        }
        var msg;
        if (checkResultCode(rc, calIErrors.WCAP_ERROR_BASE, 8) ||
            (getErrorModule(rc) == NS_ERROR_MODULE_NETWORK)) {
            // don't bloat the js error console with these errors:
            msg = errorToString(err);
            log("error: " + msg, context);
        } else {
            msg = logError(err, context);
        }
        if (!suppressOnError) {
            this.notifyObservers("onError",
                                 err instanceof Components.interfaces.nsIException
                                 ? [err.result, err.message] : [isNaN(err) ? -1 : err, msg]);
        }
    },
    notifyError: function calWcapCalendar_notifyError(err, suppressOnError) {
        this.notifyError_(err, this, suppressOnError);
    },

    // calICalendarProvider:
    get prefChromeOverlay() {
        return null;
    },
    // displayName attribute already part of calIWcapCalendar
    createCalendar: function calWcapCalendar_createCalendar(name, url, listener) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },
    deleteCalendar: function calWcapCalendar_deleteCalendar(calendar, listener) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },
    getCalendar: function calWcapCalendar_getCalendar(url) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },
    
    // calICalendar:
    get name() {
        var name = this.getProperty("name");
        if (!name) {
            name = this.displayName;
        }
        return name;
    },
    set name(name) {
        return this.setProperty("name", name);
    },
    
    get type() { return "wcap"; },
    
    m_superCalendar: null,
    get superCalendar() {
        return (this.m_superCalendar || this);
    },
    set superCalendar(cal) {
        return (this.m_superCalendar = cal);
    },

    m_uri: null,
    get uri() {
        return this.m_uri;
    },
    set uri(thatUri) {
        this.m_uri = thatUri.clone();
        var path = thatUri.path;
        var qmPos = path.indexOf("?");
        if (qmPos != -1) {
            var pos = path.indexOf("?calid=", qmPos);
            if (pos != -1) {
                var start = (pos + "?calid=".length);
                var end = path.indexOf("&", start);
                this.m_calId = decodeURIComponent(
                    path.substring(start, end == -1 ? path.length : end));
            }
        }
        return this.uri;
    },

    m_bReadOnly: null,
    getProperty: function calWcapCalendar_getProperty(aName) {
        var value = getCalendarManager().getCalendarPref_(this, aName);
        switch (aName) {
        case "readOnly":
            value = this.m_bReadOnly;
            if (value === null) {
                // tweak readOnly default to true for non-owned calendars:
                value = (this.session.isLoggedIn && !this.isOwnedCalendar);
            }
            break;
        case "calendar-main-in-composite":
            if (value === null && !this.isDefaultCalendar) {
                // tweak in-composite to false for secondary calendars:
                value = false;
            }
            break;
        case "suppressAlarms":
            // CS cannot store X-props reliably (thus writing X-MOZ stamps etc is not possible).
            // Popup alarms not available no matter what; wtf.
            value = true;
            break;
        }
        // xxx future: return getPrefSafe("calendars." + this.id + "." + aName, null);
        return value;
    },
    setProperty: function calWcapCalendar_setProperty(aName, aValue) {
        var oldValue = this.getProperty(aName);
        if (oldValue != aValue) {
            switch (aName) {
            case "readOnly":
                this.m_bReadOnly = aValue;
                break;
            case "suppressAlarms":
            case "calendar-main-in-composite":
                if (!aValue) {
                    getCalendarManager().deleteCalendarPref_(this, aName);
                    break;
                }
                // fallthru intended
            default:
                // xxx future: setPrefSafe("calendars." + this.id + "." + aName, aValue);
                getCalendarManager().setCalendarPref_(this, aName, aValue);
                break;
            }
            this.m_observers.notify("onPropertyChanged",
                                    [this, aName, aValue, oldValue]);
        }
        return aValue;
    },
    // deleteProperty implemented in calProviderBase

    m_observers: null,
    notifyObservers: function calWcapCalendar_notifyObservers(func, args) {
        if (g_bShutdown)
            return;
        this.m_observers.notify(func, args);
    },
    addObserver: function calWcapCalendar_addObserver(observer) {
        this.m_observers.add(observer);
    },
    removeObserver: function calWcapCalendar_removeObserver(observer) {
        this.m_observers.remove(observer);
    },
    
    // xxx todo: batch currently not used
    startBatch: function calWcapCalendar_startBatch() {
        this.notifyObservers("onStartBatch");
    },
    endBatch: function calWcapCalendar_endBatch() {
        this.notifyObservers("onEndBatch");
    },

    get sendItipInvitations() {
        return false;
    },

    get canRefresh() { return true; },
    refresh: function calWcapCalendar_refresh() {
        log("refresh.", this);
        // invalidate cached results:
        delete this.m_cachedResults;
        // notify about refreshed calendar:
        this.notifyObservers("onLoad", [this]);
    },
    
    issueNetworkRequest: function calWcapCalendar_issueNetworkRequest(
        request, respFunc, dataConvFunc, wcapCommand, params, accessRights)
    {
        var this_ = this;
        // - bootstrap problem: no cal_props, no access check, no default calId
        // - assure being logged in, thus the default cal_props are available
        // - every subscribed calendar will come along with cal_props
        return this.session.getSessionId(
            request,
            function getSessionId_resp(err, sessionId) {
                try {
                    if (err)
                        throw err;
                    this_.assureAccess(accessRights);
                    params += ("&calid=" + encodeURIComponent(this_.calId));
                    this_.session.issueNetworkRequest(
                        request, respFunc, dataConvFunc, wcapCommand, params);
                }
                catch (exc) {
                    request.execSubRespFunc(respFunc, exc);
                }
            });
    },
    
    // calIWcapCalendar:
    
    m_session: null,
    get session() {
        if (!this.m_session) {
            var uri = this.uri;
            ASSERT(uri, "no URI set!");
            var path = uri.path;
            var qmPos = path.indexOf("?");
            if (qmPos != -1) {
                uri = uri.clone();
                uri.path = path.substring(0, qmPos); // get rid of params
            }
            this.m_session = getWcapSessionFor(this, uri);
        }
        return this.m_session;
    },

    m_calId: null,
    get calId() {
        if (this.m_calId)
            return this.m_calId;
        return this.session.defaultCalId;
    },
    
    get ownerId() {
        var ar = this.getCalProps("X-NSCP-CALPROPS-PRIMARY-OWNER");
        if (ar.length == 0) {
            var calId = this.calId;
            log("cannot determine primary owner of calendar " + calId, this);
            // fallback to calId prefix:
            var nColon = calId.indexOf(":");
            if (nColon >= 0)
                calId = calId.substring(0, nColon);
            return calId;
        }
        return ar[0];
    },
    
    get description() {
        var ar = this.getCalProps("X-NSCP-CALPROPS-DESCRIPTION");
        if (ar.length == 0) {
            // fallback to display name:
            return this.displayName;
        }
        return ar[0];
    },
    
    get displayName() {
        var ar = this.getCalProps("X-NSCP-CALPROPS-NAME");
        if (ar.length == 0) {
            // fallback to common name:
            ar = this.getCalProps("X-S1CS-CALPROPS-COMMON-NAME");
            if (ar.length == 0) {
                ar = [this.calId];
            }
        }
        var name = ar[0];
        var defaultCal = this.session.defaultCalendar;
        if (defaultCal) {
            var defName = (defaultCal.getProperty("account_name") ||
                           defaultCal.getProperty("name"));
            if (defName) {
                name += (" (" + defName + ")");
            }
        }
        return name;
    },
    
    get isOwnedCalendar() {
        if (this.isDefaultCalendar)
            return true; // default calendar is owned
        return (this.ownerId == this.session.userId);
    },
    
    get isDefaultCalendar() {
        return !this.m_calId;
    },
    
    getCalendarProperties: function calWcapCalendar_getCalendarProperties(propName, out_count) {
        var ret = this.getCalProps(propName);
        out_count.value = ret.length;
        return ret;
    },

    m_calProps: null,
    getCalProps: function calWcapCalendar_getCalProps(propName) {
        if (!this.m_calProps) {
            log("soft error: no calprops, most possibly not logged in.", this);
//             throw new Components.Exception("No calprops available!",
//                                            Components.results.NS_ERROR_NOT_AVAILABLE);
        }
        return filterXmlNodes(propName, this.m_calProps);
    },
    
    get defaultTimezone() {
        var tzid = this.getCalProps("X-NSCP-CALPROPS-TZID");
        if (tzid.length == 0) {
            logError("defaultTimezone: cannot get X-NSCP-CALPROPS-TZID!", this);
            return "UTC"; // fallback
        }
        return tzid[0];
    },
    
    getAlignedTimezone: function calWcapCalendar_getAlignedTimezone(tzid) {
        // check whether it is one of cs:
        if (tzid.indexOf("/mozilla.org/") == 0) {
            // cut mozilla prefix: assuming that the latter string portion
            //                     semantically equals the demanded timezone
            tzid = tzid.substring( // next slash after "/mozilla.org/"
                tzid.indexOf("/", "/mozilla.org/".length) + 1);
        }
        if (!this.session.isSupportedTimezone(tzid)) {
            // xxx todo: we could further on search for a matching region,
            //           e.g. CET (in TZNAME), but for now stick to
            //           user's default if not supported directly
            var ret = this.defaultTimezone;
            // use calendar's default:
            log(tzid + " not supported, falling back to default: " + ret, this);
            return ret;
        }
        else // is ok (supported):
            return tzid;
    },
    
    checkAccess: function calWcapCalendar_checkAccess(accessControlBits)
    {
        // xxx todo: take real acl into account
        // for now, optimistically assuming that everybody has full access, server will check:
        var granted = calIWcapCalendar.AC_FULL;
        if (this.m_bReadOnly) {
            granted &= ~(calIWcapCalendar.AC_COMP_WRITE |
                         calIWcapCalendar.AC_PROP_WRITE);
        }
        // check whether every bit fits:
        return ((accessControlBits & granted) == accessControlBits);
    },
    
    assureAccess: function calWcapCalendar_assureAccess(accessControlBits)
    {
        if (!this.checkAccess(accessControlBits & (calIWcapCalendar.AC_COMP_WRITE |
                                                   calIWcapCalendar.AC_PROP_WRITE))) {
            // throw different error code for read-only:
            throw new Components.Exception("Access denied!",
                                           calIErrors.CAL_IS_READONLY);
        }
        if (!this.checkAccess(accessControlBits)) {
            throw new Components.Exception("Access denied!",
                                           calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR);
            // xxx todo: throwing different error here, no
            //           calIErrors.CAL_IS_READONLY anymore
        }
    },
    
    defineAccessControl: function calWcapCalendar_defineAccessControl(
        userId, accessControlBits)
    {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    
    resetAccessControl: function calWcapCalendar_resetAccessControl(userId)
    {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    
    getAccessControlDefinitions: function calWcapCalendar_getAccessControlDefinitions(
        out_count, out_users, out_accessControlBits)
    {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }
};

