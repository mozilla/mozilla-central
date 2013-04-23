/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    function getMozTimezone(tzid) {
        return cal.getTimezoneService().getTimezone(tzid);
    }

    let cd = cal.createDateTime();
    cd.resetTo(2005, 10, 13,
               10, 0, 0,
               getMozTimezone("/mozilla.org/20050126_1/America/Bogota"));

    do_check_eq(cd.hour, 10);
    do_check_eq(cd.icalString, "20051113T100000");

    let cd_floating = cd.getInTimezone(cal.floating());
    do_check_eq(cd_floating.hour, 10);


    let cd_utc = cd.getInTimezone(cal.UTC());
    do_check_eq(cd_utc.hour, 15);
    do_check_eq(cd_utc.icalString, "20051113T150000Z");

    cd.hour = 25;
    do_check_eq(cd.hour, 1);
    do_check_eq(cd.day, 14);


    // Test nativeTime on dates
    // setting .isDate to be true on a date should not change its nativeTime
    // bug 315954,
    cd.hour = 0;
    let cd_allday = cd.clone();
    cd_allday.isDate = true;
    do_check_eq(cd.nativeTime, cd_allday.nativeTime);

    // Daylight savings test
    cd.resetTo(2006, 2, 26,
               1, 0, 0,
               getMozTimezone("/mozilla.org/20050126_1/Europe/Amsterdam"));

    do_check_eq(cd.weekday, 0);
    do_check_eq(cd.timezoneOffset, 1*3600);

    cd.day += 1;
    do_check_eq(cd.timezoneOffset, 2*3600);

    // Bug 398724 - Problems with floating all-day items
    let event = cal.createEvent("BEGIN:VEVENT\nUID:45674d53-229f-48c6-9f3b-f2b601e7ae4d\nSUMMARY:New Event\nDTSTART;VALUE=DATE:20071003\nDTEND;VALUE=DATE:20071004\nEND:VEVENT");
    do_check_true(event.startDate.timezone.isFloating);
    do_check_true(event.endDate.timezone.isFloating);

    // Bug 392853 - Same times, different timezones, but subtractDate says times are PT0S apart
    const zeroLength = cal.createDuration();
    const a = cal.createDateTime();
    a.jsDate = new Date();
    a.timezone = getMozTimezone("/mozilla.org/20071231_1/Europe/Berlin");

    let b = a.clone();
    b.timezone = getMozTimezone("/mozilla.org/20071231_1/America/New_York");

    let duration = a.subtractDate(b);
    do_check_neq(duration.compare(zeroLength), 0);
    do_check_neq(a.compare(b), 0);

    // Should lead to zero length duration
    b = a.getInTimezone(getMozTimezone("/mozilla.org/20071231_1/America/New_York"));
    duration = a.subtractDate(b);
    do_check_eq(duration.compare(zeroLength), 0);
    do_check_eq(a.compare(b), 0);

    do_check_eq(b.timezone.displayName, "America/New York");
    do_check_eq(b.timezone.latitude, "+0404251");
    do_check_eq(b.timezone.longitude, "-0740023");

    // check aliases
    do_check_eq(getMozTimezone("/mozilla.org/xyz/Pacific/Yap").tzid, "Pacific/Truk");
    do_check_eq(getMozTimezone("Pacific/Yap").tzid, "Pacific/Truk");    

    // A newly created date should be in UTC, as should its clone
    let utc = cal.createDateTime();
    do_check_eq(utc.timezone.tzid, "UTC");
    do_check_eq(utc.clone().timezone.tzid, "UTC");
    do_check_eq(utc.timezoneOffset, 0);

    // Bug 794477 - setting jsdate across compartments needs to work
    let someDate = new Date();
    let createdDate = cal.jsDateToDateTime(someDate).getInTimezone(cal.calendarDefaultTimezone());
    do_check_eq(Math.floor(someDate.getTime() / 1000),
                Math.floor(createdDate.jsDate.getTime() / 1000));

    // Comparing a date-time with a date of the same day should be 0
    do_check_eq(cal.createDateTime("20120101T120000").compare(cal.createDateTime("20120101")), 0);
    do_check_eq(cal.createDateTime("20120101").compare(cal.createDateTime("20120101T120000")), 0);
}

