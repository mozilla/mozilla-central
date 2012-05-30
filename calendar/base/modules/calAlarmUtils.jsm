/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.alarms = {
    /**
     * Read default alarm settings from user preferences and apply them to the
     * event/todo passed in. The item's calendar should be set to ensure the
     * correct alarm type is set.
     *
     * @param aItem     The item to apply the default alarm values to.
     */
    setDefaultValues: function cal_alarm_setDefaultValues(aItem) {
        let type = cal.isEvent(aItem) ? "event" : "todo";
        if (cal.getPrefSafe("calendar.alarms.onfor" + type + "s", 0) == 1) {
            let alarmOffset = cal.createDuration();
            let alarm = cal.createAlarm();
            let units = cal.getPrefSafe("calendar.alarms." + type + "alarmunit", "minutes");

            // Make sure the alarm pref is valid, default to minutes otherwise
            if (["weeks", "days", "hours", "minutes", "seconds"].indexOf(units) < 0) {
                units = "minutes";
            }

            alarmOffset[units] = cal.getPrefSafe("calendar.alarms." + type + "alarmlen", 0);
            alarmOffset.normalize();
            alarmOffset.isNegative = true;
            if (type == "todo" && !aItem.entryDate) {
                // You can't have an alarm if the entryDate doesn't exist.
                aItem.entryDate = cal.now();
            }
            alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
            alarm.offset = alarmOffset;

            // Default to a display alarm, unless the calendar doesn't support
            // it or we have no calendar yet. (Man this is hard to wrap)
            let actionValues = ((aItem.calendar &&
                                 aItem.calendar.getProperty("capabilities.alarms.actionValues")) ||
                                ["DISPLAY"]);

            alarm.action = (actionValues.indexOf("DISPLAY") < 0 ? actionValues[0] : "DISPLAY");
            aItem.addAlarm(alarm);
        }
    },

    /**
     * Calculate the alarm date for a calIAlarm.
     *
     * @param aItem     The item used to calculate the alarm date.
     * @param aAlarm    The alarm to calculate the date for.
     * @return          The alarm date.
     */
    calculateAlarmDate: function cal_alarm_calculateAlarmDate(aItem, aAlarm) {
        if (aAlarm.related == aAlarm.ALARM_RELATED_ABSOLUTE) {
            return aAlarm.alarmDate;
        } else {
            let returnDate;
            if (aAlarm.related == aAlarm.ALARM_RELATED_START) {
                returnDate = aItem[cal.calGetStartDateProp(aItem)];
            } else if (aAlarm.related == aAlarm.ALARM_RELATED_END) {
                returnDate = aItem[cal.calGetEndDateProp(aItem)];
            }

            if (returnDate && aAlarm.offset) {
                // Handle all day events.  This is kinda weird, because they don't
                // have a well defined startTime.  We just consider the start/end
                // to be midnight in the user's timezone.
                if (returnDate.isDate) {
                    let tz = cal.calendarDefaultTimezone();
                    // This returns a copy, so no extra cloning needed.
                    returnDate = returnDate.getInTimezone(tz);
                    returnDate.isDate = false;
                } else {
                    // Clone the date to correctly add the duration.
                    returnDate = returnDate.clone();
                }

                returnDate.addDuration(aAlarm.offset);
                return returnDate;
            }
        }
        return null;
    },

    /**
     * Calculate the alarm offset for a calIAlarm. The resulting offset is
     * related to either start or end of the event, depending on the aRelated
     * parameter.
     *
     * @param aItem     The item to calculate the offset for.
     * @param aAlarm    The alarm to calculate the offset for.
     * @param aRelated  (optional) A relation constant from calIAlarm. If not
     *                    passed, ALARM_RELATED_START will be assumed.
     * @return          The alarm offset.
     */
    calculateAlarmOffset: function cal_alarms_calculateAlarmOffset(aItem, aAlarm, aRelated) {
        if (aAlarm.related == aAlarm.ALARM_RELATED_ABSOLUTE) {
            let returnDate;
            if (aRelated === undefined || aRelated == aAlarm.ALARM_RELATED_START) {
                returnDate = aItem[cal.calGetStartDateProp(aItem)];
            } else if (aRelated == aAlarm.ALARM_RELATED_END) {
                returnDate = aItem[cal.calGetEndDateProp(aItem)];
            }
            if (returnDate && aAlarm.alarmDate) {
                return returnDate.subtractDate(aAlarm.alarmDate);
            }
                
            return offset;
        } else {
            return aAlarm.offset;
        }
    },

    /**
     * Adds reminder images to a given node, making sure only one icon per alarm
     * action is added.
     *
     * @param aElement    The element to add the images to.
     * @param aReminders  The set of reminders to add images for.
     */
    addReminderImages: function cal_alarms_addReminderImages(aElement, aReminders) {
        function createOwnedXULNode(el) {
            const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
            return aElement.ownerDocument.createElementNS(XUL_NS, el);
        }

        function setupActionImage(node, reminder) {
            let image = node || createOwnedXULNode("image");
            image.setAttribute("class", "reminder-icon");
            image.setAttribute("value", reminder.action);
            return image;
        }

        // Fill up the icon box with the alarm icons, show max one icon per
        // alarm type.
        let countIconChildren = aElement.childNodes.length;
        let actionMap = {};
        let i, offset;
        for (i = 0, offset = 0; i < aReminders.length; i++) {
            var reminder = aReminders[i];
            if (reminder.action in actionMap) {
                // Only show one icon of each type;
                offset++;
                continue;
            }
            actionMap[reminder.action] = true;

            if (i - offset >= countIconChildren) {
                // Not enough nodes, append it.
                aElement.appendChild(setupActionImage(null, reminder));
            } else {
                // There is already a node there, change its properties
                setupActionImage(aElement.childNodes[i - offset], reminder);
            }
        }

        // Remove unused image nodes
        for (i -= offset; i < countIconChildren; i++) {
            aElement.removeChild(aElement.childNodes[i]);
        }
    }
};
