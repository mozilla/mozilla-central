/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/Timer.jsm");

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calXMLUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://calendar/modules/calProviderUtils.jsm");
Components.utils.import("resource://calendar/modules/calAuthUtils.jsm");
Components.utils.import("resource://calendar/modules/OAuth2.jsm");

//
// calDavCalendar.js
//

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';

const davNS = "DAV:"
const caldavNS = "urn:ietf:params:xml:ns:caldav";
const calservNS = "http://calendarserver.org/ns/";
const MIME_TEXT_CALENDAR = "text/calendar; charset=utf-8";
const MIME_TEXT_XML = "text/xml; charset=utf-8";

const cICL = Components.interfaces.calIChangeLog;
const cIOL = Components.interfaces.calIOperationListener;

function caldavNSResolver(prefix) {
    const ns = {
        D: davNS,
        C: caldavNS,
        CS: calservNS
    };

    return ns[prefix] || null;
}

function caldavXPath(aNode, aExpr, aType) {
    return cal.xml.evalXPath(aNode, aExpr, caldavNSResolver, aType);
}
function caldavXPathFirst(aNode, aExpr, aType) {
    return cal.xml.evalXPathFirst(aNode, aExpr, caldavNSResolver, aType);
}

function calDavCalendar() {
    this.initProviderBase();
    this.unmappedProperties = [];
    this.mUriParams = null;
    this.mItemInfoCache = {};
    this.mDisabled = false;
    this.mCalHomeSet = null;
    this.mInboxUrl = null;
    this.mOutboxUrl = null;
    this.mCalendarUserAddress = null;
    this.mPrincipalUrl = null;
    this.mSenderAddress = null;
    this.mHrefIndex = {};
    this.mAuthScheme = null;
    this.mAuthRealm = null;
    this.mObserver = null;
    this.mFirstRefreshDone = false;
    this.mOfflineStorage = null;
    this.mQueuedQueries = [];
    this.mCtag = null;

    // By default, support both events and todos.
    this.mGenerallySupportedItemTypes = ["VEVENT", "VTODO"];
    this.mSupportedItemTypes = this.mGenerallySupportedItemTypes.slice(0);
    this.mACLProperties = {};
}

// some shorthand
const calICalendar = Components.interfaces.calICalendar;
const calIErrors = Components.interfaces.calIErrors;
const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;
const calICalDavCalendar = Components.interfaces.calICalDavCalendar;

// used in checking calendar URI for (Cal)DAV-ness
const kDavResourceTypeNone = 0;
const kDavResourceTypeCollection = 1;
const kDavResourceTypeCalendar = 2;

// used for etag checking
const CALDAV_MODIFY_ITEM = "modify";
const CALDAV_DELETE_ITEM = "delete";

const calDavCalendarClassID = Components.ID("{a35fc6ea-3d92-11d9-89f9-00045ace3b8d}");
const calDavCalendarInterfaces = [
    Components.interfaces.calICalendarProvider,
    Components.interfaces.nsIInterfaceRequestor,
    Components.interfaces.calIFreeBusyProvider,
    Components.interfaces.nsIChannelEventSink,
    Components.interfaces.calIItipTransport,
    Components.interfaces.calISchedulingSupport,
    Components.interfaces.calICalendar,
    Components.interfaces.calIChangeLog,
    calICalDavCalendar,
];
calDavCalendar.prototype = {
    __proto__: cal.ProviderBase.prototype,
    classID: calDavCalendarClassID,
    QueryInterface: XPCOMUtils.generateQI(calDavCalendarInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calDavCalendarClassID,
        contractID: "@mozilla.org/calendar/calendar;1?type=caldav",
        classDescription: "Calendar CalDAV back-end",
        interfaces: calDavCalendarInterfaces,
    }),

    // An array of components that are supported by the server. The default is
    // to support VEVENT and VTODO, if queries for these components return a 4xx
    // error, then they will be removed from this array.
    mGenerallySupportedItemTypes: null,
    mSupportedItemTypes: null,
    suportedItemTypes: null,
    get supportedItemTypes() {
        return this.mSupportedItemTypes;
    },

    get isCached() {
        return (this != this.superCalendar);
    },

    ensureTargetCalendar: function caldav_ensureTargetCalendar() {
        if (!this.isCached && !this.mOfflineStorage) {
            // If this is a cached calendar, the actual cache is taken care of
            // by the calCachedCalendar facade. In any other case, we use a
            // memory calendar to cache things.
            this.mOfflineStorage = Components
                                   .classes["@mozilla.org/calendar/calendar;1?type=memory"]
                                   .createInstance(Components.interfaces.calISyncWriteCalendar);

            this.mOfflineStorage.superCalendar = this;
            this.mObserver = new calDavObserver(this);
            this.mOfflineStorage.addObserver(this.mObserver);
            this.mOfflineStorage.setProperty("relaxedMode", true);
        }
    },

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay() {
        return null;
    },

    get displayName() {
        return calGetString("calendar", "caldavName");
    },

    createCalendar: function caldav_createCalendar() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function caldav_deleteCalendar(cal, listener) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    // calIChangeLog interface
    get offlineStorage() {
        return this.mOfflineStorage;
    },

    set offlineStorage(storage) {
        this.mOfflineStorage = storage;
        this.fetchCachedMetaData();
    },

    resetLog: function caldav_resetLog() {
        if (this.isCached && this.mOfflineStorage) {
            this.mOfflineStorage.startBatch();
            try {
                for (let itemId in this.mItemInfoCache) {
                    this.mOfflineStorage.deleteMetaData(itemId);
                    delete this.mItemInfoCache[itemId];
                }
            } finally {
                this.mOfflineStorage.endBatch();
            }
        }
    },

    get offlineCachedProperties() {
        return [ "mAuthScheme", "mAuthRealm", "mHasWebdavSyncSupport",
                "mCtag", "mWebdavSyncToken", "mSupportedItemTypes",
                "mPrincipalUrl", "mCalHomeSet",
                "mShouldPollInbox", "hasAutoScheduling", "mHaveScheduling",
                "mCalendarUserAddress", "mShouldPollInbox", "mOutboxUrl",
                "hasFreeBusy"];
    },

    get checkedServerInfo() {
        if (Services.io.offline) {
            return true;
        } else {
            return this.mCheckedServerInfo;
        }
    },

    set checkedServerInfo(val) {
        return (this.mCheckedServerInfo = val);
    },

    saveCalendarProperties: function caldav_saveCalendarProperties() {
        let properties = {};
        for each (let property in this.offlineCachedProperties) {
            if (this[property] !== undefined) {
                properties[property] = this[property];
            }
        }
        this.mOfflineStorage.setMetaData("calendar-properties", JSON.stringify(properties));
    },
    restoreCalendarProperties: function caldav_restoreCalendarProperties(data) {
        let properties = JSON.parse(data);
        for each (let property in this.offlineCachedProperties) {
            if (properties[property] !== undefined) {
                this[property] = properties[property];
            }
        }
    },

    // in calIGenericOperationListener aListener
    replayChangesOn: function caldav_replayChangesOn(aChangeLogListener) {
        if (!this.checkedServerInfo) {
            // If we haven't refreshed yet, then we should check the resource
            // type first. This will call refresh() again afterwards.
            this.setupAuthentication(aChangeLogListener);
        } else {
            this.safeRefresh(aChangeLogListener);
        }
    },
    setMetaData: function caldav_setMetaData(id, path, etag, isInboxItem) {
        if (this.mOfflineStorage.setMetaData) {
            if (id) {
                var dataString = [etag,path,(isInboxItem ? "true" : "false")].join("\u001A");
                this.mOfflineStorage.setMetaData(id, dataString);
            } else {
                cal.LOG("CalDAV: cannot store meta data without an id");
            }
        } else {
            cal.ERROR("CalDAV: calendar storage does not support meta data");
        }
    },

    /**
     * Ensure that cached items have associated meta data, otherwise server side
     * changes may not be reflected
     */
    ensureMetaData: function caldav_ensureMetaData() {
        let self = this;
        let refreshNeeded = false;
        let getMetaListener = {
            onGetResult: function meta_onGetResult(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                for each (let item in aItems) {
                    if (!(item.id in self.mItemInfoCache)) {
                        let path = self.getItemLocationPath(item);
                        cal.LOG("Adding meta-data for cached item " + item.id);
                        self.mItemInfoCache[item.id] = { etag: null,
                                                         isNew: false,
                                                         locationPath: path,
                                                         isInboxItem: false};
                        self.mHrefIndex[self.mLocationPath + path] = item.id;
                        refreshNeeded = true;
                    }
                }
            },
            onOperationComplete: function meta_onOperationComplete(aCalendar, aStatus, aOpType, aId, aDetail) {
                if (refreshNeeded) {
                    // reseting the cached ctag forces an item refresh when
                    // safeRefresh is called later
                    self.mCtag = null;
                }
            }
        };
        this.mOfflineStorage.getItems(calICalendar.ITEM_FILTER_ALL_ITEMS,
                                      0, null, null, getMetaListener);
    },

    fetchCachedMetaData: function caldav_fetchCachedMetaData() {
        cal.LOG("CalDAV: Retrieving server info from cache for " + this.name);
        let cacheIds = {};
        let cacheValues = {};
        this.mOfflineStorage.getAllMetaData({}, cacheIds, cacheValues);
        cacheIds = cacheIds.value;
        cacheValues = cacheValues.value;

        for (let count = 0; count < cacheIds.length; count++) {
            let itemId = cacheIds[count];
            let itemData = cacheValues[count];
            if (itemId == "ctag") {
                this.mCtag = itemData;
                this.mOfflineStorage.deleteMetaData("ctag");
            } else if (itemId == "webdav-sync-token") {
                this.mWebdavSyncToken = itemData;
                this.mOfflineStorage.deleteMetaData("sync-token");
            } else if (itemId == "calendar-properties") {
                this.restoreCalendarProperties(itemData);
                this.setProperty("currentStatus", Components.results.NS_OK);
                if (this.mHaveScheduling || this.hasAutoScheduling || this.hasFreeBusy) {
                    cal.getFreeBusyService().addProvider(this);
                }
            } else {
                let itemDataArray = itemData.split("\u001A");
                let etag = itemDataArray[0];
                let resourcePath = itemDataArray[1];
                let isInboxItem = itemDataArray[2];
                if (itemDataArray.length == 3) {
                    this.mHrefIndex[resourcePath] = itemId;
                    let locationPath = resourcePath
                        .substr(this.mLocationPath.length);
                    let item = { etag: etag,
                                 isNew: false,
                                 locationPath: locationPath,
                                 isInboxItem: (isInboxItem == "true")};
                    this.mItemInfoCache[itemId] = item;
                }
            }
        }

        this.ensureMetaData();
    },

    sendHttpRequest: function(aUri, aUploadData, aContentType, aExisting, aSetupChannelFunc, aFailureFunc, aUseStreamLoader=true) {
        let usesGoogleOAuth = (aUri && aUri.host == "apidata.googleusercontent.com" &&
                               this.oauth && this.oauth.accessToken);
        let self = this;
        function authSuccess() {
            let channel = cal.prepHttpChannel(aUri, aUploadData, aContentType, self, aExisting);
            if (usesGoogleOAuth) {
                let hdr = "Bearer " + self.oauth.accessToken;
                channel.setRequestHeader("Authorization", hdr, false);
            }
            let listener = aSetupChannelFunc(channel);
            if (aUseStreamLoader) {
                let loader = cal.createStreamLoader();
                loader.init(listener);
                listener = loader;
            }
            channel.asyncOpen(listener, channel);
        }

        if (usesGoogleOAuth && this.oauth.tokenExpires < (new Date()).getTime()) {
            // The token has expired, we need to reauthenticate first
            this.oauth.connect(authSuccess, aFailureFunc, true, true);
        } else {
            // Either not Google OAuth, or the token is still valid.
            authSuccess();
        }
    },

    //
    // calICalendar interface
    //

    // readonly attribute AUTF8String type;
    get type() { return "caldav"; },

    mDisabled: true,

    mCalendarUserAddress: null,
    get calendarUserAddress() {
        return this.mCalendarUserAddress;
    },

    mPrincipalUrl: null,
    get principalUrl() {
        return this.mPrincipalUrl;
    },

    get canRefresh() {
        // A cached calendar doesn't need to be refreshed.
        return !this.isCached;
    },

    // mUriParams stores trailing ?parameters from the
    // supplied calendar URI. Needed for (at least) Cosmo
    // tickets
    mUriParams: null,

    get uri() { return this.mUri; },

    set uri(aUri) {
        this.mUri = aUri;

        return aUri;
    },

    get calendarUri() {
        let calUri = this.mUri.clone();
        let parts = calUri.spec.split('?');
        if (parts.length > 1) {
            calUri.spec = parts.shift();
            this.mUriParams = '?' + parts.join('?');
        }
        if (calUri.spec.charAt(calUri.spec.length-1) != '/') {
            calUri.spec += "/";
        }
        return calUri;
    },

    setCalHomeSet: function caldav_setCalHomeSet(removeLastPathSegment) {
        if (removeLastPathSegment) {
            let calUri = this.mUri.clone();
            let split1 = calUri.spec.split('?');
            let baseUrl = split1[0];
            if (baseUrl.charAt(baseUrl.length-1) == '/') {
                baseUrl = baseUrl.substring(0, baseUrl.length-2);
            }
            let split2 = baseUrl.split('/');
            split2.pop();
            calUri.spec = split2.join('/') + '/';
            this.mCalHomeSet = calUri;
        } else {
            this.mCalHomeSet = this.calendarUri;
        }
    },

    mOutboxUrl:  null,
    get outboxUrl() {
        return this.mOutboxUrl;
    },

    mInboxUrl: null,
    get inboxUrl() {
        return this.mInboxUrl;
    },

    mHaveScheduling: false,
    mShouldPollInbox: true,
    get hasScheduling() { // Whether to use inbox/outbox scheduling
        return this.mHaveScheduling;
    },
    set hasScheduling(value) {
        return (this.mHaveScheduling = (getPrefSafe("calendar.caldav.sched.enabled", false) && value));
    },
    hasAutoScheduling: false, // Whether server automatically takes care of scheduling
    hasFreebusy: false,

    mAuthScheme: null,

    mAuthRealm: null,

    mFirstRefreshDone: false,

    mQueuedQueries: null,

    mCtag: null,
    mOldCtag: null,

    mOfflineStorage: null,
    // Contains the last valid synctoken returned
    // from the server with Webdav Sync enabled servers
    mWebdavSyncToken: null,
    // Indicates that the server supports Webdav Sync
    // see: http://tools.ietf.org/html/draft-daboo-webdav-sync
    mHasWebdavSyncSupport: false,

    get authRealm() {
        return this.mAuthRealm;
    },

    /**
     * Builds a correctly encoded nsIURI based on the baseUri and the insert
     * string. The returned uri is basically the baseURI + aInsertString
     *
     * @param aInsertString  String to append to the base uri, for example,
     *                       when creating an event this would be the
     *                       event file name (event.ics), if null, an empty
     *                       string is used.
     * @param aBaseUri       base uri (nsIURI object), if null, this.calendarUri
     *                       will be used.
     */
    makeUri: function caldav_makeUri(aInsertString, aBaseUri) {
        let baseUri = aBaseUri || this.calendarUri;
        // Build a string containing the full path, decoded, so it looks like
        // this:
        // /some path/insert string.ics
        let decodedPath = this.ensureDecodedPath(baseUri.path) + (aInsertString || "");

        // Build the nsIURI by specifying a string with a fully encoded path
        // the end result will be something like this:
        // http://caldav.example.com:8080/some%20path/insert%20string.ics
        let url = cal.makeURL(baseUri.prePath + this.ensureEncodedPath(decodedPath) + (this.mUriParams || ""));
        return url;
    },

    get mLocationPath() {
        return this.ensureDecodedPath(this.calendarUri.path);
    },

    getItemLocationPath: function caldav_getItemLocationPath(aItem) {
        if (aItem.id &&
            aItem.id in this.mItemInfoCache &&
            this.mItemInfoCache[aItem.id].locationPath) {
            // modifying items use the cached location path
            return this.mItemInfoCache[aItem.id].locationPath;
        } else {
            // New items just use id.ics
            return aItem.id + ".ics";
        }
    },

    getProperty: function caldav_getProperty(aName) {
        if (aName in this.mACLProperties && this.mACLProperties[aName]) {
            return this.mACLProperties[aName];
        }

        switch (aName) {
            case "organizerId":
                if (this.calendarUserAddress) {
                    return this.calendarUserAddress;
                } // else use configured email identity
                break;
            case "organizerCN":
                return null; // xxx todo
            case "itip.transport":
                if (this.hasAutoScheduling || this.hasScheduling) {
                    return this.QueryInterface(Components.interfaces.calIItipTransport);
                } // else use outbound email-based iTIP (from cal.ProviderBase)
                break;
            case "capabilities.tasks.supported":
                return (this.supportedItemTypes.indexOf("VTODO") > -1);
            case "capabilities.events.supported":
                return (this.supportedItemTypes.indexOf("VEVENT") > -1);
            case "capabilities.autoschedule.supported":
                return this.hasAutoScheduling;
        }
        return this.__proto__.__proto__.getProperty.apply(this, arguments);
    },

    promptOverwrite: function caldav_promptOverwrite(aMethod, aItem, aListener, aOldItem) {
        let overwrite = cal.promptOverwrite(aMethod, aItem, aListener, aOldItem);
        if (overwrite) {
            if (aMethod == CALDAV_MODIFY_ITEM) {
                this.doModifyItem(aItem, aOldItem, aListener, true);
            } else {
                this.doDeleteItem(aItem, aListener, true, false, null);
            }
        } else {
            this.getUpdatedItem(aItem, aListener);
        }
    },

    mItemInfoCache: null,

    mHrefIndex: null,

    /**
     * addItem()
     * we actually use doAdoptItem()
     *
     * @param aItem       item to add
     * @param aListener   listener for method completion
     */
    addItem: function caldav_addItem(aItem, aListener) {
        return this.doAdoptItem(aItem.clone(), aListener);
    },

    /**
     * adoptItem()
     * we actually use doAdoptItem()
     *
     * @param aItem       item to check
     * @param aListener   listener for method completion
     */
    adoptItem: function caldav_adoptItem(aItem, aListener) {
        return this.doAdoptItem(aItem, aListener);
    },

    /**
     * Performs the actual addition of the item to CalDAV store
     *
     * @param aItem       item to add
     * @param aListener   listener for method completion
     * @param aIgnoreEtag flag to indicate ignoring of Etag
     */
    doAdoptItem: function caldav_doAdoptItem(aItem, aListener, aIgnoreEtag) {
        let notifyListener = (status, detail, pure=false) => {
            let method = pure ? "notifyPureOperationComplete" : "notifyOperationComplete";
            this[method](aListener, status, cIOL.ADD, aItem.id, detail);
        };
        if (aItem.id == null && aItem.isMutable) {
            aItem.id = cal.getUUID();
        }

        if (aItem.id == null) {
            return notifyListener(Components.results.NS_ERROR_FAILURE,
                                  "Can't set ID on non-mutable item to addItem");
        }

        if (!isItemSupported(aItem, this)) {
            return notifyListener(Components.results.NS_ERROR_FAILURE,
                                  "Server does not support item type");
        }

        let parentItem = aItem.parentItem;
        parentItem.calendar = this.superCalendar;

        let locationPath = this.getItemLocationPath(parentItem);
        let itemUri = this.makeUri(locationPath);
        cal.LOG("CalDAV: itemUri.spec = " + itemUri.spec);

        let thisCalendar = this;
        let serializedItem = this.getSerializedItem(aItem);
        let addListener = {
            onStreamComplete: function onPutComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
                let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
                let listenerStatus = Components.results.NS_OK;
                let listenerDetail = parentItem;
                try {
                    var responseStatus = request.responseStatus;

                    if (thisCalendar.verboseLogging()) {
                        let str = cal.convertByteArray(aResult, aResultLength);
                        cal.LOG("CalDAV: recv: " + (str || ""));
                    }
                } catch (ex) {
                    listenerStatus = ex.result
                    listenerDetail = "Request Failed: " + ex.message;
                    cal.LOG("CalDAV: Request error during add: " + ex);
                }


                // Translate the HTTP status code to a status and message for the listener
                if (responseStatus == 201 || responseStatus == 204) {
                    // 201 = HTTP "Created"
                    // 204 = HTTP "No Content"
                    cal.LOG("CalDAV: Item added to " + thisCalendar.name + " successfully");

                    // TODO: onOpComplete adds the item to the cache, probably after getUpdatedItem!

                    // Some CalDAV servers will modify items on PUT (add X-props,
                    // for instance) so we'd best re-fetch in order to know
                    // the current state of the item
                    // Observers will be notified in getUpdatedItem()
                    thisCalendar.getUpdatedItem(parentItem, aListener);
                    return;
                } else if (responseStatus >= 500 && responseStatus <= 510) {
                    listenerStatus = Components.results.NS_ERROR_NOT_AVAILABLE;
                    listenerDetail = "Server Replied with " + responseStatus;
                } else if (responseStatus) {
                    // There is a response status, but we haven't handled it yet. Any
                    // error occurring here should consider being handled!
                    cal.ERROR("CalDAV: Unexpected status adding item to " +
                              thisCalendar.name + ": " + responseStatus + "\n" +
                              serializedItem);

                    listenerStatus = Components.results.NS_ERROR_FAILURE;
                    listenerDetail = "Server Replied with " + responseStatus;
                }

                // Still need to visually notify for uncached calendars.
                if (!thisCalendar.isCached && !Components.isSuccessCode(listenerStatus)) {
                    thisCalendar.reportDavError(calIErrors.DAV_PUT_ERROR, listenerStatus, listenerDetail);
                }

                // Finally, notify listener.
                notifyListener(listenerStatus, listenerDetail, true);
            }
        };

        this.sendHttpRequest(itemUri, serializedItem, MIME_TEXT_CALENDAR, null, (channel) => {
            if (!aIgnoreEtag) {
                channel.setRequestHeader("If-None-Match", "*", false);
            }
            return addListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * modifyItem(); required by calICalendar.idl
     * we actually use doModifyItem()
     *
     * @param aItem       item to check
     * @param aListener   listener for method completion
    */
    modifyItem: function caldav_modifyItem(aNewItem, aOldItem, aListener) {
        return this.doModifyItem(aNewItem, aOldItem, aListener, false);
    },

    /**
     * Modifies existing item in CalDAV store.
     *
     * @param aItem       item to check
     * @param aOldItem    previous version of item to be modified
     * @param aListener   listener from original request
     * @param aIgnoreEtag ignore item etag
     */
    doModifyItem: function caldav_doModifyItem(aNewItem, aOldItem, aListener, aIgnoreEtag){
        let notifyListener = (status, detail, pure=false) => {
            let method = pure ? "notifyPureOperationComplete" : "notifyOperationComplete";
            this[method](aListener, status, cIOL.MODIFY, aNewItem.id, detail);
        };
        if (aNewItem.id == null) {
            return notifyListener(Components.results.NS_ERROR_FAILURE,
                                  "ID for modifyItem doesn't exist or is null");
        }

        let wasInboxItem = this.mItemInfoCache[aNewItem.id].isInboxItem;

        let newItem_ = aNewItem;
        aNewItem = aNewItem.parentItem.clone();
        if (newItem_.parentItem != newItem_) {
            aNewItem.recurrenceInfo.modifyException(newItem_, false);
        }
        aNewItem.generation += 1;

        var eventUri = this.makeUri(this.mItemInfoCache[aNewItem.id].locationPath);

        var thisCalendar = this;

        var modifiedItemICS = this.getSerializedItem(aNewItem);

        let modListener = {
            onStreamComplete: function caldav_mod_onStreamComplete(aLoader, aContext, aStatus,
                                                                   aResultLength, aResult) {
                let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
                let listenerStatus = Components.results.NS_OK;
                let listenerDetail = aNewItem;
                try {
                    var responseStatus = request.responseStatus;

                    if (thisCalendar.verboseLogging()) {
                       let str = cal.convertByteArray(aResult, aResultLength);
                       cal.LOG("CalDAV: recv: " + (str || ""));
                    }
                } catch (ex) {
                    listenerStatus = ex.result
                    listenerDetail = "Request Failed: " + ex.message;
                    cal.LOG("CalDAV: Request error during add: " + ex);
                }

                if (responseStatus == 204 || responseStatus == 201 || responseStatus == 200) {
                    // We should not accept a 201 status here indefinitely: it indicates a server error
                    // of some kind that we want to know about. It's convenient to accept it for now
                    // since a number of server impls don't get this right yet.
                    cal.LOG("CalDAV: Item modified successfully on " + thisCalendar.name);

                    // Some CalDAV servers will modify items on PUT (add X-props,
                    // for instance) so we'd best re-fetch in order to know
                    // the current state of the item
                    // Observers will be notified in getUpdatedItem()
                    thisCalendar.getUpdatedItem(aNewItem, aListener);

                    // SOGo has calendarUri == inboxUri so we need to be careful
                    // about deletions
                    if (wasInboxItem && thisCalendar.mShouldPollInbox) {
                        thisCalendar.doDeleteItem(aNewItem, null, true, true, null);
                    }
                    return;
                } else if (responseStatus == 412 || responseStatus == 409) {
                    // promptOverwrite will ask the user and then re-request
                    thisCalendar.promptOverwrite(CALDAV_MODIFY_ITEM, aNewItem,
                                                 aListener, aOldItem);
                    return;
                } else if (responseStatus >= 500 && responseStatus <= 510) {
                    listenerStatus = Components.results.NS_ERROR_NOT_AVAILABLE;
                    listenerDetail = "Server Replied with " + responseStatus;
                } else if (responseStatus) {
                    // There is a response status, but we haven't handled it yet. Any
                    // error occurring here should consider being handled!
                    cal.ERROR("CalDAV: Unexpected status modifying item to " +
                              thisCalendar.name + ": " + responseStatus + "\n" +
                              modifiedItemICS);

                    listenerStatus = Components.results.NS_ERROR_FAILURE;
                    listenerDetail = "Server Replied with " + responseStatus;
                }

                // Still need to visually notify for uncached calendars.
                if (!thisCalendar.isCached && !Components.isSuccessCode(listenerStatus)) {
                    thisCalendar.reportDavError(calIErrors.DAV_PUT_ERROR, listenerStatus, listenerDetail);
                }

                notifyListener(listenerStatus, listenerDetail, true);
            }
        };

        this.sendHttpRequest(eventUri, modifiedItemICS, MIME_TEXT_CALENDAR, null, (channel) => {
            if (!aIgnoreEtag) {
                channel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aNewItem.id].etag,
                                         false);
            }
            return modListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * deleteItem(); required by calICalendar.idl
     * the actual deletion is done in doDeleteItem()
     *
     * @param aItem       item to delete
     * @param aListener   listener for method completion
     */
    deleteItem: function caldav_deleteItem(aItem, aListener) {
        return this.doDeleteItem(aItem, aListener, false, null, null);
    },

    /**
     * Deletes item from CalDAV store.
     *
     * @param aItem       item to delete
     * @param aListener   listener for method completion
     * @param aIgnoreEtag ignore item etag
     * @param aFromInbox  delete from inbox rather than calendar
     * @param aUri        uri of item to delete
     * */
    doDeleteItem: function caldav_doDeleteItem(aItem, aListener, aIgnoreEtag, aFromInbox, aUri){
        let notifyListener = (status, detail, pure=false) => {
            let method = pure ? "notifyPureOperationComplete" : "notifyOperationComplete";
            this[method](aListener, status, cIOL.DELETE, aItem.id, detail);
        };

        if (aItem.id == null) {
            return notifyListener(Components.results.NS_ERROR_FAILURE,
                                  "ID doesn't exist for deleteItem");
        }

        var eventUri;
        if (aUri) {
            eventUri = aUri;
        } else if (aFromInbox || this.mItemInfoCache[aItem.id].isInboxItem) {
            eventUri = this.makeUri(this.mItemInfoCache[aItem.id].locationPath, this.mInboxUrl);
        } else {
            eventUri = this.makeUri(this.mItemInfoCache[aItem.id].locationPath);
        }

        if (eventUri.path == this.calendarUri.path) {
            return notifyListener(Components.results.NS_ERROR_FAILURE,
                                  "eventUri and calendarUri paths are the same, " +
                                  "will not go on to delete entire calendar");
        }

        var thisCalendar = this;

        let delListener = {
            onStreamComplete: function caldav_dDI_del_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
                let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
                let listenerStatus = Components.results.NS_OK;
                let listenerDetail = aItem;
                try {
                    var responseStatus = request.responseStatus;

                    if (thisCalendar.verboseLogging()) {
                        let str = cal.convertByteArray(aResult, aResultLength);
                        cal.LOG("CalDAV: recv: " + (str || ""));
                    }
                } catch (ex) {
                    listenerStatus = ex.result
                    listenerDetail = "Request Failed: " + ex.message;
                    cal.LOG("CalDAV: Request error during delete: " + ex);
                }

                // 204 = HTTP "No content"
                // 404 = Not Found - This is kind of a success, since the item is already deleted.
                //
                if (responseStatus == 204 || responseStatus == 200 || responseStatus == 404) {
                    if (!aFromInbox) {
                        let decodedPath = thisCalendar.ensureDecodedPath(eventUri.path);
                        delete thisCalendar.mHrefIndex[decodedPath];
                        delete thisCalendar.mItemInfoCache[aItem.id];
                        cal.LOG("CalDAV: Item deleted successfully from calendar " + thisCalendar.name);

                        if (!thisCalendar.isCached) {
                            // If the calendar is not cached, we need to remove
                            // the item from our memory calendar now. The
                            // listeners will be notified there.
                            thisCalendar.mOfflineStorage.deleteItem(aItem, aListener);
                            return;
                        }
                    }
                } else if (responseStatus == 412 || responseStatus == 409) {
                    // item has either been modified or deleted by someone else check to see which
                    cal.LOG("CalDAV: Item has been modified on server, checking if it has been deleted");
                    thisCalendar.sendHttpRequest(eventUri, null, null, null, (channel) => {
                        channel.requestMethod = "HEAD";
                        return delListener2;
                    }, () => {
                        notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                                       "Error preparing http channel");
                    });
                    return
                } else if (responseStatus >= 500 && responseStatus <= 510) {
                    listenerStatus = Components.results.NS_ERROR_NOT_AVAILABLE;
                    listenerDetail = "Server Replied with " + responseStatus;
                } else if (responseStatus) {
                    cal.ERROR("CalDAV: Unexpected status deleting item from " +
                              thisCalendar.name + ": " + responseStatus + "\n" +
                              "uri: " + eventUri.spec);

                    listenerStatus = Components.results.NS_ERROR_FAILURE;
                    listenerDetail = "Server Replied with " + responseStatus;
                }

                // Still need to visually notify for uncached calendars.
                if (!thisCalendar.isCached && !Components.isSuccessCode(listenerStatus)) {
                    thisCalendar.reportDavError(calIErrors.DAV_REMOVE_ERROR, listenerStatus, listenerDetail);
                }

                // Finally, notify listener.
                notifyListener(listenerStatus, listenerDetail);
            }
        };

        let delListener2 = {
            onStreamComplete: function caldav_dDI_del2_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
                let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
                let listenerStatus = Components.results.NS_OK;
                let listenerDetail = aItem;
                try {
                    var responseStatus = request.responseStatus;

                    if (thisCalendar.verboseLogging()) {
                        let str = cal.convertByteArray(aResult, aResultLength);
                        cal.LOG("CalDAV: recv: " + (str || ""));
                    }
                } catch (ex) {
                    listenerStatus = ex.result
                    listenerDetail = "Request Failed: " + ex.message;
                    cal.LOG("CalDAV: Request error during add: " + ex);
                }

                if (responseStatus == 404) {
                    // Nothing to do (except notify the listener below)
                    // Someone else has already deleted it
                } else if (responseStatus >= 500 && responseStatus <= 510) {
                    listenerStatus = Components.results.NS_ERROR_NOT_AVAILABLE;
                    listenerDetail = "Server Replied with " + responseStatus;
                } else if (responseStatus) {
                    // The item still exists. We need to ask the user if he
                    // really wants to delete the item. Remember, we only
                    // made this request since the actual delete gave 409/412
                    thisCalendar.promptOverwrite(CALDAV_DELETE_ITEM, aItem, aListener, null);
                    return;
                }

                // Finally, notify listener.
                notifyListener(listenerstatus, listenerDetail, true);
            }
        };

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: Deleting " + eventUri.spec);
        }

        this.sendHttpRequest(eventUri, null, null, null, (channel) => {
            if (!aIgnoreEtag) {
                let etag = this.mItemInfoCache[aItem.id].etag;
                cal.LOG("CalDAV: Will only delete if matches etag " + etag);
                channel.setRequestHeader("If-Match", etag, false);
            }
            channel.requestMethod = "DELETE";
            return delListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * Add an item to the target calendar
     *
     * @param path      Item path MUST NOT BE ENCODED
     * @param calData   iCalendar string representation of the item
     * @param aUri      Base URI of the request
     * @param aListener Listener
     */
    addTargetCalendarItem : function caldav_addTargetCalendarItem(path,calData,aUri, etag, aListener) {
        let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                               .createInstance(Components.interfaces.calIIcsParser);
        // aUri.path may contain double slashes whereas path does not
        // this confuses our counting, so remove multiple successive slashes
        let strippedUriPath = aUri.path.replace(/\/{2,}/g, "/");
        let uriPathComponentLength = strippedUriPath.split("/").length;
        try {
            parser.parseString(calData);
        } catch (e) {
            // Warn and continue.
            // TODO As soon as we have activity manager integration,
            // this should be replace with logic to notify that a
            // certain event failed.
            cal.WARN("Failed to parse item: " + calData + "\n\nException:" + e);
            return;
        }
        // with CalDAV there really should only be one item here
        let items = parser.getItems({});
        let propertiesList = parser.getProperties({});
        let method;
        for each (var prop in propertiesList) {
            if (prop.propertyName == "METHOD") {
                method = prop.value;
                break;
            }
        }
        let isReply = (method == "REPLY");
        let item = items[0];
        if (!item) {
            cal.WARN("Failed to parse item: " + calData);
            return;
        }

        item.calendar = this.superCalendar;
        if (isReply && this.isInbox(aUri.spec)) {
            if (this.hasScheduling) {
                this.processItipReply(item, path);
            }
            cal.WARN("REPLY method but calendar does not support scheduling");
            return;
        }

        // Strip of the same number of components as the request
        // uri's path has. This way we make sure to handle servers
        // that pass paths like /dav/user/Calendar while
        // the request uri is like /dav/user@example.org/Calendar.
        let resPathComponents = path.split("/");
        resPathComponents.splice(0, uriPathComponentLength - 1);
        let locationPath = resPathComponents.join("/");
        let isInboxItem = this.isInbox(aUri.spec);

        if (this.mHrefIndex[path] &&
            !this.mItemInfoCache[item.id]) {
            // If we get here it means a meeting has kept the same filename
            // but changed its uid, which can happen server side.
            // Delete the meeting before re-adding it
            this.deleteTargetCalendarItem(path);
        }

        if (this.mItemInfoCache[item.id]) {
            this.mItemInfoCache[item.id].isNew = false;
        } else {
            this.mItemInfoCache[item.id] = { isNew: true };
        }
        this.mItemInfoCache[item.id].locationPath = locationPath;
        this.mItemInfoCache[item.id].isInboxItem = isInboxItem;

        this.mHrefIndex[path] = item.id;
        this.mItemInfoCache[item.id].etag = etag;

        let needsAddModify = false;
        if (this.isCached) {
            this.setMetaData(item.id, path, etag, isInboxItem);

            // If we have a listener, then the caller will take care of adding the item
            // Otherwise, we have to do it ourself
            // XXX This is quite fragile, but saves us a double modify/add

            if (aListener) {
                // In the cached case, notifying operation complete will add the item to the cache
                if (this.mItemInfoCache[item.id].isNew) {
                    this.notifyOperationComplete(aListener,
                                                 Components.results.NS_OK,
                                                 cIOL.ADD,
                                                 item.id,
                                                 item);
                } else {
                    this.notifyOperationComplete(aListener,
                                                 Components.results.NS_OK,
                                                 cIOL.MODIFY,
                                                 item.id,
                                                 item);
                }
            } else {
                // No listener, we'll have to add it ourselves
                needsAddModify = true;
            }
        } else {
            // In the uncached case, we need to do so ourselves
            needsAddModify = true;
        }

        // Now take care of the add/modify if needed.
        if (needsAddModify) {
            if (this.mItemInfoCache[item.id].isNew) {
                this.mOfflineStorage.adoptItem(item, aListener);
            } else {
                this.mOfflineStorage.modifyItem(item, null, aListener);
            }
        }
    },

    /**
     * Deletes an item from the target calendar
     *
     * @param path Path of the item to delete, must not be encoded
     */
    deleteTargetCalendarItem: function caldav_deleteTargetCalendarItem(path) {
        let foundItem;
        let isDeleted = false;
        let getItemListener = {
            onGetResult: function deleteLocalItem_getItem_onResult(aCalendar,
                                                     aStatus,
                                                     aItemType,
                                                     aDetail,
                                                     aCount,
                                                     aItems) {

                foundItem = aItems[0];
            },
            onOperationComplete: function deleteLocalItem_getItem_onOperationComplete() {}
        };

        this.mOfflineStorage.getItem(this.mHrefIndex[path],
                                     getItemListener);
        // Since the target calendar's operations are synchronous, we can
        // safely set variables from this function.
        if (foundItem) {
            let wasInboxItem = this.mItemInfoCache[foundItem.id].isInboxItem;
            if ((wasInboxItem && this.isInbox(path)) ||
                (wasInboxItem === false && !this.isInbox(path))) {

                cal.LOG("CalDAV: deleting item: " + path + ", uid: " + foundItem.id);
                delete this.mHrefIndex[path];
                delete this.mItemInfoCache[foundItem.id];
                if (this.isCached) {
                    this.mOfflineStorage.deleteMetaData(foundItem.id);
                }
                this.mOfflineStorage.deleteItem(foundItem,
                                                getItemListener);
                isDeleted = true;
            }
        }
        return isDeleted;
    },

    /**
     * Perform tasks required after updating items in the calendar such as
     * notifying the observers and listeners
     *
     * @param aChangeLogListener    Change log listener
     * @param calendarURI           URI of the calendar whose items just got
     *                              changed
     */
    finalizeUpdatedItems: function calDav_finalizeUpdatedItems(aChangeLogListener, calendarURI) {
        cal.LOG("aChangeLogListener=" + aChangeLogListener + "\n" +
                "calendarURI=" + (calendarURI?calendarURI.spec:"undefined") + " \n" +
                "iscached=" + this.isCached + "\n"+
                "this.mQueuedQueries.length=" + this.mQueuedQueries.length);
        if (this.isCached) {
            if (aChangeLogListener) {
                aChangeLogListener.onResult({ status: Components.results.NS_OK },
                                            Components.results.NS_OK);
            }
        } else {
            this.mObservers.notify("onLoad", [this]);
        }

        this.mFirstRefreshDone = true;
        while (this.mQueuedQueries.length) {
            let query = this.mQueuedQueries.pop();
            this.mOfflineStorage.getItems
                .apply(this.mOfflineStorage, query);
        }
        if (this.hasScheduling &&
            !this.isInbox(calendarURI.spec)) {
            this.pollInbox();
        }
    },

    /**
     * Notifies the caller that a get request has failed.
     *
     * @param errorMsg           Error message
     * @param aListener          (optional) Listener of the request
     * @param aChangeLogListener (optional)Listener for cached calendars
     */
    notifyGetFailed: function notifyGetFailed(errorMsg, aListener, aChangeLogListener) {
         cal.WARN("CalDAV: Get failed: " + errorMsg);

         // Notify changelog listener
         if (this.isCached && aChangeLogListener) {
             aChangeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                         Components.results.NS_ERROR_FAILURE);
         }

         // Notify operation listener
         this.notifyOperationComplete(aListener,
                                      Components.results.NS_ERROR_FAILURE,
                                      cIOL.GET,
                                      null,
                                      errorMsg);
         // If an error occurrs here, we also need to unqueue the
         // requests previously queued.
         while (this.mQueuedQueries.length) {
             let [,,,,listener] = this.mQueuedQueries.pop();
             try {
                 listener.onOperationComplete(this.superCalendar,
                                              Components.results.NS_ERROR_FAILURE,
                                              cIOL.GET,
                                              null,
                                              errorMsg);
             } catch (e) {
                 cal.ERROR(e);
             }
         }
     },

    /**
     * Retrieves a specific item from the CalDAV store.
     * Use when an outdated copy of the item is in hand.
     *
     * @param aItem       item to fetch
     * @param aListener   listener for method completion
     */
    getUpdatedItem: function caldav_getUpdatedItem(aItem, aListener, aChangeLogListener) {

        if (aItem == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         cIOL.GET,
                                         null,
                                         "passed in null item");
            return;
        }

        let locationPath = this.getItemLocationPath(aItem);
        let itemUri = this.makeUri(locationPath);

        let multiget = new multigetSyncHandler([this.ensureDecodedPath(itemUri.path)],
                                               this,
                                               this.makeUri(),
                                               null,
                                               aListener,
                                               aChangeLogListener);
        multiget.doMultiGet();
    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function caldav_getItem(aId, aListener) {
        this.mOfflineStorage.getItem(aId, aListener);
    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function caldav_getItems(aItemFilter, aCount, aRangeStart,
                                       aRangeEnd, aListener) {
        if (this.isCached) {
            if (this.mOfflineStorage) {
                this.mOfflineStorage.getItems.apply(this.mOfflineStorage, arguments);
            } else {
                this.notifyOperationComplete(aListener,
                                             Components.results.NS_OK,
                                             cIOL.GET,
                                             null,
                                             null);
            }
        } else {
            if (!this.checkedServerInfo) {
                this.mQueuedQueries.push(arguments);
            } else {
                this.mOfflineStorage.getItems.apply(this.mOfflineStorage, arguments);
            }
        }
    },

    fillACLProperties: function caldav_fillACLProperties() {
        let orgId = this.calendarUserAddress;
        if (orgId) {
            this.mACLProperties["organizerId"] = orgId;
        }

        if (this.mACLEntry && this.mACLEntry.hasAccessControl) {
            let ownerIdentities = this.mACLEntry.getOwnerIdentities({});
            if (ownerIdentities.length > 0) {
                let identity = ownerIdentities[0];
                this.mACLProperties["organizerId"] = identity.email;
                this.mACLProperties["organizerCN"] = identity.fullName;
                this.mACLProperties["imip.identity"] = identity;
            }
        }
    },

    safeRefresh: function caldav_safeRefresh(aChangeLogListener) {
        let notifyListener = (status) => {
            if (this.isCached && aChangeLogListener) {
                aChangeLogListener.onResult({ status: status }, status);
            }
        };

        if (!this.mACLEntry) {
            let thisCalendar = this;
            let opListener = {
                onGetResult: function(calendar, status, itemType, detail, count, items) {
                    ASSERT(false, "unexpected!");
                },
                onOperationComplete: function(opCalendar, opStatus, opType, opId, opDetail) {
                    thisCalendar.mACLEntry = opDetail;
                    thisCalendar.fillACLProperties();
                    thisCalendar.safeRefresh(aChangeLogListener);
                }
            };

            this.aclManager.getCalendarEntry(this, opListener);
            return;
        }

        this.ensureTargetCalendar();

        if (this.mAuthScheme == "Digest") {
            // the auth could have timed out and be in need of renegotiation
            // we can't risk several calendars doing this simultaneously so
            // we'll force the renegotiation in a sync query, using OPTIONS to keep
            // it quick
            let headchannel = cal.prepHttpChannel(this.makeUri(), null, null, this);
            headchannel.requestMethod = "OPTIONS";
            headchannel.open();
            headchannel.QueryInterface(Components.interfaces.nsIHttpChannel);
            try {
              if (headchannel.responseStatus != 200) {
                throw "OPTIONS returned unexpected status code: " + headchannel.responseStatus;
              }
            }
            catch (e) {
                cal.WARN("CalDAV: Exception: " + e);
                notifyListener(Components.results.NS_ERROR_FAILURE);
            }
        }

        // Call getUpdatedItems right away if its the first refresh
        // *OR* if webdav Sync is enabled (It is redundant to send a request
        // to get the collection tag (getctag) on a calendar if it supports
        // webdav sync, the sync request will only return data if something
        // changed).
        if (!this.mCtag || !this.mFirstRefreshDone || this.mHasWebdavSyncSupport ) {
            this.getUpdatedItems(this.calendarUri, aChangeLogListener);
            return;
        }
        let thisCalendar = this;
        let queryXml =
            xmlHeader +
            '<D:propfind xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/">' +
              '<D:prop>' +
                '<CS:getctag/>' +
              '</D:prop>' +
            '</D:propfind>';

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send(" + this.makeUri().spec + "): " + queryXml);
        }

        var streamListener = {};
        streamListener.onStreamComplete =
            function safeRefresh_safeRefresh_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            try {
                cal.LOG("CalDAV: Status " + request.responseStatus +
                        " checking ctag for calendar " + thisCalendar.name);
            } catch (ex) {
                cal.LOG("CalDAV: Error without status on checking ctag for calendar " +
                        thisCalendar.name);
                return notifyListener(Components.results.NS_OK);
            }

            if (request.responseStatus == 404) {
                cal.LOG("CalDAV: Disabling calendar " + thisCalendar.name +
                        " due to 404");
                return notifyListener(Components.results.NS_ERROR_FAILURE);
            } else if (request.responseStatus == 207 && thisCalendar.mDisabled) {
                // Looks like the calendar is there again, check its resource
                // type first.
                thisCalendar.setupAuthentication(aChangeLogListener);
                return;
             }

            let str = cal.convertByteArray(aResult, aResultLength);
            if (!str) {
                cal.LOG("CalDAV: Failed to get ctag from server for calendar " +
                        thisCalendar.name);
            } else if (thisCalendar.verboseLogging()) {
                cal.LOG("CalDAV: recv: " + str);
            }

            try {
                var multistatus = cal.xml.parseString(str);
            } catch (ex) {
                cal.LOG("CalDAV: Failed to get ctag from server for calendar " +
                        thisCalendar.name);
                return notifyListener(Components.results.NS_OK);
            }

            let ctag = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/CS:getctag/text()");
            if (!ctag || ctag != thisCalendar.mCtag) {
                // ctag mismatch, need to fetch calendar-data
                thisCalendar.mCtag = ctag;
                thisCalendar.saveCalendarProperties();
                thisCalendar.getUpdatedItems(thisCalendar.calendarUri,
                                             aChangeLogListener);
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: ctag mismatch on refresh, fetching data for " +
                            "calendar " + thisCalendar.name);

                }
            } else {
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: ctag matches, no need to fetch data for " +
                            "calendar " + thisCalendar.name);
                }

                // Notify the listener, but don't return just yet...
                notifyListener(Components.results.NS_OK);

                // ...we may still need to poll the inbox
                if (thisCalendar.firstInRealm()) {
                    thisCalendar.pollInbox();
                }
            }
        };

        this.sendHttpRequest(this.makeUri(), queryXml, MIME_TEXT_XML, null, (channel) => {
            channel.setRequestHeader("Depth", "0", false);
            channel.requestMethod = "PROPFIND";
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE);
        });
    },

    refresh: function caldav_refresh() {
        this.replayChangesOn(null);
    },

    firstInRealm: function caldav_firstInRealm() {
        var calendars = getCalendarManager().getCalendars({});
        for (var i = 0; i < calendars.length ; i++) {
            if (calendars[i].type != "caldav") {
                continue;
            }
            // XXX We should probably expose the inner calendar via an
            // interface, but for now use wrappedJSObject.
            var calendar = calendars[i].wrappedJSObject;
            if (calendar.mUncachedCalendar) {
                calendar = calendar.mUncachedCalendar;
            }
            if (calendar.uri.prePath == this.uri.prePath &&
                calendar.authRealm == this.mAuthRealm) {
                if (calendar.id == this.id) {
                    return true;
                }
                break;
            }
        }
        return false;
    },

    /**
     * Get updated items
     *
     * @param aUri                  The uri to request the items from.
     *                                NOTE: This must be the uri without any uri
     *                                     params. They will be appended in this
     *                                     function.
     * @param aChangeLogListener    (optional) The listener to notify for cached
     *                                         calendars.
     */
    getUpdatedItems: function caldav_getUpdatedItems(aUri, aChangeLogListener) {
        if (this.mDisabled) {
            // check if maybe our calendar has become available
            this.setupAuthentication(aChangeLogListener);
            return;
        }

        if (this.mHasWebdavSyncSupport) {
            webDavSync = new webDavSyncHandler(this,aUri,aChangeLogListener);
            webDavSync.doWebDAVSync();
            return;
        }

        let queryXml =
            xmlHeader +
            '<D:propfind xmlns:D="DAV:">' +
              '<D:prop>' +
                '<D:getcontenttype/>' +
                '<D:resourcetype/>' +
                '<D:getetag/>' +
              '</D:prop>' +
            '</D:propfind>';

        let requestUri = this.makeUri(null, aUri);
        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send(" + requestUri.spec + "): " + queryXml);
        }

        this.sendHttpRequest(requestUri, queryXml, MIME_TEXT_XML, null, (channel) => {
            channel.requestMethod = "PROPFIND";
            channel.setRequestHeader("Depth", "1", false);
            return new etagsHandler(this, aUri, aChangeLogListener);
        }, () => {
            if (aChangeLogListener && this.isCached) {
                aChangeLogListener.onResult({ status: Components.results.NS_ERROR_NOT_AVAILABLE },
                                            Components.results.NS_ERROR_NOT_AVAILABLE);
            }
        }, false);
    },

    /**
     * @see nsIInterfaceRequestor
     * @see calProviderUtils.jsm
     */
    getInterface: cal.InterfaceRequestor_getInterface,

    //
    // Helper functions
    //

    /**
     * Sets up any needed prerequisites regarding authentication. This is the
     * beginning of a chain of asynchronous calls. This function will, when
     * done, call the next function related to checking resource type, server
     * capabilties, etc.
     *
     * setupAuthentication                         * You are here
     * checkDavResourceType
     * checkServerCaps
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    setupAuthentication: function(aChangeLogListener) {
        let self = this;
        function authSuccess() {
            self.checkDavResourceType(aChangeLogListener);
        }
        function authFailed() {
            self.setProperty("disabled", "true");
            self.setProperty("auto-enabled", "true");
            self.completeCheckServerInfo(aChangeLogListener, Components.results.NS_ERROR_FAILURE);
        }
        function connect() {
            // Use the async prompter to avoid multiple master password prompts
            let promptlistener = {
                onPromptStart: function() {
                    // Usually this function should be synchronous. The OAuth
                    // connection itself is asynchronous, but if a master
                    // password is prompted it will block on that.
                    this.onPromptAuthAvailable();
                    return true;
                },

                onPromptAuthAvailable: function() {
                    self.oauth.connect(authSuccess, authFailed, true);
                },
                onPromptCanceled: authFailed
            };
            let asyncprompter = Components.classes["@mozilla.org/messenger/msgAsyncPrompter;1"]
                                          .getService(Components.interfaces.nsIMsgAsyncPrompter);
            asyncprompter.queueAsyncAuthPrompt(self.uri.spec, false, promptlistener);
        }
        if (this.mUri.host == "apidata.googleusercontent.com") {
            if (!this.oauth) {
                this.oauth = new OAuth2(OAUTH_BASE_URI, OAUTH_SCOPE,
                                        OAUTH_CLIENT_ID, OAUTH_HASH);
                let sessionId = this.id;
                let pwMgrId = "Google CalDAV v2";

                Object.defineProperty(this.oauth, "refreshToken", {
                    get: function getRefreshToken() {
                        if (!this.mRefreshToken) {
                            var pass = { value: null };
                            try {
                                cal.auth.passwordManagerGet(sessionId, pass, sessionId, pwMgrId);
                            } catch (e if e.result == Components.results.NS_ERROR_ABORT) {
                                // User might have cancelled the master password prompt, thats ok
                            }
                            this.mRefreshToken = pass.value;
                        }
                        return this.mRefreshToken;
                    },
                    set: function setRefreshToken(val) {
                        try {
                            if (!val) {
                                cal.auth.passwordManagerRemove(sessionId, sessionId, pwMgrId);
                            } else {
                                cal.auth.passwordManagerSave(sessionId, val, sessionId, pwMgrId);
                            }
                        } catch (e if e.result == Components.results.NS_ERROR_ABORT) {
                            // User might have cancelled the master password prompt, thats ok
                        }
                        return (this.mRefreshToken = val);
                    },
                    enumerable: true
                });
            }

            if (this.oauth.accessToken) {
                authSuccess();
            } else {
                // bug 901329: If the calendar window isn't loaded yet the
                // master password prompt will show just the buttons and
                // possibly hang. If we postpone until the window is loaded,
                // all is well.
                function postpone() {
                    let win = cal.getCalendarWindow();
                    if (!win || win.document.readyState != "complete") {
                        setTimeout(postpone, 0);
                    } else {
                        connect();
                    }
                }

                setTimeout(postpone, 0);
            }
        } else {
            authSuccess();
        }
    },

    /**
     * Checks that the calendar URI exists and is a CalDAV calendar.
     *
     * setupAuthentication
     * checkDavResourceType                        * You are here
     * checkServerCaps
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    checkDavResourceType: function caldav_checkDavResourceType(aChangeLogListener) {
        this.ensureTargetCalendar();

        let resourceTypeXml = null;
        let resourceType = kDavResourceTypeNone;
        let thisCalendar = this;

        let queryXml =
            xmlHeader +
            '<D:propfind xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
              '<D:prop>' +
                '<D:resourcetype/>' +
                '<D:owner/>' +
                '<D:current-user-principal/>' +
                '<D:supported-report-set/>' +
                '<C:supported-calendar-component-set/>' +
                '<CS:getctag/>' +
              '</D:prop>' +
            '</D:propfind>';

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send: " + queryXml);
        }
        var streamListener = {};

        streamListener.onStreamComplete =
            function checkDavResourceType_oSC(aLoader, aContext, aStatus, aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            try {
                cal.LOG("CalDAV: Status " + request.responseStatus +
                        " on initial PROPFIND for calendar " + thisCalendar.name);
            } catch (ex) {
                cal.LOG("CalDAV: Error without status on initial PROPFIND for calendar " +
                        thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            }

            let responseStatusCategory = Math.floor(request.responseStatus / 100);

            // 4xx codes, which is either an authentication failure or
            // something like method not allowed. This is a failure worth
            // disabling the calendar.
            if (responseStatusCategory == 4) {
                thisCalendar.setProperty("disabled", "true");
                thisCalendar.setProperty("auto-enabled", "true");
                thisCalendar.completeCheckServerInfo(aChangeLogListener, Components.results.NS_ERROR_ABORT);
                return;
            }

            // 5xx codes, a server error. This could be a temporary failure,
            // i.e a backend server being disabled.
            if (responseStatusCategory == 5) {
                cal.LOG("CalDAV: Server not available " + request.responseStatus +
                        ", abort sync for calendar " + thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener, Components.results.NS_ERROR_ABORT);
                return;
            }

            var wwwauth;
            try {
                wwwauth = request.getRequestHeader("Authorization");
                thisCalendar.mAuthScheme = wwwauth.split(" ")[0];
            } catch (ex) {
                // no auth header could mean a public calendar
                thisCalendar.mAuthScheme = "none";
            }

            if (thisCalendar.mUriParams) {
                thisCalendar.mAuthScheme = "Ticket";
            }
            cal.LOG("CalDAV: Authentication scheme for " + thisCalendar.name +
                    " is " + thisCalendar.mAuthScheme);
            // we only really need the authrealm for Digest auth
            // since only Digest is going to time out on us
            if (thisCalendar.mAuthScheme == "Digest") {
                var realmChop = wwwauth.split("realm=\"")[1];
                thisCalendar.mAuthRealm = realmChop.split("\", ")[0];
                cal.LOG("CalDAV: realm " + thisCalendar.mAuthRealm);
            }

            let str = cal.convertByteArray(aResult, aResultLength);
            if (!str || request.responseStatus == 404) {
                // No response, or the calendar no longer exists.
                cal.LOG("CalDAV: Failed to determine resource type for" +
                        thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            } else if (thisCalendar.verboseLogging()) {
                cal.LOG("CalDAV: recv: " + str);
            }

            try {
                var multistatus = cal.xml.parseString(str);
            } catch (ex) {
                cal.LOG("CalDAV: Failed to determine resource type for" +
                        thisCalendar.name + ": " + ex);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            }

            // check for webdav-sync capability
            // http://tools.ietf.org/html/draft-daboo-webdav-sync
            if (caldavXPath(multistatus, "/D:multistatus/D:response/D:propstat/D:prop" +
                                 "/D:supported-report-set/D:supported-report/D:report/D:sync-collection")) {
                cal.LOG("CalDAV: Collection has webdav sync support");
                thisCalendar.mHasWebdavSyncSupport = true;
            }

            // check for server-side ctag support only if webdav sync is not available
            let ctag = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/CS:getctag/text()");
            if (!thisCalendar.mHasWebdavSyncSupport && ctag) {
                // We compare the stored ctag with the one we just got, if
                // they don't match, we update the items in safeRefresh.
                if (ctag == thisCalendar.mCtag) {
                    thisCalendar.mFirstRefreshDone = true;
                }

                thisCalendar.mCtag = ctag;
                thisCalendar.saveCalendarProperties();
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: initial ctag " + ctag + " for calendar " +
                            thisCalendar.name);
                }
            }


            // Use supported-calendar-component-set if the server supports it; some do not
            // Accept name attribute from all namespaces to workaround Cosmo bug see bug 605378 comment 6
            let supportedComponents = caldavXPath(multistatus,
                "/D:multistatus/D:response/D:propstat/D:prop/C:supported-calendar-component-set/C:comp/@*[local-name()='name']");
            if (supportedComponents && supportedComponents.length) {
                thisCalendar.mSupportedItemTypes = [ compName
                    for each (compName in supportedComponents)
                    if (thisCalendar.mGenerallySupportedItemTypes.indexOf(compName) >= 0)
                ];
                cal.LOG("Adding supported items: " + thisCalendar.mSupportedItemTypes.join(",") + " for calendar: " + thisCalendar.name);
            }

            // check if owner is specified; might save some work
            let owner = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/D:owner/D:href/text()");
            let cuprincipal = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/D:current-user-principal/D:href/text()");
            if (cuprincipal) {
                thisCalendar.mPrincipalUrl = cuprincipal;
                cal.LOG("CalDAV: Found principal url from DAV:current-user-principal " + thisCalendar.mPrincipalUrl);
            } else if (owner) {
                thisCalendar.mPrincipalUrl = owner;
                cal.LOG("CalDAV: Found principal url from DAV:owner " + thisCalendar.mPrincipalUrl);
            }

            let resourceTypeXml = caldavXPath(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/D:resourcetype");
            if (!resourceTypeXml) {
                resourceType = kDavResourceTypeNone;
            } else if (caldavXPath(resourceTypeXml[0], "C:calendar")) {
                resourceType = kDavResourceTypeCalendar;
            } else if (caldavXPath(resourceTypeXml[0], "D:collection")) {
                resourceType = kDavResourceTypeCollection;
            }

            if (resourceType == kDavResourceTypeNone &&
                !thisCalendar.mDisabled) {
                cal.LOG("CalDAV: No resource type received, " + thisCalendar.name + " doesn't seem to point to a DAV resource");
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            }

            if ((resourceType == kDavResourceTypeCollection) &&
                !thisCalendar.mDisabled) {
                cal.LOG("CalDAV: " + thisCalendar.name + " points to a DAV resource, but not a CalDAV calendar");
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.interfaces.calIErrors.DAV_DAV_NOT_CALDAV);
                return;
            }

            // if this calendar was previously offline we want to recover
            if ((resourceType == kDavResourceTypeCalendar) &&
                thisCalendar.mDisabled) {
                thisCalendar.mDisabled = false;
                thisCalendar.mReadOnly = false;
            }

            thisCalendar.setCalHomeSet(true);
            thisCalendar.checkServerCaps(aChangeLogListener);
        };

        this.sendHttpRequest(this.makeUri(), queryXml, MIME_TEXT_XML, null, (channel) => {
            channel.setRequestHeader("Depth", "0", false);
            channel.requestMethod = "PROPFIND";
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * Checks server capabilities.
     *
     * setupAuthentication
     * checkDavResourceType
     * checkServerCaps                              * You are here
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    checkServerCaps: function caldav_checkServerCaps(aChangeLogListener, calHomeSetUrlRetry) {
        let homeSet = this.makeUri(null, this.mCalHomeSet);
        var thisCalendar = this;

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send: OPTIONS " + homeSet.spec);
        }

        var streamListener = {};
        streamListener.onStreamComplete =
            function checkServerCaps_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            if (request.responseStatus != 200) {
                if (!calHomeSetUrlRetry && request.responseStatus == 404) {
                    // try again with calendar URL, see https://bugzilla.mozilla.org/show_bug.cgi?id=588799
                    cal.LOG("CalDAV: Calendar homeset was not found at parent url of calendar URL" +
                            " while querying options " + thisCalendar.name + ", will try calendar URL itself now");
                    thisCalendar.setCalHomeSet(false);
                    thisCalendar.checkServerCaps(aChangeLogListener, true);
                } else {
                    cal.LOG("CalDAV: Unexpected status " + request.responseStatus +
                            " while querying options " + thisCalendar.name);
                    thisCalendar.completeCheckServerInfo(aChangeLogListener, Components.results.NS_ERROR_FAILURE);
                }

                // No further processing needed, we have called subsequent (async) functions above.
                return;
            }

            let dav = null;
            try {
                dav = request.getResponseHeader("DAV");
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: DAV header: " + dav);
                }
            } catch (ex) {
                cal.LOG("CalDAV: Error getting DAV header for " + thisCalendar.name +
                        ", status " + request.responseStatus +
                        ", data: " + cal.convertByteArray(aResult, aResultLength));

            }
            // Google does not yet support OPTIONS but does support scheduling
            // so we'll spoof the DAV header until Google gets fixed
            if (thisCalendar.calendarUri.host == "www.google.com") {
                dav = "calendar-schedule";
                // Google also reports an inbox URL distinct from the calendar
                // URL but a) doesn't use it and b) 405s on etag queries to it
                thisCalendar.mShouldPollInbox = false;
            }
            if (dav && dav.indexOf("calendar-auto-schedule") != -1) {
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: Calendar " + thisCalendar.name +
                            " supports calendar-auto-schedule");
                }
                thisCalendar.hasAutoScheduling = true;
                // leave outbound inbox/outbox scheduling off
            } else if (dav && dav.indexOf("calendar-schedule") != -1) {
                if (thisCalendar.verboseLogging()) {
                    cal.LOG("CalDAV: Calendar " + thisCalendar.name +
                            " generally supports calendar-schedule");
                }
                thisCalendar.hasScheduling = true;
            }

            if (thisCalendar.hasAutoScheduling || (dav && dav.indexOf("calendar-schedule") != -1)) {
                // XXX - we really shouldn't register with the fb service
                // if another calendar with the same principal-URL has already
                // done so. We also shouldn't register with the fb service if we
                // don't have an outbox.
                if (!thisCalendar.hasFreeBusy) {
                    // This may have already been set by fetchCachedMetaData,
                    // we only want to add the freebusy provider once.
                    thisCalendar.hasFreeBusy = true;
                    getFreeBusyService().addProvider(thisCalendar);
                }
                thisCalendar.findPrincipalNS(aChangeLogListener);
            } else {
                cal.LOG("CalDAV: Server does not support CalDAV scheduling.");
                thisCalendar.completeCheckServerInfo(aChangeLogListener);
            }
        };

        this.sendHttpRequest(homeSet, null, null, null, (channel) => {
            channel.requestMethod = "OPTIONS";
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * Locates the principal namespace. This function should soely be called
     * from checkServerCaps to find the principal namespace.
     *
     * setupAuthentication
     * checkDavResourceType
     * checkServerCaps
     * findPrincipalNS                              * You are here
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    findPrincipalNS: function caldav_findPrincipalNS(aChangeLogListener) {
        if (this.principalUrl) {
            // We already have a principal namespace, use it.
            this.checkPrincipalsNameSpace([this.principalUrl],
                                          aChangeLogListener);
            return;
        }

        let homeSet = this.makeUri(null, this.mCalHomeSet);
        let thisCalendar = this;

        let queryXml =
            xmlHeader +
            '<D:propfind xmlns:D="DAV:">' +
              '<D:prop>' +
                '<D:principal-collection-set/>' +
              '</D:prop>' +
            '</D:propfind>';

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send: " + homeSet.spec + "\n"  + queryXml);
        }
        var streamListener = {};
        streamListener.onStreamComplete =
            function findInOutboxes_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            if (request.responseStatus != 207) {
                cal.LOG("CalDAV: Unexpected status " + request.responseStatus +
                    " while querying principal namespace for " + thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.results.NS_ERROR_FAILURE);
                return;
            }

            let str = cal.convertByteArray(aResult, aResultLength);
            if (!str) {
                cal.LOG("CalDAV: Failed to propstat principal namespace for " + thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.results.NS_ERROR_FAILURE);
                return;
            } else if (thisCalendar.verboseLogging()) {
                cal.LOG("CalDAV: recv: " + str);
            }

            try {
                var multistatus = cal.xml.parseString(str);
            } catch (ex) {
                cal.LOG("CalDAV: Failed to propstat principal namespace for " + thisCalendar.name);
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.results.NS_ERROR_FAILURE);
                return;
            }

            let pcs = caldavXPath(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/D:principal-collection-set/D:href/text()");
            let nsList = [];
            if (pcs) {
                nsList = pcs.map(function(x) thisCalendar.ensureDecodedPath(x));
            }

            thisCalendar.checkPrincipalsNameSpace(nsList, aChangeLogListener);
        };

        this.sendHttpRequest(homeSet, queryXml, MIME_TEXT_XML, null, (channel) => {
            channel.setRequestHeader("Depth", "0", false);
            channel.requestMethod = "PROPFIND";
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE);
        });
    },

    /**
     * Checks the principals namespace for scheduling info. This function should
     * soely be called from findPrincipalNS
     *
     * setupAuthentication
     * checkDavResourceType
     * checkServerCaps
     * findPrincipalNS
     * checkPrincipalsNameSpace                     * You are here
     * completeCheckServerInfo
     *
     * @param aNameSpaceList    List of available namespaces
     */
    checkPrincipalsNameSpace: function caldav_checkPrincipalsNameSpace(aNameSpaceList, aChangeLogListener) {
        var thisCalendar = this;
        function doesntSupportScheduling() {
            thisCalendar.hasScheduling = false;
            thisCalendar.mInboxUrl = null;
            thisCalendar.mOutboxUrl = null;
            thisCalendar.completeCheckServerInfo(aChangeLogListener);
        }

        if (!aNameSpaceList.length) {
            if (this.verboseLogging()) {
                cal.LOG("CalDAV: principal namespace list empty, calendar " +
                        this.name + " doesn't support scheduling");
            }
            doesntSupportScheduling();
            return;
        }

        // Remove trailing slash, if its there
        let homePath = this.ensureEncodedPath(this.mCalHomeSet.spec.replace(/\/$/,""));
        let queryXml, queryMethod, queryDepth;
        if (this.mPrincipalUrl) {
            queryXml =
                xmlHeader +
                '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
                  '<D:prop>' +
                    '<C:calendar-home-set/>' +
                    '<C:calendar-user-address-set/>' +
                    '<C:schedule-inbox-URL/>' +
                    '<C:schedule-outbox-URL/>' +
                  '</D:prop>' +
                '</D:propfind>';
            queryMethod = "PROPFIND";
            queryDepth = 0;
        } else {
            queryXml =
                xmlHeader +
                '<D:principal-property-search xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
                '<D:property-search>' +
                    '<D:prop>' +
                        '<C:calendar-home-set/>' +
                    '</D:prop>' +
                    '<D:match>' + cal.xml.escapeString(homePath) + '</D:match>' +
                '</D:property-search>' +
                    '<D:prop>' +
                        '<C:calendar-home-set/>' +
                        '<C:calendar-user-address-set/>' +
                        '<C:schedule-inbox-URL/>' +
                        '<C:schedule-outbox-URL/>' +
                    '</D:prop>' +
                '</D:principal-property-search>';
            queryMethod = "REPORT";
            queryDepth = 1;
        }

        // We want a trailing slash, ensure it.
        let nextNS = aNameSpaceList.pop().replace(/([^\/])$/, "$1/");
        let requestUri = makeURL(this.calendarUri.prePath + this.ensureEncodedPath(nextNS));

        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send: " + queryMethod + " " + requestUri.spec + "\n" + queryXml);
        }

        var streamListener = {};
        streamListener.onStreamComplete =
            function caldav_cPNS_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            let str = cal.convertByteArray(aResult, aResultLength);
            if (!str) {
                cal.LOG("CalDAV: Failed to report principals namespace for " + thisCalendar.name);
                doesntSupportScheduling();
                return;
            } else if (thisCalendar.verboseLogging()) {
                cal.LOG("CalDAV: recv: " + str);
            }

            if (request.responseStatus != 207) {
                cal.LOG("CalDAV: Bad response to in/outbox query, status " +
                    request.responseStatus);
                doesntSupportScheduling();
                return;
            }

            try {
                var multistatus = cal.xml.parseString(str);
            } catch (ex) {
                cal.LOG("CalDAV: Could not parse multistatus response: " + ex + "\n" + str);
                doesntSupportScheduling();
                return;
            }

            let homeSets = caldavXPath(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:calendar-home-set/D:href/text()");
            function homeSetMatches(homeSet) {
                let normalized = homeSet.replace(/([^\/])$/, "$1/");
                let chs = thisCalendar.mCalHomeSet;
                return normalized == chs.path || normalized == chs.spec;
            }

            // If there are multiple home sets, we need to match the email addresses for scheduling.
            // If there is only one, assume its the right one.
            // TODO with multiple address sets, we should just use the ACL manager.
            if (homeSets && (homeSets.length == 1 || homeSets.some(homeSetMatches))) {
                let cuaSets = caldavXPath(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:calendar-user-address-set/D:href/text()");
                for each (let addr in cuaSets) {
                    if (addr.match(/^mailto:/i)) {
                        thisCalendar.mCalendarUserAddress = addr;
                    }
                }

                function createBoxUrl(path) {
                    let url = thisCalendar.mUri.clone();
                    url.path = thisCalendar.ensureDecodedPath(path);
                    // Make sure the uri has a / at the end, as we do with the calendarUri.
                    if (url.path.charAt(url.path.length - 1) != '/') {
                        url.path += "/";
                    }
                    return url;
                }

                let inboxPath = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:schedule-inbox-URL/D:href/text()");
                if (!inboxPath) {
                    // most likely this is a Kerio server that omits the "href"
                    inboxPath = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:schedule-inbox-URL/text()");
                }
                thisCalendar.mInboxUrl = createBoxUrl(inboxPath);

                if (thisCalendar.calendarUri.spec == thisCalendar.mInboxUrl.spec) {
                    // If the inbox matches the calendar uri (i.e SOGo), then we
                    // don't need to poll the inbox.
                    thisCalendar.mShouldPollInbox = false;
                }

                let outboxPath = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:schedule-outbox-URL/D:href/text()");
                if (!outboxPath) {
                    // most likely this is a Kerio server that omits the "href"
                    outboxPath = caldavXPathFirst(multistatus, "/D:multistatus/D:response/D:propstat/D:prop/C:schedule-outbox-URL/text()");
                }
                thisCalendar.mOutboxUrl = createBoxUrl(outboxPath);
            }

            if (!thisCalendar.calendarUserAddress ||
                !thisCalendar.mInboxUrl ||
                !thisCalendar.mOutboxUrl) {
                if (aNameSpaceList.length) {
                    // Check the next namespace to find the info we need.
                    thisCalendar.checkPrincipalsNameSpace(aNameSpaceList, aChangeLogListener);
                } else {
                    if (thisCalendar.verboseLogging()) {
                        cal.LOG("CalDAV: principal namespace list empty, calendar " +
                                thisCalendar.name + " doesn't support scheduling");
                    }
                    doesntSupportScheduling();
                }
            } else {
                // We have everything, complete.
                thisCalendar.completeCheckServerInfo(aChangeLogListener);
            }
        };
        this.sendHttpRequest(this.makeUri(), queryXml, MIME_TEXT_XML, null, (channel) => {
            if (queryDepth == 0) {
                // Set header, doing this for Depth: 1 is not needed since thats the
                // default.
                channel.setRequestHeader("Depth", "0", false);
            }
            channel.requestMethod = queryMethod;
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE);
        });
    },

    /**
     * This is called to complete checking the server info. It should be the
     * final call when checking server options. This will either report the
     * error or if it is a success then refresh the calendar.
     *
     * setupAuthentication
     * checkDavResourceType
     * checkServerCaps
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo                      * You are here
     */
    completeCheckServerInfo: function caldav_completeCheckServerInfo(aChangeLogListener, aError) {
        if (Components.isSuccessCode(aError)) {
            // "undefined" is a successcode, so all is good
            this.saveCalendarProperties();
            this.checkedServerInfo  = true;
            this.setProperty("currentStatus", Components.results.NS_OK);

            if (this.isCached) {
                this.safeRefresh(aChangeLogListener);
            } else {
                this.refresh();
            }
        } else {
            this.reportDavError(aError);
            if (this.isCached && aChangeLogListener) {
                aChangeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                            Components.results.NS_ERROR_FAILURE);
            }
        }
    },

    /**
     * Called to report a certain DAV error. Strings and modification type are
     * handled here.
     */
    reportDavError: function caldav_reportDavError(aErrNo, status, extraInfo) {
        var mapError = {};
        mapError[Components.interfaces.calIErrors.DAV_NOT_DAV] = "dav_notDav";
        mapError[Components.interfaces.calIErrors.DAV_DAV_NOT_CALDAV] = "dav_davNotCaldav";
        mapError[Components.interfaces.calIErrors.DAV_PUT_ERROR] = "itemPutError";
        mapError[Components.interfaces.calIErrors.DAV_REMOVE_ERROR] = "itemDeleteError";
        mapError[Components.interfaces.calIErrors.DAV_REPORT_ERROR] = "disabledMode";

        var mapModification = {};
        mapModification[Components.interfaces.calIErrors.DAV_NOT_DAV] = false;
        mapModification[Components.interfaces.calIErrors.DAV_DAV_NOT_CALDAV] = false;
        mapModification[Components.interfaces.calIErrors.DAV_PUT_ERROR] = true;
        mapModification[Components.interfaces.calIErrors.DAV_REMOVE_ERROR] = true;
        mapModification[Components.interfaces.calIErrors.DAV_REPORT_ERROR] = false;

        var message = mapError[aErrNo];
        var localizedMessage;
        var modificationError = mapModification[aErrNo];

        if (!message) {
            // Only notify if there is a message for this error
            return;
        }
        localizedMessage = cal.calGetString("calendar", message , [this.mUri.spec]);
        this.mReadOnly = true;
        this.mDisabled = true;
        this.notifyError(aErrNo, localizedMessage);
        this.notifyError(modificationError
                         ? Components.interfaces.calIErrors.MODIFICATION_FAILED
                         : Components.interfaces.calIErrors.READ_FAILED,
                         this.buildDetailedMessage(status, extraInfo));
    },

    buildDetailedMessage : function caldav_buildDetailedMessage(status, extraInfo) {
        if (!status) {
            return "";
        }

        var props = Services.strings.createBundle("chrome://calendar/locale/calendar.properties");
        let statusString;
        try {
            statusString = props.GetStringFromName("caldavRequestStatusCodeString" + status);
        } catch (e) {
            // Fallback on generic string if no string is defined for the status code
            statusString = props.GetStringFromName("caldavRequestStatusCodeStringGeneric");
        }
        return props.formatStringFromName("caldavRequestStatusCode", [ status ], 1) + ", " +
               statusString + "\n\n" +
               (extraInfo ? extraInfo : "");

    },

    //
    // calIFreeBusyProvider interface
    //

    getFreeBusyIntervals: function caldav_getFreeBusyIntervals(
        aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {

        // We explicitly don't check for hasScheduling here to allow free-busy queries
        // even in case sched is turned off.
        if (!this.outboxUrl || !this.calendarUserAddress) {
            cal.LOG("CalDAV: Calendar " + this.name + " doen't support scheduling;" +
                    " freebusy query not possible");
            aListener.onResult(null, null);
            return;
        }

        if (!this.firstInRealm()) {
            // don't spam every known outbox with freebusy queries
            aListener.onResult(null, null);
            return;
        }

        // We tweak the organizer lookup here: If e.g. scheduling is turned off, then the
        // configured email takes place being the organizerId for scheduling which need
        // not match against the calendar-user-address:
        var orgId = this.getProperty("organizerId");
        if (orgId && orgId.toLowerCase() == aCalId.toLowerCase()) {
            aCalId = this.calendarUserAddress; // continue with calendar-user-address
        }

        // the caller prepends MAILTO: to calid strings containing @
        // but apple needs that to be mailto:
        var aCalIdParts = aCalId.split(":");
        aCalIdParts[0] = aCalIdParts[0].toLowerCase();

        if (aCalIdParts[0] != "mailto"
            && aCalIdParts[0] != "http"
            && aCalIdParts[0] != "https" ) {
            aListener.onResult(null, null);
            return;
        }
        var mailto_aCalId = aCalIdParts.join(":");

        var thisCalendar = this;

        var organizer = this.calendarUserAddress;

        var fbQuery = getIcsService().createIcalComponent("VCALENDAR");
        calSetProdidVersion(fbQuery);
        var prop = getIcsService().createIcalProperty("METHOD");
        prop.value = "REQUEST";
        fbQuery.addProperty(prop);
        var fbComp = getIcsService().createIcalComponent("VFREEBUSY");
        fbComp.stampTime = now().getInTimezone(UTC());
        prop = getIcsService().createIcalProperty("ORGANIZER");
        prop.value = organizer;
        fbComp.addProperty(prop);
        fbComp.startTime = aRangeStart.getInTimezone(UTC());
        fbComp.endTime = aRangeEnd.getInTimezone(UTC());
        fbComp.uid = cal.getUUID();
        prop = getIcsService().createIcalProperty("ATTENDEE");
        prop.setParameter("PARTSTAT", "NEEDS-ACTION");
        prop.setParameter("ROLE", "REQ-PARTICIPANT");
        prop.setParameter("CUTYPE", "INDIVIDUAL");
        prop.value = mailto_aCalId;
        fbComp.addProperty(prop);
        fbQuery.addSubcomponent(fbComp);
        fbQuery = fbQuery.serializeToICS();
        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send (Originator=" + organizer +
                    ",Recipient=" + mailto_aCalId + "): " + fbQuery);
        }

        var streamListener = {};

        streamListener.onStreamComplete =
            function caldav_GFBI_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
            let str = cal.convertByteArray(aResult, aResultLength);
            if (!str) {
                cal.LOG("CalDAV: Failed to parse freebusy response from " + thisCalendar.name);
            } else if (thisCalendar.verboseLogging()) {
                cal.LOG("CalDAV: recv: " + str);
            }

            if (request.responseStatus == 200) {
                var periodsToReturn = [];
                var fbTypeMap = {};
                fbTypeMap["FREE"] = calIFreeBusyInterval.FREE;
                fbTypeMap["BUSY"] = calIFreeBusyInterval.BUSY;
                fbTypeMap["BUSY-UNAVAILABLE"] = calIFreeBusyInterval.BUSY_UNAVAILABLE;
                fbTypeMap["BUSY-TENTATIVE"] = calIFreeBusyInterval.BUSY_TENTATIVE;

                try {
                    var fbResult = cal.xml.parseString(str);
                } catch (ex) {
                    cal.LOG("CalDAV: Could not parse freebusy response " + ex);
                    aListener.onResult(null, null);
                    return;
                }

                let status = caldavXPathFirst(fbResult, "/C:schedule-response/C:response/C:request-status/text()");
                if (!status || status.substr(0,1) != "2") {
                    cal.LOG("CalDAV: Got status " + status + " in response to " +
                            "freebusy query for " + thisCalendar.name) ;
                    aListener.onResult(null, null);
                    return;
                }
                if (status.substr(0,3) != "2.0") {
                    cal.LOG("CalDAV: Got status " + status + " in response to " +
                            "freebusy query for" + thisCalendar.name);
                }

                let caldata = caldavXPathFirst(fbResult, "/C:schedule-response/C:response/C:calendar-data/text()");
                try {
                    let calComp = cal.getIcsService().parseICS(caldata, null);
                    for (let fbComp in cal.ical.calendarComponentIterator(calComp)) {
                        let interval;

                        let replyRangeStart = fbComp.startTime;
                        if (replyRangeStart && (aRangeStart.compare(replyRangeStart) == -1)) {
                            interval = new cal.FreeBusyInterval(aCalId,
                                                                calIFreeBusyInterval.UNKNOWN,
                                                                aRangeStart,
                                                                replyRangeStart);
                            periodsToReturn.push(interval);
                        }
                        let replyRangeEnd = fbComp.endTime;
                        if (replyRangeEnd && (aRangeEnd.compare(replyRangeEnd) == 1)) {
                            interval = new cal.FreeBusyInterval(aCalId,
                                                                calIFreeBusyInterval.UNKNOWN,
                                                                replyRangeEnd,
                                                                aRangeEnd);
                            periodsToReturn.push(interval);
                        }

                        for (let fbProp in cal.ical.propertyIterator(fbComp, "FREEBUSY")) {
                            let fbType = fbProp.getParameter("FBTYPE");
                            if (fbType) {
                                fbType = fbTypeMap[fbType];
                            } else {
                                fbType = calIFreeBusyInterval.BUSY;
                            }
                            let parts = fbProp.value.split("/");
                            let begin = cal.createDateTime(parts[0]);
                            let end;
                            if (parts[1].charAt(0) == "P") { // this is a duration
                                end = begin.clone();
                                end.addDuration(cal.createDuration(parts[1]));
                            } else {
                                // This is a date string
                                end = cal.createDateTime(parts[1]);
                            }
                            interval = new cal.FreeBusyInterval(aCalId,
                                                                fbType,
                                                                begin,
                                                                end);
                            periodsToReturn.push(interval);
                        }
                    }
                } catch (exc) {
                    cal.ERROR("CalDAV: Error parsing free-busy info.");
                }

                aListener.onResult(null, periodsToReturn);
            } else {
                cal.LOG("CalDAV: Received status " + request.responseStatus +
                        " from freebusy query for " + thisCalendar.name);
                aListener.onResult(null, null);
            }
        };

        let fbUri = this.makeUri(null, this.outboxUrl);
        this.sendHttpRequest(fbUri, fbQuery, MIME_TEXT_CALENDAR, null, (channel) => {
            channel.requestMethod = "POST";
            channel.setRequestHeader("Originator", organizer, false);
            channel.setRequestHeader("Recipient", mailto_aCalId, false);
            return streamListener;
        }, () => {
            notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                           "Error preparing http channel");
        });
    },

    /**
     * Extract the path from the full spec, if the regexp failed, log
     * warning and return unaltered path.
     */
    extractPathFromSpec : function caldav_extractPathFromSpec(aSpec) {
        // The parsed array should look like this:
        // a[0] = full string
        // a[1] = scheme
        // a[2] = everything between the scheme and the start of the path
        // a[3] = extracted path
        let a = aSpec.match("(https?)(://[^/]*)([^#?]*)");
        if (a && a[3]) {
          return a[3];
        }
        cal.WARN("CalDAV: Spec could not be parsed, returning as-is: " + aSpec);
        return aSpec;
    },
    /**
     * This is called to create an encoded path from a unencoded path OR
     * encoded full url
     *
     * @param aString {string} un-encoded path OR encoded uri spec.
     */
    ensureEncodedPath: function caldav_ensureEncodedPath(aString) {
        if (aString.charAt(0) != "/") {
            aString = this.ensureDecodedPath(aString);
        }
        var uriComponents = aString.split("/");
        uriComponents = uriComponents.map(encodeURIComponent);
        return uriComponents.join("/");
    },

    /**
     * This is called to get a decoded path from an encoded path or uri spec.
     *
     * @param aString {string} Represents either a path
     * or a full uri that needs to be decoded.
     */
    ensureDecodedPath: function caldav_ensureDecodedPath(aString) {
        if (aString.charAt(0) != "/") {
            aString = this.extractPathFromSpec(aString);
        }

        var uriComponents = aString.split("/");
        for (var i = 0 ; i < uriComponents.length ; i++ ) {
            try {
                uriComponents[i] = decodeURIComponent(uriComponents[i]);
            }
            catch (e) {
                cal.WARN("CalDAV: Exception decoding path " + aString + ", segment: " + uriComponents[i]);
            }
        }
        return uriComponents.join("/");
    },
    isInbox: function caldav_isInbox(aString) {
        // Note: If you change this, make sure it really returns a boolean
        // value and not null!
        return ((this.hasScheduling || this.hasAutoScheduling) &&
                (this.mInboxUrl != null) &&
                aString.indexOf(this.mInboxUrl.spec) == 0);
    },

    /**
     * Query contents of scheduling inbox
     *
     */
    pollInbox: function caldav_pollInbox() {
        // If polling the inbox was switched off, no need to poll the inbox.
        // Also, if we have more than one calendar in this CalDAV account, we
        // want only one of them to be checking the inbox.
        if ((!this.hasScheduling && !this.hasAutoScheduling) || !this.mShouldPollInbox || !this.firstInRealm()) {
            return;
        }

        this.getUpdatedItems(this.mInboxUrl, null);
    },

    //
    // take calISchedulingSupport interface base implementation (cal.ProviderBase)
    //

    processItipReply: function caldav_processItipReply(aItem, aPath) {
        // modify partstat for in-calendar item
        // delete item from inbox
        var thisCalendar = this;

        var getItemListener = {};
        getItemListener.onOperationComplete = function caldav_gUIs_oOC(aCalendar,
                                                                       aStatus,
                                                                       aOperationType,
                                                                       aId,
                                                                       aDetail) {
        };
        getItemListener.onGetResult = function caldav_pIR_oGR(aCalendar,
                                                              aStatus,
                                                              aItemType,
                                                              aDetail,
                                                              aCount,
                                                              aItems) {
            var itemToUpdate = aItems[0];
            if (aItem.recurrenceId && itemToUpdate.recurrenceInfo) {
                itemToUpdate = itemToUpdate.recurrenceInfo.getOccurrenceFor(aItem.recurrenceId);
            }
            var newItem = itemToUpdate.clone();

            for each (var attendee in aItem.getAttendees({})) {
                var att = newItem.getAttendeeById(attendee.id);
                if (att) {
                    newItem.removeAttendee(att);
                    att = att.clone();
                    att.participationStatus = attendee.participationStatus;
                    newItem.addAttendee(att);
                }
            }
            thisCalendar.doModifyItem(newItem, itemToUpdate.parentItem /* related to bug 396182 */,
                                      modListener, true);
        };

        var modListener = {};
        modListener.onOperationComplete = function caldav_pIR_moOC(aCalendar,
                                                                   aStatus,
                                                                   aOperationType,
                                                                   aItemId,
                                                                   aDetail) {
            cal.LOG("CalDAV: status " + aStatus + " while processing iTIP REPLY " +
                    " for " + thisCalendar.name);
            // don't delete the REPLY item from inbox unless modifying the master
            // item was successful
            if (aStatus == 0) { // aStatus undocumented; 0 seems to indicate no error
                var delUri = thisCalendar.calendarUri.clone();
                delUri.path = thisCalendar.ensureEncodedPath(aPath);
                thisCalendar.doDeleteItem(aItem, null, true, true, delUri);
            }
        };

        this.mOfflineStorage.getItem(aItem.id, getItemListener);
    },

    canNotify: function caldav_canNotify(aMethod, aItem) {
        if (this.hasAutoScheduling) {
            // canNotify should return false if the schedule agent is client
            // so the itip transport(imip) takes care of notifying participants
            if (aItem.organizer &&
                aItem.organizer.getProperty("SCHEDULE-AGENT") == "CLIENT") {
                return false;
            }
            return true;
        }
        return false; // use outbound iTIP for all
    },

    //
    // calIItipTransport interface
    //

    get scheme() {
        return "mailto";
    },

    mSenderAddress: null,
    get senderAddress() {
        return this.mSenderAddress || this.calendarUserAddress;
    },
    set senderAddress(aString) {
        return (this.mSenderAddress = aString);
    },

    sendItems: function caldav_sendItems(aCount, aRecipients, aItipItem) {

        if (this.hasAutoScheduling) {
            // If auto scheduling is supported by the server we still need
            // to send out REPLIES for meetings where the ORGANIZER has the
            // parameter SCHEDULE-AGENT set to CLIENT, this property is
            // checked in in canNotify()
            if (aItipItem.responseMethod == "REPLY") {
                let imipTransport = cal.getImipTransport(this);
                if (imipTransport) {
                    imipTransport.sendItems(aCount, aRecipients, aItipItem);
                }
            }
            // Servers supporting auto schedule should handle all other
            // scheduling operations for now. Note that eventually the client
            // could support setting a SCHEDULE-AGENT=CLIENT parameter on
            // ATTENDEES and/or interpreting the SCHEDULE-STATUS parameter which
            // could translate in the client sending out IMIP REQUESTS
            // for specific attendees.
            return;
        }

        if (aItipItem.responseMethod == "REPLY") {
            // Get my participation status
            var attendee = aItipItem.getItemList({})[0].getAttendeeById(this.calendarUserAddress);
            if (!attendee) {
                return;
            }
            // work around BUG 351589, the below just removes RSVP:
            aItipItem.setAttendeeStatus(attendee.id, attendee.participationStatus);
        }

        for each (var item in aItipItem.getItemList({})) {

            var serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                       .createInstance(Components.interfaces.calIIcsSerializer);
            serializer.addItems([item], 1);
            var methodProp = getIcsService().createIcalProperty("METHOD");
            methodProp.value = aItipItem.responseMethod;
            serializer.addProperty(methodProp);

            var thisCalendar = this;
            var streamListener = {
                onStreamComplete: function caldav_sendItems_oSC(aLoader, aContext, aStatus,
                                                                aResultLength, aResult) {
                    let request = aLoader.request.QueryInterface(Components.interfaces.nsIHttpChannel);
                    let status;
                    try {
                        status = request.responseStatus;
                    } catch (ex) {
                        status = Components.interfaces.calIErrors.DAV_POST_ERROR;
                        cal.LOG("CalDAV: no response status when sending iTIP for" +
                                thisCalendar.name);
                    }

                    if (status != 200) {
                        cal.LOG("CalDAV: Sending iTIP failed with status " + status +
                                " for " + thisCalendar.name);
                    }

                    let str = cal.convertByteArray(aResult, aResultLength, "UTF-8", false);
                    if (str) {
                        if (thisCalendar.verboseLogging()) {
                            cal.LOG("CalDAV: recv: " + str);
                        }
                    } else {
                        cal.LOG("CalDAV: Failed to parse iTIP response for" +
                                thisCalendar.name);
                    }

                    try {
                        var responseXML = cal.xml.parseString(str);
                    } catch (ex) {
                        cal.LOG("CalDAV: Could not parse multistatus response: " + ex + "\n" + str);
                        return;
                    }

                    var remainingAttendees = [];
                    // TODO The following XPath expressions are currently
                    // untested code, as I don't have a caldav-sched server
                    // available. If you find someone who does, please test!
                    let responses = caldavXPath(responseXML, "/C:schedule-response/C:response");
                    for each (let response in responses) {
                        let recip = caldavXPathFirst(response, "C:recipient/D:href/text()");
                        let status = caldavXPathFirst(response, "C:request-status/text()");
                        if (status.substr(0, 1) != "2") {
                            if (thisCalendar.verboseLogging()) {
                                cal.LOG("CalDAV: Failed scheduling delivery to " + recip);
                            }
                            for each (let att in aRecipients) {
                                if (att.id.toLowerCase() == recip.toLowerCase()) {
                                    remainingAttendees.push(att);
                                    break;
                                }
                            }
                        }
                    }

                    if (remainingAttendees.length) {
                        // try to fall back to email delivery if CalDAV-sched
                        // didn't work
                        var imipTransport = cal.getImipTransport(thisCalendar);
                        if (imipTransport) {
                            if (thisCalendar.verboseLogging()) {
                                cal.LOG("CalDAV: sending email to " + remainingAttendees.length + " recipients");
                            }
                            imipTransport.sendItems(remainingAttendees.length, remainingAttendees, aItipItem);
                        } else {
                            cal.LOG("CalDAV: no fallback to iTIP/iMIP transport for " +
                                    thisCalendar.name);
                        }
                    }
                }
            };

            if (this.verboseLogging()) {
                cal.LOG("CalDAV: send(" + requestUri.spec + "): " + uploadData);
            }
            let uploadData = serializer.serializeToString();
            let requestUri = this.makeUri(null, this.outboxUrl);
            this.sendHttpRequest(requestUri, uploadData, MIME_TEXT_CALENDAR, null, (channel) => {
                channel.requestMethod = "POST";
                channel.setRequestHeader("Originator", this.calendarUserAddress, false);
                for each (var recipient in aRecipients) {
                    channel.setRequestHeader("Recipient", recipient.id, true);
                }
                return streamListener;
            }, () => {
                notifyListener(Components.results.NS_ERROR_NOT_AVAILABLE,
                               "Error preparing http channel");
            });
        }
    },

    mVerboseLogging: undefined,
    verboseLogging: function caldav_verboseLogging() {
        if (this.mVerboseLogging === undefined) {
            this.mVerboseLogging = getPrefSafe("calendar.debug.log.verbose", false);
        }
        return this.mVerboseLogging;
    },

    getSerializedItem: function caldav_getSerializedItem(aItem) {
        var serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                   .createInstance(Components.interfaces.calIIcsSerializer);
        serializer.addItems([aItem], 1);
        var serializedItem = serializer.serializeToString();
        if (this.verboseLogging()) {
            cal.LOG("CalDAV: send: " + serializedItem);
        }
        return serializedItem;
    },

    // nsIChannelEventSink implementation
    asyncOnChannelRedirect: function caldav_asyncOonChannelRedirect(aOldChannel, aNewChannel, aFlags, aCallback) {

        let uploadData;
        let uploadContent;
        if (aOldChannel instanceof Components.interfaces.nsIUploadChannel &&
            aOldChannel instanceof Components.interfaces.nsIHttpChannel &&
            aOldChannel.uploadStream) {
            uploadData = aOldChannel.uploadStream;
            uploadContent = aOldChannel.getRequestHeader("Content-Type");
        }

        cal.prepHttpChannel(null,
                            uploadData,
                            uploadContent,
                            this,
                            aNewChannel);

        // Make sure we can get/set headers on both channels.
        aNewChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
        aOldChannel.QueryInterface(Components.interfaces.nsIHttpChannel);

        function copyHeader(aHdr) {
            try {
                let hdrValue = aOldChannel.getRequestHeader(aHdr);
                if (hdrValue) {
                    aNewChannel.setRequestHeader(aHdr, hdrValue, false);
                }
            } catch (e) {
                if (e.code != Components.results.NS_ERROR_NOT_AVAILIBLE) {
                    // The header could possibly not be availible, ignore that
                    // case but throw otherwise
                    throw e;
               }
            }
        }

        // If any other header is used, it should be added here. We might want
        // to just copy all headers over to the new channel.
        copyHeader("Depth");
        copyHeader("Originator");
        copyHeader("Recipient");
        copyHeader("If-None-Match");
        copyHeader("If-Match");
        if (aNewChannel.URI.host == "apidata.googleusercontent.com") {
            copyHeader("Authorization");
        }

        aNewChannel.requestMethod = aOldChannel.requestMethod;

        aCallback.onRedirectVerifyCallback(Components.results.NS_OK);
    }
};

function calDavObserver(aCalendar) {
    this.mCalendar = aCalendar;
}

// Before you spend time trying to find out what this means, please note that
// doing so and using the information WILL cause Google to revoke Lightning's
// privileges,  which means not one Lightning user will be able to connect to
// Google Calendar via CalDAV. This will cause unhappy users all around which
// means that the Lightning developers will have to spend more time with user
// support, which means less time for features, releases and bugfixes.  For a
// paid developer this would actually mean financial harm.
//
// Do you really want all of this to be your fault? Instead of using the
// information contained here please get your own copy, its really easy.
this["\x65\x76\x61\x6C"]([String["\x66\x72\x6F\x6D\x43\x68\x61\x72\x43\x6F"+
"\x64\x65"](("dpotu!PBVUI`CBTF`VSJ!>!#iuuqt;00bddpvout/hpphmf/dpn0p0#<dpot"+
"u!PBVUI`TDPQF!>!#iuuqt;00xxx/hpphmfbqjt/dpn0bvui0dbmfoebs#<dpotu!PBVUI`DM"+
"JFOU`JE!>!#831674:95649/bqqt/hpphmfvtfsdpoufou/dpn#<dpotu!PBVUI`IBTI!>!#z"+
"Vs7YVgyvsbguj7s8{1TTfJR#<")["\x63\x68\x61\x72\x43\x6F\x64\x65\x41\x74"](i)-
1)for(i in (function(){let x=231;while(x--)yield x})())].reverse().join(""))

calDavObserver.prototype = {
    mCalendar: null,
    mInBatch: false,

    // calIObserver:
    onStartBatch: function() {
        this.mCalendar.observers.notify("onStartBatch");
        this.mInBatch = true;
    },
    onEndBatch: function() {
        this.mCalendar.observers.notify("onEndBatch");
        this.mInBatch = false;
    },
    onLoad: function(calendar) {
        this.mCalendar.observers.notify("onLoad", [calendar]);
    },
    onAddItem: function(aItem) {
        this.mCalendar.observers.notify("onAddItem", [aItem]);
    },
    onModifyItem: function(aNewItem, aOldItem) {
        this.mCalendar.observers.notify("onModifyItem", [aNewItem, aOldItem]);
    },
    onDeleteItem: function(aDeletedItem) {
        this.mCalendar.observers.notify("onDeleteItem", [aDeletedItem]);
    },
    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
        this.mCalendar.observers.notify("onPropertyChanged", [aCalendar, aName, aValue, aOldValue]);
    },
    onPropertyDeleting: function(aCalendar, aName) {
        this.mCalendar.observers.notify("onPropertyDeleting", [aCalendar, aName]);
    },

    onError: function(aCalendar, aErrNo, aMessage) {
        this.mCalendar.readOnly = true;
        this.mCalendar.notifyError(aErrNo, aMessage);
    }
};

/** Module Registration */
const scriptLoadOrder = [
    "calUtils.js",
    "calDavRequestHandlers.js"
];

var NSGetFactory = cal.loadingNSGetFactory(scriptLoadOrder, [calDavCalendar], this);
