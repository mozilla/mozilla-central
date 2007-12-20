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
 * The Original Code is Google Calendar Provider code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joey Minta <jminta@gmail.com>
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
 * calGoogleCalendar
 * This Implements a calICalendar Object adapted to the Google Calendar
 * Provider.
 *
 * @class
 * @constructor
 */
function calGoogleCalendar() {
    this.initProviderBase();
}

calGoogleCalendar.prototype = {
    __proto__: calProviderBase.prototype,

    /* Member Variables */
    mSession: null,
    mFullUri: null,
    mCalendarName: null,

    /*
     * Google Calendar Provider attributes
     */

    /**
     * readonly attribute googleCalendarName
     * Google's Calendar name. This represents the <calendar name> in
     * http[s]://www.google.com/calendar/feeds/<calendar name>/private/full
     */
    get googleCalendarName() {
        return this.mCalendarName;
    },

    /**
     * attribute session
     * An calGoogleSession Object that handles the session requests.
     */
    get session() {
        return this.mSession;
    },
    set session(v) {
        return this.mSession = v;
    },

    /**
     * findSession
     * Populates the Session Object based on the preferences or the result of a
     * login prompt.
     *
     * @param aIgnoreExistingSession If set, find the session regardless of
     *                               whether the session has been previously set
     *                               or not
     */
    findSession: function cGC_findSession(aIgnoreExistingSession) {
        if (this.mSession && !aIgnoreExistingSession) {
            return;
        }

        // We need to find out which Google account fits to this calendar.
        var googleUser = getCalendarPref(this, "googleUser");
        if (googleUser) {
            this.mSession = getSessionByUsername(googleUser);
        } else {
            // We have no user, therefore we need to ask the user. Show a
            // user/password prompt and set the session based on those
            // values.

            var username = { value: this.mCalendarName };
            var password = { value: null };
            var savePassword = { value: false };

            if (getCalendarCredentials(this.mCalendarName,
                                       username,
                                       password,
                                       savePassword)) {
                this.mSession = getSessionByUsername(username.value);
                this.mSession.googlePassword = password.value;
                this.mSession.savePassword = savePassword.value;
                setCalendarPref(this,
                                "googleUser",
                                "CHAR",
                                this.mSession.googleUser);
            }
        }
    },

    /*
     * implement calICalendar
     */
    get type() {
        return "gdata";
    },

    get sendItipInvitations() {
        return false;
    },

    get uri() {
        return this.mUri;
    },

    get fullUri() {
        return this.mFullUri;
    },
    set uri(aUri) {
        // Parse google url, catch private cookies, public calendars,
        // basic and full types, bogus ics file extensions, invalid hostnames
        var re = new RegExp("/calendar/(feeds|ical)/" +
                            "([^/]+)/(public|private)-?([^/]+)?/" +
                            "(full|basic)(.ics)?$");

        var matches = aUri.path.match(re);

        if (!matches) {
            throw new Components.Exception(aUri, Components.results.NS_ERROR_MALFORMED_URI);
        }

        // Set internal Calendar Name
        this.mCalendarName = decodeURIComponent(matches[2]);

        // Set normalized url. We need private visibility and full projection
        this.mFullUri = aUri.clone();
        this.mFullUri.path = "/calendar/feeds/" + matches[2] + "/private/full";

        // Remember the uri as it was passed, in case the calendar manager
        // relies on it.
        this.mUri = aUri;

        this.findSession(true);
        return this.mUri;
    },

    get canRefresh() {
        return true;
    },

    adoptItem: function cGC_adoptItem(aItem, aListener) {
        LOG("Adding item " + aItem.title);

        try {
            // Check if calendar is readonly
            if (this.readOnly) {
                throw new Components.Exception("",
                                               Components.interfaces.calIErrors.CAL_IS_READONLY);
            }

            // Make sure the item is an event
            aItem = aItem.QueryInterface(Components.interfaces.calIEvent);

            // Check if we have a session. If not, then the user has canceled
            // the login prompt.
            if (!this.mSession) {
                this.findSession();
            }

            // Add the calendar to the item, for later use.
            aItem.calendar = this.superCalendar;

            // When adding items, the google user is the organizer.
            var organizer = createAttendee();
            organizer.isOrganizer = true;
            organizer.commonName = this.mSession.googleFullName;
            organizer.id = "mailto:" + this.mSession.googleUser;
            aItem.organizer = organizer;

            this.mSession.addItem(this,
                                  aItem,
                                  this.addItem_response,
                                  aListener);
        } catch (e) {
            LOG("adoptItem failed before request " + aItem.title + "\n:" + e);
            if (e.result == Components.interfaces.calIErrors.CAL_IS_READONLY) {
                // The calendar is readonly, make sure this is set and
                // notify the user. This can come from above or from
                // mSession.addItem which checks for the editURI
                this.readOnly = true;
                this.mObservers.notify("onError", [e.result, e.message]);
            }

            if (aListener != null) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              Components.interfaces.calIOperationListener.ADD,
                                              null,
                                              e.message);
            }
        }
    },

    addItem: function cGC_addItem(aItem, aListener) {
        // Google assigns an ID to every event added. Any id set here or in
        // adoptItem will be overridden.
        return this.adoptItem( aItem.clone(), aListener );
    },

    modifyItem: function cGC_modifyItem(aNewItem, aOldItem, aListener) {
        LOG("Modifying item " + aOldItem.title);

        try {
            if (this.readOnly) {
                throw new Components.Exception("",
                                               Components.interfaces.calIErrors.CAL_IS_READONLY);
            }

            // Check if we have a session. If not, then the user has canceled
            // the login prompt.
            if (!this.mSession) {
                this.findSession();
            }

            // Check if the item is an occurrence. Until bug 362650 is solved,
            // there is no support for changing single occurrences.
            if (aOldItem.getProperty("X-GOOGLE-ITEM-IS-OCCURRENCE")) {
                throw new Components.Exception("", Components.results.NS_ERROR_NOT_IMPLEMENTED);
            }

            // Check if enough fields have changed to warrant sending the event
            // to google. This saves network traffic.
            if (relevantFieldsMatch(aOldItem, aNewItem)) {
                LOG("Not requesting item modification for " + aOldItem.id +
                    "(" + aOldItem.title + "), relevant fields match");

                if (aListener != null) {
                    aListener.onOperationComplete(this.superCalendar,
                                                  Components.results.NS_OK,
                                                  Components.interfaces.calIOperationListener.MODIFY,
                                                  aNewItem.id,
                                                  aNewItem);
                }
                this.mObservers.notify("onModifyItem", [aNewItem, aOldItem]);
                return;
            }

            // We need the old item in the response so the observer can be
            // called correctly.
            var extradata = { olditem: aOldItem, listener: aListener };

            this.mSession.modifyItem(this,
                                     aOldItem,
                                     aNewItem,
                                     this.modifyItem_response,
                                     extradata);
        } catch (e) {
            LOG("modifyItem failed before request " +
                aNewItem.title + "(" + aNewItem.id + "):\n" + e);

            if (e.result == Components.interfaces.calIErrors.CAL_IS_READONLY) {
                // The calendar is readonly, make sure this is set and
                // notify the user. This can come from above or from
                // mSession.modifyItem which checks for the editURI
                this.readOnly = true;
                this.mObservers.notify("onError", [e.result, e.message]);
            }

            if (aListener != null) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              Components.interfaces.calIOperationListener.MODIFY,
                                              null,
                                              e.message);
            }
        }
    },

    deleteItem: function cGC_deleteItem(aItem, aListener) {
        LOG("Deleting item " + aItem.title + "(" + aItem.id + ")");

        try {
            if (this.readOnly) {
                throw new Components.Exception("",
                                               Components.interfaces.calIErrors.CAL_IS_READONLY);
            }

            // Check if we have a session. If not, then the user has canceled
            // the login prompt.
            if (!this.mSession) {
                this.findSession();
            }

            // We need the item in the response, since google dosen't return any
            // item XML data on delete, and we need to call the observers.
            var extradata = { listener: aListener, item: aItem };

            this.mSession.deleteItem(this,
                                     aItem,
                                     this.deleteItem_response,
                                     extradata);
        } catch (e) {
            LOG("deleteItem failed before request for " +
                aItem.title + "(" + aItem.id + "):\n" + e);

            if (e.result == Components.interfaces.calIErrors.CAL_IS_READONLY) {
                // The calendar is readonly, make sure this is set and
                // notify the user. This can come from above or from
                // mSession.deleteItem which checks for the editURI
                this.readOnly = true;
                this.mObservers.notify("onError", [e.result, e.message]);
            }

            if (aListener != null) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              Components.interfaces.calIOperationListener.DELETE,
                                              null,
                                              e.message);
            }
        }
    },

    getItem: function cGC_getItem(aId, aListener) {
        // This function needs a test case using mechanisms in bug 365212
        LOG("Getting item with id " + aId);
        try {

            // Check if we have a session. If not, then the user has canceled
            // the login prompt.
            if (!this.mSession) {
                this.findSession();
            }

            this.mSession.getItem(this,
                                  aId,
                                  this.getItem_response,
                                  aListener);
        } catch (e) {
            LOG("getItem failed before request " + aItem.title + "(" + aItem.id
                + "):\n" + e);

            if (aListener != null) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              Components.interfaces.calIOperationListener.GET,
                                              null,
                                              e.message);
            }
        }
    },

    getItems: function cGC_getItems(aItemFilter,
                                    aCount,
                                    aRangeStart,
                                    aRangeEnd,
                                    aListener) {
        try {
            // Check if we have a session. If not, then the user has canceled
            // the login prompt.
            if (!this.mSession) {
                this.findSession();
            }

            // item base type
            var wantEvents = ((aItemFilter &
                               Components.interfaces.calICalendar.ITEM_FILTER_TYPE_EVENT) != 0);
            var wantTodos = ((aItemFilter &
                              Components.interfaces.calICalendar.ITEM_FILTER_TYPE_TODO) != 0);

            // check if events are wanted
            if (!wantEvents && !wantTodos) {
                // Nothing to do. The onOperationComplete in the catch block
                // below will catch this.
                throw new Components.Exception("", Components.results.NS_OK);
            } else if (wantTodos && !wantEvents) {
                throw new Components.Exception("", Components.results.NS_ERROR_NOT_IMPLEMENTED);
            }
            // return occurrences?
            var itemReturnOccurrences = ((aItemFilter &
                Components.interfaces.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0);

            var extradata = { itemfilter: aItemFilter, listener: aListener };

            this.mSession.getItems(this,
                                   aCount,
                                   aRangeStart,
                                   aRangeEnd,
                                   itemReturnOccurrences,
                                   this.getItems_response,
                                   extradata);
        } catch (e) {
            if (aListener != null) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              Components.interfaces.calIOperationListener.GET,
                                              null, e.message);
            }
        }
    },

    refresh: function cGC_refresh() {
        this.mObservers.notify("onLoad", [this]);
    },

    /*
     * Google Calendar Provider Response functions
     */

    /**
     * addItem_response
     * Response callback, called by the session object when an item was added
     *
     * @param aRequest  The request object that initiated the request
     * @param aStatus   The response code. This is a Components.results.* code
     * @param aResult   In case of an error, this is the error string, otherwise
     *                  an XML representation of the added item.
     */
    addItem_response: function cGC_addItem_response(aRequest,
                                                    aStatus,
                                                    aResult) {
        var item = this.general_response(Components.interfaces.calIOperationListener.ADD,
                                         aResult,
                                         aStatus,
                                         aRequest.extraData);
        // Notify Observers
        if (item) {
            this.mObservers.notify("onAddItem", [item]);
        }
    },

    /**
     * modifyItem_response
     * Response callback, called by the session object when an item was modified
     *
     * @param aRequest  The request object that initiated the request
     * @param aStatus   The response code. This is a Components.results.* Code
     * @param aResult   In case of an error, this is the error string, otherwise
     *                  an XML representation of the modified item
     */
    modifyItem_response: function cGC_modifyItem_response(aRequest,
                                                          aStatus,
                                                          aResult) {
        var item = this.general_response(Components.interfaces.calIOperationListener.MODIFY,
                                         aResult,
                                         aStatus,
                                         aRequest.extraData.listener);
        // Notify Observers
        if (item) {
            this.mObservers.notify("onModifyItem",
                                   [item, aRequest.extraData.olditem]);
        }
    },

    /**
     * deleteItem_response
     * Response callback, called by the session object when an Item was deleted
     *
     * @param aRequest  The request object that initiated the request
     * @param aStatus   The response code. This is a Components.results.* Code
     * @param aResult   In case of an error, this is the error string, otherwise
     *                  this may be empty.
     */
    deleteItem_response: function cGC_deleteItem_response(aRequest,
                                                          aStatus,
                                                          aResult) {
        // The reason we are not using general_response here is because deleted
        // items are not returned as xml from google. We need to pass the item
        // we saved with the request.

        try {
            // Check if the call succeeded
            if (aStatus != Components.results.NS_OK) {
                throw new Components.Exception(aResult, aStatus);
            }

            // All operations need to call onOperationComplete
            if (aRequest.extraData.listener) {
                LOG("Deleting item " + aRequest.extraData.item.id +
                    " successful");

                aRequest.extraData.listener.onOperationComplete(this.superCalendar,
                                                                Components.results.NS_OK,
                                                                Components.interfaces.calIOperationListener.DELETE,
                                                                aRequest.extraData.item.id,
                                                                aRequest.extraData.item);
            }

            // Notify Observers
            this.mObservers.notify("onDeleteItem", [aRequest.extraData.item]);
        } catch (e) {
            LOG("Deleting item " + aRequest.extraData.item.id + " failed");
            // Operation failed
            if (aRequest.extraData.listener) {
                aRequest.extraData.listener.onOperationComplete(this.superCalendar,
                                                                e.result,
                                                                Components.interfaces.calIOperationListener.DELETE,
                                                                null,
                                                                e.message);
            }
        }
    },

    /**
     * getItem_response
     * Response callback, called by the session object when a single Item was
     * downloaded.
     *
     * @param aRequest  The request object that initiated the request
     * @param aStatus   The response code. This is a Components.results.* Code
     * @param aResult   In case of an error, this is the error string, otherwise
     *                  an XML representation of the requested item
     */
    getItem_response: function cGC_getItem_response(aRequest,
                                                    aStatus,
                                                    aResult) {
        // our general response does it all for us. I hope.
        this.general_response(Components.interfaces.calIOperationListener.GET,
                              aResult,
                              aStatus,
                              aRequest.extraData);
    },

    /**
     * getItems_response
     * Response callback, called by the session object when an Item feed was
     * downloaded.
     *
     * @param aRequest  The request object that initiated the request
     * @param aStatus   The response code. This is a Components.results.* Code
     * @param aResult   In case of an error, this is the error string, otherwise
     *                  an XML feed with the requested items.
     */
    getItems_response: function cGC_getItems_response(aRequest,
                                                      aStatus,
                                                      aResult) {
        LOG("Recieved response for " + aRequest.uri);
        try {
            // Check if the call succeeded
            if (aStatus != Components.results.NS_OK) {
                throw new Components.Exception(aResult, aStatus);
            }

            // Prepare Namespaces
            var gCal = new Namespace("gCal",
                                     "http://schemas.google.com/gCal/2005");
            var gd = new Namespace("gd", "http://schemas.google.com/g/2005");
            var atom = new Namespace("", "http://www.w3.org/2005/Atom");
            default xml namespace = atom;

            // A feed was passed back, parse it. Due to bug 336551 we need to
            // filter out the <?xml...?> part.
            var xml = new XML(aResult.substring(38));
            var timezone = xml.gCal::timezone.@value.toString() || "UTC";

            // This line is needed, otherwise the for each () block will never
            // be entered. It may seem strange, but if you don't believe me, try
            // it!
            xml.link.(@rel);

            // We might be able to get the full name through this feed's author
            // tags. We need to make sure we have a session for that.
            if (!this.mSession) {
                this.findSession();
            }

            if (xml.author.email == this.mSession.googleUser) {
                this.mSession.googleFullName = xml.author.name.toString();
            }

            // Parse all <entry> tags
            for each (var entry in xml.entry) {
                var item = XMLEntryToItem(entry, timezone, this.superCalendar);

                if (item) {
                    var itemReturnOccurrences =
                        ((aRequest.extraData.itemfilter &
                          Components.interfaces.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) != 0);

                    var itemIsOccurrence = item.getProperty("X-GOOGLE-ITEM-IS-OCCURRENCE");

                    if ((itemReturnOccurrences && itemIsOccurrence) ||
                        !itemIsOccurrence) {
                        LOG("Parsing entry:\n" + entry + "\n");

                        item.calendar = this.superCalendar;
                        item.makeImmutable();
                        LOGitem(item);

                        aRequest.extraData.listener.onGetResult(this.superCalendar,
                                                                Components.results.NS_OK,
                                                                Components.interfaces.calIEvent,
                                                                null,
                                                                1,
                                                                [item]);
                    }
                } else {
                    LOG("Notice: An Item was skipped. Probably it has" +
                        " features that are not supported, or it was" +
                        " canceled");
                }
            }

            // Operation Completed successfully.
            if (aRequest.extraData.listener != null) {
                aRequest.extraData.listener.onOperationComplete(this.superCalendar,
                                                                Components.results.NS_OK,
                                                                Components.interfaces.calIOperationListener.GET,
                                                                null,
                                                                null);
            }
        } catch (e) {
            LOG("Error getting items:\n" + e);
            // Operation failed
            if (aRequest.extraData.listener != null) {
                aRequest.extraData.listener.onOperationComplete(this.superCalendar,
                                                                e.result,
                                                                Components.interfaces.calIOperationListener.GET,
                                                                null,
                                                                e.message);
            }
        }
    },

    /**
     * general_response
     * Handles common actions for multiple response types. This does not notify
     * observers.
     *
     * @param aOperation    The operation type (Components.interfaces.calIOperationListener.*)
     * @param aItemString   The string represenation of the item
     * @param aStatus       The response code. This is a Components.results.*
     *                      error code
     * @param aListener     The listener to be called on completion
     *                      (an instance of calIOperationListener)
     *
     * @return              The Item as a calIEvent
     */
    general_response: function cGC_general_response(aOperation,
                                                    aItemString,
                                                    aStatus,
                                                    aListener) {

        try {
            // Check if the call succeeded, if not then aItemString is an error
            // message

            if (aStatus != Components.results.NS_OK) {
                throw new Components.Exception(aItemString, aStatus);
            }

            // An Item was passed back, parse it. Due to bug 336551 we need to
            // filter out the <?xml...?> part.
            var xml = new XML(aItemString.substring(38));

            // Get the local timezone from the preferences
            var timezone = calendarDefaultTimezone().tzid;

            // Parse the Item with the given timezone
            var item = XMLEntryToItem(xml, timezone, this.superCalendar);

            LOGitem(item);
            item.calendar = this.superCalendar;
            item.makeImmutable();

            // GET operations need to call onGetResult
            if (aOperation == Components.interfaces.calIOperationListener.GET) {
                aListener.onGetResult(this.superCalendar,
                                      Components.results.NS_OK,
                                      Components.interfaces.calIEvent,
                                      null,
                                      1,
                                      [item]);
            }

            // All operations need to call onOperationComplete
            if (aListener) {
                aListener.onOperationComplete(this.superCalendar,
                                              Components.results.NS_OK,
                                              aOperation,
                                              (item ? item.id : null),
                                              item);
            }
            return item;
        } catch (e) {
            LOG("General response failed: " + e);

            if (e.result == Components.interfaces.calIErrors.CAL_IS_READONLY) {
                // The calendar is readonly, make sure this is set and
                // notify the user.
                this.readOnly = true;
                this.mObservers.notify("onError", [e.result, e.message]);
            }

            // Operation failed
            if (aListener) {
                aListener.onOperationComplete(this.superCalendar,
                                              e.result,
                                              aOperation,
                                              null,
                                              e.message);
            }
        }
        // Returning null to avoid js strict warning.
        return null;
    }
};
