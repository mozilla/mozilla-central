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

function calProviderBase() {
    ASSERT("This prototype should only be inherited!");
}

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

    // readonly attribute boolean sendItipInvitations;
    get sendItipInvitations() {
        return true;
    },

    // void startBatch();
    startBatch: function cPB_startBatch() {
        this.mObservers.notify("onStartBatch");
    },

    endBatch: function cPB_endBatch() {
        this.mObservers.notify("onEndBatch");
    },

    mTransientProperties: {
        currentStatus: true
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

    // nsIVariant getProperty(in AUTF8String aName);
    getProperty: function cPB_getProperty(aName) {
        // temporary hack to get the uncached calendar instance
        if (aName == "cache.uncachedCalendar") {
            return this;
        }

        var ret = this.mProperties[aName];
        if (ret === undefined) {
            ret = null;
            if (!this.mTransientProperties[aName] && this.id) {
                // xxx future: return getPrefSafe("calendars." + this.id + "." + aName, null);
                ret = getCalendarManager().getCalendarPref_(this, aName);
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
        return ret;
    },

    // void setProperty(in AUTF8String aName, in nsIVariant aValue);
    setProperty: function cPB_setProperty(aName, aValue) {
        var oldValue = this.getProperty(aName);
        if (oldValue != aValue) {
            this.mProperties[aName] = aValue;
            if (!this.mTransientProperties[aName] && this.id) {
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
        return this.getInvitedAttendee(aItem) != null;
    },

    // helper function to filter invitations, checks exceptions for invitations:
    itip_checkInvitation: function cPB_itip_checkInvitation(aItem) {
        if (this.isInvitation(aItem)) {
            return true;
        }
        var recInfo = aItem.recurrenceInfo;
        if (recInfo) {
            var this_ = this;
            function checkExc(rid) {
                return this_.isInvitation(recInfo.getExceptionFor(rid, false));
            }
            return recInfo.getExceptionIds({}).some(checkExc);
        }
        return false;
    },

    itip_getInvitedAttendee: function cPB_itip_getInvitedAttendee(aItem) {
        // This is the iTIP specific base implementation for storage and memory,
        // it will mind what account has received the incoming message, e.g.
//         var account = aItem.getProperty("X-MOZ-IMIP-INCOMING-ACCOUNT");
//         if (account) {
//             account = ("mailto:" + account);
//             var att = aItem.getAttendeeById(account);
//             if (att) {
//                 // we take the existing attendee
//                 return att;
//             }
//             // else user may have changed mail accounts, or we has been invited via ml
//             // in any way, we create a new attendee to be added here, which may be
//             // overridden by UI in case that account doesn't exist anymore:
//             att = Components.classes["@mozilla.org/calendar/attendee;1"]
//                             .createInstance(Components.interfaces.calIAttendee);
//             att.participationStatus = "NEEDS-ACTION";
//             att.id = account;
//         }
        // for now not impl
        return null;
    },
    getInvitedAttendee: function cPB_getInvitedAttendee(aItem) {
        return this.itip_getInvitedAttendee(aItem);
    }
};
