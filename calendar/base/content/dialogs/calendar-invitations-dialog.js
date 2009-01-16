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
 *   Thomas Benisch <thomas.benisch@sun.com>
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
