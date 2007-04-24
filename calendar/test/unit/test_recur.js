/* ***** BEGIN LICENSE BLOCK *****
 * Version:MPL 1.1/GPL 2.0/LGPL 2.1
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
 *   Michiel van Leeuwen <mvl@exedo.nl>
 * Portions created by the Initial Developer are Copyright (C) 2006
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
    test_recur("DESCRIPTION:Repeat every tuesday and wednesday starting Tue 2nd April 2002\n" +
               "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TU,WE\n" +
               "DTSTART:20020402T114500\n" +
               "DTEND:20020402T124500\n",
               ["20020402T114500", "20020403T114500", "20020409T114500",
                "20020410T114500", "20020416T114500", "20020417T114500"]);

    test_recur("DESCRIPTION:Repeat every thursday starting Tue 2nd April 2002\n" +
               "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TH\n" +
               "DTSTART:20020402T114500\n" +
               "DTEND:20020402T124500\n",
               ["20020404T114500", "20020411T114500", "20020418T114500",
                "20020425T114500", "20020502T114500", "20020509T114500"]);

    // bug 353797: occurrences for repeating all day events should stay "all-day"
    test_recur("DESCRIPTION:Allday repeat every thursday starting Tue 2nd April 2002\n" +
               "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=3;BYDAY=TH\n" +
               "DTSTART:20020404\n" +
               "DTEND:20020405\n",
               ["20020404", "20020411", "20020418"]);

    /* Test disabled, because BYWEEKNO is known to be broken
    test_recur({"DESCRIPTION:Monday of week number 20 (where the default start of the week is Monday)\n" +
               "RRULE:FREQ=YEARLY;INTERVAL=1;COUNT=6;BYDAY=MO;BYWEEKNO=20\n" +
               "DTSTART:19970512T090000"},
               ["19970512T090000", "19980511T090000", "19990517T090000" +
                "20000515T090000", "20010514T090000", "20020513T090000"]);

    */

    test_recur("DESCRIPTION:Every day, use exdate to exclude the second day\n" +
               "RRULE:FREQ=DAILY;COUNT=3\n" +
               "DTSTART:20020402T114500Z\n" +
               "EXDATE:20020403T114500Z\n",
               ["20020402T114500Z", "20020404T114500Z"]);

    test_recur("DESCRIPTION:Use EXDATE to eliminate the base event\n" +
               "RRULE:FREQ=DAILY;COUNT=1\n" +
               "DTSTART:20020402T114500Z\n" +
               "EXDATE:20020402T114500Z\n",
               []);
}

function test_recur(icalstring, expected) {
    var eventClass = Cc["@mozilla.org/calendar/event;1"];
    var eventIID = Ci.calIEvent;

    // Create event
    var event = eventClass.createInstance(eventIID);

    // Make icalstring a real vevent
    var ics = "BEGIN:VEVENT\n" + icalstring + "END:VEVENT\n";

    // set ics string to event
    event.icalString = ics;

    // get recurrence dates
    var start = createDate(1990, 0, 1);
    var end = createDate(2010, 0, 1);
    var recdates = event.recurrenceInfo.getOccurrenceDates(start, end, 0, {});

    // Check number of items
    do_check_eq(recdates.length, expected.length);

    // check each date
    for (var i in expected) {
        do_check_eq(recdates[i].icalString, expected[i]);
    }
}
