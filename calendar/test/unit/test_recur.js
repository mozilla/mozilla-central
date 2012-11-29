/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function makeEvent(str) {
    return createEventFromIcalString("BEGIN:VEVENT\n" + str + "END:VEVENT");
}
function run_test() {
    // Test general calIRecurrenceInfo functions
    test_interface();

    // Test specific items/rules
    test_recur(makeEvent("DESCRIPTION:Repeat every tuesday and wednesday starting " +
                                     "Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TU,WE\n" +
                         "DTSTART:20020402T114500\n" +
                         "DTEND:20020402T124500\n"),
                         ["20020402T114500", "20020403T114500", "20020409T114500",
                          "20020410T114500", "20020416T114500", "20020417T114500"]);

    test_recur(makeEvent("DESCRIPTION:Repeat every thursday starting Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TH\n" +
                         "DTSTART:20020402T114500\n" +
                         "DTEND:20020402T124500\n"),
                         ["20020402T114500", // DTSTART part of the resulting set
                          "20020404T114500", "20020411T114500", "20020418T114500",
                          "20020425T114500", "20020502T114500", "20020509T114500"]);

    // Bug 469840 -  Recurring Sundays incorrect
    test_recur(makeEvent("DESCRIPTION:RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;BYDAY=WE,SA,SU with DTSTART:20081217T133000\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;BYDAY=WE,SA,SU\n" +
                         "DTSTART:20081217T133000\n" +
                         "DTEND:20081217T143000\n"),
               ["20081217T133000", "20081220T133000", "20081221T133000",
                "20081231T133000", "20090103T133000", "20090104T133000"]);
    test_recur(makeEvent("DESCRIPTION:RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;WKST=SU;BYDAY=WE,SA,SU with DTSTART:20081217T133000\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;WKST=SU;BYDAY=WE,SA,SU\n" +
                         "DTSTART:20081217T133000\n" +
                         "DTEND:20081217T143000\n"),
               ["20081217T133000", "20081220T133000", "20081228T133000",
                "20081231T133000", "20090103T133000", "20090111T133000"]);

    // bug 353797: occurrences for repeating all day events should stay "all-day"
    test_recur(makeEvent("DESCRIPTION:Allday repeat every thursday starting Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=3;BYDAY=TH\n" +
                         "DTSTART:20020404\n" +
                         "DTEND:20020405\n"),
                         ["20020404", "20020411", "20020418"]);

    /* Test disabled, because BYWEEKNO is known to be broken
    test_recur(makeEvent("DESCRIPTION:Monday of week number 20 (where the default start of the week is Monday)\n" +
                         "RRULE:FREQ=YEARLY;INTERVAL=1;COUNT=6;BYDAY=MO;BYWEEKNO=20\n" +
                         "DTSTART:19970512T090000",
                         ["19970512T090000", "19980511T090000", "19990517T090000" +
                          "20000515T090000", "20010514T090000", "20020513T090000"]);

    */

    test_recur(makeEvent("DESCRIPTION:Every day, use exdate to exclude the second day\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE:20020403T114500Z\n"),
                         ["20020402T114500Z", "20020404T114500Z"]);

    // test for issue 734245
    test_recur(makeEvent("DESCRIPTION:Every day, use exdate of type DATE to exclude the second day\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE:20020403\n"),
                         ["20020402T114500Z", "20020404T114500Z"]);

    test_recur(makeEvent("DESCRIPTION:Use EXDATE to eliminate the base event\n" +
                         "RRULE:FREQ=DAILY;COUNT=1\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE:20020402T114500Z\n"),
                         []);

    test_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "UID:123\n" +
                                         "DESCRIPTION:Every day, exception put on exdated day\n" +
                                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                                         "DTSTART:20020402T114500Z\n" +
                                         "EXDATE:20020403T114500Z\n" +
                                         "END:VEVENT\n" +
                                         "BEGIN:VEVENT\n" +
                                         "DTSTART:20020403T114500Z\n" +
                                         "UID:123\n" +
                                         "RECURRENCE-ID:20020404T114500Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20020402T114500Z", "20020403T114500Z"],
               true /* ignore next occ check, bug 455490 */);

    test_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "UID:123\n" +
                                         "DESCRIPTION:Every day, exception put on exdated start day\n" +
                                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                                         "DTSTART:20020402T114500Z\n" +
                                         "EXDATE:20020402T114500Z\n" +
                                         "END:VEVENT\n" +
                                         "BEGIN:VEVENT\n" +
                                         "DTSTART:20020402T114500Z\n" +
                                         "UID:123\n" +
                                         "RECURRENCE-ID:20020404T114500Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20020402T114500Z", "20020403T114500Z"],
               true /* ignore next occ check, bug 455490 */);

    test_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "DESCRIPTION:Repeat Daily on weekdays with UNTIL\n" +
                                         "RRULE:FREQ=DAILY;UNTIL=20111217T220000Z;BYDAY=MO,TU,WE,TH,FR\n" +
                                         "DTSTART:20111212T220000Z\n" +
                                         "DTEND:20111212T230000Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20111212T220000Z", "20111213T220000Z", "20111214T220000Z", "20111215T220000Z",
                "20111216T220000Z"],
               false);

    test_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "DESCRIPTION:Repeat Daily on weekdays with UNTIL and exception\n" +
                                         "RRULE:FREQ=DAILY;UNTIL=20111217T220000Z;BYDAY=MO,TU,WE,TH,FR\n" +
                                         "EXDATE:20111214T220000Z\n" +
                                         "DTSTART:20111212T220000Z\n" +
                                         "DTEND:20111212T230000Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20111212T220000Z", "20111213T220000Z", "20111215T220000Z", "20111216T220000Z"],
               false);

    var item = makeEvent("DESCRIPTION:occurrence on day 1 moved between the occurrences " +
                                     "on days 2 and 3\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n");
    var occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    test_recur(item, ["20020403T114500Z", "20020403T120000Z", "20020404T114500Z"]);

    item = makeEvent("DESCRIPTION:occurrence on day 1 moved between the occurrences " +
                                 "on days 2 and 3, EXDATE on day 2\n" +
                     "RRULE:FREQ=DAILY;COUNT=3\n" +
                     "DTSTART:20020402T114500Z\n" +
                     "EXDATE:20020403T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    test_recur(item, ["20020403T120000Z", "20020404T114500Z"]);

    item = makeEvent("DESCRIPTION:all occurrences have exceptions\n" +
                     "RRULE:FREQ=DAILY;COUNT=2\n" +
                     "DTSTART:20020402T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,2,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    var occ2 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,3,true,11,45,0));
    occ2.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ2, true);
    test_recur(item, ["20020402T120000Z", "20020403T120000Z"]);

    item = makeEvent("DESCRIPTION:rdate and exception before the recurrence start date\n" +
                     "RRULE:FREQ=DAILY;COUNT=2\n" +
                     "DTSTART:20020402T114500Z\n" +
                     "RDATE:20020401T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,2,30,true,11,45,0);
    item.recurrenceInfo.modifyException(occ1, true);
    test_recur(item, ["20020330T114500Z", "20020401T114500Z", "20020403T114500Z"]);
}

function test_recur(event, expected, ignoreNextOccCheck) {
    dump("Checking '" + event.getProperty("DESCRIPTION") + "'\n");
    // Get recurrence dates
    let start = createDate(1990, 0, 1);
    let end = createDate(2020, 0, 1);
    let recdates = event.recurrenceInfo.getOccurrenceDates(start, end, 0, {});
    let occurrences = event.recurrenceInfo.getOccurrences(start, end, 0, {});

    // Check number of items
    do_check_eq(recdates.length, expected.length);

    for (let i = 0; i < expected.length; i++) {
        // Check each date
        do_check_eq(recdates[i].icalString, expected[i]);

        // Make sure occurrences are correct
        do_check_eq(occurrences[i].startDate.icalString, expected[i]);

        if (ignoreNextOccCheck) {
            continue;
        }

        // Make sure getNextOccurrence works correctly
        let nextOcc = event.recurrenceInfo.getNextOccurrence(recdates[i]);
        if (expected.length > i + 1) {
            do_check_neq(nextOcc, null);
            do_check_eq(nextOcc.startDate.icalString, expected[i + 1]);
        } else {
            do_check_eq(nextOcc, null);
        }

        // Make sure getPreviousOccurrence works correctly
        let prevOcc = event.recurrenceInfo.getPreviousOccurrence(recdates[i]);
        if (i > 0) {
            do_check_neq(prevOcc, null);
            do_check_eq(prevOcc.startDate.icalString, expected[i - 1]);
        } else {
            do_check_eq(prevOcc, null);
        }
    }

    //  Make sure recurrenceInfo.clone works correctly
    test_clone(event);
}

function test_clone(event) {
    let oldRecurItems = event.recurrenceInfo.getRecurrenceItems({});
    let cloned = event.recurrenceInfo.clone();
    let newRecurItems = cloned.getRecurrenceItems({});

    // Check number of recurrence items
    do_check_eq(oldRecurItems.length, newRecurItems.length);

    for (let i = 0; i < oldRecurItems.length; i++) {
        // Check if recurrence item cloned correctly
        do_check_eq(oldRecurItems[i].icalProperty.icalString,
                    newRecurItems[i].icalProperty.icalString);
    }
}

function test_interface() {
    var RRULE = "RRULE:FREQ=WEEKLY;COUNT=6;BYDAY=TU,WE\r\n";
    var EXDATE = "EXDATE:20020403T114500Z\r\n"
    var RDATE = "RDATE;VALUE=DATE-TIME:20020401T114500Z\r\n";

    var item = makeEvent("DTSTART:20020402T114500Z\n" +
                         "DTEND:20020402T124500Z\n" +
                         RRULE + EXDATE + RDATE);

    var rinfo = item.recurrenceInfo;

    do_check_true(compareObjects(rinfo.item, item, Components.interfaces.calIEvent));

    // getRecurrenceItems
    var ritems = rinfo.getRecurrenceItems({});
    do_check_eq(ritems.length, 3);
    do_check_eq(ritems[0].icalProperty.icalString, RRULE);
    do_check_eq(ritems[1].icalProperty.icalString, EXDATE);
    do_check_eq(ritems[2].icalProperty.icalString, RDATE);

    // setRecurrenceItems
    var newRItems = [Cc["@mozilla.org/calendar/recurrence-rule;1"].createInstance(Components.interfaces.calIRecurrenceRule)];

    newRItems[0].type = "DAILY";
    newRItems[0].interval = 1;
    newRItems[0].count = 1;

    rinfo.setRecurrenceItems(1, newRItems);
    var itemString = item.icalString;

    do_check_true(itemString.indexOf(RRULE) < 0);
    do_check_true(itemString.indexOf(EXDATE) < 0);
    do_check_true(itemString.indexOf(RDATE) < 0);
    do_check_false(itemString.indexOf(newRItems[0].icalProperty.icalString) < 0);

    // countRecurrenceItems
    do_check_eq(1, rinfo.countRecurrenceItems());

    // clearRecurrenceItems
    rinfo.clearRecurrenceItems();
    do_check_eq(0, rinfo.countRecurrenceItems());

    // appendRecurrenceItems / getRecurrenceItemAt
    rinfo.appendRecurrenceItem(ritems[2]);
    rinfo.appendRecurrenceItem(ritems[0]);
    rinfo.appendRecurrenceItem(ritems[1]);

    do_check_true(compareObjects(ritems[2],
                                 rinfo.getRecurrenceItemAt(0),
                                 Components.interfaces.calIRecurrenceItem));
    do_check_true(compareObjects(ritems[0],
                                 rinfo.getRecurrenceItemAt(1),
                                 Components.interfaces.calIRecurrenceItem));
    do_check_true(compareObjects(ritems[1],
                                 rinfo.getRecurrenceItemAt(2),
                                 Components.interfaces.calIRecurrenceItem));

    // deleteRecurrenceItem
    rinfo.deleteRecurrenceItem(ritems[0]);
    do_check_true(item.icalString.indexOf(RRULE) < 0);

    // deleteRecurrenceItemAt
    rinfo.deleteRecurrenceItemAt(1);
    itemString = item.icalString;
    do_check_true(itemString.indexOf(EXDATE) < 0);
    do_check_false(itemString.indexOf(RDATE) < 0);

    // isFinite
    do_check_true(rinfo.isFinite);
    rinfo.appendRecurrenceItem(ritems[0]);
    do_check_true(rinfo.isFinite);

    // removeOccurrenceAt/restoreOccurreceAt
    var occDate = createDate(2002,3,3,true,11,45,0)
    rinfo.removeOccurrenceAt(occDate);
    do_check_false(item.icalString.indexOf(EXDATE) < 0);
    rinfo.restoreOccurrenceAt(occDate)
    do_check_true(item.icalString.indexOf(EXDATE) < 0);

    // modifyException / getExceptionFor
    var occ =  rinfo.getOccurrenceFor(occDate);
    occ.startDate = createDate(2002,3,1,true,11,45,0);
    rinfo.modifyException(occ, true);
    do_check_true(rinfo.getExceptionFor(occDate) != null);

    // getExceptionIds
    var ids = rinfo.getExceptionIds({});
    do_check_eq(ids.length, 1);
    do_check_true(ids[0].compare(occDate) == 0);

    // removeExceptionFor
    rinfo.removeExceptionFor(occDate);
    do_check_true(rinfo.getExceptionFor(occDate) == null);
}
