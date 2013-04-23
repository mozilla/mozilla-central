/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    test_freebusy();
    test_period();
}

function test_freebusy() {
    var icsService = Components.classes["@mozilla.org/calendar/ics-service;1"]
                               .getService(Components.interfaces.calIICSService);

    // Bug 415987 - FREEBUSY decoding does not support comma-separated entries
    // (https://bugzilla.mozilla.org/show_bug.cgi?id=415987)
    var fbVal1 = "20080206T160000Z/PT1H";
    var fbVal2 = "20080206T180000Z/PT1H";
    var fbVal3 = "20080206T220000Z/PT1H";
    var data =
        "BEGIN:VCALENDAR\n" +
        "BEGIN:VFREEBUSY\n" +
        "FREEBUSY;FBTYPE=BUSY:" + fbVal1 + "," + fbVal2 + "," + fbVal3 + "\n" +
        "END:VFREEBUSY\n" +
        "END:VCALENDAR\n";
    var fbComp = icsService.parseICS(data, null).getFirstSubcomponent("VFREEBUSY");
    do_check_eq(fbComp.getFirstProperty("FREEBUSY").value, fbVal1);
    do_check_eq(fbComp.getNextProperty("FREEBUSY").value, fbVal2);
    do_check_eq(fbComp.getNextProperty("FREEBUSY").value, fbVal3);
}

function test_period() {
    let period = Components.classes["@mozilla.org/calendar/period;1"]
                           .createInstance(Components.interfaces.calIPeriod);

    period.start = cal.createDateTime("20120101T010101");
    period.end = cal.createDateTime("20120101T010102");

    do_check_eq(period.icalString, "20120101T010101/20120101T010102");
    do_check_eq(period.duration.icalString, "PT1S");

    period.icalString = "20120101T010103/20120101T010104";

    do_check_eq(period.start.icalString, "20120101T010103");
    do_check_eq(period.end.icalString, "20120101T010104");
    do_check_eq(period.duration.icalString, "PT1S");

    period.icalString = "20120101T010105/PT1S";
    do_check_eq(period.start.icalString, "20120101T010105");
    do_check_eq(period.end.icalString, "20120101T010106");
    do_check_eq(period.duration.icalString, "PT1S");

    period.makeImmutable();
    do_check_throws(function() {
        period.start = cal.createDateTime("20120202T020202");
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);
    do_check_throws(function() {
        period.end = cal.createDateTime("20120202T020202");
    }, Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE);

    let copy = period.clone();
    do_check_eq(copy.start.icalString, "20120101T010105");
    do_check_eq(copy.end.icalString, "20120101T010106");
    do_check_eq(copy.duration.icalString, "PT1S");

    copy.start.icalString = "20120101T010106";
    copy.end = cal.createDateTime("20120101T010107");

    do_check_eq(period.start.icalString, "20120101T010105");
    do_check_eq(period.end.icalString, "20120101T010106");
    do_check_eq(period.duration.icalString, "PT1S");
}
