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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Joey Minta <jminta@gmail.com>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");

const kHoursBetweenUpdates = 6;

function nowUTC() {
    return jsDateToDateTime(new Date()).getInTimezone(UTC());
}

function newTimerWithCallback(aCallback, aDelay, aRepeating) {
    let timer = Components.classes["@mozilla.org/timer;1"]
                          .createInstance(Components.interfaces.nsITimer);

    timer.initWithCallback(aCallback,
                           aDelay,
                           (aRepeating ? timer.TYPE_REPEATING_PRECISE : timer.TYPE_ONE_SHOT));
    return timer;
}

function calAlarmService() {
    this.wrappedJSObject = this;

    this.mLoadedCalendars = {};
    this.mTimerMap = {};
    this.mObservers = new calListenerBag(Components.interfaces.calIAlarmServiceObserver);

    this.calendarObserver = {
        alarmService: this,

        // calIObserver:
        onStartBatch: function() { },
        onEndBatch: function() { },
        onLoad: function co_onLoad(calendar) {
            // ignore any onLoad events until initial getItems() call of startup has finished:
            if (calendar && this.alarmService.mLoadedCalendars[calendar.id]) {
                // a refreshed calendar signals that it has been reloaded
                // (and cannot notify detailed changes), thus reget all alarms of it:
                this.alarmService.initAlarms([calendar]);
            }
        },

        onAddItem: function(aItem) {
            let occs = [];
            if (aItem.recurrenceInfo) {
                let start = this.alarmService.mRangeEnd.clone();
                // We search 1 month in each direction for alarms.  Therefore,
                // we need to go back 2 months from the end to get this right.
                start.month -= 2;
                occs = aItem.recurrenceInfo.getOccurrences(start, this.alarmService.mRangeEnd, 0, {});
            } else {
                occs = [aItem];
            }

            // Add an alarm for each occurrence
            occs.forEach(this.alarmService.addAlarmsForItem,
                         this.alarmService);
        },
        onModifyItem: function(aNewItem, aOldItem) {
            if (!aNewItem.recurrenceId) {
                // deleting an occurrence currently calls modifyItem(newParent, *oldOccurrence*)
                aOldItem = aOldItem.parentItem;
            }

            this.onDeleteItem(aOldItem);
            this.onAddItem(aNewItem);
        },
        onDeleteItem: function(aDeletedItem) {
            this.alarmService.removeAlarmsForItem(aDeletedItem);
        },
        onError: function(aCalendar, aErrNo, aMessage) {},
        onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
            switch (aName) {
                case "suppressAlarms":
                case "disabled":
                    this.alarmService.initAlarms([aCalendar]);
                    break;
            }
        },
        onPropertyDeleting: function(aCalendar, aName) {
            this.onPropertyChanged(aCalendar, aName);
        }
    };

    this.calendarManagerObserver = {
        alarmService: this,

        onCalendarRegistered: function(aCalendar) {
            this.alarmService.observeCalendar(aCalendar);
            // initial refresh of alarms for new calendar:
            this.alarmService.initAlarms([aCalendar]);
        },
        onCalendarUnregistering: function(aCalendar) {
            // XXX todo: we need to think about calendar unregistration;
            // there may still be dangling items (-> alarm dialog),
            // dismissing those alarms may write data...
            this.alarmService.unobserveCalendar(aCalendar);
        },
        onCalendarDeleting: function(aCalendar) {}
    };
}

calAlarmService.prototype = {
    mRangeEnd: null,
    mUpdateTimer: null,
    mStarted: false,
    mTimerMap: null,
    mObservers: null,
    mTimezone: null,

    getInterfaces: function cAS_getInterfaces(aCount) {
        let ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIAlarmService,
            Components.interfaces.nsIObserver,
            Components.interfaces.nsIClassInfo
        ];
        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function cAS_getHelperForLanguage(language) {
        return null;
    },

    /**
     * nsIClassInfo
     */
    contractID: "@mozilla.org/calendar/alarm-service;1",
    classDescription: "Calendar Alarm Service",
    classID: Components.ID("{7a9200dd-6a64-4fff-a798-c5802186e2cc}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    QueryInterface: function cAS_QueryInterface(aIID) {
        return doQueryInterface(this, calAlarmService.prototype, aIID, null, this);
    },

    /**
     * nsIObserver
     */
    observe: function cAS_observe(aSubject, aTopic, aData) {
        // This will also be called on app-startup, but nothing is done yet, to
        // prevent unwanted dialogs etc. See bug 325476 and 413296
        if (aTopic == "profile-after-change" || aTopic == "wake_notification") {
            this.shutdown();
            this.startup();
        }
        if (aTopic == "xpcom-shutdown") {
            this.shutdown();
        }
    },

    /**
     * calIAlarmService APIs
     */
    get timezone cAS_get_timezone() {
        // TODO Do we really need this? Do we ever set the timezone to something
        // different than the default timezone?
        return this.mTimezone || calendarDefaultTimezone();
    },

    set timezone cAS_set_timezone(aTimezone) {
        return (this.mTimezone = aTimezone);
    },

    snoozeAlarm: function cAS_snoozeAlarm(aItem, aAlarm, aDuration) {
        // Right now we only support snoozing all alarms for the given item for
        // aDuration.

        // Make sure we're working with the parent, otherwise we'll accidentally
        // create an exception
        let newEvent = aItem.parentItem.clone();
        let alarmTime = nowUTC();

        // Set the last acknowledged time to now.
        newEvent.alarmLastAck = alarmTime;

        alarmTime = alarmTime.clone();
        alarmTime.addDuration(aDuration);

        if (aItem.parentItem != aItem) {
            // This is the *really* hard case where we've snoozed a single
            // instance of a recurring event.  We need to not only know that
            // there was a snooze, but also which occurrence was snoozed.  Part
            // of me just wants to create a local db of snoozes here...
            newEvent.setProperty("X-MOZ-SNOOZE-TIME-" + aItem.recurrenceId.nativeTime,
                                 alarmTime.icalString);
        } else {
            newEvent.setProperty("X-MOZ-SNOOZE-TIME", alarmTime.icalString);
        }
        // calling modifyItem will cause us to get the right callback
        // and update the alarm properly
        return newEvent.calendar.modifyItem(newEvent, aItem.parentItem, null);
    },

    dismissAlarm: function cAS_dismissAlarm(aItem, aAlarm) {
        let now = nowUTC();
        // We want the parent item, otherwise we're going to accidentally create an
        // exception.  We've relnoted (for 0.1) the slightly odd behavior this can
        // cause if you move an event after dismissing an alarm
        let oldParent = aItem.parentItem;
        let newParent = oldParent.clone();
        newParent.alarmLastAck = now;
        // Make sure to clear out any snoozes that were here.
        if (aItem.recurrenceId) {
            newParent.deleteProperty("X-MOZ-SNOOZE-TIME-" + aItem.recurrenceId.nativeTime);
        } else {
            newParent.deleteProperty("X-MOZ-SNOOZE-TIME");
        }
        return newParent.calendar.modifyItem(newParent, oldParent, null);
    },

    addObserver: function cAS_addObserver(aObserver) {
        this.mObservers.add(aObserver);
    },

    removeObserver: function cAS_removeObserver(aObserver) {
        this.mObservers.remove(aObserver);
    },

    startup: function cAS_startup() {
        if (this.mStarted) {
            return;
        }

        cal.LOG("[calAlarmService] starting...");

        let observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService
                          (Components.interfaces.nsIObserverService);

        observerSvc.addObserver(this, "profile-after-change", false);
        observerSvc.addObserver(this, "xpcom-shutdown", false);
        observerSvc.addObserver(this, "wake_notification", false);

        /* Tell people that we're alive so they can start monitoring alarms.
         */
        let notifier = Components.classes["@mozilla.org/embedcomp/appstartup-notifier;1"]
                                 .getService(Components.interfaces.nsIObserver);
        notifier.observe(null, "alarm-service-startup", null);

        getCalendarManager().addObserver(this.calendarManagerObserver);

        for each(let calendar in getCalendarManager().getCalendars({})) {
            this.observeCalendar(calendar);
        }

        /* set up a timer to update alarms every N hours */
        let timerCallback = {
            alarmService: this,
            notify: function timer_notify() {
                let now = nowUTC();
                let start;
                if (!this.alarmService.mRangeEnd) {
                    // This is our first search for alarms.  We're going to look for
                    // alarms +/- 1 month from now.  If someone sets an alarm more than
                    // a month ahead of an event, or doesn't start Sunbird/Lightning
                    // for a month, they'll miss some, but that's a slim chance
                    start = now.clone();
                    start.month -= 1;
                } else {
                    // This is a subsequent search, so we got all the past alarms before
                    start = this.alarmService.mRangeEnd.clone();
                }
                let until = now.clone();
                until.month += 1;

                // We don't set timers for every future alarm, only those within 6 hours
                let end = now.clone();
                end.hour += kHoursBetweenUpdates;
                this.alarmService.mRangeEnd = end.getInTimezone(UTC());

                this.alarmService.findAlarms(getCalendarManager().getCalendars({}),
                                             start, until);
            }
        };
        timerCallback.notify();

        this.mUpdateTimer = newTimerWithCallback(timerCallback, kHoursBetweenUpdates * 3600000, true);

        this.mStarted = true;
    },

    shutdown: function cAS_shutdown() {
        /* tell people that we're no longer running */
        let notifier = Components.classes["@mozilla.org/embedcomp/appstartup-notifier;1"]
                                 .getService(Components.interfaces.nsIObserver);
        notifier.observe(null, "alarm-service-shutdown", null);

        if (this.mUpdateTimer) {
            this.mUpdateTimer.cancel();
            this.mUpdateTimer = null;
        }

        let calmgr = cal.getCalendarManager();
        calmgr.removeObserver(this.calendarManagerObserver);

        for each (let calendarItemMap in this.mTimerMap) {
            for each (let alarmMap in calendarItemMap) {
                for each (let timer in alarmMap) {
                    timer.cancel();
                }
            }
        }

        this.mTimerMap = {};

        for each (let calendar in calmgr.getCalendars({})) {
            this.unobserveCalendar(calendar);
        }

        this.mRangeEnd = null;

        let observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);

        observerSvc.removeObserver(this, "profile-after-change");
        observerSvc.removeObserver(this, "xpcom-shutdown");
        observerSvc.removeObserver(this, "wake_notification");

        this.mStarted = false;
    },

    observeCalendar: function cAS_observeCalendar(calendar) {
        calendar.addObserver(this.calendarObserver);
    },

    unobserveCalendar: function cAS_unobserveCalendar(calendar) {
        calendar.removeObserver(this.calendarObserver);
        this.disposeCalendarTimers([calendar]);
        this.mObservers.notify("onRemoveAlarmsByCalendar", [calendar]);
    },

    addAlarmsForItem: function cAS_addAlarmsForItem(aItem) {
        if (cal.isToDo(aItem) && aItem.isCompleted) {
            // If this is a task and it is completed, don't add the alarm.
            return;
        }

        let showMissed = cal.getPrefSafe("calendar.alarms.showmissed", true);

        let alarms = aItem.getAlarms({});
        for each (let alarm in alarms) {
            let alarmDate = cal.alarms.calculateAlarmDate(aItem, alarm);

            if (!alarmDate || alarm.action != "DISPLAY") {
                // Only take care of DISPLAY alarms with an alarm date.
                continue;
            }

            // Handle all day events.  This is kinda weird, because they don't have
            // a well defined startTime.  We just consider the start/end to be
            // midnight in the user's timezone.
            if (alarmDate.isDate) {
                alarmDate = alarmDate.getInTimezone(this.timezone);
                alarmDate.isDate = false;
            }
            alarmDate = alarmDate.getInTimezone(UTC());

            // Check for snooze
            let snoozeDate;
            if (aItem.parentItem != aItem) {
                snoozeDate = aItem.parentItem.getProperty("X-MOZ-SNOOZE-TIME-" + aItem.recurrenceId.nativeTime)

            } else {
                snoozeDate = aItem.getProperty("X-MOZ-SNOOZE-TIME");
            }

            if (snoozeDate && !(snoozeDate instanceof Components.interfaces.calIDateTime)) {
                snoozeDate = cal.createDateTime(snoozeDate);
            }
            cal.LOG("[calAlarmService] considering alarm for item: " + aItem.title +
                " alarm time: " + alarmDate + " snooze time: " + snoozeDate);

            // If the alarm was snoozed, the snooze time is more important.
            alarmDate = snoozeDate || alarmDate;

            let now = nowUTC();
            if (alarmDate.timezone.isFloating) {
                now = cal.now();
                now.timezone = floating();
            }

            cal.LOG("[calAlarmService] now is " + now);
            if (alarmDate.compare(now) >= 0) {
                // We assume that future alarms haven't been acknowledged
                cal.LOG("[calAlarmService] alarm is in the future.");

                // Delay is in msec, so don't forget to multiply
                let timeout = alarmDate.subtractDate(now).inSeconds * 1000;

                // No sense in keeping an extra timeout for an alarm thats past
                // our range.
                let timeUntilRefresh = this.mRangeEnd.subtractDate(now).inSeconds * 1000;
                if (timeUntilRefresh < timeout) {
                    cal.LOG("[calAlarmService] alarm is too late.");
                    continue;
                }

                this.addTimer(aItem, alarm, timeout);
            } else if (showMissed) {
                // This alarm is in the past.  See if it has been previously ack'd.
                let lastAck = aItem.alarmLastAck || aItem.parentItem.alarmLastAck;
                cal.LOG("[calAlarmService] last ack was: " + lastAck);

                if (lastAck && lastAck.compare(alarmDate) >= 0) {
                    // The alarm was previously dismissed or snoozed, no further
                    // action required.
                    cal.LOG("[calAlarmService] " + aItem.title + " - alarm previously ackd.");
                    continue;
                } else {
                    // The alarm was not snoozed or dismissed, fire it now.
                    cal.LOG("[calAlarmService] alarm is in the past and unack'd, firing now!");
                    this.alarmFired(aItem, alarm);
                }
            }
        }
    },

    removeAlarmsForItem: function cAS_removeAlarmsForItem(aItem) {
        // make sure already fired alarms are purged out of the alarm window:
        this.mObservers.notify("onRemoveAlarmsByItem", [aItem]);
        // Purge alarms specifically for this item (i.e exception)
        for each (let alarm in aItem.getAlarms({})) {
            this.removeTimer(aItem, alarm);
        }
    },

    addTimer: function cAS_addTimer(aItem, aAlarm, aTimeout) {
        this.mTimerMap[aItem.calendar.id] =
            this.mTimerMap[aItem.calendar.id] || {};
        this.mTimerMap[aItem.calendar.id][aItem.hashId] =
            this.mTimerMap[aItem.calendar.id][aItem.hashId] || {};

        let self = this;
        let alarmTimerCallback = {
            notify: function aTC_notify() {
                self.alarmFired(aItem, aAlarm);
            }
        };

        let timer = newTimerWithCallback(alarmTimerCallback, aTimeout, false);
        this.mTimerMap[aItem.calendar.id][aItem.hashId][aAlarm.icalString] = timer;
    },

    removeTimer: function cAS_removeTimers(aItem, aAlarm) {
            /* Is the calendar in the timer map */
        if (aItem.calendar.id in this.mTimerMap &&
            /* ...and is the item in the calendar map */
            aItem.hashId in this.mTimerMap[aItem.calendar.id] &&
            /* ...and is the alarm in the item map ? */
            aAlarm.icalString in this.mTimerMap[aItem.calendar.id][aItem.hashId]) {

            let timer = this.mTimerMap[aItem.calendar.id][aItem.hashId][aAlarm.icalString];
            timer.cancel();

            // Remove the alarm from the item map
            delete this.mTimerMap[aItem.calendar.id][aItem.hashId][aAlarm.icalString];

            // If the item map is empty, remove it from the calendar map
            if (this.mTimerMap[aItem.calendar.id][aItem.hashId].toSource() == "({})") {
                delete this.mTimerMap[aItem.calendar.id][aItem.hashId];
            }

            // If the calendar map is empty, remove it from the timer map
            if (this.mTimerMap[aItem.calendar.id].toSource() == "({})") {
                delete this.mTimerMap[aItem.calendar.id];
            }
        }
    },

    disposeCalendarTimers: function cAS_removeCalendarTimers(aCalendars) {
        for each (let calendar in aCalendars) {
            if (calendar.id in this.mTimerMap) {
                for each (let itemTimerMap in this.mTimerMap[calendar.id]) {
                    for each (let timer in itemTimerMap) {
                        timer.cancel();
                    }
                }
                delete this.mTimerMap[calendar.id]
            }
        }
    },

    findAlarms: function cAS_findAlarms(aCalendars, aStart, aUntil) {
        let getListener = {
            alarmService: this,
            onOperationComplete: function cAS_fA_onOperationComplete(aCalendar,
                                                                     aStatus,
                                                                     aOperationType,
                                                                     aId,
                                                                     aDetail) {
                // calendar has been loaded, so until now, onLoad events can be ignored:
                this.alarmService.mLoadedCalendars[aCalendar.id] = true;
            },
            onGetResult: function cAS_fA_onGetResult(aCalendar,
                                                     aStatus,
                                                     aItemType,
                                                     aDetail,
                                                     aCount,
                                                     aItems) {
                for each (let item in aItems) {
                    // assure we don't fire alarms twice, handle removed alarms as far as we can:
                    // e.g. we cannot purge removed items from ics files. XXX todo.
                    this.alarmService.removeAlarmsForItem(item);
                    this.alarmService.addAlarmsForItem(item);
                }
            }
        };

        const calICalendar = Components.interfaces.calICalendar;
        let filter = calICalendar.ITEM_FILTER_COMPLETED_ALL |
                     calICalendar.ITEM_FILTER_CLASS_OCCURRENCES |
                     calICalendar.ITEM_FILTER_TYPE_ALL;

        for each (let calendar in aCalendars) {
            // assuming that suppressAlarms does not change anymore until refresh:
            if (!calendar.getProperty("suppressAlarms") &&
                !calendar.getProperty("disabled")) {
                calendar.getItems(filter, 0, aStart, aUntil, getListener);
            }
        }
    },

    initAlarms: function cAS_initAlarms(aCalendars) {
        // Purge out all alarm timers belonging to the refreshed/loaded calendar:
        this.disposeCalendarTimers(aCalendars);

        // Purge out all alarms from dialog belonging to the refreshed/loaded calendar:
        this.mObservers.notify("onRemoveAlarmsByCalendar", aCalendars);

        // Total refresh similar to startup.  We're going to look for
        // alarms +/- 1 month from now.  If someone sets an alarm more than
        // a month ahead of an event, or doesn't start Sunbird/Lightning
        // for a month, they'll miss some, but that's a slim chance
        let start = nowUTC();
        let until = start.clone();
        start.month -= 1;
        until.month += 1;
        this.findAlarms(aCalendars, start, until);
    },

    alarmFired: function cAS_alarmFired(aItem, aAlarm) {
        if (!aItem.calendar.getProperty("suppressAlarms") &&
            !aItem.calendar.getProperty("disabled") &&
            aItem.getProperty("STATUS") != "CANCELLED") {
            this.mObservers.notify("onAlarm", [aItem, aAlarm]);
        }
    }
};
