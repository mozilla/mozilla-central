/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function calWcapCalendar(/*optional*/session, /*optional*/calProps) {
    this.initProviderBase();
    this.m_session = session;
    this.m_calProps = calProps;
}
const calWcapCalendarClassID = Components.ID("{cf4d93e5-af79-451a-95f3-109055b32ef0}");
const calWcapCalendarInterfaces = [
    calIWcapCalendar,
    calICalendar,
    Components.interfaces.calISchedulingSupport,
    Components.interfaces.calIChangeLog,
    Components.interfaces.calICalendarProvider,
];
calWcapCalendar.prototype = {
    __proto__: cal.ProviderBase.prototype,
    classID: calWcapCalendarClassID,
    QueryInterface: XPCOMUtils.generateQI(calWcapCalendarInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calWcapCalendarClassID,
        contractID: "@mozilla.org/calendar/calendar;1?type=wcap",
        classDescription: "Sun Java System Calendar Server WCAP Provider",
        interfaces: calWcapCalendarInterfaces
    }),

    toString: function calWcapCalendar_toString() {
        var str = this.session.toString();
        if (this.m_calId) {
            str += (", calId=" + this.calId);
        } else {
            str += ", default calendar";
        }
        return str;
    },

    notifyError_: function calWcapCalendar_notifyError_(err, msg, context) {
        var rc = getResultCode(err);
        switch (rc) {
            case calIWcapErrors.WCAP_COMPONENT_NOT_FOUND:
            case NS_ERROR_OFFLINE:
                return;
            default:
                msg = errorToString(err);
                log("error: " + msg, context);
                break;
        }
        this.__proto__.__proto__.notifyError.apply(
            this,
            err instanceof Components.interfaces.nsIException
            ? [err.result, err.message]
            : [(isNaN(err) ? Components.results.NS_ERROR_FAILURE : err), msg]);
    },
    notifyError: function calWcapCalendar_notifyError(err, msg) {
        this.notifyError_(err, msg, this);
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
    set name(aValue) {
        return this.setProperty("name", aValue);
    },

    get type() {
        return "wcap";
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

    getProperty: function calWcapCalendar_getProperty(aName) {
        switch (aName) {
            case "cache.supported":
                return true;
            case "timezones.provider":
                return ((this.m_session && this.session.isLoggedIn) ? this.session : null);
            case "organizerId":
                return this.ownerId;
            case "organizerCN":
                return this.getCalendarProperties("X-S1CS-CALPROPS-COMMON-NAME");
            case "itip.disableRevisionChecks":
                return true;
            case "capabilities.timezones.floating.supported":
            case "capabilities.timezones.UTC.supported":
            case "capabilities.attachments.supported":
            case "capabilities.alarms.popup.supported": // CS cannot store X-props reliably
                                                        // (thus writing X-MOZ stamps etc is not possible).
                                                        // Popup alarms not available no matter what; wtf.
                return false;
            case "capabilities.alarms.actionValues":
                return ["EMAIL"];
            case "capabilities.alarms.maxCount":
                return 1;
        }

        var value = this.__proto__.__proto__.getProperty.apply(this, arguments);
        switch (aName) {
            case "readOnly":
                if (value === null) {
                    // tweak readOnly default to true for non-owned calendars,
                    // all secondary calendars to readOnly unless we're logged in
                    value = (this.m_session && this.session.isLoggedIn
                             ? !this.isOwnedCalendar
                             : !this.isDefaultCalendar);
                }
                break;
            case "calendar-main-in-composite":
                if (value === null && !this.isDefaultCalendar) {
                    // tweak in-composite to false for secondary calendars:
                    value = false;
                }
                break;
        }
        return value;
    },

    setProperty: function calWcapCalendar_setProperty(aName, aValue) {
        switch (aName) {
            case "disabled":
                if (this.isDefaultCalendar) {
                    // disabling/enabling the default calendar will enable/disable all calendars
                    // belonging to the same session:
                    for each (let calendar in this.session.getRegisteredCalendars()) {
                        if (!calendar.isDefaultCalendar) {
                            calendar.setProperty("disabled", aValue);
                        }
                    }
                }
                // fallthru intended
            default:
                this.__proto__.__proto__.setProperty.apply(this, arguments);
                break;
        }
    },

    notifyObservers: function calWcapCalendar_notifyObservers(func, args) {
        if (g_bShutdown) {
            return;
        }
        this.observers.notify(func, args);
    },

    // xxx todo: batch currently not used
    startBatch: function calWcapCalendar_startBatch() {
        this.notifyObservers("onStartBatch");
    },
    endBatch: function calWcapCalendar_endBatch() {
        this.notifyObservers("onEndBatch");
    },

    get canRefresh() {
        return true;
    },
    refresh: function calWcapCalendar_refresh() {
        log("refresh.", this);
        // invalidate cached results:
        delete this.m_cachedResults;
        // notify about refreshed calendar:
        this.notifyObservers("onLoad", [this]);
    },
    
    issueNetworkRequest: function calWcapCalendar_issueNetworkRequest(
        request, respFunc, dataConvFunc, wcapCommand, params, accessRights) {

        var this_ = this;
        // - bootstrap problem: no cal_props, no access check, no default calId
        // - assure being logged in, thus the default cal_props are available
        // - every subscribed calendar will come along with cal_props
        return this.session.getSessionId(
            request,
            function getSessionId_resp(err, sessionId) {
                try {
                    if (err) {
                        throw err;
                    }
                    this_.assureAccess(accessRights);
                    params += ("&calid=" + encodeURIComponent(this_.calId));
                    this_.session.issueNetworkRequest(request, respFunc, dataConvFunc, wcapCommand, params);
                } catch (exc) {
                    request.execSubRespFunc(respFunc, exc);
                }
            });
    },

    // calIWcapCalendar:

    m_session: null,
    get session() {
        if (!this.m_session) {
            this.m_session = getWcapSessionFor(this);
        }
        return this.m_session;
    },

    m_calId: null,
    get calId() {
        return (this.m_calId || this.session.defaultCalId);
    },

    get ownerId() {
        var ar = this.getCalendarProperties("X-NSCP-CALPROPS-PRIMARY-OWNER");
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
        var ar = this.getCalendarProperties("X-NSCP-CALPROPS-DESCRIPTION");
        if (ar.length == 0) {
            // fallback to display name:
            return this.displayName;
        }
        return ar[0];
    },

    get displayName() {
        var ar = this.getCalendarProperties("X-NSCP-CALPROPS-NAME");
        if (ar.length == 0) {
            // fallback to common name:
            ar = this.getCalendarProperties("X-S1CS-CALPROPS-COMMON-NAME");
            if (ar.length == 0) {
                ar = [this.calId];
            }
        }
        return ar[0];
    },

    get isOwnedCalendar() {
        if (this.isDefaultCalendar) {
            return true; // default calendar is owned
        }
        return (this.ownerId == this.session.userId);
    },

    get isDefaultCalendar() {
        return !this.m_calId;
    },

    m_calProps: null,
    getCalendarProperties: function calWcapCalendar_getCalendarProperties(propName, out_count) {
        if (!this.m_calProps) {
            log("soft error: no calprops available, most possibly not logged in.", this);
        }
        var ret = filterXmlNodes(propName, this.m_calProps);
        if (out_count) {
            out_count.value = ret.length;
        }
        return ret;
    },

    get defaultTimezone() {
        var tzid = this.getCalendarProperties("X-NSCP-CALPROPS-TZID");
        if (tzid.length > 0) { // first try server-configured tz:
            return tzid[0];
        } else {
            logWarning("defaultTimezone: cannot get X-NSCP-CALPROPS-TZID!", this);
            // try to use local one if supported:
            let tzid = cal.getTimezoneService().defaultTimezone.tzid;
            return (this.session.getTimezone(tzid) ? tzid : "UTC");
        }
    },

    getAlignedTzid: function calWcapCalendar_getAlignedTzid(tz) {
        var tzid = tz.tzid;
        // check whether it is one cs supports:
        if (tz.isFloating || !this.session.getTimezone(tzid)) {
            log("not a supported timezone: " + tzid);
            // bug 435436:
            // xxx todo: we could further on search for a matching region,
            //           e.g. CET (in TZNAME), but for now stick to
            //           user's default if not supported directly
            var ret = this.defaultTimezone;
            // use calendar's default:
            log(tzid + " not supported, falling back to default: " + ret, this);
            return ret;
        }
        return tzid;
    },

    checkAccess: function calWcapCalendar_checkAccess(accessControlBits) {
        // xxx todo: take real acl into account
        // for now, optimistically assuming that everybody has full access, server will check:
        var granted = calIWcapCalendar.AC_FULL;
        if (this.getProperty("readOnly")) {
            granted &= ~(calIWcapCalendar.AC_COMP_WRITE |
                         calIWcapCalendar.AC_PROP_WRITE);
        }
        // check whether every bit fits:
        return ((accessControlBits & granted) == accessControlBits);
    },

    assureAccess: function calWcapCalendar_assureAccess(accessControlBits) {
        if (!this.checkAccess(accessControlBits & (calIWcapCalendar.AC_COMP_WRITE |
                                                   calIWcapCalendar.AC_PROP_WRITE))) {
            // throw different error code for read-only:
            throw new Components.Exception(errorToString(calIErrors.CAL_IS_READONLY),
                                           calIErrors.CAL_IS_READONLY);
        }
        if (!this.checkAccess(accessControlBits)) {
            throw new Components.Exception(errorToString(calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR),
                                           calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR);
            // xxx todo: throwing different error here, no
            //           calIErrors.CAL_IS_READONLY anymore
        }
    },

    defineAccessControl: function calWcapCalendar_defineAccessControl(userId, accessControlBits) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    resetAccessControl: function calWcapCalendar_resetAccessControl(userId) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    getAccessControlDefinitions: function calWcapCalendar_getAccessControlDefinitions(out_count, out_users,
                                                                                      out_accessControlBits) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }
};
