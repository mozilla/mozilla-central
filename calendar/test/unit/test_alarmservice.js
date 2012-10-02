/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource:///modules/Services.jsm");

const EXPECT_NONE = 0;
const EXPECT_FIRED = 1;
const EXPECT_TIMER = 2;

function do_check_xor(a, b) do_check_true((a && !b) || (!a && b));

let alarmObserver = {
    service: null,
    firedMap: {},
    expectedMap: {},
    pendingOps: {},

    onAlarm: function obs_onAlarm(aItem, aAlarm) {
        this.firedMap[aItem.hashId] = this.firedMap[aItem.hashId] || {};
        this.firedMap[aItem.hashId][aAlarm.icalString] = true;
    },

    onRemoveAlarmsByItem: function obs_onRemoveAlarmsByItem(aItem) {
        if (aItem.hashId in this.firedMap) {
            delete this.firedMap[aItem.hashId];
        }
    },

    onAlarmsLoaded: function obs_onAlarmsLoaded(aCalendar) {
        if (aCalendar.id in this.pendingOps) {
            this.pendingOps[aCalendar.id].call();
        }
    },

    doOnAlarmsLoaded: function obs_doOnAlarmsLoaded(aCalendar, aOperation) {
        if (aCalendar.id in this.service.mLoadedCalendars) {
            // the calendar's alarms have already been loaded, do the callback now
            aOperation.call();
        } else {
            // the calendar hasn't been fully loaded yet, set as a pending operation
            this.pendingOps[aCalendar.id] = aOperation;
        }
    },

    getTimer: function obs_getTimer(aCalendarId, aItemId, aAlarmStr) {
        return (aCalendarId in this.service.mTimerMap &&
                aItemId in this.service.mTimerMap[aCalendarId] &&
                aAlarmStr in this.service.mTimerMap[aCalendarId][aItemId]) ?
               this.service.mTimerMap[aCalendarId][aItemId][aAlarmStr] : null;
    },

    expectResult: function obs_expectResult(aCalendar, aItem, aAlarm, aExpected) {
        this.expectedMap[aCalendar.id] = this.expectedMap[aCalendar.id] || {};
        this.expectedMap[aCalendar.id][aItem.hashId] = this.expectedMap[aCalendar.id][aItem.hashId] || {};
        this.expectedMap[aCalendar.id][aItem.hashId][aAlarm.icalString] = aExpected;
    },

    expectOccurrences: function obs_expectOccurrences(aCalendar, aItem, aAlarm, aExpectedArray) {
        // we need to be earlier than the first occurrence
        let dt = aItem.startDate.clone();
        dt.second -= 1;

        for each (let expected in aExpectedArray) {
            let occ = aItem.recurrenceInfo.getNextOccurrence(dt);
            dt = occ.startDate;
            this.expectResult(aCalendar, occ, aAlarm, expected);
        }
    },

    checkExpected: function obs_checkExpected() {
        for (let calId in this.expectedMap) {
            for (let id in this.expectedMap[calId]) {
                for (let icalString in this.expectedMap[calId][id]) {
                    // only alarms expected as fired should exist in our fired alarm map
                    do_check_xor(this.expectedMap[calId][id][icalString] != EXPECT_FIRED,
                                 (id in this.firedMap) &&
                                 (icalString in this.firedMap[id]));
                    // only alarms expected as timers should exist in the service's timer map
                    do_check_xor(this.expectedMap[calId][id][icalString] != EXPECT_TIMER,
                                 !!this.getTimer(calId, id, icalString));
                }
            }
        }
    },

    clear: function obs_clear() {
        this.firedMap = {};
        this.pendingOps = {};
        this.expectedMap = {};
    }
};

function run_test() {
    do_get_profile();

    add_test(test_addItems);
    add_test(test_loadCalendar);
    add_test(test_modifyItems);

    initializeAlarmService();
    cal.getCalendarManager().startup({onResult: function() {
        run_next_test();
    }});
}

function initializeAlarmService() {
    alarmObserver.service = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                                       .getService(Components.interfaces.calIAlarmService)
                                       .wrappedJSObject;
    do_check_false(alarmObserver.service.mStarted);

    alarmObserver.service.startup();
    do_check_true(alarmObserver.service.mStarted);

    // we need to replace the existing observers with our observer
    for each (let obs in alarmObserver.service.mObservers.mInterfaces) {
        alarmObserver.service.removeObserver(obs);
    }
    alarmObserver.service.addObserver(alarmObserver);
}

function createAlarmFromDuration(aOffset) {
    let alarm = cal.createAlarm();

    alarm.related = Ci.calIAlarm.ALARM_RELATED_START;
    alarm.offset = cal.createDuration(aOffset);

    return alarm;
}

function createEventWithAlarm(aCalendar, aStart, aEnd, aOffset, aRRule) {
    let alarm = null;
    let item = cal.createEvent();

    item.id = cal.getUUID();
    item.calendar = aCalendar;
    item.startDate = aStart || cal.now();
    item.endDate = aEnd || cal.now();
    if (aOffset) {
        alarm = createAlarmFromDuration(aOffset);
        item.addAlarm(alarm);
    }
    if (aRRule) {
        item.recurrenceInfo = cal.createRecurrenceInfo(item);
        item.recurrenceInfo.appendRecurrenceItem(cal.createRecurrenceRule(aRRule));
    }
    return [item, alarm];
}

function addTestItems(aCalendar) {
    let item, alarm;

    // alarm on an item starting more than a month in the past should not fire
    let dt = cal.now();
    dt.day -= 32;
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "P7D");
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_NONE);
    aCalendar.addItem(item, null);

    // alarm 15 minutes ago should fire
    dt = cal.now();
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "-PT15M");
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_FIRED);
    aCalendar.addItem(item, null);

    // alarm within 6 hours should have a timer set
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "PT1H");
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_TIMER);
    aCalendar.addItem(item, null);

    // alarm more than 6 hours in the future should not have a timer set
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "PT7H");
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_NONE);
    aCalendar.addItem(item, null);

    // test multiple alarms on an item
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt);
    [["-PT1H", EXPECT_FIRED], ["-PT15M", EXPECT_FIRED], ["PT1H", EXPECT_TIMER],
     ["PT7H", EXPECT_NONE], ["P7D", EXPECT_NONE]].forEach(function([offset, expected]) {
        alarm = createAlarmFromDuration(offset);
        item.addAlarm(alarm);
        alarmObserver.expectResult(aCalendar, item, alarm, expected);
    }, this);
    aCalendar.addItem(item, null);

    // daily repeating event starting almost 2 full days ago. The alarms on the first 2 occurrences
    // should fire, and a timer should be set for the next occurrence only
    dt = cal.now();
    dt.hour -= 47;
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "-PT15M", "RRULE:FREQ=DAILY");
    alarmObserver.expectOccurrences(aCalendar, item, alarm,
                                   [EXPECT_FIRED, EXPECT_FIRED, EXPECT_TIMER,
                                    EXPECT_NONE, EXPECT_NONE]);
    aCalendar.addItem(item, null);

    // monthly repeating event starting 2 months and a day ago. The alarms on the first 2 occurrences
    // should be ignored, the alarm on the next occurrence only should fire
    dt = cal.now();
    dt.month -= 2;
    dt.day -= 1;
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "-PT15M", "RRULE:FREQ=MONTHLY");
    alarmObserver.expectOccurrences(aCalendar, item, alarm,
                                   [EXPECT_NONE, EXPECT_NONE, EXPECT_FIRED,
                                    EXPECT_NONE, EXPECT_NONE]);
    aCalendar.addItem(item, null);
}

function doModifyItemTest(aCalendar) {
    let item, alarm;

    // begin with item starting before the alarm date range
    let dt = cal.now();
    dt.day -= 32;
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "PT0S");
    aCalendar.addItem(item, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_NONE);
    alarmObserver.checkExpected();

    // move event into the fired range
    let oldItem = item.clone();
    dt.day += 31;
    item.startDate = dt.clone();
    item.generation++;
    aCalendar.modifyItem(item, oldItem, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_FIRED);
    alarmObserver.checkExpected();

    // move event into the timer range
    oldItem = item.clone();
    dt.hour += 25;
    item.startDate = dt.clone();
    item.generation++;
    aCalendar.modifyItem(item, oldItem, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_TIMER);
    alarmObserver.checkExpected();

    // move event past the timer range
    oldItem = item.clone();
    dt.hour += 6;
    item.startDate = dt.clone();
    item.generation++;
    aCalendar.modifyItem(item, oldItem, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_NONE);
    alarmObserver.checkExpected();
}

function doDeleteItemTest(aCalendar) {
    let item, alarm;
    let item2, alarm2;

    // create a fired alarm and a timer
    let dt = cal.now();
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "-PT5M");
    [item2, alarm2] = createEventWithAlarm(aCalendar, dt, dt, "PT1H");
    aCalendar.addItem(item, null);
    aCalendar.addItem(item2, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_FIRED);
    alarmObserver.expectResult(aCalendar, item2, alarm2, EXPECT_TIMER);
    alarmObserver.checkExpected();

    // item deletion should clear the fired alarm and timer
    aCalendar.deleteItem(item, null);
    aCalendar.deleteItem(item2, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_NONE);
    alarmObserver.expectResult(aCalendar, item2, alarm2, EXPECT_NONE);
    alarmObserver.checkExpected();
}

function doAcknowledgeTest(aCalendar) {
    let item, alarm;
    let item2, alarm2;

    // create the fired alarms
    let dt = cal.now();
    [item, alarm] = createEventWithAlarm(aCalendar, dt, dt, "-PT5M");
    [item2, alarm2] = createEventWithAlarm(aCalendar, dt, dt, "-PT5M");
    aCalendar.addItem(item, null);
    aCalendar.addItem(item2, null);
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_FIRED);
    alarmObserver.expectResult(aCalendar, item2, alarm2, EXPECT_FIRED);
    alarmObserver.checkExpected();

    // test snooze alarm
    alarmObserver.service.snoozeAlarm(item, alarm, cal.createDuration("PT1H"));
    alarmObserver.expectResult(aCalendar, item, alarm, EXPECT_TIMER);
    alarmObserver.checkExpected();

    // the snoozed alarm timer delay should be close to an hour
    let tmr = alarmObserver.getTimer(aCalendar.id, item.hashId, alarm.icalString);
    do_check_true(Math.abs(tmr.delay - 3600000) <= 1000);

    // test dismiss alarm
    alarmObserver.service.dismissAlarm(item2, alarm2);
    alarmObserver.expectResult(aCalendar, item2, alarm2, EXPECT_NONE);
    alarmObserver.checkExpected();
}

function doRunTest(aOnCalendarCreated, aOnAlarmsLoaded) {
    alarmObserver.clear();

    let calmgr = cal.getCalendarManager();
    let memory = calmgr.createCalendar("memory", Services.io.newURI("moz-memory-calendar://", null, null));
    memory.id = cal.getUUID();

    if (aOnCalendarCreated) {
        aOnCalendarCreated.call(aOnCalendarCreated, memory);
    }

    calmgr.registerCalendar(memory);

    alarmObserver.doOnAlarmsLoaded(memory, function() {
        if (aOnAlarmsLoaded) {
            aOnAlarmsLoaded.call(aOnAlarmsLoaded, memory);
        }

        run_next_test();
    });
}

// Test the initial alarm loading of a calendar with existing data
function test_loadCalendar() {
    doRunTest(addTestItems, alarmObserver.checkExpected.bind(alarmObserver));
}

// Test adding alarm data to a calendar already registered
function test_addItems() {
    doRunTest(null, function(memory) {
        addTestItems(memory);
        alarmObserver.checkExpected();
    });
}

// Test response to modification of alarm data
function test_modifyItems() {
    doRunTest(null, function(memory) {
        doModifyItemTest(memory);
        doDeleteItemTest(memory);
        doAcknowledgeTest(memory);
    });
}
