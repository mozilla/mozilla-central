/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function makeEvent(str) {
    return createEventFromIcalString("BEGIN:VEVENT\n" + str + "END:VEVENT");
}

function run_test() {
    test_interface();
    test_rrule_interface();
    test_rules();
    test_failures();
    test_limit();
    test_startdate_change();
    test_idchange();
}

function test_rules() {
    function check_recur(event, expected, ignoreNextOccCheck) {
        dump("Checking '" + event.getProperty("DESCRIPTION") + "'\n");
        // Get recurrence dates
        let start = createDate(1990, 0, 1);
        let end = createDate(2020, 0, 1);
        let recdates = event.recurrenceInfo.getOccurrenceDates(start, end, 0, {});
        let occurrences = event.recurrenceInfo.getOccurrences(start, end, 0, {});

        // Check number of items
        dump("Expected " + expected.length + " occurrences\n");
        dump("Got: " + recdates.map(function(x) x.toString()) + "\n");
        //do_check_eq(recdates.length, expected.length);
        let fmt = cal.getDateFormatter();

        for (let i = 0; i < expected.length; i++) {
            // Check each date
            let ed = cal.createDateTime(expected[i]);
            dump("Expecting instance at " + ed + "(" + fmt.dayName(ed.weekday) + ")\n");
            dump("Recdate:");
            do_check_eq(recdates[i].icalString, expected[i]);

            // Make sure occurrences are correct
            dump("Occurrence:");
            do_check_eq(occurrences[i].startDate.icalString, expected[i]);

            if (ignoreNextOccCheck) {
                continue;
            }

            // Make sure getNextOccurrence works correctly
            let nextOcc = event.recurrenceInfo.getNextOccurrence(recdates[i]);
            if (expected.length > i + 1) {
                do_check_neq(nextOcc, null);
                dump("Checking next occurrence: " + expected[i+1]+"\n");
                do_check_eq(nextOcc.startDate.icalString, expected[i + 1]);
            } else {
                dump("Expecting no more occurrences, found " +
                        (nextOcc ? nextOcc.startDate : null) + "\n");
                do_check_eq(nextOcc, null);
            }

            // Make sure getPreviousOccurrence works correctly
            let prevOcc = event.recurrenceInfo.getPreviousOccurrence(recdates[i]);
            if (i > 0) {
                dump("Checking previous occurrence: " + expected[i-1]+", found " + (prevOcc ? prevOcc.startDate : prevOcc) + "\n");
                do_check_neq(prevOcc, null);
                do_check_eq(prevOcc.startDate.icalString, expected[i - 1]);
            } else {
                dump("Expecting no previous occurrences, found " +
                        (prevOcc ? prevOcc.startDate : prevOcc) + "\n");
                do_check_eq(prevOcc, null);
            }
        }

        //  Make sure recurrenceInfo.clone works correctly
        test_clone(event);
    }

    // Test specific items/rules
    check_recur(makeEvent("DESCRIPTION:Repeat every tuesday and wednesday starting " +
                                     "Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TU,WE\n" +
                         "DTSTART:20020402T114500\n" +
                         "DTEND:20020402T124500\n"),
                         ["20020402T114500", "20020403T114500", "20020409T114500",
                          "20020410T114500", "20020416T114500", "20020417T114500"]);
    check_recur(makeEvent("DESCRIPTION:Repeat every thursday starting Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=6;BYDAY=TH\n" +
                         "DTSTART:20020402T114500\n" +
                         "DTEND:20020402T124500\n"),
                         ["20020402T114500", // DTSTART part of the resulting set
                          "20020404T114500", "20020411T114500", "20020418T114500",
                          "20020425T114500", "20020502T114500", "20020509T114500"]);
    // Bug 469840 -  Recurring Sundays incorrect
    check_recur(makeEvent("DESCRIPTION:RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;BYDAY=WE,SA,SU with DTSTART:20081217T133000\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;BYDAY=WE,SA,SU\n" +
                         "DTSTART:20081217T133000\n" +
                         "DTEND:20081217T143000\n"),
               ["20081217T133000", "20081220T133000", "20081221T133000",
                "20081231T133000", "20090103T133000", "20090104T133000"]);
    check_recur(makeEvent("DESCRIPTION:RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;WKST=SU;BYDAY=WE,SA,SU with DTSTART:20081217T133000\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6;WKST=SU;BYDAY=WE,SA,SU\n" +
                         "DTSTART:20081217T133000\n" +
                         "DTEND:20081217T143000\n"),
               ["20081217T133000", "20081220T133000", "20081228T133000",
                "20081231T133000", "20090103T133000", "20090111T133000"]);

    // bug 353797: occurrences for repeating all day events should stay "all-day"
    check_recur(makeEvent("DESCRIPTION:Allday repeat every thursday starting Tue 2nd April 2002\n" +
                         "RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=3;BYDAY=TH\n" +
                         "DTSTART;VALUE=DATE:20020404\n" +
                         "DTEND;VALUE=DATE:20020405\n"),
                         ["20020404", "20020411", "20020418"]);

    /* Test disabled, because BYWEEKNO is known to be broken
    check_recur(makeEvent("DESCRIPTION:Monday of week number 20 (where the default start of the week is Monday)\n" +
                         "RRULE:FREQ=YEARLY;INTERVAL=1;COUNT=6;BYDAY=MO;BYWEEKNO=20\n" +
                         "DTSTART:19970512T090000",
                         ["19970512T090000", "19980511T090000", "19990517T090000" +
                          "20000515T090000", "20010514T090000", "20020513T090000"]);

    */

    check_recur(makeEvent("DESCRIPTION:Every day, use exdate to exclude the second day\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE:20020403T114500Z\n"),
                         ["20020402T114500Z", "20020404T114500Z"]);

    // test for issue 734245
    check_recur(makeEvent("DESCRIPTION:Every day, use exdate of type DATE to exclude the second day\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE;VALUE=DATE:20020403\n"),
                         ["20020402T114500Z", "20020404T114500Z"]);

    check_recur(makeEvent("DESCRIPTION:Use EXDATE to eliminate the base event\n" +
                         "RRULE:FREQ=DAILY;COUNT=1\n" +
                         "DTSTART:20020402T114500Z\n" +
                         "EXDATE:20020402T114500Z\n"),
                         []);

    check_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
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
               true); // ignore next occ check, bug 455490

    check_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
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

    check_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "DESCRIPTION:Repeat Daily on weekdays with UNTIL\n" +
                                         "RRULE:FREQ=DAILY;UNTIL=20111217T220000Z;BYDAY=MO,TU,WE,TH,FR\n" +
                                         "DTSTART:20111212T220000Z\n" +
                                         "DTEND:20111212T230000Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20111212T220000Z", "20111213T220000Z", "20111214T220000Z", "20111215T220000Z",
                "20111216T220000Z"],
               false);

    check_recur(createEventFromIcalString("BEGIN:VCALENDAR\nBEGIN:VEVENT\n" +
                                         "DESCRIPTION:Repeat Daily on weekdays with UNTIL and exception\n" +
                                         "RRULE:FREQ=DAILY;UNTIL=20111217T220000Z;BYDAY=MO,TU,WE,TH,FR\n" +
                                         "EXDATE:20111214T220000Z\n" +
                                         "DTSTART:20111212T220000Z\n" +
                                         "DTEND:20111212T230000Z\n" +
                                         "END:VEVENT\nEND:VCALENDAR\n"),
               ["20111212T220000Z", "20111213T220000Z", "20111215T220000Z", "20111216T220000Z"],
               false);

    let item, occ1;
    item = makeEvent("DESCRIPTION:occurrence on day 1 moved between the occurrences " +
                                     "on days 2 and 3\n" +
                         "RRULE:FREQ=DAILY;COUNT=3\n" +
                         "DTSTART:20020402T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    check_recur(item, ["20020403T114500Z", "20020403T120000Z", "20020404T114500Z"]);

    item = makeEvent("DESCRIPTION:occurrence on day 1 moved between the occurrences " +
                                 "on days 2 and 3, EXDATE on day 2\n" +
                     "RRULE:FREQ=DAILY;COUNT=3\n" +
                     "DTSTART:20020402T114500Z\n" +
                     "EXDATE:20020403T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    check_recur(item, ["20020403T120000Z", "20020404T114500Z"]);

    item = makeEvent("DESCRIPTION:all occurrences have exceptions\n" +
                     "RRULE:FREQ=DAILY;COUNT=2\n" +
                     "DTSTART:20020402T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,3,2,true,12,0,0);
    item.recurrenceInfo.modifyException(occ1, true);
    let occ2 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,3,true,11,45,0));
    occ2.startDate = createDate(2002,3,3,true,12,0,0);
    item.recurrenceInfo.modifyException(occ2, true);
    check_recur(item, ["20020402T120000Z", "20020403T120000Z"]);

    item = makeEvent("DESCRIPTION:rdate and exception before the recurrence start date\n" +
                     "RRULE:FREQ=DAILY;COUNT=2\n" +
                     "DTSTART:20020402T114500Z\n" +
                     "RDATE:20020401T114500Z\n");
    occ1 = item.recurrenceInfo.getOccurrenceFor(createDate(2002,3,2,true,11,45,0));
    occ1.startDate = createDate(2002,2,30,true,11,45,0);
    item.recurrenceInfo.modifyException(occ1, true);
    check_recur(item, ["20020330T114500Z", "20020401T114500Z", "20020403T114500Z"]);

    item = makeEvent("DESCRIPTION:bug 734245, an EXDATE of type DATE shall also match a DTSTART of type DATE-TIME\n" +
                     "RRULE:FREQ=DAILY;COUNT=3\n" +
                     "DTSTART:20020401T114500Z\n" +
                     "EXDATE;VALUE=DATE:20020402\n");

    check_recur(item, ["20020401T114500Z", "20020403T114500Z"]);

    item = makeEvent("DESCRIPTION:EXDATE with a timezone\n" +
                     "RRULE:FREQ=DAILY;COUNT=3\n" +
                     "DTSTART;TZID=Europe/Berlin:20020401T114500\n" +
                     "EXDATE;TZID=Europe/Berlin:20020402T114500\n");

    check_recur(item, ["20020401T114500", "20020403T114500"]);
}

function test_limit() {
    let item = makeEvent("RRULE:FREQ=DAILY;COUNT=3\n" +
                         "UID:1\n" +
                         "DTSTART:20020401T114500\n" +
                         "DTEND:20020401T124500\n");
    dump("ics: " + item.icalString + "\n");

    let start = createDate(1990, 0, 1);
    let end = createDate(2020, 0, 1);
    let recdates = item.recurrenceInfo.getOccurrenceDates(start, end, 0, {});
    let occurrences = item.recurrenceInfo.getOccurrences(start, end, 0, {});

    do_check_eq(recdates.length, 3);
    do_check_eq(occurrences.length, 3);

    recdates = item.recurrenceInfo.getOccurrenceDates(start, end, 2, {});
    occurrences = item.recurrenceInfo.getOccurrences(start, end, 2, {});

    do_check_eq(recdates.length, 2);
    do_check_eq(occurrences.length, 2);

    recdates = item.recurrenceInfo.getOccurrenceDates(start, end, 9, {});
    occurrences = item.recurrenceInfo.getOccurrences(start, end, 9, {});

    do_check_eq(recdates.length, 3);
    do_check_eq(occurrences.length, 3);
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
    let RRULE = "RRULE:FREQ=WEEKLY;COUNT=6;BYDAY=TU,WE\r\n";
    let EXDATE = "EXDATE:20020403T114500Z\r\n"
    let RDATE = "RDATE;VALUE=DATE-TIME:20020401T114500Z\r\n";

    let item = makeEvent("DTSTART:20020402T114500Z\n" +
                         "DTEND:20020402T124500Z\n" +
                         RRULE + EXDATE + RDATE);

    let rinfo = item.recurrenceInfo;

    do_check_true(compareObjects(rinfo.item, item, Components.interfaces.calIEvent));

    // getRecurrenceItems
    let ritems = rinfo.getRecurrenceItems({});
    do_check_eq(ritems.length, 3);
    do_check_eq(ritems[0].icalProperty.icalString, RRULE);
    do_check_eq(ritems[1].icalProperty.icalString, EXDATE);
    do_check_eq(ritems[2].icalProperty.icalString, RDATE);

    // setRecurrenceItems
    let newRItems = [cal.createRecurrenceRule(), cal.createRecurrenceDate()];

    newRItems[0].type = "DAILY";
    newRItems[0].interval = 1;
    newRItems[0].count = 1;
    newRItems[1].isNegative = true;
    newRItems[1].date = cal.createDateTime("20020404T114500Z");

    rinfo.setRecurrenceItems(2, newRItems);
    let itemString = item.icalString;

    do_check_true(itemString.indexOf(RRULE) < 0);
    do_check_true(itemString.indexOf(EXDATE) < 0);
    do_check_true(itemString.indexOf(RDATE) < 0);
    do_check_false(itemString.indexOf(newRItems[0].icalProperty.icalString) < 0);
    do_check_false(itemString.indexOf(newRItems[1].icalProperty.icalString) < 0);

    // This may be an implementation detail, but we don't want this breaking
    rinfo.wrappedJSObject.ensureSortedRecurrenceRules();
    do_check_eq(rinfo.wrappedJSObject.mNegativeRules[0].icalProperty.icalString, newRItems[1].icalProperty.icalString);
    do_check_eq(rinfo.wrappedJSObject.mPositiveRules[0].icalProperty.icalString, newRItems[0].icalProperty.icalString);

    // countRecurrenceItems
    do_check_eq(2, rinfo.countRecurrenceItems());

    // clearRecurrenceItems
    rinfo.clearRecurrenceItems();
    do_check_eq(0, rinfo.countRecurrenceItems());

    // appendRecurrenceItems / getRecurrenceItemAt / insertRecurrenceItemAt
    rinfo.appendRecurrenceItem(ritems[0]);
    rinfo.appendRecurrenceItem(ritems[1]);
    rinfo.insertRecurrenceItemAt(ritems[2], 0);

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

    // insertRecurrenceItemAt with exdate
    rinfo.insertRecurrenceItemAt(ritems[1], 1);
    do_check_true(compareObjects(ritems[1],
                                 rinfo.getRecurrenceItemAt(1),
                                 Components.interfaces.calIRecurrenceItem));
    rinfo.deleteRecurrenceItem(ritems[1]);

    // isFinite = true
    do_check_true(rinfo.isFinite);
    rinfo.appendRecurrenceItem(ritems[0]);
    do_check_true(rinfo.isFinite);

    // isFinite = false
    let item2 = makeEvent("DTSTART:20020402T114500Z\n" +
                          "DTEND:20020402T124500Z\n" +
                          "RRULE:FREQ=WEEKLY;BYDAY=TU,WE\n");
    do_check_false(item2.recurrenceInfo.isFinite);

    // removeOccurrenceAt/restoreOccurreceAt
    let occDate1 = cal.createDateTime("20020403T114500Z");
    let occDate2 = cal.createDateTime("20020404T114500Z");
    rinfo.removeOccurrenceAt(occDate1);
    do_check_false(item.icalString.indexOf(EXDATE) < 0);
    rinfo.restoreOccurrenceAt(occDate1)
    do_check_true(item.icalString.indexOf(EXDATE) < 0);

    // modifyException / getExceptionFor
    let occ = rinfo.getOccurrenceFor(occDate1);
    occ.startDate = cal.createDateTime("20020401T114500");
    rinfo.modifyException(occ, true);
    do_check_true(rinfo.getExceptionFor(occDate1) != null);

    // modifyException immutable
    let occ = rinfo.getOccurrenceFor(occDate2);
    occ.makeImmutable();
    rinfo.modifyException(occ, true);
    do_check_true(rinfo.getExceptionFor(occDate2) != null);

    // getExceptionIds
    let ids = rinfo.getExceptionIds({});
    do_check_eq(ids.length, 2);
    do_check_true(ids[0].compare(occDate1) == 0);
    do_check_true(ids[1].compare(occDate2) == 0);

    // removeExceptionFor
    rinfo.removeExceptionFor(occDate1);
    do_check_true(rinfo.getExceptionFor(occDate1) == null);
    do_check_eq(rinfo.getExceptionIds({}).length, 1);
}

function test_rrule_interface() {
    let item = makeEvent("DTSTART:20020402T114500Z\r\n" +
                         "DTEND:20020402T124500Z\r\n" +
                         "RRULE:INTERVAL=2;FREQ=WEEKLY;COUNT=6;BYDAY=TU,WE\r\n");

    let rrule = item.recurrenceInfo.getRecurrenceItemAt(0);
    do_check_eq(rrule.type, "WEEKLY");
    do_check_eq(rrule.interval, 2);
    do_check_eq(rrule.count, 6);
    do_check_true(rrule.isByCount);
    do_check_false(rrule.isNegative);
    do_check_true(rrule.isFinite);
    do_check_eq(rrule.getComponent("BYDAY", {}).toString(), [3,4].toString());

    // Now start changing things
    rrule.setComponent("BYDAY", 2, [4,5]);
    do_check_eq(rrule.icalString.match(/BYDAY=WE,TH/), "BYDAY=WE,TH");

    rrule.count = -1;
    do_check_false(rrule.isByCount);
    do_check_false(rrule.isFinite);
    do_check_eq(rrule.icalString.match(/COUNT=/), null);
    do_check_throws(function() {
        rrule.count;
    }, Components.results.NS_ERROR_FAILURE);

    rrule.interval = 1;
    do_check_eq(rrule.interval, 1);
    do_check_eq(rrule.icalString.match(/INTERVAL=/), null);

    rrule.interval = 3;
    do_check_eq(rrule.interval, 3);
    do_check_eq(rrule.icalString.match(/INTERVAL=3/), "INTERVAL=3");

    rrule.type = "MONTHLY";
    do_check_eq(rrule.type, "MONTHLY");
    do_check_eq(rrule.icalString.match(/FREQ=MONTHLY/), "FREQ=MONTHLY");
}

function test_startdate_change() {

    // Setting a start date if its missing shouldn't throw
    let item = makeEvent("DTEND:20020402T124500Z\r\n" +
                         "RRULE:FREQ=DAILY\r\n");
    item.startDate = cal.createDateTime("20020502T114500Z");

    function makeRecEvent(str) {
        return makeEvent("DTSTART:20020402T114500Z\r\n" +
                         "DTEND:20020402T134500Z\r\n" +
                         str);
    }

    function changeBy(item, dur) {
        let newDate = item.startDate.clone();
        newDate.addDuration(cal.createDuration(dur));
        item.startDate = newDate;
    }

    let item, dur, ritem;

    // Changing an existing start date for a recurring item shouldn't either
    item = makeRecEvent("RRULE:FREQ=DAILY\r\n");
    changeBy(item, "PT1H");

    // Event with an rdate
    item = makeRecEvent("RDATE:20020403T114500Z\r\n");
    changeBy(item, "PT1H");
    ritem = item.recurrenceInfo.getRecurrenceItemAt(0);
    do_check_eq(ritem.date.icalString, "20020403T124500Z");

    // Event with an exdate
    item = makeRecEvent("EXDATE:20020403T114500Z\r\n");
    changeBy(item, "PT1H");
    ritem = item.recurrenceInfo.getRecurrenceItemAt(0);
    do_check_eq(ritem.date.icalString, "20020403T124500Z");

    // Event with an rrule with until date
    item = makeRecEvent("RRULE:FREQ=WEEKLY;UNTIL=20020406T114500Z\r\n");
    changeBy(item, "PT1H");
    ritem = item.recurrenceInfo.getRecurrenceItemAt(0);
    do_check_eq(ritem.untilDate.icalString, "20020406T124500Z");

    // Event with an exception item
    item = makeRecEvent("RRULE:FREQ=DAILY\r\n");
    let occ = item.recurrenceInfo.getOccurrenceFor(cal.createDateTime("20020406T114500Z"));
    occ.startDate = cal.createDateTime("20020406T124500Z");
    item.recurrenceInfo.modifyException(occ, true);
    changeBy(item, "PT1H");
    do_check_eq(item.startDate.icalString, "20020402T124500Z");
    occ = item.recurrenceInfo.getExceptionFor(cal.createDateTime("20020406T124500Z"));
    do_check_eq(occ.startDate.icalString, "20020406T134500Z");
}

function test_idchange() {
    let item = makeEvent("UID:unchanged\r\n" +
                         "DTSTART:20020402T114500Z\r\n" +
                         "DTEND:20020402T124500Z\r\n" +
                         "RRULE:FREQ=DAILY\r\n");
    let occ = item.recurrenceInfo.getOccurrenceFor(cal.createDateTime("20020406T114500Z"));
    occ.startDate = cal.createDateTime("20020406T124500Z");
    item.recurrenceInfo.modifyException(occ, true);
    do_check_eq(occ.id, "unchanged");

    item.id = "changed";

    occ = item.recurrenceInfo.getExceptionFor(cal.createDateTime("20020406T114500Z"));
    do_check_eq(occ.id , "changed");
}

function test_failures() {
    let item = makeEvent("DTSTART:20020402T114500Z\r\n" +
                         "DTEND:20020402T124500Z\r\n" +
                         "RRULE:INTERVAL=2;FREQ=WEEKLY;COUNT=6;BYDAY=TU,WE\r\n");
    let rinfo = item.recurrenceInfo;
    let ritem = cal.createRecurrenceDate();

    do_check_throws(function() rinfo.getRecurrenceItemAt(-1), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.getRecurrenceItemAt(1), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.deleteRecurrenceItemAt(-1), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.deleteRecurrenceItemAt(1), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.deleteRecurrenceItem(ritem), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.insertRecurrenceItemAt(ritem, -1), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.insertRecurrenceItemAt(ritem, 2), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() rinfo.restoreOccurrenceAt(cal.createDateTime("20080101T010101")), Cr.NS_ERROR_INVALID_ARG);
    do_check_throws(function() cal.createRecurrenceInfo().isFinite, Cr.NS_ERROR_NOT_INITIALIZED);

    // modifyException with a different parent item
    let occ = rinfo.getOccurrenceFor(cal.createDateTime("20120102T114500Z"));
    occ.calendar = {}
    occ.id = "1234";
    occ.parentItem = occ;
    do_check_throws(function() rinfo.modifyException(occ, true), Cr.NS_ERROR_INVALID_ARG);

    occ = rinfo.getOccurrenceFor(cal.createDateTime("20120102T114500Z"));
    occ.recurrenceId = null;
    do_check_throws(function() rinfo.modifyException(occ, true), Cr.NS_ERROR_INVALID_ARG);

    // Missing DTSTART/DUE but RRULE
    item = createEventFromIcalString("BEGIN:VCALENDAR\r\n" +
        "BEGIN:VTODO\r\n" +
        "RRULE:FREQ=DAILY\r\n" +
        "END:VTODO\r\n" +
        "END:VCALENDAR\r\n"
    );
    rinfo = item.recurrenceInfo;
    do_check_eq(rinfo.getOccurrenceDates(cal.createDateTime("20120101T010101"),
                                         cal.createDateTime("20120203T010101"),
                                         0, {}).length, 0);
}

function test_immutable() {
    item = createEventFromIcalString("BEGIN:VCALENDAR\r\n" +
        "BEGIN:VTODO\r\n" +
        "RRULE:FREQ=DAILY\r\n" +
        "END:VTODO\r\n" +
        "END:VCALENDAR\r\n"
    );
    do_check_true(item.recurrenceInfo.isMutable);
    let rinfo2 = item.recurrenceInfo.clone();
    rinfo2.makeImmutable();
    rinfo2.makeImmutable(); // Doing so twice shouldn't throw
    do_check_throws(function() rinfo2.appendRecurrenceItem(ritem), Cr.NS_ERROR_OBJECT_IS_IMMUTABLE);
    do_check_false(rinfo2.isMutable);

    let ritem = cal.createRecurrenceDate();
    rinfo.appenRecurrenceItem(ritem);
}
