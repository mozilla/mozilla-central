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

const kHoursBetweenUpdates = 6;

function nowUTC() {
    return jsDateToDateTime(new Date()).getInTimezone(UTC());
}

function newTimerWithCallback(callback, delay, repeating)
{
    var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    
    timer.initWithCallback(callback,
                           delay,
                           (repeating) ? timer.TYPE_REPEATING_PRECISE : timer.TYPE_ONE_SHOT);
    return timer;
}

function calAlarmService() {
    this.wrappedJSObject = this;

    this.mLoadedCalendars = {};
    this.mTimerLookup = {};
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
            var occs = [];
            if (aItem.recurrenceInfo) {
                var start = this.alarmService.mRangeEnd.clone();
                // We search 1 month in each direction for alarms.  Therefore,
                // we need to go back 2 months from the end to get this right.
                start.month -= 2;
                occs = aItem.recurrenceInfo.getOccurrences(start, this.alarmService.mRangeEnd, 0, {});
            } else {
                occs = [aItem];
            }

            for each (var occ in occs) {
                this.alarmService.addAlarm(occ);
            }
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
            this.alarmService.removeAlarm(aDeletedItem);
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

var calAlarmServiceClassInfo = {
    getInterfaces: function (count) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIAlarmService,
            Components.interfaces.nsIObserver,
            Components.interfaces.nsIClassInfo
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/alarm-service;1",
    classDescription: "Calendar Alarm Service",
    classID: Components.ID("{7a9200dd-6a64-4fff-a798-c5802186e2cc}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON
};

calAlarmService.prototype = {
    mRangeEnd: null,
    mUpdateTimer: null,
    mStarted: false,
    mTimerLookup: null,
    mObservers: null,

    QueryInterface: function cas_QueryInterface(aIID) {
        if (aIID.equals(Components.interfaces.nsIClassInfo))
            return calAlarmServiceClassInfo;

        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calIAlarmService) &&
            !aIID.equals(Components.interfaces.nsIObserver))
        {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    /* nsIObserver */
    // This will also be called on app-startup, but nothing is done yet, to
    // prevent unwanted dialogs etc. See bug 325476 and 413296 
    observe: function cas_observe(subject, topic, data) {
        if (topic == "profile-after-change" || topic == "wake_notification") {
            this.shutdown();
            this.startup();
        }
        if (topic == "xpcom-shutdown") {
            this.shutdown();
        }
    },

    /* calIAlarmService APIs */
    mTimezone: null,
    get timezone() {
        return this.mTimezone || calendarDefaultTimezone();
    },

    set timezone(aTimezone) {
        return (this.mTimezone = aTimezone);
    },

    snoozeAlarm: function cas_snoozeAlarm(event, duration) {
        /* modify the event for a new alarm time */
        // Make sure we're working with the parent, otherwise we'll accidentally
        // create an exception
        var newEvent = event.parentItem.clone();
        var alarmTime = nowUTC();

        // Set the last acknowledged time to now.
        newEvent.alarmLastAck = alarmTime;

        alarmTime = alarmTime.clone();
        alarmTime.addDuration(duration);

        if (event.parentItem != event) {
            // This is the *really* hard case where we've snoozed a single
            // instance of a recurring event.  We need to not only know that
            // there was a snooze, but also which occurrence was snoozed.  Part
            // of me just wants to create a local db of snoozes here...
            newEvent.setProperty("X-MOZ-SNOOZE-TIME-" + event.recurrenceId.nativeTime,
                                 alarmTime.icalString);
        } else {
            newEvent.setProperty("X-MOZ-SNOOZE-TIME", alarmTime.icalString);
        }
        // calling modifyItem will cause us to get the right callback
        // and update the alarm properly
        newEvent.calendar.modifyItem(newEvent, event.parentItem, null);
    },

    dismissAlarm: function cas_dismissAlarm(item) {
        var now = nowUTC();
        // We want the parent item, otherwise we're going to accidentally create an
        // exception.  We've relnoted (for 0.1) the slightly odd behavior this can
        // cause if you move an event after dismissing an alarm
        var oldParent = item.parentItem;
        var newParent = oldParent.clone();
        newParent.alarmLastAck = now;
        // Make sure to clear out any snoozes that were here.
        if (item.recurrenceId) {
            newParent.deleteProperty("X-MOZ-SNOOZE-TIME-" + item.recurrenceId.nativeTime);
        } else {
            newParent.deleteProperty("X-MOZ-SNOOZE-TIME");
        }
        newParent.calendar.modifyItem(newParent, oldParent, null);
    },

    addObserver: function cas_addObserver(aObserver) {
        this.mObservers.add(aObserver);
    },

    removeObserver: function cas_removeObserver(aObserver) {
        this.mObservers.remove(aObserver);
    },

    notifyObservers: function cas_notifyObservers(functionName, args) {
        this.mObservers.notify(functionName, args);
    },

    startup: function cas_startup() {
        if (this.mStarted)
            return;

        LOG("[calAlarmService] starting...");

        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService
                          (Components.interfaces.nsIObserverService);

        observerSvc.addObserver(this, "profile-after-change", false);
        observerSvc.addObserver(this, "xpcom-shutdown", false);
        observerSvc.addObserver(this, "wake_notification", false);

        /* Tell people that we're alive so they can start monitoring alarms.
         */
        this.notifier = Components.classes["@mozilla.org/embedcomp/appstartup-notifier;1"]
                                  .getService(Components.interfaces.nsIObserver);
        var notifier = this.notifier;
        notifier.observe(null, "alarm-service-startup", null);

        getCalendarManager().addObserver(this.calendarManagerObserver);

        for each(var calendar in getCalendarManager().getCalendars({})) {
            this.observeCalendar(calendar);
        }

        /* set up a timer to update alarms every N hours */
        var timerCallback = {
            alarmService: this,
            notify: function timer_notify() {
                var now = nowUTC();
                var start;
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
                var until = now.clone();
                until.month += 1;
                
                // We don't set timers for every future alarm, only those within 6 hours
                var end = now.clone();
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

    shutdown: function cas_shutdown() {
        /* tell people that we're no longer running */
        var notifier = this.notifier;
        notifier.observe(null, "alarm-service-shutdown", null);

        if (this.mUpdateTimer) {
            this.mUpdateTimer.cancel();
            this.mUpdateTimer = null;
        }
        
        getCalendarManager().removeObserver(this.calendarManagerObserver);

        for each (var cal in this.mTimerLookup) {
            for each (var itemTimers in cal) {
                for each (var timer in itemTimers) {
                    if (timer instanceof Components.interfaces.nsITimer) {
                        timer.cancel();
                    }
                }
            }
        }
        this.mTimerLookup = {};

        for each(var calendar in getCalendarManager().getCalendars({})) {
            this.unobserveCalendar(calendar);
        }

        this.notifier = null;
        this.mRangeEnd = null;

        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService
                          (Components.interfaces.nsIObserverService);

        observerSvc.removeObserver(this, "profile-after-change");
        observerSvc.removeObserver(this, "xpcom-shutdown");
        observerSvc.removeObserver(this, "wake_notification");

        this.mStarted = false;
    },

    observeCalendar: function cas_observeCalendar(calendar) {
        calendar.addObserver(this.calendarObserver);
    },

    unobserveCalendar: function cas_unobserveCalendar(calendar) {
        calendar.removeObserver(this.calendarObserver);
        this.disposeCalendarTimers([calendar]);
        this.notifyObservers("onRemoveAlarmsByCalendar", [calendar]);
    },

    getAlarmDate: function cas_getAlarmTime(aItem) {
        var alarmDate = null;
        if (aItem.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_START) {
            alarmDate = aItem.startDate || aItem.entryDate || aItem.dueDate;
        } else {
            alarmDate = aItem.endDate || aItem.dueDate || aItem.entryDate;
        }

        if (!aItem.alarmOffset || !alarmDate) {
            // If there is no alarm offset, or no date the alarm offset could be
            // relative to, then there is no valid alarm.
            return null;
        }

        alarmDate = alarmDate.clone();

        // Handle all day events.  This is kinda weird, because they don't have
        // a well defined startTime.  We just consider the start/end to be
        // midnight in the user's timezone.
        if (alarmDate.isDate) {
            alarmDate = alarmDate.getInTimezone(this.timezone);
            alarmDate.isDate = false;
        }

        var offset = aItem.alarmOffset;

        alarmDate.addDuration(offset);
        alarmDate = alarmDate.getInTimezone(UTC());

        return alarmDate;
    },

    addAlarm: function cas_addAlarm(aItem) {
        // Get the alarm time
        var alarmTime = this.getAlarmDate(aItem);
        if (!alarmTime || (isToDo(aItem) && aItem.isCompleted)) {
            // If there is no alarm time, don't add the alarm. Also, if the item
            // is a task and it is completed, don't add the alarm.
            return;
        }

        // Check for snooze
        var snoozeTime;
        if (aItem.parentItem != aItem) {
            snoozeTime = aItem.parentItem.getProperty("X-MOZ-SNOOZE-TIME-"+aItem.recurrenceId.nativeTime)
        } else {
            snoozeTime = aItem.getProperty("X-MOZ-SNOOZE-TIME");
        }

        if (snoozeTime && !(snoozeTime instanceof Components.interfaces.calIDateTime)) {
            var time = createDateTime();
            time.icalString = snoozeTime;
            snoozeTime = time;
        }
        LOG("[calAlarmService] considering alarm for item: " + aItem.title +
            " alarm time: " + alarmTime + " snooze time: " + snoozeTime);

        // If the alarm was snoozed, the snooze time is more important.
        alarmTime = snoozeTime || alarmTime;

        var now = jsDateToDateTime(new Date());
        if (alarmTime.timezone.isFloating) {
            now = now.getInTimezone(calendarDefaultTimezone());
            now.timezone = floating();
        } else {
            now = now.getInTimezone(UTC());
        }
        LOG("[calAlarmService] now is " + now);
        var callbackObj = {
            alarmService: this,
            item: aItem,
            notify: function(timer) {
                this.alarmService.alarmFired(this.item);
                this.alarmService.removeTimers(this.item);
            }
        };

        if (alarmTime.compare(now) >= 0) {
            LOG("[calAlarmService] alarm is in the future.");
            // We assume that future alarms haven't been acknowledged

            // delay is in msec, so don't forget to multiply
            var timeout = alarmTime.subtractDate(now).inSeconds * 1000;

            var timeUntilRefresh = this.mRangeEnd.subtractDate(now).inSeconds * 1000;
            if (timeUntilRefresh < timeout) {
                LOG("[calAlarmService] alarm is too late.");
                // we'll get this alarm later.  No sense in keeping an extra timeout
                return;
            }

            this.addTimer(aItem, newTimerWithCallback(callbackObj, timeout, false));
            LOG("[calAlarmService] adding alarm timeout (" + timeout + ") for " + aItem);
        } else {
            var lastAck = aItem.alarmLastAck || aItem.parentItem.alarmLastAck;
            LOG("[calAlarmService] last ack was: " + lastAck);
            // This alarm is in the past.  See if it has been previously ack'd
            if (lastAck && lastAck.compare(alarmTime) >= 0) {
                LOG("[calAlarmService] " + aItem.title + " - alarm previously ackd.");
                return;
            } else { // Fire!
                LOG("[calAlarmService] alarm is in the past and unack'd, firing now!");
                this.alarmFired(aItem);
            }
        }
    },

    removeAlarm: function cas_removeAlarm(aItem) {
        // make sure already fired alarms are purged out of the alarm window:
        this.notifyObservers("onRemoveAlarmsByItem", [aItem]);
        for each (var timer in this.removeTimers(aItem)) {
            if (timer instanceof Components.interfaces.nsITimer) {
                timer.cancel();
            }
        }
    },

    addTimer: function cas_addTimer(aItem, aTimer) {
        var cal = this.mTimerLookup[aItem.calendar.id];
        if (!cal) {
            cal = {};
            this.mTimerLookup[aItem.calendar.id] = cal;
        }
        var itemTimers = cal[aItem.id];
        if (!itemTimers) {
            itemTimers = { mCount: 0 };
            cal[aItem.id] = itemTimers;
        }
        var rid = aItem.recurrenceId;
        itemTimers[rid ? rid.getInTimezone(UTC()).icalString : "mTimer"] = aTimer;
        ++itemTimers.mCount;
    },

    removeTimers: function cas_removeTimers(aItem) {
        var cal = this.mTimerLookup[aItem.calendar.id];
        if (cal) {
            var itemTimers = cal[aItem.id];
            if (itemTimers) {
                var rid = aItem.recurrenceId;
                if (rid) {
                    rid = rid.getInTimezone(UTC()).icalString;
                    var timer = itemTimers[rid];
                    if (timer) {
                        delete itemTimers[rid];
                        --itemTimers.mCount;
                        if (itemTimers.mCount == 0) {
                            delete cal[aItem.id];
                        }
                        return { mTimer: timer };
                    }
                } else {
                    delete cal[aItem.id];
                    return itemTimers;
                }
            }
        }
        return {};
    },

    disposeCalendarTimers: function cas_removeCalendarTimers(aCalendars) {
        for each (var cal in aCalendars) {
            var calTimers = this.mTimerLookup[cal.id];
            if (calTimers) {
                for each (var itemTimers in calTimers) {
                    for each (var timer in itemTimers) {
                        if (timer instanceof Components.interfaces.nsITimer) {
                            timer.cancel();
                        }
                    }
                }
                delete this.mTimerLookup[cal.id];
            }
        }
    },

    findAlarms: function cas_findAlarms(calendars, start, until) {
        var getListener = {
            alarmService: this,
            onOperationComplete: function(aCalendar, aStatus, aOperationType, aId, aDetail) {
                // calendar has been loaded, so until now, onLoad events can be ignored:
                this.alarmService.mLoadedCalendars[aCalendar.id] = true;
            },
            onGetResult: function(aCalendar, aStatus, aItemType, aDetail, aCount, aItems) {
                for (var i = 0; i < aCount; ++i) {
                    var item = aItems[i];
                    // assure we don't fire alarms twice, handle removed alarms as far as we can:
                    // e.g. we cannot purge removed items from ics files. XXX todo.
                    this.alarmService.removeAlarm(item);
                    this.alarmService.addAlarm(item);
                }
            }
        };

        const calICalendar = Components.interfaces.calICalendar;
        var filter = calICalendar.ITEM_FILTER_COMPLETED_ALL |
                     calICalendar.ITEM_FILTER_CLASS_OCCURRENCES |
                     calICalendar.ITEM_FILTER_TYPE_ALL;

        for each(var calendar in calendars) {
            // assuming that suppressAlarms does not change anymore until refresh:
            if (!calendar.getProperty("suppressAlarms") &&
                (calendar.getProperty("capabilities.alarms.popup.supported") !== false) &&
                !calendar.getProperty("disabled")) {
                calendar.getItems(filter, 0, start, until, getListener);
            }
        }
    },

    initAlarms: function cas_initAlarms(calendars) {
        // Purge out all alarm timers belonging to the refreshed/loaded calendar:
        this.disposeCalendarTimers(calendars);

        // Purge out all alarms from dialog belonging to the refreshed/loaded calendar:
        this.notifyObservers("onRemoveAlarmsByCalendar", calendars);

        // Total refresh similar to startup.  We're going to look for
        // alarms +/- 1 month from now.  If someone sets an alarm more than
        // a month ahead of an event, or doesn't start Sunbird/Lightning
        // for a month, they'll miss some, but that's a slim chance
        var start = nowUTC();
        var until = start.clone();
        start.month -= 1;
        until.month += 1;
        this.findAlarms(calendars, start, until);
    },

    alarmFired: function cas_alarmFired(event) {
        if (event.calendar.getProperty("suppressAlarms") ||
            event.calendar.getProperty("capabilities.alarms.popup.supported") === false) {
            return;
        }
        this.notifyObservers("onAlarm", [event]);
    }
};
