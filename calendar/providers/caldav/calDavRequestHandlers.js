/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * This is a handler for the etag request in calDavCalendar.js' getUpdatedItem.
 * It uses the SAX parser to incrementally parse the items and compose the
 * resulting multiget.
 *
 * @param aCalendar             The (unwrapped) calendar this request belongs to
 * @param aBaseUri              The URI requested (i.e inbox or collection)
 * @param aChangeLogListener    (optional) for cached calendars, the listener to
 *                                notify.
 */
function etagsHandler(aCalendar, aBaseUri, aChangeLogListener) {
    this.calendar = aCalendar;
    this.baseUri = aBaseUri;
    this.changeLogListener = aChangeLogListener;
    this._reader = Components.classes["@mozilla.org/saxparser/xmlreader;1"]
                             .createInstance(Components.interfaces.nsISAXXMLReader);
    this._reader.contentHandler = this;
    this._reader.errorHandler = this;
    this._reader.parseAsync(null);

    this.itemsReported = {};
    this.itemsNeedFetching = [];
}

etagsHandler.prototype = {
    skipIndex: -1,
    currentResponse: null,
    tag: null,
    calendar: null,
    baseUri: null,
    changeLogListener: null,
    logXML: "",

    itemsReported: null,
    itemsNeedFetching: null,

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISAXContentHandler,
        Components.interfaces.nsISAXErrorHandler,
        Components.interfaces.nsIRequestObserver,
        Components.interfaces.nsIStreamListener
    ]),

    /**
     * @see nsIStreamListener
     */
    onStartRequest: function eSL_onStartRequest(request, context) {
        let httpchannel = request.QueryInterface(Components.interfaces.nsIHttpChannel);

        let responseStatus;
        try {
            responseStatus = httpchannel.responseStatus
        } catch (ex) {
            cal.WARN("CalDAV: No response status getting etags for calendar " + this.calendar.name);
        }

        if (responseStatus == 207) {
            // We only need to parse 207's, anything else is probably a
            // server error (i.e 50x).
            httpchannel.contentType = "application/xml";
            this._reader.onStartRequest(request, context);
        } else {
            cal.LOG("CalDAV: Error fetching item etags");
            this.calendar.reportDavError(Components.interfaces.calIErrors.DAV_REPORT_ERROR);
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                Components.results.NS_ERROR_FAILURE);
            }
            this._reader = null;
        }
    },

    onStopRequest: function eSL_onStopRequest(request, context, statusCode) {
        if (this.calendar.verboseLogging()) {
            cal.LOG("CalDAV: recv: " + this.logXML);
        }
        if (!this._reader) {
            // No reader means there was a request error
            return;
        }
        try {
            this._reader.onStopRequest(request, context, statusCode);
        } finally {
            this._reader = null;
        }

        // Now that we are done, check which items need fetching.
        if (this.calendar.isCached) {
            this.calendar.superCalendar.startBatch();
        }

        let needsRefresh = false;
        try {
            for (let path in this.calendar.mHrefIndex) {
                if (path in this.itemsReported ||
                    path.substr(0, this.baseUri.length) == this.baseUri) {
                    // If the item is also on the server, check the next.
                    continue;
                }
                // If an item has been deleted from the server, delete it here too.
                // Since the target calendar's operations are synchronous, we can
                // safely set variables from this function.
                let foundItem;
                let getItemListener = {
                    onGetResult: function etags_getItem_onResult(aCalendar,
                                                                 aStatus,
                                                                 aItemType,
                                                                 aDetail,
                                                                 aCount,
                                                                 aItems) {
                        foundItem = aItems[0];
                    },
                    onOperationComplete: function etags_getItem_onOperationComplete() {}
                };

                this.calendar.mOfflineStorage.getItem(this.calendar.mHrefIndex[path],
                                                      getItemListener);
                if (foundItem) {
                    let wasInboxItem = this.calendar.mItemInfoCache[foundItem.id].isInboxItem;
                    if ((wasInboxItem && this.calendar.isInbox(this.baseUri.spec)) ||
                        (wasInboxItem === false && !this.calendar.isInbox(this.baseUri.spec))) {
                        cal.LOG("Deleting local href: " + path)
                        delete this.calendar.mHrefIndex[path];
                        this.calendar.mOfflineStorage.deleteItem(foundItem, null);
                        needsRefresh = true;
                    }
                }
            }
        } finally {
            if (this.calendar.isCached) {
                this.calendar.superCalendar.endBatch();
            }
        }

        // Avoid sending empty multiget requests update views if something has
        // been deleted server-side.
        if (!this.itemsNeedFetching.length) {
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_OK },
                                                Components.results.NS_OK);
            }

            if (needsRefresh) {
                this.calendar.mObservers.notify("onLoad", [this.calendar]);
            }

            // but do poll the inbox
            if (this.calendar.mShouldPollInbox &&
                !this.calendar.isInbox(this.baseUri.spec)) {
                this.calendar.pollInbox();
            }
        } else {
            let multiget = new multigetSyncHandler(this.itemsNeedFetching,
                                       this.calendar,
                                       this.baseUri,
                                       null,
                                       null,
                                       this.changeLogListener)
            multiget.doMultiGet();
        }
    },

    onDataAvailable: function eSL_onDataAvailable(request, context, inputStream, offset, count) {
        if (this._reader) {
            // No reader means request error
            this._reader.onDataAvailable(request, context, inputStream, offset, count);
        }
    },


    /**
     * @see nsISAXErrorHandler
     */
    fatalError: function eH_fatalError() {
        cal.WARN("CalDAV: Fatal Error parsing etags for " + this.calendar.name);
    },


    /**
     * @see nsISAXContentHandler
     */
    characters: function eH_characters(aValue) {
        if (this.calendar.verboseLogging()) {
            this.logXML += aValue;
        }
        this.currentResponse[this.tag] += aValue;
    },

    startDocument: function eH_startDocument() {
        this.hrefMap = {};
        this.currentResponse = {};
        this.tag = null
    },

    endDocument: function eH_endDocument() { },

    startElement: function eH_startElement(aUri, aLocalName, aQName, aAttributes) {
        switch (aLocalName) {
            case "response":
                this.currentResponse = {};
                this.currentResponse.isCollection = false;
                this.tag = null
                break;
            case "collection":
                this.currentResponse.isCollection = true;
            case "href":
            case "getetag":
            case "getcontenttype":
                this.tag = aLocalName;
                this.currentResponse[aLocalName] = "";
                break;
        }
        if (this.calendar.verboseLogging()) {
            this.logXML += "<" + aQName + ">";
        }

    },

    endElement: function eH_endElement(aUri, aLocalName, aQName) {
        switch (aLocalName) {
            case "response":
                this.tag = null;
                let r = this.currentResponse;
                if (r.getetag && r.getetag.length &&
                    r.href && r.href.length &&
                    r.getcontenttype && r.getcontenttype.length &&
                    !r.isCollection) {

                    r.href = this.calendar.ensureDecodedPath(r.href);

                    if (r.getcontenttype.substr(0, 14) == "message/rfc822") {
                        // workaround for a Scalix bug which causes incorrect
                        // contenttype to be returned.
                        r.getcontenttype = "text/calendar";
                    }
                    if (r.getcontenttype == "text/vtodo") {
                        // workaround Kerio wierdness
                        r.getcontenttype = "text/calendar";
                    }

                    // Only handle calendar items
                    if (r.getcontenttype.substr(0,13) == "text/calendar") {
                        if (r.href && r.href.length) {
                            this.itemsReported[r.href] = r.getetag;

                            let itemUid = this.calendar.mHrefIndex[r.href];
                            if (!itemUid ||
                                r.getetag != this.calendar.mItemInfoCache[itemUid].etag) {
                                this.itemsNeedFetching.push(r.href);
                            }
                        }
                    }
                }
                break;
            case "href":
            case "getetag":
            case "getcontenttype":
                this.tag = null;
                break;
        }
        if (this.calendar.verboseLogging()) {
            this.logXML += "</" + aQName + ">";
        }
    },

    startPrefixMapping: function eH_startPrefixMapping(aPrefix, aUri) { },
    endPrefixMapping: function eH_endPrefixMapping(aPrefix) { },
    ignorableWhitespace: function eH_ignorableWhitespace(aWhiteSpace) { },
    processingInstruction: function eH_processingInstruction(aTarget, aData) { }
};

/**
 * This is a handler for the webdav sync request in calDavCalendar.js' getUpdatedItem.
 * It uses the SAX parser to incrementally parse the items and compose the
 * resulting multiget.
 *
 * @param aCalendar             The (unwrapped) calendar this request belongs to
 * @param aBaseUri              The URI requested (i.e inbox or collection)
 * @param aChangeLogListener    (optional) for cached calendars, the listener to
 *                                notify.
 */
function webDavSyncHandler(aCalendar, aBaseUri, aChangeLogListener) {
    this.calendar = aCalendar;
    this.baseUri = aBaseUri;
    this.changeLogListener = aChangeLogListener;
    this._reader = Components.classes["@mozilla.org/saxparser/xmlreader;1"]
                             .createInstance(Components.interfaces.nsISAXXMLReader);
    this._reader.contentHandler = this;
    this._reader.errorHandler = this;
    this._reader.parseAsync(null);

    this.itemsReported = {};
    this.itemsNeedFetching = [];
}

webDavSyncHandler.prototype = {
    currentResponse: null,
    tag: null,
    calendar: null,
    baseUri: null,
    newSyncToken: null,
    changeLogListener: null,
    logXML: "",
    isInPropStat : false,
    changeCount : 0,
    unhandledErrors : 0,
    itemsReported: null,
    itemsNeedFetching: null,

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISAXContentHandler,
        Components.interfaces.nsISAXErrorHandler,
        Components.interfaces.nsIRequestObserver,
        Components.interfaces.nsIStreamListener
    ]),

    doWebDAVSync: function doWebDAVSync() {
        if (this.calendar.mDisabled) {
            // check if maybe our calendar has become available
            this.calendar.setupAuthentication(this.changeLogListener);
            return;
        }


        let syncTokenString = "<sync-token/>";
        if (this.calendar.mWebdavSyncToken && this.calendar.mWebdavSyncToken.length > 0) {
            let syncToken = cal.xml.escapeString(this.calendar.mWebdavSyncToken);
            syncTokenString = "<sync-token>" + syncToken + "</sync-token>";
        }

        let queryXml =
          xmlHeader +
          '<sync-collection xmlns="DAV:">' +
            syncTokenString +
            '<sync-level>1</sync-level>' +
            '<prop>' +
              '<getcontenttype/>' +
              '<getetag/>' +
            '</prop>' +
          '</sync-collection>';

        let requestUri = this.calendar.makeUri(null, this.baseUri);

        if (this.calendar.verboseLogging()) {
            cal.LOG("CalDAV: send(" + requestUri.spec + "): " + queryXml);
        }
        cal.LOG("CalDAV: webdav-sync Token: " + this.calendar.mWebdavSyncToken);
        this.calendar.sendHttpRequest(requestUri, queryXml, MIME_TEXT_XML, null, (channel) => {
            // The depth header adheres to an older version of the webdav-sync
            // spec and has been replaced by the <sync-level> tag above.
            // Unfortunately some servers still depend on the depth header,
            // therefore we send both (yuck).
            channel.setRequestHeader("Depth", "1", false);

            channel.requestMethod = "REPORT";
            return this;
        }, () => {
            // Something went wrong with the OAuth token, notify failure
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_ERROR_NOT_AVAILABLE },
                                                Components.results.NS_ERROR_NOT_AVAILABLE);
            }
        }, false);
    },

    /**
     * @see nsIStreamListener
     */
    onStartRequest: function wSL_onStartRequest(request, context) {
        let httpchannel = request.QueryInterface(Components.interfaces.nsIHttpChannel);

        let responseStatus;
        try {
            responseStatus = httpchannel.responseStatus
        } catch (ex) {
            cal.WARN("CalDAV: No response status doing webdav sync for calendar " + this.calendar.name);
        }

        if (responseStatus == 207) {
            // We only need to parse 207's, anything else is probably a
            // server error (i.e 50x).
            httpchannel.contentType = "application/xml";
            this._reader.onStartRequest(request, context);
        }
        // Invalidate sync token with 4xx errors that could indicate the
        // sync token has become invalid and do a refresh
        else if (this.calendar.mWebdavSyncToken != null &&
                 responseStatus >= 400 &&
                 responseStatus <= 499) {
            cal.LOG("CalDAV: Reseting sync token because server returned status code: " + responseStatus);
            this._reader = null;
            this.calendar.mWebdavSyncToken = null;
            this.calendar.saveCalendarProperties();
            this.calendar.safeRefresh(this.changeLogListener);
        } else {
            cal.WARN("CalDAV: Error doing webdav sync: " + responseStatus);
            this.calendar.reportDavError(Components.interfaces.calIErrors.DAV_REPORT_ERROR);
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                Components.results.NS_ERROR_FAILURE);
            }
            this._reader = null;
        }
    },

    onStopRequest: function wSL_onStopRequest(request, context, statusCode) {
        if (this.calendar.verboseLogging()) {
            cal.LOG("CalDAV: recv: " + this.logXML);
        }
        if (!this._reader) {
            // No reader means there was a request error
            cal.LOG("CalDAV: onStopRequest: no reader");
            return;
        }
        try {
            this._reader.onStopRequest(request, context, statusCode);
        } finally {
            this._reader = null;
        }
    },

    onDataAvailable: function wSL_onDataAvailable(request, context, inputStream, offset, count) {
        if (this._reader) {
            // No reader means request error
            this._reader.onDataAvailable(request, context, inputStream, offset, count);
        }
    },

    /**
     * @see nsISAXErrorHandler
     */
    fatalError: function wH_fatalError() {
        cal.WARN("CalDAV: Fatal Error doing webdav sync for " + this.calendar.name);
    },

    /**
     * @see nsISAXContentHandler
     */
    characters: function wH_characters(aValue) {
        if (this.calendar.verboseLogging()) {
            this.logXML += aValue;
        }
        this.currentResponse[this.tag] += aValue;
    },

    startDocument: function wH_startDocument() {
        this.hrefMap = {};
        this.currentResponse = {};
        this.tag = null
        if (this.calendar.isCached) {
            this.calendar.superCalendar.startBatch();
        }
    },

    endDocument: function wH_endDocument() {
        if (this.unhandledErrors) {
            this.calendar.superCalendar.endBatch();
            this.calendar.reportDavError(Components.interfaces.calIErrors.DAV_REPORT_ERROR);
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                Components.results.NS_ERROR_FAILURE);
            }
            return;
        }

        if (this.calendar.mWebdavSyncToken == null) {
            // null token means reset or first refresh indicating we did
            // a full sync; remove local items that were not returned in this full
            // sync
            for (let path in this.calendar.mHrefIndex) {
                if (!this.itemsReported[path]) {
                    this.calendar.deleteTargetCalendarItem(path);
                }
            }
        }
        if (this.calendar.isCached) {
            this.calendar.superCalendar.endBatch();
        }

        if (!this.itemsNeedFetching.length) {
            if (this.newSyncToken) {
                this.calendar.mWebdavSyncToken = this.newSyncToken;
                this.calendar.saveCalendarProperties();
                cal.LOG("CalDAV: New webdav-sync Token: " + this.calendar.mWebdavSyncToken);
            }
            this.calendar.finalizeUpdatedItems(this.changeLogListener,
                                               this.baseUri);
        } else {
            let multiget = new multigetSyncHandler(this.itemsNeedFetching,
                                                   this.calendar,
                                                   this.baseUri,
                                                   this.newSyncToken,
                                                   null,
                                                   this.changeLogListener)
            multiget.doMultiGet();
        }

    },

    startElement: function wH_startElement(aUri, aLocalName, aQName, aAttributes) {
        switch (aLocalName) {
            case "response": // WebDAV Sync draft 3
                this.currentResponse = {};
                this.tag = null
                this.isInPropStat=false;
                break;
            case "propstat":
                this.isInPropStat=true;
                break;
            case "status":
                if (this.isInPropStat) {
                    this.tag = "propstat_" + aLocalName;
                }
                else {
                    this.tag = aLocalName;
                }
                this.currentResponse[this.tag] = "";
                break;
            case "href":
            case "getetag":
            case "getcontenttype":
            case "sync-token":
                this.tag = aLocalName.replace(/-/g,'');
                this.currentResponse[this.tag ] = "";
                break;
        }
        if (this.calendar.verboseLogging()) {
            this.logXML += "<" + aQName + ">";
        }

    },

    endElement: function wH_endElement(aUri, aLocalName, aQName) {
        switch (aLocalName) {
            case "response": // WebDAV Sync draft 3
            case "sync-response": // WebDAV Sync draft 0,1,2
                let r = this.currentResponse;
                if (r.href && r.href.length) {
                    r.href = this.calendar.ensureDecodedPath(r.href);
                }

                if ((!r.getcontenttype || r.getcontenttype == "text/plain")  &&
                    r.href &&
                    r.href.length >= 4 &&
                    r.href.substr(r.href.length - 4,4) == ".ics") {
                  // If there is no content-type (iCloud) or text/plain was passed
                  // (iCal Server) for the resource but its name ends with ".ics"
                  // assume the content type to be text/calendar. Apple
                  // iCloud/iCal Server interoperability fix.
                  r.getcontenttype = "text/calendar";
                }

                // Deleted item
                if (r.href && r.href.length &&
                    r.status &&
                    r.status.length &&
                    r.status.indexOf(" 404") > 0) {
                    if (this.calendar.mHrefIndex[r.href]) {
                        this.changeCount++;
                        this.calendar.deleteTargetCalendarItem(r.href);
                    }
                    else {
                        cal.LOG("CalDAV: skipping unfound deleted item : " + r.href);
                    }
                // Only handle Created or Updated calendar items
                } else if (r.getcontenttype &&
                           r.getcontenttype.substr(0,13) == "text/calendar" &&
                           r.getetag && r.getetag.length &&
                           r.href && r.href.length &&
                           (!r.status ||                 // Draft 3 does not require
                            r.status.length == 0 ||      // a status for created or updated items but
                            r.status.indexOf(" 204") ||  // draft 0, 1 and 2 needed it so treat no status
                            r.status.indexOf(" 200") ||  // Apple iCloud returns 200 status for each item
                            r.status.indexOf(" 201"))) { // and status 201 and 204 the same
                    this.itemsReported[r.href] = r.getetag;
                    let itemId = this.calendar.mHrefIndex[r.href];
                    let oldEtag = (itemId && this.calendar.mItemInfoCache[itemId].etag);

                    if (!oldEtag || oldEtag != r.getetag) {
                        // Etag mismatch, getting new/updated item.
                        this.itemsNeedFetching.push(r.href);
                    }
                // If the response element is still not handled, log an error
                // only if the content-type is text/calendar or the
                // response status is different than 404 not found.
                // We don't care about response elements
                // on non-calendar resources or whose status is not indicating
                // a deleted resource.
                } else if ((r.getcontenttype &&
                            r.getcontenttype.substr(0,13) == "text/calendar") ||
                           (r.status &&
                            r.status.indexOf(" 404") == -1)) {
                    cal.WARN("CalDAV: Unexpected response, status: " + r.status + ", href: " + r.href);
                    this.unhandledErrors++;
                } else {
                    cal.LOG("CalDAV: Unhandled response element, status: " + r.status + ", href: " + r.href + " contenttype:" + r.getcontenttype);
                }
                break;
            case "sync-token":
                this.newSyncToken = this.currentResponse[this.tag];
                break;
            case "propstat":
                this.isInPropStat=false;
                break;
        }
        this.tag = null;
        if (this.calendar.verboseLogging()) {
            this.logXML += "</" + aQName + ">";
        }
    },

    startPrefixMapping: function wH_startPrefixMapping(aPrefix, aUri) { },
    endPrefixMapping: function wH_endPrefixMapping(aPrefix) { },
    ignorableWhitespace: function wH_ignorableWhitespace(aWhiteSpace) { },
    processingInstruction: function wH_processingInstruction(aTarget, aData) { }
};

/**
 * This is a handler for the multiget request.
 * It uses the SAX parser to incrementally parse the items and compose the
 * resulting multiget.
 *
 * @param aItemsNeedFetching    The array of items to fetch, this must be an
 *                              array of un-encoded paths.
 * @param aCalendar             The (unwrapped) calendar this request belongs to
 * @param aBaseUri              The URI requested (i.e inbox or collection)
 * @param aNewSyncToken         (optional) new Sync token to set if operation successful
 * @param aListener             (optional) The listener to notify
 * @param aChangeLogListener    (optional) for cached calendars, the listener to
 *                                notify.
 */
function multigetSyncHandler(aItemsNeedFetching, aCalendar, aBaseUri, aNewSyncToken, aListener, aChangeLogListener) {
    this.calendar = aCalendar;
    this.baseUri = aBaseUri;
    this.listener = aListener;
    this.newSyncToken = aNewSyncToken;
    this.changeLogListener = aChangeLogListener;
    this._reader = Components.classes["@mozilla.org/saxparser/xmlreader;1"]
                             .createInstance(Components.interfaces.nsISAXXMLReader);
    this._reader.contentHandler = this;
    this._reader.errorHandler = this;
    this._reader.parseAsync(null);
    this.itemsNeedFetching = aItemsNeedFetching;
}
multigetSyncHandler.prototype = {
    currentResponse: null,
    tag: null,
    calendar: null,
    baseUri: null,
    newSyncToken: null,
    listener: null,
    changeLogListener: null,
    logXML: null,
    unhandledErrors : 0,
    itemsNeedFetching: null,

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISAXContentHandler,
        Components.interfaces.nsISAXErrorHandler,
        Components.interfaces.nsIRequestObserver,
        Components.interfaces.nsIStreamListener
    ]),

    doMultiGet: function doMultiGet() {
        if (this.calendar.mDisabled) {
            // check if maybe our calendar has become available
            this.calendar.setupAuthentication(this.changeLogListener);
            return;
        }

        let batchSize = cal.getPrefSafe("calendar.caldav.multigetBatchSize", 100);
        let hrefString = "";
        while (this.itemsNeedFetching.length && batchSize > 0) {
            batchSize--;
            // ensureEncodedPath extracts only the path component of the item and
            // encodes it before it is sent to the server
            let locpath = this.calendar.ensureEncodedPath(this.itemsNeedFetching.pop());
            hrefString += "<D:href>" + cal.xml.escapeString(locpath) + "</D:href>";
        }

        let queryXml =
          xmlHeader +
          '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
            '<D:prop>' +
              '<D:getetag/>' +
              '<C:calendar-data/>' +
            '</D:prop>' +
            hrefString +
          '</C:calendar-multiget>';

        let requestUri = this.calendar.makeUri(null, this.baseUri);
        if (this.calendar.verboseLogging()) {
            cal.LOG("CalDAV: send(" + requestUri.spec + "): " + queryXml);
        }
        this.calendar.sendHttpRequest(requestUri, queryXml, MIME_TEXT_XML, null, (channel) => {
            channel.requestMethod = "REPORT";
            channel.setRequestHeader("Depth", "1", false);
            return this;
        }, () => {
            // Something went wrong with the OAuth token, notify failure
            if (this.calendar.isCached && this.changeLogListener) {
                this.changeLogListener.onResult({ status: Components.results.NS_ERROR_NOT_AVAILABLE },
                                                Components.results.NS_ERROR_NOT_AVAILABLE);
            }
        }, false);
    },

    /**
     * @see nsIStreamListener
     */
    onStartRequest: function mg_onStartRequest(request, context) {
        let httpchannel = request.QueryInterface(Components.interfaces.nsIHttpChannel);

        let responseStatus;
        try {
            responseStatus = httpchannel.responseStatus
        } catch (ex) {
            cal.WARN("CalDAV: No response status doing multiget for calendar " + this.calendar.name);
        }

        if (responseStatus == 207) {
            // We only need to parse 207's, anything else is probably a
            // server error (i.e 50x).
            httpchannel.contentType = "application/xml";
            this._reader.onStartRequest(request, context);
        } else {
            let errorMsg = "CalDAV: Error: got status " + responseStatus +
                               " fetching calendar data for " + this.calendar.name + ", " + this.listener;
            this.calendar.notifyGetFailed(errorMsg, this.listener, this.changeLogListener);
            this._reader = null;
        }
    },

    onStopRequest: function mg_onStopRequest(request, context, statusCode) {
        if (this.calendar.verboseLogging()) {
            cal.LOG("CalDAV: recv: " + this.logXML);
        }
        if (this.unhandledErrors) {
            this.calendar.superCalendar.endBatch();
            this.calendar.notifyGetFailed("multiget error", this.listener, this.changeLogListener);
            return;
        }
        if (this.itemsNeedFetching.length == 0) {
            if (this.newSyncToken) {
                this.calendar.mWebdavSyncToken = this.newSyncToken;
                this.calendar.saveCalendarProperties();
              cal.LOG("CalDAV: New webdav-sync Token: " + this.calendar.mWebdavSyncToken);
            }

            this.calendar.finalizeUpdatedItems(this.changeLogListener,
                                               this.baseUri);
        }
        if (!this._reader) {
            // No reader means there was a request error. The error is already
            // notified in onStartRequest, so no need to do it here.
            cal.LOG("CalDAV: onStopRequest: no reader");
            return;
        }
        try {
            this._reader.onStopRequest(request, context, statusCode);
        } finally {
            this._reader = null;
        }
        if (this.itemsNeedFetching.length > 0) {
            cal.LOG("CalDAV: Still need to fetch " + this.itemsNeedFetching.length + " elements.");
            this._reader = Components.classes["@mozilla.org/saxparser/xmlreader;1"]
                                     .createInstance(Components.interfaces.nsISAXXMLReader);
            this._reader.contentHandler = this;
            this._reader.errorHandler = this;
            this._reader.parseAsync(null);
            let timerCallback = {
                requestHandler : this,
                notify: function(timer) {
                    // Call multiget again to get another batch
                    this.requestHandler.doMultiGet();
                }
            };
            let timer = Components.classes["@mozilla.org/timer;1"]
                        .createInstance(Components.interfaces.nsITimer);
            timer.initWithCallback(timerCallback,
                                   0,
                                   Components.interfaces.nsITimer.TYPE_ONE_SHOT);
        }
    },

    onDataAvailable: function mg_onDataAvailable(request, context, inputStream, offset, count) {
        if (this._reader) {
            // No reader means request error
            this._reader.onDataAvailable(request, context, inputStream, offset, count);
        }
    },

    /**
     * @see nsISAXErrorHandler
     */
    fatalError: function mg_fatalError() {
        cal.WARN("CalDAV: Fatal Error doing multiget for " + this.calendar.name);
    },

    /**
     * @see nsISAXContentHandler
     */
    characters: function mg_characters(aValue) {
        if (this.calendar.verboseLogging()) {
            this.logXML += aValue;
        }
        this.currentResponse[this.tag] += aValue;
    },

    startDocument: function mg_startDocument() {
        this.hrefMap = {};
        this.currentResponse = {};
        this.tag = null
        this.logXML = "";
        if (this.calendar.isCached) {
            this.calendar.superCalendar.startBatch();
        }
    },

    endDocument: function mg_endDocument() {
        if (this.calendar.isCached) {
            this.calendar.superCalendar.endBatch();
        }
    },

    startElement: function mg_startElement(aUri, aLocalName, aQName, aAttributes) {
        switch (aLocalName) {
            case "response":
                this.currentResponse = {};
                this.tag = null
                this.isInPropStat=false;
                break;
            case "propstat":
                this.isInPropStat=true;
                break;
            case "status":
                if (this.isInPropStat) {
                    this.tag = "propstat_" + aLocalName;
                }
                else {
                    this.tag = aLocalName;
                }
                this.currentResponse[this.tag] = "";
                break;
            case "calendar-data":
            case "href":
            case "getetag":
                this.tag = aLocalName.replace(/-/g,'');
                this.currentResponse[this.tag ] = "";
                break;
        }
        if (this.calendar.verboseLogging()) {
            this.logXML += "<" + aQName + ">";
        }

    },

    endElement: function mg_endElement(aUri, aLocalName, aQName) {
        switch (aLocalName) {
            case "response":
                let r = this.currentResponse;
                if (r.href &&
                    r.href.length) {
                    r.href = this.calendar.ensureDecodedPath(r.href);
                }
                if (r.href && r.href.length &&
                    r.status &&
                    r.status.length &&
                    r.status.indexOf(" 404") > 0) {
                    if (this.calendar.mHrefIndex[r.href]) {
                        this.changeCount++;
                        this.calendar.deleteTargetCalendarItem(r.href);
                    } else {
                        cal.LOG("CalDAV: skipping unfound deleted item : " + r.href);
                    }
                // Created or Updated item
                } else if (r.getetag && r.getetag.length &&
                           r.href && r.href.length &&
                           r.calendardata && r.calendardata.length) {
                    let oldEtag;
                    let itemId = this.calendar.mHrefIndex[r.href];
                    if (itemId) {
                        oldEtag = this.calendar.mItemInfoCache[itemId].etag;
                    } else {
                        oldEtag = null;
                    }
                    if (!oldEtag || oldEtag != r.getetag) {
                        this.changeCount++;
                        this.calendar.addTargetCalendarItem(r.href,
                                                            r.calendardata,
                                                            this.baseUri,
                                                            r.getetag,
                                                            this.listener);
                    } else {
                        cal.LOG("CalDAV: skipping item with unmodified etag : " + oldEtag);
                    }
                } else {
                    cal.WARN("CalDAV: Unexpected response, status: " +
                             r.status + ", href: " + r.href + " calendar-data:\n" + r.calendardata);
                    this.unhandledErrors++;
                }
                break;
            case "propstat":
                this.isInPropStat=false;
                break;
        }
        this.tag = null;
        if (this.calendar.verboseLogging()) {
            this.logXML += "</" + aQName + ">";
        }
    },

    startPrefixMapping: function mg_startPrefixMapping(aPrefix, aUri) { },
    endPrefixMapping: function mg_endPrefixMapping(aPrefix) { },
    ignorableWhitespace: function mg_ignorableWhitespace(aWhiteSpace) { },
    processingInstruction: function mg_processingInstruction(aTarget, aData) { }
};
