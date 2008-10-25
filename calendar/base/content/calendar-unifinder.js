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
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Garth Smedley <garths@oeone.com>
 *   Mike Potter <mikep@oeone.com>
 *   Chris Charabaruk <coldacid@meldstar.com>
 *   Colin Phillips <colinp@oeone.com>
 *   ArentJan Banck <ajbanck@planet.nl>
 *   Eric Belhaire <eric.belhaire@ief.u-psud.fr>
 *   Matthew Willis <mattwillis@gmail.com>
 *   Michiel van Leeuwen <mvl@exedo.nl>
 *   Joey Minta <jminta@gmail.com>
 *   Dan Mosedale <dan.mosedale@oracle.com>
 *   Michael Buettner <michael.buettner@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Fred Jendrzejewski <fred.jen@web.de>
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
 * U N I F I N D E R
 *
 * This is a hacked in interface to the unifinder. We will need to
 * improve this to make it usable in general.
 */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

// Set this to true when the calendar event tree is clicked to allow for
// multiple selection
var gCalendarEventTreeClicked = false;

// Store the start and enddate, because the providers can't be trusted when
// dealing with all-day events. So we need to filter later. See bug 306157

var kDefaultTimezone;
var gUnifinderNeedsRefresh = true;

function isUnifinderHidden() {
    return document.getElementById("bottom-events-box").hidden;
}

function getCurrentUnifinderFilter() {
    return document.getElementById("event-filter-menulist").selectedItem.value;
}

/**
 * Observer for the calendar event data source. This keeps the unifinder
 * display up to date when the calendar event data is changed
 */

var unifinderObserver = {
    mInBatch: false,

    QueryInterface: function uO_QueryInterface (aIID) {
        if (!aIID.equals(Components.interfaces.nsISupports) &&
            !aIID.equals(Components.interfaces.calICompositeObserver) &&
            !aIID.equals(Components.interfaces.calIObserver)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    // calIObserver:
    onStartBatch: function uO_onStartBatch() {
        this.mInBatch = true;
    },

    onEndBatch: function uO_onEndBatch() {
        this.mInBatch = false;
        refreshEventTree();
    },

    onLoad: function uO_onLoad() {
        if (isUnifinderHidden() && !gUnifinderNeedsRefresh) {
            // If the unifinder is hidden, all further item operations might
            // produce invalid entries in the unifinder. From now on, ignore
            // those operations and refresh as soon as the unifinder is shown
            // again.
            gUnifinderNeedsRefresh = true;
            unifinderTreeView.clearItems();
        }
        if (!this.mInBatch) {
            refreshEventTree();
        }
    },

    onAddItem: function uO_onAddItem(aItem) {
        if (isEvent(aItem) &&
            !this.mInBatch &&
            !gUnifinderNeedsRefresh &&
            unifinderTreeView.mFilter.isItemInFilters(aItem)
            ) {
            this.addItemToTree(aItem);
        }
    },

    onModifyItem: function uO_onModifyItem(aNewItem, aOldItem) {
        this.onDeleteItem(aOldItem);
        this.onAddItem(aNewItem);
    },

    onDeleteItem: function uO_onDeleteItem(aDeletedItem) {
        if (isEvent(aDeletedItem) && !this.mInBatch && !gUnifinderNeedsRefresh) {
            this.removeItemFromTree(aDeletedItem);
        }
    },

    // It is safe to call these for any event.  The functions will determine
    // whether or not anything actually needs to be done to the tree
    addItemToTree: function uO_addItemToTree(aItem) {
        var items;
        var filter = unifinderTreeView.mFilter;

        if (filter.startDate && filter.endDate) {
            items = aItem.getOccurrencesBetween(filter.startDate, filter.endDate, {});
        } else {
            items = [aItem];
        }
        unifinderTreeView.addItems(items.filter(filter.isItemInFilters, filter));
    },
    removeItemFromTree: function uO_removeItemFromTree(aItem) {
        var items;
        var filter = unifinderTreeView.mFilter;
        if (filter.startDate && filter.endDate && (aItem.parentItem == aItem)) {
            items = aItem.getOccurrencesBetween(filter.startDate, filter.endDate, {});
        } else {
            items = [aItem];
        }
        // XXX: do we really still need this, we are always checking it in the refreshInternal
        unifinderTreeView.removeItems(items.filter(filter.isItemInFilters, filter));
    },

    onError: function uO_onError(aCalendar, aErrNo, aMessage) {},

    onPropertyChanged: function uO_onPropertyChanged(aCalendar, aName, aValue, aOldValue) {
        switch (aName) {
            case "disabled":
                refreshEventTree();
                break;
        }
    },

    onPropertyDeleting: function uO_onPropertyDeleting(aCalendar, aName) {
      this.onPropertyChanged(aCalendar, aName, null, null);
    },

    // calICompositeObserver:
    onCalendarAdded: function uO_onCalendarAdded(aAddedCalendar) {
        if (!this.mInBatch && !aAddedCalendar.getProperty("disabled")) {
            refreshEventTree();
        }
    },

    onCalendarRemoved: function uO_onCalendarRemoved(aDeletedCalendar) {
        // TODO only remove such items that belong to the calendar
        if (!this.mInBatch && !aDeletedCalendar.getProperty("disabled")) {
            refreshEventTree();
        }
    },

    onDefaultCalendarChanged: function uO_onDefaultCalendarChanged(aNewDefaultCalendar) {}
};

/**
 * Called when the calendar is loaded
 */
function prepareCalendarUnifinder() {
    // Only load once
    window.removeEventListener("load", prepareCalendarUnifinder, false);
    var unifinderTree = document.getElementById("unifinder-search-results-tree");

    // Check if this is not the hidden window, which has no UI elements
    if (unifinderTree) {
        // set up our calendar event observer
        var ccalendar = getCompositeCalendar();
        ccalendar.addObserver(unifinderObserver);

        kDefaultTimezone = calendarDefaultTimezone();

        // Set up the filter
        unifinderTreeView.mFilter = new calFilter();
        unifinderTreeView.mFilter.propertyFilter = "unifinder-search-field";

        // Set up the unifinder views.
        unifinderTreeView.treeElement = unifinderTree;
        unifinderTree.view = unifinderTreeView;

        // Listen for changes in the selected day, so we can update if need be
        var viewDeck = getViewDeck();
        viewDeck.addEventListener("dayselect", unifinderDaySelect, false);
        viewDeck.addEventListener("itemselect", unifinderItemSelect, true);

        // Set up sortDirection and sortActive, in case it persisted
        var sorted = unifinderTree.getAttribute("sort-active");
        var sortDirection = unifinderTree.getAttribute("sort-direction") || "ascending";
        var tree = document.getElementById("unifinder-search-results-tree");
        var treecols = tree.getElementsByTagName("treecol");
        for (var i = 0; i < treecols.length; i++) {
            var col = treecols[i];
            var content = col.getAttribute("itemproperty");
            if (sorted && sorted.length > 0) {
                if (sorted == content) {
                    unifinderTreeView.sortDirection = sortDirection;
                    unifinderTreeView.selectedColumn = col;
                }
            }
        }
        // Display something upon first load. onLoad doesn't work properly for
        // observers
        if (!isUnifinderHidden()) {
            gUnifinderNeedsRefresh = false;
            refreshEventTree();
        }
    }
}

/**
 * Called when the calendar is unloaded
 */
function finishCalendarUnifinder() {
    var ccalendar = getCompositeCalendar();
    ccalendar.removeObserver(unifinderObserver);

    var viewDeck = getViewDeck();
    if (viewDeck) {
        viewDeck.removeEventListener("dayselect", unifinderDaySelect, false);
        viewDeck.removeEventListener("itemselect", unifinderItemSelect, true);
    }

    //persist the sort
    var unifinderTree = document.getElementById("unifinder-search-results-tree");
    var sorted = unifinderTreeView.selectedColumn;
    if (sorted) {
        unifinderTree.setAttribute("sort-active",sorted.getAttribute("itemproperty"));
        unifinderTree.setAttribute("sort-direction",unifinderTree.sortDirection);
    } else {
        unifinderTree.removeAttribute("sort-active");
        unifinderTree.removeAttribute("sort-direction");
    }
}

/**
 * Event listeners for dayselect and itemselect events
 */
function unifinderDaySelect() {
    if (getCurrentUnifinderFilter() == "current") {
        refreshEventTree();
    }
}

function unifinderItemSelect(aEvent) {
    unifinderTreeView.setSelectedItems(aEvent.detail);
}

/**
 * Helper function to display event datetimes in the unifinder
 */
function formatUnifinderEventDateTime(aDatetime) {
    var dateFormatter = Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                                  .getService(Components.interfaces.calIDateTimeFormatter);
    return dateFormatter.formatDateTime(aDatetime.getInTimezone(kDefaultTimezone));
}

/**
 * Unifinder event handlers (click,select,etc)
 */
function unifinderDoubleClick(event) {
    // We only care about button 0 (left click) events
    if (event.button != 0) {
        return;
    }

    // find event by id
    var calendarEvent = unifinderTreeView.getItemFromEvent(event);

    if (calendarEvent != null) {
        modifyEventWithDialog(calendarEvent, null, true);
    } else {
        createEventWithDialog();
    }
}

function unifinderSelect(event) {
    var tree = unifinderTreeView.treeElement;
    if (!tree.view.selection || tree.view.selection.getRangeCount() == 0) {
        return;
    }

    var selectedItems = [];
    gCalendarEventTreeClicked = true;

    // Get the selected events from the tree
    var start = {};
    var end = {};
    var numRanges = tree.view.selection.getRangeCount();

    for (var t = 0; t < numRanges; t++) {
        tree.view.selection.getRangeAt(t, start, end);

        for (var v = start.value; v <= end.value; v++) {
            try {
                selectedItems.push(unifinderTreeView.getItemAt(v));
            } catch (e) {
               WARN("Error getting Event from row: " + e + "\n");
            }
        }
    }

    if (selectedItems.length == 1) {
        // Go to the day of the selected item in the current view.
        currentView().goToDay(selectedItems[0].startDate);
    }

    // Set up the selected items in the view. Pass in true, so we don't end
    // up in a circular loop
    currentView().setSelectedItems(selectedItems.length, selectedItems, true);
    currentView().centerSelectedItems();
    calendarController.onSelectionChanged({detail: selectedItems});
    document.getElementById("unifinder-search-results-tree").focus();
}

function unifinderKeyPress(aEvent) {
    const kKE = Components.interfaces.nsIDOMKeyEvent;
    switch (aEvent.keyCode) {
        case 13:
            // Enter, edit the event
            editSelectedEvents();
            aEvent.stopPropagation();
            aEvent.preventDefault();
            break;
        case kKE.DOM_VK_BACK_SPACE:
        case kKE.DOM_VK_DELETE:
            deleteSelectedEvents();
            aEvent.stopPropagation();
            aEvent.preventDefault();
            break;
    }
}

/**
 * Tree controller for unifinder search results
 */
var unifinderTreeView = {

    tree: null,
    treeElement: null,
    doingSelection: false,
    mFilter: null,
    

    mSelectedColumn: null,
    sortDirection: null,

    get selectedColumn uTV_getSelectedColumn() {
        return this.mSelectedColumn;
    },

    set selectedColumn uTV_setSelectedColumn(aCol) {
        var tree = document.getElementById("unifinder-search-results-tree");
        var treecols = tree.getElementsByTagName("treecol");
        for (var i = 0; i < treecols.length; i++) {
            var col = treecols[i];
            if (col.getAttribute("sortActive")) {
                  col.removeAttribute("sortActive");
                  col.removeAttribute("sortDirection");
            }
            if (aCol.getAttribute("itemproperty") == col.getAttribute("itemproperty")) {
                col.setAttribute("sortActive", "true");
                col.setAttribute("sortDirection", this.sortDirection);
            }
        }
        return (this.mSelectedColumn = aCol);
    },

    /**
     * Event functions
     */

    eventArray: [],
    eventIndexMap: {},

    addItems: function uTV_addItems(aItemArray, aDontSort) {
        this.eventArray = this.eventArray.concat(aItemArray);
        if (this.tree) {
            var newCount = this.eventArray.length - aItemArray.length - 1;
            this.tree.rowCountChanged(newCount, aItemArray.length);
        }

        if (aDontSort) {
            this.calculateIndexMap();
        } else {
            this.sortItems();
        }
    },

    removeItems: function uTV_removeItems(aItemArray) {
        for each (var item in aItemArray) {
            var row = this.getItemRow(item);
            if (row > -1) {
                this.eventArray.splice(row, 1);
                if (this.tree) {
                    this.tree.rowCountChanged(row, -1);
                }
            }
        }
        this.calculateIndexMap();
    },

    clearItems: function uTV_clearItems() {
        var oldCount = this.eventArray.length;
        this.eventArray = [];
        if (this.tree) {
            this.tree.rowCountChanged(0, -oldCount);
        }
        this.calculateIndexMap();
    },

    setItems: function uTV_setItems(aItemArray, aDontSort) {
        var oldCount = this.eventArray.length;
        this.eventArray = aItemArray.slice(0);
        if (this.tree) {
            this.tree.rowCountChanged(0, (this.eventArray.length - oldCount));
        }
       
        if (aDontSort) {
            this.calculateIndexMap();
        } else {
            this.sortItems();
        }
    },

    calculateIndexMap: function uTV_calculateIndexMap() {
        this.eventIndexMap = {};
        for (var i = 0 ; i < this.eventArray.length; i++) {
            this.eventIndexMap[this.eventArray[i].hashId] = i;
        }

        if (this.tree) {
            this.tree.invalidate();
        }
    },

    sortItems: function uTV_sortItems() {
        if( this.selectedColumn) {
            var modifier = (this.sortDirection == "descending" ? -1 : 1);
            var sortKey = unifinderTreeView.selectedColumn.getAttribute("itemproperty");
            var sortType = cal.getSortTypeForSortKey(sortKey);
            // sort (key,item) entries
            cal.sortEntry.mSortKey = sortKey;
            cal.sortEntry.mSortStartedDate = now();
            var entries = this.eventArray.map(cal.sortEntry, cal.sortEntry);
            entries.sort(cal.sortEntryComparer(sortType, modifier));
            this.eventArray = entries.map(cal.sortEntryItem);
        }
        this.calculateIndexMap();
    },

    getItemRow: function uTV_getItemRow(item) {
        if (this.eventIndexMap[item.hashId] === undefined) {
            return -1;
        }
        return this.eventIndexMap[item.hashId];
    },

    getItemAt: function uTV_getItemAt(aRow) {
        return this.eventArray[aRow];
    },

    /**
     * Get the calendar item from the given event
     */
    getItemFromEvent: function uTV_getItemFromEvent(event) {
        var row = this.tree.getRowAt(event.clientX, event.clientY);

        if (row > -1) {
            return this.getItemAt(row);
        }
        return null;
    },

    setSelectedItems: function uTV_setSelectedItems(aItemArray) {
        if (this.doingSelection || !this.tree) {
            return;
        }

        this.doingSelection = true;

        // If no items were passed, get the selected items from the view.
        aItemArray = aItemArray || currentView().getSelectedItems({});

        /**
         * The following is a brutal hack, caused by
         * http://lxr.mozilla.org/mozilla1.0/source/layout/xul/base/src/tree/src/nsTreeSelection.cpp#555
         * and described in bug 168211
         * http://bugzilla.mozilla.org/show_bug.cgi?id=168211
         * Do NOT remove anything in the next 3 lines, or the selection in the tree will not work.
         */
        this.treeElement.onselect = null;
        this.treeElement.removeEventListener("select", unifinderSelect, true);
        this.tree.view.selection.selectEventsSuppressed = true;
        this.tree.view.selection.clearSelection();

        if (aItemArray && aItemArray.length == 1) {
            // If only one item is selected, scroll to it
            var rowToScrollTo = this.getItemRow(aItemArray[0]);
            if (rowToScrollTo > -1) {
               this.tree.ensureRowIsVisible(rowToScrollTo);
               this.tree.view.selection.select(rowToScrollTo);
            }
        } else if (aItemArray && aItemArray.length > 1) {
            // If there is more than one item, just select them all.
            for (var i in aItemArray) {
                var row = this.getItemRow(aItemArray[i]);
                this.tree.view.selection.rangedSelect(row, row, true);
            }
        }

        // This needs to be in a setTimeout
        setTimeout(unifinderTreeView.resetAllowSelection, 1);
    },

    resetAllowSelection: function uTV_resetAllowSelection() {
        if (!this.tree) {
            return;
        }
        /**
         * Do not change anything in the following lines, they are needed as
         * described in the selection observer above
         */
        this.doingSelection = false;

        this.tree.view.selection.selectEventsSuppressed = false;
        this.treeElement.addEventListener("select", unifinderSelect, true);
    },

    /**
     * Tree View Implementation
     */
    get rowCount uTV_getRowCount() {
        return this.eventArray.length;
    },


    // TODO this code is currently identical to the task tree. We should create
    // an itemTreeView that these tree views can inherit, that contains this
    // code, and possibly other code related to sorting and storing items. See
    // bug 432582 for more details.
    getCellProperties: function uTV_getCellProperties(aRow, aCol, aProps) {
        this.getRowProperties(aRow, aProps);
        this.getColumnProperties(aCol, aProps);
    },
    getRowProperties: function uTV_getRowProperties(aRow, aProps) {
        var item = this.eventArray[aRow];
        if (item.priority > 0 && item.priority < 5) {
            aProps.AppendElement(getAtomFromService("highpriority"));
        } else if (item.priority > 5 && item.priority < 10) {
            aProps.AppendElement(getAtomFromService("lowpriority"));
        }

        // Add calendar name atom
        var calendarAtom = "calendar-" + formatStringForCSSRule(item.calendar.name);
        aProps.AppendElement(getAtomFromService(calendarAtom));

        // Add item status atom
        if (item.status) {
            aProps.AppendElement(getAtomFromService("status-" + item.status.toLowerCase()));
        }

        // Alarm status atom
        if (item.alarmOffset) {
            aProps.AppendElement(getAtomFromService("alarm"));
        }

        // Task categories
        item.getCategories({}).map(formatStringForCSSRule)
                              .map(getAtomFromService)
                              .forEach(aProps.AppendElement, aProps);
    },
    getColumnProperties: function uTV_getColumnProperties(aCol, aProps) {},

    isContainer: function uTV_isContainer() {
        return false;
    },

    isContainerOpen: function uTV_isContainerOpen(aRow) {
        return false;
    },

    isContainerEmpty: function uTV_isContainerEmpty(aRow) {
        return false;
    },

    isSeparator: function uTV_isSeparator(aRow) {
        return false;
    },

    isSorted: function uTV_isSorted(aRow) {
        return false;
    },

    canDrop: function uTV_canDrop(aRow, aOrientation) {
        return false;
    },

    drop: function uTV_drop(aRow, aOrientation) {},

    getParentIndex: function uTV_getParentIndex(aRow) {
        return -1;
    },

    hasNextSibling: function uTV_hasNextSibling(aRow, aAfterIndex) {},

    getLevel: function uTV_getLevel(aRow) {
        return 0;
    },

    getImageSrc: function uTV_getImageSrc(aRow, aOrientation) {},

    getProgressMode: function uTV_getProgressMode(aRow, aCol) {},

    getCellValue: function uTV_getCellValue(aRow, aCol) {
        return null;
    },

    getCellText: function uTV_getCellText(row, column) {
        calendarEvent = this.eventArray[row];

        switch (column.element.getAttribute("itemproperty")) {
            case "title":
                return calendarEvent.title;

            case "startDate":
                return formatUnifinderEventDateTime(calendarEvent.startDate);

            case "endDate":
                var eventEndDate = calendarEvent.endDate.clone();
                // XXX reimplement
                //var eventEndDate = getCurrentNextOrPreviousRecurrence(calendarEvent);
                if (calendarEvent.startDate.isDate) {
                    // display enddate is ical enddate - 1
                    eventEndDate.day = eventEndDate.day - 1;
                }
                return formatUnifinderEventDateTime(eventEndDate);

            case "categories":
                return calendarEvent.getCategories({}).join(", ");

            case "location":
                return calendarEvent.getProperty("LOCATION");

            case "status":
                return getEventStatusString(calendarEvent);

            case "calendar":
                return calendarEvent.calendar.name;

            default:
                return false;
        }
    },

    setTree: function uTV_setTree(tree) {
        this.tree = tree;
    },

    toggleOpenState: function uTV_toggleOpenState(aRow) {},

    cycleHeader: function uTV_cycleHeader(col) {
        if (!this.selectedColumn) {
            this.sortDirection = "ascending";
        } else {
            if (!this.sortDirection || this.sortDirection == "descending") {
                this.sortDirection = "ascending";
            } else {
                this.sortDirection = "descending";
            }
        }
        this.selectedColumn = col.element;
        this.sortItems();
    },

    isEditable: function uTV_isEditable(aRow, aCol) {
        return false;
    },

    setCellValue: function uTV_setCellValue(aRow, aCol, aValue) {},
    setCellText: function uTV_setCellText(aRow, aCol, aValue) {},

    performAction: function uTV_performAction(aAction) {},

    performActionOnRow: function uTV_performActionOnRow(aAction, aRow) {},

    performActionOnCell: function uTV_performActionOnCell(aAction, aRow, aCol) {},

    outParameter: new Object() // used to obtain dates during sort
};

function refreshEventTree() {
    if (isUnifinderHidden()) {
        // If the unifinder is hidden, don't refresh the events to reduce needed
        // getItems calls.
        return;
    }
    var savedThis = this;
    var refreshListener = {
        mEventArray: new Array(),

        onOperationComplete: function rET_onOperationComplete(aCalendar,
                                                              aStatus,
                                                              aOperationType,
                                                              aId,
                                                              aDateTime) {
            var refreshTreeInternalFunc = function() {
                refreshEventTreeInternal(refreshListener.mEventArray);
            };
            setTimeout(refreshTreeInternalFunc, 0);
        },

        onGetResult: function rET_onGetResult(aCalendar,
                                              aStatus,
                                              aItemType,
                                              aDetail,
                                              aCount,
                                              aItems) {
            for (var i = 0; i < aCount; i++) {
                refreshListener.mEventArray.push(aItems[i]);
            }
        }
    };


    var ccalendar = getCompositeCalendar();
    var filter = 0;

    filter |= ccalendar.ITEM_FILTER_TYPE_EVENT;

    // Not all xul might be there yet...
    if (!document.getElementById(unifinderTreeView.mFilter.textFilterField)) {
        return;
    }
    unifinderTreeView.mFilter.setDateFilter(getCurrentUnifinderFilter());

    if (unifinderTreeView.mFilter.startDate && unifinderTreeView.mFilter.endDate) {
        filter |= ccalendar.ITEM_FILTER_CLASS_OCCURRENCES;
    }

    ccalendar.getItems(filter, 0, unifinderTreeView.mFilter.startDate, unifinderTreeView.mFilter.endDate, refreshListener);
}

/**
 * Get the dates for a certain filter. This function makes it easy to extend the
 * unifinder. To add a new view, just overwrite this function with your own. Be
 * sure to call this function afterwards though.
 */

function refreshEventTreeInternal(eventArray) {

    unifinderTreeView.setItems(eventArray.filter(unifinderTreeView
                                                .mFilter
                                                .isItemInFilters
                                                , unifinderTreeView
                                                .mFilter
                                                ));

    // Select selected events in the tree. Not passing the argument gets the
    // items from the view.
    unifinderTreeView.setSelectedItems();
}

function focusSearch() {
    document.getElementById("unifinder-search-field").focus();
}

function toggleUnifinder() {
    // Toggle the elements
    goToggleToolbar('bottom-events-box', 'calendar_show_unifinder_command');
    goToggleToolbar('calendar-view-splitter');

    unifinderTreeView.treeElement.view = unifinderTreeView;

    // When the unifinder is hidden, refreshEventTree is not called. Make sure
    // the event tree is refreshed now.
    if (!isUnifinderHidden() && gUnifinderNeedsRefresh) {
        gUnifinderNeedsRefresh = false;
        refreshEventTree();
    }

    // Make sure the selection is correct
    if (unifinderTreeView.doingSelection) {
        unifinderTreeView.resetAllowSelection();
    }
    unifinderTreeView.setSelectedItems();
}

window.addEventListener("load", prepareCalendarUnifinder, false);
window.addEventListener("unload", finishCalendarUnifinder, false);
