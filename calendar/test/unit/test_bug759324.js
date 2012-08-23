/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Checks if the capabilities.propagate-sequence feature of the storage calendar
 * still works
 */
function run_test() {
    let storage = getStorageCal();

    storage.setProperty("capabilities.propagate-sequence", "true");

    let str = ["BEGIN:VEVENT",
               "UID:recItem",
               "SEQUENCE:3",
               "RRULE:FREQ=WEEKLY",
               "DTSTART:20120101T010101Z",
               "END:VEVENT"].join("\r\n");

    let item = createEventFromIcalString(str);
    let rid = cal.createDateTime("20120101T010101Z");
    let rec = item.recurrenceInfo.getOccurrenceFor(rid);
    rec.title = "changed";
    item.recurrenceInfo.modifyException(rec, true);

    do_test_pending();
    storage.addItem(item, { onOperationComplete: checkAddedItem });

    function checkAddedItem(c, s, o, i, addedItem) {

        let seq = addedItem.getProperty("SEQUENCE");
        let rec = addedItem.recurrenceInfo.getOccurrenceFor(rid);

        do_check_eq(seq, 3);
        do_check_eq(rec.getProperty("SEQUENCE"), seq);

        let changedItem = addedItem.clone();
        changedItem.setProperty("SEQUENCE", parseInt(seq, 10) + 1);

        storage.modifyItem(changedItem, addedItem, { onOperationComplete: checkModifiedItem });
    }

    function checkModifiedItem(c, s, o, i, changedItem) {
        let seq = changedItem.getProperty("SEQUENCE");
        let rec = changedItem.recurrenceInfo.getOccurrenceFor(rid);

        do_check_eq(seq, 4);
        do_check_eq(rec.getProperty("SEQUENCE"), seq);

        // Now check with the pref off
        storage.deleteProperty("capabilities.propagate-sequence");

        let changedItem2 = changedItem.clone();
        changedItem2.setProperty("SEQUENCE", parseInt(seq, 10) + 1);

        storage.modifyItem(changedItem2, changedItem, { onOperationComplete: checkNormalItem });

    }

    function checkNormalItem(c, s, o, i, changedItem) {
        let seq = changedItem.getProperty("SEQUENCE");
        let rec = changedItem.recurrenceInfo.getOccurrenceFor(rid);

        do_check_eq(seq, 5);
        do_check_eq(rec.getProperty("SEQUENCE"), 4);
        completeTest();
    }

    function completeTest() {
        do_test_finished();
    }
}
