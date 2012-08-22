/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run_test() {
    do_get_profile();
    let delmgr = Components.classes["@mozilla.org/calendar/deleted-items-manager;1"]
                           .getService(Components.interfaces.calIDeletedItems);
    delmgr.observe(null, "profile-after-change", null);

    add_test(test_deleted_items);
    cal.getCalendarManager().startup({ onResult: function() {
        run_next_test();
    }});
}

function test_deleted_items() {
    let calmgr = cal.getCalendarManager();
    let delmgr = Components.classes["@mozilla.org/calendar/deleted-items-manager;1"]
                           .getService(Components.interfaces.calIDeletedItems);
    // No items have been deleted, retrieving one should return null
    do_check_null(delmgr.getDeletedDate("random"));
    do_check_null(delmgr.getDeletedDate("random", "random"));

    // This shouldn't throw anything
    delmgr.flush();

    let memory = calmgr.createCalendar("memory", Services.io.newURI("moz-storage-calendar://", null, null));
    calmgr.registerCalendar(memory);

    let item = cal.createEvent();
    item.id = "test-item-1";
    item.startDate = cal.now();
    item.endDate = cal.now();

    memory.addItem(item, null);
    do_check_null(delmgr.getDeletedDate(item.id));
    do_check_null(delmgr.getDeletedDate(item.id, memory.id));

    // We need to stop time so we have something to compare with
    let referenceDate = cal.createDateTime("20120726T112045"); referenceDate.timezone = cal.calendarDefaultTimezone();
    let futureDate = cal.createDateTime("20380101T000000");  futureDate.timezone = cal.calendarDefaultTimezone();
    let useFutureDate = false;
    let oldNowFunction = cal.now;
    cal.now = function test_specific_now() {
        return (useFutureDate ? futureDate : referenceDate).clone();
    }

    // Deleting an item should trigger it being marked for deletion
    memory.deleteItem(item, null);

    // Now check if it was deleted at our reference date.
    let deltime = delmgr.getDeletedDate(item.id);
    do_check_neq(deltime, null);
    do_check_eq(deltime.compare(referenceDate), 0);

    // The same with the calendar
    deltime = delmgr.getDeletedDate(item.id, memory.id);
    do_check_neq(deltime, null);
    do_check_eq(deltime.compare(referenceDate), 0);

    // Item should not be found in other calendars
    do_check_null(delmgr.getDeletedDate(item.id, "random"));

    // Check if flushing works, we need to travel time for that
    useFutureDate = true;
    delmgr.flush();
    do_check_null(delmgr.getDeletedDate(item.id));
    do_check_null(delmgr.getDeletedDate(item.id, memory.id));

    // Deleting an item and adding it again should consider it not deleted
    useFutureDate = false;
    memory.addItem(item, null);
    memory.deleteItem(item, null);
    memory.addItem(item, null);
    do_check_null(delmgr.getDeletedDate(item.id));

    // Revert now function, in case more tests are written
    cal.now = oldNowFunction;

    run_next_test();
}

