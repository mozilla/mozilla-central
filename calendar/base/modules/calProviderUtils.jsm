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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Bruno Browning <browning@uwalumni.com>
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
Components.utils.import("resource://calendar/modules/calAuthUtils.jsm");

/*
 * Provider helper code
 */

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this

/**
 * Prepare HTTP channel with standard request headers and upload
 * data/content-type if needed
 *
 * @param arUri                      Channel Uri, will only be used for a new
 *                                     channel.
 * @param aUploadData                Data to be uploaded, if any. This may be a
 *                                     nsIInputStream or string data. In the
 *                                     latter case the string will be converted
 *                                     to an input stream.
 * @param aContentType               Value for Content-Type header, if any
 * @param aNotificationCallbacks     Calendar using channel
 * @param aExisting                  An existing channel to modify (optional)
 */
cal.prepHttpChannel = function calPrepHttpChannel(aUri, aUploadData, aContentType, aNotificationCallbacks, aExisting) {
    let channel = aExisting || cal.getIOService().newChannelFromURI(aUri);
    let httpchannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);

    httpchannel.setRequestHeader("Accept", "text/xml", false);
    httpchannel.setRequestHeader("Accept-Charset", "utf-8,*;q=0.1", false);
    httpchannel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
    httpchannel.notificationCallbacks = aNotificationCallbacks;

    if (aUploadData) {
        httpchannel = httpchannel.QueryInterface(Components.interfaces.nsIUploadChannel);
        let stream;
        if (aUploadData instanceof Components.interfaces.nsIInputStream) {
            // Make sure the stream is reset
            stream = aUploadData.QueryInterface(Components.interfaces.nsISeekableStream);
            stream.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, 0);
        } else {
            // Otherwise its something that should be a string, convert it.
            let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
            converter.charset = "UTF-8";
            stream = converter.convertToInputStream(aUploadData.toString());
        }

        httpchannel.setUploadStream(stream, aContentType, -1);
    }

    return httpchannel;
};

/**
 * calSendHttpRequest; send prepared HTTP request
 *
 * @param aStreamLoader     streamLoader for request
 * @param aChannel          channel for request
 * @param aListener         listener for method completion
 */
cal.sendHttpRequest = function calSendHttpRequest(aStreamLoader, aChannel, aListener) {
    aStreamLoader.init(aListener);
    aChannel.asyncOpen(aStreamLoader, aChannel);
};

cal.createStreamLoader = function calCreateStreamLoader() {
    return Components.classes["@mozilla.org/network/stream-loader;1"]
                     .createInstance(Components.interfaces.nsIStreamLoader);
};

cal.convertByteArray = function calConvertByteArray(aResult, aResultLength, aCharset, aThrow) {
    try {
        let resultConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                        .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        resultConverter.charset = aCharset || "UTF-8";
        return resultConverter.convertFromByteArray(aResult, aResultLength);
    } catch (e) {
        if (aThrow) {
            throw e;
        }
    }
    return null;
};

cal.safeNewXML = function calSafeNewXML(aStr) {
    // Restore XML global property defaults as a precaution
    XML.setSettings();

    // Strip <?xml and surrounding whitespaces (bug 336551)
    return new XML(aStr.replace(/^\s*<\?xml[^>]*>/g, "").trimRight());
};

/**
 * getInterface method for providers. This should be called in the context of
 * the respective provider, i.e
 *
 * return cal.InterfaceRequestor_getInterface.apply(this, arguments);
 *
 * or
 * ...
 * getInterface: cal.InterfaceRequestor_getInterface,
 * ...
 *
 * @param aIID      The interface ID to return
 */
cal.InterfaceRequestor_getInterface = function calInterfaceRequestor_getInterface(aIID) {
    // Support Auth Prompt Interfaces
    if (aIID.equals(Components.interfaces.nsIAuthPrompt) ||
        (Components.interfaces.nsIAuthPrompt2 &&
         aIID.equals(Components.interfaces.nsIAuthPrompt2))) {
        return new cal.auth.Prompt();
    } else if (aIID.equals(Components.interfaces.nsIAuthPromptProvider) ||
               aIID.equals(Components.interfaces.nsIPrompt)) {
        return Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher)
                         .getNewPrompter(null);
    }

    try {
        // Try to query the this object for the requested interface but don't
        // throw if it fails since that borks the network code.
        return this.QueryInterface(aIID);
    } catch (e) {
        Components.returnCode = e;
    }
    return null;
};

/**
 * Freebusy interval implementation. All parameters are optional.
 *
 * @param aCalId         The calendar id to set up with.
 * @param aFreeBusyType  The type from calIFreeBusyInterval.
 * @param aStart         The start of the interval.
 * @param aEnd           The end of the interval.
 * @return               The fresh calIFreeBusyInterval.
 */
cal.FreeBusyInterval = function calFreeBusyInterval(aCalId, aFreeBusyType, aStart, aEnd) {
    this.calId = aCalId
    this.interval = Components.classes["@mozilla.org/calendar/period;1"]
                              .createInstance(Components.interfaces.calIPeriod);
    this.interval.start = aStart;
    this.interval.end = aEnd;

    this.freeBusyType = aFreeBusyType || Components.interfaces.calIFreeBusyInterval.UNKNOWN;
};
cal.FreeBusyInterval.prototype = {
    QueryInterface: function cFBI_QueryInterface(aIID) {
        return doQueryInterface(this,
                                cal.FreeBusyInterval.prototype,
                                aIID,
                                [Components.interfaces.calIFreeBusyInterval]);
    },

    calId: null,
    interval: null,
    freeBusyType: Components.interfaces.calIFreeBusyInterval.UNKNOWN
};

/**
 * Gets the iTIP/iMIP transport if the passed calendar has configured email.
 */
cal.getImipTransport = function calGetImipTransport(aCalendar) {
    // assure an identity is configured for the calendar
    return (aCalendar.getProperty("imip.identity")
            ? Components.classes["@mozilla.org/calendar/itip-transport;1?type=email"]
                        .getService(Components.interfaces.calIItipTransport)
            : null);
};

/**
 * Gets the configured identity and account of a particular calendar instance, or null.
 *
 * @param aCalendar     Calendar instance
 * @param outAccount    Optional out value for account
 * @return              The configured identity
 */
cal.getEmailIdentityOfCalendar = function calGetEmailIdentityOfCalendar(aCalendar, outAccount) {
    cal.ASSERT(aCalendar, "no calendar!", Components.results.NS_ERROR_INVALID_ARG);
    if (cal.isSunbird()) {
        return null;
    }
    let key = aCalendar.getProperty("imip.identity.key");
    if (key !== null) {
        if (key.length == 0) { // i.e. "None"
            return null;
        }
        let identity = null;
        cal.calIterateEmailIdentities(
            function(identity_, account) {
                if (identity_.key == key) {
                    identity = identity_;
                    if (outAccount) {
                        outAccount.value = account;
                    }
                }
                return (identity_.key != key);
            });
        if (!identity) {
            // dangling identity:
            cal.WARN("Calendar " + (aCalendar.uri ? aCalendar.uri.spec : aCalendar.id) +
                     " has a dangling E-Mail identity configured.");
        }
        return identity;
    } else { // take default account/identity:

        let accounts = cal.getAccountManager().accounts;
        let account = null;
        let identity = null;
        try {
            account = cal.getAccountManager().defaultAccount;
        } catch (exc) {}

        for (let i = 0; accounts && (i < accounts.Count()) && (!account || !identity); ++i) {
            if (!account) { // Pick an account only if none was set (i.e there is no default account)
                account = accounts.GetElementAt(i);
                try {
                    account = account.QueryInterface(Components.interfaces.nsIMsgAccount);
                } catch (exc) {
                    account = null;
                }
            }

            if (account && account.identities.Count()) { // Pick an identity
                identity = account.defaultIdentity;
                if (!identity) { // there is no default identity, use the first
                    identity = account.identities.GetElementAt(0)
                                                 .QueryInterface(Components.interfaces.nsIMsgIdentity);
                }
            } else { // If this account has no identities, continue to the next account.
                account = null;
            }
        }

        if (identity) {
            // If an identity was set above, set the account out parameter
            // and return the identity
            if (outAccount) {
                outAccount.value = account;
            }
            return identity;
        }
        return null;
    }
};


/**
 * fromRFC3339
 * Convert a RFC3339 compliant Date string to a calIDateTime.
 *
 * @param aStr          The RFC3339 compliant Date String
 * @param aTimezone     The timezone this date string is most likely in
 * @return              A calIDateTime object
 */
cal.fromRFC3339 = function fromRFC3339(aStr, aTimezone) {

    // XXX I have not covered leapseconds (matches[8]), this might need to
    // be done. The only reference to leap seconds I found is bug 227329.
    //

    // Create a DateTime instance (calUtils.js)
    let dateTime = cal.createDateTime();

    // Killer regex to parse RFC3339 dates
    var re = new RegExp("^([0-9]{4})-([0-9]{2})-([0-9]{2})" +
        "([Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(\\.[0-9]+)?)?" +
        "(([Zz]|([+-])([0-9]{2}):([0-9]{2})))?");

    var matches = re.exec(aStr);

    if (!matches) {
        return null;
    }

    // Set usual date components
    dateTime.isDate = (matches[4]==null);

    dateTime.year = matches[1];
    dateTime.month = matches[2] - 1; // Jan is 0
    dateTime.day = matches[3];

    if (!dateTime.isDate) {
        dateTime.hour = matches[5];
        dateTime.minute = matches[6];
        dateTime.second = matches[7];
    }

    // Timezone handling
    if (matches[9] == "Z" || matches[9] == "z") {
        // If the dates timezone is "Z" or "z", then this is UTC, no matter
        // what timezone was passed
        dateTime.timezone = cal.UTC();

    } else if (matches[9] == null) {
        // We have no timezone info, only a date. We have no way to
        // know what timezone we are in, so lets assume we are in the
        // timezone of our local calendar, or whatever was passed.

        dateTime.timezone = aTimezone;

    } else {
        var offset_in_s = (matches[11] == "-" ? -1 : 1) *
            ( (matches[12] * 3600) + (matches[13] * 60) );

        // try local timezone first
        dateTime.timezone = aTimezone;

        // If offset does not match, go through timezones. This will
        // give you the first tz in the alphabet and kill daylight
        // savings time, but we have no other choice
        if (dateTime.timezoneOffset != offset_in_s) {
            // TODO A patch to Bug 363191 should make this more efficient.

			var tzService = getTimezoneService();
            // Enumerate timezones, set them, check their offset
            var enumerator = tzService.timezoneIds;
            while (enumerator.hasMore()) {
                var id = enumerator.getNext();
                dateTime.timezone = tzService.getTimezone(id);
                if (dateTime.timezoneOffset == offset_in_s) {
                    // This is our last step, so go ahead and return
                    return dateTime;
                }
            }
            // We are still here: no timezone was found
            dateTime.timezone = cal.UTC();
            if (!dateTime.isDate) {
                dateTime.hour += (matches[11] == "-" ? -1 : 1) * matches[12];
                dateTime.minute += (matches[11] == "-" ? -1 : 1) * matches[13];
             }
        }
    }
    return dateTime;
};

/**
 * toRFC3339
 * Convert a calIDateTime to a RFC3339 compliant Date string
 *
 * @param aDateTime     The calIDateTime object
 * @return              The RFC3339 compliant date string
 */
cal.toRFC3339 = function toRFC3339(aDateTime) {

    if (!aDateTime) {
        return "";
    }

    var full_tzoffset = aDateTime.timezoneOffset;
    var tzoffset_hr = Math.floor(Math.abs(full_tzoffset) / 3600);

    var tzoffset_mn = ((Math.abs(full_tzoffset) / 3600).toFixed(2) -
                       tzoffset_hr) * 60;

    var str = aDateTime.year + "-" +
        ("00" + (aDateTime.month + 1)).substr(-2) +  "-" +
        ("00" + aDateTime.day).substr(-2);

    // Time and Timezone extension
    if (!aDateTime.isDate) {
        str += "T" +
               ("00" + aDateTime.hour).substr(-2) + ":" +
               ("00" + aDateTime.minute).substr(-2) + ":" +
               ("00" + aDateTime.second).substr(-2);
        if (aDateTime.timezoneOffset != 0) {
            str += (full_tzoffset < 0 ? "-" : "+") +
                   ("00" + tzoffset_hr).substr(-2) + ":" +
                   ("00" + tzoffset_mn).substr(-2);
        } else if (aDateTime.timezone.isFloating) {
            // RFC3339 Section 4.3 Unknown Local Offset Convention
            str += "-00:00";
        } else {
            // ZULU Time, according to ISO8601's timezone-offset
            str += "Z";
        }
    }
    return str;
};

/**
 * Base prototype to be used implementing a provider.
 *
 * @see e.g. providers/gdata
 */
cal.ProviderBase = function calProviderBase() {
    cal.ASSERT("This prototype should only be inherited!");
};
cal.ProviderBase.mTransientProperties = {
    "cache.uncachedCalendar": true,
    "currentStatus": true,
    "itip.transport": true,
    "imip.identity": true,
    "imip.account": true,
    "imip.identity.disabled": true,
    "organizerId": true,
    "organizerCN": true
};
cal.ProviderBase.prototype = {
    QueryInterface: function cPB_QueryInterface(aIID) {
        return cal.doQueryInterface(this, cal.ProviderBase.prototype, aIID,
                                    [Components.interfaces.nsISupports,
                                     Components.interfaces.calICalendar,
                                     Components.interfaces.calISchedulingSupport]);
    },

    mID: null,
    mUri: null,
    mObservers: null,
    mProperties: null,

    initProviderBase: function cPB_initProviderBase() {
        this.wrappedJSObject = this;
        this.mObservers = new cal.calListenerBag(Components.interfaces.calIObserver);
        this.mProperties = {};
        this.mProperties.currentStatus = Components.results.NS_OK;
    },

    get observers cPB_observers_get() {
        return this.mObservers;
    },

    // attribute AUTF8String id;
    get id cPB_id_get() {
        return this.mID;
    },
    set id cPB_id_set(aValue) {
        if (this.mID) {
            throw Components.results.NS_ERROR_ALREADY_INITIALIZED;
        }
        this.mID = aValue;

//         cal.ASSERT(this.mProperties.toSource() == "({})", "setProperty calls before id has been set!");

        let calMgr = cal.getCalendarManager();
        let this_ = this;
        function takeOverIfNotPresent(oldPref, newPref, dontDeleteOldPref) {
            let val = calMgr.getCalendarPref_(this_, oldPref);
            if (val !== null) {
                if (!dontDeleteOldPref) {
                    calMgr.deleteCalendarPref_(this_, oldPref);
                }
                if (calMgr.getCalendarPref_(this_, newPref) === null) {
                    calMgr.setCalendarPref_(this_, newPref, val);
                }
            }
        }
        // takeover lightning calendar visibility from 0.5:
        takeOverIfNotPresent("lightning-main-in-composite", "calendar-main-in-composite");
        takeOverIfNotPresent("lightning-main-default", "calendar-main-default");

        return aValue;
    },

    // attribute AUTF8String name;
    get name cPB_name_get() {
        return this.getProperty("name");
    },
    set name cPB_name_set(aValue) {
        return this.setProperty("name", aValue);
    },

    // attribute calICalendar superCalendar;
    get superCalendar cPB_superCalendar_get() {
        // If we have a superCalendar, check this calendar for a superCalendar.
        // This will make sure the topmost calendar is returned
        return (this.mSuperCalendar ? this.mSuperCalendar.superCalendar : this);
    },
    set superCalendar cPB_superCalendar_set(val) {
        return (this.mSuperCalendar = val);
    },

    // attribute nsIURI uri;
    get uri cPB_uri_get() {
        return this.mUri;
    },
    set uri cPB_uri_set(aValue) {
        return (this.mUri = aValue);
    },

    // attribute boolean readOnly;
    get readOnly cPB_readOnly_get() {
        return this.getProperty("readOnly");
    },
    set readOnly cPB_readOnly_set(aValue) {
        return this.setProperty("readOnly", aValue);
    },

    // readonly attribute boolean canRefresh;
    get canRefresh cPB_canRefresh_get() {
        return false;
    },

    // void startBatch();
    mBatchCount: 0,
    startBatch: function cPB_startBatch() {
        if (this.mBatchCount++ == 0) {
            this.mObservers.notify("onStartBatch");
        }
    },

    endBatch: function cPB_endBatch() {
        if (this.mBatchCount > 0) {
            if (--this.mBatchCount == 0) {
                this.mObservers.notify("onEndBatch");
            }
        } else {
            cal.ASSERT(this.mBatchCount > 0, "unexepcted endBatch!");
        }
    },

    notifyOperationComplete: function cPB_notifyOperationComplete(aListener,
                                                                  aStatus,
                                                                  aOperationType,
                                                                  aId,
                                                                  aDetail) {
        if (aListener) {
            try {
                aListener.onOperationComplete(this.superCalendar, aStatus, aOperationType, aId, aDetail);
            } catch (exc) {
                cal.ERROR(exc);
            }
        }
        if (aStatus == Components.interfaces.calIErrors.OPERATION_CANCELLED) {
            return; // cancellation doesn't change current status, no notification
        }
        if (Components.isSuccessCode(aStatus)) {
            this.setProperty("currentStatus", aStatus);
        } else {
            if (aDetail instanceof Components.interfaces.nsIException) {
                this.notifyError(aDetail); // will set currentStatus
            } else {
                this.notifyError(aStatus, aDetail); // will set currentStatus
            }
            this.notifyError(aOperationType == Components.interfaces.calIOperationListener.GET
                             ? Components.interfaces.calIErrors.READ_FAILED
                             : Components.interfaces.calIErrors.MODIFICATION_FAILED,
                             "");
        }
    },

    // for convenience also callable with just an exception
    notifyError: function cPB_notifyError(aErrNo, aMessage) {
        if (aErrNo == Components.interfaces.calIErrors.OPERATION_CANCELLED) {
            return; // cancellation doesn't change current status, no notification
        }
        if (aErrNo instanceof Components.interfaces.nsIException) {
            if (!aMessage) {
                aMessage = aErrNo.message;
            }
            aErrNo = aErrNo.result;
        }
        this.setProperty("currentStatus", aErrNo);
        this.observers.notify("onError", [this.superCalendar, aErrNo, aMessage]);
    },

    mTransientPropertiesMode: false,
    get transientProperties cPB_transientProperties() {
        return this.mTransientPropertiesMode;
    },
    set transientProperties cPB_transientProperties(value) {
        return (this.mTransientPropertiesMode = value);
    },

    // nsIVariant getProperty(in AUTF8String aName);
    getProperty: function cPB_getProperty(aName) {
        switch (aName) {
            case "itip.transport": // iTIP/iMIP default:
                return cal.getImipTransport(this);
            case "itip.notify-replies": // iTIP/iMIP default:
                 return cal.getPrefSafe("calendar.itip.notify-replies", false);
            // temporary hack to get the uncached calendar instance:
            case "cache.uncachedCalendar":
                return this;
        }

        let ret = this.mProperties[aName];
        if (ret === undefined) {
            ret = null;
            switch (aName) {
                case "imip.identity": // we want to cache the identity object a little, because
                                      // it is heavily used by the invitation checks
                    ret = cal.getEmailIdentityOfCalendar(this);
                    break;
                case "imip.account": {
                    let outAccount = {};
                    if (cal.getEmailIdentityOfCalendar(this, outAccount)) {
                        ret = outAccount.value;
                    }
                    break;
                }
                case "organizerId": { // itip/imip default: derived out of imip.identity
                    let identity = this.getProperty("imip.identity");
                    ret = (identity
                           ? ("mailto:" + identity.QueryInterface(Components.interfaces.nsIMsgIdentity).email)
                           : null);
                    break;
                }
                case "organizerCN": { // itip/imip default: derived out of imip.identity
                    let identity = this.getProperty("imip.identity");
                    ret = (identity
                           ? identity.QueryInterface(Components.interfaces.nsIMsgIdentity).fullName
                           : null);
                    break;
                }
            }
            if ((ret === null) &&
                !cal.ProviderBase.mTransientProperties[aName] &&
                !this.transientProperties) {
                if (this.id) {
                    ret = cal.getCalendarManager().getCalendarPref_(this, aName);
                }
                if (ret !== null) {
                    switch (aName) {
                        case "suppressAlarms":
                            if (this.getProperty("capabilities.alarms.popup.supported") === false) {
                                // If popup alarms are not supported,
                                // automatically suppress alarms
                                ret = true;
                            }
                            break;
                    }
                }
            }
            this.mProperties[aName] = ret;
        }
//         cal.LOG("getProperty(\"" + aName + "\"): " + ret);
        return ret;
    },

    // void setProperty(in AUTF8String aName, in nsIVariant aValue);
    setProperty: function cPB_setProperty(aName, aValue) {
        let oldValue = this.getProperty(aName);
        if (oldValue != aValue) {
            this.mProperties[aName] = aValue;
            switch (aName) {
                case "imip.identity.key": // invalidate identity and account object if key is set:
                    delete this.mProperties["imip.identity"];
                    delete this.mProperties["imip.account"];
                    delete this.mProperties["organizerId"];
                    delete this.mProperties["organizerCN"];
                    break;
            }
            if (!this.transientProperties &&
                !cal.ProviderBase.mTransientProperties[aName] &&
                this.id) {
                cal.getCalendarManager().setCalendarPref_(this, aName, aValue);
            }
            this.mObservers.notify("onPropertyChanged",
                                   [this.superCalendar, aName, aValue, oldValue]);
        }
        return aValue;
    },

    // void deleteProperty(in AUTF8String aName);
    deleteProperty: function cPB_deleteProperty(aName) {
        this.mObservers.notify("onPropertyDeleting", [this.superCalendar, aName]);
        delete this.mProperties[aName];
        cal.getCalendarManager().deleteCalendarPref_(this, aName);
    },

    // calIOperation refresh
    refresh: function cPB_refresh() {
        return null;
    },

    // void addObserver( in calIObserver observer );
    addObserver: function cPB_addObserver(aObserver) {
        this.mObservers.add(aObserver);
    },

    // void removeObserver( in calIObserver observer );
    removeObserver: function cPB_removeObserver(aObserver) {
        this.mObservers.remove(aObserver);
    },

    // calISchedulingSupport: Implementation corresponding to our iTIP/iMIP support
    isInvitation: function cPB_isInvitation(aItem) {
        let id = this.getProperty("organizerId");
        if (id) {
            let org = aItem.organizer;
            if (!org || (org.id.toLowerCase() == id.toLowerCase())) {
                return false;
            }
            return (aItem.getAttendeeById(id) != null);
        }
        return false;
    },

    getInvitedAttendee: function cPB_getInvitedAttendee(aItem) {
        let id = this.getProperty("organizerId");
        return (id ? aItem.getAttendeeById(id) : null);
    },

    canNotify: function cPB_canNotify(aMethod, aItem) {
        return false; // use outbound iTIP for all
    }
};
