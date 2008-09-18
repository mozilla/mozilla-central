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

var alarm;

function run_test() {
    test_initial_creation();

    test_display_alarm();
    test_email_alarm();
    test_audio_alarm();
    test_custom_alarm();
    test_repeat();
    test_xprop();

    test_event();
    test_todo();

    test_clone();
    test_immutable();
}

function test_initial_creation() {
    alarm = Cc["@mozilla.org/calendar/alarm;1"].createInstance(Ci.calIAlarm);
    setupPropMap();

    var passed = true;
    try {
        alarm.icalString;
        passed = false;
    } catch (e) {
        passed = true;
    }
    if (!passed) {
        do_throw("Fresh calIAlarm should not produce a valid icalString");
    }
}

function test_display_alarm() {
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
}

function test_email_alarm() {
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
}

function test_audio_alarm() {
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
}

function test_custom_alarm() {
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
}

// Check if any combination of REPEAT and DURATION work as expected.
function test_repeat() {
    var message;

    // Check initial value
    do_check_eq(alarm.repeat, 0);
    do_check_eq(alarm.repeatOffset, null);
    do_check_eq(alarm.repeatDate, null);

    // Should not be able to get REPEAT when DURATION is not set
    alarm.repeat = 1;
    do_check_eq(alarm.repeat, 0);

    // Both REPEAT and DURATION should be accessible, when the two are set.
    alarm.repeatOffset = Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration);
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
}

function test_xprop() {
    alarm.setProperty("X-PROP", "X-VALUE");
    do_check_true(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), "X-VALUE");
    alarm.deleteProperty("X-PROP");
    do_check_false(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), null);
}

function test_event() {
    alarm.item = Cc["@mozilla.org/calendar/event;1"].createInstance(Ci.calIEvent);

    alarm.item.startDate = createDate(2007, 0, 1, true, 1, 0, 0);
    alarm.item.endDate = createDate(2007, 0, 1, true, 2, 0, 0);

    check_alarm_dates();
}

function test_todo() {
    alarm.item = Cc["@mozilla.org/calendar/todo;1"].createInstance(Ci.calITodo);

    alarm.item.entryDate = createDate(2007, 0, 1, true, 1, 0, 0);
    alarm.item.dueDate = createDate(2007, 0, 1, true, 2, 0, 0);

    check_alarm_dates();
}

function check_alarm_dates() {
    // Initial value
    do_check_eq(alarm.alarmDate, null);

    // Set an offset and check it
    var offset = Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration);
    offset.icalString = "-PT5M";
    alarm.offset = offset;
    do_check_eq(alarm.offset, offset);

    // Check if the absolute alarmDate is correct
    var fiveMinutesBefore = createDate(2007, 0, 1, true, 0, 55, 0);
    do_check_eq(alarm.alarmDate.compare(fiveMinutesBefore), 0);

    // Set an absolute time and check it
    var alarmDate =  createDate(2007, 0, 1, true, 2, 0, 0);
    alarm.alarmDate = alarmDate;
    do_check_eq(alarm.alarmDate, alarmDate);

    // Check if the offset matches the absoluteDate
    do_check_eq(alarm.related, Ci.calIAlarm.ALARM_RELATED_START);
    do_check_eq(alarm.offset.icalString, "PT1H");

    // Check the same, related to the end
    alarm.related = Ci.calIAlarm.ALARM_RELATED_END;
    do_check_eq(alarm.offset.icalString, "PT0S");

    // Unsetting alarmDate should also unset the offset
    alarm.alarmDate = null;
    do_check_eq(alarm.alarmDate, null);
    do_check_eq(alarm.offset, null);

    // Return relation to start
    alarm.related = Ci.calIAlarm.ALARM_RELATED_START;
}

function setupPropMap() {
    if (!propMap.ics) {
        var icssvc = Components.classes["@mozilla.org/calendar/ics-service;1"]
                               .getService(Components.interfaces.calIICSService);
        var ics = "BEGIN:VALARM\nACTION:DISPLAY\nTRIGGER:PT0S\nEND:VALARM";
        var icsComp = icssvc.parseICS(ics, null);

        propMap.item.startDate = Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime);
        propMap.item.endDate = Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime);

        propMap.item.startDate.jsDate = (new Date());
        propMap.item.endDate.jsDate = (new Date());

        propMap.icalString = ics;
        propMap.icalComponent = icsComp;

    }
    if (!clonePropMap.ics) {
        var icssvc = Components.classes["@mozilla.org/calendar/ics-service;1"]
                               .getService(Components.interfaces.calIICSService);
        var ics = "BEGIN:VALARM\nACTION:X-CHANGED2\nTRIGGER:PT1S\nEND:VALARM";
        var icsComp = icssvc.parseICS(ics, null);

        clonePropMap.item.startDate = Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime);
        clonePropMap.item.endDate = Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime);

        clonePropMap.item.startDate.jsDate = (new Date());
        clonePropMap.item.endDate.jsDate = (new Date());

        clonePropMap.icalString = ics;
        clonePropMap.icalComponent = icsComp;
    }
}

var propMap = { "item": Cc["@mozilla.org/calendar/event;1"].createInstance(Ci.calIEvent),
                "related": Ci.calIAlarm.ALARM_RELATED_END,
                "repeat": 1,
                "action": "X-TEST",
                "description": "description",
                "summary": "summary",
                "icalString": null,
                "icalComponent": null,
                "lastAck": Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime),
                "offset": Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration),
                "alarmDate": Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime),
                "repeatOffset": Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration)
};
var clonePropMap = { "item": Cc["@mozilla.org/calendar/event;1"].createInstance(Ci.calIEvent),
                     "related": Ci.calIAlarm.ALARM_RELATED_START,
                     "repeat": 2,
                     "action": "X-CHANGED",
                     "description": "description-changed",
                     "summary": "summary-changed",
                     "icalString": null,
                     "icalComponent": null,
                     "lastAck": Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime),
                     "offset": Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration),
                     "alarmDate": Cc["@mozilla.org/calendar/datetime;1"].createInstance(Ci.calIDateTime),
                     "repeatOffset": Cc["@mozilla.org/calendar/duration;1"].createInstance(Ci.calIDuration)
};

function test_immutable() {
    var passed = false;
    // Initial checks
    do_check_true(alarm.isMutable);
    alarm.makeImmutable();
    do_check_false(alarm.isMutable);

    // Check each attribute
    for (var prop in propMap) {
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

}

function test_clone() {
    // Set up each attribute
    for (var prop in propMap) {
        if (prop == "icalString" || prop == "icalComponent") {
            continue;
        }
        alarm[prop] = propMap[prop];
    }
    // Make a copy
    var newAlarm = alarm.clone();
    newAlarm.makeImmutable();
    newAlarm = newAlarm.clone();
    do_check_true(newAlarm.isMutable);

    // Check if item is still the same
    // TODO This is not quite optimal, maybe someone can find a better way to do
    // the comparisons.
    for (var prop in propMap) {
        switch (prop) {
            case "item":
                do_check_eq(alarm.item.getProperty("CREATED").icalString, newAlarm.item.getProperty("CREATED").icalString)
                break;
            case "icalString":
            case "icalComponent":
                break;
            default:
                if ((alarm[prop] instanceof Ci.nsISupports && alarm[prop].icalString != newAlarm[prop].icalString) ||
                     !(alarm[prop] instanceof Ci.nsISupports) && alarm[prop] != newAlarm[prop]) {
                    do_throw(prop + " differs, " + alarm[prop] + " == " + newAlarm[prop]);
                }
                break;
        }
    }

    // Check if changes on the cloned object do not affect the original object.
    for (var prop in clonePropMap) {
        switch (prop) {
            case "icalString":
            case "icalComponent":
                break;
            default:
                newAlarm[prop] = clonePropMap[prop];
                dump("Checking " + prop + "...");
                do_check_neq(alarm[prop], newAlarm[prop]);
                dump("OK!\n");
                break;
        }
    }
}
