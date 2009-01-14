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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
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

/**
 * Sets up the timezone dialog from the window arguments, also setting up all
 * dialog controls from the window's dates.
 */
function onLoad() {
    var args = window.arguments[0];
    window.time = args.time;
    window.onAcceptCallback = args.onOk;

    var tzProvider = (args.calendar.getProperty("timezones.provider") ||
                      getTimezoneService());
    window.tzProvider = tzProvider;

    var menulist = document.getElementById("timezone-menulist");
    var tzMenuPopup = document.getElementById("timezone-menupopup");

    // floating and UTC (if supported) at the top:
    if (args.calendar.getProperty("capabilities.timezones.floating.supported") !== false) {
        addMenuItem(tzMenuPopup, floating().displayName, floating().tzid);
    }
    if (args.calendar.getProperty("capabilities.timezones.UTC.supported") !== false) {
        addMenuItem(tzMenuPopup, UTC().displayName, UTC().tzid);
    }

    var enumerator = tzProvider.timezoneIds;
    var tzids = {};
    var displayNames = [];
    while (enumerator.hasMore()) {
        var tz = tzProvider.getTimezone(enumerator.getNext());
        if (tz && !tz.isFloating && !tz.isUTC) {
            var displayName = tz.displayName;
            displayNames.push(displayName);
            tzids[displayName] = tz.tzid;
        }
    }
    // the display names need to be sorted
    displayNames.sort(String.localeCompare);
    for (var i = 0; i < displayNames.length; ++i) {
        var displayName = displayNames[i];
        addMenuItem(tzMenuPopup, displayName, tzids[displayName]);
    }

    var index = findTimezone(window.time.timezone);
    if (index < 0) {
        index = findTimezone(calendarDefaultTimezone());
        if (index < 0) {
            index = 0;
        }
    }

    var menulist = document.getElementById("timezone-menulist");
    menulist.selectedIndex = index;

    updateTimezone();

    opener.setCursor("auto");
}

/**
 * Find the index of the timezone menuitem corresponding to the given timezone.
 *
 * @param timezone      The calITimezone to look for.
 * @return              The index of the childnode below "timezone-menulist"
 */
function findTimezone(timezone) {
    var tzid = timezone.tzid;
    var menulist = document.getElementById("timezone-menulist");
    var numChilds = menulist.childNodes[0].childNodes.length;
    for (var i=0; i<numChilds; i++) {
        var menuitem = menulist.childNodes[0].childNodes[i];
        if (menuitem.getAttribute("value") == tzid) {
            return i;
        }
    }
    return -1;
}

/**
 * Handler function to call when the timezone selection has changed. Updates the
 * timezone-time field and the timezone-stack.
 */
function updateTimezone() {
    var menulist = document.getElementById("timezone-menulist");
    var menuitem = menulist.selectedItem;
    var tz = window.tzProvider.getTimezone(menuitem.getAttribute("value"));

    // convert the date/time to the currently selected timezone
    // and display the result in the appropriate control.
    // before feeding the date/time value into the control we need
    // to set the timezone to 'floating' in order to avoid the
    // automatic conversion back into the OS timezone.
    var datetime = document.getElementById("timezone-time");
    var time = window.time.getInTimezone(tz);
    time.timezone = floating();
    datetime.value = time.jsDate;

    // don't highlight any timezone in the map by default
    var standardTZOffset = "none";
    if (tz.isUTC) {
        standardTZOffset = "+0000";
    } else if (!tz.isFloating) {
        var standard = tz.icalComponent.getFirstSubcomponent("STANDARD");
        // any reason why valueAsIcalString is used instead of plain value? xxx todo: ask mickey
        standardTZOffset = standard.getFirstProperty("TZOFFSETTO").valueAsIcalString;
    }

    var stack = document.getElementById("timezone-stack");
    var numChilds = stack.childNodes.length;
    for (var i = 0; i < numChilds; i++) {
        var image = stack.childNodes[i];
        if (image.hasAttribute("tzid")) {
            var offset = image.getAttribute("tzid");
            if (offset == standardTZOffset) {
                image.removeAttribute("hidden");
            } else {
                image.setAttribute("hidden", "true");
            }
        }
    }
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    var menulist = document.getElementById("timezone-menulist");
    var menuitem = menulist.selectedItem;
    var timezone = menuitem.getAttribute("value");
    var tz = window.tzProvider.getTimezone(timezone);
    var datetime = window.time.getInTimezone(tz);
    window.onAcceptCallback(datetime);
    return true;
}

/**
 * Handler function to be called when the cancel button is pressed.
 *
 */
function onCancel() {
}
