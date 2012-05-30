/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    // Check that Bug 343792 doesn't regress:
    // Freeze (hang) on RRULE which has INTERVAL=0

    let icalString =
        "BEGIN:VCALENDAR\n" +
        "CALSCALE:GREGORIAN\n" +
        "PRODID:-//Ximian//NONSGML Evolution Calendar//EN\n" +
        "VERSION:2.0\n" +
        "BEGIN:VTIMEZONE\n" +
        "TZID:/softwarestudio.org/Olson_20011030_5/America/Los_Angeles\n" +
        "X-LIC-LOCATION:America/Los_Angeles\n" +
        "BEGIN:STANDARD\n" +
        "TZOFFSETFROM:-0700\n" +
        "TZOFFSETTO:-0800\n" +
        "TZNAME:PST\n" +
        "DTSTART:19701025T020000\n" +
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU;INTERVAL=1\n" +
        "END:STANDARD\n" +
        "BEGIN:DAYLIGHT\n" +
        "TZOFFSETFROM:-0800\n" +
        "TZOFFSETTO:-0700\n" +
        "TZNAME:PDT\n" +
        "DTSTART:19700405T020000\n" +
        "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU;INTERVAL=1\n" +
        "END:DAYLIGHT\n" +
        "END:VTIMEZONE\n" +
        "BEGIN:VEVENT\n" +
        "UID:20060705T145529-1768-1244-1267-46@localhost\n" +
        "ORGANIZER:MAILTO:No Body\n" +
        "DTSTAMP:20060705T145529Z\n" +
        "DTSTART;TZID=/softwarestudio.org/Olson_20011030_5/America/Los_Angeles:\n" +
        " 20060515T170000\n" +
        "DTEND;TZID=/softwarestudio.org/Olson_20011030_5/America/Los_Angeles:\n" +
        " 20060515T173000\n" +
        "RRULE:FREQ=WEEKLY;INTERVAL=0\n" +
        "LOCATION:Maui Building\n" +
        "TRANSP:OPAQUE\n" +
        "SEQUENCE:0\n" +
        "SUMMARY:FW development Status\n" +
        "PRIORITY:4\n" +
        "CLASS:PUBLIC\n" +
        "DESCRIPTION:Daily standup Mtg and/or status update on FW\n" +
        "END:VEVENT\n" +
        "END:VCALENDAR";

    let event = createEventFromIcalString(icalString);
    let start = createDate(2009, 4, 1);
    let end   = createDate(2009, 4, 30);

    // the following call caused a never ending loop:
    let occurrenceDates = event.recurrenceInfo.getOccurrenceDates(start, end, 0, {});
    do_check_eq(occurrenceDates.length, 4);

    // the following call caused a never ending loop:
    let occurrences = event.recurrenceInfo.getOccurrences(start, end, 0, {});
    do_check_eq(occurrences.length, 4);
}
