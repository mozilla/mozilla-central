/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const ALARM_RELATED_ABSOLUTE = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
const ALARM_RELATED_START = Components.interfaces.calIAlarm.ALARM_RELATED_START;
const ALARM_RELATED_END = Components.interfaces.calIAlarm.ALARM_RELATED_END;

function calAlarm() {
    this.wrappedJSObject = this;
    this.mProperties = new calPropertyBag();
    this.mPropertyParams = {};
    this.mAttendees = [];
    this.mAttachments = [];
}

const calAlarmClassID = Components.ID("{b8db7c7f-c168-4e11-becb-f26c1c4f5f8f}");
const calAlarmInterfaces = [Components.interfaces.calIAlarm];
calAlarm.prototype = {

    mProperties: null,
    mPropertyParams: null,
    mAction: null,
    mAbsoluteDate: null,
    mOffset: null,
    mDuration: null,
    mAttendees: null,
    mAttachments: null,
    mSummary: null,
    mDescription: null,
    mLastAck: null,
    mImmutable: false,
    mRelated: 0,
    mRepeat: 0,

    classID: calAlarmClassID,
    QueryInterface: XPCOMUtils.generateQI(calAlarmInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calAlarmClassID,
        contractID: "@mozilla.org/calendar/alarm;1",
        classDescription: "Describes a VALARM",
        interfaces: calAlarmInterfaces
    }),

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
                               "mLastAck"];
        for each (let member in objectMembers) {
            if (this[member] && this[member].isMutable) {
                this[member].makeImmutable();
            }
        }

        // Properties
        let e = this.mProperties.enumerator;
        while (e.hasMoreElements()) {
            let prop = e.getNext();
            let val = prop.value;

            if (prop.value instanceof Components.interfaces.calIDateTime) {
                if (prop.value.isMutable)
                    prop.value.makeImmutable();
            }
        }

        this.mImmutable = true;
    },

    clone: function cA_clone() {
        let m = new calAlarm();

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
                               "mLastAck"];

        for each (let member in simpleMembers) {
            m[member] = this[member];
        }

        for each (let member in arrayMembers) {
            let newArray = [];
            for each (let oldElem in this[member]) {
                newArray.push(oldElem.clone());
            }
            m[member] = newArray;
        }

        for each (let member in objectMembers) {
            if (this[member] && this[member].clone) {
                m[member] = this[member].clone();
            } else {
                m[member] = this[member];
            }
        }

        // X-Props
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
        return m;
    },


    get related() {
        return this.mRelated;
    },
    set related(aValue) {
        this.ensureMutable();
        switch (aValue) {
            case ALARM_RELATED_ABSOLUTE:
                this.mOffset = null;
                break;
            case ALARM_RELATED_START:
            case ALARM_RELATED_END:
                this.mAbsoluteDate = null;
                break;
        }

        return (this.mRelated = aValue);
    },

    get action() {
        return this.mAction || "DISPLAY";
    },
    set action(aValue) {
        this.ensureMutable();
        return (this.mAction = aValue);
    },

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
        return (this.mSummary = aValue);
    },

    get offset() {
        return this.mOffset;
    },
    set offset(aValue) {
        if (aValue && !(aValue instanceof Components.interfaces.calIDuration)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        if (this.related != ALARM_RELATED_START &&
            this.related != ALARM_RELATED_END) {
            throw Components.results.NS_ERROR_FAILURE;
        }
        this.ensureMutable();
        return (this.mOffset = aValue);
    },

    get alarmDate() {
        return this.mAbsoluteDate;
    },
    set alarmDate(aValue) {
        if (aValue && !(aValue instanceof Components.interfaces.calIDateTime)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        if (this.related != ALARM_RELATED_ABSOLUTE) {
            throw Components.results.NS_ERROR_FAILURE;
        }
        this.ensureMutable();
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
        if (this.related != ALARM_RELATED_ABSOLUTE ||
            !this.mAbsoluteDate ||
            !this.mRepeat ||
            !this.mDuration) {
            return null;
        }

        let alarmDate = this.mAbsoluteDate.clone();

        // All Day events are handled as 00:00:00
        alarmDate.isDate = false;
        alarmDate.addDuration(this.mDuration);
        return alarmDate;
    },

    getAttendees: function getAttendees(aCount) {
        let attendees;
        if (this.action == "AUDIO" || this.action == "DISPLAY") {
            attendees = [];
        } else {
            attendees = this.mAttendees.concat([]);
        }
        aCount.value = attendees.length;
        return attendees;
    },

    addAttendee: function addAttendee(aAttendee) {
        // Make sure its not duplicate
        this.deleteAttendee(aAttendee);

        // Now check if its valid
        if (this.action == "AUDIO" || this.action == "DISPLAY") {
            throw new Error("Alarm type AUDIO/DISPLAY may not have attendees");
        }

        // And add it (again)
        this.mAttendees.push(aAttendee);
    },

    deleteAttendee: function deleteAttendee(aAttendee) {
        let deleteId = aAttendee.id;
        for (let i = 0; i < this.mAttendees.length; i++) {
            if (this.mAttendees[i].id == deleteId) {
                this.mAttendees.splice(i, 1);
                break;
            }
        }
    },

    clearAttendees: function clearAttendees() {
        this.mAttendees = [];
    },

    getAttachments: function getAttachments(aCount) {
        let attachments;
        if (this.action == "AUDIO") {
            attachments = (this.mAttachments.length ? [this.mAttachments[0]] : []);
        } else if (this.action == "DISPLAY") {
            attachments = [];
        } else {
            attachments = this.mAttachments.concat([]);
        }
        aCount.value = attachments.length;
        return attachments;
    },

    addAttachment: function addAttachment(aAttachment) {
        // Make sure its not duplicate
        this.deleteAttachment(aAttachment);

        // Now check if its valid
        if (this.action == "AUDIO" && this.mAttachments.length) {
            throw new Error("Alarm type AUDIO may only have one attachment");
        } else if (this.action == "DISPLAY") {
            throw new Error("Alarm type DISPLAY may not have attachments");
        }

        // And add it (again)
        this.mAttachments.push(aAttachment);
    },

    deleteAttachment: function deleteAttachment(aAttachment) {
        let deleteHash = aAttachment.hashId;
        for (let i = 0; i < this.mAttachments.length; i++) {
            if (this.mAttachments[i].hashId == deleteHash) {
                this.mAttachments.splice(i, 1);
                break;
            }
        }
    },

    clearAttachments: function clearAttachments() {
        this.mAttachments = [];
    },

    get icalString() {
        let comp = this.icalComponent;
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
        let icssvc = getIcsService();
        let comp = icssvc.createIcalComponent("VALARM");

        // Set up action (REQUIRED)
        let actionProp = icssvc.createIcalProperty("ACTION");
        actionProp.value = this.action;
        comp.addProperty(actionProp);

        // Set up trigger (REQUIRED)
        let triggerProp = icssvc.createIcalProperty("TRIGGER");
        if (this.related == ALARM_RELATED_ABSOLUTE && this.mAbsoluteDate) {
            // Set the trigger to a specific datetime
            triggerProp.setParameter("VALUE", "DATE-TIME");
            triggerProp.valueAsDatetime = this.mAbsoluteDate.getInTimezone(cal.UTC());
        } else if (this.related != ALARM_RELATED_ABSOLUTE && this.mOffset) {
            triggerProp.valueAsIcalString = this.mOffset.icalString;
            if (this.related == ALARM_RELATED_END) {
                // An alarm related to the end of the event.
                triggerProp.setParameter("RELATED", "END");
            }
        } else {
            // No offset or absolute date is not valid.
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        comp.addProperty(triggerProp);

        // Set up repeat and duration (OPTIONAL, but if one exists, the other
        // MUST also exist)
        if (this.repeat && this.repeatOffset) {
            let repeatProp = icssvc.createIcalProperty("REPEAT");
            let durationProp = icssvc.createIcalProperty("DURATION");

            repeatProp.value = this.repeat;
            durationProp.valueAsIcalString = this.repeatOffset.icalString;

            comp.addProperty(repeatProp);
            comp.addProperty(durationProp);
        }

        // Set up attendees (REQUIRED for EMAIL action)
        /* TODO should we be strict here?
        if (this.action == "EMAIL" && !this.getAttendees({}).length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        } */
        for each (let attendee in this.getAttendees({})) {
            comp.addProperty(attendee.icalProperty);
        }

        // Set up attachments (REQUIRED for AUDIO and EMAIL types, there MUST
        // NOT be more than one for AUDIO.
        if (this.action == "AUDIO" && this.getAttachments({}).length != 1) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }

        /* TODO should we be strict here?
        if (this.action == "EMAIL" && !this.attachments.length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        } */

        for each (let attachment in this.getAttachments({})) {
            comp.addProperty(attachment.icalProperty);
        }

        // Set up summary (REQUIRED for EMAIL)
        if (this.summary || this.action == "EMAIL") {
            let summaryProp = icssvc.createIcalProperty("SUMMARY");
            // Summary needs to have a non-empty value
            summaryProp.value = this.summary ||
                calGetString("calendar", "alarmDefaultSummary");
            comp.addProperty(summaryProp);
        }

        // Set up the description (REQUIRED for DISPLAY and EMAIL)
        if (this.description ||
            this.action == "DISPLAY" ||
            this.action == "EMAIL") {
            let descriptionProp = icssvc.createIcalProperty("DESCRIPTION");
            // description needs to have a non-empty value
            descriptionProp.value = this.description ||
                calGetString("calendar", "alarmDefaultDescription");
            comp.addProperty(descriptionProp);
        }

        // Set up lastAck
        if (this.lastAck) {
            let lastAckProp = icssvc.createIcalProperty("X-MOZ-LASTACK");
            lastAckProp.value = this.lastAck;
            comp.addProperty(lastAckProp);
        }

        // Set up X-Props. mProperties contains only non-promoted props
        for (let propName in this.mProperties) {
            let icalprop = icssvc.createIcalProperty(propName);
            icalprop.value = this.mProperties.getProperty(propName);

            // Add parameters
            let propBucket = this.mPropertyParams[propName];
            if (propBucket) {
                for (let paramName in propBucket) {
                    try {
                        icalprop.setParameter(paramName,
                                              propBucket[paramName]);
                    } catch (e if e.result == Components.results.NS_ERROR_ILLEGAL_VALUE) {
                        // Illegal values should be ignored, but we could log them if
                        // the user has enabled logging.
                        cal.LOG("Warning: Invalid alarm parameter value " + paramName + "=" + propBucket[paramName]);
                    }
                }
            }
            comp.addProperty(icalprop);
        }
        return comp;
    },
    set icalComponent(aComp) {
        this.ensureMutable();
        if (!aComp || aComp.componentType != "VALARM") {
            // Invalid Component
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        let actionProp = aComp.getFirstProperty("ACTION");
        let triggerProp = aComp.getFirstProperty("TRIGGER");
        let repeatProp = aComp.getFirstProperty("REPEAT");
        let durationProp = aComp.getFirstProperty("DURATION");
        let summaryProp = aComp.getFirstProperty("SUMMARY");
        let descriptionProp = aComp.getFirstProperty("DESCRIPTION");
        let lastAckProp = aComp.getFirstProperty("X-MOZ-LASTACK");

        if (actionProp) {
            this.action = actionProp.value;
        } else {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (triggerProp) {
            if (triggerProp.getParameter("VALUE") == "DATE-TIME")  {
                this.mAbsoluteDate = triggerProp.valueAsDatetime;
                this.related = ALARM_RELATED_ABSOLUTE;
            } else {
                this.mOffset = cal.createDuration(triggerProp.valueAsIcalString);

                let related = triggerProp.getParameter("RELATED");
                this.related = (related == "END" ? ALARM_RELATED_END : ALARM_RELATED_START);
            }
        } else {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (durationProp && repeatProp) {
            this.repeatOffset = cal.createDuration(durationProp.valueAsIcalString);
            this.repeat = repeatProp.value;
        } else if (durationProp || repeatProp) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        } else {
            this.repeatOffset = null;
            this.repeat = 0;
        }

        // Set up attendees
        this.clearAttendees();
        for (let attendeeProp in cal.ical.propertyIterator(aComp, "ATTENDEE")) {
            let attendee = cal.createAttendee();
            attendee.icalProperty = attendeeProp;
            this.addAttendee(attendee);
        }

        // Set up attachments
        this.clearAttachments();
        for (let attachProp in cal.ical.propertyIterator(aComp, "ATTACH")) {
            let attach = cal.createAttachment();
            attach.icalProperty = attachProp;
            this.addAttachment(attach);
        }

        // Set up summary
        this.summary = (summaryProp ? summaryProp.value : null);

        // Set up description
        this.description = (descriptionProp ? descriptionProp.value : null);

        // Set up the alarm lastack. We can't use valueAsDatetime here since
        // the default for an X-Prop is TEXT and in older versions we didn't set
        // VALUE=DATE-TIME.
        this.lastAck = (lastAckProp ? cal.createDateTime(lastAckProp.valueAsIcalString) : null);

        this.mProperties = new calPropertyBag();
        this.mPropertyParams = {};

        // Other properties
        for (let prop in cal.ical.propertyIterator(aComp)) {
            if (!this.promotedProps[prop.propertyName]) {
                this.setProperty(prop.propertyName, prop.value);

                for (let paramName in cal.ical.paramIterator(prop)) {
                    if (!(prop.propertyName in this.mPropertyParams)) {
                        this.mPropertyParams[prop.propertyName] = {};
                    }
                    let param = prop.getParameter(paramName);
                    this.mPropertyParams[prop.propertyName][paramName] = param;
                }
            }
        }
        return aComp;
    },

    hasProperty: function cA_hasProperty(aName) {
        return (this.getProperty(aName.toUpperCase()) != null);
    },

    getProperty: function cA_getProperty(aName) {
        let name = aName.toUpperCase();
        if (name in this.promotedProps) {
            return this[this.promotedProps[name]];
        } else {
            return this.mProperties.getProperty(name);
        }
    },

    setProperty: function cA_setProperty(aName, aValue) {
        this.ensureMutable();
        let name = aName.toUpperCase();
        if (name in this.promotedProps) {
            this[this.promotedProps[name]] = aValue;
        } else {
            this.mProperties.setProperty(name, aValue);
        }
        return aValue;
    },

    deleteProperty: function cA_deleteProperty(aName) {
        this.ensureMutable();
        let name = aName.toUpperCase();
        if (name in this.promotedProps) {
            this[this.promotedProps[name]] = null;
        } else {
            this.mProperties.deleteProperty(name);
        }
    },

    get propertyEnumerator() {
        return this.mProperties.enumerator;
    },

    toString: function cA_toString(aItem) {
        if (this.related == ALARM_RELATED_ABSOLUTE && this.mAbsoluteDate) {
            // this is an absolute alarm. Use the calendar default timezone and
            // format it.
            let formatter = cal.getDateFormatter();
            let formatDate = this.mAbsoluteDate.getInTimezone(cal.calendarDefaultTimezone());
            return formatter.formatDateTime(formatDate);
        } else if (this.related != ALARM_RELATED_ABSOLUTE && this.mOffset) {
            function getItemBundleStringName(aPrefix) {
                if (!aItem || isEvent(aItem)) {
                    return aPrefix + "Event";
                } else if (isToDo(aItem)) {
                    return aPrefix + "Task";
                } else {
                    return aPrefix;
                }
            }

            // Relative alarm length
            let alarmlen = Math.abs(this.mOffset.inSeconds / 60);
            if (alarmlen == 0) {
                // No need to get the other information if the alarm is at the start
                // of the event/task.
                if (this.related == ALARM_RELATED_START) {
                    return calGetString("calendar-alarms",
                                        getItemBundleStringName("reminderTitleAtStart"));
                } else if (this.related == ALARM_RELATED_END) {
                    return calGetString("calendar-alarms",
                                        getItemBundleStringName("reminderTitleAtEnd"));
                }
            }

            let unit;
            if (alarmlen % 1440 == 0) {
                // Alarm is in days
                unit = "reminderCustomUnitDays";
                alarmlen /= 1440;
            } else if (alarmlen % 60 == 0) {
                unit = "reminderCustomUnitHours";
                alarmlen /= 60;
            } else {
                unit = "reminderCustomUnitMinutes";
            }
            let localeUnitString = calGetString("calendar-alarms", unit);
            let unitString = PluralForm.get(alarmlen, localeUnitString)
                                       .replace("#1", alarmlen);
            let originStringName = "reminderCustomOrigin";

            // Origin
            switch (this.related) {
                case ALARM_RELATED_START:
                    originStringName += "Begin";
                    break;
                case ALARM_RELATED_END:
                    originStringName += "End";
                    break;
            }

            if (this.offset.isNegative) {
                originStringName += "Before";
            } else {
                originStringName += "After";
            }

            let originString = calGetString("calendar-alarms",
                                            getItemBundleStringName(originStringName));
            return calGetString("calendar-alarms",
                                "reminderCustomTitle",
                                [unitString, originString]);
                                
        } else {
            // This is an incomplete alarm, but then again we should never reach
            // this state.
            return "[Incomplete calIAlarm]";
        }
    }
};
