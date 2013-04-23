/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_aclmanager();
    test_calendar();
    test_immutable();
    test_attendee();
    test_attachment();
    test_lastack();
    test_categories();
    test_alarm();

}

function test_aclmanager() {
    let mockCalendar = {
        get superCalendar() this,
        get aclManager() this,

        getItemEntry: function(item) {
            if (item.id == "withentry") {
                return itemEntry;
            }
            return null;
        },
    };

    let itemEntry = {
        userCanModify: true,
        userCanRespond: false,
        userCanViewAll: true,
        userCanViewDateAndTime: false,
    };

    let e = cal.createEvent();
    e.id = "withentry";
    e.calendar = mockCalendar;

    do_check_eq(e.aclEntry.userCanModify, itemEntry.userCanModify);
    do_check_eq(e.aclEntry.userCanRespond, itemEntry.userCanRespond);
    do_check_eq(e.aclEntry.userCanViewAll, itemEntry.userCanViewAll);
    do_check_eq(e.aclEntry.userCanViewDateAndTime, itemEntry.userCanViewDateAndTime);

    let pe = cal.createEvent();
    pe.id = "parententry";
    pe.calendar = mockCalendar;
    pe.parentItem = e;

    do_check_eq(pe.aclEntry.userCanModify, itemEntry.userCanModify);
    do_check_eq(pe.aclEntry.userCanRespond, itemEntry.userCanRespond);
    do_check_eq(pe.aclEntry.userCanViewAll, itemEntry.userCanViewAll);
    do_check_eq(pe.aclEntry.userCanViewDateAndTime, itemEntry.userCanViewDateAndTime);

    e = cal.createEvent();
    e.id = "noentry";
    e.calendar = mockCalendar;
    do_check_eq(e.aclEntry, null);

}

function test_calendar() {

    let e = cal.createEvent();
    let pe = cal.createEvent();

    let mockCalendar = {
        id: "one"
    };

    pe.calendar = mockCalendar;
    e.parentItem = pe;

    do_check_neq(e.calendar, null);
    do_check_eq(e.calendar.id, "one");
}

function test_attachment() {
    let e = cal.createEvent();

    let a = cal.createAttachment();
    a.rawData = "horst";

    let b = cal.createAttachment();
    b.rawData = "bruno";

    e.addAttachment(a);
    do_check_eq(e.getAttachments({}).length, 1);

    e.addAttachment(b);
    do_check_eq(e.getAttachments({}).length, 2);

    e.removeAttachment(a);
    do_check_eq(e.getAttachments({}).length, 1);

    e.removeAllAttachments();
    do_check_eq(e.getAttachments({}).length, 0);
}

function test_attendee() {

    let e = cal.createEvent();
    do_check_eq(e.getAttendeeById("unknown"), null);
    do_check_eq(e.getAttendees({}).length, 0);

    let a = cal.createAttendee();
    a.id = "mailto:horst";

    let b = cal.createAttendee();
    b.id = "mailto:bruno";

    e.addAttendee(a);
    do_check_eq(e.getAttendees({}).length, 1);
    do_check_eq(e.getAttendeeById("mailto:horst"), a);

    e.addAttendee(b);
    do_check_eq(e.getAttendees({}).length, 2);

    let comp = e.icalComponent;
    let aprop = comp.getFirstProperty("ATTENDEE");
    do_check_eq(aprop.value, "mailto:horst");
    aprop = comp.getNextProperty("ATTENDEE");
    do_check_eq(aprop.value, "mailto:bruno");
    do_check_eq(comp.getNextProperty("ATTENDEE"), null);

    e.removeAttendee(a);
    do_check_eq(e.getAttendees({}).length, 1);
    do_check_eq(e.getAttendeeById("mailto:horst"), null);

    e.removeAllAttendees();
    do_check_eq(e.getAttendees({}).length, 0);
}

function test_categories() {

    let e = cal.createEvent();

    do_check_eq(e.getCategories({}).length, 0);

    let cat = ["a", "b", "c"];
    e.setCategories(3, cat);

    cat[0] = "err";
    do_check_eq(e.getCategories({}).join(","), "a,b,c");

    let comp = e.icalComponent;
    let getter = comp.getFirstProperty.bind(comp);

    cat[0] = "a";
    while (cat.length) {
        do_check_eq(cat.shift(), getter("CATEGORIES").value);
        getter = comp.getNextProperty.bind(comp);
    }
}

function test_alarm() {
    let e = cal.createEvent();
    let alarm = cal.createAlarm();

    alarm.action = "DISPLAY";
    alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;
    alarm.alarmDate = cal.createDateTime();

    e.addAlarm(alarm);
    let ecomp = e.icalComponent;
    let vcomp = ecomp.getFirstSubcomponent("VALARM");
    do_check_eq(vcomp.serializeToICS(), alarm.icalString);

    let alarm2 = alarm.clone();

    e.addAlarm(alarm2);

    do_check_eq(e.getAlarms({}).length, 2);
    e.deleteAlarm(alarm);
    do_check_eq(e.getAlarms({}).length, 1);
    do_check_eq(e.getAlarms({})[0], alarm2);

    e.clearAlarms();
    do_check_eq(e.getAlarms({}).length, 0);
}

function test_immutable() {

    let e = cal.createEvent();

    let dt = cal.createDateTime();
    dt.timezone = cal.getTimezoneService().getTimezone("Europe/Berlin");
    e.alarmLastAck = dt;

    let org = cal.createAttendee();
    org.id = "one";
    e.organizer = org;

    let alarm = cal.createAlarm();
    alarm.action = "DISPLAY";
    alarm.description = "foo";
    alarm.related = alarm.ALARM_RELATED_START;
    alarm.offset = cal.createDuration("PT1S");
    e.addAlarm(alarm);

    e.setProperty("X-NAME", "X-VALUE");
    e.setPropertyParameter("X-NAME", "X-PARAM", "X-PARAMVAL");

    e.setCategories(3, ["a", "b", "c"]);

    do_check_eq(e.alarmLastAck.timezone.tzid, cal.UTC().tzid);

    e.makeImmutable();

    // call again, should not throw
    e.makeImmutable();

    do_check_false(e.alarmLastAck.isMutable);
    do_check_false(org.isMutable);
    do_check_false(alarm.isMutable);

    do_check_throws(function() {
        e.alarmLastAck = cal.createDateTime();
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
    do_check_throws(function() {
        e.calendar = null;
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
    do_check_throws(function() {
        e.parentItem = null;
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
    do_check_throws(function() {
        e.setCategories(3, ["d", "e", "f"]);
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);

    let e2 = e.clone();
    e2.organizer.id = "two";

    do_check_eq(org.id, "one");
    do_check_eq(e2.organizer.id, "two");

    do_check_eq(e2.getProperty("X-NAME"), "X-VALUE");
    do_check_eq(e2.getPropertyParameter("X-NAME", "X-PARAM"), "X-PARAMVAL");

    e2.setPropertyParameter("X-NAME", "X-PARAM", null);
    do_check_eq(e2.getPropertyParameter("X-NAME", "X-PARAM"), null);

    // TODO more clone checks
}

function test_lastack() {

    let e = cal.createEvent();

    e.alarmLastAck = cal.createDateTime("20120101T010101");

    // Our items don't support this yet
    //do_check_eq(e.getProperty("X-MOZ-LASTACK"), "20120101T010101");

    let comp = e.icalComponent;
    let prop = comp.getFirstProperty("X-MOZ-LASTACK");

    do_check_eq(prop.value, "20120101T010101Z");

    prop.value = "20120101T010102Z";

    e.icalComponent = comp;

    do_check_eq(e.alarmLastAck.icalString, "20120101T010102Z");
}
