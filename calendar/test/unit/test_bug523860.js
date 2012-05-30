/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

function run_test() {
    // In bug 523860, we found out that in the spec doublequotes should not be
    // escaped.
    let prop = cal.getIcsService().createIcalProperty("DESCRIPTION");
    let expected = "A String with \"quotes\" and 'other quotes'";

    prop.value = expected;
    do_check_eq(prop.icalString, "DESCRIPTION:" + expected + "\r\n");
}
