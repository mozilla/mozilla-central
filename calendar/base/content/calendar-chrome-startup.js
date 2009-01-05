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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
 * Common initialization steps for calendar chrome windows.
 */
function commonInitCalendar() {

    // Load the Calendar Manager
    loadCalendarManager();

    // Restore the last shown calendar view
    selectCalendarView(getLastCalendarView());

    // set up the unifinder
    prepareCalendarToDoUnifinder();

    // Make sure we update ourselves if the program stays open over midnight
    scheduleMidnightUpdate(refreshUIBits);

    // Set up the command controller from calendar-common-sets.js
    injectCalendarCommandController();

    // Set up item and day selection listeners
    getViewDeck().addEventListener("dayselect", observeViewDaySelect, false);
    getViewDeck().addEventListener("itemselect", calendarController.onSelectionChanged, true);

    // Start alarm service
    Components.classes["@mozilla.org/calendar/alarm-service;1"]
              .getService(Components.interfaces.calIAlarmService)
              .startup();
    document.getElementById("calsidebar_splitter").addEventListener("command", onCalendarViewResize, false);
    window.addEventListener("resize", onCalendarViewResize, true);
}

/**
 * Common unload steps for calendar chrome windows.
 */
function commonFinishCalendar() {
    // Unload the calendar manager
    unloadCalendarManager();

    // Remove the command controller
    removeCalendarCommandController();

    document.getElementById("calsidebar_splitter").removeEventListener("command", onCalendarViewResize, false);
    window.removeEventListener("resize", onCalendarViewResize, true);
}

function onCalendarViewResize(aEvent) {
    let event = document.createEvent('Events');
    event.initEvent(currentView().type + "viewresized", true, false);
    document.getElementById("calendarviewBroadcaster").dispatchEvent(event);
}

