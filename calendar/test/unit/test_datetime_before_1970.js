/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {

    // Bug 769938 - dates before 1970 are not handled correctly
    // due to signed vs. unsigned mismatch in PRTime in xpconnect

    let dateTime1950 = cal.createDateTime();
    dateTime1950.year = 1950;
    do_check_eq(dateTime1950.year, 1950);

    let dateTime1955 = cal.createDateTime();
    dateTime1955.jsDate = new Date(1955, 06, 15);
    do_check_eq(dateTime1955.year, 1955);
    
    let dateTime1965 = cal.createDateTime();
    dateTime1965.nativeTime = -150000000000000;
    do_check_eq(dateTime1965.year, 1965);
    do_check_eq(dateTime1965.nativeTime, -150000000000000);

    let dateTime1990 = cal.createDateTime();
    dateTime1990.year = 1990;

    let dateTime2050 = cal.createDateTime();
    dateTime2050.year = 2050;

    do_check_true(dateTime1950.nativeTime < dateTime1955.nativeTime);
    do_check_true(dateTime1955.nativeTime < dateTime1965.nativeTime);
    do_check_true(dateTime1965.nativeTime < dateTime1990.nativeTime);
    do_check_true(dateTime1990.nativeTime < dateTime2050.nativeTime);
}
