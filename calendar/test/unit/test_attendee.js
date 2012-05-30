/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    var eventClass = Cc["@mozilla.org/calendar/event;1"];
    var eventIID = Ci.calIEvent;

    var attendeeClass = Cc["@mozilla.org/calendar/attendee;1"];
    var attendeeIID = Ci.calIAttendee;

    // Create Attendee
    var a1 = attendeeClass.createInstance(attendeeIID);
    // Testing attendee set/get.
    var properties = ["id", "commonName", "rsvp", "role", "participationStatus",
                      "userType"];
    var values = ["myid", "mycn", "TRUE", attendeeIID.ROLE_CHAIR,
                  attendeeIID.PARTSTAT_DECLINED,
                  attendeeIID.CUTYPE_RESOURCE];
    // Make sure test is valid
    do_check_eq(properties.length, values.length);

    for (var i = 0; i < properties.length; i++) {
        a1[properties[i]] = values[i];
        do_check_eq(a1[properties[i]], values[i]);
    }

    // Create event
    var event = eventClass.createInstance(eventIID);

    // Add attendee to event
    event.addAttendee(a1);

    // Add 2nd attendee to event.
    var a2 = attendeeClass.createInstance(attendeeIID);
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
}

function findById(event, id, a) {
    var foundAttendee = event.getAttendeeById(id);
    do_check_eq(foundAttendee, a);
}

function findAttendeesInResults(event, expectedAttendees) {
    var countObj = {};
    // Getting all attendees
    var allAttendees = event.getAttendees(countObj);
    do_check_eq(countObj.value, allAttendees.length);

    do_check_eq(allAttendees.length, expectedAttendees.length);

    // Check if all expected attendees are found
    for (var i = 0; i < expectedAttendees.length; i++) {
        do_check_neq(allAttendees.indexOf(expectedAttendees[i]), -1);
    }

    // Check if all found attendees are expected
    for (var i = 0; i < allAttendees.length; i++) {
        do_check_neq(expectedAttendees.indexOf(allAttendees[i]), -1);
    }
}

function testImmutability(a, properties) {
    do_check_false(a.isMutable);
    // Check if setting a property throws. It should.
    for (var i = 0; i < properties.length; i++) {
        var old = a[properties[i]];
        var threw;
        try {
            a[properties[i]] = old + 1;
            threw = false;
        } catch (ex) {
            threw = true;
        }
        do_check_true(threw);
        do_check_eq(a[properties[i]], old);
    }
}
