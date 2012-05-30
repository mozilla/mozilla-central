/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
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
