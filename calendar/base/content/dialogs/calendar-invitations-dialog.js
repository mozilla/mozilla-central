/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");

/**
 * Sets up the invitations dialog from the window arguments, retrieves the
 * invitations from the invitations manager.
 */
function onLoad() {
    var operationListener = {
        onOperationComplete: function oL_onOperationComplete(aCalendar,
                                                             aStatus,
                                                             aOperationType,
                                                             aId,
                                                             aDetail) {
            var updatingBox = document.getElementById("updating-box");
            updatingBox.setAttribute("hidden", "true");
            var richListBox = document.getElementById("invitations-listbox");
            if (richListBox.getRowCount() > 0) {
                richListBox.selectedIndex = 0;
            } else {
                var noInvitationsBox =
                    document.getElementById("noinvitations-box");
                noInvitationsBox.removeAttribute("hidden");
            }
        },
        onGetResult: function oL_onGetResult(aCalendar,
                                             aStatus,
                                             aItemType,
                                             aDetail,
                                             aCount,
                                             aItems) {
            if (!Components.isSuccessCode(aStatus)) {
                return;
            }
            document.title = invitationsText + " (" + aCount + ")";
            var updatingBox = document.getElementById("updating-box");
            updatingBox.setAttribute("hidden", "true");
            var richListBox = document.getElementById("invitations-listbox");
            for each (var item in aItems) {
                richListBox.addCalendarItem(item);
            }
        }
    };

    var updatingBox = document.getElementById("updating-box");
    updatingBox.removeAttribute("hidden");

    var args = window.arguments[0];
    args.invitationsManager.getInvitations(operationListener,
                                           args.onLoadOperationListener);

    opener.setCursor("auto");
}

/**
 * Cleans up the invitations dialog, cancels pending requests.
 */
function onUnload() {
    var args = window.arguments[0];
    args.requestManager.cancelPendingRequests();
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    var args = window.arguments[0];
    fillJobQueue(args.queue);
    args.invitationsManager.processJobQueue(args.queue, args.finishedCallBack);
    return true;
}

/**
 * Handler function to be called when the cancel button is pressed.
 */
function onCancel() {
    var args = window.arguments[0];
    if (args.finishedCallBack) {
        args.finishedCallBack();
    }
}

/**
 * Fills the job queue from the invitations-listbox's items. The job queue
 * contains objects for all items that have a modified participation status.
 *
 * @param queue     The queue to fill.
 */
function fillJobQueue(queue) {
    var richListBox = document.getElementById("invitations-listbox");
    var rowCount = richListBox.getRowCount();
    for (var i = 0; i < rowCount; i++) {
        var richListItem = richListBox.getItemAtIndex(i);
        var newStatus = richListItem.participationStatus;
        var oldStatus = richListItem.initialParticipationStatus;
        if (newStatus != oldStatus) {
            var actionString = "modify";
            var oldCalendarItem = richListItem.calendarItem;
            var newCalendarItem = oldCalendarItem.clone();

            // set default alarm on unresponded items that have not been declined:
            if (!newCalendarItem.getAlarms({}).length &&
                (oldStatus == "NEEDS-ACTION") &&
                (newStatus != "DECLINED")) {
                cal.alarms.setDefaultValues(newCalendarItem);
            }

            richListItem.setCalendarItemParticipationStatus(newCalendarItem,
                newStatus);
            var job = {
                action: actionString,
                oldItem: oldCalendarItem,
                newItem: newCalendarItem
            };
            queue.push(job);
        }
    }
}
