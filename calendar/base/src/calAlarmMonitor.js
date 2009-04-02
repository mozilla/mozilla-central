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
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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

function peekAlarmWindow() {
    let windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                   .getService(Components.interfaces.nsIWindowMediator);
    return windowMediator.getMostRecentWindow("Calendar:AlarmWindow");
}

/**
 * The alarm monitor takes care of playing the alarm sound and opening one copy
 * of the calendar-alarm-dialog. Both depend on their respective prefs to be
 * set. This monitor is only used for DISPLAY type alarms.
 */
function calAlarmMonitor() {
    this.wrappedJSObject = this;
    this.mAlarms = [];
}

calAlarmMonitor.prototype = {
    mAlarms: null,

    // This is a work-around for the fact that there is a delay between when
    // we call openWindow and when it appears via getMostRecentWindow.  If an
    // alarm is fired in that time-frame, it will actually end up in another window.
    mWindowOpening: null,

    QueryInterface: function cAM_QueryInterface(aIID) {
        return cal.doQueryInterface(this, calAlarmMonitor.prototype, aIID, null, this);
    },

    /**
     * nsIClassInfo
     */
    getInterfaces: function cAM_getInterfaces(aCount) {
        let ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIObserver,
            Components.interfaces.calIAlarmServiceObserver
        ];
        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function cAM_getHelperForLanguage(aLanguage) {
        return null;
    },

    contractID: "@mozilla.org/calendar/alarm-monitor;1",
    classDescription: "Calendar Alarm Monitor",
    classID: Components.ID("{4b7ae030-ed79-11d9-8cd6-0800200c9a66}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    /**
     * nsIObserver
     */
    observe: function cAM_observe(aSubject, aTopic, aData) {
        let alarmService = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                                     .getService(Components.interfaces.calIAlarmService);
        switch (aTopic) {
            case "alarm-service-startup":
                alarmService.addObserver(this);
                break;
            case "alarm-service-shutdown":
                alarmService.removeObserver(this);
                break;
        }
    },

    /**
     * calIAlarmServiceObserver
     */
    onAlarm: function cAM_onAlarm(aItem, aAlarm) {
        if (aAlarm.action != "DISPLAY") {
            // This monitor only looks for DISPLAY alarms.
            return;
        }

        this.mAlarms.push([aItem, aAlarm]);

        if (getPrefSafe("calendar.alarms.playsound", true)) {
            // We want to make sure the user isn't flooded with alarms so we
            // limit this using a preference. For example, if the user has 20
            // events that fire an alarm in the same minute, then the alarm
            // sound will only play 5 times. All alarms will be shown in the
            // dialog nevertheless.
            let maxAlarmSoundCount = cal.getPrefSafe("calendar.alarms.maxsoundsperminute", 5);
            let now = new Date();

            if (!this.mLastAlarmSoundDate ||
                (now - this.mLastAlarmSoundDate >= 60000)) {
                // Last alarm was long enough ago, reset counters. Note
                // subtracting JSDate results in microseconds.
                this.mAlarmSoundCount = 0;
                this.mLastAlarmSoundDate = now;
            } else {
                // Otherwise increase the counter
                this.mAlarmSoundCount++;
            }

            if (maxAlarmSoundCount > this.mAlarmSoundCount) {
                // Only ring the alarm sound if we haven't hit the max count.
                try {
                    let soundURL = getPrefSafe("calendar.alarms.soundURL", null);
                    let sound = Components.classes["@mozilla.org/sound;1"]
                                          .createInstance(Components.interfaces.nsISound);
                    sound.init();
                    if (soundURL && soundURL.length > 0) {
                        soundURL = makeURL(soundURL);
                        sound.play(soundURL);
                    } else {
                        sound.beep();
                    }
                } catch (exc) {
                    cal.ERROR("Error playing alarm sound: " + exc);
                }
            }
        }

        if (!getPrefSafe("calendar.alarms.show", true)) {
            return;
        }

        let calAlarmWindow = peekAlarmWindow();
        if (!calAlarmWindow  && !this.mWindowOpening) {
            let windowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                          .getService(Components.interfaces.nsIWindowWatcher);
            this.mWindowOpening = windowWatcher.openWindow(
                null,
                "chrome://calendar/content/calendar-alarm-dialog.xul",
                "_blank",
                "chrome,dialog=yes,all,resizable",
                this);
        }
        if (!this.mWindowOpening) {
            calAlarmWindow.addWidgetFor(aItem, aAlarm);
        }
    },

    window_onLoad: function cAM_window_onLoad() {
        let calAlarmWindow = this.mWindowOpening;
        this.mWindowOpening = null;
        for each (let [item, alarm] in this.mAlarms) {
            calAlarmWindow.addWidgetFor(item, alarm);
        }
    },

    onRemoveAlarmsByItem: function cAM_onRemoveAlarmsByItem(aItem) {
        let calAlarmWindow = peekAlarmWindow();
        this.mAlarms = this.mAlarms.filter(function(itemAlarm) {
            let [thisItem, alarm] = itemAlarm;
            let ret = (aItem.hashId != thisItem.parentItem.hashId);
            if (!ret && calAlarmWindow) { // window is open
                calAlarmWindow.removeWidgetFor(thisItem, alarm);
            }
            return ret;
        });
    },

    onRemoveAlarmsByCalendar: function cAM_onRemoveAlarmsByCalendar(calendar) {
        let calAlarmWindow = peekAlarmWindow();
        this.mAlarms = this.mAlarms.filter(function(itemAlarm) {
            let [thisItem, alarm] = itemAlarm;
            let ret = (calendar.id != thisItem.calendar.id);

            if (!ret && calAlarmWindow) { // window is open
                calAlarmWindow.removeWidgetFor(thisItem, alarm);
            }
            return ret;
        });
    }
};
