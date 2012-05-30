/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    // ensure that RELATED property is correctly set on the VALARM component
    let alarm = cal.createAlarm();
    alarm.action = "DISPLAY";
    alarm.description = "test";
    alarm.related = Ci.calIAlarm.ALARM_RELATED_END;
    alarm.offset = createDuration("-PT15M");
    if (alarm.icalString.search(/RELATED=END/) == -1) {
        do_throw("Bug 486186: RELATED property missing in VALARM component");
    }
}
