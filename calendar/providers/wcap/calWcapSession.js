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

function calWcapTimezone(tzProvider, tzid_, component_) {
    this.wrappedJSObject = this;
    this.provider = tzProvider;
    this.icalComponent = component_;
    this.tzid = tzid_;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = null;
    this.longitude = null;
}
calWcapTimezone.prototype = {
    get displayName calWcapTimezone_get_displayName() {
        if (this.mDisplayName === undefined) {
            // used l10n'ed display name if available:
            var tz = getTimezoneService().getTimezone(this.tzid);
            this.mDisplayName = (tz ? tz.displayName : this.tzid);
        }
        return this.mDisplayName;
    },
    toString: function() {
        return this.icalComponent.toString();
    }
};

function getWcapSessionFor(cal, uri) {
    var contextId = cal.getProperty("shared_context");
    if (!contextId) {
        contextId = getUUID();
        cal.setProperty("shared_context", contextId);
    }
    if (!getWcapSessionFor.m_sessions) {
        getWcapSessionFor.m_sessions = {};
    }
    var session = getWcapSessionFor.m_sessions[contextId];
    if (!session) {
        session = new calWcapSession(contextId, uri);
        getWcapSessionFor.m_sessions[contextId] = session;
        // install a mandatory default calendar:
        var defaultCal = cal;
        for each (var regCal in session.getRegisteredCalendars()) {
            if (regCal.isDefaultCalendar) {
                defaultCal = regCal;
                session.credentials.userId = defaultCal.getProperty("user_id");
                break;
            }
        }
        if (!defaultCal) {
            logError("no default calendar!", session);
        }
        session.defaultCalendar = defaultCal;
    }
    return session;
}

function calWcapSession(contextId, thatUri) {
    this.wrappedJSObject = this;
    this.m_contextId = contextId;
    this.m_loginQueue = [];

    this.m_uri = thatUri.clone();
    this.m_sessionUri = thatUri.clone();
    this.m_sessionUri.userPass = "";
    log("new session", this);

    // listen for shutdown, being logged out:
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, "quit-application", false /* don't hold weakly */);
    getCalendarManager().addObserver(this);
}
calWcapSession.prototype = {
    // nsISupports:
    QueryInterface: function calWcapSession_QueryInterface(iid) {
        return doQueryInterface(this, calWcapSession.prototype, iid, null, g_classInfo.wcapSession);
    },

    toString: function calWcapSession_toString(msg) {
        var str = ("context-id: " + this.m_contextId + ", uri: " + this.uri.spec);
        if (this.credentials.userId) {
            str += (", userId=" + this.credentials.userId);
        }
        if (!this.m_sessionId) {
            str += (getIOService().offline ? ", offline" : ", not logged in");
        }
        return str;
    },
    notifyError: function calWcapSession_notifyError(err) {
        if (this.defaultCalendar) {
            this.defaultCalendar.notifyError_(err, null, this);
        } else {
            logError("no default calendar!", this);
            logError(err, this);
        }
    },

    // calITimezoneProvider:
    m_serverTimezones: null,
    get timezoneIds calWcapSession_timezoneIdsGetter() {
        var tzids = [];
        for (var tzid in this.m_serverTimezones) {
            tzids.push(tzid);
        }
        return { // nsIUTF8StringEnumerator:
            m_index: 0,
            getNext: function() {
                if (this.m_index >= tzids) {
                    ASSERT(false, "calWcapSession::timezoneIds enumerator!");
                    throw Components.results.NS_ERROR_UNEXPECTED;
                }
                return tzids[this.m_index++];
            },
            hasMore: function() {
                return (this.m_index < tzids.length);
            }
        };
    },
    getTimezone: function calWcapSession_getTimezone(tzid) {
        switch (tzid) {
            case "floating":
                return floating();
            case "UTC":
                return UTC();
            default:
                if (this.m_serverTimezones) {
                    return this.m_serverTimezones[tzid];
                }
                return null;
        }
    },

    m_serverTimeDiff: null,
    getServerTime: function calWcapSession_getServerTime(localTime) {
        if (this.m_serverTimeDiff === null) {
            throw new Components.Exception("early run into getServerTime()!",
                                           Components.results.NS_ERROR_NOT_AVAILABLE);
        }
        var ret = (localTime ? localTime.clone() : getTime());
        ret.addDuration(this.m_serverTimeDiff);
        return ret;
    },

    m_sessionId: null,
    m_loginQueue: null,
    m_loginLock: false,

    getSessionId:
    function calWcapSession_getSessionId(request, respFunc, timedOutSessionId) {
        if (getIOService().offline) {
            log("in offline mode.", this);
            respFunc(new Components.Exception(errorToString(NS_ERROR_OFFLINE), NS_ERROR_OFFLINE));
            return;
        }

        log("login queue lock: " + this.m_loginLock + ", length: " + this.m_loginQueue.length, this);

        if (this.m_loginLock) {
            this.m_loginQueue.push(respFunc);
            log("login queue: " + this.m_loginQueue.length);
        } else {
            if (this.m_sessionId && this.m_sessionId != timedOutSessionId) {
                respFunc(null, this.m_sessionId);
                return;
            }

            this.m_loginLock = true;
            log("locked login queue.", this);
            this.m_sessionId = null; // invalidate for relogin

            if (timedOutSessionId) {
                log("reconnecting due to session timeout...", this);
                getFreeBusyService().removeProvider(this);
                getCalendarSearchService().removeProvider(this);
            }

            var this_ = this;
            this.getSessionId_(null, // don't couple to parent request parent may be cancelled
                               function getSessionId_resp_(err, sessionId) {
                                   log("getSessionId_resp_(): " + sessionId, this_);
                                   if (!err) {
                                       this_.m_sessionId = sessionId;
                                       getFreeBusyService().addProvider(this_);
                                       getCalendarSearchService().addProvider(this_);
                                   }

                                   var queue = this_.m_loginQueue;
                                   this_.m_loginLock = false;
                                   this_.m_loginQueue = [];
                                   log("unlocked login queue.", this_);

                                   function getSessionId_exec(func) {
                                       try {
                                           func(err, sessionId);
                                       } catch (exc) { // unexpected
                                           this_.notifyError(exc);
                                       }
                                   }
                                   // answer first request:
                                   getSessionId_exec(respFunc);
                                   // and any remaining:
                                   queue.forEach(getSessionId_exec);
                               });
        }
    },

    // this is a server limit for recurrencies; default is 60
    recurrenceBound: 60,

    getSessionId_: function calWcapSession_getSessionId_(request, respFunc) {

        var this_ = this;
        this.checkServerVersion(
            request,
            // probe whether server is accessible and responds:
            function checkServerVersion_resp(err) {
                if (err) {
                    respFunc(err);
                    return;
                }
                // lookup password manager, then try login or prompt/login:
                log("attempting to get a session id for " + this_.sessionUri.spec, this_);

                if (!this_.sessionUri.schemeIs("https") &&
                    !confirmInsecureLogin(this_.sessionUri)) {
                    log("user rejected insecure login on " + this_.sessionUri.spec, this_);
                    respFunc(new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                      calIWcapErrors.WCAP_LOGIN_FAILED));
                    return;
                }

                var outUser = { value: this_.credentials.userId };
                var outPW = { value: this_.credentials.pw };
                var outSavePW = { value: false };

                if (outUser.value && !outPW.value) { // lookup pw manager
                    log("looking in pw db for: " + this_.uri.spec, this_);
                    calPasswordManagerGet(outUser.value, outPW, this_.uri.spec, "wcap login");
                }

                function promptAndLoginLoop_resp(err, sessionId) {
                    if (checkErrorCode(err, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                        log("prompting for [user/]pw...", this_);
                        if (calGetCredentials(calGetString("wcap", "loginDialog.label"),
                                              this_.sessionUri.hostPort,
                                              outUser,
                                              outPW,
                                              outSavePW,
                                              this_.credentials.userId != null)) {
                            this_.login(request, promptAndLoginLoop_resp,
                                        outUser.value, outPW.value);
                        } else {
                            log("login prompt cancelled.", this_);
                            this_.defaultCalendar.setProperty("disabled", true);
                            respFunc(new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                              calIWcapErrors.WCAP_LOGIN_FAILED));
                        }
                    } else if (err) {
                        respFunc(err);
                    } else {
                        if (outSavePW.value) {
                            // so try to remove old pw from db first:
                            calPasswordManagerSave(outUser.value, outPW.value, this_.uri.spec, "wcap login");
                        }
                        this_.credentials.userId = outUser.value;
                        this_.credentials.pw = outPW.value;
                        this_.setupSession(sessionId,
                                           request,
                                           function setupSession_resp(err) {
                                               respFunc(err, sessionId);
                                           });
                    }
                }

                if (outPW.value) {
                    this_.login(request, promptAndLoginLoop_resp, outUser.value, outPW.value);
                } else {
                    promptAndLoginLoop_resp(calIWcapErrors.WCAP_LOGIN_FAILED);
                }
            });
    },

    login: function calWcapSession_login(request, respFunc, user, pw) {
        var this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                var sessionId;
                try {
                    if (err) {
                        throw err;
                    }
                    // currently, xml parsing at an early stage during
                    // process startup does not work reliably, so use
                    // libical parsing for now:
                    var icalRootComp = stringToIcal(this_, str);
                    var prop = icalRootComp.getFirstProperty("X-NSCP-WCAP-SESSION-ID");
                    if (!prop) {
                        throw new Components.Exception("missing X-NSCP-WCAP-SESSION-ID in\n" + str);
                    }
                    sessionId = prop.value;
                    prop = icalRootComp.getFirstProperty("X-NSCP-RECURRENCE-BOUND");
                    if (prop) {
                        var val = parseInt(prop.value);
                        if (!isNaN(val)) {
                            this_.recurrenceBound = val;
                            log("X-NSCP-RECURRENCE-BOUND:" + this_.recurrenceBound);
                        }
                    }
                    log("login succeeded: " + sessionId, this_);
                } catch (exc) {
                    err = exc;
                    if (checkErrorCode(err, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                        log("error: " + errorToString(exc), this_); // log login failure
                    } else if (getErrorModule(err) == NS_ERROR_MODULE_NETWORK) {
                        // server seems unavailable:
                        err = new Components.Exception(calGetString("wcap", "accessingServerFailedError.text",
                                                                    [this_.sessionUri.hostPort]), exc);
                    }
                }
                respFunc(err, sessionId);
            },
            this_.sessionUri.spec + "login.wcap?fmt-out=text%2Fcalendar&user=" +
            encodeURIComponent(user) + "&password=" + encodeURIComponent(pw),
            false /* no logging */);
    },

    logout: function calWcapSession_logout(listener) {
        var this_ = this;
        var request = new calWcapRequest(
            function logout_resp(request, err) {
                if (err) {
                    logError(err, this_);
                } else {
                    log("logout succeeded.", this_);
                }
                if (listener) {
                    listener.onResult(request, null);
                }
            },
            log("logout", this));

        var url = null;
        if (this.m_sessionId) {
            log("attempting to log out...", this);
            // although io service's offline flag is already
            // set BEFORE notification
            // (about to go offline, nsIOService.cpp).
            // WTF.
            url = (this.sessionUri.spec + "logout.wcap?fmt-out=text%2Fxml&id=" + this.m_sessionId);
            this.m_sessionId = null;
            getFreeBusyService().removeProvider(this);
            getCalendarSearchService().removeProvider(this);
        }
        this.m_credentials = null;

        if (url) {
            issueNetworkRequest(request,
                                function netResp(err, str) {
                                    if (err) {
                                        throw err;
                                    }
                                    stringToXml(this_, str, -1 /* logout successfull */);
                                }, url);
        } else {
            request.execRespFunc();
        }
        return request;
    },

    checkServerVersion: function calWcapSession_checkServerVersion(request, respFunc) {
        // currently, xml parsing at an early stage during process startup
        // does not work reliably, so use libical:
        var this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                try {
                    var icalRootComp;
                    if (!err) {
                        try {
                            icalRootComp = stringToIcal(this_, str);
                        } catch (exc) {
                            err = exc;
                        }
                    }
                    if (err) {
                        if (checkErrorCode(err, calIErrors.OPERATION_CANCELLED)) {
                            throw err;
                        } else { // soft error; request denied etc.
                                 // map into localized message:
                            throw new Components.Exception(calGetString("wcap", "accessingServerFailedError.text",
                                                                        [this_.sessionUri.hostPort]),
                                                           calIWcapErrors.WCAP_LOGIN_FAILED);
                        }
                    }
                    var prop = icalRootComp.getFirstProperty("X-NSCP-WCAPVERSION");
                    if (!prop) {
                        throw new Components.Exception("missing X-NSCP-WCAPVERSION!");
                    }
                    var wcapVersion = parseInt(prop.value);
                    if (wcapVersion < 3) {
                        var strVers = prop.value;
                        var vars = [this_.sessionUri.hostPort];
                        prop = icalRootComp.getFirstProperty("PRODID");
                        vars.push(prop ? prop.value : "<unknown>");
                        prop = icalRootComp.getFirstProperty("X-NSCP-SERVERVERSION");
                        vars.push(prop ? prop.value : "<unknown>");
                        vars.push(strVers);

                        var prompt = getWindowWatcher().getNewPrompter(null);
                        var labelText = calGetString("wcap", "insufficientWcapVersionConfirmation.label");
                        if (!prompt.confirm(labelText,
                                            calGetString("wcap", "insufficientWcapVersionConfirmation.text", vars))) {
                            throw new Components.Exception(labelText, calIWcapErrors.WCAP_LOGIN_FAILED);
                        }
                    }

                } catch (exc) {
                    err = exc;
                }
                respFunc(err);
            },
            this_.sessionUri.spec + "version.wcap?fmt-out=text%2Fcalendar");
    },

    setupSession: function calWcapSession_setupSession(sessionId, request_, respFunc) {
        var this_ = this;
        var request = new calWcapRequest(
            function setupSession_resp(request_, err) {
                log("setupSession_resp finished: " + errorToString(err), this_);
                respFunc(err);
            },
            log("setupSession", this));
        if (request_) {
            request_.attachSubRequest(request);
        }

        request.lockPending();
        try {
            var this_ = this;
            this.issueNetworkRequest_(
                request,
                function userprefs_resp(err, data) {
                    if (err)
                        throw err;
                    this_.credentials.userPrefs = data;
                    log("installed user prefs.", this_);

                    // get calprops for all registered calendars:                        
                    var cals = this_.getRegisteredCalendars(true);

                    var calprops_resp = null;
                    var defaultCal = this_.defaultCalendar;
                    if (defaultCal && cals[defaultCal.calId] && // default calendar is registered
                        getPref("calendar.wcap.subscriptions", true) &&
                        !defaultCal.getProperty("subscriptions_registered")) {

                        var hasSubscriptions = false;
                        // post register subscribed calendars:
                        var list = this_.getUserPreferences("X-NSCP-WCAP-PREF-icsSubscribed");
                        for each (var item in list) {
                            var ar = item.split(',');
                            // ',', '$' are not encoded. ',' can be handled here. WTF.
                            for each (var a in ar) {
                                var dollar = a.indexOf('$');
                                if (dollar >= 0) {
                                    var calId = a.substring(0, dollar);
                                    if (calId != this_.defaultCalId) {
                                        cals[calId] = null;
                                        hasSubscriptions = true;
                                    }
                                }
                            }
                        }

                        if (hasSubscriptions) {
                            calprops_resp = function(cal) {
                                if (cal.isDefaultCalendar) {
                                    // tweak name:
                                    cal.setProperty("name", cal.displayName);
                                } else {
                                    log("registering subscribed calendar: " + cal.calId, this_);
                                    getCalendarManager().registerCalendar(cal);
                                }
                            }
                            // do only once:
                            defaultCal.setProperty("subscriptions_registered", true);
                        }
                    }

                    if (!defaultCal.getProperty("user_id")) { // nail once:
                        defaultCal.setProperty("user_id", this_.credentials.userId);
                    }

                    if (getPref("calendar.wcap.no_get_calprops", false)) {
                        // hack around the get/search calprops mess:
                        this_.installCalProps_search_calprops(calprops_resp, sessionId, cals, request);
                    } else {
                        this_.installCalProps_get_calprops(calprops_resp, sessionId, cals, request);
                    }
                },
                stringToXml, "get_userprefs",
                "&fmt-out=text%2Fxml&userid=" + encodeURIComponent(this.credentials.userId),
                sessionId);
            this.installServerTimeDiff(sessionId, request);
            this.installServerTimezones(sessionId, request);

        } finally {
            request.unlockPending();
        }
    },
    
    installCalProps_get_calprops:
    function calWcapSession_installCalProps_get_calprops(respFunc, sessionId, cals, request) {

        var this_ = this;
        function calprops_resp(err, data) {
            if (err) {
                throw err;
            }
            // string to xml converter func without WCAP errno check:
            if (!data || data.length == 0) { // assuming time-out
                throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                               calIWcapErrors.WCAP_LOGIN_FAILED);
            }
            var xml = getDomParser().parseFromString(data, "text/xml");
            var nodeList = xml.getElementsByTagName("iCal");
            for (var i = 0; i < nodeList.length; ++i) {
                try {
                    var node = nodeList.item(i);
                    checkWcapXmlErrno(node);
                    var ar = filterXmlNodes("X-NSCP-CALPROPS-RELATIVE-CALID", node);
                    if (ar.length > 0) {
                        var calId = ar[0];
                        var cal = cals[calId];
                        if (cal === null) {
                            cal = new calWcapCalendar(this_);
                            var uri = this_.uri.clone();
                            uri.path += ("?calid=" + encodeURIComponent(calId));
                            cal.uri = uri;
                        }
                        if (cal) {
                            cal.m_calProps = node;
                            if (respFunc) {
                                respFunc(cal);
                            }
                        }
                    }

                } catch (exc) { // ignore but log any errors on subscribed calendars:
                    logError(exc, this_);
                }
            }
        }

        var calidParam = "";
        for (var calId in cals) {
            if (calidParam.length > 0) {
                calidParam += ";";
            }
            calidParam += encodeURIComponent(calId);
        }
        this_.issueNetworkRequest_(request, calprops_resp,
                                   null, "get_calprops",
                                   "&fmt-out=text%2Fxml&calid=" + calidParam,
                                   sessionId);
    },

    installCalProps_search_calprops:
    function calWcapSession_installCalProps_search_calprops(respFunc, sessionId, cals, request) {
        var this_ = this;
        var retrievedCals = {};
        var issuedSearchRequests = {};
        for (var calId in cals) {
            if (!retrievedCals[calId]) {
                var listener = {
                    onResult: function search_onResult(request, result) {
                        try {
                            if (!Components.isSuccessCode(request.status)) {
                                throw request.status;
                            }
                            if (result.length < 1) {
                                throw Components.results.NS_ERROR_UNEXPECTED;
                            }
                            for each (var cal in result) {
                                // user may have dangling users referred in his subscription list, so
                                // retrieve each by each, don't break:
                                try {
                                    var calId = cal.calId;
                                    if ((cals[calId] !== undefined) && !retrievedCals[calId]) {
                                        retrievedCals[calId] = cal;
                                        if (respFunc) {
                                            respFunc(cal);
                                        }
                                    }
                                }
                                catch (exc) { // ignore but log any errors on subscribed calendars:
                                    logError(exc, this_);
                                }
                            }
                        } catch (exc) { // ignore but log any errors on subscribed calendars:
                            logError(exc, this_);
                        }
                    }
                };

                var colon = calId.indexOf(':');
                if (colon >= 0) { // searching for secondary calendars doesn't work. WTF.
                    calId = calId.substring(0, colon);
                }
                if (!issuedSearchRequests[calId]) {
                    issuedSearchRequests[calId] = true;
                    this.searchForCalendars(calId, calICalendarSearchProvider.HINT_EXACT_MATCH, 20, listener);
                }
            }
        }
    },

    installServerTimeDiff: function calWcapSession_installServerTimeDiff(sessionId, request) {
        var this_ = this;
        this.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err) {
                    throw err;
                }
                // xxx todo: think about
                // assure that locally calculated server time is smaller
                // than the current (real) server time:
                var localTime = getTime();
                var serverTime = getDatetimeFromIcalProp(data.getFirstProperty("X-NSCP-WCAPTIME"));
                this_.m_serverTimeDiff = serverTime.subtractDate(localTime);
                log("server time diff is: " + this_.m_serverTimeDiff, this_);
            },
            stringToIcal, "gettime", "&fmt-out=text%2Fcalendar",
            sessionId);
    },

    installServerTimezones: function calWcapSession_installServerTimezones(sessionId, request) {
        this.m_serverTimezones = {};
        var this_ = this;
        this_.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err) {
                    throw err;
                }
                forEachIcalComponent(
                    data, "VTIMEZONE",
                    function eachComp(subComp) {
                        try {
                            var tzid = subComp.getFirstProperty("TZID").value;
                            this_.m_serverTimezones[tzid] = new calWcapTimezone(this_, tzid, subComp);
                        } catch (exc) { // ignore but errors:
                            logError(exc, this_);
                        }
                    });
                log("installed timezones.", this_);
            },
            stringToIcal, "get_all_timezones", "&fmt-out=text%2Fcalendar",
            sessionId);
    },

    getCommandUrl: function calWcapSession_getCommandUrl(wcapCommand, params, sessionId) {
        var url = this.sessionUri.spec;
        url += (wcapCommand + ".wcap?appid=mozilla-calendar&id=");
        url += sessionId;
        url += params;
        return url;
    },

    issueNetworkRequest: function calWcapSession_issueNetworkRequest(
        request, respFunc, dataConvFunc, wcapCommand, params) {

        var this_ = this;
        function getSessionId_resp(err, sessionId) {
            if (err) {
                request.execSubRespFunc(respFunc, err);
            } else {
                // else have session uri and id:
                this_.issueNetworkRequest_(
                    request,
                    function issueNetworkRequest_resp(err, data) {
                        // timeout?
                        if (checkErrorCode(err, calIWcapErrors.WCAP_LOGIN_FAILED)) {
                            // try again:
                            this_.getSessionId(
                                request,
                                getSessionId_resp,
                                sessionId/* (old) timed-out session */);
                            return;
                        }
                        request.execSubRespFunc(respFunc, err, data);
                    },
                    dataConvFunc, wcapCommand, params, sessionId);
            }
        }
        this.getSessionId(request, getSessionId_resp);
    },

    issueNetworkRequest_: function calWcapSession_issueNetworkRequest_(
        request, respFunc, dataConvFunc, wcapCommand, params, sessionId) {

        var url = this.getCommandUrl(wcapCommand, params, sessionId);
        var this_ = this;
        issueNetworkRequest(request,
                            function netResp(err, str) {
                                var data;
                                if (!err) {
                                    try {
                                        if (dataConvFunc)
                                            data = dataConvFunc(this_, str);
                                        else
                                            data = str;
                                    } catch (exc) {
                                        err = exc;
                                    }
                                }
                                request.execSubRespFunc(respFunc, err, data);
                            }, url);
    },

    m_credentials: null,
    get credentials calWcapSession_credentialsGetter() {
        if (!this.m_credentials) {
            this.m_credentials = {};
        }
        return this.m_credentials;
    },

    // calIWcapSession:

    m_contextId: null,
    m_uri: null,
    m_sessionUri: null,
    get uri calWcapSession_uriGetter() {
        return this.m_uri;
    },
    get sessionUri calWcapSession_sessionUriGetter() {
        return this.m_sessionUri;
    },

    get userId calWcapSession_userIdGetter() {
        return this.credentials.userId;
    },

    get defaultCalId calWcapSession_defaultCalIdGetter() {
        var list = this.getUserPreferences("X-NSCP-WCAP-PREF-icsCalendar");
        var id = null;
        for each (var item in list) {
            if (item.length > 0) {
                id = item;
                break;
            }
        }
        return (id ? id : this.credentials.userId);
    },

    get isLoggedIn calWcapSession_isLoggedInGetter() {
        return (this.m_sessionId != null);
    },

    defaultCalendar: null,

    belongsTo: function calWcapSession_belongsTo(cal) {
        try {
            // xxx todo hack to get the unwrapped wcap calendar instance:
            cal = cal.getProperty("cache.uncachedCalendar").QueryInterface(calIWcapCalendar).wrappedJSObject;
            if (cal && (cal.session.m_contextId == this.m_contextId)) {
                return cal;
            }
        } catch (exc) {
        }
        return null;
    },

    getRegisteredCalendars: function calWcapSession_getRegisteredCalendars(asAssocObj) {
        var registeredCalendars = (asAssocObj ? {} : []);
        var cals = getCalendarManager().getCalendars({});
        for each (var cal in cals) {
            cal = this.belongsTo(cal);
            if (cal) {
                if (asAssocObj) {
                    registeredCalendars[cal.calId] = cal;
                } else {
                    registeredCalendars.push(cal);
                }
            }
        }
        return registeredCalendars;
    },

    getUserPreferences: function calWcapSession_getUserPreferences(prefName) {
        var prefs = filterXmlNodes(prefName, this.credentials.userPrefs);
        return prefs;
    },

    get defaultAlarmStart calWcapSession_defaultAlarmStartGetter() {
        var alarmStart = null;
        var ar = this.getUserPreferences("X-NSCP-WCAP-PREF-ceDefaultAlarmStart");
        if (ar.length > 0 && ar[0].length > 0) {
            // workarounding cs duration bug, missing "T":
            var dur = ar[0].replace(/(^P)(\d+[HMS]$)/, "$1T$2");
            alarmStart = new CalDuration();
            alarmStart.icalString = dur;
            alarmStart.isNegative = !alarmStart.isNegative;
        }
        return alarmStart;
    },

    getDefaultAlarmEmails: function calWcapSession_getDefaultAlarmEmails(out_count) {
        var ret = [];
        var ar = this.getUserPreferences("X-NSCP-WCAP-PREF-ceDefaultAlarmEmail");
        if (ar.length > 0 && ar[0].length > 0) {
            for each (var i in ar) {
                ret = ret.concat( i.split(/[;,]/).map(trimString) );
            }
        }
        out_count.value = ret.length;
        return ret;
    },

    // calICalendarSearchProvider:
    searchForCalendars:
    function calWcapSession_searchForCalendars(searchString, hints, maxResults, listener) {
        var this_ = this;
        var request = new calWcapRequest(
            function searchForCalendars_resp(request, err, data) {
                if (err && !checkErrorCode(err, calIErrors.OPERATION_CANCELLED)) {
                    this_.notifyError(err);
                }
                if (listener) {
                    listener.onResult(request, data);
                }
            },
            log("searchForCalendars, searchString=" + searchString, this));

        try {
            var registeredCalendars = this.getRegisteredCalendars(true);

            var params = ("&fmt-out=text%2Fxml&search-string=" + encodeURIComponent(searchString));
            if (maxResults > 0) {
                params += ("&maxResults=" + maxResults);
            }
            params += ("&name=1&calid=1&primaryOwner=1&searchOpts=" +
                       ((hints & calICalendarSearchProvider.HINT_EXACT_MATCH) ? "3" : "0"));

            this.issueNetworkRequest(
                request,
                function searchForCalendars_netResp(err, data) {
                    if (err) {
                        throw err;
                    }
                    // string to xml converter func without WCAP errno check:
                    if (!data || data.length == 0) { // assuming time-out
                        throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                                       calIWcapErrors.WCAP_LOGIN_FAILED);
                    }
                    var xml = getDomParser().parseFromString(data, "text/xml");
                    var ret = [];
                    var nodeList = xml.getElementsByTagName("iCal");
                    for (var i = 0; i < nodeList.length; ++i) {
                        var node = nodeList.item(i);
                        try {
                            checkWcapXmlErrno(node);
                            var ar = filterXmlNodes("X-NSCP-CALPROPS-RELATIVE-CALID", node);
                            if (ar.length > 0) {
                                var calId = ar[0];
                                var cal = registeredCalendars[calId];
                                if (cal) {
                                    cal.m_calProps = node; // update calprops
                                } else {
                                    cal = new calWcapCalendar(this_, node);
                                    var uri = this_.uri.clone();
                                    uri.path += ("?calid=" + encodeURIComponent(calId));
                                    cal.uri = uri;
                                }
                                ret.push(cal);
                            }
                        } catch (exc) {
                            switch (getResultCode(exc)) {
                                case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                                case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                                    log("searchForCalendars_netResp() ignored error: " + errorToString(exc), this_);
                                    break;
                                default:
                                    this_.notifyError(exc);
                                    break;
                            }
                        }
                    }
                    log("search done. number of found calendars: " + ret.length, this_);
                    request.execRespFunc(null, ret);
                },
                null, "search_calprops", params);

        } catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },

    // calIFreeBusyProvider:
    getFreeBusyIntervals:
    function calWcapCalendar_getFreeBusyIntervals(calId, rangeStart, rangeEnd, busyTypes, listener) {
        rangeStart = ensureDateTime(rangeStart);
        rangeEnd = ensureDateTime(rangeEnd);
        var zRangeStart = getIcalUTC(rangeStart);
        var zRangeEnd = getIcalUTC(rangeEnd);

        var this_ = this;
        var request = new calWcapRequest(
            function _resp(request, err, data) {
                var rc = getResultCode(err);
                switch (rc) {
                    case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                    case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                    case calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST:
                        log("getFreeBusyIntervals_resp() error: " + errorToString(err), this_);
                        break;
                    default:
                        if (!Components.isSuccessCode(rc)) {
                            this_.notifyError(err);
                        }
                        break;
                }
                if (listener) {
                    listener.onResult(request, data);
                }
            },
            log("getFreeBusyIntervals():\n\tcalId=" + calId +
                "\n\trangeStart=" + zRangeStart + ",\n\trangeEnd=" + zRangeEnd, this));

        try {
            var params = ("&calid=" + encodeURIComponent(calId));
            params += ("&busyonly=" + ((busyTypes & calIFreeBusyInterval.FREE) ? "0" : "1"));
            params += ("&dtstart=" + zRangeStart);
            params += ("&dtend=" + zRangeEnd);
            params += "&fmt-out=text%2Fxml";

            // cannot use stringToXml here, because cs 6.3 returns plain nothing
            // on invalid user freebusy requests. WTF.
            function stringToXml_(session, data) {
                if (!data || data.length == 0) { // assuming invalid user
                    throw new Components.Exception(errorToString(calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST),
                                                   calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST);
                }
                return stringToXml(session, data);
            }
            this.issueNetworkRequest(
                request,
                function net_resp(err, xml) {
                    if (err) {
                        throw err;
                    }
                    if (LOG_LEVEL > 0) {
                        log("getFreeBusyIntervals net_resp(): " +
                            getWcapRequestStatusString(xml), this_);
                    }
                    if (listener) {
                        var ret = [];
                        var nodeList = xml.getElementsByTagName("FB");

                        var fbTypeMap = {};
                        fbTypeMap["FREE"] = calIFreeBusyInterval.FREE;
                        fbTypeMap["BUSY"] = calIFreeBusyInterval.BUSY;
                        fbTypeMap["BUSY-UNAVAILABLE"] = calIFreeBusyInterval.BUSY_UNAVAILABLE;
                        fbTypeMap["BUSY-TENTATIVE"] = calIFreeBusyInterval.BUSY_TENTATIVE;

                        for (var i = 0; i < nodeList.length; ++i) {
                            var node = nodeList.item(i);
                            var fbType = fbTypeMap[node.attributes.getNamedItem("FBTYPE").nodeValue];
                            if (!fbType || (fbType & busyTypes)) {
                                if (!fbType) {
                                    fbType = calIFreeBusyInterval.UNKNOWN;
                                }
                                var str = node.textContent;
                                var slash = str.indexOf('/');
                                var start =  getDatetimeFromIcalString(str.substr(0, slash));
                                var end =  getDatetimeFromIcalString(str.substr(slash + 1));

                                ret.push(new calFreeBusyInterval(calId, fbType, start, end));
                            }
                        }
                        request.execRespFunc(null, ret);
                    }
                },
                stringToXml_, "get_freebusy", params);

        } catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },

    // nsIObserver:
    observe: function calWcapSession_observer(subject, topic, data) {
        log("observing: " + topic + ", data: " + data, this);
        if (topic == "quit-application") {
            g_bShutdown = true;
            this.logout(null);
            // xxx todo: valid upon notification?
            getCalendarManager().removeObserver(this);
            var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                            .getService(Components.interfaces.nsIObserverService);
            observerService.removeObserver(this, "quit-application");
        }
    },

    // calICalendarManagerObserver:

    // called after the calendar is registered
    onCalendarRegistered: function calWcapSession_onCalendarRegistered(cal) {
        try {
            // make sure the calendar belongs to this session:
            if (this.belongsTo(cal)) {

                function assureDefault(pref, val) {
                    if (cal.getProperty(pref) === null) {
                        cal.setProperty(pref, val);
                    }
                }

                assureDefault("shared_context", this.m_contextId);
                assureDefault("name", cal.name);

                const s_colors = ["#FFCCCC", "#FFCC99", "#FFFF99", "#FFFFCC", "#99FF99",
                                  "#99FFFF", "#CCFFFF", "#CCCCFF", "#FFCCFF", "#FF6666",
                                  "#FF9966", "#FFFF66", "#FFFF33", "#66FF99", "#33FFFF",
                                  "#66FFFF", "#9999FF", "#FF99FF", "#FF0000", "#FF9900",
                                  "#FFCC66", "#FFFF00", "#33FF33", "#66CCCC", "#33CCFF",
                                  "#6666CC", "#CC66CC", "#CC0000", "#FF6600", "#FFCC33",
                                  "#FFCC00", "#33CC00", "#00CCCC", "#3366FF", "#6633FF",
                                  "#CC33CC", "#990000", "#CC6600", "#CC9933", "#999900",
                                  "#009900", "#339999", "#3333FF", "#6600CC", "#993399",
                                  "#660000", "#993300", "#996633", "#666600", "#006600",
                                  "#336666", "#000099", "#333399", "#663366", "#330000",
                                  "#663300", "#663333", "#333300", "#003300", "#003333",
                                  "#000066", "#330099", "#330033"];
                assureDefault("color", s_colors[(new Date()).getUTCMilliseconds() % s_colors.length]);
            }
        } catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },

    // called before the unregister actually takes place
    onCalendarUnregistering: function calWcapSession_onCalendarUnregistering(cal) {
        try {
            // make sure the calendar belongs to this session and is the default calendar,
            // then remove all subscribed calendars:
            cal = this.belongsTo(cal);
            if (cal && cal.isDefaultCalendar) {
                getFreeBusyService().removeProvider(this);
                getCalendarSearchService().removeProvider(this);
                var registeredCalendars = this.getRegisteredCalendars();
                for each (var regCal in registeredCalendars) {
                    try {
                        if (!regCal.isDefaultCalendar) {
                            getCalendarManager().unregisterCalendar(regCal);
                        }
                    } catch (exc) {
                        this.notifyError(exc);
                    }
                }
            }
        } catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },

    // called before the delete actually takes place
    onCalendarDeleting: function calWcapSession_onCalendarDeleting(cal) {
    }
};

function confirmInsecureLogin(uri)
{
    if (!confirmInsecureLogin.m_confirmedHttpLogins) {
        confirmInsecureLogin.m_confirmedHttpLogins = {};
        var confirmedHttpLogins = getPref("calendar.wcap.confirmed_http_logins", "");
        var tuples = confirmedHttpLogins.split(',');
        for each (var tuple in tuples) {
            var ar = tuple.split(':');
            confirmInsecureLogin.m_confirmedHttpLogins[ar[0]] = ar[1];
        }
    }

    var bConfirmed = false;

    var host = uri.hostPort;
    var encodedHost = encodeURIComponent(host);
    var confirmedEntry = confirmInsecureLogin.m_confirmedHttpLogins[encodedHost];
    if (confirmedEntry) {
        bConfirmed = (confirmedEntry == "1");
    } else {
        var prompt = getWindowWatcher().getNewPrompter(null);
        var out_dontAskAgain = { value: false };
        var bConfirmed = prompt.confirmCheck(
            calGetString("wcap", "noHttpsConfirmation.label"),
            calGetString("wcap", "noHttpsConfirmation.text", [host]),
            calGetString("wcap", "noHttpsConfirmation.check.text"),
            out_dontAskAgain);

        if (out_dontAskAgain.value) {
            // save decision for all running calendars and
            // all future confirmations:
            var confirmedHttpLogins = getPref("calendar.wcap.confirmed_http_logins", "");
            if (confirmedHttpLogins.length > 0) {
                confirmedHttpLogins += ",";
            }
            confirmedEntry = (bConfirmed ? "1" : "0");
            confirmedHttpLogins += (encodedHost + ":" + confirmedEntry);
            setPref("calendar.wcap.confirmed_http_logins", "CHAR", confirmedHttpLogins);
            getPref("calendar.wcap.confirmed_http_logins"); // log written entry
            confirmInsecureLogin.m_confirmedHttpLogins[encodedHost] = confirmedEntry;
        }
    }

    log("returned: " + bConfirmed, "confirmInsecureLogin(" + host + ")");
    return bConfirmed;
}

