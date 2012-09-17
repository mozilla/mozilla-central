/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_icsservice();
    test_icalstring();
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

    let rdate = checkComp(cal.createRecurrenceDate.bind(cal),
                          "RDATE;VALUE=DATE-TIME:20120101T000000",
                          { isNegative: false });
    do_check_eq(rdate.date.compare(cal.createDateTime("20120101T000000")), 0);

    let exdate = checkComp(cal.createRecurrenceDate.bind(cal),
                           "EXDATE:20120101T000000",
                           { isNegative: true });
    do_check_eq(rdate.date.compare(cal.createDateTime("20120101T000000")), 0);
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
    do_check_throws(function() {
        attach2.value;
    }, Components.results.NS_ERROR_FAILURE);
}
