/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource:///modules/Services.jsm");

/**
 * Tests the calICalendarManager interface
 */
function run_test() {
    do_get_profile();
    add_test(test_registration);
    add_test(test_calobserver);
    cal.getCalendarManager().startup({ onResult: function() {
        run_next_test();
    }});
}

function test_calobserver() {
    function checkCounters(add, modify, del, alladd, allmodify, alldel) {
        do_check_eq(calcounter.addItem, add);
        do_check_eq(calcounter.modifyItem, modify);
        do_check_eq(calcounter.deleteItem, del);
        do_check_eq(allcounter.addItem, alladd === undefined ? add : alladd);
        do_check_eq(allcounter.modifyItem, allmodify === undefined ? modify : allmodify);
        do_check_eq(allcounter.deleteItem, alldel === undefined ? del : alldel);
        resetCounters();
    }
    function resetCounters() {
        calcounter = { addItem: 0, modifyItem: 0, deleteItem: 0 };
        allcounter = { addItem: 0, modifyItem: 0, deleteItem: 0 };
    }

    // First of all we need a local calendar to work on and some variables
    let calmgr = cal.getCalendarManager();
    let memory = calmgr.createCalendar("memory", Services.io.newURI("moz-memory-calendar://", null, null));
    let memory2 = calmgr.createCalendar("memory", Services.io.newURI("moz-memory-calendar://", null, null));
    let calcounter, allcounter;

    // These observers will end up counting calls which we will use later on
    let calobs = cal.createAdapter(Components.interfaces.calIObserver, {
        onAddItem: function(itm) calcounter.addItem++,
        onModifyItem: function(itm) calcounter.modifyItem++,
        onDeleteItem: function(itm) calcounter.deleteItem++
    });
    let allobs = cal.createAdapter(Components.interfaces.calIObserver, {
        onAddItem: function(itm) allcounter.addItem++,
        onModifyItem: function(itm) allcounter.modifyItem++,
        onDeleteItem: function(itm) allcounter.deleteItem++
    });

    // Set up counters and observers
    resetCounters();
    calmgr.registerCalendar(memory);
    calmgr.registerCalendar(memory2);
    calmgr.addCalendarObserver(allobs);
    memory.addObserver(calobs);

    // Add an item
    let item = cal.createEvent();
    item.id = cal.getUUID()
    item.startDate = cal.now();
    item.endDate = cal.now();
    memory.addItem(item, null);
    checkCounters(1, 0, 0);

    // Modify the item
    let newItem = item.clone();
    newItem.title = "title";
    memory.modifyItem(newItem, item, null);
    checkCounters(0, 1, 0);

    // Delete the item
    newItem.generation++; // circumvent generation checks for easier code
    memory.deleteItem(newItem, null);
    checkCounters(0, 0, 1);

    // Now check the same for adding the item to a calendar only observed by the
    // calendar manager. The calcounters should still be 0, but the calendar
    // manager counter should have an item added, modified and deleted
    memory2.addItem(item, null);
    memory2.modifyItem(newItem, item, null);
    memory2.deleteItem(newItem, null);
    checkCounters(0, 0, 0, 1, 1, 1);

    // Remove observers
    memory.removeObserver(calobs);
    calmgr.removeCalendarObserver(allobs);

    // Make sure removing it actually worked
    memory.addItem(item, null);
    memory.modifyItem(newItem, item, null);
    memory.deleteItem(newItem, null);
    checkCounters(0, 0, 0);

    // We are done now, start the next test
    run_next_test();
}

function test_registration() {
    function checkCalendarCount(net, rdonly, all) {
        do_check_eq(calmgr.networkCalendarCount, net);
        do_check_eq(calmgr.readOnlyCalendarCount , rdonly);
        do_check_eq(calmgr.calendarCount, all);
    }
    function checkRegistration(reg, unreg, del) {
        do_check_eq(registered, reg);
        do_check_eq(unregistered, unreg);
        do_check_eq(deleted, del);
        registered = false;
        unregistered = false;
        deleted = false;
    }

    // Initially there should be no calendars
    let calmgr = cal.getCalendarManager();
    checkCalendarCount(0, 0, 0);

    // Create a local memory calendar, ths shouldn't register any calendars
    let memory = calmgr.createCalendar("memory", Services.io.newURI("moz-memory-calendar://", null, null));
    checkCalendarCount(0, 0, 0);

    // Register an observer to test it.
    let registered = false, unregistered = false, deleted = false, readOnly = false;
    let mgrobs = cal.createAdapter(Components.interfaces.calICalendarManagerObserver, {
        onCalendarRegistered: function onCalendarRegistered(aCalendar) {
            if (aCalendar.id == memory.id) registered = true;
        },
        onCalendarUnregistering: function onCalendarUnregistering(aCalendar) {
            if (aCalendar.id == memory.id) unregistered = true;
        },
        onCalendarDeleting: function onCalendarDeleting(aCalendar) {
            if (aCalendar.id == memory.id) deleted = true;
        }
    });
    let calobs = cal.createAdapter(Components.interfaces.calIObserver, {
        onPropertyChanged: function onPropertyChanging(aCalendar, aName, aValue, aOldValue) {
            do_check_eq(aCalendar.id, memory.id);
            do_check_eq(aName, "readOnly");
            readOnly = aValue;
        }
    });
    memory.addObserver(calobs);
    calmgr.addObserver(mgrobs);

    // Register the calendar and check if its counted and observed
    calmgr.registerCalendar(memory);
    checkRegistration(true, false, false);
    checkCalendarCount(0, 0, 1);

    // The calendar should now have an id
    do_check_neq(memory.id, null);

    // And be in the list of calendars
    do_check_true(memory == calmgr.getCalendarById(memory.id));
    do_check_true(calmgr.getCalendars({}).some(function(x) x.id == memory.id));

    // Make it readonly and check if the observer caught it
    memory.setProperty("readOnly", true);
    do_check_eq(readOnly, true);

    // Now unregister it
    calmgr.unregisterCalendar(memory);
    checkRegistration(false, true, false);
    checkCalendarCount(0, 0, 0);

    // The calendar shouldn't be in the list of ids
    do_check_eq(calmgr.getCalendarById(memory.id), null);
    do_check_true(calmgr.getCalendars({}).every(function(x) x.id != memory.id));

    // And finally delete it
    calmgr.deleteCalendar(memory);
    checkRegistration(false, false, true);
    checkCalendarCount(0, 0, 0);

    // Now remove the observer again
    calmgr.removeObserver(mgrobs);
    memory.removeObserver(calobs);

    // Check if removing it actually worked
    calmgr.registerCalendar(memory);
    calmgr.unregisterCalendar(memory);
    calmgr.deleteCalendar(memory);
    memory.setProperty("readOnly", false);
    checkRegistration(false, false, false);
    do_check_eq(readOnly, true);
    checkCalendarCount(0, 0, 0);

    // We are done now, start the next test
    run_next_test();
}
