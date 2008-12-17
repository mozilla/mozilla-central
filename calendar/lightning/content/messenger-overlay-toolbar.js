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
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
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

/**
 * Global variables
 */
var gCustomizeId;

/**
 * the current mode is set to a string defining the current
 * mode we're in. allowed values are:
 *  - 'mode'
 *  - 'mail'
 *  - 'calendar'
 *  - 'task'
 */
var gCurrentMode = 'mail';

/**
 * ltnSwitch2Mail() switches to the mail mode
 */

function ltnSwitch2Mail() {
  if (gCurrentMode != 'mail') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.setAttribute("checked", "true");
    switch2calendar.removeAttribute("checked");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'mail';
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);

    document.commandDispatcher.updateCommands('calendar_commands');

    // Disable the rotate view menuitem
    document.getElementById("calendar_toggle_orientation_command")
            .setAttribute("disabled", "true");
    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Calendar() switches to the calendar mode
 */

function ltnSwitch2Calendar() {
  if (gCurrentMode != 'calendar') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.setAttribute("checked", "true");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'calendar';    
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);    

    // display the calendar panel on the display deck
    var viewBox = document.getElementById("calendar-view-box");
    uncollapseElement(viewBox);
    var deck = document.getElementById("calendarDisplayDeck");
    deck.selectedPanel = viewBox;

    // show the last displayed type of calendar view
    showCalendarView(gLastShownCalendarView);

    document.commandDispatcher.updateCommands('calendar_commands');

    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Task() switches to the task mode
 */

function ltnSwitch2Task() {
  if (gCurrentMode != 'task') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.removeAttribute("checked");
    switch2task.setAttribute("checked", "true");

    gCurrentMode = 'task';
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);    

    // display the task panel on the display deck
    var taskBox = document.getElementById("calendar-task-box");
    uncollapseElement(taskBox);
    var deck = document.getElementById("calendarDisplayDeck");
    deck.selectedPanel = taskBox;

    document.commandDispatcher.updateCommands('calendar_commands');

    window.setCursor("auto");
  }
}
