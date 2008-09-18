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
 * The Original Code is mozilla calendar tests code.
 *
 * The Initial Developer of the Original Code is
 *   Dan Mosedale <dmose@mozilla.org>
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michiel van Leeuwen <mvl@exedo.nl>
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
    var values = ["myid", "mycn", true, attendeeIID.ROLE_CHAIR,
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
