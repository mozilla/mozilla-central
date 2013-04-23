/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    test_serialize();
    test_strings();
}

function test_initial_creation() {
    dump("Testing initial creation...");
    let alarm = cal.createAlarm();

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
    let alarm = cal.createAlarm();
    // Set ACTION to DISPLAY, make sure this was not rejected
    alarm.action = "DISPLAY";
    do_check_eq(alarm.action, "DISPLAY");

    // Set a Description, REQUIRED for ACTION:DISPLAY
    alarm.description = "test";
    do_check_eq(alarm.description, "test");

    // SUMMARY is not valid for ACTION:DISPLAY
    alarm.summary = "test";
    do_check_eq(alarm.summary, null);

    // No attendees allowed
    let attendee = cal.createAttendee();
    attendee.id = "mailto:horst";

    do_check_throws(function() {
        // DISPLAY alarm should not be able to save attendees
        alarm.addAttendee(attendee);
    }, Components.results.NS_ERROR_XPC_JS_THREW_JS_OBJECT);

    do_check_throws(function() {
        // DISPLAY alarm should not be able to save attachment
        alarm.addAttachment(cal.createAttachment());
    }, Components.results.NS_ERROR_XPC_JS_THREW_JS_OBJECT);

    dump("Done\n");
}

function test_email_alarm() {
    dump("Testing EMAIL alarms...");
    let alarm = cal.createAlarm();
    // Set ACTION to DISPLAY, make sure this was not rejected
    alarm.action = "EMAIL";
    do_check_eq(alarm.action, "EMAIL");

    // Set a Description, REQUIRED for ACTION:EMAIL
    alarm.description = "description";
    do_check_eq(alarm.description, "description");

    // Set a Summary, REQUIRED for ACTION:EMAIL
    alarm.summary = "summary";
    do_check_eq(alarm.summary, "summary");

    // Set an offset of some sort
    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
    alarm.offset = cal.createDuration();

    // Check for at least one attendee
    let attendee1 = cal.createAttendee();
    attendee1.id = "mailto:horst";
    let attendee2 = cal.createAttendee();
    attendee2.id = "mailto:gustav";

    do_check_eq(alarm.getAttendees({}).length, 0);
    alarm.addAttendee(attendee1);
    do_check_eq(alarm.getAttendees({}).length, 1);
    alarm.addAttendee(attendee2);
    do_check_eq(alarm.getAttendees({}).length, 2);
    alarm.addAttendee(attendee1);
    let addedAttendees = alarm.getAttendees({});
    do_check_eq(addedAttendees.length, 2);
    do_check_eq(addedAttendees[0], attendee2);
    do_check_eq(addedAttendees[1], attendee1);

    do_check_true(!!alarm.icalComponent.serializeToICS().match(/mailto:horst/));
    do_check_true(!!alarm.icalComponent.serializeToICS().match(/mailto:gustav/));

    alarm.deleteAttendee(attendee1);
    do_check_eq(alarm.getAttendees({}).length, 1);

    alarm.clearAttendees();
    do_check_eq(alarm.getAttendees({}).length, 0);

    // TODO test attachments
    dump("Done\n");
}

function test_audio_alarm() {
    dump("Testing AUDIO alarms...");
    let alarm = cal.createAlarm();
    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
    alarm.alarmDate = cal.createDateTime();
    // Set ACTION to AUDIO, make sure this was not rejected
    alarm.action = "AUDIO";
    do_check_eq(alarm.action, "AUDIO");

    // No Description for ACTION:AUDIO
    alarm.description = "description";
    do_check_eq(alarm.description, null);

    // No Summary, for ACTION:AUDIO
    alarm.summary = "summary";
    do_check_eq(alarm.summary, null);

    // No attendees allowed
    let attendee = cal.createAttendee();
    attendee.id = "mailto:horst";

    try {
        alarm.addAttendee(attendee);
        do_throw("AUDIO alarm should not be able to save attendees");
    } catch (e) {}

    // No attendee yet, should not be initialized
    do_check_throws(function() {
        alarm.icalComponent;
    }, Components.results.NS_ERROR_NOT_INITIALIZED);

    // Test attachments
    let sound = cal.createAttachment();
    sound.uri = makeURL("file:///sound.wav");
    let sound2 = cal.createAttachment();
    sound2.uri = makeURL("file:///sound2.wav");

    // Adding an attachment should work
    alarm.addAttachment(sound);
    let addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 1);
    do_check_eq(addedAttachments[0], sound);
    do_check_true(alarm.icalString.indexOf("ATTACH:file:///sound.wav") > -1);

    // Adding twice shouldn't change anything
    alarm.addAttachment(sound);
    addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 1);
    do_check_eq(addedAttachments[0], sound);

    try {
        alarm.addAttachment(sound2);
        do_throw("Adding a second alarm should fail for type AUDIO");
    } catch (e) {}

    // Deleting should work
    alarm.deleteAttachment(sound);
    addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 0);

    // As well as clearing
    alarm.addAttachment(sound);
    alarm.clearAttachments();
    addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 0);

    dump("Done\n");
}

function test_custom_alarm() {
    dump("Testing X-SMS (custom) alarms...");
    let alarm = cal.createAlarm();
    // Set ACTION to a custom value, make sure this was not rejected
    alarm.action = "X-SMS"
    do_check_eq(alarm.action, "X-SMS");

    // There is no restriction on DESCRIPTION for custom alarms
    alarm.description = "description";
    do_check_eq(alarm.description, "description");

    // There is no restriction on SUMMARY for custom alarms
    alarm.summary = "summary";
    do_check_eq(alarm.summary, "summary");

    // Test for attendees
    let attendee1 = cal.createAttendee();
    attendee1.id = "mailto:horst";
    let attendee2 = cal.createAttendee();
    attendee2.id = "mailto:gustav";

    do_check_eq(alarm.getAttendees({}).length, 0);
    alarm.addAttendee(attendee1);
    do_check_eq(alarm.getAttendees({}).length, 1);
    alarm.addAttendee(attendee2);
    do_check_eq(alarm.getAttendees({}).length, 2);
    alarm.addAttendee(attendee1);
    do_check_eq(alarm.getAttendees({}).length, 2);

    alarm.deleteAttendee(attendee1);
    do_check_eq(alarm.getAttendees({}).length, 1);

    alarm.clearAttendees();
    do_check_eq(alarm.getAttendees({}).length, 0);

    // Test for attachments
    let attach1 = cal.createAttachment();
    attach1.uri = makeURL("file:///example.txt");
    let attach2 = cal.createAttachment();
    attach2.uri = makeURL("file:///example2.txt");

    alarm.addAttachment(attach1);
    alarm.addAttachment(attach2);

    let addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 2);
    do_check_eq(addedAttachments[0], attach1);
    do_check_eq(addedAttachments[1], attach2);

    alarm.deleteAttachment(attach1);
    addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 1);

    alarm.clearAttachments();
    addedAttachments = alarm.getAttachments({});
    do_check_eq(addedAttachments.length, 0);
}

// Check if any combination of REPEAT and DURATION work as expected.
function test_repeat() {
    dump("Testing REPEAT and DURATION properties...");
    let message;
    let alarm = cal.createAlarm();

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

    // Check unset value
    do_check_eq(alarm.repeat, 0);
    do_check_eq(alarm.repeatOffset, null);

    // Check repeatDate
    alarm = cal.createAlarm();
    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
    alarm.alarmDate = cal.createDateTime();
    alarm.repeat = 1;
    alarm.repeatOffset = cal.createDuration();
    alarm.repeatOffset.inSeconds = 3600;

    let dt = alarm.alarmDate.clone();
    dt.second += 3600;
    do_check_eq(alarm.repeatDate.icalString, dt.icalString);

    dump("Done\n");
}

function test_xprop() {
    dump("Testing X-Props...");
    let alarm = cal.createAlarm();
    alarm.setProperty("X-PROP", "X-VALUE");
    do_check_true(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), "X-VALUE");
    alarm.deleteProperty("X-PROP");
    do_check_false(alarm.hasProperty("X-PROP"));
    do_check_eq(alarm.getProperty("X-PROP"), null);

    // also check X-MOZ-LASTACK prop
    let dt = cal.createDateTime();
    alarm.setProperty("X-MOZ-LASTACK", dt.icalString);
    alarm.action = "DISPLAY";
    alarm.description = "test";
    alarm.related = Ci.calIAlarm.ALARM_RELATED_START
    alarm.offset = createDuration("-PT5M");
    do_check_true(alarm.icalComponent.serializeToICS().indexOf(dt.icalString) > -1);

    alarm.deleteProperty("X-MOZ-LASTACK");
    do_check_false(alarm.icalComponent.serializeToICS().indexOf(dt.icalString) > -1);
    dump("Done\n");
}

function test_dates() {
    dump("Testing alarm dates...");
    let passed;
    // Initial value
    let alarm = cal.createAlarm();
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
    let alarm = cal.createAlarm();
    // Set up each attribute
    for (let prop in propMap) {
        alarm[prop] = propMap[prop];
    }

    // Set up some extra props
    alarm.setProperty("X-FOO", "X-VAL");
    alarm.setProperty("X-DATEPROP", cal.createDateTime());
    alarm.addAttendee(cal.createAttendee());

    let passed = false;
    // Initial checks
    do_check_true(alarm.isMutable);
    alarm.makeImmutable();
    do_check_false(alarm.isMutable);
    alarm.makeImmutable();
    do_check_false(alarm.isMutable);

    // Check each attribute
    for (let prop in propMap) {
        try {
            alarm[prop] = propMap[prop];
        } catch (e) {
            do_check_eq(e.result, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
            continue;
        }
        do_throw("Attribute " + prop + " was writable while item was immutable");
    }

    // Functions
    do_check_throws(function() {
        alarm.setProperty("X-FOO", "changed");
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);

    do_check_throws(function() {
        alarm.deleteProperty("X-FOO");
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);

    do_check_false(alarm.getProperty("X-DATEPROP").isMutable);

    dump("Done\n");
}

function test_clone() {
    dump("Testing cloning alarms...");
    let alarm = cal.createAlarm();
    // Set up each attribute
    for (let prop in propMap) {
        alarm[prop] = propMap[prop];
    }

    // Set up some extra props
    alarm.setProperty("X-FOO", "X-VAL");
    alarm.setProperty("X-DATEPROP", cal.createDateTime());
    alarm.addAttendee(cal.createAttendee());

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

    // Check x props
    alarm.setProperty("X-FOO", "BAR");
    do_check_eq(alarm.getProperty("X-FOO"), "BAR");
    let dt = alarm.getProperty("X-DATEPROP");
    do_check_eq(dt.isMutable, true);

    // Test xprop params
    alarm.icalString =
        "BEGIN:VALARM\n" +
        "ACTION:DISPLAY\n" +
        "TRIGGER:-PT15M\n" +
        "X-FOO;X-PARAM=PARAMVAL:BAR\n" +
        "DESCRIPTION:TEST\n" +
        "END:VALARM";

    newAlarm = alarm.clone();
    do_check_eq(alarm.icalString, newAlarm.icalString);

    dump("Done\n");
}

function test_serialize() {
    // most checks done by other tests, these don't fit into categories
    let alarm = cal.createAlarm();
    let srv = cal.getIcsService();

    do_check_throws(function() {
        alarm.icalComponent = srv.createIcalComponent("BARF");
    }, Components.results.NS_ERROR_INVALID_ARG);

    function addProp(k,v) { let p = srv.createIcalProperty(k); p.value = v; comp.addProperty(p) }
    function addActionDisplay() addProp("ACTION", "DISPLAY");
    function addActionEmail() addProp("ACTION", "EMAIL");
    function addTrigger() addProp("TRIGGER", "-PT15M");
    function addDescr() addProp("DESCRIPTION", "TEST");
    function addDuration() addProp("DURATION", "-PT15M");
    function addRepeat() addProp("REPEAT", "1");
    function addAttendee() addProp("ATTENDEE", "mailto:horst");
    function addAttachment() addProp("ATTACH", "data:yeah");

    // All is there, should not throw
    let comp = srv.createIcalComponent("VALARM");
    addActionDisplay(); addTrigger(); addDescr(); addDuration(); addRepeat();
    alarm.icalComponent = comp;
    alarm.toString();

    // Attachments and attendees
    let comp = srv.createIcalComponent("VALARM");
    addActionEmail(); addTrigger(); addDescr();
    addAttendee(); addAttachment();
    alarm.icalComponent = comp;
    alarm.toString();

    // Missing action
    do_check_throws(function() {
        comp = srv.createIcalComponent("VALARM");
        addTrigger(); addDescr();
        alarm.icalComponent = comp;
    }, Components.results.NS_ERROR_INVALID_ARG);

    // Missing trigger
    do_check_throws(function() {
        comp = srv.createIcalComponent("VALARM");
        addActionDisplay(); addDescr();
        alarm.icalComponent = comp;
    }, Components.results.NS_ERROR_INVALID_ARG);

    // Missing duration with repeat
    do_check_throws(function() {
        comp = srv.createIcalComponent("VALARM");
        addActionDisplay(); addTrigger(); addDescr();
        addRepeat();
        alarm.icalComponent = comp;
    }, Components.results.NS_ERROR_INVALID_ARG);

    // Missing repeat with duration
    do_check_throws(function() {
        comp = srv.createIcalComponent("VALARM");
        addActionDisplay(); addTrigger(); addDescr();
        addDuration();
        alarm.icalComponent = comp;
    }, Components.results.NS_ERROR_INVALID_ARG);

}

function test_strings() {
    // Serializing the string shouldn't throw, but we don't really care about
    // the string itself.
    let alarm = cal.createAlarm();
    alarm.action = "DISPLAY";
    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
    alarm.alarmDate = cal.createDateTime();
    alarm.toString();

    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
    alarm.offset = cal.createDuration();
    alarm.toString();
    alarm.toString(cal.createTodo());

    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_END;
    alarm.offset = cal.createDuration();
    alarm.toString();
    alarm.toString(cal.createTodo());

    alarm.offset = cal.createDuration("P1D");
    alarm.toString();

    alarm.offset = cal.createDuration("PT1H");
    alarm.toString();

    alarm.offset = cal.createDuration("-PT1H");
    alarm.toString();
}
