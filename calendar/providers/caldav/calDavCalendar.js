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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Dan Mosedale <dan.mosedale@oracle.com>
 *   Mike Shaver <mike.x.shaver@oracle.com>
 *   Gary van der Merwe <garyvdm@gmail.com>
 *   Bruno Browning <browning@uwalumni.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Wolfgang Sourdeau <wsourdeau@inverse.ca>
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
// calDavCalendar.js
//

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';

function calDavCalendar() {
    this.initProviderBase();
    this.unmappedProperties = [];
    this.mUriParams = null;
    this.mItemInfoCache = {};
    this.mDisabled = false;
    this.mCalHomeSet = null;
    this.mInBoxUrl = null;
    this.mOutBoxUrl = null;
    this.mCalendarUserAddress = null;
    this.mPrincipalUrl = null;
    this.mSenderAddress = null;
    this.mHrefIndex = {};
    this.mAuthScheme = null;
    this.mAuthRealm = null;
    this.mObserver = null;
    this.mFirstRefreshDone = false;
    this.mTargetCalendar = null;
    this.mQueuedQueries = [];
    this.mCtag = null;

    // By default, support both events and todos.
    this.supportedItemTypes = ["VEVENT", "VTODO"];
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
const CALDAV_ADOPT_ITEM = 1;
const CALDAV_MODIFY_ITEM = 2;
const CALDAV_DELETE_ITEM = 3;

calDavCalendar.prototype = {
    __proto__: calProviderBase.prototype,

    //
    // nsISupports interface
    //
    QueryInterface: function caldav_QueryInterface(aIID) {
        return doQueryInterface(this, calDavCalendar.prototype, aIID,
                                [Components.interfaces.calICalendarProvider,
                                 Components.interfaces.nsIInterfaceRequestor,
                                 Components.interfaces.calIFreeBusyProvider,
                                 Components.interfaces.nsIChannelEventSink,
                                 Components.interfaces.calIItipTransport,
                                 Components.interfaces.calIChangeLog,
                                 calICalDavCalendar]);
    },

    // An array of components that are supported by the server. The default is
    // to support VEVENT and VTODO, if queries for these components return a 4xx
    // error, then they will be removed from this array.
    supportedItemTypes: null,

    get isCached caldav_get_isCached() {
        return (this != this.superCalendar);
    },

    ensureTargetCalendar: function caldav_ensureTargetCalendar() {
        if (!this.isCached && !this.mTargetCalendar) {
            // If this is a cached calendar, the actual cache is taken care of
            // by the calCachedCalendar facade. In any other case, we use a
            // memory calendar to cache things.
            this.mTargetCalendar = Components
                                   .classes["@mozilla.org/calendar/calendar;1?type=memory"]
                                   .createInstance(Components.interfaces.calISyncCalendar);

            this.mTargetCalendar.superCalendar = this;
            this.mObserver = new calDavObserver(this);
            this.mTargetCalendar.addObserver(this.mObserver);
            this.mTargetCalendar.setProperty("relaxedMode", true);
        }
    },

    //
    // calICalendarProvider interface
    //
    get prefChromeOverlay caldav_get_prefChromeOverlay() {
        return null;
    },

    get displayName caldav_get_displayName() {
        return calGetString("calendar", "caldavName");
    },

    createCalendar: function caldav_createCalendar() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function caldav_deleteCalendar(cal, listener) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },


    // calIChangeLog interface
    resetLog: function caldav_resetLog() {
        if (this.isCached && this.mTargetCalendar) {
            this.mTargetCalendar.startBatch();
            try { 
                for (var itemId in this.mItemInfoCache) {
                    this.mTargetCalendar.deleteMetaData(itemId);
                    delete this.mItemInfoCache[itemId];
                }
            } finally {
                this.mTargetCalendar.endBatch();
            }
        }
    },

    // in calISyncCalendar aDestination,
    // in calIGenericOperationListener aListener
    replayChangesOn: function caldav_replayChangesOn(aDestination, aChangeLogListener) {
        if (!this.mTargetCalendar) {
            this.mTargetCalendar = aDestination.wrappedJSObject;
            this.fetchItemVersions();
            this.checkDavResourceType(aChangeLogListener);
        } else {
            this.safeRefresh(aChangeLogListener);
        }
    },

    fetchItemVersions: function caldav_fetchItemVersions() {
        var cacheIds = {};
        var cacheValues = {};
        this.mTargetCalendar.getAllMetaData({}, cacheIds, cacheValues);
        cacheIds = cacheIds.value;
        cacheValues = cacheValues.value;
        for (var count = 0; count < cacheIds.length; count++) {
            var itemId = cacheIds[count];
            var itemData = cacheValues[count];
            if (itemId == "ctag") {
                this.mCtag = itemData;
            } else {
                var itemDataArray = itemData.split("\u001A");
                var etag = itemDataArray[0];
                var resourcePath = itemDataArray[1];
                var isInboxItem = itemDataArray[2];
                if (itemDataArray.length == 3) {
                    this.mHrefIndex[resourcePath] = itemId;
                    var locationPath = decodeURIComponent(resourcePath)
                        .substr(this.mLocationPath.length);
                    var item = { etag: etag,
                                 isNew: false,
                                 locationPath: locationPath,
                                 isInboxItem: (isInboxItem == "true")};
                    this.mItemInfoCache[itemId] = item;
                }
            }
        }
    },

    setMetaData: function caldav_setMetaData(id, path, etag, isInboxItem) {
        if (this.mTargetCalendar.setMetaData) {
            if (id) {
                var dataString = [etag,path,(isInboxItem ? "true" : "false")].join("\u001A");
                this.mTargetCalendar.setMetaData(id, dataString);
            } else {
                LOG("CAlDAV: cannot store meta data without an id");
            }
        } else {
            LOG("CalDAV: calendar storage does not support meta data");
        }
    },

    //
    // calICalendar interface
    //

    // readonly attribute AUTF8String type;
    get type caldav_get_type() { return "caldav"; },

    mDisabled: true,

    mCalendarUserAddress: null,
    get calendarUserAddress caldav_get_calendarUserAddress() {
        return this.mCalendarUserAddress;
    },

    mPrincipalUrl: null,
    get principalUrl caldav_get_principalUrl() {
        return this.mPrincipalUrl;
    },

    get canRefresh caldav_get_canRefresh() {
        // A cached calendar doesn't need to be refreshed.
        return !this.isCached;
    },

    // mUriParams stores trailing ?parameters from the
    // supplied calendar URI. Needed for (at least) Cosmo
    // tickets
    mUriParams: null,

    get uri caldav_get_uri() { return this.mUri },

    set uri caldav_set_uri(aUri) {
        this.mUri = aUri;

        return aUri;
    },

    get calendarUri caldav_get_calendarUri() {
        calUri = this.mUri.clone();
        var parts = calUri.spec.split('?');
        if (parts.length > 1) {
            calUri.spec = parts.shift();
            this.mUriParams = '?' + parts.join('?');
        }
        if (calUri.spec.charAt(calUri.spec.length-1) != '/') {
            calUri.spec += "/";
        }
        return calUri;
    },

    setCalHomeSet: function caldav_setCalHomeSet() {
        var calUri = this.mUri.clone();
        var split1 = calUri.spec.split('?');
        var baseUrl = split1[0];
        if (baseUrl.charAt(baseUrl.length-1) == '/') {
            baseUrl = baseUrl.substring(0, baseUrl.length-2);
        }
        var split2 = baseUrl.split('/');
        split2.pop();
        calUri.spec = split2.join('/') + '/';
        this.mCalHomeSet = calUri;
    },

    mOutBoxUrl:  null,
    get outBoxUrl caldav_get_outBoxUrl() {
        return this.mOutBoxUrl;
    },

    mInBoxUrl: null,
    get inBoxUrl caldav_get_inBoxUrl() {
        return this.mInBoxUrl;
    },

    mHaveScheduling: false,
    mShouldPollInbox: true,
    get hasScheduling caldav_get_hasScheduling() { // Whether to use inbox/outbox scheduling
        return this.mHaveScheduling;
    },
    set hasScheduling caldav_set_hasScheduling(value) {
        return (this.mHaveScheduling = (getPrefSafe("calendar.caldav.sched.enabled", false) && value));
    },
    hasAutoScheduling: false, // Whether server automatically takes care of scheduling

    mAuthScheme: null,

    mAuthRealm: null,

    mFirstRefreshDone: false,

    mQueuedQueries: null,

    mCtag: null,

    mTargetCalendar: null,

    get authRealm caldav_get_authRealm() {
        return this.mAuthRealm;
    },

    makeUri: function caldav_makeUri(aInsertString) {
        var spec = this.calendarUri.spec + aInsertString;
        if (this.mUriParams) {
            return spec + this.mUriParams;
        }
        return makeURL(spec);
    },

    get mLocationPath caldav_get_mLocationPath() {
        return decodeURIComponent(this.calendarUri.path);
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
        switch (aName) {
            case "organizerId":
                if (this.calendarUserAddress) {
                    return this.calendarUserAddress;
                } // else use configured email identity
                break;
            case "organizerCN":
                return null; // xxx todo
            case "itip.transport":
                if (this.hasAutoScheduling) {
                    return null;
                } else if (this.hasScheduling) {
                    return this.QueryInterface(Components.interfaces.calIItipTransport);
                } // else use outbound email-based iTIP (from calProviderBase.js)
                break;
            case "capabilities.tasks.supported":
                return (this.supportedItemTypes.indexOf("VTODO") > -1);
            case "capabilities.events.supported":
                return (this.supportedItemTypes.indexOf("VEVENT") > -1);
        }
        return this.__proto__.__proto__.getProperty.apply(this, arguments);
    },

    promptOverwrite: function caldav_promptOverwrite(aMethod, aItem, aListener, aOldItem) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);

        var promptTitle = calGetString("calendar", "itemModifiedOnServerTitle");
        var promptMessage = calGetString("calendar", "itemModifiedOnServer");
        var buttonLabel1;

        if (aMethod == CALDAV_MODIFY_ITEM) {
            promptMessage += calGetString("calendar", "modifyWillLoseData");
            buttonLabel1 = calGetString("calendar", "proceedModify");
        } else {
            promptMessage += calGetString("calendar", "deleteWillLoseData");
            buttonLabel1 = calGetString("calendar", "proceedDelete");
        }

        var buttonLabel2 = calGetString("calendar", "updateFromServer");

        var flags = promptService.BUTTON_TITLE_IS_STRING *
                    promptService.BUTTON_POS_0 +
                    promptService.BUTTON_TITLE_IS_STRING *
                    promptService.BUTTON_POS_1;

        var choice = promptService.confirmEx(null, promptTitle, promptMessage,
                                             flags, buttonLabel1, buttonLabel2,
                                             null, null, {});

        if (choice == 0) {
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
        var newItem = aItem.clone();
        return this.doAdoptItem(newItem, aListener, false);
    },

    /**
     * adoptItem()
     * we actually use doAdoptItem()
     *
     * @param aItem       item to check
     * @param aListener   listener for method completion
     */
    adoptItem: function caldav_adoptItem(aItem, aListener) {
        return this.doAdoptItem(aItem, aListener, false);
    },

    /**
     * Performs the actual addition of the item to CalDAV store
     *
     * @param aItem       item to add
     * @param aListener   listener for method completion
     * @param aIgnoreEtag ignore item etag
     */
    doAdoptItem: function caldav_doAdoptItem(aItem, aListener, aIgnoreEtag) {
        if (aItem.id == null && aItem.isMutable) {
            aItem.id = getUUID();
        }

        if (aItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.ADD,
                                         aItem.id,
                                         "Can't set ID on non-mutable item to addItem");
            return;
        }

        var locationPath = this.getItemLocationPath(aItem);
        var itemUri = this.makeUri(locationPath);
        LOG("CalDAV: itemUri.spec = " + itemUri.spec);

        var addListener = {};
        var thisCalendar = this;
        addListener.onStreamComplete =
            function onPutComplete(aLoader, aContext, aStatus, aResultLength,
                                   aResult) {
            var status;
            try {
                status = aContext.responseStatus;
            } catch (ex) {
                status = Components.interfaces.calIErrors.DAV_PUT_ERROR;
            }
            if (thisCalendar.verboseLogging()) {
                var str = convertByteArray(aResult, aResultLength);
                LOG("CalDAV: recv: " + (str || ""));
            }
            // 201 = HTTP "Created"
            // 204 = HTTP "No Content"
            //
            if (status == 201 || status == 204) {
                LOG("CalDAV: Item added successfully");

                // Some CalDAV servers will modify items on PUT (add X-props,
                // for instance) so we'd best re-fetch in order to know
                // the current state of the item
                // Observers will be notified in getUpdatedItem()
                thisCalendar.getUpdatedItem(aItem, aListener);
            } else {
                if (status > 999) {
                    status = "0x" + status.toString(16);
                }
                LOG("CalDAV: Unexpected status adding item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_PUT_ERROR);
            }
        };

        aItem.calendar = this.superCalendar;
        aItem.generation = 1;

        var httpchannel = calPrepHttpChannel(itemUri,
                                             this.getSerializedItem(aItem),
                                             "text/calendar; charset=utf-8",
                                             this);


        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-None-Match", "*", false);
        }

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, addListener);
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
    doModifyItem: function caldav_doModifyItem(aNewItem, aOldItem, aListener, aIgnoreEtag) {

        if (aNewItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.MODIFY,
                                         aItem.id,
                                         "ID for modifyItem doesn't exist or is null");
            return;
        }

        var wasInBoxItem = false;
        if (this.mItemInfoCache[aNewItem.id].isInBoxItem) {
            aIgnoreEtag = true;
            wasInBoxItem = true;
        }

        var newItem_ = aNewItem;
        aNewItem = aNewItem.parentItem.clone();
        if (newItem_.parentItem != newItem_) {
            aNewItem.recurrenceInfo.modifyException(newItem_, false);
        }
        aNewItem.generation += 1;

        var eventUri = this.makeUri(this.mItemInfoCache[aNewItem.id].locationPath);

        var thisCalendar = this;

        var modifiedItemICS = this.getSerializedItem(aNewItem);

        var modListener = {};
        modListener.onStreamComplete =
            function caldav_mod_onStreamComplete(aLoader, aContext, aStatus,
                                                 aResultLength, aResult) {
            // 200 = HTTP "OK"
            // 204 = HTTP "No Content"
            //
            var status;
            try {
                status = aContext.responseStatus;
            } catch (ex) {
                status = Components.interfaces.calIErrors.DAV_PUT_ERROR;
            }

            // We should not accept a 201 status here indefinitely: it indicates a server error
            // of some kind that we want to know about. It's convenient to accept it for now
            // since a number of server impls don't get this right yet.
            if (status == 204 || status == 201 || status == 200) {
                LOG("CalDAV: Item modified successfully.");
                // Some CalDAV servers will modify items on PUT (add X-props,
                // for instance) so we'd best re-fetch in order to know
                // the current state of the item
                // Observers will be notified in getUpdatedItem()
                thisCalendar.getUpdatedItem(aNewItem, aListener);
                // SOGo has calendarUri == inboxUri so we need to be careful
                // about deletions
                if (wasInBoxItem && thisCalendar.mShouldPollInbox) {
                    thisCalendar.doDeleteItem(aNewItem, null, true, true, null);
                }
            } else if (status == 412) {
                thisCalendar.promptOverwrite(CALDAV_MODIFY_ITEM, aNewItem,
                                             aListener, aOldItem);
            } else {
                if (status > 999) {
                    status = "0x " + status.toString(16);
                }
                LOG("CalDAV: Unexpected status on modifying item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_PUT_ERROR);
            }
        };

        var httpchannel = calPrepHttpChannel(eventUri,
                                             modifiedItemICS,
                                             "text/calendar; charset=utf-8",
                                             this);

        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aNewItem.id].etag,
                                         false);
        }

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, modListener);
    },

    /**
     * deleteItem(); required by calICalendar.idl
     * the actual deletion is done in doDeleteItem()
     *
     * @param aItem       item to delete
     * @param aListener   listener for method completion
     */
    deleteItem: function caldav_deleteItem(aItem, aListener) {
        return this.doDeleteItem(aItem, aListener, false);
    },

    /**
     * Deletes item from CalDAV store.
     *
     * @param aItem       item to delete
     * @param aListener   listener for method completion
     * @param aIgnoreEtag ignore item etag
     * @param aFromInBox  delete from inbox rather than calendar
     * @param aUri        uri of item to delete     */
    doDeleteItem: function caldav_doDeleteItem(aItem, aListener, aIgnoreEtag, aFromInBox, aUri) {

        if (aItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.DELETE,
                                         aItem.id,
                                         "ID doesn't exist for deleteItem");
            return;
        }

        var eventUri;
        if (aUri) {
            eventUri = aUri;
        } else if (aFromInBox || this.mItemInfoCache[aItem.id].isInBoxItem) {
            eventUri = makeURL(this.mInBoxUrl.spec + this.mItemInfoCache[aItem.id].locationPath);
        } else {
            eventUri = this.makeUri(this.mItemInfoCache[aItem.id].locationPath);
        }

        var delListener = {};
        var thisCalendar = this;
        var realListener = aListener; // need to access from callback

        delListener.onStreamComplete =
        function caldav_dDI_del_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
            var status;
            try {
                status = aContext.responseStatus;
            } catch (ex) {
                status = Components.interfaces.calIErrors.DAV_REMOVE_ERROR;
            }

            // 204 = HTTP "No content"
            //
            if (status == 204 || status == 200) {
                if (!aFromInBox) {
                    if (thisCalendar.isCached) {
                        // the item is deleted in the storage calendar from calCachedCalendar
                        realListener.onOperationComplete(thisCalendar, status,
                                                         Components.interfaces.calIOperationListener.DELETE,
                                                         null, null);
                    } else {
                        thisCalendar.mTargetCalendar.deleteItem(aItem, aListener);
                    }
                    thisCalendar.mTargetCalendar.deleteItem(aItem, aListener);
                    delete thisCalendar.mHrefIndex[eventUri.path];
                    delete thisCalendar.mItemInfoCache[aItem.id];
                    LOG("CalDAV: Item deleted successfully.");
                }
            } else if (status == 412) {
                // item has either been modified or deleted by someone else
                // check to see which

                var httpchannel2 = calPrepHttpChannel(eventUri,
                                                      null,
                                                      null,
                                                      thisCalendar);
                httpchannel2.requestMethod = "HEAD";
                var streamLoader2 = createStreamLoader();
                calSendHttpRequest(streamLoader2, httpchannel2, delListener2);
            } else {
                LOG("CalDAV: Unexpected status deleting item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_REMOVE_ERROR);
            }
        };
        var delListener2 = {};
        delListener2.onStreamComplete =
        function caldav_dDI_del2_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
            var status2 = aContext.responseStatus;
            if (status2 == 404) {
                // someone else already deleted it
                return;
            } else {
                thisCalendar.promptOverwrite(CALDAV_DELETE_ITEM, aItem,
                                             realListener, null);
            }
        };

        var httpchannel = calPrepHttpChannel(eventUri, null, null, this);
        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aItem.id].etag,
                                         false);
        }
        httpchannel.requestMethod = "DELETE";

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, delListener);
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
                                         Components.interfaces.calIOperationListener.GET,
                                         null,
                                         "passed in null item");
            return;
        }

        var locationPath = this.getItemLocationPath(aItem);
        var itemUri = this.makeUri(locationPath);

        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");

        var multigetQueryXml =
          <calendar-multiget xmlns:D={D} xmlns={C}>
            <D:prop>
              <D:getetag/>
              <calendar-data/>
            </D:prop>
            <D:href>{itemUri.path}</D:href>
          </calendar-multiget>;

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + multigetQueryXml.toXMLString());
        }

        this.getCalendarData(this.calendarUri,
                             xmlHeader + multigetQueryXml.toXMLString(),
                             aItem,
                             aListener,
                             aChangeLogListener);
    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function caldav_getItem(aId, aListener) {
        this.mTargetCalendar.getItem(aId, aListener);
    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function caldav_getItems(aItemFilter, aCount, aRangeStart,
                                       aRangeEnd, aListener) {
        if (this.isCached) {
            if (this.mTargetCalendar) {
                this.mTargetCalendar.getItems.apply(this.mTargetCalendar, arguments);
            } else {
                this.notifyOperationComplete(aListener,
                                             Components.results.NS_OK,
                                             Components.interfaces.calIOperationListener.GET,
                                             null,
                                             null);
            }
        } else {
            if (!this.mCheckedServerInfo) {
                this.mQueuedQueries.push(arguments);
            } else {
                this.mTargetCalendar.getItems.apply(this.mTargetCalendar, arguments);
            }
        }
    },

    safeRefresh: function caldav_safeRefresh(aChangeLogListener) {
        this.ensureTargetCalendar();

        if (this.mAuthScheme == "Digest") {
            // the auth could have timed out and be in need of renegotiation
            // we can't risk several calendars doing this simultaneously so
            // we'll force the renegotiation in a sync query, using HEAD to keep
            // it quick
            var headchannel = calPrepHttpChannel(this.calendarUri, null, null,
                                                 this);
            headchannel.requestMethod = "HEAD";
            headchannel.open();
        }

        if (!this.mCtag || !this.mFirstRefreshDone) {
            var refreshEvent = this.prepRefresh();
            this.getUpdatedItems(refreshEvent, aChangeLogListener);
            return;
        }
        var thisCalendar = this;

        var D = new Namespace("D", "DAV:");
        var CS = new Namespace("CS", "http://calendarserver.org/ns/");
        var queryXml = <D:propfind xmlns:D={D} xmlns:CS={CS}>
                        <D:prop>
                            <CS:getctag/>
                        </D:prop>
                        </D:propfind>;
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }
        var httpchannel = calPrepHttpChannel(this.calendarUri,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};
        streamListener.onStreamComplete =
            function safeRefresh_safeRefresh_onStreamComplete(aLoader, aContext, aStatus, aResultLength, aResult) {
            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " checking ctag for calendar " + thisCalendar.name);
            } catch (ex) {
                LOG("CalDAV: Error without status on checking ctag for calendar " +
                    thisCalendar.name);
            }

            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to get ctag from server");
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            try {
                var multistatus = new XML(str);
            } catch (ex) {
                LOG("CalDAV: Failed to get ctag from server");
                return;
            }

            var ctag = multistatus..CS::getctag.toString();
            if (!ctag.length || ctag != thisCalendar.mCtag) {
                // ctag mismatch, need to fetch calendar-data
                thisCalendar.mCtag = ctag;
                thisCalendar.mTargetCalendar.setMetaData("ctag", ctag);
                var refreshEvent = thisCalendar.prepRefresh();
                thisCalendar.getUpdatedItems(refreshEvent, aChangeLogListener);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: ctag mismatch on refresh, fetching data for calendar "
                        + thisCalendar.name);
                }
            } else {
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: ctag matches, no need to fetch data for calendar "
                        + thisCalendar.name);
                }
                // we may still need to poll the inbox
                if (thisCalendar.firstInRealm()) {
                    thisCalendar.pollInBox();
                }
            }
        };
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    refresh: function caldav_refresh() {
        if (!this.mCheckedServerInfo) {
            // If we haven't refreshed yet, then we should check the resource
            // type first. This will call refresh() again afterwards.
            this.checkDavResourceType(null);
        } else {
            this.safeRefresh();
        }
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

    prepRefresh: function caldav_prepRefresh() {

        var itemTypes = this.supportedItemTypes.concat([]);
        var typesCount = itemTypes.length;
        var refreshEvent = {};
        refreshEvent.itemTypes = itemTypes;
        refreshEvent.typesCount = typesCount;
        refreshEvent.queryStatuses = [];
        refreshEvent.itemsNeedFetching = [];
        refreshEvent.itemsReported = [];
        refreshEvent.uri = this.calendarUri;

        return refreshEvent;
    },

    getUpdatedItems: function caldav_getUpdatedItems(aRefreshEvent, aChangeLogListener) {
        if (this.mDisabled) {
            // check if maybe our calendar has become available
            this.checkDavResourceType(aChangeLogListener);
            return;
        }

        if (!aRefreshEvent.itemTypes.length) {
            return;
        }
        var itemType = aRefreshEvent.itemTypes.pop();

        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");
        default xml namespace = C;

        var queryXml =
          <calendar-query xmlns:D={D}>
            <D:prop>
              <D:getetag/>
            </D:prop>
            <filter>
              <comp-filter name="VCALENDAR">
                <comp-filter/>
              </comp-filter>
            </filter>
          </calendar-query>;

        queryXml[0].C::filter.C::["comp-filter"]
                        .C::["comp-filter"] =
                        <comp-filter name={itemType}/>;


        var queryString = xmlHeader + queryXml.toXMLString();

        var multigetQueryXml =
          <calendar-multiget xmlns:D={D} xmlns={C}>
            <D:prop>
              <D:getetag/>
              <calendar-data/>
            </D:prop>
          </calendar-multiget>;

        var thisCalendar = this;

        var etagListener = {};

        etagListener.onStreamComplete =
            function getUpdatedItems_getetag_onStreamComplete(aLoader, aContext, aStatus,
                                                              aResultLength, aResult) {
            var responseStatus;
            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " on getetag for calendar " + thisCalendar.name);
                responseStatus = aContext.responseStatus;
            } catch (ex) {
                LOG("CalDAV: Error without status on getetag for calendar " +
                    thisCalendar.name);
                responseStatus = "none";
            }

            if (responseStatus == 207) {
                // We only need to parse 207's, anything else is probably a
                // server error (i.e 50x).
                var str = convertByteArray(aResult, aResultLength);
                if (!str) {
                    LOG("CAlDAV: Failed to parse getetag REPORT");
                } else if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: recv: " + str);
                }

                if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
                }
                var multistatus = new XML(str);
                for (var i = 0; i < multistatus.*.length(); i++) {
                    var response = new XML(multistatus.*[i]);
                    var etag = response..D::["getetag"];
                    if (etag.length() == 0) {
                        continue;
                    }
                    var href = response..D::["href"];
                    var resourcePath = thisCalendar.ensurePath(href);
                    aRefreshEvent.itemsReported.push(resourcePath.toString());

                    var itemuid = thisCalendar.mHrefIndex[resourcePath];
                    if (!itemuid || etag != thisCalendar.mItemInfoCache[itemuid].etag) {
                        aRefreshEvent.itemsNeedFetching.push(resourcePath);
                    }
                }
            } else if (Math.floor(responseStatus / 100) == 4) {
                // A 4xx error probably means the server doesn't support this
                // type of query. Disable it for this session. This doesn't
                // really match the spec (which requires a 207), but it works
                // around bugs in Google and eGroupware 1.6.
                LOG("CalDAV: Server doesn't support " + itemType + "s");
                var itemTypeIndex = thisCalendar.supportedItemTypes.indexOf(itemType);
                if (itemTypeIndex > -1) {
                    thisCalendar.supportedItemTypes.splice(itemTypeIndex, 1);
                }
            } else {
                aRefreshEvent.unhandledErrors++;
            }

            aRefreshEvent.queryStatuses.push(responseStatus);
            var needsRefresh = false;
            if (aRefreshEvent.queryStatuses.length == aRefreshEvent.typesCount) {
                if (aRefreshEvent.unhandledErrors) {
                    LOG("CalDAV: Error fetching item etags");
                    thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_REPORT_ERROR);
                    if (thisCalendar.isCached && aChangeLogListener) {
                        aChangeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                    Components.results.NS_ERROR_FAILURE);
                    }
                    return;
                }
                if (thisCalendar.isCached) {
                    thisCalendar.superCalendar.startBatch();
                }
                try { 
                    // if an item has been deleted from the server, delete it here too
                    for (var path in thisCalendar.mHrefIndex) {
                        if (aRefreshEvent.itemsReported.indexOf(path) < 0 &&
                            path.indexOf(aRefreshEvent.uri.path) == 0) {

                            var getItemListener = {};
                            getItemListener.onGetResult = function caldav_gUIs_oGR(aCalendar,
                                aStatus, aItemType, aDetail, aCount, aItems) {
                                var itemToDelete = aItems[0];

                                var wasInBoxItem = thisCalendar.mItemInfoCache[itemToDelete.id].isInBoxItem;
                                if ((wasInBoxItem && thisCalendar.isInBox(aRefreshEvent.uri.spec)) ||
                                    (wasInBoxItem === false && !thisCalendar.isInBox(aRefreshEvent.uri.spec))) {
                                    delete thisCalendar.mItemInfoCache[itemToDelete.id];
                                    thisCalendar.mTargetCalendar.deleteItem(itemToDelete,
                                                                            getItemListener);
                                }
                                delete thisCalendar.mHrefIndex[path];
                                needsRefresh = true;
                            }
                            getItemListener.onOperationComplete = function
                                caldav_gUIs_oOC(aCalendar, aStatus, aOperationType,
                                                aId, aDetail) {}
                            thisCalendar.mTargetCalendar.getItem(thisCalendar.mHrefIndex[path],
                                                                 getItemListener);
                        }
                    }
                } finally { 
                    if (thisCalendar.isCached) {
                        thisCalendar.superCalendar.endBatch();
                    }
                }

                // avoid sending empty multiget requests
                // update views if something has been deleted server-side
                if (!aRefreshEvent.itemsNeedFetching.length) {
                    if (thisCalendar.isCached && aChangeLogListener) {
                        aChangeLogListener.onResult({ status: Components.results.NS_OK },
                                                    Components.results.NS_OK);
                    }
                    if (needsRefresh) {
                        thisCalendar.mObservers.notify("onLoad", [thisCalendar]);
                    }
                    // but do poll the inbox;
                    if (thisCalendar.hasScheduling &&
                        !thisCalendar.isInBox(aRefreshEvent.uri.spec)) {
                        thisCalendar.pollInBox();
                    }
                    return;
                }

                while (aRefreshEvent.itemsNeedFetching.length > 0) {
                    var locpath = aRefreshEvent.itemsNeedFetching.pop().toString();
                    var hrefXml = <hr xmlns:D={D}/>
                    hrefXml.D::href = locpath;
                    multigetQueryXml[0].appendChild(hrefXml.D::href);
                }

                var multigetQueryString = xmlHeader +
                                          multigetQueryXml.toXMLString();
                thisCalendar.getCalendarData(aRefreshEvent.uri,
                                             multigetQueryString,
                                             null,
                                             null,
                                             aChangeLogListener);

            } else {
                thisCalendar.getUpdatedItems(aRefreshEvent, aChangeLogListener);
            }
        };

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryString);
        }

        var httpchannel = calPrepHttpChannel(aRefreshEvent.uri,
                                             queryString,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.requestMethod = "REPORT";
        httpchannel.setRequestHeader("Depth", "1", false);
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, etagListener);
    },

    getCalendarData: function caldav_getCalendarData(aUri, aQuery, aItem, aListener, aChangeLogListener) {
        this.ensureTargetCalendar();

        var thisCalendar = this;
        var caldataListener = {};
        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");

        caldataListener.onStreamComplete =
            function getCalendarData_gCD_onStreamComplete(aLoader, aContext, aStatus,
                                                          aResultLength, aResult) {
            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " fetching calendar-data for calendar " + thisCalendar.name);
                responseStatus = aContext.responseStatus;
            } catch (ex) {
                LOG("CalDAV: Error without status fetching calendar-data for calendar " +
                    thisCalendar.name);
                responseStatus = "none";
            }
            responseStatus = aContext.responseStatus;
            if (responseStatus != 207) {
                LOG("error: got status " + responseStatus + " fetching calendar data");
                if (thisCalendar.isCached && aChangeLogListener)
                    aChangeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                Components.results.NS_ERROR_FAILURE);
                return;
            }
            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to parse getCalendarData REPORT");
                if (thisCalendar.isCached && aChangeLogListener) {
                    aChangeLogListener.onResult({ status: Components.results.NS_ERROR_FAILURE },
                                                Components.results.NS_ERROR_FAILURE);
                }
                return;
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }
            if (str.substr(0,6) == "<?xml ") {
                str = str.substring(str.indexOf('<', 2));
            }

            if (thisCalendar.isCached) {
                thisCalendar.superCalendar.startBatch();
            }
            try {
                var multistatus = new XML(str);
                for (var j = 0; j < multistatus.*.length(); j++) {
                    var response = new XML(multistatus.*[j]);

                    var hasNon200 = false;
                    var non200Statuses = [];
                    for (var k = 0; k < response..D::["status"].*.length(); k++) {
                      var itemStatus = "" + response..D::["status"].*[k];
                      var status = itemStatus.split(" ")[1];
                      if (status != 200) {
                          hasNon200 = true;
                          if (non200Statuses.indexOf(status) < 0) {
                              non200Statuses.push(status);
                          }
                      }
                    }

                    if (hasNon200) {
                        LOG("CalDAV: got element status " + non200Statuses.join(", ") + " while fetching calendar data");
                        continue;
                    }

                    var etag = response..D::["getetag"].toString();
                    var href = response..D::["href"].toString();
                    var resourcePath = thisCalendar.ensurePath(href);
                    var calData = response..C::["calendar-data"];

                    var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                                           .createInstance(Components.interfaces.calIIcsParser);
                    parser.parseString(calData, null);
                    // with CalDAV there really should only be one item here
                    var items = parser.getItems({});
                    var propertiesList = parser.getProperties({});
                    var method;
                    for each (var prop in propertiesList) {
                        if (prop.propertyName == "METHOD") {
                            method = prop.value;
                            break;
                        }
                    }
                    var isReply = (method == "REPLY");
                    var item = items[0];
                    if (!item) {
                        thisCalendar.notifyOperationComplete(aListener,
                                                             Components.results.NS_ERROR_FAILURE,
                                                             Components.interfaces.calIOperationListener.GET,
                                                             null,
                                                             "failed to retrieve item");
                        return;
                    }

                    item.calendar = thisCalendar.superCalendar;
                    if (isReply && thisCalendar.isInBox(aUri.spec)) {
                        if (thisCalendar.hasScheduling) {
                            thisCalendar.processItipReply(item, resourcePath);
                        }
                        continue;
                    }

                    var pathLength = decodeURIComponent(aUri.path).length;
                    var locationPath = decodeURIComponent(resourcePath).substr(pathLength);
                    var isInboxItem = thisCalendar.isInBox(aUri.spec);
                    if (thisCalendar.mItemInfoCache[item.id]) {
                        thisCalendar.mItemInfoCache[item.id].isNew = false;
                    } else {
                        thisCalendar.mItemInfoCache[item.id] = { isNew: true };
                    }
                    thisCalendar.mItemInfoCache[item.id].locationPath = locationPath;
                    thisCalendar.mItemInfoCache[item.id].isInBoxItem = isInboxItem;

                    var hrefPath = thisCalendar.ensurePath(href);
                    thisCalendar.mHrefIndex[hrefPath] = item.id;
                    thisCalendar.mItemInfoCache[item.id].etag = etag;

                    if (thisCalendar.mItemInfoCache[item.id].isNew) {
                        thisCalendar.mTargetCalendar.adoptItem(item, aListener);
                    } else {
                        thisCalendar.mTargetCalendar.modifyItem(item, null, aListener);
                    }

                    if (thisCalendar.isCached) {
                        thisCalendar.setMetaData(item.id, resourcePath, etag, isInboxItem);
                    }
                }
                LOG("refresh completed with status " + responseStatus + " at " + aUri.spec);
            } finally { 
                if (thisCalendar.isCached) {
                    thisCalendar.superCalendar.endBatch();
                }
            }

            if (thisCalendar.isCached) {
                if (aChangeLogListener)
                    aChangeLogListener.onResult({ status: Components.results.NS_OK },
                                                Components.results.NS_OK);
            } else {
                thisCalendar.mObservers.notify("onLoad", [thisCalendar]);
            }
            thisCalendar.mFirstRefreshDone = true;
            while (thisCalendar.mQueuedQueries.length) {
                var query = thisCalendar.mQueuedQueries.pop();
                thisCalendar.mTargetCalendar.getItems
                            .apply(thisCalendar.mTargetCalendar, query);
            }
            if (thisCalendar.hasScheduling &&
                !thisCalendar.isInBox(aUri.spec)) {
                thisCalendar.pollInBox();
            }
        };

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + aQuery);
        }

        var httpchannel = calPrepHttpChannel(aUri,
                                             aQuery,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.requestMethod = "REPORT";
        httpchannel.setRequestHeader("Depth", "1", false);
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, caldataListener);
    },

    /**
     * @see nsIInterfaceRequestor
     * @see calProviderUtils.js
     */
    getInterface: calInterfaceRequestor_getInterface,

    //
    // Helper functions
    //

    /**
     * Checks that the calendar URI exists and is a CalDAV calendar. This is the
     * beginning of a chain of asynchronous calls. This function will, when
     * done, call the next function related to checking resource type, server
     * capabilties, etc.
     *
     * checkDavResourceType                        * You are here 
     * checkServerCaps
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    checkDavResourceType: function caldav_checkDavResourceType(aChangeLogListener) {
        this.ensureTargetCalendar();

        var resourceTypeXml = null;
        var resourceType = kDavResourceTypeNone;
        var thisCalendar = this;

        var D = new Namespace("D", "DAV:");
        var CS = new Namespace("CS", "http://calendarserver.org/ns/");
        var queryXml = <D:propfind xmlns:D="DAV:" xmlns:CS={CS}>
                        <D:prop>
                            <D:resourcetype/>
                            <D:owner/>
                            <CS:getctag/>
                        </D:prop>
                        </D:propfind>;
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }
        var httpchannel = calPrepHttpChannel(this.calendarUri,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};

        streamListener.onStreamComplete =
            function checkDavResourceType_oSC(aLoader, aContext, aStatus, aResultLength, aResult) {
            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " on initial PROPFIND for calendar " + thisCalendar.name);
            } catch (ex) {
                LOG("CalDAV: Error without status on initial PROPFIND for calendar " +
                    thisCalendar.name);
            }
            var wwwauth;
            try {
                wwwauth = aContext.getRequestHeader("Authorization");
                thisCalendar.mAuthScheme = wwwauth.split(" ")[0];
            } catch (ex) {
                // no auth header could mean a public calendar
                thisCalendar.mAuthScheme = "none";
            }

            if (thisCalendar.mUriParams) {
                thisCalendar.mAuthScheme = "Ticket";
            }
            LOG("CalDAV: Authentication scheme " + thisCalendar.mAuthScheme);
            // we only really need the authrealm for Digest auth
            // since only Digest is going to time out on us
            if (thisCalendar.mAuthScheme == "Digest") {
                var realmChop = wwwauth.split("realm=\"")[1];
                thisCalendar.mAuthRealm = realmChop.split("\", ")[0];
                LOG("CalDAV: realm " + thisCalendar.mAuthRealm);
            }

            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to determine resource type");
                thisCalendar.completeCheckServerInfo(aChangeLogListener, 
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (str.substr(0,6) == "<?xml ") {
                str = str.substring(str.indexOf('<', 2));
            }
            try {
                var multistatus = new XML(str);
            } catch (ex) {
                thisCalendar.completeCheckServerInfo(aChangeLogListener, 
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            }

            // check for server-side ctag support
            var ctag = multistatus..CS::["getctag"].toString();
            if (ctag.length) {
                thisCalendar.mCtag = ctag;
                thisCalendar.mTargetCalendar.setMetaData("ctag", ctag);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: initial ctag " + ctag + " for calendar " + thisCalendar.name);
                }
            }

            // check if owner is specified; might save some work
            thisCalendar.mPrincipalUrl = multistatus..D::["owner"]..D::href.toString() || null;

            var resourceTypeXml = multistatus..D::["resourcetype"];
            if (resourceTypeXml.length() == 0) {
                resourceType = kDavResourceTypeNone;
            } else if (resourceTypeXml.toString().indexOf("calendar") != -1) {
                resourceType = kDavResourceTypeCalendar;
            } else if (resourceTypeXml.toString().indexOf("collection") != -1) {
                resourceType = kDavResourceTypeCollection;
            }

            // specialcasing so as not to break older SOGo revs. Remove when
            // versions with fixed principal-URL PROPFIND bug are out there
            if (resourceTypeXml.toString().indexOf("groupdav") != -1) {
                thisCalendar.mPrincipalUrl = null;
            }
            // end of SOGo specialcasing

            if (resourceType == kDavResourceTypeNone &&
                !thisCalendar.mDisabled) {
                thisCalendar.completeCheckServerInfo(aChangeLogListener, 
                                                     Components.interfaces.calIErrors.DAV_NOT_DAV);
                return;
            }

            if ((resourceType == kDavResourceTypeCollection) &&
                !thisCalendar.mDisabled) {
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

            thisCalendar.setCalHomeSet();
            thisCalendar.checkServerCaps(aChangeLogListener);
        };
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * Checks server capabilities.
     *
     * checkDavResourceType
     * checkServerCaps                              * You are here 
     * findPrincipalNS
     * checkPrincipalsNameSpace
     * completeCheckServerInfo
     */
    checkServerCaps: function caldav_checkServerCaps(aChangeLogListener) {
        var homeSet = this.mCalHomeSet.clone();
        var thisCalendar = this;

        var httpchannel = calPrepHttpChannel(homeSet, null, null, this);

        httpchannel.requestMethod = "OPTIONS";
        if (this.verboseLogging()) {
            LOG("CalDAV: send: OPTIONS");
        }

        var streamListener = {};
        streamListener.onStreamComplete =
            function checkServerCaps_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var dav = null;
            try {
                dav = aContext.getResponseHeader("DAV");
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: DAV header: " + dav);
                }
            } catch (ex) {
                LOG("CalDAV: Error getting DAV header, status " + aContext.responseStatus);
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
                    LOG("CalDAV: Server supports calendar-auto-schedule");
                }
                thisCalendar.hasAutoScheduling = true;
                // leave outbound inbox/outbox scheduling off
            } else if (dav && dav.indexOf("calendar-schedule") != -1) {
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: Server generally supports calendar-schedule");
                }
                thisCalendar.hasScheduling = true;
            }

            if (thisCalendar.hasAutoScheduling || (dav && dav.indexOf("calendar-schedule") != -1)) {
                // XXX - we really shouldn't register with the fb service
                // if another calendar with the same principal-URL has already
                // done so. We also shouldn't register with the fb service if we
                // don't have an outbox.
                getFreeBusyService().addProvider(thisCalendar);
                thisCalendar.findPrincipalNS(aChangeLogListener);
            } else {
                LOG("CalDAV: Server does not support CalDAV scheduling.");
                thisCalendar.completeCheckServerInfo(aChangeLogListener);
            }
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * Locates the principal namespace. This function should soely be called
     * from checkServerCaps to find the principal namespace.
     *
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

        var homeSet = this.mCalHomeSet.clone();
        var thisCalendar = this;

        var D = new Namespace("D", "DAV:");
        var queryXml =
            <D:propfind xmlns:D="DAV:">
                <D:prop>
                    <D:principal-collection-set/>
                </D:prop>
            </D:propfind>;

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + homeSet.spec + "\n"  + queryXml);
        }
        var httpchannel = calPrepHttpChannel(homeSet,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);

        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};
        streamListener.onStreamComplete =
            function findInOutBoxes_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            if (aContext.responseStatus != 207) {
                LOG("CalDAV: Unexpected status " + aContext.responseStatus +
                    " while querying principal namespace");
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.results.NS_ERROR_FAILURE);
                return;
            }

            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to propstat principal namespace");
                thisCalendar.completeCheckServerInfo(aChangeLogListener,
                                                     Components.results.NS_ERROR_FAILURE);
                return;
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (str.substr(0,6) == "<?xml ") {
                str = str.substring(str.indexOf('<', 2));
            }
            var multistatus = new XML(str);
            var pcs = multistatus..D::["principal-collection-set"]..D::href;
            var nsList = [];
            for (var ns in pcs) {
                var nsString = pcs[ns].toString();
                var nsPath = thisCalendar.ensurePath(nsString);
                nsList.push(nsPath);
            }

            thisCalendar.checkPrincipalsNameSpace(nsList, aChangeLogListener);
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * Checks the principals namespace for scheduling info. This function should
     * soely be called from findPrincipalNS
     *
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
            thisCalendar.mInBoxUrl = null;
            thisCalendar.mOutBoxUrl = null;
            thisCalendar.completeCheckServerInfo(aChangeLogListener);
        }

        if (!aNameSpaceList.length) {
            if (this.verboseLogging()) {
                LOG("CalDAV: principal namespace list empty, server does not support scheduling");
            }
            doesntSupportScheduling();
            return;
        }

        // Remove trailing slash, if its there
        var homePath = this.mCalHomeSet.path.replace(/\/$/,"");

        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");
        default xml namespace = C;

        var queryXml;
        var queryMethod;
        var queryDepth;
        if (this.mPrincipalUrl) {
            queryXml = <D:propfind xmlns:D="DAV:"
                                   xmlns:C="urn:ietf:params:xml:ns:caldav">
                <D:prop>
                    <C:calendar-home-set/>
                    <C:calendar-user-address-set/>
                    <C:schedule-inbox-URL/>
                    <C:schedule-outbox-URL/>
                </D:prop>
            </D:propfind>;
            queryMethod = "PROPFIND";
            queryDepth = 0;
        } else {
            queryXml = <D:principal-property-search xmlns:D="DAV:"
                                                    xmlns:C="urn:ietf:params:xml:ns:caldav">
            <D:property-search>
                <D:prop>
                    <C:calendar-home-set/>
                </D:prop>
                <D:match>{homePath}</D:match>
            </D:property-search>
                <D:prop>
                    <C:calendar-home-set/>
                    <C:calendar-user-address-set/>
                    <C:schedule-inbox-URL/>
                    <C:schedule-outbox-URL/>
                </D:prop>
            </D:principal-property-search>;
            queryMethod = "REPORT";
            queryDepth = 1;
        }

        // We want a trailing slash, ensure it.
        var nsUri = this.calendarUri.clone();
        nsUri.path = aNameSpaceList.pop().replace(/([^\/])$/, "$1/");

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryMethod + " " + nsUri.spec + "\n" + queryXml);
        }

        var httpchannel = calPrepHttpChannel(nsUri,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);

        httpchannel.requestMethod = queryMethod;
        if (queryDepth == 0) {
            // Set header, doing this for Depth: 1 is not needed since thats the
            // default.
            httpchannel.setRequestHeader("Depth", "0", false);
        }

        var streamListener = {};
        streamListener.onStreamComplete =
            function caldav_cPNS_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to report principals namespace");
                doesntSupportScheduling();
                return;
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (aContext.responseStatus != 207) {
                LOG("CalDAV: Bad response to in/outbox query, status " +
                    aContext.responseStatus);
                doesntSupportScheduling();
                return;
            }

            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            var multistatus = new XML(str);
            var multistatusLength = multistatus.*.length();

            for (var i = 0; i < multistatusLength; i++) {
                var response = multistatus.*[i];

                var responseCHS = response..C::["calendar-home-set"]..D::href[0];
                if (!responseCHS) {
                    responseCHS = response..D::["calendar-home-set"]..D::href[0];
                }

                try {
                    if (responseCHS.charAt(responseCHS.toString().length -1) != "/") {
                        responseCHS += "/";
                    }
                } catch (ex) {}

                if (multistatusLength > 1 &&
                    (responseCHS != thisCalendar.mCalHomeSet.path &&
                     responseCHS != thisCalendar.mCalHomeSet.spec)) {
                    // If there are multiple home sets, then we need to match
                    // the home url. If there is only one, we can assume its the
                    // correct one, even if the home set doesn't quite match.
                    continue;
                }
                var addrHrefs =
                    response..C::["calendar-user-address-set"]..D::href;
                if (!addrHrefs.toString().length) {
                    addrHrefs =
                        response..D::propstat..D::["calendar-user-address-set"]..D::href;
                }
                for (var j = 0; j < addrHrefs.*.length(); j++) {
                    if (addrHrefs[j].substr(0,7).toLowerCase() == "mailto:") {
                        thisCalendar.mCalendarUserAddress = addrHrefs[j].toString();
                    }
                }
                var ibUrl = thisCalendar.mUri.clone();
                var ibPath =
                    response..C::["schedule-inbox-URL"]..D::href[0];
                if (!ibPath) {
                    var ibPath = response..D::["schedule-inbox-URL"]..D::href[0];
                }
                ibUrl.path = thisCalendar.ensurePath(ibPath);
                thisCalendar.mInBoxUrl = ibUrl;
                if (thisCalendar.calendarUri.spec == ibUrl.spec) {
                    // If the inbox matches the calendar uri (i.e SOGo), then we
                    // don't need to poll the inbox.
                    thisCalendar.mShouldPollInbox = false;
                }

                var obUrl = thisCalendar.mUri.clone();
                var obPath =
                    response..C::["schedule-outbox-URL"]..D::href[0];
                if (!obPath) {
                    var obPath = response..D::["schedule-outbox-URL"]..D::href[0];
                }
                obUrl.path = thisCalendar.ensurePath(obPath);
                thisCalendar.mOutBoxUrl = obUrl;
            }

            if (!thisCalendar.calendarUserAddress ||
                !thisCalendar.mInBoxUrl ||
                !thisCalendar.mOutBoxUrl) {
                if (aNameSpaceList.length) {
                    // Check the next namespace to find the info we need.
                    thisCalendar.checkPrincipalsNameSpace(aNameSpaceList, aChangeLogListener);
                } else {
                    if (thisCalendar.verboseLogging()) {
                        LOG("CalDAV: principal namespace list empty, server does not support scheduling");
                    }
                    doesntSupportScheduling();
                }
            } else {
                // We have everything, complete.
                thisCalendar.completeCheckServerInfo(aChangeLogListener);
            }
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * This is called to complete checking the server info. It should be the
     * final call when checking server options. This will either report the
     * error or if it is a success then refresh the calendar.
     *
     * checkDavResourceType
     * checkServerCaps
     * findPrincipalNS              
     * checkPrincipalsNameSpace
     * completeCheckServerInfo                      * You are here
     */
    completeCheckServerInfo: function caldav_completeCheckServerInfo(aChangeLogListener, aError) {
        if (Components.isSuccessCode(aError)) {
            // "undefined" is a successcode, so all is good
            this.mCheckedServerInfo = true;

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
    reportDavError: function caldav_reportDavError(aErrNo) {
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
        var modificationError = mapModification[aErrNo];

        if (!message) {
            // If we don't have a message for this, then its not important
            // enough to notify.
            return;
        }

        this.mReadOnly = true;
        this.mDisabled = true;
        this.notifyError(aErrNo,
                         calGetString("calendar", message , [this.mUri.spec]));
        this.notifyError(modificationError
                         ? Components.interfaces.calIErrors.MODIFICATION_FAILED
                         : Components.interfaces.calIErrors.READ_FAILED,
                         "");
    },

    //
    // calIFreeBusyProvider interface
    //

    getFreeBusyIntervals: function caldav_getFreeBusyIntervals(
        aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {

        // We explicitly don't check for hasScheduling here to allow free-busy queries
        // even in case sched is turned off.
        if (!this.outBoxUrl || !this.calendarUserAddress) {
            LOG("CalDAV: Server does not support scheduling; freebusy query not possible");
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
        fbComp.uid = getUUID();
        prop = getIcsService().createIcalProperty("ATTENDEE");
        prop.setParameter("PARTSTAT", "NEEDS-ACTION");
        prop.setParameter("ROLE", "REQ-PARTICIPANT");
        prop.setParameter("CUTYPE", "INDIVIDUAL");
        prop.value = mailto_aCalId;
        fbComp.addProperty(prop);
        fbQuery.addSubcomponent(fbComp);
        fbQuery = fbQuery.serializeToICS();
        if (this.verboseLogging()) {
            LOG("CalDAV: send (Originator=" + organizer +
                    ",Recipient=" + mailto_aCalId + "): " + fbQuery);
        }

        var httpchannel = calPrepHttpChannel(this.outBoxUrl,
                                             fbQuery,
                                             "text/calendar; charset=utf-8",
                                             this);
        httpchannel.requestMethod = "POST";
        httpchannel.setRequestHeader("Originator", organizer, false);
        httpchannel.setRequestHeader("Recipient", mailto_aCalId, false);

        var streamListener = {};

        streamListener.onStreamComplete =
            function caldav_GFBI_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to parse freebusy response");
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (aContext.responseStatus == 200) {
                var periodsToReturn = [];
                var CalPeriod = new Components.Constructor("@mozilla.org/calendar/period;1",
                                                           "calIPeriod");
                var fbTypeMap = {};
                fbTypeMap["FREE"] = calIFreeBusyInterval.FREE;
                fbTypeMap["BUSY"] = calIFreeBusyInterval.BUSY;
                fbTypeMap["BUSY-UNAVAILABLE"] = calIFreeBusyInterval.BUSY_UNAVAILABLE;
                fbTypeMap["BUSY-TENTATIVE"] = calIFreeBusyInterval.BUSY_TENTATIVE;
                var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
                var D = new Namespace("D", "DAV:");

                if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
                }

                var response = new XML(str);
                var status = response..C::response..C::["request-status"];
                if (status.substr(0,1) != 2) {
                    LOG("CalDAV: Got status " + status + " in response to freebusy query");
                    aListener.onResult(null, null);
                    return;
                }
                if (status.substr(0,3) != "2.0") {
                    LOG("CalDAV: Got status " + status + " in response to freebusy query");
                }

                var caldata = response..C::response..C::["calendar-data"];
                try {
                    function iterFunc(fbComp) {
                        var interval;

                        var replyRangeStart = fbComp.startTime;
                        if (replyRangeStart && (aRangeStart.compare(replyRangeStart) == -1)) {
                            interval = new calFreeBusyInterval(aCalId,
                                                               calIFreeBusyInterval.UNKNOWN,
                                                               aRangeStart,
                                                               replyRangeStart);
                            periodsToReturn.push(interval);
                        }
                        var replyRangeEnd = fbComp.endTime;
                        if (replyRangeEnd && (aRangeEnd.compare(replyRangeEnd) == 1)) {
                            interval = new calFreeBusyInterval(aCalId,
                                                               calIFreeBusyInterval.UNKNOWN,
                                                               replyRangeEnd,
                                                               aRangeEnd);
                            periodsToReturn.push(interval);
                        }

                        for (var fbProp = fbComp.getFirstProperty("FREEBUSY");
                             fbProp;
                             fbProp = fbComp.getNextProperty("FREEBUSY")) {

                            var fbType = fbProp.getParameter("FBTYPE");
                            if (fbType) {
                                fbType = fbTypeMap[fbType];
                            } else {
                                fbType = calIFreeBusyInterval.UNKNOWN;
                            }
                            var parts = fbProp.value.split("/");
                            var begin = createDateTime(parts[0]);
                            var end;
                            if (parts[1].charAt(0) == "P") { // this is a duration
                                end = begin.clone();
                                end.addDuration(createDuration(parts[1]))
                            } else {
                                // This is a date string
                                end = createDateTime(parts[1]);
                            }
                            interval = new calFreeBusyInterval(aCalId,
                                                               fbType,
                                                               begin,
                                                               end);
                            periodsToReturn.push(interval);
                        }
                    }
                    calIterateIcalComponent(getIcsService().parseICS(caldata, null), iterFunc);
                } catch (exc) {
                    LOG("Error parsing free-busy info.");
                }

                aListener.onResult(null, periodsToReturn);
            } else {
                LOG("CalDAV: Received status " + aContext.responseStatus + " from freebusy query");
                aListener.onResult(null, null);
            }
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    ensurePath: function caldav_ensurePath(aString) {
        if (aString.charAt(0) != "/") {
            var bogusUri = makeURL(aString);
            return bogusUri.path;
        }
        return aString;
    },

    isInBox: function caldav_isInBox(aString) {
        return (this.hasScheduling && this.mInBoxUrl &&
                aString.indexOf(this.mInBoxUrl.spec) == 0);
    },

    /**
     * Query contents of scheduling inbox
     *
     */
    pollInBox: function caldav_pollInBox() {
        // If polling the inbox was switched off, no need to poll the inbox.
        // Also, if we have more than one calendar in this CalDAV account, we
        // want only one of them to be checking the inbox.
        if (!this.hasScheduling || !this.mShouldPollInbox || !this.firstInRealm()) {
            return;
        }

        var itemTypes = this.supportedItemTypes.concat([]);
        var typesCount = itemTypes.length;
        var refreshEvent = {};
        refreshEvent.itemTypes = itemTypes;
        refreshEvent.typesCount = typesCount;
        refreshEvent.queryStatuses = [];
        refreshEvent.itemsNeedFetching = [];
        refreshEvent.itemsReported = [];
        refreshEvent.uri = this.mInBoxUrl;

        this.getUpdatedItems(refreshEvent);
    },

    //
    // take calISchedulingSupport interface base implementation (calProviderBase.js)
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
            LOG("CalDAV: status " + aStatus + " while processing iTIP REPLY");
            // don't delete the REPLY item from inbox unless modifying the master
            // item was successful
            if (aStatus == 0) { // aStatus undocumented; 0 seems to indicate no error
                var delUri = thisCalendar.calendarUri.clone();
                delUri.path = aPath;
                thisCalendar.doDeleteItem(aItem, null, true, true, delUri);
            }
        };

        this.mTargetCalendar.getItem(aItem.id, getItemListener);
    },

    canNotify: function caldav_canNotify(aMethod, aItem) {
        if (this.hasAutoScheduling) { // auto-sched takes precedence
            return true;
        }
        return false; // use outbound iTIP for all
    },

    //
    // calIItipTransport interface
    //

    get defaultIdentity caldav_get_defaultIdentity() {
        return this.calendarUserAddress;
    },

    get scheme caldav_get_scheme() {
        return "mailto";
    },

    mSenderAddress: null,
    get senderAddress caldav_get_senderAddress() {
        return this.mSenderAddress || this.calendarUserAddress;
    },
    set senderAddress caldav_set_senderAddress(aString) {
        return (this.mSenderAddress = aString);
    },

    sendItems: function caldav_sendItems(aCount, aRecipients, aItipItem) {

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
            var uploadData = serializer.serializeToString();

            var httpchannel = calPrepHttpChannel(this.outBoxUrl,
                                                 uploadData,
                                                 "text/calendar; charset=utf-8",
                                                 this);
            httpchannel.requestMethod = "POST";
            httpchannel.setRequestHeader("Originator", this.calendarUserAddress, false);
            for each (var recipient in aRecipients) {
                httpchannel.setRequestHeader("Recipient", recipient.id, true);
            }

            var thisCalendar = this;
            var streamListener = {
                onStreamComplete: function caldav_sendItems_oSC(aLoader, aContext, aStatus,
                                                                aResultLength, aResult) {
                    var status;
                    try {
                        status = aContext.responseStatus;
                    } catch (ex) {
                        status = Components.interfaces.calIErrors.DAV_POST_ERROR;
                        LOG("CalDAV: no response status when sending iTIP.");
                    }

                    if (status != 200) {
                        LOG("Sending iITIP failed with status " + status);
                    }

                    var str = convertByteArray(aResult, aResultLength, "UTF-8", false);
                    if (str) {
                        if (thisCalendar.verboseLogging()) {
                            LOG("CalDAV: recv: " + str);
                        }
                    } else {
                        LOG("CalDAV: Failed to parse iTIP response.");
                    }
                    if (str.substr(0,6) == "<?xml ") {
                        str = str.substring(str.indexOf('<', 2));
                    }

                    var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
                    var D = new Namespace("D", "DAV:");
                    var responseXML = new XML(str);

                    var remainingAttendees = [];
                    for (var i = 0; i < responseXML.*.length(); i++) {
                        var response = new XML(responseXML.*[i]);
                        var recip = response..C::recipient..D::href;
                        var status = response..C::["request-status"];
                        if (status.substr(0, 1) != "2") {
                            if (thisCalendar.verboseLogging()) {
                                LOG("CalDAV: failed delivery to " + recip);
                            }
                            for each (var att in aRecipients) {
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
                        var imipTransport = calGetImipTransport(thisCalendar);
                        if (imipTransport) {
                            if (thisCalendar.verboseLogging()) {
                                LOG("CalDAV: sending email to " + remainingAttendees.length + " recipients");
                            }
                            imipTransport.sendItems(remainingAttendees.length, remainingAttendees, aItipItem);
                        } else {
                            LOG("CalDAV: no fallback to iTIP/iMIP transport.");
                        }
                    }
                }
            };

            if (this.verboseLogging()) {
                LOG("CalDAV: send: " + uploadData);
            }
            var streamLoader = createStreamLoader();
            calSendHttpRequest(streamLoader, httpchannel, streamListener);
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
            LOG("CalDAV: send: " + serializedItem);
        }
        return serializedItem;
    },

    // nsIChannelEventSink implementation
    onChannelRedirect: function caldav_onChannelRedirect(aOldChannel, aNewChannel, aFlags) {
        // TODO We might need to re-prepare the new channel here
    }
};

function calDavObserver(aCalendar) {
    this.mCalendar = aCalendar;
}

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
