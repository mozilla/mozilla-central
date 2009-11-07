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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2009
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

/**
 * In bug 494140 we found out that creating an exception to a series duplicates
 * alams. This unit test makes sure the alarms don't duplicate themselves. The
 * same goes for relations and attachments.
 */
function run_test() {
    let storageCal = getStorageCal();

    let item = createEventFromIcalString("BEGIN:VEVENT\r\n" +
                                         "CREATED:20090603T171401Z\r\n" +
                                         "LAST-MODIFIED:20090617T080410Z\r\n" +
                                         "DTSTAMP:20090617T080410Z\r\n" +
                                         "UID:c1a6cfe7-7fbb-4bfb-a00d-861e07c649a5\r\n" +
                                         "SUMMARY:Test\r\n" +
                                         "DTSTART:20090603T073000Z\r\n" +
                                         "DTEND:20090603T091500Z\r\n" +
                                         "RRULE:FREQ=DAILY;COUNT=5\r\n" +
                                         "RELATED-TO:RELTYPE=SIBLING:<foo@example.org>\r\n" +
                                         "ATTACH:http://www.example.org/\r\n" +
                                         "BEGIN:VALARM\r\n" +
                                         "ACTION:DISPLAY\r\n" +
                                         "TRIGGER;VALUE=DURATION:-PT10M\r\n" +
                                         "DESCRIPTION:Mozilla Alarm: Test\r\n" +
                                         "END:VALARM\r\n" +
                                         "END:VEVENT");
    // There should be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);

    // Change the occurrence to another day
    let occ = item.recurrenceInfo.getOccurrenceFor(cal.createDateTime("20090604T073000Z"));
    occ.startDate = cal.createDateTime("20090618T073000Z");
    item.recurrenceInfo.modifyException(occ, true);

    // There should still be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);
    do_check_eq(item.getRelations({}).length, 1);
    do_check_eq(item.getAttachments({}).length, 1);

    // Add the item to the storage calendar and retrieve it again
    storageCal.adoptItem(item, null);
    let retrievedItem;
    storageCal.getItem("c1a6cfe7-7fbb-4bfb-a00d-861e07c649a5", {
        onGetResult: function onGetResult(cal, stat, type, detail, count, items) {
            retrievedItem = items[0];
        },
        onOperationComplete: function() {}
    });

    // There should still be one alarm, one relation and one attachment
    do_check_eq(item.getAlarms({}).length, 1);
    do_check_eq(item.getRelations({}).length, 1);
    do_check_eq(item.getAttachments({}).length, 1);
}
