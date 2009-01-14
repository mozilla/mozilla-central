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
 *   Philipp Kewisch <mozilla@kewis.ch>
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

Components.utils.import("resource://gre/modules/PluralForm.jsm");

/**
 * Helper function to get the alarm service and cache it.
 *
 * @return The alarm service component
 */
function getAlarmService() {
    if (!window.mAlarmService) {
        window.mAlarmService = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                                         .getService(Components.interfaces.calIAlarmService);
    }
    return window.mAlarmService;
}

/**
 * Event handler for the 'snooze' event. Snoozes the given alarm by the given
 * number of minutes using the alarm service.
 *
 * @param event     The snooze event
 */
function onSnoozeAlarm(event) {
    // reschedule alarm:
    var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                             .createInstance(Components.interfaces.calIDuration);
    duration.minutes = event.detail;
    duration.normalize();
    getAlarmService().snoozeAlarm(event.target.item, duration);
}

/**
 * Event handler for the 'dismiss' event. Dismisses the given alarm using the
 * alarm service.
 *
 * @param event     The snooze event
 */
function onDismissAlarm(event) {
    getAlarmService().dismissAlarm(event.target.item);
}

/**
 * Called to dismiss all alarms in the alarm window.
 */
function onDismissAllAlarms() {
    // removes widgets on the fly:
    var alarmRichlist = document.getElementById("alarm-richlist");
    for (var i = alarmRichlist.childNodes.length - 1; i >= 0; i--) {
        if (alarmRichlist.childNodes[i].item) {
            getAlarmService().dismissAlarm(alarmRichlist.childNodes[i].item);
        }
    }
}

/**
 * Event handler fired when the alarm widget's "Details..." label was clicked.
 * Open the event dialog in the most recent sunbird or thunderbird window
 *
 * @param event     The itemdetails event.
 */
function onItemDetails(event) {
    // We want this to happen in a calendar window.
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var calWindow = wm.getMostRecentWindow("calendarMainWindow") ||
                    wm.getMostRecentWindow("mail:3pane");
    calWindow.modifyEventWithDialog(event.target.item, null, true);
}

/**
 * Sets up the alarm dialog, initializing the default snooze length and setting
 * up the relative date update timer.
 */
var gRelativeDateUpdateTimer;
function setupWindow() {
    // We want to update when we are at 0 seconds past the minute. To do so, use
    // setTimeout to wait until we are there, then setInterval to exectue every
    // minute. Since setInterval is not totally exact, we may run into problems
    // here. I hope not!
    var current = new Date();

    var timeout = (60 - current.getSeconds()) * 1000;
    gRelativeDateUpdateTimer = setTimeout(function wait_until_next_minute() {
        updateRelativeDates();
        gRelativeDateUpdateTimer = setInterval(updateRelativeDates, 60 * 1000);
    }, timeout);

    // Give focus to the alarm richlist after onload completes. see bug 103197
    setTimeout(onFocusWindow, 0);
}

/**
 * Unload function for the alarm dialog. If applicable, snooze the remaining
 * alarms and clean up the relative date update timer.
 */
function finishWindow() {
    var alarmRichlist = document.getElementById("alarm-richlist");

    if (alarmRichlist.childNodes.length > 0) {
        // If there are still items, the window wasn't closed using dismiss
        // all/snooze all. This can happen when the closer is clicked or escape
        // is pressed. Snooze all remaining items using the default snooze
        // property.
        var snoozePref = getPrefSafe("calendar.alarms.defaultsnoozelength", 0);
        if (snoozePref <= 0) {
            snoozePref = 5;
        }
        snoozeAllItems(snoozePref);
    }

    // Stop updating the relative time
    clearTimeout(gRelativeDateUpdateTimer);
}

/**
 * Set up the focused element. If no element is focused, then switch to the
 * richlist.
 */
function onFocusWindow() {
    if (!document.commandDispatcher.focusedElement) {
        document.getElementById("alarm-richlist").focus();
    }
}

/**
 * Timer callback to update all relative date labels
 */
function updateRelativeDates() {
    var alarmRichlist = document.getElementById("alarm-richlist");
    for (var i = alarmRichlist.childNodes.length - 1; i >= 0; i--) {
        if (alarmRichlist.childNodes[i].item) {
            alarmRichlist.childNodes[i].updateRelativeDateLabel();
        }
    }
}

/**
 * Opens the alarm snooze popup, using the event to determine the position.
 * The given container item must be an object that has a function snoozeAlarm.
 * This function will be called with the chosen alarm duration in minutes.
 *
 * @param event           The event used to determine the position of the popup
 * @param aContainerItem  The container item as described above
 */
function openSnoozeWindow(event, aContainerItem) {
    const uri = "chrome://calendar/content/calendar-alarm-snooze-popup.xul";
    var pos = ",left=" + (event.target.boxObject.screenX - 3) +
             ",top=" + (event.target.boxObject.screenY + event.target.boxObject.height - 3);
    window.openDialog(uri,
                      uri,
                      "chrome,dependent=yes,titlebar=no" + pos,
                      aContainerItem);
}

/**
 * Function to snooze all alarms the given number of minutes.
 *
 * @param aDurationMinutes    The duration in minutes
 */
function snoozeAllItems(aDurationMinutes) {
    var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                             .createInstance(Components.interfaces.calIDuration);
    duration.minutes = aDurationMinutes;
    duration.normalize();

    var alarmRichlist = document.getElementById("alarm-richlist");
    for (var i = alarmRichlist.childNodes.length - 1; i >= 0; i--) {
        if (alarmRichlist.childNodes[i].item) {
            getAlarmService().snoozeAlarm(alarmRichlist.childNodes[i].item, duration);
        }
    }
}

/**
 * Sets up the window title, counting the number of alarms in the window.
 */
function setupTitle() {
    var alarmRichlist = document.getElementById("alarm-richlist");
    var reminders = alarmRichlist.childNodes.length;

    let title = PluralForm.get(reminders, calGetString("calendar", "alarmWindowTitle.label"));
    document.title = title.replace("#1", reminders);
}

/**
 * Add an alarm widget for the passed calendar item
 *
 * @param aItem       The calendar item to add a widget for.
 */
function addWidgetFor(aItem) {
    var widget = document.createElement("calendar-alarm-widget");
    var alarmRichlist = document.getElementById("alarm-richlist");
    alarmRichlist.appendChild(widget);

    widget.item = aItem;
    widget.addEventListener("snooze", onSnoozeAlarm, false);
    widget.addEventListener("dismiss", onDismissAlarm, false);
    widget.addEventListener("itemdetails", onItemDetails, false);

    setupTitle();

    if (alarmRichlist.selectedIndex < 0) {
        alarmRichlist.selectedIndex = 0;
    }

    window.focus();
    window.getAttention();
}

/**
 * Remove the alarm widget for the passed calendar item
 *
 * @param aItem       The calendar item to remove the alarm widget for.
 */
function removeWidgetFor(aItem) {
    var hashId = aItem.hashId;
    var alarmRichlist = document.getElementById("alarm-richlist");
    var nodes = alarmRichlist.childNodes;
    for (var i = nodes.length - 1; i >= 0; --i) {
        var widget = nodes[i];
        if (widget.item && widget.item.hashId == hashId) {

            if (widget.selected) {
                // Advance selection if needed
                widget.control.selectedItem = widget.previousSibling ||
                                              widget.nextSibling;
            }

            widget.removeEventListener("snooze", onSnoozeAlarm, false);
            widget.removeEventListener("dismiss", onDismissAlarm, false);
            widget.removeEventListener("itemdetails", onItemDetails, false);
            alarmRichlist.removeChild(widget);

            if (!alarmRichlist.hasChildNodes()) {
                // check again next round since this removeWidgetFor call may be
                // followed by an addWidgetFor call (e.g. when refreshing), and
                // we don't want to close and open the window in that case.
                function closer() {
                    if (!alarmRichlist.hasChildNodes()) {
                        window.close();
                    }
                }
                setTimeout(closer, 0);
            }
            break;
        }
    }

    // Update the title
    setupTitle();
}
