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
    function getMozTimezone(tzid) {
        return cal.getTimezoneService().getTimezone(tzid);
    }

    let cd = cal.createDateTime();
    cd.resetTo(2005, 10, 13,
               10, 0, 0,
               getMozTimezone("/mozilla.org/20050126_1/America/Bogota"));

    do_check_eq(cd.hour, 10);
    do_check_eq(cd.icalString, "20051113T100000");

    let cd_floating = cd.getInTimezone(floating());
    do_check_eq(cd_floating.hour, 10);

    let cd_utc = cd.getInTimezone(UTC());
    do_check_eq(cd_utc.hour, 15);
    do_check_eq(cd_utc.icalString, "20051113T150000Z");

    cd.hour = 25;
    do_check_eq(cd.hour, 1);
    do_check_eq(cd.day, 14);


    // Test nativeTime on dates
    // setting .isDate to be true on a date should not change its nativeTime
    // bug 315954,
    cd.hour = 0;
    cd_allday = cd.clone();
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
}
