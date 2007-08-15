/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
    this.mObservers = [];

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
                start.normalize();
                occs = aItem.recurrenceInfo.getOccurrences(start, this.alarmService.mRangeEnd, 0, {});
            } else {
                occs = [aItem];
            }
            function hasAlarm(a) {
                return a.alarmOffset || a.parentItem.alarmOffset;
            }
            occs = occs.filter(hasAlarm);
            for each (var occ in occs) {
                this.alarmService.addAlarm(occ);
            }
        },
        onModifyItem: function(aNewItem, aOldItem) {
            if (!aNewItem.recurrenceId) {
                // deleting an occurrence currently calls modifyItem(newParent, *oldOccurrence*)
                aOldItem = aOldItem.parentItem;
            }
            this.alarmService.removeAlarm(aOldItem);

            this.onAddItem(aNewItem);
        },
        onDeleteItem: function(aDeletedItem) {
            this.alarmService.removeAlarm(aDeletedItem);
        },
        onError: function(aErrNo, aMessage) { }
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
        onCalendarDeleting: function(aCalendar) {},
        onCalendarPrefSet: function(aCalendar, aName, aValue) {},
        onCalendarPrefDeleting: function(aCalendar, aName) {}
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
    flags: 0
};

calAlarmService.prototype = {
    mRangeEnd: null,
    mUpdateTimer: null,
    mStarted: false,
    mTimerLookup: null,
    mObservers: null,

    QueryInterface: function (aIID) {
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
    observe: function (subject, topic, data) {
        if (topic == "profile-after-change") {
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
        return this.mTimezone;
    },

    set timezone(aTimezone) {
        this.mTimezone = aTimezone;
    },

    snoozeEvent: function(event, duration) {
        /* modify the event for a new alarm time */
        // Make sure we're working with the parent, otherwise we'll accidentally
        // create an exception
        var newEvent = event.parentItem.clone();
        var alarmTime = jsDateToDateTime((new Date())).getInTimezone("UTC");

        // Set the last acknowledged time to now.
        newEvent.alarmLastAck = alarmTime;

        alarmTime = alarmTime.clone();
        alarmTime.addDuration(duration);

        if (event.parentItem != event) {
            // This is the *really* hard case where we've snoozed a single
            // instance of a recurring event.  We need to not only know that
            // there was a snooze, but also which occurrence was snoozed.  Part
            // of me just wants to create a local db of snoozes here...
            newEvent.setProperty("X-MOZ-SNOOZE-TIME-"+event.recurrenceId.nativeTime, alarmTime.icalString);
        } else {
            newEvent.setProperty("X-MOZ-SNOOZE-TIME", alarmTime.icalString);
        }
        // calling modifyItem will cause us to get the right callback
        // and update the alarm properly
        newEvent.calendar.modifyItem(newEvent, event.parentItem, null);
    },

    addObserver: function(aObserver) {
        dump("observer added\n");
        if (this.mObservers.indexOf(aObserver) != -1)
            return;

        this.mObservers.push(aObserver);
    },

    removeObserver: function(aObserver) {
        dump("observer removed\n");
        function notThis(v) {
            return v != aObserver;
        }

        this.mObservers = this.mObservers.filter(notThis);
    },


    /* helper functions */
    notifyObservers: function(functionName, args) {
        function notify(obs) {
            try { obs[functionName].apply(obs, args);  }
            catch (e) { }
        }
        this.mObservers.forEach(notify);
    },

    hasAlarm: function almSvc_hasAlarm(aItem) {
        var hasSnooze;
        if (aItem.parentItem != aItem) {
            hasSnooze = aItem.parentItem.hasProperty("X-MOZ-SNOOZE-TIME-"+aItem.recurrenceId.nativeTime);
        } else {
            hasSnooze = aItem.hasProperty("X-MOZ-SNOOZE-TIME");
        }

        return aItem.alarmOffset || aItem.parentItem.alarmOffset || hasSnooze;
    },

    startup: function() {
        if (this.mStarted)
            return;

        if (!this.mTimezone) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }

        dump("Starting calendar alarm service\n");

        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService
                          (Components.interfaces.nsIObserverService);

        observerSvc.addObserver(this, "profile-after-change", false);
        observerSvc.addObserver(this, "xpcom-shutdown", false);

        /* Tell people that we're alive so they can start monitoring alarms.
         */
        this.notifier = Components.classes["@mozilla.org/embedcomp/appstartup-notifier;1"].getService(Components.interfaces.nsIObserver);
        var notifier = this.notifier;
        notifier.observe(null, "alarm-service-startup", null);

        this.calendarManager = Components.classes["@mozilla.org/calendar/manager;1"].getService(Components.interfaces.calICalendarManager);
        var calendarManager = this.calendarManager;
        calendarManager.addObserver(this.calendarManagerObserver);

        var calendars = calendarManager.getCalendars({});
        for each(var calendar in calendars) {
            this.observeCalendar(calendar);
        }

        /* set up a timer to update alarms every N hours */
        var timerCallback = {
            alarmService: this,
            notify: function timer_notify() {
                var now = jsDateToDateTime((new Date())).getInTimezone("UTC");
                var start;
                if (!this.alarmService.mRangeEnd) {
                    // This is our first search for alarms.  We're going to look for
                    // alarms +/- 1 month from now.  If someone sets an alarm more than
                    // a month ahead of an event, or doesn't start Sunbird/Lightning
                    // for a month, they'll miss some, but that's a slim chance
                    start = now.clone();
                    start.month -= 1;
                    start.normalize();
                } else {
                    // This is a subsequent search, so we got all the past alarms before
                    start = this.alarmService.mRangeEnd.clone();
                }
                var until = now.clone();
                until.month += 1;
                until.normalize();
                
                // We don't set timers for every future alarm, only those within 6 hours
                var end = now.clone();
                end.hour += kHoursBetweenUpdates;
                end.normalize();
                this.alarmService.mRangeEnd = end.getInTimezone("UTC");

                this.alarmService.findAlarms(this.alarmService.calendarManager.getCalendars({}),
                                             start, until);
            }
        };
        timerCallback.notify();

        this.mUpdateTimer = newTimerWithCallback(timerCallback, kHoursBetweenUpdates * 3600000, true);

        this.mStarted = true;
    },

    shutdown: function() {
        /* tell people that we're no longer running */
        var notifier = this.notifier;
        notifier.observe(null, "alarm-service-shutdown", null);

        if (this.mUpdateTimer) {
            this.mUpdateTimer.cancel();
            this.mUpdateTimer = null;
        }
        
        var calendarManager = this.calendarManager;
        calendarManager.removeObserver(this.calendarManagerObserver);

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

        var calendars = calendarManager.getCalendars({});
        for each(var calendar in calendars) {
            this.unobserveCalendar(calendar);
        }

        this.calendarManager = null;
        this.notifier = null;
        this.mRangeEnd = null;

        var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
                          .getService
                          (Components.interfaces.nsIObserverService);

        observerSvc.removeObserver(this, "profile-after-change");
        observerSvc.removeObserver(this, "xpcom-shutdown");

        this.mStarted = false;
    },


    observeCalendar: function(calendar) {
        calendar.addObserver(this.calendarObserver);
    },

    unobserveCalendar: function(calendar) {
        calendar.removeObserver(this.calendarObserver);
    },

    addAlarm: function(aItem) {
        var alarmTime;
        if (aItem.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_START) {
            alarmTime = aItem.startDate || aItem.entryDate || aItem.dueDate;
        } else {
            alarmTime = aItem.endDate || aItem.dueDate || aItem.entryDate;
        }

        if (!alarmTime) {
dump("Error: Could not determine alarm time for item '"+aItem.title+"'\n");
            return;
        }

        // Check for snooze
        var snoozeTime;
        if (aItem.parentItem != aItem) {
            snoozeTime = aItem.parentItem.getProperty("X-MOZ-SNOOZE-TIME-"+aItem.recurrenceId.nativeTime)
        } else {
            snoozeTime = aItem.getProperty("X-MOZ-SNOOZE-TIME");
        }

        const calIDateTime = Components.interfaces.calIDateTime;
        if (snoozeTime && !(snoozeTime instanceof calIDateTime)) {
            var time = Components.classes["@mozilla.org/calendar/datetime;1"]
                                 .createInstance(calIDateTime);
            time.icalString = snoozeTime;
            snoozeTime = time;
        }
dump("snooze time is:"+snoozeTime+'\n');
        alarmTime = alarmTime.clone();

        // Handle all day events.  This is kinda weird, because they don't have
        // a well defined startTime.  We just consider the start/end to be 
        // midnight in the user's timezone.
        if (alarmTime.isDate) {
            alarmTime = alarmTime.getInTimezone(this.mTimezone);
            alarmTime.isDate = false;
        }

        var offset = aItem.alarmOffset || aItem.parentItem.alarmOffset;

        alarmTime.addDuration(offset);
        alarmTime = alarmTime.getInTimezone("UTC");
        alarmTime = snoozeTime || alarmTime;
dump("considering alarm for item:"+aItem.title+'\n offset:'+offset+', which makes alarm time:'+alarmTime+'\n');
        var now = jsDateToDateTime((new Date()));
        if (alarmTime.timezone == "floating") {
            now = now.getInTimezone(calendarDefaultTimezone());
            now.timezone = "floating";
        } else {
            now = now.getInTimezone("UTC");
        }
dump("now is "+now+'\n');
        var callbackObj = {
            alarmService: this,
            item: aItem,
            notify: function(timer) {
                this.alarmService.alarmFired(this.item);
                this.alarmService.removeTimers(this.item);
            }
        };

        if (alarmTime.compare(now) >= 0) {
dump("alarm is in the future\n");
            // We assume that future alarms haven't been acknowledged

            // delay is in msec, so don't forget to multiply
            var timeout = alarmTime.subtractDate(now).inSeconds * 1000;

            var timeUntilRefresh = this.mRangeEnd.subtractDate(now).inSeconds * 1000;
            if (timeUntilRefresh < timeout) {
dump("alarm is too late\n");
                // we'll get this alarm later.  No sense in keeping an extra timeout
                return;
            }

            this.addTimer(aItem, newTimerWithCallback(callbackObj, timeout, false));
            dump("adding alarm timeout (" + timeout + ") for " + aItem + "\n");
        } else {
            var lastAck = aItem.alarmLastAck || aItem.parentItem.alarmLastAck;
            dump("Last ack was:"+lastAck+'\n');
            // This alarm is in the past.  See if it has been previously ack'd
            if (lastAck && lastAck.compare(alarmTime) >= 0) {
dump(aItem.title+' - alarm previously ackd2\n');
                return;
            } else { // Fire!
dump("alarm is in the past, and unack'd, firing now!\n");
                this.alarmFired(aItem);
            }
        }
    },

    removeAlarm: function cas_removeAlarm(aItem) {
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
        itemTimers[rid ? rid.getInTimezone("UTC").icalString : "mTimer"] = aTimer;
        ++itemTimers.mCount;
    },

    removeTimers: function cas_removeTimers(aItem) {
        var cal = this.mTimerLookup[aItem.calendar.id];
        if (cal) {
            var itemTimers = cal[aItem.id];
            if (itemTimers) {
                var rid = aItem.recurrenceId;
                if (rid) {
                    rid = rid.getInTimezone("UTC").icalString;
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
                    if (this.alarmService.hasAlarm(item)) {
                        this.alarmService.addAlarm(item);
                    }
                }
            }
        };

        const calICalendar = Components.interfaces.calICalendar;
        var filter = calICalendar.ITEM_FILTER_COMPLETED_ALL |
                     calICalendar.ITEM_FILTER_CLASS_OCCURRENCES |
                     calICalendar.ITEM_FILTER_TYPE_ALL;

        for each(var calendar in calendars) {
            calendar.getItems(filter, 0, start, until, getListener);
        }
    },

    initAlarms: function cas_refreshAlarms(calendars) {
        // Total refresh similar to startup.  We're going to look for
        // alarms +/- 1 month from now.  If someone sets an alarm more than
        // a month ahead of an event, or doesn't start Sunbird/Lightning
        // for a month, they'll miss some, but that's a slim chance
        var start = jsDateToDateTime((new Date())).getInTimezone("UTC");
        var until = start.clone();
        start.month -= 1;
        start.normalize();
        until.month += 1;
        until.normalize();
        this.findAlarms(calendars, start, until);
    },

    alarmFired: function(event) {
        if (event.calendar.suppressAlarms)
            return;

        this.notifyObservers("onAlarm", [event]);
    }
};
