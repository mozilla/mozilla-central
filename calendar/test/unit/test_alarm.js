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

function run_test() {
    test_initial_creation();

    test_display_alarm();
    test_email_alarm();
    test_audio_alarm();
    test_custom_alarm();
    test_repeat();
    test_xprop();

    test_dates();

    test_clone();
    test_immutable();
}

function test_initial_creation() {
    dump("Testing initial creation...");
    alarm = createAlarm();

    let passed;
    try {
        alarm.icalString;
        passed = false;
    } catch (e) {
        passed = true;
    }
    if (!passed) {
        do_throw("Fresh calIAlarm should not produce a valid icalString");
    }
    dump("Done\n");
}

function test_display_alarm() {
    dump("Testing DISPLAY alarms...");
    let alarm = createAlarm();
    // Set ACTION to DISPLAY, make sure this was not rejected
    alarm.action = "DISPLAY";
    do_check_eq(alarm.action, "DISPLAY");

    // Set a Description, REQUIRED for ACTION:DISPLAY
    alarm.description = "test";
    do_check_eq(alarm.description, "test");

    // SUMMARY is not valid for ACTION:DISPLAY
    alarm.summary = "test";
    do_check_eq(alarm.summary, null);

    // TODO No attendees
    dump("Done\n");
}

function test_email_alarm() {
    dump("Testing EMAIL alarms...");
    let alarm = createAlarm();
    // Set ACTION to DISPLAY, make sure this was not rejected
    alarm.action = "EMAIL";
    do_check_eq(alarm.action, "EMAIL");

    // Set a Description, REQUIRED for ACTION:EMAIL
    alarm.description = "description";
    do_check_eq(alarm.description, "description");

    // Set a Summary, REQUIRED for ACTION:EMAIL
    alarm.summary = "summary";
    do_check_eq(alarm.summary, "summary");

    // TODO check for at least one attendee

    // TODO test attachments
    dump("Done\n");
}

function test_audio_alarm() {
    dump("Testing AUDIO alarms...");
    let alarm = createAlarm();
    // Set ACTION to AUDIO, make sure this was not rejected
    alarm.action = "AUDIO";
    do_check_eq(alarm.action, "AUDIO");

    // No Description for ACTION:AUDIO
    alarm.description = "description";
    do_check_eq(alarm.description, null);

    // No Summary, for ACTION:AUDIO
    alarm.summary = "summary";
    do_check_eq(alarm.description, null);

    // TODO No attendees
    // TODO test for one attachment
    dump("Done\n");
}

function test_custom_alarm() {
    dump("Testing X-SMS (custom) alarms...");
    let alarm = createAlarm();
    // Set ACTION to a custom value, make sure this was not rejected
    alarm.action = "X-SMS"
    do_check_eq(alarm.action, "X-SMS");

    // There is no restriction on DESCRIPTION for custom alarms
    alarm.description = "description";
    do_check_eq(alarm.description, "description");

    // There is no restriction on SUMMARY for custom alarms
    alarm.summary = "summary";
    do_check_eq(alarm.summary, "summary");

    // TODO test for attendees
    // TODO test for attachments
    dump("Done\n");
}

// Check if any combination of REPEAT and DURATION work as expected.
function test_repeat() {
    dump("Testing REPEAT and DURATION properties...");
    let message;
    let alarm = createAlarm();

    // Check initial value
    do_check_eq(alarm.repeat, 0);
    do_check_eq(alarm.repeatOffset, null);
    do_check_eq(alarm.repeatDate, null);

    // Should not be able to get REPEAT when DURATION is not set
    alarm.repeat = 1;
    do_check_eq(alarm.repeat, 0);

    // Both REPEAT and DURATION should be accessible, when the two are set.
    alarm.repeatOffset = createDuration();
    do_check_neq(alarm.repeatOffset, null);
    do_check_neq(alarm.repeat, 0);

    // Should not be able to get DURATION when REPEAT is not set
    alarm.repeat = null;
    do_check_eq(alarm.repeatOffset, null);

    // Should be able to unset alarm DURATION attribute. (REPEAT already tested above)
    try {
        alarm.repeatOffset = null;
    } catch (e) {
        do_throw("Could not set repeatOffset attribute to null" + e);
    }

    // Check final value
    do_check_eq(alarm.repeat, 0);
    do_check_eq(alarm.repeatOffset, null);
    dump("Done\n");
}

function test_xprop() {
    dump("Testing X-Props...");
    let alarm = createAlarm();
    alarm.setProperty("X-PROP", "X-VALUE");
    do_check_true(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), "X-VALUE");
    alarm.deleteProperty("X-PROP");
    do_check_false(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), null);
    dump("Done\n");
}

function test_dates() {
    dump("Testing alarm dates...");
    let passed;
    // Initial value
    let alarm = createAlarm();
    do_check_eq(alarm.alarmDate, null);
    do_check_eq(alarm.offset, null);

    // Set an offset and check it
    alarm.related = Ci.calIAlarm.ALARM_RELATED_START
    let offset = createDuration("-PT5M");
    alarm.offset = offset;
    do_check_eq(alarm.alarmDate, null);
    do_check_eq(alarm.offset, offset);
    try {
        alarm.alarmDate = createDateTime();
        passed = false;
    } catch (e) {
        passed = true;
    }
    if (!passed) {
        do_throw("Setting alarmDate when alarm is relative should not succeed");
    }

    // Set an absolute time and check it
    alarm.related = Ci.calIAlarm.ALARM_RELATED_ABSOLUTE;
    let alarmDate = createDate(2007, 0, 1, true, 2, 0, 0);
    alarm.alarmDate = alarmDate;
    do_check_eq(alarm.alarmDate, alarmDate);
    do_check_eq(alarm.offset, null);
    try {
        alarm.offset = createDuration();
        passed = false;
    } catch (e) {
        passed = true;
    }
    if (!passed) {
        do_throw("Setting offset when alarm is absolute should not succeed");
    }
    dump("Done\n");
}

let propMap = { "related": Ci.calIAlarm.ALARM_RELATED_START,
                "repeat": 1,
                "action": "X-TEST",
                "description": "description",
                "summary": "summary",
                "offset": createDuration("PT4M"),
                "repeatOffset": createDuration("PT1M")
};
let clonePropMap = { "related": Ci.calIAlarm.ALARM_RELATED_END,
                     "repeat": 2,
                     "action": "X-CHANGED",
                     "description": "description-changed",
                     "summary": "summary-changed",
                     "offset": createDuration("PT5M"),
                     "repeatOffset": createDuration("PT2M")
};
function test_immutable() {

    dump("Testing immutable alarms...");
    let passed = false;
    // Initial checks
    do_check_true(alarm.isMutable);
    alarm.makeImmutable();
    do_check_false(alarm.isMutable);

    // Check each attribute
    for (let prop in propMap) {
        try {
            alarm[prop] = propMap[prop];
        } catch (e) {
            // XXX do_check_eq(e.result, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
            continue;
        }
        do_throw("Attribute " + prop + " was writable while item was immutable");
    }

    // Functions
    try {
        alarm.setProperty("X-FOO", "BAR");
        passed = false;
    } catch (e) {
        passed = true
    }

    if (!passed) {
        do_throw("setProperty succeeded while item was immutable");
    }

    try {
        alarm.deleteProperty("X-FOO");
        passed = false;
    } catch (e) {
        passed = true;
        do_check_eq(e.result, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
    }

    if (!passed) {
        do_throw("setProperty succeeded while item was immutable");
    }
    dump("Done\n");
}

function test_clone() {
    dump("Testing cloning alarms...");
    let alarm = createAlarm();
    // Set up each attribute
    for (let prop in propMap) {
        alarm[prop] = propMap[prop];
    }
    // Make a copy
    let newAlarm = alarm.clone();
    newAlarm.makeImmutable();
    newAlarm = newAlarm.clone();
    do_check_true(newAlarm.isMutable);

    // Check if item is still the same
    // TODO This is not quite optimal, maybe someone can find a better way to do
    // the comparisons.
    for (let prop in propMap) {
        if (prop == "item") {
            do_check_eq(alarm.item.icalString, newAlarm.item.icalString)
        } else {
            if ((alarm[prop] instanceof Ci.nsISupports &&
                 alarm[prop].icalString != newAlarm[prop].icalString) ||
                !(alarm[prop] instanceof Ci.nsISupports) &&
                  alarm[prop] != newAlarm[prop]) {
                do_throw(prop + " differs, " + alarm[prop] + " == " + newAlarm[prop]);
            }
        }
    }

    // Check if changes on the cloned object do not affect the original object.
    for (let prop in clonePropMap) {
        newAlarm[prop] = clonePropMap[prop];
        dump("Checking " + prop + "...");
        do_check_neq(alarm[prop], newAlarm[prop]);
        dump("OK!\n");
        break;
    }
    dump("Done\n");
}
