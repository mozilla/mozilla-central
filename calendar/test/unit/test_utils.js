/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_recentzones();
    test_formatcss();
    test_attendeeMatchesAddresses();
    test_getDefaultStartDate();
    test_getStartEndProps();
    test_calOperationGroup();
    test_sameDay();
    test_binarySearch();
}

function test_recentzones() {
    let oldDefaultTz = cal.getPrefSafe("calendar.timezone.local", "");
    cal.setPref("calendar.timezone.local", "floating");

    do_check_eq(cal.getRecentTimezones().length, 0);
    do_check_eq(cal.getRecentTimezones(true).length, 0);

    cal.saveRecentTimezone("Europe/Berlin");

    let zones = cal.getRecentTimezones();
    do_check_eq(zones.length, 1);
    do_check_eq(zones[0], "Europe/Berlin");
    zones = cal.getRecentTimezones(true);
    do_check_eq(zones.length, 1);
    do_check_eq(zones[0].tzid, "Europe/Berlin");

    cal.saveRecentTimezone(cal.calendarDefaultTimezone().tzid);
    do_check_eq(cal.getRecentTimezones().length, 1);
    do_check_eq(cal.getRecentTimezones(true).length, 1);

    cal.saveRecentTimezone("Europe/Berlin");
    do_check_eq(cal.getRecentTimezones().length, 1);
    do_check_eq(cal.getRecentTimezones(true).length, 1);

    cal.saveRecentTimezone("America/New_York");
    do_check_eq(cal.getRecentTimezones().length, 2);
    do_check_eq(cal.getRecentTimezones(true).length, 2);

    cal.saveRecentTimezone("Unknown");
    do_check_eq(cal.getRecentTimezones().length, 3);
    do_check_eq(cal.getRecentTimezones(true).length, 2);

    cal.setPref("calendar.timezone.local", oldDefaultTz);
}

function test_formatcss() {
    do_check_eq(cal.formatStringForCSSRule(" "), "_");
    do_check_eq(cal.formatStringForCSSRule("ü"), "-uxfc-");
    do_check_eq(cal.formatStringForCSSRule("a"), "a");
}

function test_attendeeMatchesAddresses() {
    let a = cal.createAttendee("ATTENDEE:mailto:horst");
    do_check_true(cal.attendeeMatchesAddresses(a, ["HORST", "peter"]));
    do_check_false(cal.attendeeMatchesAddresses(a, ["HORSTpeter", "peter"]));
    do_check_false(cal.attendeeMatchesAddresses(a, ["peter"]));

    let a = cal.createAttendee("ATTENDEE;EMAIL=\"horst\":urn:uuid:horst");
    do_check_true(cal.attendeeMatchesAddresses(a, ["HORST", "peter"]));
    do_check_false(cal.attendeeMatchesAddresses(a, ["HORSTpeter", "peter"]));
    do_check_false(cal.attendeeMatchesAddresses(a, ["peter"]));
}

function test_getDefaultStartDate() {
    function tt(n, t) {
        now = cal.createDateTime(n);
        return cal.getDefaultStartDate(t ? cal.createDateTime(t) : null);
    }

    let oldNow = cal.now;
    let now = cal.createDateTime("20120101T000000");
    cal.now = function() {
        return now;
    };

    dump("TT: " + cal.createDateTime("20120101T000000") + "\n");
    dump("TT: " + cal.getDefaultStartDate(cal.createDateTime("20120101T000000")) + "\n");

    do_check_eq(tt("20120101T000000").icalString, "20120101T010000");
    do_check_eq(tt("20120101T015959").icalString, "20120101T020000");
    do_check_eq(tt("20120101T230000").icalString, "20120101T230000");
    do_check_eq(tt("20120101T235959").icalString, "20120101T230000");

    do_check_eq(tt("20120101T000000", "20120202").icalString, "20120202T010000");
    do_check_eq(tt("20120101T015959", "20120202").icalString, "20120202T020000");
    do_check_eq(tt("20120101T230000", "20120202").icalString, "20120202T230000");
    do_check_eq(tt("20120101T235959", "20120202").icalString, "20120202T230000");

    let event = cal.createEvent();
    now = cal.createDateTime("20120101T015959");
    cal.setDefaultStartEndHour(event, cal.createDateTime("20120202"));
    do_check_eq(event.startDate.icalString, "20120202T020000");
    do_check_eq(event.endDate.icalString, "20120202T030000");

    let todo = cal.createTodo();
    now = cal.createDateTime("20120101T000000");
    cal.setDefaultStartEndHour(todo, cal.createDateTime("20120202"));
    do_check_eq(todo.entryDate.icalString, "20120202T010000");

    cal.now = oldNow;
}

function test_getStartEndProps() {
    do_check_eq(cal.calGetStartDateProp(cal.createEvent()), "startDate");
    do_check_eq(cal.calGetEndDateProp(cal.createEvent()), "endDate");
    do_check_eq(cal.calGetStartDateProp(cal.createTodo()), "entryDate");
    do_check_eq(cal.calGetEndDateProp(cal.createTodo()), "dueDate");

    do_check_throws(function() cal.calGetStartDateProp(null),
                    Components.results.NS_ERROR_NOT_IMPLEMENTED);
    do_check_throws(function() cal.calGetEndDateProp(null),
                    Components.results.NS_ERROR_NOT_IMPLEMENTED);
}

function test_calOperationGroup() {
    let cancelCalled = false;
    function cancelFunc() cancelCalled = true;

    let group = new cal.calOperationGroup(cancelFunc);

    do_check_true(group.isEmpty);
    do_check_eq(group.id, cal.calOperationGroup.mOpGroupPrefix + "0");
    do_check_eq(group.status, Components.results.NS_OK);
    do_check_eq(group.isPending, true);

    let completedOp = {
        isPending: false
    };

    group.add(completedOp);
    do_check_true(group.isEmpty);
    do_check_eq(group.isPending, true);

    let pendingOp1 = {
        id: 1,
        isPending: true,
        cancel: function() this.cancelCalled = true
    };

    group.add(pendingOp1);
    do_check_false(group.isEmpty);
    do_check_eq(group.isPending, true);

    let pendingOp2 = {
        id: 2,
        isPending: true,
        cancel: function() this.cancelCalled = true
    };

    group.add(pendingOp2);
    group.remove(pendingOp1);
    do_check_false(group.isEmpty);
    do_check_eq(group.isPending, true);

    group.cancel();

    do_check_eq(group.status, Components.interfaces.calIErrors.OPERATION_CANCELLED);
    do_check_false(group.isPending);
    do_check_true(cancelCalled);
    do_check_true(pendingOp2.cancelCalled);
}

function test_sameDay() {
    let dt = cal.createDateTime;

    do_check_true(cal.sameDay(dt("20120101"), dt("20120101T120000")));
    do_check_true(cal.sameDay(dt("20120101"), dt("20120101")));
    do_check_false(cal.sameDay(dt("20120101"), dt("20120102")));
    do_check_false(cal.sameDay(dt("20120101T120000"), dt("20120102T120000")));
}

function test_binarySearch() {
    let arr = [2, 5, 7, 9, 20, 27, 34, 39, 41, 53, 62];
    do_check_eq(binarySearch(arr, 27), 5); // Center
    do_check_eq(binarySearch(arr, 2), 0); // Left most
    do_check_eq(binarySearch(arr, 62), 11); // Right most

    do_check_eq(binarySearch([5], 5), 1) // One element found
    do_check_eq(binarySearch([1], 0), 0) // One element insert left
    do_check_eq(binarySearch([1], 2), 1) // One element insert right
}
