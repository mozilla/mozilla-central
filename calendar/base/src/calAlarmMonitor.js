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

function peekAlarmWindow() {
    var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                   .getService(Components.interfaces.nsIWindowMediator);
    return windowMediator.getMostRecentWindow("calendarAlarmWindow");
}

function calAlarmServiceObserver() {
    this.wrappedJSObject = this;
    this.mAlarmService = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                                   .getService(Components.interfaces.calIAlarmService);
    this.mAlarmItems = [];
}
calAlarmServiceObserver.prototype = {

    mAlarmService: null,
    mAlarmItems: null,

    // This is a work-around for the fact that there is a delay between when
    // we call openWindow and when it appears via getMostRecentWindow.  If an
    // alarm is fired in that time-frame, it will actually end up in another window.
    mWindowOpening: null,

    //
    // calIAlarmServiceObserver
    //
    onAlarm: function caso_onAlarm(item) {

        this.mAlarmItems.push(item);

        if (getPrefSafe("calendar.alarms.playsound", true)) {
            try {
                var soundURL = getPrefSafe("calendar.alarms.soundURL", null);
                var sound = Components.classes["@mozilla.org/sound;1"]
                                      .createInstance(Components.interfaces.nsISound);
                sound.init();
                if (soundURL && soundURL.length > 0) {
                    soundURL = makeURL(soundURL);
                    sound.play(soundURL);
                } else {
                    sound.beep();
                }
            } catch (exc) {
                Components.utils.reportError(exc);
            }
        }

        if (!getPrefSafe("calendar.alarms.show", true)) {
            return;
        }

        var calAlarmWindow = peekAlarmWindow();
        if (!calAlarmWindow  && !this.mWindowOpening) {
            var windowWatcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                          .getService(Components.interfaces.nsIWindowWatcher);
            this.mWindowOpening = windowWatcher.openWindow(
                null,
                "chrome://calendar/content/calendar-alarm-dialog.xul",
                "_blank",
                "chrome,dialog=yes,all,resizable",
                this);
        }
        if (!this.mWindowOpening) {
            calAlarmWindow.addWidgetFor(item);
        }
    },

    window_onLoad: function caso_window_onLoad() {
        var calAlarmWindow = this.mWindowOpening;
        this.mWindowOpening = null;
        for each (var item in this.mAlarmItems) {
            calAlarmWindow.addWidgetFor(item);
        }
    },

    onRemoveAlarmsByItem: function caso_onRemoveAlarmsByItem(item) {
        var calAlarmWindow = peekAlarmWindow();
        this.mAlarmItems = this.mAlarmItems.filter(
            function(item_) {
                var hashId_ = (item.recurrenceId ? item_.hashId
                                                 : item_.parentItem.hashId);
                var ret = (item.hashId != hashId_);
                if (!ret && calAlarmWindow) { // window is open
                    calAlarmWindow.removeWidgetFor(item_);
                }
                return ret;
            });
    },

    onRemoveAlarmsByCalendar: function caso_onRemoveAlarmsByCalendar(calendar) {
        var calAlarmWindow = peekAlarmWindow();
        this.mAlarmItems = this.mAlarmItems.filter(
            function(item_) {
                var ret = (calendar.id != item_.calendar.id);
                if (!ret && calAlarmWindow) { // window is open
                    calAlarmWindow.removeWidgetFor(item_);
                }
                return ret;
            });
    }
};

function calAlarmMonitor() {
    this.mObserver = new calAlarmServiceObserver();
}
calAlarmMonitor.prototype = {
    mObserver: null,

    QueryInterface: function calAlarmMonitor_QueryInterface(iid) {
        if (iid.equals(Components.interfaces.nsIObserver) ||
            iid.equals(Components.interfaces.nsISupports)) {
            return this;
        }
        throw Components.interfaces.NS_ERROR_NO_INTERFACE;
    },

    /* nsIObserver */
    observe: function calAlarmMonitor_observe(subject, topic, data) {
        switch (topic) {
        case "alarm-service-startup":
            this.mObserver.mAlarmService.addObserver(this.mObserver);
            break;

        case "alarm-service-shutdown":
            this.mObserver.mAlarmService.removeObserver(this.mObserver);
            break;
        }
    }
};
