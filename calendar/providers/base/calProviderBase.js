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
                                 Components.interfaces.calICalendar]);
    },

    mID: null,
    mUri: null,
    mObservers: null,
    mReadOnly: false,

    initProviderBase: function cPB_initProviderBase() {
        this.wrappedJSObject = this;
        this.mObservers = new calListenerBag(Components.interfaces.calIObserver);
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
        return (this.mID = aValue);
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

    // nsIVariant getProperty(in AUTF8String aName);
    getProperty: function cPB_getProperty(aName) {
        switch (aName) {
            case "readOnly":
                return this.mReadOnly;
            default:
                // xxx future: return getPrefSafe("calendars." + this.id + "." + aName, null);
                return getCalendarManager().getCalendarPref_(this, aName);
        }
    },

    // void setProperty(in AUTF8String aName, in nsIVariant aValue);
    setProperty: function cPB_setProperty(aName, aValue) {
        var oldValue = this.getProperty(aName);
        if (oldValue != aValue) {
            switch (aName) {
                case "readOnly":
                    this.mReadOnly = aValue;
                    break;
                default:
                    // xxx future: setPrefSafe("calendars." + this.id + "." + aName, aValue);
                    getCalendarManager().setCalendarPref_(this, aName, aValue);
            }
            this.mObservers.notify("onPropertyChanged",
                                   [this, aName, aValue, oldValue]);
        }
        return aValue;
    },

    // void deleteProperty(in AUTF8String aName);
    deleteProperty: function cPB_deleteProperty(aName) {
        this.mObservers.notify("onPropertyDeleting", [this, aName]);
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
    }
};
