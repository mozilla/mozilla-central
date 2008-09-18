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
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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
 * Gets the configured identity and account of a particular calendar instance, or null.
 *
 * @param aCalendar     Calendar instance
 * @param outAccount    Optional out value for account
 * @return              The configured identity
 */
function calGetEmailIdentityOfCalendar(aCalendar, outAccount) {
    ASSERT(aCalendar, "no calendar!", Components.results.NS_ERROR_INVALID_ARG);
    if (isSunbird()) {
        return null;
    }
    var key = aCalendar.getProperty("imip.identity.key");
    if (key !== null) {
        if (key.length == 0) { // i.e. "None"
            return null;
        }
        var identity = null;
        calIterateEmailIdentities(
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
            WARN("Calendar " + (aCalendar.uri ? aCalendar.uri.spec : aCalendar.id) +
                 " has a dangling E-Mail identity configured.");
        }
        return identity;
    } else { // take default account/identity:

        var accounts = getAccountManager().accounts;
        var account = null;
        var identity = null;
        try {
            account = getAccountManager().defaultAccount;
        } catch (exc) {}

        for (var i = 0; accounts && (i < accounts.Count()) && (!account || !identity); ++i) {
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
}

function calProviderBase() {
    ASSERT("This prototype should only be inherited!");
}
calProviderBase.mTransientProperties = {};
["cache.uncachedCalendar", "currentStatus",
 "itip.transport", "imip.identity", "imip.account",
 "imip.identity.disabled", "organizerId", "organizerCN"].forEach(
    function(prop) {
        calProviderBase.mTransientProperties[prop] = true;
    });

calProviderBase.prototype = {
    QueryInterface: function cPB_QueryInterface(aIID) {
        return doQueryInterface(this, calProviderBase.prototype, aIID,
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
        this.mObservers = new calListenerBag(Components.interfaces.calIObserver);
        this.mProperties = {};
        this.mProperties.currentStatus = Components.results.NS_OK;
    },

    get observers() {
        return this.mObservers;
    },

    // attribute AUTF8String id;
    get id() {
        return this.mID;
    },
    set id(aValue) {
        if (this.mID) {
            throw Components.results.NS_ERROR_ALREADY_INITIALIZED;
        }
        this.mID = aValue;

//         ASSERT(this.mProperties.toSource() == "({})", "setProperty calls before id has been set!");

        // xxx todo: move this code hack when migrating storage prefs to moz prefs,
        //           presumably with bug 378754
        var calMgr = getCalendarManager();
        var this_ = this;
        function takeOverIfNotPresent(oldPref, newPref, dontDeleteOldPref) {
            var val = calMgr.getCalendarPref_(this_, oldPref);
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
    get name() {
        return this.getProperty("name");
    },
    set name(aValue) {
        return this.setProperty("name", aValue);
    },

    // attribute calICalendar superCalendar;
    get superCalendar() {
        // If we have a superCalendar, check this calendar for a superCalendar.
        // This will make sure the topmost calendar is returned
        return (this.mSuperCalendar ? this.mSuperCalendar.superCalendar : this);
    },
    set superCalendar(val) {
        return (this.mSuperCalendar = val);
    },

    // attribute nsIURI uri;
    get uri() {
        return this.mUri;
    },
    set uri(aValue) {
        return (this.mUri = aValue);
    },

    // attribute boolean readOnly;
    get readOnly() {
        return this.getProperty("readOnly");
    },
    set readOnly(aValue) {
        return this.setProperty("readOnly", aValue);
    },

    // readonly attribute boolean canRefresh;
    get canRefresh() {
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
            ASSERT(this.mBatchCount > 0, "unexepcted endBatch!");
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
                ERROR(exc);
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
            case "itip.transport": // itip/imip default:
                return calGetImipTransport(this);
            // temporary hack to get the uncached calendar instance:
            case "cache.uncachedCalendar":
                return this;
        }

        var ret = this.mProperties[aName];
        if (ret === undefined) {
            ret = null;
            switch (aName) {
                case "imip.identity": // we want to cache the identity object a little, because
                                      // it is heavily used by the invitation checks
                    ret = calGetEmailIdentityOfCalendar(this);
                    break;
                case "imip.account": {
                    var outAccount = {};
                    if (calGetEmailIdentityOfCalendar(this, outAccount)) {
                        ret = outAccount.value;
                    }
                    break;
                }
                case "organizerId": { // itip/imip default: derived out of imip.identity
                    var identity = this.getProperty("imip.identity");
                    ret = (identity
                           ? ("mailto:" + identity.QueryInterface(Components.interfaces.nsIMsgIdentity).email)
                           : null);
                    break;
                }
                case "organizerCN": { // itip/imip default: derived out of imip.identity
                    var identity = this.getProperty("imip.identity");
                    ret = (identity
                           ? identity.QueryInterface(Components.interfaces.nsIMsgIdentity).fullName
                           : null);
                    break;
                }
            }
            if ((ret === null) &&
                !calProviderBase.mTransientProperties[aName] &&
                !this.transientProperties) {
                if (this.id) {
                    // xxx future: return getPrefSafe("calendars." + this.id + "." + aName, null);
                    ret = getCalendarManager().getCalendarPref_(this, aName);
                }
                if (ret !== null) {
                    // xxx todo: work around value types here unless we save into the prefs...
                    switch (aName) {
                        case "suppressAlarms":
                            if (this.getProperty("capabilities.alarms.popup.supported") === false) {
                                // If popup alarms are not supported,
                                // automatically suppress alarms
                                ret = true;
                                break;
                            }
                            // Otherwise fall through to fix the type
                        case "readOnly":
                        case "disabled":
                        case "relaxedMode":
                        case "cache.supported":
                        case "cache.enabled":
                        case "calendar-main-in-composite":
                        case "calendar-main-default":
                            ret = (ret == "true");
                            break;
                        case "backup-time":
                        case "cache.updateTimer":
                            ret = Number(ret);
                            break;
                    }
                }
            }
            this.mProperties[aName] = ret;
        }
//         LOG("getProperty(\"" + aName + "\"): " + ret);
        return ret;
    },

    // void setProperty(in AUTF8String aName, in nsIVariant aValue);
    setProperty: function cPB_setProperty(aName, aValue) {
        var oldValue = this.getProperty(aName);
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
                !calProviderBase.mTransientProperties[aName] &&
                this.id) {
                var v = aValue;
                // xxx todo: work around value types here unless we save into the prefs...
                switch (aName) {
                case "readOnly":
                case "disabled":
                case "relaxedMode":
                case "cache.supported":
                case "cache.enabled":
                case "suppressAlarms":
                case "calendar-main-in-composite":
                case "calendar-main-default":
                    v = (v ? "true" : "false");
                    break;
//                 case "backup-time":
//                 case "cache.updateTimer":
//                     break;
                }
                // xxx future: setPrefSafe("calendars." + this.id + "." + aName, aValue);
                getCalendarManager().setCalendarPref_(this, aName, v);
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
        getCalendarManager().deleteCalendarPref_(this, aName);
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
        var id = this.getProperty("organizerId");
        if (id) {
            var org = aItem.organizer;
            if (!org || (org.id.toLowerCase() == id.toLowerCase())) {
                return false;
            }
            return (aItem.getAttendeeById(id) != null);
        }
        return false;
    },

    getInvitedAttendee: function cPB_getInvitedAttendee(aItem) {
        var id = this.getProperty("organizerId");
        return (id ? aItem.getAttendeeById(id) : null);
    },

    canNotify: function cPB_canNotify(aMethod, aItem) {
        return false; // use outbound iTIP for all
    }
};
