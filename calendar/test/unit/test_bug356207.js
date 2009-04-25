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
