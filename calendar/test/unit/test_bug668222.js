/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    let attendee = cal.createAttendee();
    attendee.id = "mailto:somebody";

    // Set the property and make sure its there
    attendee.setProperty("SCHEDULE-AGENT", "CLIENT");
    do_check_eq(attendee.getProperty("SCHEDULE-AGENT"), "CLIENT");

    // Reserialize the property, this has caused the property to go away
    // in the past.
    attendee.icalProperty = attendee.icalProperty;
    do_check_eq(attendee.getProperty("SCHEDULE-AGENT"), "CLIENT");

    // Also make sure there are no promoted properties set. This does not
    // technically belong to this bug, but I almost caused this error while
    // writing the patch.
    do_check_true(attendee.icalProperty.icalString.indexOf("RSVP") < 0);
}
