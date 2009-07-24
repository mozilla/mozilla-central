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

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calItipUtils.jsm");

/**
 * This object contains functions to take care of manipulating requests.
 */
var gInvitationsRequestManager = {
    mRequestStatusList: {},

    /**
     * Add a request to the request manager.
     *
     * @param calendar    The calendar to add for.
     * @param op          The operation to add
     */
    addRequestStatus: function IRM_addRequestStatus(calendar, op) {
        if (op) {
            this.mRequestStatusList[calendar.id] = op;
        }
    },

    /**
     * Cancel all pending requests
     */
    cancelPendingRequests: function IRM_cancelPendingRequests() {
        for each (var request in this.mRequestStatusList) {
            if (request && request.isPending) {
                request.cancel(null);
            }
        }
        this.mRequestStatusList = {};
    }
};

var gInvitationsManager = null;

/**
 * Return a cached instance of the invitations manager
 *
 * @return      The invitations manager instance.
 */
function getInvitationsManager() {
    if (!gInvitationsManager) {
        gInvitationsManager = new InvitationsManager();
    }
    return gInvitationsManager;
}

/**
 * The invitations manager class constructor
 *
 * XXX do we really need this to be an instance?
 *
 * @constructor
 */
function InvitationsManager() {
    this.mItemList = new Array();
    this.mStartDate = null;
    this.mJobsPending = 0;
    this.mTimer = null;

    var self = this;
    window.addEventListener("unload", function() {
        // Unload handlers get removed automatically
        self.cancelInvitationsUpdate();
    }, false);
}

InvitationsManager.prototype = {
    mItemList: null,
    mStartDate: null,
    mJobsPending: 0,
    mTimer: null,

    /**
     * Schedule an update for the invitations manager asynchronously.
     *
     * @param firstDelay          The timeout before the operation should start.
     * @param operationListener   The calIGenericOperationListener to notify.
     */
    scheduleInvitationsUpdate: function IM_scheduleInvitationsUpdate(firstDelay,
                                                                     operationListener) {
        this.cancelInvitationsUpdate();

        var self = this;
        this.mTimer = setTimeout(function startInvitationsTimer() {
            if (getPrefSafe("calendar.invitations.autorefresh.enabled", true)) {
                self.mTimer = setInterval(function repeatingInvitationsTimer() {
                    self.getInvitations(operationListener);
                    }, getPrefSafe("calendar.invitations.autorefresh.timeout", 3) * 60000);
            }
            self.getInvitations(operationListener);
        }, firstDelay);
    },

    /**
     * Cancel pending any pending invitations update.
     */
    cancelInvitationsUpdate: function IM_cancelInvitationsUpdate() {
        clearTimeout(this.mTimer);
    },

    /**
     * Retrieve invitations from all calendars. Notify all passed
     * operation listeners.
     *
     * @param operationListener1    The first operation listener to notify.
     * @param operationListener2    (optinal) The second operation listener to
     *                                notify.
     */
    getInvitations: function IM_getInvitations(operationListener1,
                                               operationListener2) {
        var listeners = [];
        if (operationListener1) {
            listeners.push(operationListener1);
        }
        if (operationListener2) {
            listeners.push(operationListener2);
        }

        gInvitationsRequestManager.cancelPendingRequests();
        this.updateStartDate();
        this.deleteAllItems();

        var cals = getCalendarManager().getCalendars({});

        var opListener = {
            mCount: cals.length,
            mRequestManager: gInvitationsRequestManager,
            mInvitationsManager: this,
            mHandledItems: {},

            // calIOperationListener
            onOperationComplete: function(aCalendar,
                                          aStatus,
                                          aOperationType,
                                          aId,
                                          aDetail) {
                if (--this.mCount == 0) {
                    this.mInvitationsManager.mItemList.sort(
                        function (a, b) {
                            return a.startDate.compare(b.startDate);
                        });
                    for each (var listener in listeners) {
                        try {
                            if (this.mInvitationsManager.mItemList.length) {
                                // Only call if there are actually items
                                listener.onGetResult(null,
                                                     Components.results.NS_OK,
                                                     Components.interfaces.calIItemBase,
                                                     null,
                                                     this.mInvitationsManager.mItemList.length,
                                                     this.mInvitationsManager.mItemList);
                            }
                            listener.onOperationComplete(null,
                                                         Components.results.NS_OK,
                                                         Components.interfaces.calIOperationListener.GET,
                                                         null,
                                                         null);
                        } catch (exc) {
                            ERROR(exc);
                        }
                    }
                }
            },

            onGetResult: function(aCalendar,
                                  aStatus,
                                  aItemType,
                                  aDetail,
                                  aCount,
                                  aItems) {
                if (Components.isSuccessCode(aStatus)) {
                    for each (var item in aItems) {
                        // we need to retrieve by occurrence to properly filter exceptions,
                        // should be fixed with bug 416975
                        item = item.parentItem;
                        var hid = item.hashId;
                        if (!this.mHandledItems[hid]) {
                            this.mHandledItems[hid] = true;
                            this.mInvitationsManager.addItem(item);
                        }
                    }
                }
            }
        };

        for each (var calendar in cals) {
            if (!isCalendarWritable(calendar) || calendar.getProperty("disabled")) {
                opListener.onOperationComplete();
                continue;
            }

            // temporary hack unless calCachedCalendar supports REQUEST_NEEDS_ACTION filter:
            calendar = calendar.getProperty("cache.uncachedCalendar");
            if (!calendar) {
                opListener.onOperationComplete();
                continue;
            }

            try {
                calendar = calendar.QueryInterface(Components.interfaces.calICalendar);
                var endDate = this.mStartDate.clone();
                endDate.year += 1;
                var op = calendar.getItems(Components.interfaces.calICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION |
                                           Components.interfaces.calICalendar.ITEM_FILTER_TYPE_ALL |
                                           // we need to retrieve by occurrence to properly filter exceptions,
                                           // should be fixed with bug 416975
                                           Components.interfaces.calICalendar.ITEM_FILTER_CLASS_OCCURRENCES,
                                           0, this.mStartDate,
                                           endDate /* we currently cannot pass null here, because of bug 416975 */,
                                           opListener);
                gInvitationsRequestManager.addRequestStatus(calendar, op);
            } catch (exc) {
                opListener.onOperationComplete();
                ERROR(exc);
            }
        }
    },

    /**
     * Open the invitations dialog, non-modal.
     *
     * XXX Passing these listeners in instead of keeping them in the window
     * sounds fishy to me. Maybe there is a more encapsulated solution.
     *
     * @param onLoadOpListener          The operation listener to notify when
     *                                    getting invitations. Should be passed
     *                                    to this.getInvitations().
     * @param finishedCallBack          A callback function to call when the
     *                                    dialog has completed.
     */
    openInvitationsDialog: function IM_openInvitationsDialog(onLoadOpListener,
                                                             finishedCallBack) {
        var args = new Object();
        args.onLoadOperationListener = onLoadOpListener;
        args.queue = new Array();
        args.finishedCallBack = finishedCallBack;
        args.requestManager = gInvitationsRequestManager;
        args.invitationsManager = this;
        // the dialog will reset this to auto when it is done loading
        window.setCursor("wait");
        // open the dialog
        window.openDialog(
            "chrome://calendar/content/calendar-invitations-dialog.xul",
            "_blank",
            "chrome,titlebar,resizable",
            args);
    },

    /**
     * Process the passed job queue. A job is an object that consists of an
     * action, a newItem and and oldItem. This processor only takes "modify"
     * operations into account.
     *
     * @param queue                         The array of objects to process.
     * @param jobQueueFinishedCallBack      A callback function called when
     *                                        job has finished.
     */
    processJobQueue: function IM_processJobQueue(queue,
                                                 jobQueueFinishedCallBack) {
        // TODO: undo/redo
        function operationListener(mgr, queueCallback, oldItem_) {
            this.mInvitationsManager = mgr;
            this.mJobQueueFinishedCallBack = queueCallback;
            this.mOldItem = oldItem_;
        }
        operationListener.prototype = {
            onOperationComplete: function (aCalendar,
                                           aStatus,
                                           aOperationType,
                                           aId,
                                           aDetail) {
                if (Components.isSuccessCode(aStatus) &&
                    aOperationType == Components.interfaces.calIOperationListener.MODIFY) {
                    cal.itip.checkAndSend(aOperationType, aDetail, this.mOldItem);
                    this.mInvitationsManager.deleteItem(aDetail);
                    this.mInvitationsManager.addItem(aDetail);
                }
                this.mInvitationsManager.mJobsPending--;
                if (this.mInvitationsManager.mJobsPending == 0 &&
                    this.mJobQueueFinishedCallBack) {
                    this.mJobQueueFinishedCallBack();
                }
            },

            onGetResult: function(aCalendar,
                                  aStatus,
                                  aItemType,
                                  aDetail,
                                  aCount,
                                  aItems) {

            }
        };

        this.mJobsPending = 0;
        for (var i = 0; i < queue.length; i++) {
            var job = queue[i];
            var oldItem = job.oldItem;
            var newItem = job.newItem;
            switch (job.action) {
                case 'modify':
                    this.mJobsPending++;
                    newItem.calendar.modifyItem(newItem,
                                                oldItem,
                                                new operationListener(this, jobQueueFinishedCallBack, oldItem));
                    break;
                default:
                    break;
            }
        }
        if (this.mJobsPending == 0 && jobQueueFinishedCallBack) {
            jobQueueFinishedCallBack();
        }
    },

    /**
     * Checks if the internal item list contains the given item
     * XXXdbo       Please document these correctly.
     *
     * @param item      The item to look for.
     * @return          A boolean value indicating if the item was found.
     */
    hasItem: function IM_hasItem(item) {
        var hid = item.hashId;
        return this.mItemList.some(
            function someFunc(item_) {
                return hid == item_.hashId;
            });
    },

    /**
     * Adds an item to the internal item list.
     * XXXdbo       Please document these correctly.
     *
     * @param item      The item to add.
     */
    addItem: function IM_addItem(item) {
        var recInfo = item.recurrenceInfo;
        if (recInfo && !cal.isOpenInvitation(item)) {
            // scan exceptions:
            var ids = recInfo.getExceptionIds({});
            for each (var id in ids) {
                var ex = recInfo.getExceptionFor(id);
                if (ex && this.validateItem(ex) && !this.hasItem(ex)) {
                    this.mItemList.push(ex);
                }
            }
        } else if (this.validateItem(item) && !this.hasItem(item)) {
            this.mItemList.push(item);
        }
    },

    /**
     * Removes an item from the internal item list
     * XXXdbo       Please document these correctly.
     *
     * @param item      The item to remove.
     */
    deleteItem: function IM_deleteItem(item) {
        var id = item.id;
        this.mItemList.filter(
            function filterFunc(item_) {
                return id != item_.id;
            });
    },

    /**
     * Remove all items from the internal item list
     * XXXdbo       Please document these correctly.
     */
    deleteAllItems: function IM_deleteAllItems() {
        this.mItemList = [];
    },

    /**
     * Helper function to create a start date to search from. This date is the
     * current time with hour/minute/second set to zero.
     *
     * @return      Potential start date.
     */
    getStartDate: function IM_getStartDate() {
        var date = now();
        date.second = 0;
        date.minute = 0;
        date.hour = 0;
        return date;
    },

    /**
     * Updates the start date for the invitations manager to the date returned
     * from this.getStartDate(), unless the previously existing start date is
     * the same or after what getStartDate() returned.
     */
    updateStartDate: function IM_updateStartDate() {
        if (!this.mStartDate) {
            this.mStartDate = this.getStartDate();
        } else {
            var startDate = this.getStartDate();
            if (startDate.compare(this.mStartDate) > 0) {
                this.mStartDate = startDate;
            }
        }
    },

    /**
     * Checks if the item is valid for the invitation manager. Checks if the
     * item is in the range of the invitation manager and if the item is a valid
     * invitation.
     *
     * @param item      The item to check
     * @return          A boolean indicating if the item is a valid invitation.
     */
    validateItem: function IM_validateItem(item) {
        if (item.calendar instanceof Components.interfaces.calISchedulingSupport &&
            !item.calendar.isInvitation(item)) {
            return false; // exclude if organizer has invited himself
        }
        var start = item[calGetStartDateProp(item)] || item[calGetEndDateProp(item)];
        return (cal.isOpenInvitation(item) &&
                start.compare(this.mStartDate) >= 0);
    }
};
