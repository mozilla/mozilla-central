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
 *
 * NOTE: Including this file will cause a load handler to be added to the
 * window.
 */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

// Set this to true when the calendar event tree is clicked to allow for
// multiple selection
var gCalendarEventTreeClicked = false;

// Store the start and enddate, because the providers can't be trusted when
// dealing with all-day events. So we need to filter later. See bug 306157

var kDefaultTimezone;
var gUnifinderNeedsRefresh = true;

/**
 * Checks if the unifinder is hidden
 *
 * @return      Returns true if the unifinder is hidden.
 */
function isUnifinderHidden() {
    return document.getElementById("bottom-events-box").hidden;
}

/**
 * Returns the current filter applied to the unifinder.
 *
 * @return      The string name of the applied filter.
 */
function getCurrentUnifinderFilter() {
    return document.getElementById("event-filter-menulist").selectedItem.value;
}

/**
 * Observer for the calendar event data source. This keeps the unifinder
 * display up to date when the calendar event data is changed
 *
 * @see calIObserver
 * @see calICompositeObserver
 */
var unifinderObserver = {
    mInBatch: false,

    QueryInterface: function uO_QueryInterface (aIID) {
        return cal.doQueryInterface(this,
                                    null, // this singleton has no prototype
                                    aIID,
                                    [Components.interfaces.calICompositeObserver,
                                     Components.interfaces.nsIObserver,
                                     Components.interfaces.calIObserver]);
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
            addItemsFromCalendar(aAddedCalendar,
                                 addItemsFromSingleCalendarInternal);
        }
    },

    onCalendarRemoved: function uO_onCalendarRemoved(aDeletedCalendar) {
        if (!this.mInBatch && !aDeletedCalendar.getProperty("disabled")) {
            deleteItemsFromCalendar(aDeletedCalendar);
        }
    },

    onDefaultCalendarChanged: function uO_onDefaultCalendarChanged(aNewDefaultCalendar) {},

    /**
     * Add an unifinder item to the tree. It is safe to call these for any
     * event. The functions will determine whether or not anything actually
     * needs to be done to the tree.
     *
     * @return aItem        The item to add to the tree.
     */
    addItemToTree: function uO_addItemToTree(aItem) {
        let items;
        let filter = unifinderTreeView.mFilter;

        if (filter.startDate && filter.endDate) {
            items = aItem.getOccurrencesBetween(filter.startDate, filter.endDate, {});
        } else {
            items = [aItem];
        }
        unifinderTreeView.addItems(items.filter(filter.isItemInFilters, filter));
    },

    /**
     * Remove an item from the unifinder tree. It is safe to call these for any
     * event. The functions will determine whether or not anything actually
     * needs to be done to the tree.
     *
     * @return aItem        The item to remove from the tree.
     */
    removeItemFromTree: function uO_removeItemFromTree(aItem) {
        let items;
        let filter = unifinderTreeView.mFilter;
        if (filter.startDate && filter.endDate && (aItem.parentItem == aItem)) {
            items = aItem.getOccurrencesBetween(filter.startDate, filter.endDate, {});
        } else {
            items = [aItem];
        }
        // XXX: do we really still need this, we are always checking it in the refreshInternal
        unifinderTreeView.removeItems(items.filter(filter.isItemInFilters, filter));
    },

    observe: function uO_observe(aSubject, aTopic, aPrefName) {
        switch (aPrefName) {
            case "calendar.date.format":
            case "calendar.timezone.local":
                refreshEventTree();
                break;
        }
    }
};

/**
 * Called when the window is loaded to prepare the unifinder. This function is
 * used to add observers, event listeners, etc.
 */
function prepareCalendarUnifinder() {
    // Only load once
    window.removeEventListener("load", prepareCalendarUnifinder, false);
    let unifinderTree = document.getElementById("unifinder-search-results-tree");

    // Add pref observer
    let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    let branch = prefService.getBranch("")
                            .QueryInterface(Components.interfaces.nsIPrefBranch2);
    branch.addObserver("calendar.", unifinderObserver, false);

    // Check if this is not the hidden window, which has no UI elements
    if (unifinderTree) {
        // set up our calendar event observer
        let ccalendar = getCompositeCalendar();
        ccalendar.addObserver(unifinderObserver);

        kDefaultTimezone = calendarDefaultTimezone();

        // Set up the filter
        unifinderTreeView.mFilter = new calFilter();
        unifinderTreeView.mFilter.propertyFilter = "unifinder-search-field";

        // Set up the unifinder views.
        unifinderTreeView.treeElement = unifinderTree;
        unifinderTree.view = unifinderTreeView;

        // Listen for changes in the selected day, so we can update if need be
        let viewDeck = getViewDeck();
        viewDeck.addEventListener("dayselect", unifinderDaySelect, false);
        viewDeck.addEventListener("itemselect", unifinderItemSelect, true);

        // Set up sortDirection and sortActive, in case it persisted
        let sorted = unifinderTree.getAttribute("sort-active");
        let sortDirection = unifinderTree.getAttribute("sort-direction") || "ascending";
        let tree = document.getElementById("unifinder-search-results-tree");
        let treecols = tree.getElementsByTagName("treecol");
        for (let i = 0; i < treecols.length; i++) {
            let col = treecols[i];
            let content = col.getAttribute("itemproperty");
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
 * Called when the window is unloaded to clean up any observers and listeners
 * added.
 */
function finishCalendarUnifinder() {
    let ccalendar = getCompositeCalendar();
    ccalendar.removeObserver(unifinderObserver);

    // Remove pref observer
    let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    let branch = prefService.getBranch("")
                            .QueryInterface(Components.interfaces.nsIPrefBranch2);
    branch.removeObserver("calendar.", unifinderObserver, false);

    let viewDeck = getViewDeck();
    if (viewDeck) {
        viewDeck.removeEventListener("dayselect", unifinderDaySelect, false);
        viewDeck.removeEventListener("itemselect", unifinderItemSelect, true);
    }

    // Persist the sort
    let unifinderTree = document.getElementById("unifinder-search-results-tree");
    let sorted = unifinderTreeView.selectedColumn;
    if (sorted) {
        unifinderTree.setAttribute("sort-active",sorted.getAttribute("itemproperty"));
        unifinderTree.setAttribute("sort-direction",unifinderTree.sortDirection);
    } else {
        unifinderTree.removeAttribute("sort-active");
        unifinderTree.removeAttribute("sort-direction");
    }
}

/**
 * Event listener for the view deck's dayselect event.
 */
function unifinderDaySelect() {
    if (getCurrentUnifinderFilter() == "current") {
        refreshEventTree();
    }
}

/**
 * Event listener for the view deck's itemselect event.
 */
function unifinderItemSelect(aEvent) {
    unifinderTreeView.setSelectedItems(aEvent.detail);
}

/**
 * Helper function to display event datetimes in the unifinder.
 *
 * @param aDatetime     A calIDateTime object to format.
 * @return              The passed date's formatted in the default timezone.
 */
function formatUnifinderEventDateTime(aDatetime) {
    return cal.getDateFormatter().formatDateTime(aDatetime.getInTimezone(kDefaultTimezone));
}

/**
 * Handler function for double clicking the unifinder.
 *
 * @param event         The DOM doubleclick event.
 */
function unifinderDoubleClick(event) {
    // We only care about button 0 (left click) events
    if (event.button != 0) {
        return;
    }

    // find event by id
    let calendarEvent = unifinderTreeView.getItemFromEvent(event);

    if (calendarEvent != null) {
        modifyEventWithDialog(calendarEvent, null, true);
    } else {
        createEventWithDialog();
    }
}

/**
 * Handler function for selection in the unifinder.
 *
 * @param event         The DOM selection event.
 */
function unifinderSelect(event) {
    let tree = unifinderTreeView.treeElement;
    if (!tree.view.selection || tree.view.selection.getRangeCount() == 0) {
        return;
    }

    let selectedItems = [];
    gCalendarEventTreeClicked = true;

    // Get the selected events from the tree
    let start = {};
    let end = {};
    let numRanges = tree.view.selection.getRangeCount();

    for (let t = 0; t < numRanges; t++) {
        tree.view.selection.getRangeAt(t, start, end);

        for (let v = start.value; v <= end.value; v++) {
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

/**
 * Handler function for keypress in the unifinder.
 *
 * @param aEvent        The DOM Key event.
 */
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
    // Provide a default tree that holds all the functions used here to avoid
    // cludgy if (this.tree) { this.tree.rowCountChanged(...); } constructs.
    tree: {
        rowCountChanged: function() {},
        beginUpdateBatch: function() {},
        endUpdateBatch: function() {},
        invalidate: function() {}
    },

    treeElement: null,
    doingSelection: false,
    mFilter: null,
    mSelectedColumn: null,
    sortDirection: null,

    /**
     * Returns the currently selected column in the unifinder (used for sorting).
     */
    get selectedColumn() {
        return this.mSelectedColumn;
    },

    /**
     * Sets the currently selected column in the unifinder (used for sorting).
     */
    set selectedColumn(aCol) {
        let tree = document.getElementById("unifinder-search-results-tree");
        let treecols = tree.getElementsByTagName("treecol");
        for each (let col in Array.slice(treecols)) {
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

    /**
     * Add an item to the unifinder tree.
     *
     * @param aItemArray        An array of items to add.
     * @param aDontSort         If true, the items will only be appended.
     */
    addItems: function uTV_addItems(aItemArray, aDontSort) {
        this.eventArray = this.eventArray.concat(aItemArray);
        let newCount = (this.eventArray.length - aItemArray.length - 1);
        this.tree.rowCountChanged(newCount, aItemArray.length);

        if (aDontSort) {
            this.calculateIndexMap();
        } else {
            this.sortItems();
        }
    },

    /**
     * Remove items from the unifinder tree.
     *
     * @param aItemArray        An array of items to remove.
     */
    removeItems: function uTV_removeItems(aItemArray) {
        let indexesToRemove = [];
        // Removing items is a bit tricky. Our getItemRow function takes the
        // index from a cached map, so removing an item from the array will
        // remove the wrong indexes. We don't want to just invalidate the map,
        // since this will cause O(n^2) behavior. Instead, we keep a sorted
        // array of the indexes to remove:
        for each (let item in aItemArray) {
            let row = this.getItemRow(item);
            if (row > -1) {
                if (!indexesToRemove.length || row <= indexesToRemove[0]) {
                    indexesToRemove.unshift(row);
                } else {
                    indexesToRemove.push(row);
                }
            }
        }

        // Then we go through the indexes to remove, and remove then from the
        // array. We subtract one delta for each removed index to make sure the
        // correct element is removed from the array and the correct
        // notification is sent.
        this.tree.beginUpdateBatch();
        for (let delta = 0; delta < indexesToRemove.length; delta++) {
            let index = indexesToRemove[delta];
            this.eventArray.splice(index - delta, 1);
            this.tree.rowCountChanged(index - delta, -1);
        }
        this.tree.endUpdateBatch();

        // Finally, we recalculate the index map once. This way we end up with
        // (given that Array.unshift doesn't loop but just prepends or maps
        // memory smartly) O(3n) behavior. Lets hope its worth it.
        this.calculateIndexMap(true);
    },

    /**
     * Clear all items from the unifinder.
     */
    clearItems: function uTV_clearItems() {
        let oldCount = this.eventArray.length;
        this.eventArray = [];
        this.tree.rowCountChanged(0, -oldCount);
        this.calculateIndexMap();
    },

    /**
     * Sets the items that should be in the unifinder. This removes all items
     * that were previously in the unifinder.
     */
    setItems: function uTV_setItems(aItemArray, aDontSort) {
        let oldCount = this.eventArray.length;
        this.eventArray = aItemArray.slice(0);
        this.tree.rowCountChanged(oldCount - 1 , (this.eventArray.length - oldCount));

        if (aDontSort) {
            this.calculateIndexMap();
        } else {
            this.sortItems();
        }
    },

    /**
     * Recalculate the index map that improves performance when accessing
     * unifinder items. This is usually done automatically when adding/removing
     * items.
     *
     * @param aDontInvalidate       (optional) Don't invalidate the tree, i.e if
     *                                you correctly issued rowCountChanged
     *                                notices.
     */
    calculateIndexMap: function uTV_calculateIndexMap(aDontInvalidate) {
        this.eventIndexMap = {};
        for (let i = 0 ; i < this.eventArray.length; i++) {
            this.eventIndexMap[this.eventArray[i].hashId] = i;
        }

        if (!aDontInvalidate) {
            this.tree.invalidate();
        }
    },

    /**
     * Sort the items in the unifinder by the currently selected column.
     */
    sortItems: function uTV_sortItems() {
        if (this.selectedColumn) {
            let modifier = (this.sortDirection == "descending" ? -1 : 1);
            let sortKey = unifinderTreeView.selectedColumn.getAttribute("itemproperty");
            let sortType = cal.getSortTypeForSortKey(sortKey);
            // sort (key,item) entries
            cal.sortEntry.mSortKey = sortKey;
            cal.sortEntry.mSortStartedDate = now();
            let entries = this.eventArray.map(cal.sortEntry, cal.sortEntry);
            entries.sort(cal.sortEntryComparer(sortType, modifier));
            this.eventArray = entries.map(cal.sortEntryItem);
        }
        this.calculateIndexMap();
    },

    /**
     * Get the index of the row associated with the passed item.
     *
     * @param item      The item to search for.
     * @return          The row index of the passed item.
     */
    getItemRow: function uTV_getItemRow(item) {
        if (this.eventIndexMap[item.hashId] === undefined) {
            return -1;
        }
        return this.eventIndexMap[item.hashId];
    },

    /**
     * Get the item at the given row index.
     *
     * @param item      The row index to get the item for.
     * @return          The item at the given row.
     */
    getItemAt: function uTV_getItemAt(aRow) {
        return this.eventArray[aRow];
    },

    /**
     * Get the calendar item from the given DOM event
     *
     * @param event     The DOM mouse event to get the item for.
     * @return          The item under the mouse position.
     */
    getItemFromEvent: function uTV_getItemFromEvent(event) {
        let row = this.tree.getRowAt(event.clientX, event.clientY);

        if (row > -1) {
            return this.getItemAt(row);
        }
        return null;
    },

    /**
     * Change the selection in the unifinder.
     *
     * @param aItemArray        An array of items to select.
     */
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
            let rowToScrollTo = this.getItemRow(aItemArray[0]);
            if (rowToScrollTo > -1) {
               this.tree.ensureRowIsVisible(rowToScrollTo);
               this.tree.view.selection.select(rowToScrollTo);
            }
        } else if (aItemArray && aItemArray.length > 1) {
            // If there is more than one item, just select them all.
            for each (let item in aItemArray) {
                let row = this.getItemRow(item);
                this.tree.view.selection.rangedSelect(row, row, true);
            }
        }

        // This needs to be in a setTimeout
        setTimeout(function() { unifinderTreeView.resetAllowSelection(); }, 1);
    },

    /**
     * Due to a selection issue described in bug 168211 this method is needed to
     * re-add the selection listeners selection listeners.
     */
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
     * @see nsITreeView
     */
    get rowCount() {
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
        let item = this.eventArray[aRow];
        if (item.priority > 0 && item.priority < 5) {
            aProps.AppendElement(getAtomFromService("highpriority"));
        } else if (item.priority > 5 && item.priority < 10) {
            aProps.AppendElement(getAtomFromService("lowpriority"));
        }

        // Add calendar name atom
        let calendarAtom = "calendar-" + formatStringForCSSRule(item.calendar.name);
        aProps.AppendElement(getAtomFromService(calendarAtom));

        // Add item status atom
        if (item.status) {
            aProps.AppendElement(getAtomFromService("status-" + item.status.toLowerCase()));
        }

        // Alarm status atom
        if (item.getAlarms({}).length) {
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
        let calendarEvent = this.eventArray[row];

        switch (column.element.getAttribute("itemproperty")) {
            case "title":
                return (calendarEvent.title ? calendarEvent.title.replace(/\n/g, ' ') : "");
            case "startDate":
                return formatUnifinderEventDateTime(calendarEvent.startDate);

            case "endDate":
                let eventEndDate = calendarEvent.endDate.clone();
                // XXX reimplement
                //let eventEndDate = getCurrentNextOrPreviousRecurrence(calendarEvent);
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

/**
 * Refresh the unifinder tree by getting items from the composite calendar and
 * applying the current filter.
 */
function refreshEventTree() {
    addItemsFromCalendar(getCompositeCalendar(),
                         addItemsFromCompositeCalendarInternal);
}

/**
 * EXTENSION_POINTS
 * Filters the passed event array according to the currently applied filter.
 * Afterwards, applies the items to the unifinder view.
 *
 * If you are implementing a new filter, you can overwrite this function and
 * filter the items accordingly and afterwards call this function with the
 * result.
 *
 * @param eventArray        The array of items to be set in the unifinder.
 */
function addItemsFromCompositeCalendarInternal(eventArray) {
    let newItems
        = eventArray.filter(unifinderTreeView.mFilter.isItemInFilters,
                            unifinderTreeView.mFilter);
    unifinderTreeView.setItems(newItems);

    // Select selected events in the tree. Not passing the argument gets the
    // items from the view.
    unifinderTreeView.setSelectedItems();
}

function addItemsFromSingleCalendarInternal(eventArray) {
    let newItems
        = eventArray.filter(unifinderTreeView.mFilter.isItemInFilters,
                            unifinderTreeView.mFilter);
    unifinderTreeView.setItems(unifinderTreeView.eventArray.concat(newItems));

    // Select selected events in the tree. Not passing the argument gets the
    // items from the view.
    unifinderTreeView.setSelectedItems();
}

function addItemsFromCalendar(aCalendar, aAddItemsInternalFunc) {
    if (isUnifinderHidden()) {
        // If the unifinder is hidden, don't refresh the events to reduce needed
        // getItems calls.
        return;
    }
    var refreshListener = {
        mEventArray: [],

        onOperationComplete: function rET_onOperationComplete(aCalendar,
                                                              aStatus,
                                                              aOperationType,
                                                              aId,
                                                              aDateTime) {
            var refreshTreeInternalFunc = function() {
                aAddItemsInternalFunc(refreshListener.mEventArray);
            };
            setTimeout(refreshTreeInternalFunc, 0);
        },

        onGetResult: function rET_onGetResult(aCalendar,
                                              aStatus,
                                              aItemType,
                                              aDetail,
                                              aCount,
                                              aItems) {
            refreshListener.mEventArray = refreshListener.mEventArray.concat(aItems);
        }
    };

    let filter = 0;

    filter |= aCalendar.ITEM_FILTER_TYPE_EVENT;

    // Not all xul might be there yet...
    if (!document.getElementById(unifinderTreeView.mFilter.textFilterField)) {
        return;
    }
    unifinderTreeView.mFilter.setDateFilter(getCurrentUnifinderFilter());

    if (unifinderTreeView.mFilter.startDate && unifinderTreeView.mFilter.endDate) {
        filter |= aCalendar.ITEM_FILTER_CLASS_OCCURRENCES;
    }

    aCalendar.getItems(filter,
                       0,
                       unifinderTreeView.mFilter.startDate,
                       unifinderTreeView.mFilter.endDate,
                       refreshListener);
}

function deleteItemsFromCalendar(aCalendar) {
    let filter = unifinderTreeView.mFilter;
    let items = [ item for each (item in unifinderTreeView.eventArray)
                    if (item.calendar.id == aCalendar.id) ];

    unifinderTreeView.removeItems(items.filter(filter.isItemInFilters, filter));
}

/**
 * Focuses the unifinder search field
 */
function focusSearch() {
    document.getElementById("unifinder-search-field").focus();
}

/**
 * Toggles the hidden state of the unifinder.
 */
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
