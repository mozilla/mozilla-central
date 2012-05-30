/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    // Check that Bug 356207 doesn't regress:
    // Freeze (hang) on RRULE which has BYMONTHDAY and BYDAY

    let icalString =
        "BEGIN:VCALENDAR\n" +
        "PRODID:-//Randy L Pearson//NONSGML Outlook2vCal V1.1//EN\n" +
        "VERSION:2.0\n" +
        "BEGIN:VEVENT\n" +
        "CREATED:20040829T163323\n" +
        "UID:00000000EBFAC68C9B92BF119D643623FBD17E1424312000\n" +
        "SEQUENCE:1\n" +
        "LAST-MODIFIED:20060615T231158\n" +
        "DTSTAMP:20040829T163323\n" +
        "ORGANIZER:Unknown\n" +
        "DTSTART:20040901T141500\n" +
        "DESCRIPTION:Contact Mary Tindall for more details.\n" +
        "CLASS:PUBLIC\n" +
        "LOCATION:Church\n" +
        "CATEGORIES:Church Events\n" +
        "SUMMARY:Friendship Circle\n" +
        "PRIORITY:1\n" +
        "DTEND:20040901T141500\n" +
        "RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1;BYDAY=WE\n" +
        "END:VEVENT\n" +
        "END:VCALENDAR";

    let event = createEventFromIcalString(icalString);
    let start = createDate(2009,  0,  1);
    let end   = createDate(2009, 11, 31);

    // the following call caused a never ending loop:
    let occurrenceDates = event.recurrenceInfo.getOccurrenceDates(start, end, 0, {});
    do_check_eq(occurrenceDates.length, 2);

    // the following call caused a never ending loop:
    let occurrences = event.recurrenceInfo.getOccurrences(start, end, 0, {});
    do_check_eq(occurrences.length, 2);
}
