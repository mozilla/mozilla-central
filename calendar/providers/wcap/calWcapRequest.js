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

/**
   A request object is used to track an async action.
   While the action is running, isPending is true.
   Functions issuing an async action usually take a response function along
   with their parameters, typically named respFunc.
   That function is called *after* the action has ended (i.e. isPending of the
   issued action/request is false when called, status remains stable).
   The response function gets the ended request as first parameter to check
   whether the request has been successful and get its data.
   The request function itself may return either
   - a further calIOperation request object, i.e. an async continuation
   - some data (incl null/undefined) which is the result of the async function,
     indicating that there is no further continuation
*/

function generateRequestId() {
    if (!generateRequestId.mRequestPrefix) {
        generateRequestId.mRequestPrefix = (getUUID() + "-");
        generateRequestId.mRequestId = 0;
    }
    ++generateRequestId.mRequestId;
    return (generateRequestId.mRequestPrefix + generateRequestId.mRequestId);
}

function calWcapRequest(respFunc, logContext) {
    this.wrappedJSObject = this;
    this.m_logContext = logContext;
    this.m_id = generateRequestId();
    this.m_isPending = true;
    this.m_status = NS_OK;
    this.m_respFunc = respFunc;
    this.m_attachedRequests = [];
}
calWcapRequest.prototype = {
    m_logContext: null,
    m_parentRequest: null,
    m_id: 0,
    m_isPending: true,
    m_status: NS_OK,
    m_respFunc: null,
    m_attachedRequests: null,
    m_locked: false,

    get parentRequest calWcapRequest_parentRequestGetter() {
        return this.m_parentRequest;
    },
    set parentRequest calWcapRequest_parentRequestSetter(req) {
        if (this.parentRequest) {
            logError("already has parent!", this);
        }
        this.detachFromParent(); // detach without error
        return (this.m_parentRequest = req);
    },

    /** The following locking is necessary when scheduling multiple async
        requests; one cannot be sure that e.g. the first completes quickly
        and responds the whole parent request when detaching.
    */
    lockPending: function calWcapRequest_lockPending() {
        this.m_locked = true;
    },
    unlockPending: function calWcapRequest_unlockPending() {
        if (this.m_locked) {
            this.m_locked = false;
            // assures that respFunc is executed:
            if (this.m_attachedRequests.length == 0) {
                this.execRespFunc();
            }
        }
    },

    toString: function calWcapRequest_toString() {
        var ret = ("calWcapRequest id=" + this.id +
                   ", parent-id=" + (this.parentRequest ? this.parentRequest.id : "<none>") +
                   " (" + this.m_logContext + ")");
        if (LOG_LEVEL > 2 && this.m_attachedRequests.length > 0) {
            ret += "\nattached requests:";
            for each (var req in this.m_attachedRequests) {
                ret += ("\n#" + req.id + "\t" + req);
            }
        }
        ret += (", isPending=" + this.isPending);
        ret += (", status=" + errorToString(this.status));
        return ret;
    },

    attachSubRequest: function calWcapRequest_attachSubRequest(req) {
        if (req) {
            if (!this.m_attachedRequests.some( function(req_) { return req.id == req_.id; } )) {
                if (req.isPending) {
                    this.m_attachedRequests.push(req);
                    req.parentRequest = this;
                    log("attachSubRequest()", this);
                } else if (!this.m_locked && this.m_attachedRequests.length == 0) {
                    this.execRespFunc(req.status);
                }
            } else {
                logError("request already attached: " + req.id, this);
            }
        }
    },

    detachSubRequest: function calWcapRequest_detachSubRequest(req, err) {
        this.m_attachedRequests = this.m_attachedRequests.filter( function(req_) { return req.id != req_.id; } );
        if (err) {
            // first failing sub request stops parent request:
            this.execRespFunc(err);
        }
        // assures that respFunc is executed after all sub requests have been completed:
        else if (!this.m_locked && this.m_attachedRequests.length == 0) {
            this.execRespFunc();
        }
    },

    cancelAllSubRequests: function calWcapRequest_cancelAllSubRequests(status) {
        var attachedRequests = this.m_attachedRequests;
        this.m_attachedRequests = [];
        attachedRequests.forEach( function(req) { req.cancel(null); } );
    },

    detachFromParent: function calWcapRequest_detachFromParent(err) {
        var parentRequest = this.m_parentRequest;
        if (parentRequest) {
            this.m_parentRequest = null;
            parentRequest.detachSubRequest(this, err);
        }
    },

    execRespFunc: function calWcapRequest_execRespFunc(err, data) {
        if (this.isPending) {
            this.m_isPending = false;
            if (err) {
                this.m_status = err;
            }
            this.cancelAllSubRequests();
            var respFunc = this.m_respFunc;
            if (respFunc) {
                this.m_respFunc = null; // call once only
                if (LOG_LEVEL > 2) {
                    log("response exec: " + errorToString(err), this);
                }
                try {
                    respFunc(this, err, data);
                } catch (exc) {
                    this.m_status = exc;
                    // don't pump into error console, may be handled:
                    log("error: " + errorToString(exc), this);
                }
            }
            this.detachFromParent(this.m_status);
        }
    },

    execSubRespFunc: function calWcapRequest_execSubRespFunc(func, err, data) {
        try {
            func(err, data);
        } catch (exc) {
            this.execRespFunc(exc);
        }
    },

    // calIOperation:
    get id calWcapRequest_idGetter() {
        return this.m_id;
    },
    get isPending calWcapRequest_isPendingGetter() {
        return this.m_isPending;
    },
    get status calWcapRequest_statusGetter() {
        return (this.m_status === null ? NS_OK : this.m_status);
    },

    cancel: function calWcapRequest_cancel(status) {
        if (!status) {
            status = calIErrors.OPERATION_CANCELLED;
        }
        this.execRespFunc(status);
    }
};

function calWcapNetworkRequest(url, respFunc, bLogging) {
    this.wrappedJSObject = this;
    this.m_id = generateRequestId();
    this.m_url = url;
    this.m_respFunc = respFunc;
    this.m_bLogging = (bLogging === undefined ? true : bLogging);
}
calWcapNetworkRequest.prototype = {
    m_id: 0,
    m_url: null,
    m_loader: null,
    m_respFunc: null,
    m_bLogging: false,

    QueryInterface: function calWcapNetworkRequest_QueryInterface(iid) {
        return doQueryInterface(this, calWcapNetworkRequest.prototype, iid, null, g_classInfo.wcapNetworkRequest);
    },

    /**
     * @see nsIInterfaceRequestor
     * @see calProviderUtils.js
     */
    getInterface: calInterfaceRequestor_getInterface,

    /**
     * prepareChannel
     * Prepares the passed channel to match this objects properties
     *
     * @param aChannel    The Channel to be prepared
     */
    prepareChannel: function calWcapNetworkRequest_prepareChannel(aChannel) {
        // No caching
        aChannel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
        aChannel = aChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
        aChannel.requestMethod = "GET";
    },

    /**
     * @see nsIChannelEventSink
     */
    onChannelRedirect: function calWcapNetworkRequest_onChannelRedirect(aOldChannel,
                                                                        aNewChannel,
                                                                        aFlags) {
        // all we need to do to the new channel is the basic preparation
        this.prepareChannel(aNewChannel);
    },

    /**
     * @see nsIUnicharStreamLoaderObserver
     */
    onDetermineCharset: function calWcapNetworkRequest_onDetermineCharset(loader,
                                                                          context,
                                                                          firstSegment,
                                                                          length) {
        var channel = null;
        if (loader) {
            channel = loader.channel;
        }
        var charset = null;
        if (channel) {
            charset = channel.contentCharset;
        }
        if (!charset || charset.length == 0) {
            charset = "UTF-8";
        }
        return charset;
    },

    /**
     * @see nsIUnicharStreamLoaderObserver
     */
    onStreamComplete: function calWcapNetworkRequest_onStreamComplete(aLoader,
                                                                      aContext,
                                                                      aStatus,
                                                                      /* nsIUnicharInputStream */ unicharData) {
        this.m_loader = null;

        if (LOG_LEVEL > 0 && this.m_bLogging) {
            log("status: " + errorToString(aStatus), this);
        }
        if (aStatus != Components.results.NS_OK) {
            this.execRespFunc(aStatus);
            return;
        }

        var result = "";
        try {
            if (unicharData) {
                var str_ = {};
                while (unicharData.readString(-1, str_)) {
                    result += str_.value;
                }
            }
            if (LOG_LEVEL > 2 && this.m_bLogging) {
                log("contentCharset = " + aLoader.charset + "\nrequest result:\n" + result, this);
            }
        } catch (exc) {
            this.execRespFunc(exc);
            return;
        }

        var httpChannel = aLoader.channel.QueryInterface(Components.interfaces.nsIHttpChannel);
        switch (httpChannel.responseStatus / 100) {
            case 2: /* 2xx codes */
                // Everything worked out, we are done
                this.execRespFunc(aStatus, result);
                break;
            default: {
                // Something else went wrong
                var error = ("A request Error Occurred. Status Code: " +
                             httpChannel.responseStatus + " " +
                             httpChannel.responseStatusText + " Body: " +
                             result);
                this.execRespFunc(Components.Exception(error, NS_BINDING_FAILED));
                break;
            }
        }
    },

    toString: function calWcapNetworkRequest_toString() {
        var ret = ("calWcapNetworkRequest id=" + this.id +
                   ", parent-id=" + (this.parentRequest ? this.parentRequest.id : "<none>"));
        if (this.m_bLogging) {
            ret += (" (" + this.m_url + ")");
        }
        ret += (", isPending=" + this.isPending);
        ret += (", status=" + errorToString(this.status));
        return ret;
    },

    m_parentRequest: null,
    get parentRequest calWcapNetworkRequest_parentRequestGetter() {
        return this.m_parentRequest;
    },
    set parentRequest calWcapNetworkRequest_parentRequestSetter(req) {
        if (this.parentRequest) {
            logError("already has parent!", this);
        }
        this.detachFromParent(); // detach without error
        return (this.m_parentRequest = req);
    },

    // calIOperation:
    get id calWcapNetworkRequest_idGetter() {
        return this.m_id;
    },

    m_isPending: true,
    get isPending calWcapNetworkRequest_isPendingGetter() {
        return this.m_isPending;
    },

    get status calWcapNetworkRequest_statusGetter() {
        return (this.request ? this.request.status : NS_OK);
    },

    detachFromParent: function calWcapNetworkRequest_detachFromParent(err) {
        var parentRequest = this.m_parentRequest;
        if (parentRequest) {
            this.m_parentRequest = null;
            parentRequest.detachSubRequest(this, err);
        }
    },

    get request calWcapNetworkRequest_requestGetter() {
        return (this.m_loader ? this.m_loader.channel : null);
    },

    cancel: function calWcapNetworkRequest_cancel(status) {
        if (!status) {
            status = calIErrors.OPERATION_CANCELLED;
        }
        this.execRespFunc(status);
        // xxx todo: check whether this works on redirected channels!
        var request = this.request;
        if (request && request.isPending()) {
            log("canceling netwerk request...", this);
            request.cancel(NS_BINDING_FAILED);
            this.m_loader = null;
        }
    },

    execRespFunc: function calWcapNetworkRequest_execRespFunc(err, str) {
        if (this.isPending) {
            this.m_isPending = false;
            var respFunc = this.m_respFunc;
            if (respFunc) {
                this.m_respFunc = null; // call once only
                if (LOG_LEVEL > 2 && this.m_bLogging) {
                    log("response exec: " + errorToString(err), this);
                }
                try {
                    respFunc(err, str);
                    err = null; // may have been handled
                } catch (exc) {
                    // don't pump into error console, may be handled:
                    log("error: " + errorToString(exc), this);
                    err = exc;
                }
            }
            this.detachFromParent(err);
        }
    },

    execSubRespFunc: function calWcapNetworkRequest_execSubRespFunc(func, err, data) {
        try {
            func(err, data);
        } catch (exc) {
            this.execRespFunc(exc);
        }
    }
};

function issueNetworkRequest(parentRequest, respFunc, url, bLogging) {
    var netRequest = new calWcapNetworkRequest(url, respFunc, bLogging);
    if (parentRequest) {
        parentRequest.attachSubRequest(netRequest);
    }
    try {
        var uri = getIOService().newURI(url, null, null);
        var channel = getIOService().newChannelFromURI(uri);
        netRequest.prepareChannel(channel);
        channel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
        channel.redirectionLimit = 3;
        channel.notificationCallbacks = netRequest;
        var loader = Components.classes["@mozilla.org/network/unichar-stream-loader;1"]
                               .createInstance(Components.interfaces.nsIUnicharStreamLoader);
        netRequest.m_loader = loader;

        log("opening channel.", netRequest);
        // Required to be trunk and branch compatible:
        if (isBranch()) {
            loader.init(channel,
                        netRequest,
                        null /* context */,
                        Components.interfaces.nsIUnicharStreamLoader.DEFAULT_SEGMENT_SIZE);
        } else {
            loader.init(netRequest,
                        Components.interfaces.nsIUnicharStreamLoader.DEFAULT_SEGMENT_SIZE);
            channel.asyncOpen(loader, null);
        }
    } catch (exc) {
        netRequest.execRespFunc(exc);
    }
}

function getWcapRequestStatusString(xml) {
    var str = "request status: ";
    var items = xml.getElementsByTagName("RSTATUS");
    if (items != null && items.length > 0) {
        str += items.item(0).textContent;
    } else {
        str += "none";
    }
    return str;
}

function stringToIcal(session, data, expectedErrno) {
    if (!data || data.length == 0) { // assuming time-out; WTF.
        throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                       calIWcapErrors.WCAP_LOGIN_FAILED);
    }
    var icalRootComp;
    try {
        icalRootComp = getIcsService().parseICS(data, session /* implements calITimezoneProvider */);
    } catch (exc) { // map into more useful error string:
        throw new Components.Exception("error parsing ical data!", calIErrors.ICS_PARSE);
    }
    checkWcapIcalErrno(icalRootComp, expectedErrno);
    return icalRootComp;
}

function stringToXml(session, data, expectedErrno) {
    if (!data || data.length == 0) { // assuming time-out
        throw new Components.Exception(errorToString(calIWcapErrors.WCAP_LOGIN_FAILED),
                                       calIWcapErrors.WCAP_LOGIN_FAILED);
    }
    var xml = getDomParser().parseFromString(data, "text/xml");
    checkWcapXmlErrno(xml, expectedErrno);
    return xml;
}

