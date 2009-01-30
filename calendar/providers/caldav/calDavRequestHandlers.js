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
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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


Components.utils.import("resource://calendar/modules/calUtils.jsm");

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
    this.changelogListener = aChangeLogListener;
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
    changelogListener: null,
    logXML: "",

    itemsReported: null,
    itemsNeedFetching: null,

    QueryInterface: function QueryInterface(aIID) {
        return doQueryInterface(this,
                                etagsHandler.prototype,
                                aIID,
                                [Components.interfaces.nsISAXContentHandler,
                                 Components.interfaces.nsISAXErrorHandler,
                                 Components.interfaces.nsIRequestObserver,
                                 Components.interfaces.nsIStreamListener]);
    },

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
            if (this.calendar.isCached && this.changelogListener) {
                this.changelogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
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

                this.calendar.mTargetCalendar.getItem(this.calendar.mHrefIndex[path],
                                                      getItemListener);
                if (foundItem) {
                    let wasInboxItem = this.calendar.mItemInfoCache[foundItem.id].isInboxItem;
                    if ((wasInboxItem && this.calendar.isInbox(this.baseUri.spec)) ||
                        (wasInboxItem === false && !this.calendar.isInbox(this.baseUri.spec))) {
                        delete this.calendar.mHrefIndex[path];
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
            if (this.calendar.isCached && this.changelogListener) {
                this.changelogListener.onResult({ status: Components.results.NS_OK },
                                                Components.results.NS_OK);
            }

            if (needsRefresh) {
                this.calendar.mObservers.notify("onLoad", [this.calendar]);
            }

            // but do poll the inbox
            if (this.calendar.hasScheduling &&
                this.calendar.isInbox(this.baseUri.spec)) {
                this.calendar.pollInbox();
            }
        } else {
            let C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
            let D = new Namespace("D", "DAV:");
            let multigetQueryXml =
              <calendar-multiget xmlns:D={D} xmlns={C}>
                <D:prop>
                  <D:getetag/>
                  <calendar-data/>
                </D:prop>
              </calendar-multiget>;

            while (this.itemsNeedFetching.length) {
                let locpath = this.itemsNeedFetching.pop();
                multigetQueryXml.D::prop += <D:href xmlns:D={D}>{locpath}</D:href>;
            }

            let multigetQueryString = xmlHeader + multigetQueryXml.toXMLString();
            this.calendar.getCalendarData(this.baseUri,
                                          multigetQueryString,
                                          null,
                                          null,
                                          this.changelogListener);
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
        LOG("CalDAV: Fatal Error parsing etags for " + this.calendar.name);
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
                this.tag = null
                break;
            case "href":
            case "getetag":
            case "status":
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
                if (r.status.indexOf(" 200") > 0 &&
                    r.getetag && r.getetag.length &&
                    r.href && r.href.length &&
                    !r.getcontenttype || r.getcontenttype.length) {
                    let href;
                    if (r.getcontenttype == "message/rfc822") {
                        // workaround for a Scalix bug which causes incorrect
                        // contenttype to be returned.
                        r.getcontenttype = "text/calendar";
                    }

                    if (r.getcontenttype.substr(0,13) == "text/calendar") {
                        // Only handle calendar items

                        if (this.skipIndex < 0) {
                            href = this.calendar.ensurePath(r.href);
                            this.skipIndex = r.href.indexOf(href);
                        } else {
                            href = r.href.substr(this.skipIndex);
                        }
                        
                        if (href && href.length) {
                            this.itemsReported[href] = r.getetag;

                            let itemUid = this.calendar.mHrefIndex[href];
                            if (!itemUid ||
                                r.getetag != this.calendar.mItemInfoCache[itemUid].etag) {
                                this.itemsNeedFetching.push(href);
                            }
                        }
                    }
                }
                break;
            case "href":
            case "getetag":
            case "status":
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
