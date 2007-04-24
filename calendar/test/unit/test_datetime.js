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
 * The Original Code is mozilla calendar tests code.
 *
 * The Initial Developer of the Original Code is
 *   Michiel van Leeuwen <mvl@exedo.nl>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    var cd = Cc["@mozilla.org/calendar/datetime;1"].
             createInstance(Ci.calIDateTime);
    cd.year = 2005;
    cd.month = 10;
    cd.day = 13;
    cd.hour = 10;
    cd.minute = 0;
    cd.second = 0;
    cd.timezone = "/mozilla.org/20050126_1/America/Bogota";
    cd.normalize();

    do_check_eq(cd.hour, 10);
    do_check_eq(cd.icalString, "20051113T100000");

    var cd_floating = cd.getInTimezone("floating");
    do_check_eq(cd_floating.hour, 10);

    var cd_utc = cd.getInTimezone("UTC");
    do_check_eq(cd_utc.hour, 15);
    do_check_eq(cd_utc.icalString, "20051113T150000Z");

    cd.hour = 25;
    cd.normalize();
    do_check_eq(cd.hour, 1);
    do_check_eq(cd.day, 14);


    // Test nativeTime on dates
    // setting .isDate to be true on a date should not change its nativeTime
    // bug 315954,
    cd.hour = 0;
    cd.normalize();
    cd_allday = cd.clone();
    cd_allday.isDate = true;
    do_check_eq(cd.nativeTime, cd_allday.nativeTime);

    // Daylight savings test
    cd.year = 2006;
    cd.month = 2;
    cd.day = 26;
    cd.hour = 1;
    cd.minute = 0;
    cd.second = 0;
    cd.timezone = "/mozilla.org/20050126_1/Europe/Amsterdam";
    cd.normalize();

    do_check_eq(cd.weekday, 0);
    do_check_eq(cd.timezoneOffset, 1*3600);

    cd.day += 1;
    cd.normalize();
    do_check_eq(cd.timezoneOffset, 2*3600);
}
