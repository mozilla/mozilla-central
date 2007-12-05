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

// XXXdmose deal with generation goop

// XXXdmose deal with locking

// XXXdmose need to make and use better error reporting interface for webdav
// (all uses of aStatusCode, probably)

// XXXdmose use real calendar result codes, not NS_ERROR_FAILURE for everything

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';

function calDavCalendar() {
    this.initProviderBase();
    this.unmappedProperties = [];
    this.mPendingStartupRequests = [];
    this.mUriParams = null;
    this.mItemInfoCache = [];
    this.mDisabled = false;
    this.mCalHomeSet = null;
    this.mPrincipalsNS = null;
    this.mInBoxUrl = null;
    this.mOutBoxUrl = null;
    this.mHaveScheduling = false;
    this.mMailToUrl = null;
}

// some shorthand
const nsIWebDAVOperationListener =
    Components.interfaces.nsIWebDAVOperationListener;
const calICalendar = Components.interfaces.calICalendar;
const nsISupportsCString = Components.interfaces.nsISupportsCString;
const calIErrors = Components.interfaces.calIErrors;
const calIFreeBusyInterval = Components.interfaces.calIFreeBusyInterval;
const calIDateTime = Components.interfaces.calIDateTime;

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo);
var isOnBranch = appInfo.platformVersion.indexOf("1.8") == 0;


function getLocationPath(item) {

    var locPath = this.mItemInfoCache[item.id].locationPath;
    if (locPath) {
        LOG("using locationPath: " + locPath);
    } else {
        locPath = item.id;
        if (locPath) {
            locPath += ".ics";
        }
        LOG("using locationPath: " + locPath);
    }
    return locPath;
}

// END_OF_TIME needs to be the max value a PRTime can be
const START_OF_TIME = -0x7fffffffffffffff;
const END_OF_TIME = 0x7fffffffffffffff;

// used by mAuthenticationStatus
const kCaldavNoAuthentication = 0;
const kCaldavFirstRequestSent = 1;      // Queueing subsequent requests
const kCaldavFreshlyAuthenticated = 2;  // Need to process queue
const kCaldavAuthenticated = 3;         // Queue being processed or empty

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
                                 Components.interfaces.calIFreeBusyProvider]);
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

    // attribute PRUInt8 mAuthenticationStatus;
    mAuthenticationStatus: 0,

    mPendingStartupRequests: null,

    get canRefresh() {
        return true;
    },

    // mUriParams stores trailing ?parameters from the
    // supplied calendar URI. Needed for (at least) Cosmo
    // tickets
    mUriParams: null,

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

    // we need to be able to locate the calendar-home-set of the calendar
    // in order to get certain properties, but there currently is no reliable
    // way to do this programatically that works with different server
    // implementations. So provisionally we assume the 99% case, where the
    // calendar's calendar-home-set is the immediate parent of the calendar itself

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

    refresh: function caldav_refresh() {
        // clear item info cache
        this.mItemInfoCache = [];
        this.mObservers.notify("onLoad", [this]);
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
            if (aListener)
                aListener.onOperationComplete (this.superCalendar,
                                               Components.results.NS_ERROR_FAILURE,
                                               aListener.ADD,
                                               aItem.id,
                                               "Can't set ID on non-mutable item to addItem");
            return;
        }

        var locationPath = aItem.id + ".ics";
        var itemUri = this.mCalendarUri.clone();
        itemUri.spec = this.makeUri(locationPath);
        LOG("itemUri.spec = " + itemUri.spec);

        var addListener = {};
        var thisCalendar = this;
        addListener.onStreamComplete =
            function onPutComplete(aLoader, aContext, aStatus, aResultLength,
                                   aResult) {
            var status = aContext.responseStatus;
            // 201 = HTTP "Created"
            //
            if (status == 201) {
                LOG("Item added successfully");

                var retVal = Components.results.NS_OK;
                // Some CalDAV servers will modify items on PUT (add X-props,
                // change location, etc) so we'd best re-fetch in order to know
                // the current state of the item
                // Observers will be notified in getUpdatedItem()
                thisCalendar.getUpdatedItem(aItem, aListener);

            } else if (status == 200) {
                LOG("CalDAV: 200 received from server: server malfunction");
                retVal = Components.results.NS_ERROR_FAILURE;
            } else if (status == 412) {
                LOG("CalDAV: etag exists on adopt item: server malfunction");
                retVal = Components.results.NS_ERROR_FAILURE;
            } else {
                if (status > 999) {
                    status = "0x" + aStatusCode.toString(16);
                }

                // XXX real error handling
                LOG("Error adding item: " + status);
                retVal = Components.results.NS_ERROR_FAILURE;
            }

            // notify the listener
            if (aListener) {
                try {
                    aListener.onOperationComplete(thisCalendar.superCalendar,
                                                  retVal,
                                                  aListener.ADD,
                                                  aItem.id,
                                                  aItem);
                } catch (ex) {
                    LOG("addItem's onOperationComplete threw an exception "
                          + ex + "; ignoring");
                }
            }
            // notify observers
            if (Components.isSuccessCode(retVal)) {
                thisCalendar.mObservers.notify("onAddItem", [aItem]);
            }
        }

        aItem.calendar = this.superCalendar;
        aItem.generation = 1;
        aItem.makeImmutable();

        // LOG("icalString = " + aItem.icalString);

        var httpchannel = this.prepChannel(itemUri, aItem.icalString,
                                           "text/calendar, charset=utf-8");


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
            channel.asyncOpen(streamLoader, httpchannel);
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

            // XXXYYY fix to match iface spec
            // this is definitely an error
            if (aListener) {
                try {
                    aListener.onOperationComplete(this.superCalendar,
                                                  Components.results.NS_ERROR_FAILURE,
                                                  aListener.MODIFY,
                                                  aItem.id,
                                                  "ID for modifyItem doesn't exist or is null");
                } catch (ex) {
                    LOG("modifyItem's onOperationComplete threw an"
                          + " exception " + ex + "; ignoring");
                }
            }

            return;
        }

        if (aNewItem.parentItem != aNewItem) {
            aNewItem.parentItem.recurrenceInfo.modifyException(aNewItem);
            aNewItem = aNewItem.parentItem;
        }

        var eventUri = this.mCalendarUri.clone();
        eventUri.spec = this.makeUri(this.mItemInfoCache[aNewItem.id].locationPath);

        // It seems redundant to use generation when we have etags
        // but until the idl is changed we do it.
        if (aOldItem.parentItem.generation != aNewItem.generation) {
            if (aListener) {
                aListener.onOperationComplete(this.superCalendar,
                                              Components.results.NS_ERROR_FAILURE,
                                              aListener.MODIFY,
                                              aNewItem.id,
                                              "generation mismatch in modifyItem");
            }
            return;
        }

        aNewItem.generation += 1;

        var modListener = {};
        var thisCalendar = this;

        const icssvc = Components.classes["@mozilla.org/calendar/ics-service;1"].
                       getService(Components.interfaces.calIICSService);
        var modifiedItem = icssvc.createIcalComponent("VCALENDAR");
        calSetProdidVersion(modifiedItem);
        modifiedItem.addSubcomponent(aNewItem.icalComponent);
        if (aNewItem.recurrenceInfo) {
            var exceptions = aNewItem.recurrenceInfo.getExceptionIds({});
            for each (var exc in exceptions) {
                modifiedItem.addSubcomponent(aNewItem.recurrenceInfo.getExceptionFor(exc, true).icalComponent);
            }
        }
        var modifiedItemICS = modifiedItem.serializeToICS();

        modListener.onStreamComplete = function(aLoader, aContext, aStatus,
                                             aResultLength, aResult) {
            // 201 = HTTP "Created"
            // 204 = HTTP "No Content"
            //
            var status = aContext.responseStatus;
            if (status == 204 || status == 201) {
                LOG("Item modified successfully.");
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
                LOG("Error modifying item: " + status);

                // XXX deal with non-existent item here, other
                // real error handling

                // XXX aStatusCode will be 201 Created for a PUT on an item
                // that didn't exist before.

                retVal = Components.results.NS_ERROR_FAILURE;
            }

            // XXX ensure immutable version returned
            // notify listener
            if (aListener) {
                try {
                    aListener.onOperationComplete(thisCalendar.superCalendar,
                                                  retVal,
                                                  aListener.MODIFY,
                                                  aNewItem.id,
                                                  aNewItem);
                } catch (ex) {
                    LOG("modifyItem's onOperationComplete threw an"
                          + " exception " + ex + "; ignoring");
                }
            }

            // notify observers
            if (Components.isSuccessCode(retVal)) {
                thisCalendar.mObservers.notify("onModifyItem",
                                               [aNewItem, aOldItem.parentItem]);
            }

            return;
        }

        // XXX use etag as generation

        var httpchannel = this.prepChannel(eventUri, modifiedItemICS,
                                           "text/calendar; charset=utf-8");

        if (!aIgnoreEtag) {
            httpchannel.setRequestHeader("If-Match",
                                         this.mItemInfoCache[aNewItem.id].etag,
                                         false);
        }

        LOG("modifyItem: PUTting = " + modifiedItemICS);
        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, modListener, httpchannel);
        } else {
            streamLoader.init(modListener);
            channel.asyncOpen(streamLoader, httpchannel);
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
            if (aListener)
                aListener.onOperationComplete (this.superCalendar,
                                               Components.results.NS_ERROR_FAILURE,
                                               aListener.DELETE,
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

            var status = aContext.responseStatus;
            // 204 = HTTP "No content"
            //
            if (status == 204) {
                delete thisCalendar.mItemInfoCache[aItem.id];
                LOG("Item deleted successfully.");
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
                    channel.asyncOpen(streamLoader2, httpchannel2);
                }

            } else {
                LOG("Error deleting item: " + status);
                // XXX real error handling here
                retVal = Components.results.NS_ERROR_FAILURE;
            }

            // notify the listener
            if (aListener) {
                try {
                    aListener.onOperationComplete(thisCalendar.superCalendar,
                                                  Components.results.NS_OK,
                                                  aListener.DELETE,
                                                  aItem.id,
                                                  null);
                } catch (ex) {
                    LOG("deleteItem's onOperationComplete threw an"
                          + " exception " + ex + "; ignoring");
                }
            }

            // notify observers
            if (Components.isSuccessCode(retVal)) {
                thisCalendar.mObservers.notify("onDeleteItem", [aItem]);
            }
        }
        var delListener2 = {};
        delListener2.onStreamComplete =
        function caldavDL2oSC(aLoader, aContext, aStatus, aResultLength, aResult) {
            var status2 = aContext.responseStatus;
            if (status2 == 404) {
                // someone else already deleted it
                thisCalendar.mObservers.notify("onDeleteItem", [aItem]);
                return;
            } else {
                thisCalendar.promptOverwrite(CALDAV_DELETE_ITEM, aItem,
                                             realListener, null);
            }
        }

        // XXX check generation
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
            channel.asyncOpen(streamLoader, httpchannel);
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
        if (!aListener) {
            return;
        }

        if (aItem == null) {
            aListener.onOperationComplete(this.superCalendar,
                                          Components.results.NS_ERROR_FAILURE,
                                          aListener.GET,
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

        this.reportInternal(xmlHeader + queryXml.toXMLString(),
                            false, null, null, 1, aListener, aItem, 1,
                            queryStatuses);
        return;

    },

    // void getItem( in string id, in calIOperationListener aListener );
    getItem: function (aId, aListener) {

        if (!aListener)
            return;

        if (aId == null) {
            aListener.onOperationComplete(this.superCalendar,
                                          Components.results.NS_ERROR_FAILURE,
                                          aListener.GET,
                                          null,
                                          "passed in empty iid");
            return;
        }


        // this is our basic search-by-uid xml
        // XXX get rid of vevent filter?
        // XXX need a prefix in the namespace decl?
        default xml namespace = "urn:ietf:params:xml:ns:caldav";
        var D = new Namespace("D", "DAV:");
        queryXml =
          <calendar-query xmlns:D="DAV:">
            <D:prop>
              <calendar-data/>
            </D:prop>
            <filter>
              <comp-filter name="VCALENDAR">
                <comp-filter name="VEVENT">
                  <prop-filter name="UID">
                    <text-match caseless="no">
                      {aId}
                    </text-match>
                  </prop-filter>
                </comp-filter>
              </comp-filter>
            </filter>
          </calendar-query>;

        this.reportInternal(xmlHeader + queryXml.toXMLString(),
                            false, null, null, 1, aListener);
        return;
    },

    reportInternal: function caldavRI(aQuery, aOccurrences, aRangeStart,
                                      aRangeEnd, aCount, aListener, aItem,
                                      aQueryCount, aQueryStatuses)
    {
        var reportListener = new WebDavListener();
        var count = 0;  // maximum number of hits to return
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

                // we've already called back the maximum number of hits, so
                // we're done here.
                //
                if (aCount && count >= aCount) {
                    return;
                }
                ++count;

                // aDetail is the response element from the multi-status
                // XXX try-catch
                var xSerializer = Components.classes
                    ['@mozilla.org/xmlextras/xmlserializer;1']
                    .getService(Components.interfaces.nsIDOMSerializer);
                // libical needs to see \r\n instead on \n\n in the case of "folded" lines
                var response = xSerializer.serializeToString(aDetail).replace(/\n\n/g, "\r\n");
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
                if (!thisCalendar.mICSService) {
                    thisCalendar.mICSService = Components.classes["@mozilla.org/calendar/ics-service;1"].
                                               getService(Components.interfaces.calIICSService);
                }
                var rootComp = thisCalendar.mICSService.parseICS(calData, null);

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
                                }
                                thisCalendar.mItemInfoCache[item.id].locationPath =
                                    locationPath;

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
                            thisCalendar.mObservers.notify("onError", [ex.result, ex.toString()]);
                        }
                        subComp = calComp.getNextSubcomponent("ANY");
                    }
                    calComp = rootComp.getNextSubcomponent('VCALENDAR');
                }

                // tag "exceptions", i.e. items with rid:
                for each (var item in excItems) {
                    var parent = uid2parent[item.id];
                    if (parent == null) {
                        LOG( "no parent item for rid=" + item.recurrenceId );
                    } else {
                        item.parentItem = parent;
                        item.parentItem.recurrenceInfo.modifyException(item);
                    }
                }
                // if we loop over both excItems and unexpandedItems using 'item'
                // we can be confident that 'item' means something below
                for each (var item in unexpandedItems) {
                    item.calendar = thisCalendar.superCalendar;
                }

                thisCalendar.mItemInfoCache[item.id].etag = etag;
                if (aItem) {
                    // if aItem is not null, we were called from
                    // getUpdatedItem(), and the view isn't listening to any
                    // changes. So in order to have the updated item displayed
                    // we need to modify the item currently displayed with
                    // the one just fetched
                    thisCalendar.mObservers.notify("onModifyItem",
                                                   [item, aItem.parentItem]);
                }

                // figure out what type of item to return
                var iid;
                if(aOccurrences) {
                    iid = Components.interfaces.calIItemBase;
                    if (item.recurrenceInfo) {
                        LOG("ITEM has recurrence: " + item + " (" + item.title + ")");
                        LOG("rangestart: " + aRangeStart.jsDate + " -> " + aRangeEnd.jsDate);
                        // XXX does getOcc call makeImmutable?
                        items = item.recurrenceInfo.getOccurrences(aRangeStart,
                                                                   aRangeEnd,
                                                                   0, {});
                    } else {
                        // XXX need to make occurrences immutable?
                        items = [ item ];
                    }
                    rv = Components.results.NS_OK;
                } else if (item instanceof Components.interfaces.calIEvent) {
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
                // XXX
                LOG("aStatusCode = " + aStatusCode);
                errString = "XXX";
                rv = Components.results.NS_ERROR_FAILURE;
            }

            // XXX  handle aCount
            if (errString) {
                LOG("errString = " + errString);
            }

            try {
                aListener.onGetResult(thisCalendar.superCalendar,
                                      rv,
                                      iid,
                                      null,
                                      items ? items.length : 0,
                                      errString ? errString : items);
            } catch (ex) {
                    LOG("reportInternal's onGetResult threw an"
                          + " exception " + ex + "; ignoring");
            }

            // We have a result, so we must be authenticated
            if (thisCalendar.mAuthenticationStatus == kCaldavFirstRequestSent) {
                thisCalendar.mAuthenticationStatus = kCaldavFreshlyAuthenticated;
            }

            if (thisCalendar.mAuthenticationStatus == kCaldavFreshlyAuthenticated) {
                thisCalendar.mAuthenticationStatus = kCaldavAuthenticated;
                while (thisCalendar.mPendingStartupRequests.length > 0) {
                    thisCalendar.popStartupRequest();
                }
            }
            return;
        };

        reportListener.onOperationComplete = function(aStatusCode, aResource,
                                                      aOperation, aClosure) {
            aQueryStatuses.push(aStatusCode);
            if (aQueryStatuses.length == aQueryCount) {
                var rv = Components.results.NS_OK;
                var errString;

                for each (statusCode in aQueryStatuses) {
                    if (statusCode != 200) { // XXX better error checking
                        rv = Components.results.NS_ERROR_FAILURE;
                        errString = "XXX something bad happened";
                    }
                }

                // call back the listener
                try {
                    if (aListener) {
                    aListener.onOperationComplete(thisCalendar.superCalendar,
                                                  Components.results.
                                                  rv, aListener.GET, null,
                                                  errString);
                    }
                } catch (ex) {
                    LOG("reportInternal's onOperationComplete threw an"
                        + " exception " + ex + "; ignoring");
                }

                return;
            } else {
                // there's still a query pending, so it's too early to
                // call the listener back
            }
        };

        // convert this into a form the WebDAV service can use
        var xParser = Components.classes['@mozilla.org/xmlextras/domparser;1']
                      .getService(Components.interfaces.nsIDOMParser);
        queryDoc = xParser.parseFromString(aQuery, "application/xml");

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
    getItems: function (aItemFilter, aCount, aRangeStart, aRangeEnd, aListener)
    {
        if (!aListener) {
            return;
        }

        if (this.mDisabled) {
            var errString = "calendar " + this.name + " is disabled";
            aListener.onOperationComplete(this.superCalendar,
                                          Components.results.NS_ERROR_FAILURE,
                                          aListener.GET, null, errString);
            while (this.mPendingStartupRequests.length > 0) {
                this.popStartupRequest();
            }
            // check if maybe our calendar has become available
            this.checkDavResourceType();
            return;
        }

        if (this.mAuthenticationStatus == kCaldavNoAuthentication) {
           this.mAuthenticationStatus = kCaldavFirstRequestSent;
           this.checkDavResourceType();
        }

        if (this.mAuthenticationStatus == kCaldavFirstRequestSent) {
            var req = new Array(aItemFilter, aCount, aRangeStart, aRangeEnd, aListener);
            this.mPendingStartupRequests.push(req);
            return;
        }

        // this is our basic report xml
        var C = new Namespace("C", "urn:ietf:params:xml:ns:caldav");
        var D = new Namespace("D", "DAV:");
        default xml namespace = C;

        var queryXml =
          <calendar-query xmlns:D={D}>
            <D:prop>
              <D:getetag/>
              <calendar-data/>
            </D:prop>
            <filter>
              <comp-filter name="VCALENDAR">
                <comp-filter/>
              </comp-filter>
            </filter>
          </calendar-query>;

        var compFilterNames = new Array();
        compFilterNames[calICalendar.ITEM_FILTER_TYPE_TODO] = "VTODO";
        // omit VJOURNAL for now since we don't support it and not all
        // CalDAV servers can handle requests for it
        // compFilterNames[calICalendar.ITEM_FILTER_TYPE_JOURNAL] = "VJOURNAL";
        compFilterNames[calICalendar.ITEM_FILTER_TYPE_EVENT] = "VEVENT";

        var queryFilters = [];
        for (var i in compFilterNames) {
            if (aItemFilter & i) {
                queryFilters.push(compFilterNames[i]);
            }
        }

        if (queryFilters.length < 1) {
            LOG("No item types specified");
            // XXX should we just quietly call back the completion method?
            throw NS_ERROR_FAILURE;
        }

        var queryCount = queryFilters.length;
        var queryStatuses = new Array();

        // if a time range has been specified, do the appropriate restriction.
        // XXX express "end of time" in caldav by leaving off "start", "end"
        var hasRange = false;
        if (aRangeStart && aRangeStart.isValid &&
            aRangeEnd && aRangeEnd.isValid) {

            var hasRange = true;
            var queryRangeStart = aRangeStart.clone();
            var queryRangeEnd = aRangeEnd.clone();
            queryRangeStart.isDate = false;
            if (queryRangeEnd.isDate) {
                // add a day to rangeEnd since we want to match events all that day
                // and isDate=false is converting the date to midnight
                queryRangeEnd.day++;
                queryRangeEnd.isDate = false;
            }
            var rangeXml = <time-range start={queryRangeStart.getInTimezone(UTC()).icalString}
                                       end={queryRangeEnd.getInTimezone(UTC()).icalString}/>;

        }

        for (var queryFilter in queryFilters) {

            var typeQueryXml = queryXml;

            typeQueryXml[0].C::filter.C::["comp-filter"]
                           .C::["comp-filter"] =
                           <comp-filter name={queryFilters[queryFilter]}/>;
            //see http://tools.ietf.org/html/rfc4791#section-7.8.9
            if(queryFilters[queryFilter] == "VTODO" ){
                if((aItemFilter &  calICalendar.ITEM_FILTER_COMPLETED_YES) != 1 ) {
                    var filter_todo =
                        <prop-filter name="COMPLETED">
                            <is-not-defined/>
                        </prop-filter>;
                    // append the prop-filter as a child of our innermost comp-filter
                    typeQueryXml[0].C::filter.C::["comp-filter"]
                        .C::["comp-filter"].appendChild(filter_todo);
                }
             }

            // append the time-range as a child of our innermost comp-filter
            if (hasRange) {
                typeQueryXml[0].C::filter.C::["comp-filter"]
                               .C::["comp-filter"].appendChild(rangeXml);
            }

            var queryString = xmlHeader + typeQueryXml.toXMLString();
            // LOG("getItems(): querying CalDAV server:\n" + queryString);

            var occurrences = (aItemFilter &
                              calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0;
            this.reportInternal(queryString, occurrences, aRangeStart,
                                aRangeEnd, aCount, aListener, null, queryCount,
                                queryStatuses);
        }

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

    // Unless an error number is in this array, we consider it very bad, set
    // the calendar to readOnly, and give up.
    acceptableErrorNums: [],

    onError: function caldav_onError(aErrNo, aMessage) {
        var errorIsOk = false;
        for each (num in this.acceptableErrorNums) {
            if (num == aErrNo) {
                errorIsOk = true;
                break;
            }
        }
        if (!errorIsOk) {
            this.mReadOnly = true;
            this.mDisabled = true;
        }

        var paramBlock = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                                   .createInstance(Components.interfaces
                                   .nsIDialogParamBlock);
        paramBlock.SetNumberStrings(3);

        var promptMessage = calGetString("calendar", "disabledMode", [this.name]);
        paramBlock.SetString(0, promptMessage);
        var errCode = "0x"+aErrNo.toString(16);
        paramBlock.SetString(1, errCode);
        paramBlock.SetString(2, aMessage);
        var wWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                 .getService(Components.interfaces.nsIWindowWatcher);
        wWatcher.openWindow(null,
                            "chrome://calendar/content/calErrorPrompt.xul",
                            "_blank",
                            "chrome,dialog=yes",
                            paramBlock);

        if (this.mDisabled && this.mPendingStartupRequests.length > 0) {
            this.popStartupRequest();
        }
    },

    popStartupRequest: function popStartupRequest() {
        var req = this.mPendingStartupRequests.pop();
        this.getItems(req[0], req[1], req[2], req[3], req[4]);
    },

    /**
     * Checks that the calendar URI exists and is a CalDAV calendar
     *
     */
    checkDavResourceType: function checkDavResourceType() {
        var listener = new WebDavListener();
        var resourceTypeXml = null;
        var resourceType = kDavResourceTypeNone;
        var thisCalendar = this;
        listener.onOperationComplete =
            function checkDavResourceType_oOC(aStatusCode, aResource,
                                              aOperation, aClosure) {

            if ((resourceType == null || resourceType == kDavResourceTypeNone) &&
                !thisCalendar.mDisabled) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_NOT_DAV,
                                            "dav_notDav");
            }

            if ((resourceType == kDavResourceTypeCollection) &&
                !thisCalendar.mDisabled) {
                thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_DAV_NOT_CALDAV,
                                            "dav_davNotCaldav");
            }

            // if this calendar was previously offline we want to recover
            if ((resourceType == kDavResourceTypeCalendar) &&
                thisCalendar.mDisabled) {
                thisCalendar.mDisabled = false;
                thisCalendar.mReadOnly = false;
            }

            // we've authenticated in the process of PROPFINDing and can flush
            // the getItems request queue
            thisCalendar.mAuthenticationStatus = kCaldavFreshlyAuthenticated;
            thisCalendar.setCalHomeSet();
            thisCalendar.checkServerCaps();

        }

        listener.onOperationDetail =
            function checkDavResourceType_oOD(aStatusCode, aResource,
                                              aOperation, aDetail, aClosure) {

            var prop = aDetail.QueryInterface(Components.interfaces.nsIProperties);

            try {
                resourceTypeXml = prop.get("DAV: resourcetype",
                                           Components.interfaces.nsISupportsString).toString();
            } catch (ex) {
                LOG("error " + e + " fetching resource type");
            }

            if (resourceTypeXml.length == 0) {
                resourceType = kDavResourceTypeNone;
            } else if (resourceTypeXml.indexOf("calendar") != -1) {
                resourceType = kDavResourceTypeCalendar;
            } else if (resourceTypeXml.indexOf("collection") != -1) {
                resourceType = kDavResourceTypeCollection;
            }
        }

        var calendarDirUri = this.mCalendarUri.clone();
        calendarDirUri.spec = this.makeUri('');
        var res = new WebDavResource(calendarDirUri);
        var webSvc = Components.classes['@mozilla.org/webdav/service;1'].
                     getService(Components.interfaces.nsIWebDAVService);
        try {
            webSvc.getResourceProperties(res, 1, ["DAV: resourcetype"], false,
                                          listener, this, null);
        } catch (ex) {
            thisCalendar.reportDavError(Components.interfaces.calIErrors.DAV_NO_PROPS,
                                        "dav_noProps");
        }
    },

    reportDavError: function caldav_rDE(aErrNo, aMessage) {
        this.onError(aErrNo, calGetString("calendar", aMessage, [this.mUri.spec]));
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

        var streamListener = {};

        streamListener.onStreamComplete =
            function checkServerCaps_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var dav = aContext.getResponseHeader("DAV");

            if (dav.indexOf("calendar-schedule") != -1) {
                thisCalendar.mHaveScheduling = true;
                // XXX - we really shouldn't register with the fb service
                // if another calendar with the same principal-URL has already
                // done so
                getFreeBusyService().addProvider(thisCalendar);
                thisCalendar.findPrincipalNS();
            } else {
                LOG("Server does not support CalDAV scheduling.");
                if (thisCalendar.mAuthenticationStatus == kCaldavFreshlyAuthenticated
                    && thisCalendar.mPendingStartupRequests.length > 0) {
                    thisCalendar.popStartupRequest();
                }
            }
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            channel.asyncOpen(streamLoader, httpchannel);
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

        var httpchannel = this.prepChannel(homeSet, queryXml,
                                           "text/xml; charset=utf-8");

        httpchannel.setRequestHeader("Depth", "0", false);
        httpchannel.requestMethod = "PROPFIND";

        var streamListener = {};

        streamListener.onStreamComplete =
            function findInOutBoxes_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            var resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                             .createInstance(Components
                                             .interfaces.nsIScriptableUnicodeConverter);

            resultConverter.charset = "UTF-8";
            var str;
            try {
                str = resultConverter.convertFromByteArray(aResult, aResultLength);
            } catch(e) {
                LOG("Failed to propstat principal namespace");
            }
            str = str.substring(str.indexOf('\n'));
            var multistatus = new XML(str);
            var pnsUri = thisCalendar.mUri.clone();
            pnsUri.path = multistatus..D::["principal-collection-set"]..D::href;
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
            channel.asyncOpen(streamLoader, httpchannel);
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

        var httpchannel = this.prepChannel(pns, queryXml,
                                           "text/xml; charset=utf-8");

        httpchannel.requestMethod = "REPORT";

        var streamListener = {};

        streamListener.onStreamComplete =
            function caldav_cPNS_oSC(aLoader, aContext, aStatus,
                                         aResultLength, aResult) {
            if (aContext.responseStatus != 207) {
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
            } catch(e) {
                LOG("Failed to report principals namespace");
            }
            thisCalendar.mMailToUrl = thisCalendar.mCalendarUri.spec;

            if (str.substr(0,6) == "<?xml ") {
                str = str.substring(str.indexOf('\n'));
            }
            var multistatus = new XML(str);

            for (var i = 0; i < multistatus.*.length(); i++) {
                var response = new XML(multistatus.*[i]);
                var responseCHS =
                    response..D::propstat..D::["calendar-home-set"]..D::href[0];

                if (responseCHS + "/" != thisCalendar.mCalHomeSet.path) {
                    continue;
                }
                var addrHrefs =
                    response..D::propstat..D::["calendar-user-address-set"]..D::href;
                for (var j = 0; j < addrHrefs.*.length(); j++) {
                    if (addrHrefs[j].substr(0,7).toLowerCase() == "mailto:") {
                        thisCalendar.mMailToUrl = addrHrefs[j];
                    }
                }
                var ibUrl = thisCalendar.mUri.clone();
                var ibPath =
                    response..D::propstat..D::["schedule-inbox-URL"]..D::href[0];
                ibUrl.path = ibPath;
                thisCalendar.mInBoxUrl = ibUrl;
                var obUrl = thisCalendar.mUri.clone();
                var obPath =
                    response..D::propstat..D::["schedule-outbox-URL"]..D::href[0];
                obUrl.path = obPath;
                thisCalendar.mOutBoxUrl = obUrl;
            }

            if (thisCalendar.mAuthenticationStatus == kCaldavFreshlyAuthenticated
                && thisCalendar.mPendingStartupRequests.length > 0) {
                thisCalendar.popStartupRequest();
            }
        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            channel.asyncOpen(streamLoader, httpchannel);
        }
        return;
    },

    //
    // calIFreeBusyProvider interface
    //

    getFreeBusyIntervals: function caldav_getFreeBusyIntervals(
        aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {

        if (!this.mHaveScheduling || !this.mOutBoxUrl || !this.mMailToUrl) {
            // XXX not all CalDAV server are going to support
            // CalDAV-scheduling freebusy searches, so we ought to be able to
            // fall back to querying an .ifb file or whatever
            LOG("Server does not support scheduling; freebusy query not possible");
            return;
        }

        // the caller prepends MAILTO: to calid strings containing @
        // but apple needs that to be mailto:
        var aCalIdParts = aCalId.split(":");
        aCalIdParts[0] = aCalIdParts[0].toLowerCase();
        mailto_aCalId = aCalIdParts.join(":");

        var outBoxUri = this.mOutBoxUrl.clone();
        var thisCalendar = this;

        //there really ought to be a better way to do this...
        var icssrv = Components.classes["@mozilla.org/calendar/ics-service;1"]
                               .getService(Components.interfaces.calIICSService);
        var bogusItem = icssrv.createIcalComponent("VEVENT");
        calSetProdidVersion(bogusItem);
        var prodid = bogusItem.prodid;
        var version = bogusItem.version;

        var organizer = this.mMailToUrl;

        var dtstamp = now().getInTimezone(UTC()).icalString;
        var dtstart = aRangeStart.getInTimezone(UTC()).icalString;
        var dtend = aRangeEnd.getInTimezone(UTC()).icalString;
        var uuid = getUUID();

        var fbQuery = "BEGIN:VCALENDAR\n";
        fbQuery += "VERSION:" + version + "\n";
        fbQuery += "PRODID:-" + prodid + "\n";
        fbQuery += "METHOD:REQUEST\n";
        fbQuery += "BEGIN:VFREEBUSY\n";
        fbQuery += "DTSTAMP:" + dtstamp + "\n";
        fbQuery += "ORGANIZER:" + organizer + "\n";
        fbQuery += "DTSTART:" + dtstart + "\n";
        fbQuery += "DTEND:" + dtend + "\n";
        fbQuery += "UID:" + uuid + "\n";
        var attendee = "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;CN=" + mailto_aCalId + "\n";
        var attendeeFolded = this.foldLine(attendee);
        fbQuery += attendeeFolded + "\n";
        fbQuery += "END:VFREEBUSY\n";
        fbQuery += "END:VCALENDAR\n";
        // RFC 2445 is specific about how lines end...
        fbQuery = fbQuery.replace(/\n/g, "\r\n");

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
            } catch(e) {
                LOG("Failed to parse freebusy response");
            }

            if (aContext.responseStatus == 200) {  // XXX = better error handling
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
                    str = str.substring(str.indexOf('\n'));
                }
                str = str.replace(/\n\ /g, "");
                str = str.replace(/\r/g, "");

                var response = new XML(str);
                var status = response..C::response..C::["request-status"];
                if (status.substr(0,1) != 2) {
                    LOG("Got status " + status + " in response to freebusy query");
                    return;
                }
                if (status.substr(0,3) != "2.0") {
                    LOG("Got status " + status + " in response to freebusy query");
                }
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
                            var period = new CalPeriod();
                            period.start = begin;
                            period.end = end;
                            period.makeImmutable();
                            var interval = {
                                QueryInterface: function fbInterval_QueryInterface(iid) {
                                    ensureIID([calIFreeBusyInterval, nsISupports], iid);
                                    return this;
                                },
                                calId: aCalId,
                                interval: period,
                                freeBusyType: fbType
                            };
                            periodsToReturn.push(interval);
                        }
                    }
                }
                aListener.onResult(null, periodsToReturn);
            } else {
                LOG("Received status " + aContext.responseStatus + " from freebusy query");
            }

        }

        var streamLoader = Components.classes["@mozilla.org/network/stream-loader;1"]
                             .createInstance(Components.interfaces
                             .nsIStreamLoader);

        if (isOnBranch) {
            streamLoader.init(httpchannel, streamListener, httpchannel);
        } else {
            streamLoader.init(streamListener);
            channel.asyncOpen(streamLoader, httpchannel);
        }

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

var g_fbService = null;
function getFreeBusyService() {
    if (!g_fbService) {
        g_fbService =
            Components.classes["@mozilla.org/calendar/freebusy-service;1"]
                      .getService(Components.interfaces.calIFreeBusyService);
    }
    return g_fbService;
};
