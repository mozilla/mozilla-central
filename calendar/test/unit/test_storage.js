/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    testAttachRoundtrip();
}

function testAttachRoundtrip() {
    let storage = getStorageCal();
    let str = ["BEGIN:VEVENT",
               "UID:attachItem",
               "DTSTART:20120101T010101Z",
               "ATTACH;FMTTYPE=text/calendar;ENCODING=BASE64;FILENAME=test.ics:http://example.com/test.ics",
               "ATTENDEE;RSVP=TRUE;CUTYPE=INDIVIDUAL;CN=Name;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT;X-THING=BAR:mailto:test@example.com",
               "RELATED-TO;RELTYPE=SIBLING;FOO=BAR:VALUE",
               "RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=5;BYDAY=MO",
               "RDATE:20120201T010101Z",
               "EXDATE:20120301T010101Z",
               "END:VEVENT"].join("\r\n");

    let item = createEventFromIcalString(str);

    do_test_pending();
    storage.addItem(item, {
        onOperationComplete: function checkAddedItem(c, s, o, i, addedItem) {
            do_execute_soon(function() {
                // Make sure the cache is cleared, otherwise we'll get the cached item.
                delete storage.wrappedJSObject.mItemCache[addedItem.id];
                storage.getItem(addedItem.id, retrieveItem);
            });
        }
    });

    let retrieveItem = {
        found: false,
        onGetResult: function(c, s, t, d, c, items) {
            let item = items[0];

            // Check start date
            do_check_eq(item.startDate.compare(cal.createDateTime("20120101T010101Z")), 0);

            // Check attachment
            let attaches = item.getAttachments({});
            let attach = attaches[0];
            do_check_eq(attaches.length, 1);
            do_check_eq(attach.uri.spec, "http://example.com/test.ics");
            do_check_eq(attach.formatType, "text/calendar");
            do_check_eq(attach.encoding, "BASE64");
            do_check_eq(attach.getParameter("FILENAME"), "test.ics");

            // Check attendee
            let attendees = item.getAttendees({});
            let attendee = attendees[0];
            do_check_eq(attendees.length, 1);
            do_check_eq(attendee.id, "mailto:test@example.com");
            do_check_eq(attendee.commonName, "Name");
            do_check_eq(attendee.rsvp, "TRUE");
            do_check_eq(attendee.isOrganizer, false);
            do_check_eq(attendee.role, "REQ-PARTICIPANT");
            do_check_eq(attendee.participationStatus, "ACCEPTED");
            do_check_eq(attendee.userType, "INDIVIDUAL");
            do_check_eq(attendee.getProperty("X-THING"), "BAR");

            // Check relation
            let relations = item.getRelations({});
            let rel = relations[0];
            do_check_eq(relations.length, 1);
            do_check_eq(rel.relType, "SIBLING");
            do_check_eq(rel.relId, "VALUE");
            do_check_eq(rel.getParameter("FOO"), "BAR");

            // Check recurrence item
            for each (let ritem in item.recurrenceInfo.getRecurrenceItems({})) {
                if (ritem instanceof Components.interfaces.calIRecurrenceRule) {
                    do_check_eq(ritem.type, "MONTHLY");
                    do_check_eq(ritem.interval, 2);
                    do_check_eq(ritem.count, 5);
                    do_check_eq(ritem.isByCount, true);
                    do_check_eq(ritem.getComponent("BYDAY", {}).toString(), [2].toString());
                    do_check_eq(ritem.isNegative, false);
                } else if (ritem instanceof Components.interfaces.calIRecurrenceDate) {
                    if (ritem.isNegative) {
                        do_check_eq(ritem.date.compare(cal.createDateTime("20120301T010101Z")), 0);
                    } else {
                        do_check_eq(ritem.date.compare(cal.createDateTime("20120201T010101Z")), 0);
                    }
                } else {
                    do_throw("Found unknown recurrence item " + ritem);
                }
            }

            this.found = true;
        },
        onOperationComplete: function() {
            if (!this.found) {
                do_throw("Could not find item");
            }
            do_test_finished();
        }
    };
}
