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
}

// some shorthand
const nsIWebDAVOperationListener =
    Components.interfaces.nsIWebDAVOperationListener;
const calICalendar = Components.interfaces.calICalendar;
const nsISupportsCString = Components.interfaces.nsISupportsCString;
const calIErrors = Components.interfaces.calIErrors;
const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;
const calICalDavCalendar = Components.interfaces.calICalDavCalendar;
const calIDateTime = Components.interfaces.calIDateTime;

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo);
var isOnBranch = appInfo.platformVersion.indexOf("1.8") == 0;


function getLocationPath(item) {

    var locPath = this.mItemInfoCache[item.id].locationPath;
    if (locPath) {
        LOG("CalDAV: using locationPath: " + locPath);
    } else {
        locPath = item.id;
        if (locPath) {
            locPath += ".ics";
        }
        LOG("CalDAV: using locationPath: " + locPath);
    }
    return locPath;
}

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

    // XXX todo: in general we want to do CalDAV scheduling, but for servers
    //           that don't support it, we want Itip
    // sendItipInvitations is now used from calProviderBase.

    promptOverwrite: function caldavPO(aMethod, aItem, aListener, aOldItem) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                            getService(Components.interfaces.nsIPromptService);

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
     * prepare channel with standard request headers
     * and upload data/content-type if needed
     *
     * @param arUri         channel Uri
     * @param aUploadData   data to be uploaded, if any
     * @param aContentType  value for Content-Type header, if any
     */

    prepChannel: function caldavPC(aUri, aUploadData, aContentType) {
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
        var channel = ioService.newChannelFromURI(aUri);

        var httpchannel = channel.QueryInterface(Components.interfaces
                                                           .nsIHttpChannel);

        httpchannel.setRequestHeader("Accept", "text/xml", false);
        httpchannel.setRequestHeader("Accept-Charset", "utf-8,*;q=0.1", false);
        httpchannel.notificationCallbacks = this;

        if (aUploadData) {
            httpchannel = httpchannel.QueryInterface(Components.interfaces.
                                                     nsIUploadChannel);
            var converter =
                Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                          .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
            converter.charset = "UTF-8";
            var stream = converter.convertToInputStream(aUploadData);
            httpchannel.setUploadStream(stream, aContentType, -1);
        }
        return httpchannel;
    },

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

        var locationPath = aItem.id + ".ics";
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
            } catch(ex) {
                status = Components.interfaces.calIErrors.DAV_PUT_ERROR;
            }
            if (thisCalendar.verboseLogging()) {
                try {
                    var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                                    .createInstance(Components
                                                    .interfaces.nsIScriptableUnicodeConverter);
                    resultConverter.charset = "UTF-8";
                    var str;
                    str = resultConverter.convertFromByteArray(aResult, aResultLength);
                    LOG("CalDAV: recv: " + str);
                } catch(ex) {
                    LOG("CalDAV: empty or unparseable response on add");
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
        }

        aItem.calendar = this.superCalendar;
        aItem.generation = 1;

        var httpchannel = this.prepChannel(itemUri, this.getSerializedItem(aItem),
                                           "text/calendar; charset=utf-8");


        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-None-Match", "*", false);
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, addListener, httpchannel);
        } else {
            streamLoader.init(addListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }

        return;
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

        if (aNewItem.parentItem != aNewItem) {
            var excItem = aNewItem;
            aNewItem = aNewItem.parentItem.clone();
            aNewItem.recurrenceInfo.modifyException(excItem, false);
        }

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
            } catch(ex) {
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
            return;
        }

        var httpchannel = this.prepChannel(eventUri, modifiedItemICS,
                                           "text/calendar; charset=utf-8");

        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aNewItem.id].etag,
                                         false);
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, modListener, httpchannel);
        } else {
            streamLoader.init(modListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }

        return;
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
            } catch(ex) {
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
            }
            else if (status == 412) {
                // item has either been modified or deleted by someone else
                // check to see which

                var httpchannel2 = thisCalendar.prepChannel(eventUri, null, null);
                httpchannel2.requestMethod = "HEAD";
                var streamLoader2 = Components.classes
                                    ["@mozilla.org/network/stream-loader;1"]
                                    .createInstance(Components.interfaces
                                    .nsIStreamLoader);
                if (isOnBranch) {
                    streamLoader2.init(httpchannel2, delListener2, httpchannel2);
                } else {
                    streamLoader2.init(streamListener2);
                    httpchannel2.asyncOpen(streamLoader2, httpchannel2);
                }

            } else {
                LOG("CalDAV: Unexpected status deleting item: " + status);
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_REMOVE_ERROR,
                                            "itemDeleteError", true);
                retVal = Components.results.NS_ERROR_FAILURE;
            }
        }
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
        }

        var httpchannel = this.prepChannel(eventUri, null, null);
        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aItem.id].etag,
                                         false);
        }
        httpchannel.requestMethod = "DELETE";

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, delListener, httpchannel);
        } else {
            streamLoader.init(delListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }

        return;
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

        var itemType = "VEVENT";
        if (aItem instanceof Components.interfaces.calITodo) {
            itemType = "VTODO";
        }

        var queryStatuses = new Array();

        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");
        default xml namespace = C;

        queryXml =
          <calendar-query xmlns:D="DAV:">
            <D:prop>
              <D:getetag/>
              <calendar-data/>
            </D:prop>
            <filter>
              <comp-filter name="VCALENDAR">
                <comp-filter name={itemType}>
                  <prop-filter name="UID">
                    <text-match collation="i;octet">
                      {aItem.id}
                    </text-match>
                  </prop-filter>
                </comp-filter>
              </comp-filter>
            </filter>
          </calendar-query>;

        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }

        this.reportInternal(xmlHeader + queryXml.toXMLString(), aItem, aListener);
        return;

    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function (aId, aListener) {
        this.mMemoryCalendar.getItem(aId, aListener);
        return;
    },

    reportInternal: function caldavRI(aQuery, aItem, aListener)
    {
        var reportListener = new WebDavListener();
        var thisCalendar = this; // need to access from inside the callback

        reportListener.onOperationDetail = function(aStatusCode, aResource,
                                                    aOperation, aDetail,
                                                    aClosure) {
            var rv;
            var errString;

            // is this detail the entire search result, rather than a single
            // detail within a set?
            //
            if (aResource.path == calendarDirUri.path) {
                // XXX is this even valid?  what should we do here?
                // XXX if it's an error, it might be valid?
                LOG("XXX report result for calendar, not event\n");
                throw("XXX report result for calendar, not event\n");
            }

            var items = null;

            // XXX need to do better than looking for just 200
            if (aStatusCode == 200) {

                // aDetail is the response element from the multi-status
                // XXX try-catch
                var xSerializer = Components.classes
                    ['@mozilla.org/xmlextras/xmlserializer;1']
                    .getService(Components.interfaces.nsIDOMSerializer);
                // libical needs to see \r\n instead on \n\n in the case of "folded" lines
                var response = xSerializer.serializeToString(aDetail).replace(/\n\n/g, "\r\n");
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: recv: " + response);
                }
                var responseElement = new XML(response);

                // create calIItemBase from e4x object
                // XXX error-check that we only have one result, etc
                var C = new Namespace("urn:ietf:params:xml:ns:caldav");
                var D = new Namespace("DAV:");

                var etag = responseElement..D::["getetag"];

                // cause returned data to be parsed into the item
                var calData = responseElement..C::["calendar-data"];
                if (!calData.toString().length) {
                  Components.utils.reportError(
                    "Empty or non-existent <calendar-data> element returned" +
                    " by CalDAV server for URI <" + aResource.spec +
                    ">; ignoring");
                  return;
                }
                // LOG("item result = \n" + calData);
                var rootComp = getIcsService().parseICS(calData, null);

                var calComp;
                if (rootComp.componentType == 'VCALENDAR') {
                    calComp = rootComp;
                } else {
                    calComp = rootComp.getFirstSubcomponent('VCALENDAR');
                }

                var unexpandedItems = [];
                var uid2parent = {};
                var excItems = [];

                while (calComp) {
                    // Get unknown properties
                    var prop = calComp.getFirstProperty("ANY");
                    while (prop) {
                        thisCalendar.unmappedProperties.push(prop);
                        prop = calComp.getNextProperty("ANY");
                    }

                    var subComp = calComp.getFirstSubcomponent("ANY");
                    while (subComp) {
                        // Place each subcomp in a try block, to hopefully get as
                        // much of a bad calendar as possible
                        try {
                            var item = null;
                            switch (subComp.componentType) {
                            case "VEVENT":
                                item = Components.classes["@mozilla.org/calendar/event;1"].
                                       createInstance(Components.interfaces.calIEvent);
                                break;
                            case "VTODO":
                                item = Components.classes["@mozilla.org/calendar/todo;1"].
                                       createInstance(Components.interfaces.calITodo);
                                break;
                            case "VTIMEZONE":
                                // we should already have this, so there's no need to
                                // do anything with it here.
                                break;
                            default:
                                thisCalendar.unmappedComponents.push(subComp);
                                break;
                            }
                            if (item != null) {

                                item.icalComponent = subComp;
                                // save the location name in case we need to modify
                                // need to build using thisCalendar since aResource.spec
                                // won't contain any auth info embedded in the URI
                                var locationPath = decodeURIComponent(aResource.path)
                                                   .substr(thisCalendar.mLocationPath.length);
                                if (!thisCalendar.mItemInfoCache[item.id]) {
                                    thisCalendar.mItemInfoCache[item.id] = {};
                                    thisCalendar.mItemInfoCache[item.id].isNew = true;
                                } else {
                                    thisCalendar.mItemInfoCache[item.id].isNew = false;
                                }
                                thisCalendar.mItemInfoCache[item.id].locationPath =
                                    locationPath;
                                thisCalendar.mHrefIndex[aResource.path] = item.id;
                                var rid = item.recurrenceId;
                                if (rid == null) {
                                    unexpandedItems.push( item );
                                    if (item.recurrenceInfo != null) {
                                        uid2parent[item.id] = item;
                                    }
                                } else {
                                    item.calendar = thisCalendar.superCalendar;
                                    // force no recurrence info so we can
                                    // rebuild it cleanly below
                                    item.recurrenceInfo = null;
                                    excItems.push(item);
                                }
                            }
                        } catch (ex) {
                            thisCalendar.notifyError(ex.result, ex.toString());
                        }
                        subComp = calComp.getNextSubcomponent("ANY");
                    }
                    calComp = rootComp.getNextSubcomponent('VCALENDAR');
                }

                // tag "exceptions", i.e. items with rid:
                for each (var item in excItems) {
                    var parent = uid2parent[item.id];
                    if (parent == null) {
                        LOG("CalDAV: no parent item for rid=" + item.recurrenceId);
                    } else {
                        item.parentItem = parent;
                        item.parentItem.recurrenceInfo.modifyException(item, true);
                    }
                }
                // if we loop over both excItems and unexpandedItems using 'item'
                // we can be confident that 'item' means something below
                for each (var item in unexpandedItems) {
                    item.calendar = thisCalendar.superCalendar;
                }

                thisCalendar.mItemInfoCache[item.id].etag = etag;

                // figure out what type of item to return
                var iid;
                if (item instanceof Components.interfaces.calIEvent) {
                    iid = Components.interfaces.calIEvent;
                    rv = Components.results.NS_OK;
                    items = [ item ];
                } else if (item instanceof Components.interfaces.calITodo) {
                    iid = Components.interfaces.calITodo;
                    rv = Components.results.NS_OK;
                    items = [ item ];
                } else {
                    errString = "Can't deduce item type based on query";
                    rv = Components.results.NS_ERROR_FAILURE;
                }

            } else {
                 LOG("CalDAV: aStatusCode = " + aStatusCode + " on item retrieval");
                 errString = "Error retrieving item";
                rv = Components.results.NS_ERROR_FAILURE;
            }

            for (var i = 0; i < items.length; i++) {
                if (thisCalendar.mItemInfoCache[items[i].id].isNew) {
                    thisCalendar.mMemoryCalendar.adoptItem(items[i], aListener);
                } else {
                    thisCalendar.mMemoryCalendar.modifyItem(items[i], null,
                                                            aListener);
                }
            }
            return;
        };

        reportListener.onOperationComplete = function(aStatusCode, aResource,
                                                      aOperation, aClosure) {
            LOG("CalDAV: refresh completed with status " + aStatusCode);
            thisCalendar.mObservers.notify("onLoad", [thisCalendar]);
            thisCalendar.mFirstRefreshDone = true;
            while (thisCalendar.mQueuedQueries.length) {
                var query = thisCalendar.mQueuedQueries.pop();
                thisCalendar.mMemoryCalendar.getItems(query[0], query[1],
                                                       query[2], query[3],
                                                       query[4]);
            }
        };

        // convert this into a form the WebDAV service can use
        var xParser = Components.classes['@mozilla.org/xmlextras/domparser;1']
                      .getService(Components.interfaces.nsIDOMParser);
        queryDoc = xParser.parseFromString(aQuery, "application/xml");
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + aQuery);
        }

        // construct the resource we want to search against
        var calendarDirUri = this.mCalendarUri.clone();
        calendarDirUri.spec = this.makeUri('');
        // LOG("report uri = " + calendarDirUri.spec);
        var calendarDirResource = new WebDavResource(calendarDirUri);

        var webSvc = Components.classes['@mozilla.org/webdav/service;1']
            .getService(Components.interfaces.nsIWebDAVService);
        webSvc.report(calendarDirResource, queryDoc, true, reportListener,
                      this, null);
        return;

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

    safeRefresh: function caldav_safeRefresh() {

        var itemTypes = new Array("VEVENT", "VTODO");
        var typesCount = itemTypes.length;
        var refreshEvent = {};
        refreshEvent.itemTypes = itemTypes;
        refreshEvent.typesCount = typesCount;
        refreshEvent.queryStatuses = [];
        refreshEvent.itemsNeedFetching = [];
        refreshEvent.itemsReported = [];

        this.getUpdatedItems(refreshEvent);

    },


    getUpdatedItems: function caldav_GUIs(aRefreshEvent) {

        if (this.mDisabled) {
            // check if maybe our calendar has become available
            this.checkDavResourceType();
            return;
        }

        if (aRefreshEvent.itemTypes.length) {
            var itemType = aRefreshEvent.itemTypes.pop();
        } else {
            return;
        }

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
          <calendar-multiget xmlns:D={D}>
            <D:prop>
              <D:getetag/>
              <calendar-data/>
            </D:prop>
          </calendar-multiget>;

        var etagListener = new WebDavListener();
        var thisCalendar = this;

        etagListener.onOperationDetail = function(aStatusCode, aResource,
                                                    aOperation, aDetail,
                                                    aClosure) {
            if (aStatusCode != 200) {
                LOG("CalDAV: Unexpected item status " + aStatusCode + " while fetching etags");
            }
            
            var xSerializer = Components.classes
                ['@mozilla.org/xmlextras/xmlserializer;1']
                .getService(Components.interfaces.nsIDOMSerializer);
            // libical needs to see \r\n instead on \n\n in the case of
            // "folded" lines
            var response = xSerializer.serializeToString(aDetail).
                                       replace(/\n\n/g, "\r\n");
            if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + response);
            }
            var responseElement = new XML(response);

            var etag = responseElement..D::["getetag"];

            aRefreshEvent.itemsReported.push(aResource.path);

            if (thisCalendar.mHrefIndex[aResource.path]) {
                var itemuid = thisCalendar.mHrefIndex[aResource.path];
                if (etag != thisCalendar.mItemInfoCache[itemuid].etag) {
                    // we don't have a current copy in cache; fetch the item
                    aRefreshEvent.itemsNeedFetching.push(aResource.path);
                }
            } else {
                aRefreshEvent.itemsNeedFetching.push(aResource.path);
            }
        }

        etagListener.onOperationComplete = function(aStatusCode, aResource,
                                                    aOperation, aClosure) {
            aRefreshEvent.queryStatuses.push(aStatusCode);
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
                    var locpath = aRefreshEvent.itemsNeedFetching.pop();
                    var hrefXml = new XML();
                    hrefXml = <hr xmlns:D={D}/>
                    hrefXml.D::href = locpath;
                    multigetQueryXml[0].appendChild(hrefXml.D::href);
                }

                var multigetQueryString = xmlHeader +
                                          multigetQueryXml.toXMLString();
                thisCalendar.reportInternal(multigetQueryString, null, null);

                if (thisCalendar.mAuthScheme == "Digest" &&
                    thisCalendar.firstInRealm()) {
                    thisCalendar.refreshOtherCals();
                }

            } else {
                thisCalendar.getUpdatedItems(aRefreshEvent);
            }
        }
        var xParser = Components.classes['@mozilla.org/xmlextras/domparser;1']
                      .getService(Components.interfaces.nsIDOMParser);
        queryDoc = xParser.parseFromString(queryString, "application/xml");
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryString);
        }

        // construct the resource we want to search against
        var calendarDirUri = this.mCalendarUri.clone();
        calendarDirUri.spec = this.makeUri('');
        var calendarDirResource = new WebDavResource(calendarDirUri);

        var webSvc = Components.classes['@mozilla.org/webdav/service;1']
            .getService(Components.interfaces.nsIWebDAVService);
        webSvc.report(calendarDirResource, queryDoc, true, etagListener,
                      this, null);
        return;
    },

    // nsIInterfaceRequestor impl
    getInterface: function(iid) {
        if (iid.equals(Components.interfaces.nsIAuthPrompt)) {
            return new calAuthPrompt();
        }
        else if (iid.equals(Components.interfaces.nsIPrompt)) {
            // use the window watcher service to get a nsIPrompt impl
            return Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Components.interfaces.nsIWindowWatcher)
                             .getNewPrompter(null);
        } else if (iid.equals(Components.interfaces.nsIProgressEventSink)) {
            return this;
        // Needed for Lightning on branch vvv
        } else if (iid.equals(Components.interfaces.nsIDocShellTreeItem)) {
            return this;
        } else if (iid.equals(Components.interfaces.nsIAuthPromptProvider)) {
            return Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Components.interfaces.nsIWindowWatcher)
                             .getNewPrompter(null);
        } else if (!isOnBranch && iid.equals(Components.interfaces.nsIAuthPrompt2)) {
            return new calAuthPrompt();
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
    },

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
        var queryXml = <D:propfind xmlns:D="DAV:">
                        <D:prop>
                            <D:resourcetype/>
                        </D:prop>
                        </D:propfind>;
        if (this.verboseLogging()) {
            LOG("CalDAV: send: " + queryXml);
        }
        var httpchannel = this.prepChannel(this.mUri,queryXml,
                                           "text/xml; charset=utf-8");
        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};

        streamListener.onStreamComplete =
            function checkDavResourceType_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                             .createInstance(Components
                                             .interfaces.nsIScriptableUnicodeConverter);

            try {
                LOG("CalDAV: Status " + aContext.responseStatus +
                    " on initial PROPFIND for calendar " + thisCalendar.name);
            } catch(ex) {
                LOG("CalDAV: Error without status on initial PROPFIND for calendar " +
                    thisCalendar.name);
            }
            var wwwauth;
            try {
                wwwauth = aContext.getRequestHeader("Authorization");
                thisCalendar.mAuthScheme = wwwauth.split(" ")[0];
            } catch(ex) {
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

            resultConverter.charset = "UTF-8";
            var str;
            try {
                str = resultConverter.convertFromByteArray(aResult, aResultLength);
            } catch(e) {
                LOG("CalDAV: Failed to determine resource type");
            }
            if (thisCalendar.verboseLogging()) {
                LOG("CalDAV: recv: " + str);
            }
            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            try {
                var multistatus = new XML(str);
            } catch(ex) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_NOT_DAV,
                                            "dav_notDav");
                return;
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
        }
        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }
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

        var httpchannel = this.prepChannel(homeSet, null, null);

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
            } catch(ex) {
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
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }

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
        var httpchannel = this.prepChannel(homeSet, queryXml,
                                           "text/xml; charset=utf-8");

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
            
            var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                             .createInstance(Components
                                             .interfaces.nsIScriptableUnicodeConverter);

            resultConverter.charset = "UTF-8";
            var str;
            try {
                str = resultConverter.convertFromByteArray(aResult, aResultLength);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: recv: " + str);
                }
            } catch(e) {
                LOG("CalDAV: Failed to propstat principal namespace");
            }

            if (str.substr(0,6) == "<?xml ") {
                    str = str.substring(str.indexOf('<', 2));
            }
            var multistatus = new XML(str);
            var pnsUri = thisCalendar.mUri.clone();
            var pcs = multistatus..D::["principal-collection-set"]..D::href;
            if (pcs.charAt(pcs.length-1) != '/') {
                pcs += "/";
            }

            pnsUri.path = thisCalendar.ensurePath(pcs);
            thisCalendar.mPrincipalsNS = pnsUri;
            thisCalendar.checkPrincipalsNameSpace();
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }
    },

    /**
     * Checks the principals namespace for scheduling info
     */
    checkPrincipalsNameSpace: function caldav_cPNS() {

        var pns = this.mPrincipalsNS.clone();
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
        var httpchannel = this.prepChannel(pns, queryXml,
                                           "text/xml; charset=utf-8");

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
                return;
            }
            var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                             .createInstance(Components
                                             .interfaces.nsIScriptableUnicodeConverter);

            resultConverter.charset = "UTF-8";
            var str;
            try {
                str = resultConverter.convertFromByteArray(aResult, aResultLength);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: recv: " + str);
                }
            } catch(e) {
                LOG("CalDAV: Failed to report principals namespace");
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
                } catch(ex) {}

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
                thisCalendar.mHaveScheduling = false;
            }
            thisCalendar.refresh();
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }
        return;
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

        var httpchannel = this.prepChannel(outBoxUri, fbQuery,
                                           "text/calendar; charset=utf-8");
        httpchannel.requestMethod = "POST";
        httpchannel.setRequestHeader("Originator", organizer, false);
        httpchannel.setRequestHeader("Recipient", mailto_aCalId, false);

        var streamListener = {};

        streamListener.onStreamComplete =
            function caldav_GFBI_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                             .createInstance(Components
                                             .interfaces.nsIScriptableUnicodeConverter);

            resultConverter.charset = "UTF-8";
            var str;
            try {
                str = resultConverter.convertFromByteArray(aResult, aResultLength);
                if (thisCalendar.verboseLogging()) {
                    LOG("CalDAV: recv: " + str);
                }
            } catch(e) {
                LOG("CalDAV: Failed to parse freebusy response");
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
                var period;
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
                            period = new CalPeriod();
                            period.start = begin;
                            period.end = end;
                            period.makeImmutable();
                            interval =
                                thisCalendar.createInterval(aCalId, period,
                                                            fbType);
                            periodsToReturn.push(interval);
                        }
                    }
                    if (lines[i].substr(0,7) == "DTSTART") {
                        var dts = lines[i].split(":")[1];
                        var replyRangeStart = new CalDateTime();
                        replyRangeStart.icalString = dts;
                        if (aRangeStart.compare(replyRangeStart) == -1) {
                            period = new CalPeriod();
                            period.start = aRangeStart;
                            period.end = replyRangeStart;
                            period.makeImmutable();
                            interval =
                                thisCalendar.createInterval(aCalId, period,
                                                            calIFreeBusyInterval.UNKNOWN);
                            periodsToReturn.push(interval);
                        }
                    }
                    if (lines[i].substr(0,5) == "DTEND") {
                        var dte = lines[i].split(":")[1];
                        var replyRangeEnd = new CalDateTime();
                        replyRangeEnd.icalString = dte;
                        if (aRangeEnd.compare(replyRangeEnd) == 1) {
                            period = new CalPeriod();
                            period.start = replyRangeEnd;
                            period.end = aRangeEnd;
                            period.makeImmutable();
                            interval =
                                thisCalendar.createInterval(aCalId, period,
                                                            calIFreeBusyInterval.UNKNOWN);
                            periodsToReturn.push(interval);
                        }
                    }
                }
                aListener.onResult(null, periodsToReturn);
            } else {
                LOG("CalDAV: Received status " + aContext.responseStatus + " from freebusy query");
            }

        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            httpchannel.asyncOpen(streamLoader, httpchannel);
        }
    },


    createInterval: function caldav_createInterval(aCalId, aPeriod, aFbType) {
        var interval = {
            QueryInterface: function fbInterval_QueryInterface(iid) {
                return doQueryInterface(this, null, iid, [calIFreeBusyInterval]);
            },
            calId: aCalId,
            interval: aPeriod,
            freeBusyType: aFbType
        };
        return interval;
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
         var prefB = Components.classes["@mozilla.org/preferences-service;1"].
                 getService(Components.interfaces.nsIPrefBranch);
         var verboseLog = false;
         try {
             verboseLog = prefB.getBoolPref("calendar.debug.log.verbose");
         } catch(ex) {}
         return verboseLog;
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

    // stubs to keep callbacks we don't support yet from throwing errors
    // we don't care about
    // nsIProgressEventSink
    onProgress: function onProgress(aRequest, aContext, aProgress, aProgressMax) {},
    onStatus: function onStatus(aRequest, aContext, aStatus, aStatusArg) {},
    // nsIDocShellTreeItem
    findItemWithName: function findItemWithName(name, aRequestor, aOriginalRequestor) {}
};

function WebDavResource(url) {
    this.mResourceURL = url;
}

WebDavResource.prototype = {
    mResourceURL: {},
    get resourceURL() {
        return this.mResourceURL;}  ,
    QueryInterface: function(iid) {
        if (iid.equals(CI.nsIWebDAVResource) ||
            iid.equals(CI.nsISupports)) {
            return this;
        }

        throw Components.interfaces.NS_ERROR_NO_INTERFACE;
    }
};

function WebDavListener() {
}

WebDavListener.prototype = {

    QueryInterface: function (aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(nsIWebDavOperationListener)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    onOperationComplete: function(aStatusCode, aResource, aOperation,
                                  aClosure) {
        // aClosure is the listener
        aClosure.onOperationComplete(this, aStatusCode, 0, null, null);

        LOG("WebDavListener.onOperationComplete() called");
        return;
    },

    onOperationDetail: function(aStatusCode, aResource, aOperation, aDetail,
                                aClosure) {
        LOG("WebDavListener.onOperationDetail() called");
        return;
    }
}

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

var g_fbService = null;
function getFreeBusyService() {
    if (!g_fbService) {
        g_fbService =
            Components.classes["@mozilla.org/calendar/freebusy-service;1"]
                      .getService(Components.interfaces.calIFreeBusyService);
    }
    return g_fbService;
};
