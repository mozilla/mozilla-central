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

function calAlarm() {
    this.mProperties = new calPropertyBag();
    this.mPropertyParams = {};
}

calAlarm.prototype = {

    mProperties: null,
    mPropertyParams: null,
    mAction: null,
    mAbsoluteDate: null,
    mOffset: null,
    mDuration: null,
    mAttendees: [],
    mAttachments: [],
    mSummary: null,
    mDescription: null,
    mLastAck: null,
    mItem: null,
    mImmutable: false,
    mRelated: 0,

    QueryInterface: function cA_QueryInterface(aIID) {
        return doQueryInterface(this, calAlarm.__proto__, aIID, null, this);
    },

    /**
     * nsIClassInfo
     */
    getInterfaces: function cA_getInterfaces(aCount) {
        const interfaces = [Components.interfaces.calIAlarm,
                            Components.interfaces.nsISupports];

        aCount = interfaces.length;
        return interfaces;
    },
    getHelperForLanguage: function cA_getHelperForLanguage(aLang) {
        return null;
    },
    contractID: "@mozilla.org/calendar/alarm;1",
    classDescription: "Describes a VALARM",
    classID: Components.ID("{b8db7c7f-c168-4e11-becb-f26c1c4f5f8f}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /**
     * calIAlarm
     */

    ensureMutable: function cA_ensureMutable() {
        if (this.mImmutable) {
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        }
    },

    get isMutable() {
        return !this.mImmutable;
    },

    makeImmutable: function cA_makeImmutable() {
        if (this.mImmutable) {
            return;
        }

        const objectMembers = ["mAbsoluteDate",
                               "mOffset",
                               "mDuration",
                               "mLastAck",
                               "mItem"];
        for each (var member in objectMembers) {
            if (this[member]) {
                this[member].makeImmutable();
            }
        }

        // Properties
        var e = this.mProperties.enumerator;
        while (e.hasMoreElements()) {
            var prop = e.getNext();
            var val = prop.value;

            if (prop.value instanceof Components.interfaces.calIDateTime) {
                if (prop.value.isMutable)
                    prop.value.makeImmutable();
            }
        }

        this.mImmutable = true;
    },

    clone: function cA_clone() {
        var m = new calAlarm();

        m.mImmutable = false;

        const simpleMembers = ["mAction",
                               "mSummary",
                               "mDescription",
                               "mRelated",
                               "mRepeat"];

        const arrayMembers = ["mAttendees",
                              "mAttachments"];

        const objectMembers = ["mAbsoluteDate",
                               "mOffset",
                               "mDuration",
                               "mLastAck",
                               "mItem"];

        for each (var member in simpleMembers) {
            m[member] = this[member];
        }

        for each (var member in arrayMembers) {
            m[member] = this[member].slice(0);
        }

        for each (var member in objectMembers) {
            if (this[member] && this[member].clone) {
                m[member] = this[member].clone();
            } else {
                m[member] = this[member];
            }
        }

        // X-Props
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
        return m;
    },

    related: 0,
    get related() {
        return this.mRelated;
    },
    set related(aValue) {
        this.ensureMutable();
        return (this.mRelated = aValue);
    },

    get lastAck() {
        if (this.action == "AUDIO" ||
            this.action == "EMAIL") {
            return null;
        }
        return this.mLastAck;
    },
    set lastAck(aValue) {
        this.ensureMutable();
        // TODO check type
        return (this.mLastAck = aValue);
    },

    get item() {
        return this.mItem;
    },
    set item(val) {
        this.ensureMutable();
        return (this.mItem = val);
    },

    get action() {
        return this.mAction || "DISPLAY";
    },
    set action(aValue) {
        this.ensureMutable();
        return (this.mAction = aValue);
    },

    // TODO Do we really need to expose this?
    get description() {
        if (this.action == "AUDIO") {
            return null;
        }
        return this.mDescription;
    },
    set description(aValue) {
        this.ensureMutable();
        return (this.mDescription = aValue);
    },

    get summary() {
        if (this.mAction == "DISPLAY" ||
            this.mAction == "AUDIO") {
            return null;
        }
        return this.mSummary;
    },
    set summary(aValue) {
        this.ensureMutable();
        return (this.mSummary= aValue);
    },

    _getAlarmDate: function cA_getAlarmDate() {
        var itemAlarmDate;
        if (isEvent(this.mItem)) {
            switch (this.related) {
                case Components.interfaces.calIAlarm.ALARM_RELATED_START:
                    itemAlarmDate = this.mItem.startDate;
                    break;
                case Components.interfaces.calIAlarm.ALARM_RELATED_END:
                    itemAlarmDate = this.mItem.endDate;
                    break;
            }
        } else if (isToDo(this.mItem)) {
            switch (this.related) {
                case Components.interfaces.calIAlarm.ALARM_RELATED_START:
                    itemAlarmDate = this.mItem.entryDate;
                    break;
                case Components.interfaces.calIAlarm.ALARM_RELATED_END:
                    itemAlarmDate = this.mItem.dueDate;
                    break;
            }
        }
        return itemAlarmDate;
    },

    get offset() {
        if (this.mOffset) {
            return this.mOffset;
        } else if (this.mItem && this.mAbsoluteDate) {
            var itemAlarmDate = this._getAlarmDate();
            if (itemAlarmDate) {
                return this.mAbsoluteDate.subtractDate(itemAlarmDate);
            }
        }
        return null;
    },
    set offset(aValue) {
        this.ensureMutable();
        if (aValue && !(aValue instanceof Components.interfaces.calIDuration)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        this.mAbsoluteDate = null;
        return (this.mOffset = aValue);
    },

    get alarmDate() {
        if (this.mAbsoluteDate) {
            return this.mAbsoluteDate;
        } else if (this.mOffset && this.mItem) {
            var itemAlarmDate = this._getAlarmDate();
            if (itemAlarmDate) {
                itemAlarmDate = itemAlarmDate.clone();
                itemAlarmDate.addDuration(this.mOffset);
                return itemAlarmDate;
            }
        }
        return null;

    },
    set alarmDate(aValue) {
        this.ensureMutable();
        if (aValue && !(aValue instanceof Components.interfaces.calIDateTime)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        this.mOffset = null;
        return (this.mAbsoluteDate = aValue);
    },

    get repeat() {
        if ((this.mRepeat != 0) ^ (this.mDuration != null)) {
            return 0;
        }
        return this.mRepeat || 0;
    },
    set repeat(aValue) {
        this.ensureMutable();
        if (aValue === null) {
            this.mRepeat = null;
        } else {
            this.mRepeat = parseInt(aValue);
            if (isNaN(this.mRepeat)) {
                throw Components.results.NS_ERROR_INVALID_ARG;
            }
        }
        return aValue;
    },

    get repeatOffset() {
        if ((this.mRepeat != 0) ^ (this.mDuration != null)) {
            return null;
        }
        return this.mDuration;
    },
    set repeatOffset(aValue) {
        this.ensureMutable();
        if (aValue !== null &&
            !(aValue instanceof Components.interfaces.calIDuration)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        return (this.mDuration = aValue);
    },

    get repeatDate() {
        var alarmDate = this._getAlarmDate();
        if (!this.mRepeat || !this.mDuration || !alarmDate) {
            return null;
        }

        alarmDate = alarmDate.clone();

        // All Day events are handled as 00:00:00
        alarmDate.isDate = false;
        return alarmDate.addDuration(this.mDuration);
    },

    get attendees() {
        return this.mAttendees;
    },
    set attendees(aValue) {
        this.ensureMutable();
        // TODO Make add/update/deleteAttendee
        return (this.mAttendees = aValue);
    },

    get attachments() {
        if (this.action == "AUDIO") {
            return this.mAttachments.splice(1);
        } else if (this.action == "DISPLAY") {
            return [];
        }
        return this.mAttachments;
    },
    set attachments(aValue) {
        this.ensureMutable();
        // TODO Make add/update/deleteAttendee
        return (this.mAttachments = aValue);
    },

    get icalString() {
        var comp = this.icalComponent;
        return (comp ? comp.serializeToICS() : "");
    },
    set icalString(val) {
        this.ensureMutable();
        return (this.icalComponent = getIcsService().parseICS(val, null));
    },

    promotedProps: {
        "ACTION": "action",
        "TRIGGER": "offset",
        "REPEAT": "repeat",
        "DURATION": "duration",
        "SUMMARY": "summary",
        "DESCRIPTION": "description",
        "X-MOZ-LASTACK": "lastAck"
    },

    get icalComponent() {
        var icssvc = getIcsService();
        var comp = icssvc.createIcalComponent("VALARM");

        // Set up action (REQUIRED)
        var actionProp = icssvc.createIcalProperty("ACTION");
        actionProp.value = this.action;
        comp.addProperty(actionProp);

        // Set up trigger (REQUIRED)
        var triggerProp = icssvc.createIcalProperty("TRIGGER");
        if (this.mAbsoluteDate) {
            // Set the trigger to a specific datetime
            triggerProp.setParameter("VALUE", "DATE-TIME");
            triggerProp.valueAsDatetime = this.mAbsoluteDate.getInTimezone(UTC());
        } else if (this.mOffset) {
            triggerProp.valueAsIcalString = this.mOffset.icalString;
        } else {
            // No offset or absolute date is not valid.
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        comp.addProperty(triggerProp);

        // Set up repeat and duration (OPTIONAL, but if one exists, the other
        // MUST also exist)
        if (this.repeat && this.duration) {
            var repeatProp = icssvc.createIcalProperty("REPEAT");
            var durationProp = icssvc.createIcalProperty("DURATION");

            repeatProp.value = this.repeat;
            durationProp.valueAsIcalString = this.duration.icalString;

            comp.addProperty(repeatProp);
            comp.addProperty(durationProp);
        }

        // Set up attendees (REQUIRED for EMAIL action)
        if (this.action == "EMAIL" && !this.attendees.length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        for each (var attendee in this.attendees) {
            var attendeeProp = icssvc.createIcalProperty("ATTENDEE");
            attendeeProp.value = attendee;
            comp.addProperty(attendeeProp);
        }

        // Set up attachments (REQUIRED for AUDIO and EMAIL types, there MUST
        // NOT be more than one for AUDIO.
        if ((this.action == "EMAIL" || this.action == "AUDIO") &&
            !this.attachments.length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }

        for (var i = 0; i < this.attachments.length; i++) {
            var attachment = this.attachments[i];
            var attachmentProp = icssvc.createIcalProperty("ATTACH");
            attachmentProp.value = attachment;
            comp.addProperty(attachmentProp);
        }

        // Set up summary (REQUIRED for EMAIL)
        if (this.summary || this.action == "EMAIL") {
            var summaryProp = icssvc.createIcalProperty("SUMMARY");
            summaryProp.value = this.summary || "";
            comp.addProperty(summaryProp);
        }

        // Set up the description (REQUIRED for DISPLAY and EMAIL)
        if (this.description ||
            this.action == "DISPLAY" ||
            this.action == "EMAIL") {
            var descriptionProp = icssvc.createIcalProperty("DESCRIPTION");
            descriptionProp.value = this.description || "";
            comp.addProperty(descriptionProp);
        }

        // Set up lastAck
        if (this.lastAck) {
            var lastAckProp = icssvc.createIcalProperty("X-MOZ-LASTACK");
            lastAckProp.value = this.lastAck;
            comp.addProperty(lastAckProp);
        }

        // Set up X-Props. mProperties contains only non-promoted props
        var e = this.mProperties.enumerator;
        while (e.hasMoreElements()) {
            var prop = e.getNext();
            var icalprop = icssvc.createIcalProperty(prop.name);
            icalprop.value = prop.value;
            var propBucket = this.mPropertyParams[prop.name];
            if (propBucket) {
                for (paramName in propBucket) {
                    icalprop.setParameter(paramName,
                                          propBucket[paramName]);
                }
            }
            icalcomp.addProperty(icalprop);
        }
        return comp;
    },
    set icalComponent(aComp) {
        this.ensureMutable();
        if (!aComp || aComp.componentType != "VALARM") {
            // Invalid Component
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        var actionProp = aComp.getFirstProperty("ACTION");
        var triggerProp = aComp.getFirstProperty("TRIGGER");
        var repeatProp = aComp.getFirstProperty("REPEAT");
        var durationProp = aComp.getFirstProperty("DURATION");
        var summaryProp = aComp.getFirstProperty("SUMMARY");
        var descriptionProp = aComp.getFirstProperty("DESCRIPTION");
        var lastAckProp = aComp.getFirstProperty("X-MOZ-LASTACK");

        if (actionProp) {
            this.action = actionProp.value;
        } else {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (triggerProp) {
            if (triggerProp.getParameter("VALUE") == "DATE-TIME")  {
                this.mAbsoluteDate = triggerProp.valueAsDatetime;
            } else {
                var offset = Components.classes["@mozilla.org/calendar/duration;1"]
                                       .createInstance(Components.interfaces.calIDuration);
                offset.icalString = triggerProp.valueAsIcalString;
                this.mOffset = offset;
            }
        } else {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        // Set up alarm relation
        var related = triggerProp.getParameter("RELATED");
        if (related && related == "END") {
            this.related = Components.interfaces.calIAlarm.ALARM_RELATED_END;
        } else {
            this.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
        }

        if (durationProp && repeatProp) {
            var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                                     .createInstance(Components.interfaces.calIDuration);
            duration.icalString = durationProp.valueAsIcalString;
            this.duration = duration;
            this.repeat = repeatProp.value;
        } else if (!durationProp && !repeatProp) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        } else {
            this.duration = null;
            this.repeat = 0;
        }

        // Set up attendees
        this.attendees = [];
        for (var attendeeProp = aComp.getFirstProperty("ATTENDEE");
             attendeeProp;
             attendeeProp = aComp.getNextProperty("ATTENDEE")) {
            // XXX this.addAttendee(attendeeProp.value);
        }

        // Set up attachments
        this.attachments = [];
        for (var attachmentProp = aComp.getFirstProperty("ATTACH");
             attachmentProp;
             attachmentProp = aComp.getNextProperty("ATTACH")) {
            // XXX this.addAttachment(attachmentProp.value);
        }

        // Set up summary
        this.summary = (summaryProp ? summaryProp.value : null);

        // Set up description
        this.description = (descriptionProp ? descriptionProp.value : null);

        // Set up the alarm lastack
        this.lastAck = (lastAckProp ? lastAckProp.valueAsDatetime : null);

        this.mProperties = new calPropertyBag();
        this.mPropertyParams = {};

        // Other properties
        for (var prop = aComp.getFirstProperty("ANY");
             prop;
             prop = aComp.getNextProperty("ANY")) {
            if (!this.promotedProps[prop.propertyName]) {
                this.setProperty(prop.propertyName, prop.value);
                var param = prop.getFristParameterName();
                while (param) {
                    if (!(prop.propertyName in this.mPropertyParams)) {
                        this.mPropertyParams[prop.propertyName] = {};
                    }
                    this.mPropertyParams[prop.propertyName][param] = prop.getParameter(param);
                    param = prop.getNextParameterName();
                }
            }
        }
        return aComp;
    },

    hasProperty: function cA_hasProperty(aName) {
        return (this.getProperty(aName.toUpperCase()) != null);
    },

    getProperty: function cA_getProperty(aName) {
        var name = aName.toUpperCase();
        if (name in this.promotedProps) {
            return this[this.promotedProps[name]];
        } else {
            return this.mProperties.getProperty(name);
        }
    },

    setProperty: function cA_setProperty(aName, aValue) {
        this.ensureMutable();
        var name = aName.toUpperCase();
        if (name in this.promotedProps) {
            this[this.promotedProps[name]] = aValue;
        } else {
            this.mProperties.setProperty(name, aValue);
        }
        return aValue;
    },

    deleteProperty: function cA_deleteProperty(aName) {
        this.ensureMutable();
        var name = aName.toUpperCase();
        if (name in this.promotedProps) {
            this[this.promotedProps[name]] = null;
        } else {
            this.mProperties.deleteProperty(name);
        }
    }
};
