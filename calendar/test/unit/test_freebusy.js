/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
