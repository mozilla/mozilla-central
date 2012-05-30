/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    // Check that the RELATED property is correctly set
    // after parsing the given VALARM component

    // trigger set 15 minutes prior to the start of the event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER:-PT15M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_START);

    // trigger set 15 minutes prior to the start of the event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;VALUE=DURATION:-PT15M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_START);

    // trigger set 15 minutes prior to the start of the event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;RELATED=START:-PT15M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_START);

    // trigger set 15 minutes prior to the start of the event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;VALUE=DURATION;RELATED=START:-PT15M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_START);

    // trigger set 5 minutes after the end of an event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;RELATED=END:PT5M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_END);

    // trigger set 5 minutes after the end of an event
    check_relative("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;VALUE=DURATION;RELATED=END:PT5M\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM",
                   Ci.calIAlarm.ALARM_RELATED_END);

    // trigger set to an absolute date/time
    check_absolute("BEGIN:VALARM\n" +
                   "ACTION:DISPLAY\n" +
                   "TRIGGER;VALUE=DATE-TIME:20090430T080000Z\n" +
                   "DESCRIPTION:TEST\n" +
                   "END:VALARM");
}

function check_relative(aIcalString, aRelated) {
    let alarm = cal.createAlarm();
    alarm.icalString = aIcalString;
    do_check_eq(alarm.related, aRelated);
    do_check_eq(alarm.alarmDate, null);
    do_check_neq(alarm.offset, null);
}

function check_absolute(aIcalString) {
    let alarm = cal.createAlarm();
    alarm.icalString = aIcalString;
    do_check_eq(alarm.related, Ci.calIAlarm.ALARM_RELATED_ABSOLUTE);
    do_check_neq(alarm.alarmDate, null);
    do_check_eq(alarm.offset, null);
}
