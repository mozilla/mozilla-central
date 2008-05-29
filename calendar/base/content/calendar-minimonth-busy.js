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
 * The Original Code is Minimonth Busy Highlighter code.
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

/* NOTE: This script requires functions from calUtils.js, calendar-views.js
 *        and also the getCompositeCalendar() function which is target app
 *        dependant.
 */

var minimonthBusyListener = {
    QueryInterface: function mBL_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.calIOperationListener) &&
            !aIID.equals(Components.interfaces.calICompositeObserver) &&
            !aIID.equals(Components.interfaces.calIObserver) &&
            !aIID.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    // calIOperationListener methods
    onOperationComplete: function mBL_onOperationComplete(aCalendar,
                                                          aStatus,
                                                          aOperationType,
                                                          aId,
                                                          aDetail) {},

    onGetResult: function mBL_onGetResult(aCalendar,
                                          aStatus,
                                          aItemType,
                                          aDetail,
                                          aCount,
                                          aItems) {
        if (!Components.isSuccessCode(aStatus)) {
            return;
        }

        for each (var item in aItems) {
            this.setBusyDaysForOccurrence(item, true);
        }
    },

    setBusyDaysForItem: function mBL_setBusyDaysForItem(aItem, aState) {
        var minimonth = getMinimonth();
        var items = [aItem];

        if (aItem.recurrenceInfo) {
            var startDate = jsDateToDateTime(minimonth.firstDate);
            var endDate = jsDateToDateTime(minimonth.lastDate);
            items = aItem.getOccurrencesBetween(startDate, endDate, {});
        }

        for each (var item in items) {
            this.setBusyDaysForOccurrence(item, aState);
        }
    },

    setBusyDaysForOccurrence: function mBL_setBusyDaysForOccurrence(aOccurrence,
                                                                    aState) {
        if (aOccurrence.getProperty("TRANSP") == "TRANSPARENT") {
          // Skip transparent events
          return;
        }

        var minimonth = getMinimonth();
        var start = aOccurrence.startDate ||
                    aOccurrence.entryDate ||
                    aOccurrence.dueDate;
        var end = aOccurrence.endDate || aOccurrence.dueDate || start;
        if (!start) {
            return;
        }

        // We need to compare with midnight of the current day, so reset the
        // time here.
        var current = start.clone();
        current.hour = 0;
        current.minute = 0;
        current.second = 0;

        // Cache the result so the compare isn't called in each iteration.
        var compareResult = (start.compare(end) == 0 ? 1 : 0);

        // Setup the busy days.
        while (current.compare(end) < compareResult) {
            var box = minimonth.getBoxForDate(current.jsDate);
            if (box) {
                var n = parseInt(box.getAttribute("busy") || 0) +
                        (aState ? 1 : -1);
                if (n > 0) {
                    box.setAttribute("busy", n);
                } else {
                    box.removeAttribute("busy");
                }
            }

            current.day++;
        }
    },

    // calIObserver methods
    onStartBatch: function mBL_onStartBatch() {},

    onEndBatch: function mBL_onEndBatch() {},

    onLoad: function mBL_onLoad(aCalendar) {},

    onAddItem: function mBL_onAddItem(aItem) {
        this.setBusyDaysForItem(aItem, true);
    },

    onDeleteItem: function mBL_onDeleteItem(aItem) {
        this.setBusyDaysForItem(aItem, false);
    },

    onModifyItem: function mBL_onModifyItem(aNewItem, aOldItem) {
        this.setBusyDaysForItem(aOldItem, false);
        this.setBusyDaysForItem(aNewItem, true);
    },

    onError: function mBL_onError(aCalendar, aErrNo, aMessage) {},

    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
        switch (aName) {
            case "disabled":
                var minimonth = getMinimonth();
                minimonth.resetAttributesForDate();
                monthChangeListener({ target: minimonth });
                break;
        }
    },

    onPropertyDeleting: function(aCalendar, aName) {
        this.onPropertyChanged(aCalendar, aName, null, null);
    },

    // calICompositeObserver methods
    onCalendarAdded: function mBL_onCalendarAdded(aCalendar) {
        var minimonth = getMinimonth();
        minimonth.resetAttributesForDate();
        monthChangeListener({ target: minimonth });
    },

    onCalendarRemoved: function mBL_onCalendarRemoved(aCalendar) {
        var minimonth = getMinimonth();
        minimonth.resetAttributesForDate();
        monthChangeListener({ target: minimonth });
    },

    onDefaultCalendarChanged: function mBL_onDefaultCalendarChanged(aNew) {}
};

function monthChangeListener(event) {
    // The minimonth automatically clears extra styles on a month change.
    // Therefore we only need to fill the minimonth with new info.
    var start = event.target.firstDate;
    var end = event.target.lastDate;

    var composite = getCompositeCalendar();
    var filter = composite.ITEM_FILTER_COMPLETED_ALL |
                 composite.ITEM_FILTER_CLASS_OCCURRENCES |
                 composite.ITEM_FILTER_ALL_ITEMS;

    // Get new info
    composite.getItems(filter,
                       0,
                       jsDateToDateTime(start),
                       jsDateToDateTime(end),
                       minimonthBusyListener);
}

function minimonthOnLoad() {
    var minimonth = getMinimonth();
    // This might be the hidden window, which has no UI
    if (minimonth) {
        minimonth.addEventListener("monthchange", monthChangeListener, false);
        monthChangeListener({ target: minimonth });
        getCompositeCalendar().addObserver(minimonthBusyListener);
    }
}

function minimonthOnUnload() {
    var minimonth = getMinimonth();
    // This might be the hidden window, which has no UI
    if (minimonth) {
        minimonth.removeEventListener("monthchange", monthChangeListener, false);
        monthChangeListener({ target: minimonth });
        getCompositeCalendar().removeObserver(minimonthBusyListener);
    }
}

window.addEventListener("load", minimonthOnLoad, false);
window.addEventListener("unload", minimonthOnUnload, false);
