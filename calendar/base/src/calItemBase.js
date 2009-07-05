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
 *   Mike Shaver <shaver@off.net>
 *   Joey Minta <jminta@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Martin Schroeder <mschroder@mozilla.x-home.org>
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
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");

/**
 * calItemBase prototype definition
 *
 * @implements calIItemBase
 * @constructor
 */
function calItemBase() {
    cal.ASSERT(false, "Inheriting objects call initItemBase()!");
}

calItemBase.prototype = {
    mPropertyParams: null,
    mIsProxy: false,
    mAlarms: null,
    mHashId: null,
    mImmutable: false,
    mDirty: false,
    mAlarmLastAck: null,
    mCalendar: null,

    /**
     * Initialize the base item's attributes. Can be called from inheriting
     * objects in their constructor.
     */
    initItemBase: function cIB_initItemBase() {
        this.wrappedJSObject = this;
        this.mProperties = new calPropertyBag();
        this.mPropertyParams = {};
        this.mProperties.setProperty("CREATED", jsDateToDateTime(new Date()));
    },

    /**
     * @see nsISupports
     */
    QueryInterface: function cIB_QueryInterface(aIID) {
        return doQueryInterface(this, calItemBase.prototype, aIID,
                                [Components.interfaces.calIItemBase]);
    },

    /**
     * @see calIItemBase
     */

    // readonly attribute AUTF8String hashId;
    get hashId cIB_get_hashId() {
        if (this.mHashId === null) {
            var rid = this.recurrenceId;
            var cal = this.calendar;
            // some unused delim character:
            this.mHashId = [encodeURIComponent(this.id),
                            rid ? rid.getInTimezone(UTC()).icalString : "",
                            cal ? encodeURIComponent(cal.id) : ""].join("#");
        }
        return this.mHashId;
    },

    // attribute AUTF8String id;
    get id cIB_get_id() {
        return this.getProperty("UID");
    },
    set id cIB_set_id(uid) {
        this.mHashId = null; // recompute hashId
        this.setProperty("UID", uid);
        if (this.mRecurrenceInfo) {
            this.mRecurrenceInfo.onIdChange(uid);
        }
        return uid;
    },

    // attribute calIDateTime recurrenceId;
    get recurrenceId cIB_get_recurrenceId() {
        return this.getProperty("RECURRENCE-ID");
    },
    set recurrenceId cIB_set_recurrenceId(rid) {
        this.mHashId = null; // recompute hashId
        return this.setProperty("RECURRENCE-ID", rid);
    },

    // attribute calIRecurrenceInfo recurrenceInfo;
    get recurrenceInfo cIB_get_recurrenceInfo() {
        return this.mRecurrenceInfo;
    },
    set recurrenceInfo cIB_set_recurrenceInfo(value) {
        this.modify();
        return (this.mRecurrenceInfo = calTryWrappedJSObject(value));
    },

    // attribute calIItemBase parentItem;
    mParentItem: null,
    get parentItem cIB_get_parentItem() {
        return (this.mParentItem || this);
    },
    set parentItem cIB_set_parentItem(value) {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        return (this.mParentItem = calTryWrappedJSObject(value));
    },

    /**
     * Initializes the base item to be an item proxy. Used by inheriting
     * objects createProxy() method.
     *
     * XXXdbo Explain proxy a bit better, either here or in
     * calIInternalShallowCopy.
     *
     * @see calIInternalShallowCopy
     * @param aParentItem     The parent item to initialize the proxy on.
     * @param aRecurrenceId   The recurrence id to initialize the proxy for.
     */
    initializeProxy: function cib_initializeProxy(aParentItem, aRecurrenceId) {
        this.mIsProxy = true;

        aParentItem = calTryWrappedJSObject(aParentItem);
        this.mParentItem = aParentItem;
        this.mCalendar = aParentItem.mCalendar;
        this.recurrenceId = aRecurrenceId;

        this.mImmutable = aParentItem.mImmutable;
    },

    // readonly attribute boolean isMutable;
    get isMutable cIB_get_isMutable() { return !this.mImmutable; },

    /**
     * This function should be called by all members that modify the item. It
     * checks if the item is immutable and throws accordingly, and sets the
     * mDirty property.
     */
    modify: function cIB_modify() {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        this.mDirty = true;
    },

    /**
     * Makes sure the item is not dirty. If the item is dirty, properties like
     * LAST-MODIFIED and DTSTAMP are set to now.
     */
    ensureNotDirty: function cIB_ensureNotDirty() {
        if (this.mDirty) {
            let now = jsDateToDateTime(new Date());
            this.setProperty("LAST-MODIFIED", now);
            this.setProperty("DTSTAMP", now);
            this.mDirty = false;
        }
    },

    /**
     * Makes all properties of the base item immutable. Can be called by
     * inheriting objects' makeImmutable method.
     */
    makeItemBaseImmutable: function cIB_makeItemBaseImmutable() {
        if (this.mImmutable) {
            return;
        }

        // make all our components immutable
        if (this.mRecurrenceInfo)
            this.mRecurrenceInfo.makeImmutable();

        if (this.mOrganizer)
            this.mOrganizer.makeImmutable();
        if (this.mAttendees) {
            for each (let att in this.mAttendees) {
                att.makeImmutable();
            }
        }

        for each (let [propKey, propValue] in this.mProperties) {
            if (propValue instanceof Components.interfaces.calIDateTime &&
                propValue.isMutable) {
                propValue.makeImmutable();
            }
        }

        if (this.mAlarms) {
            for each (let alarm in this.mAlarms) {
                alarm.makeImmutable();
            }
        }

        if (this.mAlarmLastAck) {
            this.mAlarmLastAck.makeImmutable();
        }

        this.ensureNotDirty();
        this.mImmutable = true;
    },

     // boolean hasSameIds(in calIItemBase aItem);
    hasSameIds: function cIB_hasSameIds(that) {
        return (that && this.id == that.id &&
                (this.recurrenceId == that.recurrenceId || // both null
                 (this.recurrenceId && that.recurrenceId &&
                  this.recurrenceId.compare(that.recurrenceId) == 0)));
    },

    // calIItemBase clone();
    clone: function cIB_clone() {
        return this.cloneShallow(this.mParentItem);
    },

    /**
     * Clones the base item's properties into the passed object, potentially
     * setting a new parent item.
     *
     * @param m     The item to clone this item into
     * @param aNewParent    (optional) The new parent item to set on m.
     */
    cloneItemBaseInto: function cIB_cloneItemBaseInto(m, aNewParent) {
        m.mImmutable = false;
        m.mIsProxy = this.mIsProxy;
        m.mParentItem = (calTryWrappedJSObject(aNewParent) || this.mParentItem);
        m.mHashId = this.mHashId;
        m.mCalendar = this.mCalendar;
        if (this.mRecurrenceInfo) {
            m.mRecurrenceInfo = calTryWrappedJSObject(this.mRecurrenceInfo.clone());
            m.mRecurrenceInfo.item = m;
        }

        let org = this.organizer;
        if (org) {
            org = org.clone();
        }
        m.mOrganizer = org;

        m.mAttendees = [];
        for each (let att in this.getAttendees({})) {
            m.mAttendees.push(att.clone());
        }

        m.mProperties = new calPropertyBag();
        for each (let [name, value] in this.mProperties) {
            if (value instanceof Components.interfaces.calIDateTime) {
                value = value.clone();
            }

            m.mProperties.setProperty(name, value);

            let propBucket = this.mPropertyParams[name];
            if (propBucket) {
                let newBucket = {};
                for (let param in propBucket) {
                    newBucket[param] = propBucket[param];
                }
                m.mPropertyParams[name] = newBucket;
            }
        }

        m.mAttachments = [];
        for each (let att in this.getAttachments({})) {
            m.mAttachments.push(att.clone());
        }

        m.mRelations = [];
        for each (let rel in this.getRelations({})) {
            m.mRelations.push(rel.clone());
        }

        m.mCategories = this.getCategories({});

        m.mAlarms = [];
        for each (let alarm in this.getAlarms({})) {
            // Clone alarms into new item, assume the alarms from the old item
            // are valid and don't need validation.
            m.mAlarms.push(alarm.clone());
        }

        let alarmLastAck = this.alarmLastAck;
        if (alarmLastAck) {
            alarmLastAck = alarmLastAck.clone();
        }
        m.mAlarmLastAck = alarmLastAck;

        m.mDirty = this.mDirty;

        return m;
    },

    // attribute calIDateTime alarmLastAck;
    get alarmLastAck cIB_get_alarmLastAck() {
        return this.mAlarmLastAck;
    },
    set alarmLastAck cIB_set_alarmLastAck(aValue) {
        this.modify();
        if (aValue && !aValue.timezone.isUTC) {
            aValue = aValue.getInTimezone(UTC());
        }
        return (this.mAlarmLastAck = aValue);
    },

    // readonly attribute calIDateTime lastModifiedTime;
    get lastModifiedTime cIB_get_lastModifiedTime() {
        this.ensureNotDirty();
        return this.getProperty("LAST-MODIFIED");
    },

    // readonly attribute calIDateTime stampTime;
    get stampTime cIB_get_stampTime() {
        this.ensureNotDirty();
        return this.getProperty("DTSTAMP");
    },

    // readonly attribute nsISimpleEnumerator propertyEnumerator;
    get propertyEnumerator cIB_get_propertyEnumerator() {
        if (this.mIsProxy) {
            cal.ASSERT(this.parentItem != this);
            return { // nsISimpleEnumerator:
                mProxyEnum: this.mProperties.enumerator,
                mParentEnum: this.mParentItem.propertyEnumerator,
                mHandledProps: { },
                mCurrentProp: null,

                hasMoreElements: function cib_pe_hasMoreElements() {
                    if (this.mCurrentProp) {
                        return true;
                    }
                    if (this.mProxyEnum) {
                        while (this.mProxyEnum.hasMoreElements()) {
                            var prop = this.mProxyEnum.getNext();
                            this.mHandledProps[prop.name] = true;
                            if (prop.value !== null) {
                                this.mCurrentProp = prop;
                                return true;
                            } // else skip the deleted properties
                        }
                        this.mProxyEnum = null;
                    }
                    while (this.mParentEnum.hasMoreElements()) {
                        var prop = this.mParentEnum.getNext();
                        if (!this.mHandledProps[prop.name]) {
                            this.mCurrentProp = prop;
                            return true;
                        }
                    }
                    return false;
                },

                getNext: function cib_pe_getNext() {
                    if (!this.hasMoreElements()) { // hasMoreElements is called by intention to skip yet deleted properties
                        cal.ASSERT(false, Components.results.NS_ERROR_UNEXPECTED);
                        throw Components.results.NS_ERROR_UNEXPECTED;
                    }
                    var ret = this.mCurrentProp;
                    this.mCurrentProp = null;
                    return ret;
                }
            };
        } else {
            return this.mProperties.enumerator;
        }
    },

    // nsIVariant getProperty(in AString name);
    getProperty: function cIB_getProperty(aName) {
        aName = aName.toUpperCase();
        var aValue = this.mProperties.getProperty_(aName);
        if (aValue === undefined) {
            aValue = (this.mIsProxy ? this.mParentItem.getProperty(aName) : null);
        }
        return aValue;
    },

    // boolean hasProperty(in AString name);
    hasProperty: function cIB_hasProperty(aName) {
        return (this.getProperty(aName.toUpperCase()) != null);
    },

    // void setProperty(in AString name, in nsIVariant value);
    setProperty: function cIB_setProperty(aName, aValue) {
        this.modify();
        aName = aName.toUpperCase();
        if (aValue || !isNaN(parseInt(aValue, 10))) {
            this.mProperties.setProperty(aName, aValue);
        } else {
            this.deleteProperty(aName);
        }
        if (aName == "LAST-MODIFIED") {
            // setting LAST-MODIFIED cleans/undirties the item, we use this for preserving DTSTAMP
            this.mDirty = false;
        }
    },

    // void deleteProperty(in AString name);
    deleteProperty: function cIB_deleteProperty(aName) {
        this.modify();
        aName = aName.toUpperCase();
        if (this.mIsProxy) {
            // deleting a proxy's property will mark the bag's item as null, so we could
            // distinguish it when enumerating/getting properties from the undefined ones.
            this.mProperties.setProperty(aName, null);
        } else {
            this.mProperties.deleteProperty(aName);
        }
    },

    // AString getPropertyParameter(in AString aPropertyName,
    getPropertyParameter: function getPP(aPropName, aParamName) {
        return this.mPropertyParams[aPropName][aParamName];
    },

    // void getAttendees(out PRUint32 count,
    //                   [array,size_is(count),retval] out calIAttendee attendees);
    getAttendees: function cIB_getAttendees(countObj) {
        if (!this.mAttendees && this.mIsProxy) {
            this.mAttendees = this.mParentItem.getAttendees(countObj);
        }
        if (this.mAttendees) {
            countObj.value = this.mAttendees.length;
            return this.mAttendees.concat([]); // clone
        }
        else {
            countObj.value = 0;
            return [];
        }
    },

    // calIAttendee getAttendeeById(in AUTF8String id);
    getAttendeeById: function cIB_getAttendeeById(id) {
        var attendees = this.getAttendees({});
        var lowerCaseId = id.toLowerCase();
        for each (var attendee in attendees) {
            // This match must be case insensitive to deal with differing
            // cases of things like MAILTO:
            if (attendee.id.toLowerCase() == lowerCaseId) {
                return attendee;
            }
        }
        return null;
    },

    // void removeAttendee(in calIAttendee attendee);
    removeAttendee: function cIB_removeAttendee(attendee) {
        this.modify();
        var found = false, newAttendees = [];
        var attendees = this.getAttendees({});
        var attIdLowerCase = attendee.id.toLowerCase();

        for (var i = 0; i < attendees.length; i++) {
            if (attendees[i].id.toLowerCase() != attIdLowerCase) {
                newAttendees.push(attendees[i]);
            } else {
                found = true;
            }
        }
        if (found) {
            this.mAttendees = newAttendees;
        }
    },

    // void removeAllAttendees();
    removeAllAttendees: function cIB_removeAllAttendees() {
        this.modify();
        this.mAttendees = [];
    },

    // void addAttendee(in calIAttendee attendee);
    addAttendee: function cIB_addAttendee(attendee) {
        this.modify();
        this.mAttendees = this.getAttendees({});
        this.mAttendees.push(attendee);
        // XXX ensure that the attendee isn't already there?
    },

    // void getAttachments(out PRUint32 count,
    //                     [array,size_is(count),retval] out calIAttachment attachments);
    getAttachments: function cIB_getAttachments(aCount) {
        if (!this.mAttachments && this.mIsProxy) {
            this.mAttachments = this.mParentItem.getAttachments(aCount);
        }
        if (this.mAttachments) {
            aCount.value = this.mAttachments.length;
            return this.mAttachments.concat([]); // clone
        } else {
            aCount.value = 0;
            return [];
        }
    },

    // void removeAttachment(in calIAttachment attachment);
    removeAttachment: function cIB_removeAttachment(aAttachment) {
        this.modify();
        for (var attIndex in this.mAttachments) {
            if (cal.compareObjects(mAttachments[attIndex], aAttachment, Components.interfaces.calIAttachment)) {
                this.modify();
                this.mAttachments.splice(attIndex, 1);
                break;
            }
        }
    },

    // void addAttachment(in calIAttachment attachment);
    addAttachment: function cIB_addAttachment(attachment) {
        this.modify();
        this.mAttachments = this.getAttachments({});
        this.mAttachments.push(attachment);
        // XXX ensure that the attachment isn't already there?
    },

    // void removeAllAttachments();
    removeAllAttachments: function cIB_removeAllAttachments() {
        this.modify();
        this.mAttachments = [];
    },

    // void getRelations(out PRUint32 count,
    //                   [array,size_is(count),retval] out calIRelation relations);
    getRelations: function cIB_getRelations(aCount) {
        if (!this.mRelations && this.mIsProxy) {
            this.mRelations = this.mParentItem.getRelations(aCount);
        }
        if (this.mRelations) {
            aCount.value = this.mRelations.length;
            return this.mRelations.concat([]);
        } else {
            aCount.value = 0;
            return [];
        }
    },

    // void removeRelation(in calIRelation relation);
    removeRelation: function cIB_removeRelation(aRelation) {
        this.modify();
        for (var attIndex in this.mRelations) {
            // Could we have the same item as parent and as child ?
            if (this.mRelations[attIndex].relId == aRelation.relId &&
                this.mRelations[attIndex].relType == aRelation.relType) {
                this.modify();
                this.mRelations.splice(attIndex, 1);
                break;
            }
        }
    },

    // void addRelation(in calIRelation relation);
    addRelation: function cIB_addRelation(aRelation) {
        this.modify();
        this.mRelations = this.getRelations({});
        this.mRelations.push(aRelation);
        // XXX ensure that the relation isn't already there?
    },

    // void removeAllRelations();
    removeAllRelations: function cIB_removeAllRelations() {
        this.modify();
        this.mRelations = [];
    },

    // attribute calICalendar calendar;
    get calendar cIB_get_calendar() {
        if (!this.mCalendar && (this.parentItem != this)) {
            return this.parentItem.calendar;
        } else {
            return this.mCalendar;
        }
    },
    set calendar cIB_set_calendar(v) {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        this.mHashId = null; // recompute hashId
        this.mCalendar = v;
    },

    // attribute calIAttendee organizer;
    get organizer cIB_get_organizer() {
        if (this.mIsProxy && (this.mOrganizer === undefined)) {
            return this.mParentItem.organizer;
        } else {
            return this.mOrganizer;
        }
    },
    set organizer cIB_set_organizer(v) {
        this.modify();
        this.mOrganizer = v;
    },

    // void getCategories(out PRUint32 aCount,
    //                    [array, size_is(aCount), retval] out wstring aCategories);
    getCategories: function cib_getCategories(aCount) {
        if (!this.mCategories && this.mIsProxy) {
            this.mCategories = this.mParentItem.getCategories(aCount);
        }
        if (this.mCategories) {
            aCount.value = this.mCategories.length;
            return this.mCategories.concat([]); // clone
        } else {
            aCount.value = 0;
            return [];
        }
    },

    // void setCategories(in PRUint32 aCount,
    //                    [array, size_is(aCount)] in wstring aCategories);
    setCategories: function cib_setCategories(aCount, aCategories) {
        this.mCategories = aCategories.concat([]);
    },

    // attribute AUTF8String icalString;
    get icalString cIB_get_icalString() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set icalString cIB_set_icalString() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    /**
     * The map of promoted properties is a list of those properties that are
     * represented directly by getters/setters.
     * All of these property names must be in upper case isPropertyPromoted to
     * function correctly. The has/get/set/deleteProperty interfaces
     * are case-insensitive, but these are not.
     */
    itemBasePromotedProps: {
        "CREATED": true,
        "UID": true,
        "LAST-MODIFIED": true,
        "SUMMARY": true,
        "PRIORITY": true,
        "STATUS": true,
        "DTSTAMP": true,
        "RRULE": true,
        "EXDATE": true,
        "RDATE": true,
        "ATTENDEE": true,
        "ATTACH": true,
        "CATEGORIES": true,
        "ORGANIZER": true,
        "RECURRENCE-ID": true,
        "X-MOZ-LASTACK": true
    },

    /**
     * A map of properties that need translation between the ical component
     * property and their ICS counterpart.
     */
    icsBasePropMap: [
        { cal: "CREATED", ics: "createdTime" },
        { cal: "LAST-MODIFIED", ics: "lastModified" },
        { cal: "DTSTAMP", ics: "stampTime" },
        { cal: "UID", ics: "uid" },
        { cal: "SUMMARY", ics: "summary" },
        { cal: "PRIORITY", ics: "priority" },
        { cal: "STATUS", ics: "status" },
        { cal: "RECURRENCE-ID", ics: "recurrenceId" }
    ],

    /**
     * Walks through the propmap and sets all properties on this item from the
     * given icalcomp.
     *
     * @param icalcomp      The calIIcalComponent to read from.
     * @param propmap       The property map to walk through.
     */
    mapPropsFromICS: function cIB_mapPropsFromICS(icalcomp, propmap) {
        for (var i = 0; i < propmap.length; i++) {
            var prop = propmap[i];
            var val = icalcomp[prop.ics];
            if (val != null && val != Components.interfaces.calIIcalComponent.INVALID_VALUE)
                this.setProperty(prop.cal, val);
        }
    },

    /**
     * Walks through the propmap and sets all properties on the given icalcomp
     * from the properties set on this item.
     * given icalcomp.
     *
     * @param icalcomp      The calIIcalComponent to write to.
     * @param propmap       The property map to walk through.
     */
    mapPropsToICS: function cIB_mapPropsToICS(icalcomp, propmap) {
        for (var i = 0; i < propmap.length; i++) {
            var prop = propmap[i];
            var val = this.getProperty(prop.cal);
            if (val != null && val != Components.interfaces.calIIcalComponent.INVALID_VALUE)
                icalcomp[prop.ics] = val;
        }
    },


    /**
     * Reads an ical component and sets up the base item's properties to match
     * it.
     *
     * @param icalcomp      The ical component to read.
     */
    setItemBaseFromICS: function cIB_setItemBaseFromICS(icalcomp) {
        this.modify();

        // re-initializing from scratch -- no light proxy anymore:
        this.mIsProxy = false;
        this.mProperties = new calPropertyBag();
        this.mPropertyParams = {};

        this.mapPropsFromICS(icalcomp, this.icsBasePropMap);

        this.mAttendees = []; // don't inherit anything from parent
        for (let attprop in cal.ical.propertyIterator(icalcomp, "ATTENDEE")) {
            let att = new calAttendee();
            att.icalProperty = attprop;
            this.addAttendee(att);
        }

        this.mAttachments = []; // don't inherit anything from parent
        for (let attprop in cal.ical.propertyIterator(icalcomp, "ATTACH")) {
            let att = new calAttachment();
            att.icalProperty = attprop;
            this.addAttachment(att);
        }

        this.mRelations = []; // don't inherit anything from parent
        for (let relprop in cal.ical.propertyIterator(icalcomp, "RELATED-TO")) {
            let rel = new calRelation();
            rel.icalProperty = relprop;
            this.addRelation(rel);
        }

        let org = null;
        let orgprop = icalcomp.getFirstProperty("ORGANIZER");
        if (orgprop) {
            org = new calAttendee();
            org.icalProperty = orgprop;
            org.isOrganizer = true;
        }
        this.mOrganizer = org;

        this.mCategories = [ catprop.value for (catprop in cal.ical.propertyIterator(icalcomp, "CATEGORIES")) ];

        // find recurrence properties
        let rec = null;
        if (!this.recurrenceId) {
            for (let recprop in cal.ical.propertyIterator(icalcomp)) {
                let ritem = null;
                switch (recprop.propertyName) {
                    case "RRULE":
                    case "EXRULE":
                        ritem = new CalRecurrenceRule();
                        break;
                    case "RDATE":
                    case "EXDATE":
                        ritem = new CalRecurrenceDate();
                        break;
                    default:
                        continue;
                }
                ritem.icalProperty = recprop;

                if (!rec) {
                    rec = new calRecurrenceInfo();
                    rec.item = this;
                }
                rec.appendRecurrenceItem(ritem);
            }
        }
        this.mRecurrenceInfo = rec;

        this.mAlarms = []; // don't inherit anything from parent
        for (let alarmComp in cal.ical.subcomponentIterator(icalcomp, "VALARM")) {
            let alarm = cal.createAlarm();
            try {
                alarm.icalComponent = alarmComp;
                this.addAlarm(alarm, true);
            } catch (e) {
                cal.ERROR("Invalid alarm for item: " +
                          this.id + " (" +
                          alarmComp.serializeToICS() + ")" +
                          " exception: " + e);
            }
        }

        let lastAck = icalcomp.getFirstProperty("X-MOZ-LASTACK");
        this.mAlarmLastAck = null;
        if (lastAck) {
            this.mAlarmLastAck = cal.createDateTime(lastAck.value);
        }

        this.mDirty = false;
    },

    /**
     * Import all properties not in the promoted map into this item's extended
     * properties bag.
     *
     * @param icalcomp      The ical component to read.
     * @param promoted      The map of promoted properties.
     */
    importUnpromotedProperties: function cIB_importUnpromotedProperties(icalcomp, promoted) {
        for (let prop in cal.ical.propertyIterator(icalcomp)) {
            let propName = prop.propertyName;
            if (!promoted[propName]) {
                this.setProperty(propName, prop.value);
                for each (let [paramName, paramValue] in cal.ical.paramIterator(prop)) {
                    if (!(propName in this.mPropertyParams)) {
                        this.mPropertyParams[propName] = {};
                    }
                    this.mPropertyParams[propName][paramName] = paramValue;
                }
            }
        }
    },

    // boolean isPropertyPromoted(in AString name);
    isPropertyPromoted: function cIB_isPropertyPromoted(name) {
        return (this.itemBasePromotedProps[name.toUpperCase()]);
    },

    // attribute calIIcalComponent icalComponent;
    get icalComponent cIB_get_icalComponent() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },
    set icalComponent cIB_set_icalComponent() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    // attribute PRUint32 generation;
    get generation cIB_get_generation() {
        let gen = this.getProperty("X-MOZ-GENERATION");
        return (gen ? parseInt(gen, 10) : 0);
    },
    set generation cIB_set_generation(aValue) {
        return this.setProperty("X-MOZ-GENERATION", String(aValue));
    },

    /**
     * Fills the passed ical component with the base item's properties.
     *
     * @param icalcomp    The ical component to write to.
     */
    fillIcalComponentFromBase: function cIB_fillIcalComponentFromBase(icalcomp) {
        this.ensureNotDirty();
        let icssvc = cal.getIcsService();

        this.mapPropsToICS(icalcomp, this.icsBasePropMap);

        let org = this.organizer;
        if (org) {
            icalcomp.addProperty(org.icalProperty);
        }

        for each (let attendee in this.getAttendees({})) {
            icalcomp.addProperty(attendee.icalProperty);
        }

        for each (let attachment in this.getAttachments({})) {
            icalcomp.addProperty(attachment.icalProperty);
        }

        for each (let relation in this.getRelations({})) {
            icalcomp.addProperty(relation.icalProperty);
        }

        if (this.mRecurrenceInfo) {
            for each (let ritem in this.mRecurrenceInfo.getRecurrenceItems({})) {
                icalcomp.addProperty(ritem.icalProperty);
            }
        }

        for each (let cat in this.getCategories({})) {
            let catprop = icssvc.createIcalProperty("CATEGORIES");
            catprop.value = cat;
            icalcomp.addProperty(catprop);
        }

        for each (let alarm in this.mAlarms) {
            icalcomp.addSubcomponent(alarm.icalComponent);
        }

        let alarmLastAck = this.alarmLastAck;
        if (alarmLastAck) {
            let lastAck = cal.getIcsService().createIcalProperty("X-MOZ-LASTACK");
            // - should we further ensure that those are UTC or rely on calAlarmService doing so?
            lastAck.value = alarmLastAck.icalString;
            icalcomp.addProperty(lastAck);
        }
    },

    // void getAlarms(out PRUint32 count, [array, size_is(count), retval] out calIAlarm aAlarms);
    getAlarms: function cIB_getAlarms(aCount) {
        if (typeof aCount != "object") {
            throw Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT;
        }

        if (!this.mAlarms && this.mIsProxy) {
            this.mAlarms = this.mParentItem.getAlarms(aCount);
        }
        if (this.mAlarms) {
            aCount.value = this.mAlarms.length;
            return this.mAlarms.concat([]); // clone
        } else {
            aCount.value = 0;
            return [];
        }
    },

    /**
     * Adds an alarm. The second parameter is for internal use only, i.e not
     * provided on the interface.
     *
     * @see calIItemBase
     * @param aDoNotValidate    Don't serialize the component to check for
     *                            errors.
     */
    addAlarm: function cIB_addAlarm(aAlarm, aDoNotValidate) {
        if (!aDoNotValidate) {
            try {
                // Trigger the icalComponent getter to make sure the alarm is valid.
                aAlarm.icalComponent;
            } catch (e) {
                throw Components.results.NS_ERROR_INVALID_ARG;
            }
        }

        this.modify();
        this.mAlarms = this.getAlarms({});
        this.mAlarms.push(aAlarm);
    },

    // void deleteAlarm(in calIAlarm aAlarm);
    deleteAlarm: function cIB_deleteAlarm(aAlarm) {
        this.modify();
        this.mAlarms = this.getAlarms({});
        for (let i = 0; i < this.mAlarms.length; i++) {
            if (cal.compareObjects(this.mAlarms[i], aAlarm, Components.interfaces.calIAlarm)) {
                this.mAlarms.splice(i, 1);
                break;
            }
        }
    },

    // void clearAlarms();
    clearAlarms: function cIB_clearAlarms() {
        this.modify();
        this.mAlarms = [];
    },

    // void getOccurrencesBetween (in calIDateTime aStartDate, in calIDateTime aEndDate,
    //                             out PRUint32 aCount,
    //                             [array,size_is(aCount),retval] out calIItemBase aOccurrences);
    getOccurrencesBetween: function cIB_getOccurrencesBetween(aStartDate, aEndDate, aCount) {
        if (this.recurrenceInfo) {
            return this.recurrenceInfo.getOccurrences(aStartDate, aEndDate, 0, aCount);
        }

        if (checkIfInRange(this, aStartDate, aEndDate)) {
            aCount.value = 1;
            return [this];
        }

        aCount.value = 0;
        return [];
    }
};

makeMemberAttr(calItemBase, "CREATED", null, "creationDate", true);
makeMemberAttr(calItemBase, "SUMMARY", null, "title", true);
makeMemberAttr(calItemBase, "PRIORITY", 0, "priority", true);
makeMemberAttr(calItemBase, "CLASS", "PUBLIC", "privacy", true);
makeMemberAttr(calItemBase, "STATUS", null, "status", true);
makeMemberAttr(calItemBase, "ALARMTIME", null, "alarmTime", true);

makeMemberAttr(calItemBase, "mProperties", null, "properties");

/**
 * Helper function to add a member attribute on the given prototype
 *
 * @param ctor          The constructor function of the prototype
 * @param varname       The local variable name to get/set, or the property in
 *                        case asProperty is true.
 * @param dflt          The default value in case none is set
 * @param attr          The attribute name to be used
 * @param asProperty    If true, getProperty will be used to get/set the
 *                        member.
 */
function makeMemberAttr(ctor, varname, dflt, attr, asProperty) {
    // XXX handle defaults!
    var getter = function () {
        if (asProperty)
            return this.getProperty(varname);
        else
            return this[varname];
    };
    var setter = function (v) {
        this.modify();
        if (asProperty)
            return this.setProperty(varname, v);
        else
            return (this[varname] = v);
    };
    ctor.prototype.__defineGetter__(attr, getter);
    ctor.prototype.__defineSetter__(attr, setter);
}
