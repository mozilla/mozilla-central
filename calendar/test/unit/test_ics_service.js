/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_iterator();
    test_icalcomponent();
    test_icsservice();
    test_icalstring();
    test_param();

    // Only supported with ical.js
    if (cal.getPrefSafe("calendar.icaljs", false)) test_icalproperty();
}

function test_icalstring() {
    function checkComp(createFunc, icalString, members, properties) {
        let thing = createFunc(icalString);
        do_check_eq(thing.icalString, ics_foldline(icalString) + "\r\n");

        if (members) {
            for (let k in members) {
                do_check_eq(thing[k], members[k]);
            }
        }

        if (properties) {
            for (let k in properties) {
                if ("getParameter" in thing) {
                    do_check_eq(thing.getParameter(k), properties[k]);
                } else if ("getProperty" in thing) {
                    do_check_eq(thing.getProperty(k), properties[k]);
                }
            }
        }
        return thing;
    }

    let attach = checkComp(cal.createAttachment.bind(cal),
                           "ATTACH;ENCODING=BASE64;FMTTYPE=text/calendar;FILENAME=test.ics:http://example.com/test.ics",
                           { formatType: "text/calendar", encoding: "BASE64" },
                           { FILENAME: "test.ics" });
    do_check_eq(attach.uri.spec, "http://example.com/test.ics");

    checkComp(cal.createAttendee.bind(cal),
              "ATTENDEE;RSVP=TRUE;CN=Name;PARTSTAT=ACCEPTED;CUTYPE=RESOURCE;ROLE=REQ-PARTICIPANT;X-THING=BAR:mailto:test@example.com",
              { id: "mailto:test@example.com", commonName: "Name", rsvp: "TRUE",
                isOrganizer: false, role: "REQ-PARTICIPANT", participationStatus: "ACCEPTED",
                userType: "RESOURCE" },
              { "X-THING": "BAR" });

    checkComp(cal.createRelation.bind(cal),
              "RELATED-TO;RELTYPE=SIBLING;FOO=BAR:VALUE",
              { relType: "SIBLING", relId: "VALUE" },
              { FOO: "BAR" });

    let rrule = checkComp(cal.createRecurrenceRule.bind(cal),
                          "RRULE:FREQ=WEEKLY;COUNT=5;INTERVAL=2;BYDAY=MO",
                          { count: 5, isByCount: true, type: "WEEKLY", interval: 2 });
    do_check_eq(rrule.getComponent("BYDAY", {}).toString(), [2].toString());

    if (cal.getPrefSafe("calendar.icaljs", false)) {
        let rdate = checkComp(cal.createRecurrenceDate.bind(cal),
                              "RDATE:20120101T000000",
                              { isNegative: false });
        do_check_eq(rdate.date.compare(cal.createDateTime("20120101T000000")), 0);
    } else {
        let rdate = checkComp(cal.createRecurrenceDate.bind(cal),
                              "RDATE;VALUE=DATE-TIME:20120101T000000",
                              { isNegative: false });
        do_check_eq(rdate.date.compare(cal.createDateTime("20120101T000000")), 0);
    }

    /* TODO consider removing period support, ics throws badarg
    let rdateperiod = checkComp(cal.createRecurrenceDate.bind(cal),
                                "RDATE;VALUE=PERIOD;20120101T000000Z/20120102T000000Z");
    do_check_eq(rdate.date.compare(cal.createDateTime("20120101T000000Z")), 0);
    */

    let exdate = checkComp(cal.createRecurrenceDate.bind(cal),
                           "EXDATE:20120101T000000",
                           { isNegative: true });
    do_check_eq(exdate.date.compare(cal.createDateTime("20120101T000000")), 0);
}

function test_icsservice() {
    let svc = cal.getIcsService();

    function checkProp(createFunc, icalString, members, parameters) {
        let thing = createFunc(icalString);
        do_check_eq(thing.icalString, ics_foldline(icalString) + "\r\n");

        for (let k in members) {
            do_check_eq(thing[k], members[k]);
        }

        for (let k in parameters) {
            do_check_eq(thing.getParameter(k), parameters[k]);
        }
        return thing;
    }

    // Test ::createIcalPropertyFromString
    checkProp(svc.createIcalPropertyFromString.bind(svc),
              "ATTACH;ENCODING=BASE64;FMTTYPE=text/calendar;FILENAME=test.ics:http://example.com/test.ics",
              { value: "http://example.com/test.ics", propertyName: "ATTACH" },
              { ENCODING: "BASE64", FMTTYPE: "text/calendar", FILENAME: "test.ics" });

    // Test ::createIcalProperty
    let attach2 = svc.createIcalProperty("ATTACH");
    do_check_eq(attach2.propertyName, "ATTACH");
    attach2.value = "http://example.com/";
    do_check_eq(attach2.icalString, "ATTACH:http://example.com/\r\n");
}

function test_icalproperty() {
    let svc = cal.getIcsService();
    let comp = svc.createIcalComponent("VEVENT");
    let comp2 = svc.createIcalComponent("VTODO");
    let prop = svc.createIcalProperty("PROP");
    prop.value = "VAL";

    comp.addProperty(prop);
    do_check_eq(prop.parent.toString(), comp.toString());
}

function test_icalcomponent() {
    let svc = cal.getIcsService();
    let event = svc.createIcalComponent("VEVENT");
    let todo = svc.createIcalComponent("VTODO");
    let alarm = svc.createIcalComponent("VALARM");
    event.addSubcomponent(alarm);

    do_check_eq(alarm.parent.toString(), event.toString());

    function check_getset(k, v) {
        dump("Checking " + k + " = " + v + "\n");
        event[k] = v;
        vstring = v.icalString || v;
        do_check_eq(event[k].icalString || event[k], vstring);
        do_check_eq(event.serializeToICS().match(new RegExp(vstring, "g")).length, 1);
        event[k] = v;
        do_check_eq(event.serializeToICS().match(new RegExp(vstring, "g")).length, 1);
    }

    let props = [
       ["uid", "123"],
       ["prodid", "//abc/123"],
       ["version", "2.0"],
       ["method", "REQUEST"],
       ["status", "TENTATIVE"],
       ["summary", "sum"],
       ["description", "descr"],
       ["location", "here"],
       ["categories", "cat"],
       ["URL", "url"],
       ["priority", 5],
       ["startTime", cal.createDateTime("20120101T010101")],
       ["endTime", cal.createDateTime("20120101T010102")],
       /* TODO readonly, how to set... ["duration", cal.createDuration("PT2S")], */
       ["dueTime", cal.createDateTime("20120101T010103")],
       ["stampTime", cal.createDateTime("20120101T010104")],
       ["createdTime", cal.createDateTime("20120101T010105")],
       ["completedTime", cal.createDateTime("20120101T010106")],
       ["lastModified", cal.createDateTime("20120101T010107")],
       ["recurrenceId", cal.createDateTime("20120101T010108")]
    ];

    for each (let prop in props) {
        check_getset.apply(null, prop);
    }
}

function test_param() {
    let svc = cal.getIcsService();
    let prop = svc.createIcalProperty("DTSTART");
    prop.value = "20120101T010101";
    do_check_eq(prop.icalString, "DTSTART:20120101T010101\r\n");
    prop.setParameter("VALUE", "TEXT");
    do_check_eq(prop.icalString, "DTSTART;VALUE=TEXT:20120101T010101\r\n");
    prop.removeParameter("VALUE");
    do_check_eq(prop.icalString, "DTSTART:20120101T010101\r\n");

    prop.setParameter("X-FOO", "BAR");
    do_check_eq(prop.icalString, "DTSTART;X-FOO=BAR:20120101T010101\r\n");
    prop.removeParameter("X-FOO", "BAR");
    do_check_eq(prop.icalString, "DTSTART:20120101T010101\r\n");

}

function test_iterator() {
    let svc = cal.getIcsService();

    // Property iterator
    let comp = svc.createIcalComponent("VEVENT");
    let propNames = ["X-ONE", "X-TWO"];
    for (let i = 0; i < propNames.length; i++) {
        let prop = svc.createIcalProperty(propNames[i]);
        prop.value = "" + (i+1);
        comp.addProperty(prop);
    }

    for (let p = comp.getFirstProperty("ANY");
         p;
         p = comp.getNextProperty("ANY")) {
        do_check_eq(p.propertyName, propNames.shift());
    }
    propNames = ["X-ONE", "X-TWO"];
    for (let p = comp.getNextProperty("ANY");
         p;
         p = comp.getNextProperty("ANY")) {
        do_check_eq(p.propertyName, propNames.shift());
    }

    // Param iterator
    let prop = svc.createIcalProperty("DTSTART");
    let params = ["X-ONE", "X-TWO"];
    for (let i = 0; i < params.length; i++) {
        prop.setParameter(params[i], "" + (i+1));
    }

    for (let p = prop.getFirstParameterName();
         p;
         p = prop.getNextParameterName()) {
        do_check_eq(p, params.shift());
    }

    // Now try again, but start with next. Should act like first
    params = ["X-ONE", "X-TWO"];
    for (let p = prop.getNextParameterName();
         p;
         p = prop.getNextParameterName()) {
        do_check_eq(p, params.shift());
    }
}
