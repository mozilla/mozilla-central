/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    let evt = cal.createEvent();
    let rel = cal.createRelation();
    evt.addRelation(rel);

    do_check_eq(1, evt.icalString.match(/RELATED-TO/g).length);
    evt.icalString = evt.icalString;
    do_check_eq(1, evt.icalString.match(/RELATED-TO/g).length);
}
