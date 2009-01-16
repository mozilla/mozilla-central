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
 * Portions created by the Initial Developer are Copyright (C) 2008
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.alarms = {
    /**
     * Read default alarm settings from user preferences and apply them to the
     * event/todo passed in.
     *
     * @param aItem     The item to apply the default alarm values to.
     */
    setDefaultValues: function cal_alarm_setDefaultValues(aItem) {
        let type = cal.isEvent(aItem) ? "event" : "todo";
        if (cal.getPrefSafe("calendar.alarms.onfor" + type + "s", 0) == 1) {
            let alarmOffset = cal.createDuration();
            let alarm = cal.createAlarm();
            let units = cal.getPrefSafe("calendar.alarms." + type + "alarmunit", "minute");
            alarmOffset[units] = cal.getPrefSafe("calendar.alarms." + type + "alarmlen", 0);
            alarmOffset.normalize();
            alarmOffset.isNegative = true;
            if (type == "todo" && !aItem.entryDate) {
                // You can't have an alarm if the entryDate doesn't exist.
                aItem.entryDate = cal.now();
            }
            alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
            alarm.offset = alarmOffset;
            aItem.addAlarm(alarm);
        }
    },

    /**
     * Calculate the alarm date for a calIAlarm.
     *
     * @param aItem     The item used to calculate the alarm date.
     * @param aAlarm    The alarm to calculate the date for.
     * @return          The alarm offset.
     */
    calculateAlarmDate: function cal_alarm_calculateAlarmDate(aItem, aAlarm) {
        if (aAlarm.related == aAlarm.ALARM_RELATED_ABSOLUTE) {
            return aAlarm.alarmDate;
        } else {
            let returnDate;
            if (aAlarm.related == aAlarm.ALARM_RELATED_START) {
                let startDate = aItem[cal.calGetStartDateProp(aItem)];
                returnDate = startDate && startDate.clone();
            } else if (aAlarm.related = aAlarm.ALARM_RELATED_END) {
                let endDate = aItem[cal.calGetEndDateProp(aItem)];
                returnDate = endDate && endDate.clone();
            }

            if (returnDate && aAlarm.offset) {
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
    }
};
