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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2007
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

/*
 * In case you need to work around having a popup in a popup, this seems to do
 * it. The trick is to create a window, style it like a popup and make it depend
 * on its opener.
 *
 * Regarding the window, it is important to set the hidechrome="true" attribute,
 * use blur, mouseout, keydown handlers as in the functions below.
 *
 * To mimic the menupopup, I used a radiogroup with some automatic selecting. Be
 * sure to focus the radiogroup on window load, and add handlers for click and
 * keypress.
 *
 * In the opening dialog, use window.openDialog with the following window
 * options:
 *   "chrome,titlebar=no,dependent=yes"
 * Additionally, you will want to set top and left options just below the
 * opening button/menu.
 */

/**
 * Function to setup the default snooze length for the textbox and its unit
 * menulist.
 */
function setupDefaultSnooze() {
    var snoozePref = getPrefSafe("calendar.alarms.defaultsnoozelength", 0);
    if (snoozePref <= 0) {
        snoozePref = 5;
    }

    if ((snoozePref % 60) == 0) {
        snoozePref = snoozePref / 60;
        if ((snoozePref % 24) == 0) {
            snoozePref = snoozePref / 24;
            document.getElementById("custom-menupopup-alarm-unit").selectedIndex = 2; // Hours
        } else {
            document.getElementById("custom-menupopup-alarm-unit").selectedIndex = 1; // Days
        }
    }

    document.getElementById("custom-menupopup-alarm-value").value = snoozePref;
    checkSnoozeValue();
}

/**
 * Check the snooze value for a valid positive integer, disabling the accept
 * button if it is not found.
 */
function checkSnoozeValue() {
    var snoozeValue = parseInt(document.getElementById("custom-menupopup-alarm-value").value);
    document.getElementById("custom-menupopup-alarm-button").disabled = !(snoozeValue > 0);
}

function windowLoad(event) {
    setupDefaultSnooze();
}

function windowBlur(event) {
    // Only close the window, if the targeted element is not in the window.
    if (event.target.localName == null) {
        window.close();
    }
}

function windowMouseOut(event) {
    try {
        document.getElementById("custom-menupopup-radiogroup")
                .selectedItem = null;
    } catch (e) {
        // Catch the error that happens when unselecting all items.
    }
}

function windowKeyDown(event) {
    // Pressing any other key not mentioned here in the radiogroup should close
    // the window to mimic menupopup behavior
    var allowedKeys = [ event.DOM_VK_DOWN,
                        event.DOM_VK_UP,
                        event.DOM_VK_RETURN,
                        event.DOM_VK_ENTER,
                        event.DOM_VK_TAB ];
    if (event.target.localName == "radiogroup" &&
        allowedKeys.indexOf(event.keyCode) < 0) {
        window.close();
    }

    // Pressing any of the following keys should definitely close the window.
    var closerKeys = [ event.DOM_VK_ESCAPE ];
    if (closerKeys.indexOf(event.keyCode) > -1) {
        window.close();
    }

    if (event.keyCode == event.DOM_VK_DOWN &&
        event.target.localName == "window") {
        // If the window is focused and the down key is pressed, we want the
        // first item to be selected.
        var radioGroup = document.getElementById("custom-menupopup-radiogroup");
        radioGroup.focus();
        radioGroup.selectedItem = radioGroup.lastChild;
    } else if (event.keyCode == event.DOM_VK_UP &&
        event.target.localName == "window") {
        // If the up key is pressed, we want the last item to be selected.
        var radioGroup = document.getElementById("custom-menupopup-radiogroup");
        radioGroup.focus();
        radioGroup.selectedItem = radioGroup.firstChild;
    }

}

function radiogroupBlur(event, radiogroup) {
    try {
        // Unselect when leaving the radiogroup.
        document.getElementById("custom-menupopup-radiogroup")
                .selectedItem = null;
    } catch (e) {
        // Catch the error that happens when unselecting all items.
    }
}

function radiogroupMouseOver(event, radiogroup) {
    window.focus();
    // Automatically select the radio when mousing over it.
    radiogroup.selectedItem = event.target;
}

function radioSnooze(event) {
    // Only certain keys should trigger snoozing.
    if (event.keyCode &&
        event.keyCode != event.DOM_VK_ENTER &&
        event.keyCode != event.DOM_VK_RETURN &&
        event.keyCode != event.DOM_VK_SPACE) {
        return;
    }

    // The passed window argument is the bound element that opened us. Snooze
    // the connected alarm and close the window.
    window.arguments[0].snoozeAlarm(event.target.value);
    window.close();
}

function textboxSnooze() {
    var val = document.getElementById("custom-menupopup-alarm-value");
    var unit = document.getElementById("custom-menupopup-alarm-unit");

    // The unit value is the multiplier to convert the textbox value into
    // minutes.
    var minutes = val.value * unit.selectedItem.value;

    // Snooze the connected alarm and close the window.
    window.arguments[0].snoozeAlarm(minutes);
    window.close();
}
