/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 Components.utils.import("resource:///modules/iteratorUtils.jsm");

function run_test() {
    test_values();
    test_serialize();
    test_properties();
}

function test_values() {
    function findAttendeesInResults(event, expectedAttendees) {
        let countObj = {};
        // Getting all attendees
        let allAttendees = event.getAttendees(countObj);
        do_check_eq(countObj.value, allAttendees.length);

        do_check_eq(allAttendees.length, expectedAttendees.length);

        // Check if all expected attendees are found
        for (let i = 0; i < expectedAttendees.length; i++) {
            do_check_neq(allAttendees.indexOf(expectedAttendees[i]), -1);
        }

        // Check if all found attendees are expected
        for (let i = 0; i < allAttendees.length; i++) {
            do_check_neq(expectedAttendees.indexOf(allAttendees[i]), -1);
        }
    }
    function findById(event, id, a) {
        let foundAttendee = event.getAttendeeById(id);
        do_check_eq(foundAttendee, a);
    }
    function testImmutability(a, properties) {
        do_check_false(a.isMutable);
        // Check if setting a property throws. It should.
        for (let i = 0; i < properties.length; i++) {
            let old = a[properties[i]];
            do_check_throws(function() {
                a[properties[i]] = old + 1;
            }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);

            do_check_eq(a[properties[i]], old);
        }
    }

    const cIA = Components.interfaces.calIAttendee;

    // Create Attendee
    var a1 = cal.createAttendee();
    // Testing attendee set/get.
    var properties = ["id", "commonName", "rsvp", "role", "participationStatus",
                      "userType"];
    var values = ["myid", "mycn", "TRUE", "CHAIR", "DECLINED", "RESOURCE"];
    // Make sure test is valid
    do_check_eq(properties.length, values.length);

    for (var i = 0; i < properties.length; i++) {
        a1[properties[i]] = values[i];
        do_check_eq(a1[properties[i]], values[i]);
    }

    // Create event
    var event = cal.createEvent();

    // Add attendee to event
    event.addAttendee(a1);

    // Add 2nd attendee to event.
    let a2 = cal.createAttendee();
    a2.id = "myid2";
    event.addAttendee(a2);

    // Finding by ID
    findById(event, "myid", a1);
    findById(event, "myid2", a2);

    findAttendeesInResults(event, [a1, a2]);

    // Making attendee immutable
    a1.makeImmutable();
    testImmutability(a1, properties);
    // Testing cascaded immutability (event -> attendee)
    event.makeImmutable();
    testImmutability(a2, properties);

    // Testing cloning
    var ec = event.clone();
    var clonedatts = ec.getAttendees({});
    var atts = event.getAttendees({});
    do_check_eq(atts.length, clonedatts.length)

    for (i = 0; i < clonedatts.length; i++) {
        // The attributes should not be equal
        do_check_neq(atts[i], clonedatts[i]);
        // But the ids should
        do_check_eq(atts[i].id, clonedatts[i].id)
    }

    // Make sure organizers are also cloned correctly
    let a3 = cal.createAttendee();
    a3.id = "horst";
    a3.isOrganizer = true;
    let a4 = a3.clone();

    do_check_true(a4.isOrganizer)
    a3.isOrganizer = false;
    do_check_true(a4.isOrganizer)
}

function test_serialize() {
    let a = cal.createAttendee();

    do_check_throws(function() {
        a.icalProperty;
    }, Components.results.NS_ERROR_NOT_INITIALIZED);

    a.id = "horst";
    a.commonName = "Horst";
    a.rsvp = "TRUE";

    a.isOrganizer = false;

    a.role = "CHAIR";
    a.participationStatus = "DECLINED";
    a.userType = "RESOURCE";

    a.setProperty("X-NAME", "X-VALUE");

    let prop = a.icalProperty;
    dump(prop.icalString);
    do_check_eq(prop.value, "horst");
    do_check_eq(prop.propertyName, "ATTENDEE");
    do_check_eq(prop.getParameter("CN"), "Horst");
    do_check_eq(prop.getParameter("RSVP"), "TRUE");
    do_check_eq(prop.getParameter("ROLE"), "CHAIR");
    do_check_eq(prop.getParameter("PARTSTAT"), "DECLINED");
    do_check_eq(prop.getParameter("CUTYPE"), "RESOURCE");
    do_check_eq(prop.getParameter("X-NAME"), "X-VALUE");

    a.isOrganizer = true;
    prop = a.icalProperty;
    do_check_eq(prop.value, "horst");
    do_check_eq(prop.propertyName, "ORGANIZER");
    do_check_eq(prop.getParameter("CN"), "Horst");
    do_check_eq(prop.getParameter("RSVP"), "TRUE");
    do_check_eq(prop.getParameter("ROLE"), "CHAIR");
    do_check_eq(prop.getParameter("PARTSTAT"), "DECLINED");
    do_check_eq(prop.getParameter("CUTYPE"), "RESOURCE");
    do_check_eq(prop.getParameter("X-NAME"), "X-VALUE");

}

function test_properties() {
    let a = cal.createAttendee();

    do_check_throws(function() {
        a.icalProperty;
    }, Components.results.NS_ERROR_NOT_INITIALIZED);

    a.id = "horst";
    a.commonName = "Horst";
    a.rsvp = "TRUE";

    a.isOrganizer = false;

    a.role = "CHAIR";
    a.participationStatus = "DECLINED";
    a.userType = "RESOURCE";

    // Only X-Props should show up in the enumerator
    a.setProperty("X-NAME", "X-VALUE");
    for each (let x in fixIterator(a.propertyEnumerator, Components.interfaces.nsIProperty)) {
        do_check_eq(x.name, "X-NAME");
        do_check_eq(x.value, "X-VALUE");
    }

    a.deleteProperty("X-NAME");
    for each (let x in fixIterator(a.propertyEnumerator, Components.interfaces.nsIProperty)) {
        do_throw("Unexpected property " + x.name + " = " + x.value);
    }

    a.setProperty("X-NAME", "X-VALUE");
    a.setProperty("X-NAME", null);

    for each (let x in fixIterator(a.propertyEnumerator, Components.interfaces.nsIProperty)) {
        do_throw("Unexpected property after setting null " + x.name + " = " + x.value);
    }
}
