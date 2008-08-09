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
    this.mPrincipalsNS = null;
    this.mInBoxUrl = null;
    this.mOutBoxUrl = null;
    this.mHaveScheduling = false;
    this.mMailToUrl = null;
    this.mHrefIndex = [];
    this.mAuthScheme = null;
    this.mAuthRealm = null;
    this.mObserver = null;
    this.mFirstRefreshDone = false;
    this.mQueuedQueries = [];
    this.mCtag = null;
}

// some shorthand
const calICalendar = Components.interfaces.calICalendar;
const nsISupportsCString = Components.interfaces.nsISupportsCString;
const calIErrors = Components.interfaces.calIErrors;
const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;
const calICalDavCalendar = Components.interfaces.calICalDavCalendar;
const calIDateTime = Components.interfaces.calIDateTime;

// END_OF_TIME needs to be the max value a PRTime can be
const START_OF_TIME = -0x7fffffffffffffff;
const END_OF_TIME = 0x7fffffffffffffff;

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
    QueryInterface: function (aIID) {
        return doQueryInterface(this, calDavCalendar.prototype, aIID,
                                [Components.interfaces.calICalendarProvider,
                                 Components.interfaces.nsIInterfaceRequestor,
                                 Components.interfaces.calIFreeBusyProvider,
                                 Components.interfaces.nsIChannelEventSink,
                                 calICalDavCalendar]);
    },

    initMemoryCalendar: function caldav_iMC() {
        this.mMemoryCalendar = Components.classes["@mozilla.org/calendar/calendar;1?type=memory"]
                                         .createInstance(Components.interfaces.calICalendar);

        this.mMemoryCalendar.superCalendar = this;
        this.mObserver = new calDavObserver(this);
        this.mMemoryCalendar.addObserver(this.mObserver);
        this.mMemoryCalendar.setProperty("relaxedMode", true);
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

    createCalendar: function caldav_createCal() {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    deleteCalendar: function caldav_deleteCal(cal, listener) {
        throw NS_ERROR_NOT_IMPLEMENTED;
    },

    //
    // calICalendar interface
    //

    // readonly attribute AUTF8String type;
    get type() { return "caldav"; },

    mDisabled: false,

    mPrincipalsNS: null,

    mHaveScheduling: false,

    mMailToUrl: null,

    get canRefresh() {
        return true;
    },

    // mUriParams stores trailing ?parameters from the
    // supplied calendar URI. Needed for (at least) Cosmo
    // tickets
    mUriParams: null,

    get uri() { return this.mUri },

    set uri(aUri) {
        this.mUri = aUri;
        this.initMemoryCalendar();

        return aUri;
    },

    get mCalendarUri() {
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

    mInBoxUrl: null,

    mAuthScheme: null,

    mAuthRealm: null,

    mFirstRefreshDone: false,

    mQueuedQueries: null,

    mCtag: null,

    get authRealm() {
        return this.mAuthRealm;
    },

    makeUri: function caldav_makeUri(aInsertString) {
        var spec = this.mCalendarUri.spec + aInsertString;
        if (this.mUriParams) {
            return spec + this.mUriParams;
        }
        return spec;
    },

    get mLocationPath() {
        return decodeURIComponent(this.mCalendarUri.path);
    },

    getItemLocationPath: function caldavGILP(aItem) {
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

    // XXX todo: in general we want to do CalDAV scheduling, but for servers
    //           that don't support it, we want Itip
    // sendItipInvitations is now used from calProviderBase.

    promptOverwrite: function caldavPO(aMethod, aItem, aListener, aOldItem) {
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
                this.doDeleteItem(aItem, aListener, true);
            }
        } else {
            this.getUpdatedItem(aItem, aListener);
        }

    },

    mItemInfoCache: null,

    mHrefIndex: null,

    /**
     * addItem(); required by calICalendar.idl
     * we actually use doAdoptItem()
     *
     * @param aItem       item to add
     * @param aListener   listener for method completion
     */

    addItem: function caldavAI(aItem, aListener) {
        var newItem = aItem.clone();
        return this.doAdoptItem(newItem, aListener, false);
    },

    /**
     * adooptItem(); required by calICalendar.idl
     * we actually use doAdoptItem()
     *
     * @param aItem       item to check
     * @param aListener   listener for method completion
     */
    adoptItem: function caldavAtI(aItem, aListener) {
        var newItem = aItem.clone();
        return this.doAdoptItem(newItem, aListener, false);
    },

    /**
     * Performs the actual addition of the item to CalDAV store
     *
     * @param aItem       item to add
     * @param aListener   listener for method completion
     * @param aIgnoreEtag ignore item etag
     */
    doAdoptItem: function caldavaDAI(aItem, aListener, aIgnoreEtag) {
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
        var itemUri = this.mCalendarUri.clone();
        itemUri.spec = this.makeUri(locationPath);
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
                if (!str) {
                    LOG("CalDAV: empty or unparseable response on add");
                } else {
                    LOG("CalDAV: recv: " + str);
                }
            }
            // 201 = HTTP "Created"
            //
            if (status == 201) {
                LOG("CalDAV: Item added successfully");

                var retVal = Components.results.NS_OK;
                // Some CalDAV servers will modify items on PUT (add X-props,
                // change location, etc) so we'd best re-fetch in order to know
                // the current state of the item
                // Observers will be notified in getUpdatedItem()
                thisCalendar.getUpdatedItem(aItem, aListener);
            } else {
                if (status > 999) {
                    status = "0x" + status.toString(16);
                }
                LOG("CalDAV: Unexpected status adding item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_PUT_ERROR,
                                            "itemPutError", true);
            }
        };

        aItem.calendar = this.superCalendar;
        aItem.generation = 1;

        var httpchannel = calPrepHttpChannel(itemUri,
                                             aItem.icalString,
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
    modifyItem: function caldavMI(aNewItem, aOldItem, aListener) {
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
    doModifyItem: function caldavMI(aNewItem, aOldItem, aListener, aIgnoreEtag) {

        if (aNewItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.MODIFY,
                                         aItem.id,
                                         "ID for modifyItem doesn't exist or is null");
            return;
        }

        var newItem_ = aNewItem;
        aNewItem = aNewItem.parentItem.clone();
        if (newItem_.parentItem != newItem_) {
            aNewItem.recurrenceInfo.modifyException(newItem_, false);
        }
        aNewItem.generation += 1;

        var eventUri = this.mCalendarUri.clone();
        eventUri.spec = this.makeUri(this.mItemInfoCache[aNewItem.id].locationPath);

        var modListener = {};
        var thisCalendar = this;

        var modifiedItemICS = this.getSerializedItem(aNewItem);

        modListener.onStreamComplete = function(aLoader, aContext, aStatus,
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

            if (status == 204 || status == 200) {
                LOG("CalDAV: Item modified successfully.");
                var retVal = Components.results.NS_OK;
                // Some CalDAV servers will modify items on PUT (add X-props,
                // change location, etc) so we'd best re-fetch in order to know
                // the current state of the item
                // Observers will be notified in getUpdatedItem()
                thisCalendar.getUpdatedItem(aNewItem, aListener);
            } else if (status == 412) {
                thisCalendar.promptOverwrite(CALDAV_MODIFY_ITEM, aNewItem,
                                             aListener, aOldItem);
            } else {
                if (status > 999) {
                    status = "0x " + status.toString(16);
                }
                LOG("CalDAV: Unexpected status on modifying item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_PUT_ERROR,
                                            "itemPutError", true);

                retVal = Components.results.NS_ERROR_FAILURE;
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
    deleteItem: function caldavDI(aItem, aListener) {
        return this.doDeleteItem(aItem, aListener, false);
    },

    /**
     * Deletes item from CalDAV store.
     *
     * @param aItem       item to delete
     * @param aListener   listener for method completion
     * @param aIgnoreEtag ignore item etag
     */
    doDeleteItem: function caldavDDI(aItem, aListener, aIgnoreEtag) {

        if (aItem.id == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.DELETE,
                                         aItem.id,
                                         "ID doesn't exist for deleteItem");
            return;
        }

        var eventUri = this.mCalendarUri.clone();
        eventUri.spec = this.makeUri(this.mItemInfoCache[aItem.id].locationPath);

        var delListener = {};
        var thisCalendar = this;
        var realListener = aListener; // need to access from callback

        delListener.onStreamComplete =
        function caldavDLoSC(aLoader, aContext, aStatus, aResultLength, aResult) {
            var status;
            try {
                status = aContext.responseStatus;
            } catch (ex) {
                status = Components.interfaces.calIErrors.DAV_REMOVE_ERROR;
            }

            // 204 = HTTP "No content"
            //
            if (status == 204 || status == 200) {
                thisCalendar.mMemoryCalendar.deleteItem(aItem, aListener);
                delete thisCalendar.mHrefIndex[eventUri.path];
                delete thisCalendar.mItemInfoCache[aItem.id];
                LOG("CalDAV: Item deleted successfully.");
                var retVal = Components.results.NS_OK;
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
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_REMOVE_ERROR,
                                            "itemDeleteError", true);
                retVal = Components.results.NS_ERROR_FAILURE;
            }
        };
        var delListener2 = {};
        delListener2.onStreamComplete =
        function caldavDL2oSC(aLoader, aContext, aStatus, aResultLength, aResult) {
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
    getUpdatedItem: function caldavGUI(aItem, aListener) {

        if (aItem == null) {
            this.notifyOperationComplete(aListener,
                                         Components.results.NS_ERROR_FAILURE,
                                         Components.interfaces.calIOperationListener.GET,
                                         null,
                                         "passed in null item");
            return;
        }

        var itemUri = this.mCalendarUri.clone();
        var locationPath = this.getItemLocationPath(aItem);
        itemUri.spec = this.makeUri(locationPath);

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

        this.getCalendarData(xmlHeader + multigetQueryXml.toXMLString(), aItem,
                             aListener);

    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function (aId, aListener) {
        this.mMemoryCalendar.getItem(aId, aListener);
    },

    // void getItems( in unsigned long aItemFilter, in unsigned long aCount,
    //                in calIDateTime aRangeStart, in calIDateTime aRangeEnd,
    //                in calIOperationListener aListener );
    getItems: function caldav_getItems(aItemFilter, aCount, aRangeStart,
                                       aRangeEnd, aListener) {

        if (!this.mFirstRefreshDone) {
            if (!this.mQueuedQueries.length) {
                this.checkDavResourceType();
            }
            var query = [aItemFilter, aCount, aRangeStart, aRangeEnd, aListener];
            this.mQueuedQueries.push(query);
        } else {
            this.mMemoryCalendar.getItems(aItemFilter, aCount, aRangeStart,
                                          aRangeEnd, aListener);
        }
    },

    safeRefresh: function caldav_safeRefresh() {

        if (!this.mCtag || !this.mFirstRefreshDone) {
            var refreshEvent = this.prepRefresh();
            this.getUpdatedItems(refreshEvent);
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
        var httpchannel = calPrepHttpChannel(this.mCalendarUri,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};

        streamListener.onStreamComplete =
            function checkDavResourceType_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
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

            var ctag = multistatus..CS::getctag;
            if (!ctag || ctag != thisCalendar.mCtag) {
                // ctag mismatch, need to fetch calendar-data
                thisCalendar.mCtag = ctag;
                var refreshEvent = thisCalendar.prepRefresh();
                thisCalendar.getUpdatedItems(refreshEvent);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: ctag mismatch on refresh, fetching data for calendar "
                        + thisCalendar.name);
                }
            } else {
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: ctag matches, no need to fetch data for calendar "
                        + thisCalendar.name);
                }
                // we may still need to refesh other cals in this authrealm
                if (thisCalendar.mAuthScheme == "Digest" &&
                    thisCalendar.firstInRealm()) {
                    thisCalendar.refreshOtherCals();
                }
            }
        };
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    refresh: function caldav_refresh() {
        if (this.mAuthScheme != "Digest") {
            // Basic HTTP Auth will not have timed out, we can just refresh
            // Same for Cosmo ticket-based authentication
            this.safeRefresh();
        } else {
            // Digest auth may have timed out, and we need to make sure that
            // several calendars in this realm do not attempt re-auth simultaneously
            if (this.firstInRealm()) {
                this.safeRefresh();
            }
        }
    },

    firstInRealm: function caldav_firstInRealm() {
        var calendars = getCalendarManager().getCalendars({});
        for (var i = 0; i < calendars.length ; i++) {
            if (calendars[i].type != "caldav") {
                continue;
            }
            if (calendars[i].uri.prePath == this.uri.prePath &&
                calendars[i].QueryInterface(calICalDavCalendar)
                            .authRealm == this.mAuthRealm) {
                if (calendars[i].id == this.id) {
                    return true;
                }
                break;
            }
        }
        return false;
    },

    refreshOtherCals: function caldav_refreshOtherCals() {
        var calendars = getCalendarManager().getCalendars({});
        for (var i = 0; i < calendars.length ; i++) {
            if (calendars[i].type == "caldav" &&
                calendars[i].uri.prePath == this.uri.prePath &&
                calendars[i].QueryInterface(calICalDavCalendar)
                            .authRealm == this.mAuthRealm &&
                calendars[i].id != this.id) {
                calendars[i].safeRefresh();
            }
        }
    },

    prepRefresh: function caldav_safeRefresh() {

        var itemTypes = new Array("VEVENT", "VTODO");
        var typesCount = itemTypes.length;
        var refreshEvent = {};
        refreshEvent.itemTypes = itemTypes;
        refreshEvent.typesCount = typesCount;
        refreshEvent.queryStatuses = [];
        refreshEvent.itemsNeedFetching = [];
        refreshEvent.itemsReported = [];

        return refreshEvent;

    },

    getUpdatedItems: function caldav_GUIs(aRefreshEvent) {

        if (this.mDisabled) {
            // check if maybe our calendar has become available
            this.checkDavResourceType();
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

        var responseStatus;

        etagListener.onStreamComplete =
            function getUpdatedItems_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " on getetag for calendar " + thisCalendar.name);
                responseStatus = aContext.responseStatus;
            } catch (ex) {
                LOG("CalDAV: Error without status on getetag for calendar " +
                    thisCalendar.name);
                responseStatus = "none";
            }
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

                if (thisCalendar.mHrefIndex[resourcePath]) {
                    var itemuid = thisCalendar.mHrefIndex[resourcePath];
                    if (etag != thisCalendar.mItemInfoCache[itemuid].etag) {
                        // we don't have a current copy in cache; fetch the item
                        aRefreshEvent.itemsNeedFetching.push(resourcePath);
                    }
                } else {
                    aRefreshEvent.itemsNeedFetching.push(resourcePath);
                }

            }

            aRefreshEvent.queryStatuses.push(responseStatus);
            var needsRefresh = false;
            if (aRefreshEvent.queryStatuses.length == aRefreshEvent.typesCount) {

                var badFetch = false;
                for each (var statusCode in aRefreshEvent.queryStatuses) {
                    if (statusCode != 207) {
                        LOG("CalDAV: error fetching item etags: " + statusCode);
                        badFetch = true;
                    }
                }
                if (badFetch) {
                    thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_REPORT_ERROR,
                                                "disabledMode");
                    return;
                }
                // if an item has been deleted from the server, delete it here too
                for (var path in  thisCalendar.mHrefIndex) {
                    if (aRefreshEvent.itemsReported.indexOf(path) < 0) {

                        var getItemListener = {};
                        getItemListener.onGetResult = function caldav_gUIs_oGR(aCalendar,
                            aStatus, aItemType, aDetail, aCount, aItems) {
                            var itemToDelete = aItems[0];
                            delete thisCalendar.mItemInfoCache[itemToDelete.id];
                            thisCalendar.mMemoryCalendar.deleteItem(itemToDelete,
                                                                     getItemListener);
                            delete thisCalendar.mHrefIndex[path];
                            needsRefresh = true;
                        }
                        getItemListener.onOperationComplete = function
                            caldav_gUIs_oOC(aCalendar, aStatus, aOperationType,
                                            aId, aDetail) {}
                        thisCalendar.mMemoryCalendar.getItem(thisCalendar.mHrefIndex[path],
                                                             getItemListener);
                    }
                }

                // avoid sending empty multiget requests
                // update views if something has been deleted server-side
                if (!aRefreshEvent.itemsNeedFetching.length) {
                    if (needsRefresh) {
                        thisCalendar.mObservers.notify("onLoad", [thisCalendar]);
                    }
                    return;
                }

                while (aRefreshEvent.itemsNeedFetching.length > 0) {
                    var locpath = aRefreshEvent.itemsNeedFetching.pop().toString();
                    var hrefXml = new XML();
                    hrefXml = <hr xmlns:D={D}/>
                    hrefXml.D::href = locpath;
                    multigetQueryXml[0].appendChild(hrefXml.D::href);
                }

                var multigetQueryString = xmlHeader +
                                          multigetQueryXml.toXMLString();
                thisCalendar.getCalendarData(multigetQueryString, null, null);

                if (thisCalendar.mAuthScheme == "Digest" &&
                    thisCalendar.firstInRealm()) {
                    thisCalendar.refreshOtherCals();
                }

            } else {
                thisCalendar.getUpdatedItems(aRefreshEvent);
            }
        };

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryString);
        }

        // construct the resource we want to search against
        var calendarDirUri = this.mCalendarUri.clone();
        calendarDirUri.spec = this.makeUri('');
        var httpchannel = calPrepHttpChannel(calendarDirUri,
                                             queryString,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.requestMethod = "REPORT";
        httpchannel.setRequestHeader("Depth", "1", false);
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, etagListener);
    },

    getCalendarData: function caldav_gCD(aQuery, aItem, aListener) {

        var thisCalendar = this;
        var caldataListener = {};
        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");

        caldataListener.onStreamComplete =
            function getCalendarData_oSC(aLoader, aContext, aStatus,
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
                return;
            }
            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to parse getCalendarData REPORT");
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }
            if (str.substr(0,6) == "<?xml ") {
                str = str.substring(str.indexOf('<', 2));
            }

            var multistatus = new XML(str);
            for (var j = 0; j < multistatus.*.length(); j++) {
                var response = new XML(multistatus.*[j]);
                var elementStatus = response..D::["status"].split(" ")[1];

                if (elementStatus != 200) {
                    LOG("CalDAV: got element status " + elementStatus + " while fetching calendar data");
                    continue;
                }
                var etag = response..D::["getetag"];
                var href = response..D::["href"];
                var resourcePath = thisCalendar.ensurePath(href);
                var calData = response..C::["calendar-data"];

                var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                                       .createInstance(Components.interfaces.calIIcsParser);
                parser.parseString(calData, null);
                // with CalDAV there really should only be one item here
                var items = parser.getItems({});

                var item = items[0];
                if (!item) {
                    if (aListener) {
                        this.notifyOperationComplete(aListener,
                                                     Components.results.NS_ERROR_FAILURE,
                                                     Components.interfaces.calIOperationListener.GET,
                                                     null,
                                                     "failed to retrieve item");
                    }
                    return;
                }
                item.calendar = thisCalendar.superCalendar;
                var locationPath = decodeURIComponent(resourcePath).substr(thisCalendar.mLocationPath.length);
                if (!thisCalendar.mItemInfoCache[item.id]) {
                       thisCalendar.mItemInfoCache[item.id] = {};
                       thisCalendar.mItemInfoCache[item.id].isNew = true;
                } else {
                    thisCalendar.mItemInfoCache[item.id].isNew = false;
                }
                thisCalendar.mItemInfoCache[item.id].locationPath = locationPath;

                var hrefPath = thisCalendar.ensurePath(href);
                thisCalendar.mHrefIndex[hrefPath] = item.id;
                thisCalendar.mItemInfoCache[item.id].etag = etag;

                if (thisCalendar.mItemInfoCache[item.id].isNew) {
                    thisCalendar.mMemoryCalendar.adoptItem(item, aListener);
                } else {
                    thisCalendar.mMemoryCalendar.modifyItem(item, null,
                                                            aListener);
                }
            }
            LOG("refresh completed with status " + responseStatus);
            thisCalendar.mObservers.notify("onLoad", [thisCalendar]);
            thisCalendar.mFirstRefreshDone = true;
            while (thisCalendar.mQueuedQueries.length) {
                var query = thisCalendar.mQueuedQueries.pop();
                thisCalendar.mMemoryCalendar.getItems
                            .apply(thisCalendar.mMemoryCalendar, query);
            }
        };

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + aQuery);
        }
        // construct the resource we want to search against
        var calendarDirUri = this.mCalendarUri.clone();
        calendarDirUri.spec = this.makeUri('');
        var httpchannel = calPrepHttpChannel(calendarDirUri,
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
     * Checks that the calendar URI exists and is a CalDAV calendar
     *
     */
    checkDavResourceType: function checkDavResourceType() {

        var resourceTypeXml = null;
        var resourceType = kDavResourceTypeNone;
        var thisCalendar = this;

        var D = new Namespace("D", "DAV:");
        var CS = new Namespace("CS", "http://calendarserver.org/ns/");
        var queryXml = <D:propfind xmlns:D="DAV:" xmlns:CS={CS}>
                        <D:prop>
                            <D:resourcetype/>
                            <CS:getctag/>
                        </D:prop>
                        </D:propfind>;
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }
        var httpchannel = calPrepHttpChannel(this.mCalendarUri,
                                             queryXml,
                                             "text/xml; charset=utf-8",
                                             this);
        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};

        streamListener.onStreamComplete =
            function checkDavResourceType_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
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

            if (this.mUriParams) {
                thisCalendar.mAuthScheme = "Ticket";
            }
            LOG("CalDAV: Authentication scheme " + thisCalendar.mAuthScheme);
            // we only really need the authrealm for Digest auth
            // since only Digest is going to time out on us
            if (thisCalendar.mAuthScheme == "Digest") {
                var realmChop = wwwauth.split("realm=\"")[1];
                thisCalendar.mAuthRealm = realmChop.split("\", ")[0];
                LOG("  realm " + thisCalendar.mAuthRealm);
            }

            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to determine resource type");
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }

            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            try {
                var multistatus = new XML(str);
            } catch (ex) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_NOT_DAV,
                                            "dav_notDav");
                return;
            }

            // check for server-side ctag support
            var ctag = multistatus..CS::["getctag"];
            if (ctag && ctag.toString().length) {
                thisCalendar.mCtag = ctag;
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: initial ctag " + ctag + " for calendar " + thisCalendar.name);
                }
            }

            var resourceTypeXml = multistatus..D::["resourcetype"];
            if (resourceTypeXml.length == 0) {
                resourceType = kDavResourceTypeNone;
            } else if (resourceTypeXml.toString().indexOf("calendar") != -1) {
                resourceType = kDavResourceTypeCalendar;
            } else if (resourceTypeXml.toString().indexOf("collection") != -1) {
                resourceType = kDavResourceTypeCollection;
            }

            if ((resourceType == null || resourceType == kDavResourceTypeNone) &&
                !thisCalendar.mDisabled) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_NOT_DAV,
                                            "dav_notDav");
                return;
            }

            if ((resourceType == kDavResourceTypeCollection) &&
                !thisCalendar.mDisabled) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_DAV_NOT_CALDAV,
                                            "dav_davNotCaldav");
                return;
            }

            // if this calendar was previously offline we want to recover
            if ((resourceType == kDavResourceTypeCalendar) &&
                thisCalendar.mDisabled) {
                thisCalendar.mDisabled = false;
                thisCalendar.mReadOnly = false;
            }

            thisCalendar.setCalHomeSet();
            thisCalendar.checkServerCaps();
        };
        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    reportDavError: function caldav_rDE(aErrNo, aMessage, modificationError) {
        this.mReadOnly = true;
        this.mDisabled = true;
        this.notifyError(aErrNo,
                         calGetString("calendar", aMessage, [this.mUri.spec]));
        this.notifyError(modificationError
                         ? Components.interfaces.calIErrors.MODIFICATION_FAILED
                         : Components.interfaces.calIErrors.READ_FAILED,
                         "");
    },

    /**
     * Checks server capabilities
     * currently just calendar-schedule
     *
     */
    checkServerCaps: function caldav_checkServerCaps() {

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
            var dav;
            try {
                var dav = aContext.getResponseHeader("DAV");
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: DAV header: " + dav);
                }
            } catch (ex) {
                LOG("CalDAV: Error getting DAV header, status " + aContext.responseStatus);
            }


            if (dav.indexOf("calendar-schedule") != -1) {
                thisCalendar.mHaveScheduling = true;
                // XXX - we really shouldn't register with the fb service
                // if another calendar with the same principal-URL has already
                // done so
                getFreeBusyService().addProvider(thisCalendar);
                thisCalendar.findPrincipalNS();
            } else {
                LOG("CalDAV: Server does not support CalDAV scheduling.");
                thisCalendar.refresh();
            }
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * Locates the principal namespace
     */
    findPrincipalNS: function caldav_findPrincipalNS() {

        var homeSet = this.mCalHomeSet.clone();
        var thisCalendar = this;

        var D = new Namespace("D", "DAV:");
        var queryXml = <D:propfind xmlns:D="DAV:">
                    <D:prop>
                      <D:principal-collection-set/>
                    </D:prop>
                  </D:propfind>

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
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
            }

            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to propstat principal namespace");
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

            thisCalendar.checkPrincipalsNameSpace(nsList);
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * Checks the principals namespace for scheduling info
     *
     * @param aNameSpaceList    List of available namespaces
     */
    checkPrincipalsNameSpace: function caldav_cPNS(aNameSpaceList) {

        var thisCalendar = this;

        var homePath = this.mCalHomeSet.path;
        if (homePath.charAt(homePath.length-1) == '/') {
            homePath = homePath.substr(0, homePath.length-1);
        }

        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");
        default xml namespace = C;

        var queryXml = <D:principal-property-search xmlns:D="DAV:"
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

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }

        if (!aNameSpaceList.length) {
            this.mHaveScheduling = false;
            this.mInBoxUrl = null;
            this.mOutBoxUrl = null;
        }

        var pns = aNameSpaceList.pop();

        var nsUrl = this.mCalendarUri.clone();
        nsUrl.path = pns;

        var nsUri = makeURL(nsUrl.spec);
        if (nsUrl.spec.charAt(nsUrl.spec.length-1) == "/") {
            nsUrl.spec = nsUrl.spec.substr(0, nsUrl.spec.length -1);
        }

        var httpchannel = calPrepHttpChannel(nsUri, queryXml,
                                             "text/xml; charset=utf-8",
                                             this);

        httpchannel.requestMethod = "REPORT";

        var streamListener = {};

        streamListener.onStreamComplete =
            function caldav_cPNS_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            if (aContext.responseStatus != 207) {
                LOG("CalDAV: Bad response to in/outbox query, status " +
                    aContext.responseStatus);
                thisCalendar.mHaveScheduling = false;
                thisCalendar.mInBoxUrl = null;
                thisCalendar.mOutBoxUrl = null;
                thisCalendar.refresh();
                return;
            }
            var str = convertByteArray(aResult, aResultLength);
            if (!str) {
                LOG("CalDAV: Failed to report principals namespace");
            } else if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }
            thisCalendar.mMailToUrl = thisCalendar.mCalendarUri.spec;

            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            var multistatus = new XML(str);

            for (var i = 0; i < multistatus.*.length(); i++) {
                var response = new XML(multistatus.*[i]);

                var responseCHS = response..C::["calendar-home-set"]..D::href[0];
                if (!responseCHS) {
                    responseCHS = response..D::["calendar-home-set"]..D::href[0];
                }

                try {
                    if (responseCHS.charAt(responseCHS.toString().length -1) != "/") {
                        responseCHS += "/";
                    }
                } catch (ex) {}

                if (responseCHS  != thisCalendar.mCalHomeSet.path &&
                    responseCHS != thisCalendar.mCalHomeSet.spec) {
                    continue;
                }
                var addrHrefs =
                    response..C::["calendar-user-address-set"]..D::href;
                if (!addrHrefs.toString().length) {
                    var addrHrefs =
                        response..D::propstat..D::["calendar-user-address-set"]..D::href;
                }
                for (var j = 0; j < addrHrefs.*.length(); j++) {
                    if (addrHrefs[j].substr(0,7).toLowerCase() == "mailto:") {
                        thisCalendar.mMailToUrl = addrHrefs[j];
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
                var obUrl = thisCalendar.mUri.clone();
                var obPath =
                    response..C::["schedule-outbox-URL"]..D::href[0];
                if (!obPath) {
                    var obPath = response..D::["schedule-outbox-URL"]..D::href[0];
                }
                obUrl.path = thisCalendar.ensurePath(obPath);
                thisCalendar.mOutBoxUrl = obUrl;
            }

            if (!thisCalendar.mMailToUrl || !thisCalendar.mInBoxUrl || !thisCalendar.mOutBoxUrl) {
                if (aNameSpaceList.length) {
                    thisCalendar.checkPrincipalsNameSpace(aNameSpaceList);
                } else {
                    thisCalendar.mHaveScheduling = false;
                    thisCalendar.refresh();
                }
            } else {
                thisCalendar.refresh();
            }
        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    //
    // calIFreeBusyProvider interface
    //

    getFreeBusyIntervals: function caldav_getFreeBusyIntervals(
        aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {

        if (!this.mHaveScheduling || !this.mOutBoxUrl || !this.mMailToUrl) {
            LOG("CalDAV: Server does not support scheduling; freebusy query not possible");
            return;
        }

        if (!this.firstInRealm()) {
            // don't spam every known outbox with freebusy queries
            return;
        }

        // the caller prepends MAILTO: to calid strings containing @
        // but apple needs that to be mailto:
        var aCalIdParts = aCalId.split(":");
        aCalIdParts[0] = aCalIdParts[0].toLowerCase();

        if (aCalIdParts[0] != "mailto"
            && aCalIdParts[0] != "http"
            && aCalIdParts[0] != "https" ) {
            return;
        }
        mailto_aCalId = aCalIdParts.join(":");

        var outBoxUri = this.mOutBoxUrl.clone();
        var thisCalendar = this;

        var organizer = this.mMailToUrl;

        var dtstamp = now().getInTimezone(UTC()).icalString;
        var dtstart = aRangeStart.getInTimezone(UTC()).icalString;
        var dtend = aRangeEnd.getInTimezone(UTC()).icalString;
        var uuid = getUUID();

        var fbQuery = "BEGIN:VCALENDAR\n";
        fbQuery += "VERSION:" + calGetProductVersion() + "\n";
        fbQuery += "PRODID:-" + calGetProductId() + "\n";
        fbQuery += "METHOD:REQUEST\n";
        fbQuery += "BEGIN:VFREEBUSY\n";
        fbQuery += "DTSTAMP:" + dtstamp + "\n";
        fbQuery += "ORGANIZER:" + organizer + "\n";
        fbQuery += "DTSTART:" + dtstart + "\n";
        fbQuery += "DTEND:" + dtend + "\n";
        fbQuery += "UID:" + uuid + "\n";
        var attendee = "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;CN=" + mailto_aCalId + "\n";
        var attendeeFolded = this.foldLine(attendee);
        fbQuery += attendeeFolded;
        fbQuery += "END:VFREEBUSY\n";
        fbQuery += "END:VCALENDAR\n";
        // RFC 2445 is specific about how lines end...
        fbQuery = fbQuery.replace(/\n/g, "\r\n");
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + fbQuery);
        }

        var httpchannel = calPrepHttpChannel(outBoxUri,
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
                var CalPeriod = new Components.
                                    Constructor("@mozilla.org/calendar/period;1",
                                               "calIPeriod");
                var CalDateTime = new Components.
                                      Constructor("@mozilla.org/calendar/datetime;1",
                                                "calIDateTime");
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
                str = str.replace(/\n\ /g, "");
                str = str.replace(/\r/g, "");

                var response = new XML(str);
                var status = response..C::response..C::["request-status"];
                if (status.substr(0,1) != 2) {
                    LOG("CalDAV: Got status " + status + " in response to freebusy query");
                    return;
                }
                if (status.substr(0,3) != "2.0") {
                    LOG("CalDAV: Got status " + status + " in response to freebusy query");
                }
                var interval;
                var caldata = response..C::response..C::["calendar-data"];
                var lines = caldata.split("\n");
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].substr(0,8) == "FREEBUSY") {
                        var descDat = lines[i].split(":");
                        var fbName = descDat[0].split("=")[1];
                        var fbType = fbTypeMap[fbName];
                        var ranges = descDat[1].split(",");
                        for (var j = 0; j < ranges.length; j++) {
                            var parts = ranges[j].split("/");
                            var begin = new CalDateTime();
                            begin.icalString = parts[0];
                            var end = new CalDateTime();
                            end.icalString = parts[1];
                            interval = new calFreeBusyInterval(aCalId,
                                                               fbType,
                                                               begin,
                                                               end);
                            periodsToReturn.push(interval);
                        }
                    }
                    if (lines[i].substr(0,7) == "DTSTART") {
                        var dts = lines[i].split(":")[1];
                        var replyRangeStart = new CalDateTime();
                        replyRangeStart.icalString = dts;
                        if (aRangeStart.compare(replyRangeStart) == -1) {
                            interval = new calFreeBusyInterval(aCalId,
                                                               calIFreeBusyInterval.UNKNOWN,
                                                               aRangeStart,
                                                               replyRangeStart);
                            periodsToReturn.push(interval);
                        }
                    }
                    if (lines[i].substr(0,5) == "DTEND") {
                        var dte = lines[i].split(":")[1];
                        var replyRangeEnd = new CalDateTime();
                        replyRangeEnd.icalString = dte;
                        if (aRangeEnd.compare(replyRangeEnd) == 1) {
                            interval = new calFreeBusyInterval(aCalId,
                                                               calIFreeBusyInterval.UNKNOWN,
                                                               replyRangeEnd,
                                                               aRangeEnd);
                            periodsToReturn.push(interval);
                        }
                    }
                }
                aListener.onResult(null, periodsToReturn);
            } else {
                LOG("CalDAV: Received status " + aContext.responseStatus + " from freebusy query");
            }

        };

        var streamLoader = createStreamLoader();
        calSendHttpRequest(streamLoader, httpchannel, streamListener);
    },

    /**
     * RFC 2445 line folding
     */
    foldLine: function caldav_foldLine(aString) {
        var parts = [];
        while (aString.length) {
            var part = aString.substr(0,72);
            parts.push(part);
            aString = aString.substr(72);
        }
        return parts.join("\n ");
    },

    ensurePath: function caldav_ensurePath(aString) {
        if (aString.charAt(0) != "/") {
            var bogusUri = makeURL(aString);
            return bogusUri.path;
        }
        return aString;
    },

     verboseLogging: function caldav_verboseLogging() {
         return getPrefSafe("calendar.debug.log.verbose", false);
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
    onChannelRedirect: function(aOldChannel, aNewChannel, aFlags) {
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
