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

Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

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

    get isMutable cA_get_isMutable() {
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
            m[member] = this[member].slice(0);
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


    get related cA_get_related() {
        return this.mRelated;
    },
    set related cA_set_related(aValue) {
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

    get action cA_get_action() {
        return this.mAction || "DISPLAY";
    },
    set action cA_set_action(aValue) {
        this.ensureMutable();
        return (this.mAction = aValue);
    },

    // TODO Do we really need to expose this?
    get description cA_get_description() {
        if (this.action == "AUDIO") {
            return null;
        }
        return this.mDescription;
    },
    set description cA_set_description(aValue) {
        this.ensureMutable();
        return (this.mDescription = aValue);
    },

    get summary cA_get_summary() {
        if (this.mAction == "DISPLAY" ||
            this.mAction == "AUDIO") {
            return null;
        }
        return this.mSummary;
    },
    set summary cA_set_summary(aValue) {
        this.ensureMutable();
        return (this.mSummary = aValue);
    },

    get offset cA_get_offset() {
        return this.mOffset;
    },
    set offset cA_set_offset(aValue) {
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

    get alarmDate cA_get_alarmDate() {
        return this.mAbsoluteDate;
    },
    set alarmDate cA_set_alarmDate(aValue) {
        if (aValue && !(aValue instanceof Components.interfaces.calIDateTime)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        if (this.related != ALARM_RELATED_ABSOLUTE) {
            throw Components.results.NS_ERROR_FAILURE;
        }
        this.ensureMutable();
        return (this.mAbsoluteDate = aValue);
    },

    get repeat cA_get_repeat() {
        if ((this.mRepeat != 0) ^ (this.mDuration != null)) {
            return 0;
        }
        return this.mRepeat || 0;
    },
    set repeat cA_set_repeat(aValue) {
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

    get repeatOffset cA_get_repeatOffset() {
        if ((this.mRepeat != 0) ^ (this.mDuration != null)) {
            return null;
        }
        return this.mDuration;
    },
    set repeatOffset cA_set_repeatOffset(aValue) {
        this.ensureMutable();
        if (aValue !== null &&
            !(aValue instanceof Components.interfaces.calIDuration)) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
        return (this.mDuration = aValue);
    },

    get repeatDate cA_get_repeatDate() {
        if (this.related != ALARM_RELATED_ABSOLUTE ||
            !this.mAbsoluteDate ||
            !this.mRepeat ||
            !this.mDuration) {
            return null;
        }

        let alarmDate = this.mAbsoluteDate.clone();

        // All Day events are handled as 00:00:00
        alarmDate.isDate = false;
        return alarmDate.addDuration(this.mDuration);
    },

    get attendees cA_get_attendees() {
        return this.mAttendees;
    },
    set attendees cA_set_attendees(aValue) {
        this.ensureMutable();
        // TODO Make add/update/deleteAttendee
        return (this.mAttendees = aValue);
    },

    get attachments cA_get_attachments() {
        if (this.action == "AUDIO") {
            return this.mAttachments.splice(1);
        } else if (this.action == "DISPLAY") {
            return [];
        }
        return this.mAttachments;
    },
    set attachments cA_set_attachments(aValue) {
        this.ensureMutable();
        // TODO Make add/update/deleteAttendee
        return (this.mAttachments = aValue);
    },

    get icalString cA_get_icalString() {
        let comp = this.icalComponent;
        return (comp ? comp.serializeToICS() : "");
    },
    set icalString cA_set_icalString(val) {
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

    get icalComponent cA_get_icalComponent() {
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
            triggerProp.valueAsDatetime = this.mAbsoluteDate.getInTimezone(UTC());
        } else if (this.related != ALARM_RELATED_ABSOLUTE && this.mOffset) {
            triggerProp.valueAsIcalString = this.mOffset.icalString;
        } else {
            // No offset or absolute date is not valid.
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        comp.addProperty(triggerProp);

        // Set up repeat and duration (OPTIONAL, but if one exists, the other
        // MUST also exist)
        if (this.repeat && this.duration) {
            let repeatProp = icssvc.createIcalProperty("REPEAT");
            let durationProp = icssvc.createIcalProperty("DURATION");

            repeatProp.value = this.repeat;
            durationProp.valueAsIcalString = this.duration.icalString;

            comp.addProperty(repeatProp);
            comp.addProperty(durationProp);
        }

        // Set up attendees (REQUIRED for EMAIL action)
        /* TODO add support for attendees
        if (this.action == "EMAIL" && !this.attendees.length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        } */
        for each (let attendee in this.attendees) {
            let attendeeProp = icssvc.createIcalProperty("ATTENDEE");
            attendeeProp.value = attendee;
            comp.addProperty(attendeeProp);
        }

        // Set up attachments (REQUIRED for AUDIO and EMAIL types, there MUST
        // NOT be more than one for AUDIO.
        /* TODO add support for attachments
        if ((this.action == "EMAIL" || this.action == "AUDIO") &&
            !this.attachments.length) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        } */

        for each (let attachment in this.attachments) {
            let attachmentProp = icssvc.createIcalProperty("ATTACH");
            attachmentProp.value = attachment;
            comp.addProperty(attachmentProp);
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
                    icalprop.setParameter(paramName,
                                          propBucket[paramName]);
                }
            }
            comp.addProperty(icalprop);
        }
        return comp;
    },
    set icalComponent cA_set_icalComponent(aComp) {
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
            this.duration = cal.createDuration(durationProp.valueAsIcalString);
            this.repeat = repeatProp.value;
        } else if (durationProp || repeatProp) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        } else {
            this.duration = null;
            this.repeat = 0;
        }

        // Set up attendees
        this.attendees = [];
        for (let attendee in cal.ical.propertyIterator(aComp, "ATTENDEE")) {
            // XXX this.addAttendee(attendee);
        }

        // Set up attachments
        this.attachments = [];
        for (let attach in cal.ical.propertyIterator(aComp, "ATTACH")) {
            // XXX this.addAttachment(attach);
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

    get propertyEnumerator cA_get_propertyEnumerator() {
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
                                
        }
    }
};
