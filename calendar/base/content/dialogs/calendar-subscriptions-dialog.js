/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    for each (var calendar in getCalendarManager().getCalendars({})) {
        registeredCals[calendar.id] = true;
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
