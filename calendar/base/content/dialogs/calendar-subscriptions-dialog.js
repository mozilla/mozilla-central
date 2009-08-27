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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Thomas Benisch <thomas.benisch@sun.com>
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
 * Cancels any pending search operations.
 */
var gCurrentSearchOperation = null;
function cancelPendingSearchOperation() {
    if (gCurrentSearchOperation && gCurrentSearchOperation.isPending) {
        gCurrentSearchOperation.cancel(Components.interfaces.calIErrors.OPERATION_CANCELLED);
    }
    gCurrentSearchOperation = null;
}

/**
 * Sets up the subscriptions dialog.
 */
function onLoad() {
    opener.setCursor("auto");
}

/**
 * Cleans up the subscriptions dialog.
 */
function onUnload() {
    cancelPendingSearchOperation();
}

/**
 * Handler function to handle dialog keypress events.
 * (Cancels the search when pressing escape)
 */
function onKeyPress(event) {
    switch(event.keyCode) {
        case 27: /* ESC */
            if (gCurrentSearchOperation) {
                cancelPendingSearchOperation();
                document.getElementById("status-deck").selectedIndex = 0;
                event.stopPropagation();
                event.preventDefault();
            }
            break;
    }
}

/**
 * Handler function to handle keypress events in the textbox.
 * (Starts the search when hitting enter)
 */
function onTextBoxKeyPress(event) {
    switch(event.keyCode) {
        case 13: /* RET */
            onSearch();
            event.stopPropagation();
            event.preventDefault();
            break;
    }
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    var richListBox = document.getElementById("subscriptions-listbox");
    var rowCount = richListBox.getRowCount();
    for (var i = 0; i < rowCount; i++) {
        var richListItem = richListBox.getItemAtIndex(i);
        var checked = richListItem.checked;
        if (checked != richListItem.subscribed) {
            var calendar = richListItem.calendar;
            if (checked) {
                getCalendarManager().registerCalendar(calendar);
            } else {
                getCalendarManager().unregisterCalendar(calendar);
            }
        }
    }
    return true;
}

/**
 * Handler function to be called when the cancel button is pressed.
 */
function onCancel() {
}

/**
 * Performs the search for subscriptions, canceling any pending searches.
 */
function onSearch() {
    cancelPendingSearchOperation();

    var richListBox = document.getElementById("subscriptions-listbox");
    richListBox.clear();

    var registeredCals = {};
    for each (var cal in getCalendarManager().getCalendars({})) {
        registeredCals[cal.id] = true;
    }

    var opListener = {
        onResult: function search_onResult(op, result) {
            var richListBox = document.getElementById("subscriptions-listbox");
            if (result) {
                for each (var calendar in result) {
                    richListBox.addCalendar(calendar, registeredCals[calendar.id]);
                }
            }
            if (!op.isPending) {
                var statusDeck = document.getElementById("status-deck");
                if (richListBox.getRowCount() > 0) {
                    statusDeck.selectedIndex = 0;
                } else {
                    statusDeck.selectedIndex = 2;
                }
            }
        }
    };

    var op = getCalendarSearchService().searchForCalendars(document.getElementById("search-textbox").value,
                                                           0 /* hints */, 50, opListener);
    if (op && op.isPending) {
        gCurrentSearchOperation = op;
        document.getElementById("status-deck").selectedIndex = 1;
    }
}

/**
 * Markes the selected item in the subscriptions-listbox for subscribing. The
 * actual subscribe happens when the window is closed.
 */
function onSubscribe() {
    var item = document.getElementById("subscriptions-listbox").selectedItem;
    if (item && !item.disabled) {
        item.checked = true;
    }
}

/**
 * Unmarkes the selected item in the subscriptions-listbox for subscribing. The
 * actual subscribe happens when the window is closed.
 */
function onUnsubscribe() {
    var item = document.getElementById("subscriptions-listbox").selectedItem;
    if (item && !item.disabled) {
        item.checked = false;
    }
}
