/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_folding();
    test_icalProps();
    test_roundtrip();
    test_duration();
    test_serialize();
}

const test_data = [
    {
      expectedDateProps: {
          month: 10,
          day: 25,
          year: 2004,
          isDate: true
      },
      expectedProps: {
          title: "Christmas",
          id: "20041119T052239Z-1000472-1-5c0746bb-Oracle",
          priority: 0,
          status: "CONFIRMED"
      },
      ics: "BEGIN:VCALENDAR\n" +
        "PRODID:-//ORACLE//NONSGML CSDK 9.0.5 - CalDAVServlet 9.0.5//EN\n" +
        "VERSION:2.0\n" +
        "BEGIN:VEVENT\n" +
        "UID:20041119T052239Z-1000472-1-5c0746bb-Oracle\n" +
        "ORGANIZER;X-ORACLE-GUID=E9359406791C763EE0305794071A39A4;CN=Simon Vaillan\n" +
        " court:mailto:simon.vaillancourt@oracle.com\n" +
        "SEQUENCE:0\n" +
        "DTSTAMP:20041124T010028Z\n" +
        "CREATED:20041119T052239Z\n" +
        "X-ORACLE-EVENTINSTANCE-GUID:I1+16778354+1+1+438153759\n" +
        "X-ORACLE-EVENT-GUID:E1+16778354+1+438153759\n" +
        "X-ORACLE-EVENTTYPE:DAY EVENT\n" +
        "TRANSP:TRANSPARENT\n" +
        "SUMMARY:Christmas\n" +
        "STATUS:CONFIRMED\n" +
        "PRIORITY:0\n" +
        "DTSTART;VALUE=DATE:20041125\n" +
        "DTEND;VALUE=DATE:20041125\n" +
        "CLASS:PUBLIC\n" +
        "ATTENDEE;X-ORACLE-GUID=E92F51FB4A48E91CE0305794071A149C;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=James Stevens;PARTSTAT=NEEDS-ACTION:mailto:james.stevens@o\n" +
        " racle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791C763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=FALSE;CN=Simon Vaillancourt;PARTSTAT=ACCEPTED:mailto:simon.vaillan\n" +
        " court@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791D763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Bernard Desruisseaux;PARTSTAT=NEEDS-ACTION:mailto:bernard.\n" +
        " desruisseaux@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791E763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Mario Bonin;PARTSTAT=NEEDS-ACTION:mailto:mario.bonin@oracl\n" +
        " e.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791F763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Jeremy Chone;PARTSTAT=NEEDS-ACTION:mailto:jeremy.chone@ora\n" +
        " cle.com\n" +
        "ATTENDEE;X-ORACLE-PERSONAL-COMMENT-ISDIRTY=TRUE;X-ORACLE-GUID=E9359406792\n" +
        " 0763EE0305794071A39A4;CUTYPE=INDIVIDUAL;RSVP=TRUE;CN=Mike Shaver;PARTSTA\n" +
        " T=NEEDS-ACTION:mailto:mike.x.shaver@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067921763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=David Ball;PARTSTAT=NEEDS-ACTION:mailto:david.ball@oracle.\n" +
        " com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067922763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Marten Haring;PARTSTAT=NEEDS-ACTION:mailto:marten.den.hari\n" +
        " ng@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067923763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Peter Egyed;PARTSTAT=NEEDS-ACTION:mailto:peter.egyed@oracl\n" +
        " e.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067924763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Francois Perrault;PARTSTAT=NEEDS-ACTION:mailto:francois.pe\n" +
        " rrault@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067925763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Vladimir Vukicevic;PARTSTAT=NEEDS-ACTION:mailto:vladimir.v\n" +
        " ukicevic@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067926763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Cyrus Daboo;PARTSTAT=NEEDS-ACTION:mailto:daboo@isamet.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067927763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Lisa Dusseault;PARTSTAT=NEEDS-ACTION:mailto:lisa@osafounda\n" +
        " tion.org\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067928763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Dan Mosedale;PARTSTAT=NEEDS-ACTION:mailto:dan.mosedale@ora\n" +
        " cle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067929763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Stuart Parmenter;PARTSTAT=NEEDS-ACTION:mailto:stuart.parme\n" +
        " nter@oracle.com\n" +
        "END:VEVENT\n" +
        "END:VCALENDAR\n"
    },
    {
        expectedProps: {
            "x-magic": "mymagicstring"
        },
        ics: "BEGIN:VEVENT\n" +
             "UID:1\n" +
             "DTSTART:20070521T100000Z\n" +
             "X-MAGIC:mymagicstring\n" +
             "END:VEVENT"
    }
];

function test_roundtrip() {
    function checkEvent(data, event) {
        checkRoundtrip(data.expectedProps, event);

        // Checking dates
        if ("expectedDateProps" in data) {
            checkProps(data.expectedDateProps, event.startDate);
            checkProps(data.expectedDateProps, event.endDate);
        }
    }

    let icssrv = cal.getIcsService();

    for each (var data in test_data) {
        // First round, use the icalString setter which uses synchronous parsing
        dump("Checking" + data.ics + "\n");
        let event = createEventFromIcalString(data.ics);
        checkEvent(data, event);

        // Now, try the same thing with asynchronous parsing. We need a copy of
        // the data variable, otherwise javascript will mix the data between
        // foreach loop iterations.
        do_test_pending();
        let thisdata = data;
        icssrv.parseICSAsync(data.ics, null, {
            onParsingComplete: function onParsingComplete(rc, rootComp) {
                try {
                    do_check_true(Components.isSuccessCode(rc));
                    let event2 = cal.createEvent();
                    event2.icalComponent = rootComp;
                    checkEvent(thisdata, event2);
                    do_test_finished();
                } catch (e) {
                    do_throw(e + "\n");
                    do_test_finished();
                }
            }
         });
    }
}

function test_folding() {
    // check folding
    const id = "loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong-id-provoking-folding";
    let todo = cal.createTodo(), todo_ = cal.createTodo();
    todo.id = id;
    todo_.icalString = todo.icalString;
    do_check_eq(todo.id, todo_.id);
    do_check_eq(todo_.icalComponent.getFirstProperty("UID").value, id);
}

function test_icalProps() {
    checkIcalProp("ATTACH", cal.createAttachment());
    checkIcalProp("ATTENDEE", cal.createAttendee());
    checkIcalProp("RELATED-TO", cal.createRelation());
}

/*
 * Helper functions
 */

function checkIcalProp(aPropName, aObj) {
    let icssvc = cal.getIcsService();
    let prop1 = icssvc.createIcalProperty(aPropName);
    let prop2 = icssvc.createIcalProperty(aPropName);
    prop1.value = "foo";
    prop2.value = "bar";
    prop1.setParameter("X-FOO", "BAR");

    if (aObj.setParameter) {
        aObj.icalProperty = prop1;
        do_check_eq(aObj.getParameter("X-FOO"), "BAR");
        aObj.icalProperty = prop2;
        do_check_eq(aObj.getParameter("X-FOO"), null);
    } else if (aObj.setProperty) {
        aObj.icalProperty = prop1;
        do_check_eq(aObj.getProperty("X-FOO"), "BAR");
        aObj.icalProperty = prop2;
        do_check_eq(aObj.getProperty("X-FOO"), null);
    }
}

function checkProps(expectedProps, obj) {
    for (let key in expectedProps) {
        do_check_eq(obj[key], expectedProps[key]);
    }
}

function checkRoundtrip(expectedProps, obj) {
    let icsdata = obj.icalString;
    for (let key in expectedProps) {
        // Need translation
        let icskey = key;
        switch (key) {
            case "id":
                icskey = "uid";
                break;
            case "title":
                icskey = "summary";
                break;
        }
        do_check_true(icsdata.indexOf(icskey.toUpperCase()) > 0);
        do_check_true(icsdata.indexOf(expectedProps[key]) > 0);
    }
}

function test_duration() {
    let e = cal.createEvent();
    e.startDate = cal.createDateTime();
    e.endDate = null;
    do_check_eq(e.duration.icalString, "PT0S");
}

function test_serialize() {
    let e = cal.createEvent();
    let prop = cal.getIcsService().createIcalComponent("VTODO");

    do_check_throws(function() {
        e.icalComponent = prop;
    }, Components.results.NS_ERROR_INVALID_ARG);
}
