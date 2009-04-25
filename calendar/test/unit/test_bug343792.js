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
 * The Original Code is Mozilla Calendar tests code.
 *
 * The Initial Developer of the Original Code is
 *   Stefan Sitter <ssitter@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
