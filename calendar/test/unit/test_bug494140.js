/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * In bug 494140 we found out that creating an exception to a series duplicates
 * alams. This unit test makes sure the alarms don't duplicate themselves. The
 * same goes for relations and attachments.
 */
function run_test() {
    let storageCal = getStorageCal();

    let item = createEventFromIcalString("BEGIN:VEVENT\r\n" +
                                         "CREATED:20090603T171401Z\r\n" +
                                         "LAST-MODIFIED:20090617T080410Z\r\n" +
                                         "DTSTAMP:20090617T080410Z\r\n" +
                                         "UID:c1a6cfe7-7fbb-4bfb-a00d-861e07c649a5\r\n" +
                                         "SUMMARY:Test\r\n" +
                                         "DTSTART:20090603T073000Z\r\n" +
                                         "DTEND:20090603T091500Z\r\n" +
                                         "RRULE:FREQ=DAILY;COUNT=5\r\n" +
                                         "RELATED-TO:RELTYPE=SIBLING:<foo@example.org>\r\n" +
                                         "ATTACH:http://www.example.org/\r\n" +
                                         "BEGIN:VALARM\r\n" +
                                         "ACTION:DISPLAY\r\n" +
                                         "TRIGGER;VALUE=DURATION:-PT10M\r\n" +
                                         "DESCRIPTION:Mozilla Alarm: Test\r\n" +
                                         "END:VALARM\r\n" +
                                         "END:VEVENT");

    // There should be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);
    do_check_eq(item.getRelations({}).length, 1);
    do_check_eq(item.getAttachments({}).length, 1);

    // Change the occurrence to another day
    let occ = item.recurrenceInfo.getOccurrenceFor(cal.createDateTime("20090604T073000Z"));
    occ.startDate = cal.createDateTime("20090618T073000Z");
    item.recurrenceInfo.modifyException(occ, true);

    // There should still be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);
    do_check_eq(item.getRelations({}).length, 1);
    do_check_eq(item.getAttachments({}).length, 1);

    // Add the item to the storage calendar and retrieve it again
    storageCal.adoptItem(item, null);
    let retrievedItem;
    storageCal.getItem("c1a6cfe7-7fbb-4bfb-a00d-861e07c649a5", {
        onGetResult: function onGetResult(cal, stat, type, detail, count, items) {
            retrievedItem = items[0];
        },
        onOperationComplete: function() {}
    });

    // There should still be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);
    do_check_eq(item.getRelations({}).length, 1);
    do_check_eq(item.getAttachments({}).length, 1);
}
