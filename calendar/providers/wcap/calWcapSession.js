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

var g_openSessions = {};
function getWcapSessionFor(cal, uri) {
    var contextId = getCalendarManager().getCalendarPref(cal, "shared_context");
    if (!contextId) {
        contextId = getUUID();
    }
    var session = g_openSessions[contextId];
    if (!session) {
        session = new calWcapSession(contextId, uri);
        g_openSessions[contextId] = session;
    }
    if (!session.defaultCalendar && cal.isDefaultCalendar) {
        session.defaultCalendar = cal;
    }
    return session;
}

function calWcapSession(contextId, thatUri) {
    this.wrappedJSObject = this;
    this.m_contextId = contextId;
    this.m_observers = [];
    this.m_loginQueue = [];

    this.m_uri = thatUri.clone();
    this.m_sessionUri = thatUri.clone();
    this.m_sessionUri.userPass = "";
    // sensible default for user id login:
    var username = decodeURIComponent(thatUri.username);
    if (username.length > 0)
        this.credentials.userId = username;
    log("new session", this);

    // listen for shutdown, being logged out:
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, "quit-application", false /* don't hold weakly */);
    getCalendarManager().addObserver(this);
}
calWcapSession.prototype = {
    m_ifaces: [ calIWcapSession,
                calIFreeBusyProvider,
                Components.interfaces.calICalendarManagerObserver,
                Components.interfaces.nsIInterfaceRequestor,
                Components.interfaces.nsIClassInfo,
                nsISupports ],
    
    // nsISupports:
    QueryInterface: function calWcapSession_QueryInterface(iid) {
        ensureIID(this.m_ifaces, iid); // throws
        return this;
    },
    
    // nsIClassInfo:
    getInterfaces: function calWcapSession_getInterfaces(count)
    {
        count.value = this.m_ifaces.length;
        return this.m_ifaces;
    },
    get classDescription() {
        return calWcapCalendarModule.WcapSessionInfo.classDescription;
    },
    get contractID() {
        return calWcapCalendarModule.WcapSessionInfo.contractID;
    },
    get classID() {
        return calWcapCalendarModule.WcapSessionInfo.classID;
    },
    getHelperForLanguage:
    function calWcapSession_getHelperForLanguage(language) { return null; },
    implementationLanguage:
    Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,
    
    // nsIInterfaceRequestor:
    getInterface: function calWcapSession_getInterface(iid, instance) {
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
    
    toString: function calWcapSession_toString(msg)
    {
        var str = ("context-id: " + this.m_contextId + ", uri: " + this.uri.spec);
        if (this.credentials.userId) {
            str += (", userId=" + this.credentials.userId);
        }
        if (!this.m_sessionId) {
            str += (getIoService().offline ? ", offline" : ", not logged in");
        }
        return str;
    },
    notifyError: function calWcapSession_notifyError(err, suppressOnError)
    {
        if (getResultCode(err) == calIErrors.OPERATION_CANCELLED) {
            return;
        }
        debugger;
        var msg = logError(err, this);
        if (!suppressOnError && this.defaultCalendar) {
            // xxx todo: currently takes observer bag of default calendar (which is always present):
            this.defaultCalendar.notifyObservers(
                "onError",
                err instanceof Components.interfaces.nsIException
                ? [err.result, err.message] : [isNaN(err) ? -1 : err, msg]);
        }
    },

    m_serverTimezones: null,
    isSupportedTimezone: function calWcapSession_isSupportedTimezone(tzid)
    {
        if (!this.m_serverTimezones) {
            throw new Components.Exception(
                "early run into getSupportedTimezones()!",
                Components.results.NS_ERROR_NOT_AVAILABLE);
        }
        return this.m_serverTimezones.some(
            function someFunc(id) { return tzid == id; } );
    },
    
    m_serverTimeDiff: null,
    getServerTime: function calWcapSession_getServerTime(localTime)
    {
        if (this.m_serverTimeDiff === null) {
            throw new Components.Exception(
                "early run into getServerTime()!",
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
    function calWcapSession_getSessionId(request, respFunc, timedOutSessionId)
    {
        if (getIoService().offline) {
            log("in offline mode.", this);
            respFunc(new Components.Exception(
                         "The requested action could not be completed while the " +
                         "networking library is in the offline state.",
                         NS_ERROR_OFFLINE));
            return;
        }
        
        log("login queue lock: " + this.m_loginLock +
            ", length: " + this.m_loginQueue.length, this);
        
        if (this.m_loginLock) {
            this.m_loginQueue.push(respFunc);
            log("login queue: " + this.m_loginQueue.length);
        }
        else {
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
            }
            
            var this_ = this;
            this.getSessionId_(
                request,
                function getSessionId_resp(err, sessionId) {
                    log("getSessionId_resp(): " + sessionId, this_);
                    if (err) {
                        this_.notifyError(err, request.suppressOnError);
                    }
                    else {
                        this_.m_sessionId = sessionId;
                        getFreeBusyService().addProvider(this_);
                    }
                    
                    var queue = this_.m_loginQueue;
                    this_.m_loginLock = false;
                    this_.m_loginQueue = [];
                    log("unlocked login queue.", this_);

                    function exec(func) {
                        try {
                            func(err, sessionId);
                        }
                        catch (exc) {
                            this_.notifyError(exc);
                        }
                    }
                    // answer first request:
                    exec(respFunc);
                    // and any remaining:
                    queue.forEach(exec);
                });
        }
    },
    
    getSessionId_: function calWcapSession_getSessionId_(request, respFunc)
    {
        var this_ = this;
        this.getLoginText(
            request,
            // probe whether server is accessible and responds login text:
            function getLoginText_resp(err, loginText) {
                if (err) {
                    respFunc(err);
                    return;
                }
                // lookup password manager, then try login or prompt/login:
                log("attempting to get a session id for " + this_.sessionUri.spec, this_);
                
                if (!this_.sessionUri.schemeIs("https") &&
                    !confirmInsecureLogin(this_.sessionUri)) {
                    log("user rejected insecure login on " + this_.sessionUri.spec, this_);
                    respFunc(new Components.Exception(
                                 "Login failed. Invalid session ID.",
                                 calIWcapErrors.WCAP_LOGIN_FAILED));
                    return;
                }
                
                var outUser = { value: this_.credentials.userId };
                var outPW = { value: this_.credentials.pw };
                var outSavePW = { value: false };
                
                // pw mgr host names must not have a trailing slash
                var passwordManager =
                    Components.classes["@mozilla.org/passwordmanager;1"]
                              .getService(Components.interfaces.nsIPasswordManager);
                var pwHost = this_.uri.spec;
                if (pwHost[pwHost.length - 1] == '/')
                    pwHost = pwHost.substr(0, pwHost.length - 1);
                
                if (!outPW.value) { // lookup pw manager
                    log("looking in pw db for: " + pwHost, this_);
                    try {
                        var enumerator = passwordManager.enumerator;
                        while (enumerator.hasMoreElements()) {
                            var pwEntry = enumerator.getNext().QueryInterface(
                                Components.interfaces.nsIPassword);
                            if (LOG_LEVEL > 1) {
                                log("pw entry:\n\thost=" + pwEntry.host +
                                    "\n\tuser=" + pwEntry.user, this_);
                            }
                            if (pwEntry.host == pwHost) {
                                // found an entry matching URI:
                                outUser.value = pwEntry.user;
                                outPW.value = pwEntry.password;
                                log("password entry found for host " + pwHost +
                                    "\nuser is " + outUser.value, this_);
                                break;
                            }
                        }
                    }
                    catch (exc) { // just log error
                        logError("[password manager lookup] " + errorToString(exc), this_);
                    }
                }
                
                function promptAndLoginLoop_resp(err, sessionId) {
                    if (getResultCode(err) == calIWcapErrors.WCAP_LOGIN_FAILED) {
                        log("prompting for user/pw...", this_);
                        var prompt = getWindowWatcher().getNewPrompter(null);
                        if (prompt.promptUsernameAndPassword(
                                calGetString("wcap", "loginDialog.label"),
                                loginText, outUser, outPW,
                                getPref("signon.rememberSignons", true)
                                ? calGetString("wcap", "loginDialog.check.text")
                                : null, outSavePW)) {
                            this_.login(request, promptAndLoginLoop_resp,
                                        outUser.value, outPW.value);
                        }
                        else {
                            log("login prompt cancelled.", this_);
                            respFunc(new Components.Exception(
                                         "Login failed. Invalid session ID.",
                                         calIWcapErrors.WCAP_LOGIN_FAILED));
                        }
                    }
                    else if (err)
                        respFunc(err);
                    else {
                        if (outSavePW.value) {
                            // so try to remove old pw from db first:
                            try {
                                passwordManager.removeUser(pwHost, outUser.value);
                                log("removed from pw db: " + pwHost, this_);
                            }
                            catch (exc) {
                            }
                            try { // to save pw under session uri:
                                passwordManager.addUser(pwHost, outUser.value, outPW.value);
                                log("added to pw db: " + pwHost, this_);
                            }
                            catch (exc) {
                                logError("[adding pw to db] " + errorToString(exc), this_);
                            }
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
                    this_.login(request, promptAndLoginLoop_resp,
                                outUser.value, outPW.value);
                }
                else {
                    promptAndLoginLoop_resp(calIWcapErrors.WCAP_LOGIN_FAILED);
                }
            });
    },
    
    login: function calWcapSession_login(request, respFunc, user, pw)
    {
        var this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                var sessionId;
                try {
                    if (err)
                        throw err;
                    // currently, xml parsing at an early stage during
                    // process startup does not work reliably, so use
                    // libical parsing for now:
                    var icalRootComp = stringToIcal(str);
                    var prop = icalRootComp.getFirstProperty("X-NSCP-WCAP-SESSION-ID");
                    if (!prop) {
                        throw new Components.Exception(
                            "missing X-NSCP-WCAP-SESSION-ID in\n" + str);
                    }
                    sessionId = prop.value;
                    log("login succeeded: " + sessionId, this_);
                }
                catch (exc) {
                    err = exc;
                    var rc = getResultCode(exc);
                    if (rc == calIWcapErrors.WCAP_LOGIN_FAILED) {
                        logError(exc, this_); // log login failure
                    }
                    else if (getErrorModule(rc) == NS_ERROR_MODULE_NETWORK) {
                        // server seems unavailable:
                        err = new Components.Exception(
                            calGetString( "wcap", "accessingServerFailedError.text",
                                          [this_.sessionUri.hostPort]),
                            exc);
                    }
                }
                respFunc(err, sessionId);
            },
            this_.sessionUri.spec + "login.wcap?fmt-out=text%2Fcalendar&user=" +
            encodeURIComponent(user) + "&password=" + encodeURIComponent(pw),
            false /* no logging */);
    },
    
    logout: function calWcapSession_logout(listener)
    {
        var this_ = this;
        var request = new calWcapRequest(
            function logout_resp(request, err) {
                if (err)
                    logError(err, this_);
                else
                    log("logout succeeded.", this_);
                if (listener)
                    listener.onResult(request, err);
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
        }
        this.m_credentials = null;
        
        if (url) {
            issueNetworkRequest(
                request,
                function netResp(err, str) {
                    if (err)
                        throw err;
                    stringToXml(str, -1 /* logout successfull */);
                }, url);
        }
        else {
            request.execRespFunc();
        }
        return request;
    },
    
    getLoginText: function calWcapSession_getLoginText(request, respFunc)
    {
        // currently, xml parsing at an early stage during process startup
        // does not work reliably, so use libical:
        var this_ = this;
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                var loginText;
                try {
                    var icalRootComp;
                    if (!err) {
                        try {
                            icalRootComp = stringToIcal(str);
                        }
                        catch (exc) {
                            err = exc;
                        }
                    }
                    if (err) { // soft error; request denied etc.
                               // map into localized message:
                        throw new Components.Exception(
                            calGetString("wcap", "accessingServerFailedError.text",
                                         [this_.sessionUri.hostPort]),
                            calIWcapErrors.WCAP_LOGIN_FAILED);
                    }
                    var prop = icalRootComp.getFirstProperty("X-NSCP-WCAPVERSION");
                    if (!prop)
                        throw new Components.Exception("missing X-NSCP-WCAPVERSION!");
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
                        var labelText = calGetString(
                            "wcap", "insufficientWcapVersionConfirmation.label");
                        if (!prompt.confirm(
                                labelText,
                                calGetString("wcap", "insufficientWcapVersionConfirmation.text", vars))) {
                            throw new Components.Exception(
                                labelText, calIWcapErrors.WCAP_LOGIN_FAILED);
                        }
                    }
                    loginText = calGetString("wcap", "loginDialog.text", [this_.sessionUri.hostPort]);
                }
                catch (exc) {
                    err = exc;
                }
                respFunc(err, loginText);
            },
            this_.sessionUri.spec + "version.wcap?fmt-out=text%2Fcalendar");
    },

    setupSession:
    function calWcapSession_setupSession(sessionId, request_, respFunc)
    {
        var this_ = this;
        var request = new calWcapRequest(
            function setupSession_resp(request_, err) {
                log("setupSession_resp finished: " + errorToString(err), this_);
                respFunc(err);
            },
            log("setupSession", this));
        request_.attachSubRequest(request);
        
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
                    var cals = this_.getRegisteredCalendars();

                    var calManager = getCalendarManager();
                    var calprops_resp = null;
                    var defaultCal = this_.defaultCalendar;
                    if (defaultCal && cals[defaultCal.calId] && // default calendar is registered
                        getPref("calendar.wcap.subscriptions", false) &&
                        !calManager.getCalendarPref(defaultCal, "subscriptions_registered")) {
                        
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
                                    calManager.setCalendarPref(cal, "name", cal.displayName);
                                }
                                else {
                                    log("registering subscribed calendar: " + cal.calId, this_);
                                    calManager.registerCalendar(cal);
                                }
                            }
                            // do only once:
                            calManager.setCalendarPref(defaultCal,
                                                       "shared_context", this_.m_contextId);
                            calManager.setCalendarPref(defaultCal,
                                                       "account_name", defaultCal.name);
                            calManager.setCalendarPref(defaultCal,
                                                       "subscriptions_registered", "1");
                        }
                    }
                    
                    if (getPref("calendar.wcap.no_get_calprops", false)) {
                        // hack around the get/search calprops mess:
                        this_.installCalProps_search_calprops(calprops_resp, sessionId, cals, request);
                    }
                    else {
                        this_.installCalProps_get_calprops(calprops_resp, sessionId, cals, request);
                    }
                },
                stringToXml, "get_userprefs",
                "&fmt-out=text%2Fxml&userid=" + encodeURIComponent(this.credentials.userId),
                sessionId);
            this.installServerTimeDiff(sessionId, request);
            this.installServerTimezones(sessionId, request);
        }
        finally {
            request.unlockPending();
        }
    },
    
    installCalProps_get_calprops:
    function calWcapSession_installCalProps_get_calprops(respFunc, sessionId, cals, request)
    {
        var this_ = this;
        function calprops_resp(err, data) {
            if (err)
                throw err;
            // string to xml converter func without WCAP errno check:
            if (!data || data.length == 0) { // assuming time-out
                throw new Components.Exception("Login failed. Invalid session ID.",
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
                }
                catch (exc) { // ignore but log any errors on subscribed calendars:
                    logError(exc, this_);
                }
            }
        }

        var calidParam = "";
        for (var calId in cals) {
            if (calidParam.length > 0)
                calidParam += ";";
            calidParam += encodeURIComponent(calId);
        }
        this_.issueNetworkRequest_(request, calprops_resp,
                                   null, "get_calprops",
                                   "&fmt-out=text%2Fxml&calid=" + calidParam,
                                   sessionId);
    },

    installCalProps_search_calprops:
    function calWcapSession_installCalProps_search_calprops(respFunc, sessionId, cals, request)
    {
        var this_ = this;
        var retrievedCals = {};
        var issuedSearchRequests = {};
        for (var calId in cals) {
            if (!retrievedCals[calId]) {
                var listener = {
                    onResult: function search_onResult(request, result) {
                        try {
                            if (!request.success)
                                throw request.status;
                            if (result.length < 1)
                                throw Components.results.NS_ERROR_UNEXPECTED;
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
                        }
                        catch (exc) { // ignore but log any errors on subscribed calendars:
                            logError(exc, this_);
                        }
                    }
                };
                
                var colon = calId.indexOf(':');
                if (colon >= 0) // searching for secondary calendars doesn't work. WTF.
                    calId = calId.substring(0, colon);
                if (!issuedSearchRequests[calId]) {
                    issuedSearchRequests[calId] = true;
                    this.searchForCalendars(
                        calId,
                        calIWcapSession.SEARCH_STRING_EXACT |
                        calIWcapSession.SEARCH_INCLUDE_CALID |
                        // else searching for secondary calendars doesn't work:
                        calIWcapSession.SEARCH_INCLUDE_OWNER,
                        20, listener);
                }
            }
        }
    },

    installServerTimeDiff:
    function calWcapSession_installServerTimeDiff(sessionId, request)
    {
        var this_ = this;
        this.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err)
                    throw err;
                // xxx todo: think about
                // assure that locally calculated server time is smaller
                // than the current (real) server time:
                var localTime = getTime();
                var serverTime = getDatetimeFromIcalProp(
                    data.getFirstProperty("X-NSCP-WCAPTIME"));
                this_.m_serverTimeDiff = serverTime.subtractDate(localTime);
                log("server time diff is: " + this_.m_serverTimeDiff, this_);
            },
            stringToIcal, "gettime", "&fmt-out=text%2Fcalendar",
            sessionId);
    },
    
    installServerTimezones:
    function calWcapSession_installServerTimezones(sessionId, request)
    {
        this.m_serverTimezones = [];
        var this_ = this;
        this_.issueNetworkRequest_(
            request,
            function netResp(err, data) {
                if (err)
                    throw err;
                var tzids = [];
                var icsService = getIcsService();
                forEachIcalComponent(
                    data, "VTIMEZONE",
                    function eachComp(subComp) {
                        try {
                            var tzCal = icsService.createIcalComponent("VCALENDAR");
                            subComp = subComp.clone();
                            tzCal.addSubcomponent(subComp);
                            icsService.addTimezone(tzCal, "", "");
                            this_.m_serverTimezones.push(
                                subComp.getFirstProperty("TZID").value);
                        }
                        catch (exc) { // ignore but errors:
                            logError(exc, this_);
                        }
                    });
                log("installed timezones.", this_);
            },
            stringToIcal, "get_all_timezones", "&fmt-out=text%2Fcalendar",
            sessionId);
    },
    
    getCommandUrl: function calWcapSession_getCommandUrl(wcapCommand, params, sessionId)
    {
        var url = this.sessionUri.spec;
        url += (wcapCommand + ".wcap?appid=mozilla-calendar&id=");
        url += sessionId;
        url += params;
        return url;
    },

    issueNetworkRequest: function calWcapSession_issueNetworkRequest(
        request, respFunc, dataConvFunc, wcapCommand, params)
    {
        var this_ = this;
        function getSessionId_resp(err, sessionId) {
            if (err)
                respFunc(err);
            else {
                // else have session uri and id:
                this_.issueNetworkRequest_(
                    request,
                    function issueNetworkRequest_resp(err, data) {
                        // timeout?
                        if (getResultCode(err) == calIWcapErrors.WCAP_LOGIN_FAILED) {
                            // try again:
                            this_.getSessionId(
                                request,
                                getSessionId_resp,
                                sessionId/* (old) timed-out session */);
                            return;
                        }
                        respFunc(err, data);
                    },
                    dataConvFunc, wcapCommand, params, sessionId);
            }
        }
        this.getSessionId(request, getSessionId_resp);
    },
    
    issueNetworkRequest_: function calWcapSession_issueNetworkRequest_(
        request, respFunc, dataConvFunc, wcapCommand, params, sessionId)
    {
        var url = this.getCommandUrl(wcapCommand, params, sessionId);
        issueNetworkRequest(
            request,
            function netResp(err, str) {
                var data;
                if (!err) {
                    try {
                        if (dataConvFunc)
                            data = dataConvFunc(str);
                        else
                            data = str;
                    }
                    catch (exc) {
                        err = exc;
                    }
                }
                respFunc(err, data);
            }, url);
    },
    
    m_credentials: null,
    get credentials() {
        if (!this.m_credentials) {
            this.m_credentials = {
                userId: "",
                pw: "",
                userPrefs: null
            };
        }
        return this.m_credentials;
    },
    
    // calIWcapSession:

    m_contextId: null,
    m_uri: null,
    m_sessionUri: null,
    get uri() { return this.m_uri; },
    get sessionUri() { return this.m_sessionUri; },
    
    get userId() { return this.credentials.userId; },
    
    get defaultCalId() {
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
    
    get isLoggedIn() {
        return (this.m_sessionId != null);
    },
    
    defaultCalendar: null,
    
    belongsTo: function calWcapSession_belongsTo(cal) {
        try {
            cal = cal.QueryInterface(calIWcapCalendar).wrappedJSObject;
            if (cal && (cal.session.m_contextId == this.m_contextId)) {
                return cal;
            }
        }
        catch (exc) {
        }
        return null;
    },

    getRegisteredCalendars: function calWcapSession_getRegisteredCalendars() {
        var registeredCalendars = {};
        var cals = getCalendarManager().getCalendars({});
        for each (var cal in cals) {
            cal = this.belongsTo(cal);
            if (cal) {
                registeredCalendars[cal.calId] = cal;
            }
        }
        return registeredCalendars;
    },

    getUserPreferences: function calWcapSession_getUserPreferences(prefName) {
        var prefs = filterXmlNodes(prefName, this.credentials.userPrefs);
        return prefs;
    },
    
    get defaultAlarmStart() {
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
    
    getDefaultAlarmEmails: function calWcapSession_getDefaultAlarmEmails(out_count)
    {
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
    
    searchForCalendars:
    function calWcapSession_searchForCalendars(searchString, searchOptions, maxResults, listener)
    {
        var this_ = this;
        var request = new calWcapRequest(
            function searchForCalendars_resp(request, err, data) {
                if (err && getResultCode(err) != calIErrors.OPERATION_CANCELLED)
                    this_.notifyError(err);
                if (listener)
                    listener.onResult(request, data);
            },
            log("searchForCalendars, searchString=" + searchString, this));
        
        try {
            var registeredCalendars = this.getRegisteredCalendars();
            
            var params = ("&fmt-out=text%2Fxml&search-string=" +
                          encodeURIComponent(searchString));
            params += ("&searchOpts=" + (searchOptions & 3).toString(10));
            if (maxResults > 0)
                params += ("&maxResults=" + maxResults);
            if (searchOptions & calIWcapSession.SEARCH_INCLUDE_CALID)
                params += "&calid=1";
            if (searchOptions & calIWcapSession.SEARCH_INCLUDE_NAME)
                params += "&name=1";
            if (searchOptions & calIWcapSession.SEARCH_INCLUDE_OWNER)
                params += "&primaryOwner=1";
            
            this.issueNetworkRequest(
                request,
                function searchForCalendars_netResp(err, data) {
                    if (err)
                        throw err;
                    // string to xml converter func without WCAP errno check:
                    if (!data || data.length == 0) { // assuming time-out
                        throw new Components.Exception("Login failed. Invalid session ID.",
                                                       calIWcapErrors.WCAP_LOGIN_FAILED);
                    }
                    var xml = getDomParser().parseFromString(data, "text/xml");
                    var ret = [];
                    var nodeList = xml.getElementsByTagName("iCal");
                    for ( var i = 0; i < nodeList.length; ++i ) {
                        var node = nodeList.item(i);
                        try {
                            checkWcapXmlErrno(node);
                            var ar = filterXmlNodes("X-NSCP-CALPROPS-RELATIVE-CALID", node);
                            if (ar.length > 0) {
                                var calId = ar[0];
                                var cal = registeredCalendars[calId];
                                if (cal) {
                                    cal.m_calProps = node; // update calprops
                                }
                                else {
                                    cal = new calWcapCalendar(this_, node);
                                    var uri = this_.uri.clone();
                                    uri.path += ("?calid=" + encodeURIComponent(calId));
                                    cal.uri = uri;
                                }
                                ret.push(cal);
                            }
                        }
                        catch (exc) {
                            switch (getResultCode(exc)) {
                            case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                            case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                                log("searchForCalendars_netResp() ignored error: " +
                                    errorToString(exc), this_);
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
        }
        catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },

    // calIFreeBusyProvider:
    getFreeBusyIntervals: function calWcapCalendar_getFreeBusyIntervals(
        calId, rangeStart, rangeEnd, busyTypes, listener)
    {
        // assure DATETIMEs:
        if (rangeStart && rangeStart.isDate) {
            rangeStart = rangeStart.clone();
            rangeStart.isDate = false;
        }
        if (rangeEnd && rangeEnd.isDate) {
            rangeEnd = rangeEnd.clone();
            rangeEnd.isDate = false;
        }
        var zRangeStart = getIcalUTC(rangeStart);
        var zRangeEnd = getIcalUTC(rangeEnd);
        
        var this_ = this;
        var request = new calWcapRequest(
            function _resp(request, err, data) {
                var rc = getResultCode(err);
                switch (rc) {
                case calIErrors.OPERATION_CANCELLED:
                case calIWcapErrors.WCAP_NO_ERRNO: // workaround
                case calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR:
                case calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST:
                    log("getFreeBusyIntervals_resp() error: " + errorToString(err), this_);
                    break;
                default:
                    if (!Components.isSuccessCode(rc))
                        this_.notifyError(err);
                    break;
                }
                if (listener)
                    listener.onResult(request, data);
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
            function stringToXml_(data) {
                if (!data || data.length == 0) { // assuming invalid user
                    throw new Components.Exception(
                        wcapErrorToString(calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST),
                        calIWcapErrors.WCAP_CALENDAR_DOES_NOT_EXIST);
                }
                return stringToXml(data);
            }
            this.issueNetworkRequest(
                request,
                function net_resp(err, xml) {
                    if (err)
                        throw err;
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
                            if (fbType & busyTypes) {
                                var str = node.textContent;
                                var slash = str.indexOf('/');
                                var period = new CalPeriod();
                                period.start = getDatetimeFromIcalString(str.substr(0, slash));
                                period.end = getDatetimeFromIcalString(str.substr(slash + 1));
                                period.makeImmutable();
                                var fbInterval = {
                                    QueryInterface: function fbInterval_QueryInterface(iid) {
                                        ensureIID([calIFreeBusyInterval, nsISupports], iid);
                                        return this;
                                    },
                                    calId: calId,
                                    interval: period,
                                    freeBusyType: fbType
                                };
                                ret.push(fbInterval);
                            }
                        }
                        request.execRespFunc(null, ret);
                    }
                },
                stringToXml_, "get_freebusy", params);
        }
        catch (exc) {
            request.execRespFunc(exc);
        }
        return request;
    },
    
    // nsIObserver:
    observe: function calWcapSession_observer(subject, topic, data)
    {
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
    onCalendarRegistered: function calWcapSession_onCalendarRegistered(cal)
    {
        try {
            // make sure the calendar belongs to this session:
            if (this.belongsTo(cal)) {

                var calManager = getCalendarManager();
                function assureDefault(pref, val) {
                    if (!calManager.getCalendarPref(cal, pref)) {
                        calManager.setCalendarPref(cal, pref, val);
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
        }
        catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },
    
    // called before the unregister actually takes place
    onCalendarUnregistering: function calWcapSession_onCalendarUnregistering(cal)
    {
        try {
            // make sure the calendar belongs to this session and is the default calendar,
            // then remove all subscribed calendars:
            cal = this.belongsTo(cal);
            if (cal && cal.isDefaultCalendar) {
                getFreeBusyService().removeProvider(this);
                var registeredCalendars = this.getRegisteredCalendars();
                for each (var regCal in registeredCalendars) {
                    try {
                        if (!regCal.isDefaultCalendar) {
                            getCalendarManager().unregisterCalendar(regCal);
                        }
                    }
                    catch (exc) {
                        this.notifyError(exc);
                    }
                }
            }
        }
        catch (exc) { // never break the listener chain
            this.notifyError(exc);
        }
    },
    
    // called before the delete actually takes place
    onCalendarDeleting: function calWcapSession_onCalendarDeleting(cal)
    {
    },
    
    // called after the pref is set
    onCalendarPrefChanged: function calWcapSession_onCalendarPrefChanged(cal, name, value, oldvalue)
    {
    },
    
    // called before the pref is deleted
    onCalendarPrefDeleting: function calWcapSession_onCalendarPrefDeleting(cal, name)
    {
    }
};

var g_confirmedHttpLogins = null;
function confirmInsecureLogin(uri)
{
    if (!g_confirmedHttpLogins) {
        g_confirmedHttpLogins = {};
        var confirmedHttpLogins = getPref(
            "calendar.wcap.confirmed_http_logins", "");
        var tuples = confirmedHttpLogins.split(',');
        for each (var tuple in tuples) {
            var ar = tuple.split(':');
            g_confirmedHttpLogins[ar[0]] = ar[1];
        }
    }
    
    var bConfirmed = false;
    
    var host = uri.hostPort;
    var encodedHost = encodeURIComponent(host);
    var confirmedEntry = g_confirmedHttpLogins[encodedHost];
    if (confirmedEntry) {
        bConfirmed = (confirmedEntry == "1");
    }
    else {
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
            if (confirmedHttpLogins.length > 0)
                confirmedHttpLogins += ",";
            confirmedEntry = (bConfirmed ? "1" : "0");
            confirmedHttpLogins += (encodedHost + ":" + confirmedEntry);
            setPref("calendar.wcap.confirmed_http_logins", "CHAR", confirmedHttpLogins);
            getPref("calendar.wcap.confirmed_http_logins"); // log written entry
            g_confirmedHttpLogins[encodedHost] = confirmedEntry;
        }
    }

    log("returned: " + bConfirmed, "confirmInsecureLogin(" + host + ")");
    return bConfirmed;
}

