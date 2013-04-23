/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    let a = cal.createDuration("PT1S");
    let b = cal.createDuration("PT3S");
    a.addDuration(b);
    do_check_eq(a.icalString, "PT4S");
}
