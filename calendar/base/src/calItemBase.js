/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
// calItemBase.js
//

function calItemBase() {
    ASSERT(false, "Inheriting objects call initItemBase!");
}

calItemBase.prototype = {
    mPropertyParams: null,
    mIsProxy: false,

    QueryInterface: function (aIID) {
        return doQueryInterface(this, calItemBase.prototype, aIID,
                                [Components.interfaces.calIItemBase]);
    },

    mHashId: null,
    get hashId() {
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

    get id() {
        return this.getProperty("UID");
    },
    set id(uid) {
        this.modify();
        this.mHashId = null; // recompute hashId
        return this.setProperty("UID", uid);
    },

    get recurrenceId() {
        return this.getProperty("RECURRENCE-ID");
    },
    set recurrenceId(rid) {
        this.modify();
        this.mHashId = null; // recompute hashId
        return this.setProperty("RECURRENCE-ID", rid);
    },

    get recurrenceInfo() {
        return this.mRecurrenceInfo;
    },
    set recurrenceInfo(value) {
        this.modify();
        return (this.mRecurrenceInfo = calTryWrappedJSObject(value));
    },

    mParentItem: null,
    get parentItem() {
        if (this.mParentItem)
            return this.mParentItem;
        else
            return this;
    },
    set parentItem(value) {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        return (this.mParentItem = calTryWrappedJSObject(value));
    },

    initializeProxy: function (aParentItem) {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;

        if (this.mParentItem != null)
            throw Components.results.NS_ERROR_FAILURE;

        aParentItem = calTryWrappedJSObject(aParentItem);
        this.mParentItem = aParentItem;
        this.mCalendar = aParentItem.mCalendar;
        this.mIsProxy = true;
    },

    //
    // calIItemBase
    //
    mImmutable: false,
    get isMutable() { return !this.mImmutable; },

    mDirty: false,
    modify: function() {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        this.mDirty = true;
    },

    ensureNotDirty: function() {
        if (!this.mDirty)
            return;

        if (this.mImmutable) {
            dump ("### Something tried to undirty a dirty immutable event!\n");
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        }

        this.setProperty("LAST-MODIFIED", jsDateToDateTime(new Date()));
        this.mDirty = false;
    },

    makeItemBaseImmutable: function() {
        if (this.mImmutable) {
            return;
        }

        // make all our components immutable
        if (this.mRecurrenceInfo)
            this.mRecurrenceInfo.makeImmutable();

        if (this.mOrganizer)
            this.mOrganizer.makeImmutable();
        if (this.mAttendees) {
            for (var i = 0; i < this.mAttendees.length; i++)
                this.mAttendees[i].makeImmutable();
        }

        var e = this.mProperties.enumerator;
        while (e.hasMoreElements()) {
            var prop = e.getNext();
            var val = prop.value;

            if (prop.value instanceof Components.interfaces.calIDateTime) {
                if (prop.value.isMutable)
                    prop.value.makeImmutable();
            }
        }

        if (this.alarmOffset) {
            this.alarmOffset.makeImmutable();
        }
        if (this.alarmLastAck) {
            this.alarmLastAck.makeImmutable();
        }

        this.ensureNotDirty();
        this.mImmutable = true;
    },

    hasSameIds: function(that) {
        return (that && this.id == that.id &&
                (this.recurrenceId == that.recurrenceId || // both null
                 (this.recurrenceId && that.recurrenceId &&
                  this.recurrenceId.compare(that.recurrenceId) == 0)));
    },

    // initialize this class's members
    initItemBase: function () {
        this.wrappedJSObject = this;
        var now = jsDateToDateTime(new Date());

        this.mProperties = new calPropertyBag();
        this.mPropertyParams = {};

        this.setProperty("CREATED", now.clone());
        this.setProperty("LAST-MODIFIED", now.clone());
        this.setProperty("DTSTAMP", now);

        this.mAttendees = null;

        this.mRecurrenceInfo = null;

        this.mAttachments = null;

        this.mRelations = null;
    },

    clone: function () {
        return this.cloneShallow(this.mParentItem);
    },

    // for subclasses to use; copies the ItemBase's values
    // into m. aNewParent is optional
    cloneItemBaseInto: function (m, aNewParent) {
        this.ensureNotDirty();

        m.mImmutable = false;
        m.mIsProxy = this.mIsProxy;
        m.mParentItem = (calTryWrappedJSObject(aNewParent) || this.mParentItem);
        m.mHashId = this.mHashId;
        m.mCalendar = this.mCalendar;
        if (this.mRecurrenceInfo) {
            m.mRecurrenceInfo = calTryWrappedJSObject(this.mRecurrenceInfo.clone());
            m.mRecurrenceInfo.item = m;
        }

        if (this.mOrganizer) {
            m.mOrganizer = this.mOrganizer.clone();
        }

        if (this.mAttendees) {
            m.mAttendees = new Array(this.mAttendees.length);
            for (var i = 0; i < this.mAttendees.length; i++)
                m.mAttendees[i] = this.mAttendees[i].clone();
        }
        else
            m.mAttendees = null;

        m.mProperties = new calPropertyBag();
        var e = this.mProperties.enumerator;
        while (e.hasMoreElements()) {
            var prop = e.getNext();
            var name = prop.name;
            var val = prop.value;

            if (val instanceof Components.interfaces.calIDateTime) {
                val = val.clone();
            }

            m.mProperties.setProperty(name, val);

            var propBucket = this.mPropertyParams[name];
            if (propBucket) {
                var newBucket = {};
                for (var param in propBucket) {
                    newBucket[param] = propBucket[param];
                }
                m.mPropertyParams[name] = newBucket;
            }
        }

        m.mDirty = false;

        if (this.mAttachments) {
            m.mAttachments = this.mAttachments.concat([]);
        }

        if (this.mRelations) {
            m.mRelations = this.mRelations.concat([]);
        }

        if (this.mCategories) {
            m.mCategories = this.mCategories.concat([]);
        }

        // Clone any alarm info that exists, set it to null if it doesn't
        if (this.alarmOffset) {
            m.alarmOffset = this.alarmOffset.clone();
        } else {
            m.alarmOffset = null;
        }
        if (this.alarmLastAck) {
            m.alarmLastAck = this.alarmLastAck.clone();
        } else {
            m.alarmLastAck = null;
        }
        m.alarmRelated = this.alarmRelated;

        return m;
    },

    get alarmOffset() {
        if (this.mIsProxy && (this.mAlarmOffset === undefined)) {
            return this.parentItem.alarmOffset;
        } else {
            return this.mAlarmOffset;
        }
    },

    set alarmOffset(aValue) {
        this.modify();
        return (this.mAlarmOffset = aValue);
    },

    mAlarmLastAck: null,
    get alarmLastAck cib_get_alarmLastAck() {
        return this.mAlarmLastAck;
    },

    set alarmLastAck cib_set_alarmLastAck(aValue) {
        this.modify();
        if (aValue && !aValue.timezone.isUTC) {
            aValue = aValue.getInTimezone(UTC());
        }
        return (this.mAlarmLastAck = aValue);
    },

    get lastModifiedTime() {
        this.ensureNotDirty();
        return this.getProperty("LAST-MODIFIED");
    },

    get stampTime() {
        var prop = this.getProperty("DTSTAMP");
        if (prop && prop.isValid)
            return prop;
        return this.getProperty("LAST-MODIFIED");
    },

    updateStampTime: function() {
        // can't update the stamp time on an immutable event
        if (this.mImmutable)
            return;

        this.modify();
        this.setProperty("DTSTAMP", jsDateToDateTime(new Date()));
    },

    get propertyEnumerator() {
        if (this.mIsProxy) {
            ASSERT(this.parentItem != this);
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
                        ASSERT(false, Components.results.NS_ERROR_UNEXPECTED);
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

    // The has/get/set/deleteProperty methods are case-insensitive.
    getProperty: function (aName) {
        aName = aName.toUpperCase();
        var aValue = this.mProperties.getProperty_(aName);
        if (aValue === undefined) {
            aValue = (this.mIsProxy ? this.mParentItem.getProperty(aName) : null);
        }
        return aValue;
    },

    hasProperty: function (aName) {
        return (this.getProperty(aName.toUpperCase()) != null);
    },

    setProperty: function (aName, aValue) {
        if (aName == "LAST-MODIFIED") {
            this.mDirty = false;
        } else {
            this.modify();
        }
        if (aValue || !isNaN(aValue)) {
            this.mProperties.setProperty(aName.toUpperCase(), aValue);
        } else {
            this.deleteProperty(aName);
        }
    },

    deleteProperty: function (aName) {
        this.modify();
        if (this.mIsProxy) {
            // deleting a proxy's property will mark the bag's item as null, so we could
            // distinguish it when enumerating/getting properties from the undefined ones.
            this.mProperties.setProperty(aName.toUpperCase(), null);
        } else {
            this.mProperties.deleteProperty(aName.toUpperCase());
        }
    },

    getPropertyParameter: function getPP(aPropName, aParamName) {
        return this.mPropertyParams[aPropName][aParamName];
    },

    getAttendees: function (countObj) {
        if (!this.mAttendees && this.mIsProxy && this.mParentItem) {
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

    getAttendeeById: function (id) {
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

    removeAttendee: function (attendee) {
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

    removeAllAttendees: function() {
        this.modify();
        this.mAttendees = [];
    },

    addAttendee: function (attendee) {
        this.modify();
        this.mAttendees = this.getAttendees({});
        this.mAttendees.push(attendee);
        // XXX ensure that the attendee isn't already there?
    },

    getAttachments: function cIB_getAttachments(aCount) {
        if (!this.mAttachments && this.mIsProxy && this.mParentItem) {
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

    removeAttachment: function (aAttachment) {
        this.modify();
        for (var attIndex in this.mAttachments) {
            if (this.mAttachments[attIndex].uri.spec == aAttachment.uri.spec) {
                this.modify();
                this.mAttachments.splice(attIndex, 1);
                break;
            }
        }
    },

    addAttachment: function (attachment) {
        this.modify();
        this.mAttachments = this.getAttachments({});
        this.mAttachments.push(attachment);
        // XXX ensure that the attachment isn't already there?
    },

    removeAllAttachments: function () {
        this.modify();
        this.mAttachments = [];
    },

    getRelations: function cIB_getRelations(aCount) {
        if (this.mRelations) {
            aCount.value = this.mRelations.length;
            return this.mRelations.concat([]);
        } else {
            aCount.value = 0;
            return [];
        }
    },

    removeRelation: function (aRelation) {
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

    addRelation: function (aRelation) {
        this.modify();
        this.mRelations = this.getRelations({});
        this.mRelations.push(aRelation);
        // XXX ensure that the relation isn't already there?
    },

    removeAllRelations: function () {
        this.modify();
        this.mRelations = [];
    },

    mCalendar: null,
    get calendar () {
        if (!this.mCalendar && (this.parentItem != this)) {
            return this.parentItem.calendar;
        } else {
            return this.mCalendar;
        }
    },

    set calendar (v) {
        if (this.mImmutable)
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        this.mHashId = null; // recompute hashId
        this.mCalendar = v;
    },

    mOrganizer: null,
    get organizer() {
        if (!this.mOrganizer && this.mIsProxy && this.mParentItem) {
            return this.mParentItem.organizer;
        }
        else
            return this.mOrganizer;
    },

    set organizer(v) {
        this.modify();
        this.mOrganizer = v;
    },

    getCategories: function cib_getCategories(aCount) {
        if (!this.mCategories && this.mIsProxy && this.mParentItem) {
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

    setCategories: function cib_setCategories(aCount, aCategories) {
        this.mCategories = aCategories.concat([]);
    },

    /* MEMBER_ATTR(mIcalString, "", icalString), */
    get icalString() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    set icalString() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    // All of these property names must be in upper case for isPropertyPromoted to
    // function correctly. The has/get/set/deleteProperty interfaces
    // are case-insensitive, but these are not.
    itemBasePromotedProps: {
        "CREATED": true,
        "UID": true,
        "LAST-MODIFIED": true,
        "SUMMARY": true,
        "PRIORITY": true,
        "STATUS": true,
        "CLASS": true,
        "DTSTAMP": true,
        "RRULE": true,
        "EXDATE": true,
        "RDATE": true,
        "ATTENDEE": true,
        "ATTACH": true,
        "CATEGORIES": true,
        "ORGANIZER": true,
        "RECURRENCE-ID": true
    },

    icsBasePropMap: [
    { cal: "CREATED", ics: "createdTime" },
    { cal: "LAST-MODIFIED", ics: "lastModified" },
    { cal: "DTSTAMP", ics: "stampTime" },
    { cal: "UID", ics: "uid" },
    { cal: "SUMMARY", ics: "summary" },
    { cal: "PRIORITY", ics: "priority" },
    { cal: "STATUS", ics: "status" },
    { cal: "CLASS", ics: "icalClass" },
    { cal: "RECURRENCE-ID", ics: "recurrenceId" } ],

    mapPropsFromICS: function(icalcomp, propmap) {
        for (var i = 0; i < propmap.length; i++) {
            var prop = propmap[i];
            var val = icalcomp[prop.ics];
            if (val != null && val != Components.interfaces.calIIcalComponent.INVALID_VALUE)
                this.setProperty(prop.cal, val);
        }
    },

    mapPropsToICS: function(icalcomp, propmap) {
        for (var i = 0; i < propmap.length; i++) {
            var prop = propmap[i];
            var val = this.getProperty(prop.cal);
            if (val != null && val != Components.interfaces.calIIcalComponent.INVALID_VALUE)
                icalcomp[prop.ics] = val;
        }
    },

    setItemBaseFromICS: function (icalcomp) {
        this.modify();

        this.mapPropsFromICS(icalcomp, this.icsBasePropMap);

        for (var attprop = icalcomp.getFirstProperty("ATTENDEE");
             attprop;
             attprop = icalcomp.getNextProperty("ATTENDEE")) {

            var att = new CalAttendee();
            att.icalProperty = attprop;
            this.addAttendee(att);
        }

        for (var attprop = icalcomp.getFirstProperty("ATTACH");
             attprop;
             attprop = icalcomp.getNextProperty("ATTACH")) {

            var att = createAttachment();
            att.icalProperty = attprop;
            this.addAttachment(att);
        }

        for (var relprop = icalcomp.getFirstProperty("RELATED-TO");
             relprop;
             relprop = icalcomp.getNextProperty("RELATED-TO")) {

            var rel = createRelation();
            rel.icalProperty = relprop;
            this.addRelation(rel);
        }

        var orgprop = icalcomp.getFirstProperty("ORGANIZER");
        if (orgprop) {
            var org = new CalAttendee();
            org.icalProperty = orgprop;
            org.isOrganizer = true;
            this.mOrganizer = org;
        }

        this.mCategories = [];
        for (var catprop = icalcomp.getFirstProperty("CATEGORIES");
             catprop;
             catprop = icalcomp.getNextProperty("CATEGORIES")) {
            this.mCategories.push(catprop.value);
        }

        // find recurrence properties
        var rec = null;
        for (var recprop = icalcomp.getFirstProperty("ANY");
             recprop;
             recprop = icalcomp.getNextProperty("ANY"))
        {
            var ritem = null;
            if (recprop.propertyName == "RRULE" ||
                recprop.propertyName == "EXRULE")
            {
                ritem = new CalRecurrenceRule();
            } else if (recprop.propertyName == "RDATE" ||
                       recprop.propertyName == "EXDATE")
            {
                ritem = new CalRecurrenceDate();
            } else {
                continue;
            }

            ritem.icalProperty = recprop;

            if (!rec) {
                rec = new calRecurrenceInfo();
                rec.item = this;
            }

            rec.appendRecurrenceItem(ritem);
        }
        this.mRecurrenceInfo = rec;

        var alarmComp = icalcomp.getFirstSubcomponent("VALARM");
        if (alarmComp) {
            var triggerProp = alarmComp.getFirstProperty("TRIGGER");
            // Really, really old Sunbird/Calendar versions didn't give us a
            // trigger.
            if (!triggerProp) {
                Components.utils.reportError("No trigger property for alarm on item: "+this.id);
                // No parsing happens after alarms, so just return
                return;
            }
            var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                                     .createInstance(Components.interfaces.calIDuration);
            duration.icalString = triggerProp.valueAsIcalString;
            this.alarmOffset = duration;

            var related = triggerProp.getParameter("RELATED");
            if (related && related == "END")
                this.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_END;
            else
                this.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;

            var email = alarmComp.getFirstProperty("X-EMAILADDRESS");
            if (email)
                this.setProperty("alarmEmailAddress", email.value);
        }

        var lastAck = icalcomp.getFirstProperty("X-MOZ-LASTACK");
        if (lastAck) {
            var lastAckTime = createDateTime();
            lastAckTime.icalString = lastAck.value;
            this.alarmLastAck = lastAckTime;
        }
    },

    importUnpromotedProperties: function (icalcomp, promoted) {
        for (var prop = icalcomp.getFirstProperty("ANY");
             prop;
             prop = icalcomp.getNextProperty("ANY")) {
            if (!promoted[prop.propertyName]) {
                this.setProperty(prop.propertyName, prop.value);
                var param = prop.getFirstParameterName();
                while (param) {
                    if (!(prop.propertyName in this.mPropertyParams)) {
                        this.mPropertyParams[prop.propertyName] = {};
                    }
                    this.mPropertyParams[prop.propertyName][param] = prop.getParameter(param);
                    param = prop.getNextParameterName();
                }
            }
        }
    },

    // This method is case-insensitive.
    isPropertyPromoted: function (name) {
        return (this.itemBasePromotedProps[name.toUpperCase()]);
    },

    get icalComponent() {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    get generation() {
        if (this.mGeneration === undefined) {
            var gen = this.getProperty("X-MOZ-GENERATION");
            this.mGeneration = (gen ? parseInt(gen) : 0);
        }
        return this.mGeneration;
    },
    set generation(aValue) {
        this.modify();
        this.mGeneration = aValue;
        this.setProperty("X-MOZ-GENERATION", String(aValue));
        return aValue;
    },

    fillIcalComponentFromBase: function (icalcomp) {
        // Make sure that the LMT and ST are updated
        this.updateStampTime();
        this.ensureNotDirty();

        this.mapPropsToICS(icalcomp, this.icsBasePropMap);

        if (this.mOrganizer)
            icalcomp.addProperty(this.mOrganizer.icalProperty);
        var attendees = this.getAttendees({});
        if (attendees.length > 0) {
          for (var i = 0; i < attendees.length; i++) {
            icalcomp.addProperty(attendees[i].icalProperty);
          }
        }

        for each (var att in this.mAttachments) {
            icalcomp.addProperty(att.icalProperty);
        }

        for (var relIndex in this.mRelations) {
            icalcomp.addProperty(this.mRelations[relIndex].icalProperty);
        }

        if (this.mRecurrenceInfo) {
            var ritems = this.mRecurrenceInfo.getRecurrenceItems({});
            for (i in ritems) {
                icalcomp.addProperty(ritems[i].icalProperty);
            }
        }

        for each (var cat in this.getCategories({})) {
            var catprop = getIcsService().createIcalProperty("CATEGORIES");
            catprop.value = cat;
            icalcomp.addProperty(catprop);
        }

        if (this.alarmOffset) {
            var icssvc = getIcsService();
            var alarmComp = icssvc.createIcalComponent("VALARM");

            var triggerProp = icssvc.createIcalProperty("TRIGGER");
            triggerProp.valueAsIcalString = this.alarmOffset.icalString;

            if (this.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_END)
                triggerProp.setParameter("RELATED", "END");

            alarmComp.addProperty(triggerProp);

            // We don't use this, but the ics-spec requires it
            var descProp = icssvc.createIcalProperty("DESCRIPTION");
            descProp.value = "Mozilla Alarm: "+ this.title;
            alarmComp.addProperty(descProp);

            var actionProp = icssvc.createIcalProperty("ACTION");
            actionProp.value = "DISPLAY";

            if (this.getProperty("alarmEmailAddress")) {
                var emailProp = icssvc.createIcalProperty("X-EMAILADDRESS");
                emailProp.value = this.getProperty("alarmEmailAddress");
                actionProp.value = "EMAIL";
                alarmComp.addProperty(emailProp);
            }

            alarmComp.addProperty(actionProp);

            icalcomp.addSubcomponent(alarmComp);
        }

        if (this.alarmLastAck) {
            var lastAck = getIcsService().createIcalProperty("X-MOZ-LASTACK");
            // - should we further ensure that those are UTC or rely on calAlarmService doing so?
            lastAck.value = this.alarmLastAck.icalString;
            icalcomp.addProperty(lastAck);
        }
    },

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

function makeMemberAttr(ctor, varname, dflt, attr, asProperty)
{
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
