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
var gUnifinderTreeName = "unifinder-search-results-listbox";
var kEventStatusOrder = ["TENTATIVE", "CONFIRMED", "CANCELLED"];

// Set this to true when the calendar event tree is clicked to allow for
// multiple selection
var gCalendarEventTreeClicked = false;

var gEventArray = new Array();

// Store the start and enddate, because the providers can't be trusted when
// dealing with all-day events. So we need to filter later. See bug 306157
var gStartDate;
var gEndDate;

var kDefaultTimezone;
var doingSelection = false;

function resetAllowSelection() {
    /**
     * Do not change anything in the following lines, they are needed as
     * described in the selection observer above
     */
    doingSelection = false;

    var searchTree = document.getElementById(gUnifinderTreeName);
    searchTree.view.selection.selectEventsSuppressed = false;
    searchTree.addEventListener("select", unifinderOnSelect, true);
}

function selectSelectedEventsInTree(aEventsToSelect) {
    if (doingSelection === true) {
        return;
    }

    doingSelection = true;

    if (aEventsToSelect === false) {
        aEventsToSelect = currentView().getSelectedItems({});
    }
    var searchTree = document.getElementById(gUnifinderTreeName);

    /**
     * The following is a brutal hack, caused by
     * http://lxr.mozilla.org/mozilla1.0/source/layout/xul/base/src/tree/src/nsTreeSelection.cpp#555
     * and described in bug 168211
     * http://bugzilla.mozilla.org/show_bug.cgi?id=168211
     * Do NOT remove anything in the next 3 lines, or the selection in the tree will not work.
     */
    searchTree.onselect = null;
    searchTree.removeEventListener("select", unifinderOnSelect, true);
    searchTree.view.selection.selectEventsSuppressed = true;
    searchTree.view.selection.clearSelection();

    if (aEventsToSelect && aEventsToSelect.length == 1) {
        var rowToScrollTo = searchTree.eventView.getRowOfCalendarEvent(aEventsToSelect[0]);

        if (rowToScrollTo != "null") {
           searchTree.treeBoxObject.ensureRowIsVisible(rowToScrollTo);
           searchTree.view.selection.timedSelect(rowToScrollTo, 1);
        }
    } else if (aEventsToSelect && aEventsToSelect.length > 1) {
        for (var i in aEventsToSelect) {
            var row = searchTree.eventView.getRowOfCalendarEvent(aEventsToSelect[i]);
            searchTree.view.selection.rangedSelect(row, row, true);
        }
    }

    // This needs to be in a setTimeout
    setTimeout("resetAllowSelection()", 1);
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
        if (!this.mInBatch) {
            refreshEventTree();
        }
    },

    onAddItem: function uO_onAddItem(aItem) {
        if (!(aItem instanceof Components.interfaces.calIEvent) ||
            this.mInBatch) {
            return;
        }
        this.addItemToTree(aItem);
    },

    onModifyItem: function uO_onModifyItem(aNewItem, aOldItem) {
        if (this.mInBatch) {
            return;
        }
        if (aOldItem instanceof Components.interfaces.calIEvent) {
            this.removeItemFromTree(aOldItem);
        }
        if (aNewItem instanceof Components.interfaces.calIEvent) {
            this.addItemToTree(aNewItem);
        }
    },

    onDeleteItem: function uO_onDeleteItem(aDeletedItem) {
        if (!(aDeletedItem instanceof Components.interfaces.calIEvent) ||
            this.mInBatch) {
            return;
        }
        this.removeItemFromTree(aDeletedItem);
    },

    dateFilter: function uO_dateFilter(event) {
        return ((!gEndDate || gEndDate.compare(event.startDate) >= 0) &&
                (!gStartDate || gStartDate.compare(event.endDate) < 0));
    },

    // It is safe to call these for any event.  The functions will determine
    // whether or not anything actually needs to be done to the tree
    addItemToTree: function uO_addItemToTree(aItem) {
        var items;
        if (gStartDate && gEndDate) {
            items = aItem.getOccurrencesBetween(gStartDate, gEndDate, {});
        } else {
            items = [aItem];
        }
        items = items.filter(this.dateFilter);
        gEventArray = gEventArray.concat(items);
        gEventArray.sort(compareEvents);
        var tree = document.getElementById("unifinder-search-results-listbox");
        for each (var item in items) {
            var row = tree.eventView.getRowOfCalendarEvent(item);
            tree.treeBoxObject.rowCountChanged(row, 1);
        }
    },
    removeItemFromTree: function uO_removeItemFromTree(aItem) {
        var items;
        if (gStartDate && gEndDate && (aItem.parentItem == aItem)) {
            items = aItem.getOccurrencesBetween(gStartDate, gEndDate, {});
        } else {
            items = [aItem];
        }
        items = items.filter(this.dateFilter);
        var tree = document.getElementById("unifinder-search-results-listbox");
        for each (var item in items) {
            var row = tree.eventView.getRowOfCalendarEvent(item);
            gEventArray.splice(row, 1);
            tree.treeBoxObject.rowCountChanged(row, -1);
        }
    },

    onError: function uO_onError(aErrNo, aMessage) {},

    // calICompositeObserver:
    onCalendarAdded: function uO_onCalendarAdded(aDeletedItem) {
        if (!this.mInBatch) {
            refreshEventTree();
        }
    },

    onCalendarRemoved: function uO_onCalendarRemoved(aDeletedItem) {
        if (!this.mInBatch) {
            refreshEventTree();
        }
    },

    onDefaultCalendarChanged: function uO_onDefaultCalendarChanged(aNewDefaultCalendar) {}
};

/**
 * Called when the calendar is loaded
 */
function prepareCalendarUnifinder() {
    function onGridSelect(aEvent) {
        selectSelectedEventsInTree(aEvent.detail);
    }

    // set up our calendar event observer
    var ccalendar = getCompositeCalendar();
    ccalendar.addObserver(unifinderObserver);

    kDefaultTimezone = calendarDefaultTimezone();

    // Listen for changes in the selected day, so we can update if need be
    var viewDeck = getViewDeck();
    viewDeck.addEventListener("dayselect", unifinderOnDaySelect, false);
    viewDeck.addEventListener("itemselect", onGridSelect, true);

    // Display something upon first load. onLoad doesn't work properly for
    // observers
    refreshEventTree();
}

/**
 * Called when the calendar is unloaded
 */
function finishCalendarUnifinder() {
   var ccalendar = getCompositeCalendar();
   ccalendar.removeObserver(unifinderObserver);
}

function unifinderOnDaySelect() {
    var filterList = document.getElementById("event-filter-menulist");
    if (filterList.selectedItem.value == "current") {
        refreshEventTree();
    }
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
 * This is attached to the ondblclik attribute of the events shown in the
 * unifinder
 */
function unifinderDoubleClickEvent(event) {
    // we only care about button 0 (left click) events
    if (event.button != 0) return;

    // find event by id
    var calendarEvent = getCalendarEventFromEvent(event);

    if (calendarEvent != null) {
        modifyEventWithDialog(calendarEvent);
    } else {
        createEventWithDialog();
    }
}

/**
 * Get the calendar from the given event
 */
function getCalendarEventFromEvent(event) {
    var tree = document.getElementById(gUnifinderTreeName);
    var row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY);

    if (row != -1 && row < tree.view.rowCount) {
        return tree.eventView.getCalendarEventAtRow(row);
    } else {
        return null;
    }
}

/**
*  This is attached to the onclik attribute of the events shown in the unifinder
*/
function unifinderOnSelect(event) {
    if (event.target.view.selection.getRangeCount() == 0) {
        return;
    }

    var arrayOfEvents = new Array();

    gCalendarEventTreeClicked = true;

    var calendarEvent;

    // Get the selected events from the tree
    var tree = document.getElementById(gUnifinderTreeName);
    var start = new Object();
    var end = new Object();
    var numRanges = tree.view.selection.getRangeCount();

    for (var t = 0; t < numRanges; t++){
        tree.view.selection.getRangeAt(t, start, end);

        for (var v = start.value; v <= end.value; v++){
            try {
                calendarEvent = tree.eventView.getCalendarEventAtRow(v);
            } catch (e) {
               dump("Error getting Event from row: " + e + "\n");
               return;
            }
            if (calendarEvent) {
                arrayOfEvents.push(calendarEvent);
            }
        }
    }

    if (arrayOfEvents.length == 1) {
        currentView().goToDay(arrayOfEvents[0].startDate);
    }

    // Pass in true, so we don't end up in a circular loop
    currentView().setSelectedItems(arrayOfEvents.length, arrayOfEvents, true);
    onSelectionChanged({detail: arrayOfEvents});
}

function unifinderToDoHasFocus() {
    return document.getElementById(ToDogUnifinderTreeName).treeBoxObject.focused;
}

/**
 *  This is called from the unifinder when a key is pressed in the search field
 */
var gSearchTimeout = null;

function searchKeyPress(searchTextItem, event) {
    // 13 == return
    if (event && event.keyCode == 13) {
        clearSearchTimer();
        refreshEventTree();
        return;
    }

    // Always clear the old one first
    clearSearchTimer();

    // Make a new timer
    gSearchTimeout = setTimeout("refreshEventTree()", 400);
}

function clearSearchTimer() {
   if (gSearchTimeout) {
      clearTimeout(gSearchTimeout);
      gSearchTimeout = null;
   }
}

/**
 * This function returns the event table.
 */
function changeEventFilter(event) {
    refreshEventTree();

    // The following isn't exactly right. It should actually reload after the
    // next event happens.

    // get the current time
    var now = new Date();

    var tomorrow = new Date(now.getFullYear(), now.getMonth(), (now.getDate() + 1));

    var milliSecsTillTomorrow = tomorrow.getTime() - now.getTime();

    setTimeout("refreshEventTree()", milliSecsTillTomorrow);
}

/**
*  Redraw the categories unifinder tree
*/
var unifinderTreeView = {
    get rowCount() {
        return gEventArray.length;
    },

    selectedColumn: null,
    sortDirection: null,
    sortStartedTime: new Date().getTime(), // updated just before sort
    outParameter: new Object(), // used to obtain dates during sort

    isContainer: function uTV_isContainer() { return false; },
    getCellProperties: function uTV_getCellProperties() { return false; },
    getColumnProperties: function uTV_getColumnProperties() { return false; },
    getRowProperties: function uTV_getRowProperties() { return false; },
    isSorted: function uTV_isSorted() { return false;},
    isEditable: function uTV_isEditable() { return true; },
    isSeparator: function uTV_isSeparator() { return false; },
    getImageSrc: function uTV_getImageSrc() { return false; },
    cycleHeader: function uTV_cycleHeader(col) {

        var sortActive = col.element.getAttribute("sortActive");
        this.selectedColumn = col.id;
        this.sortDirection = col.element.getAttribute("sortDirection");

        if (sortActive != "true") {
            var unifinder = document.getElementById("unifinder-search-results-listbox");
            var treeCols = unifinder.getElementsByTagName("treecol");
            for (var i = 0; i < treeCols.length; i++) {
                treeCols[i].removeAttribute("sortActive");
                treeCols[i].removeAttribute("sortDirection");
            }
            this.sortDirection = "ascending";
        } else {
            if (!this.sortDirection || this.sortDirection == "descending") {
                this.sortDirection = "ascending";
            } else {
                this.sortDirection = "descending";
            }
        }
        col.element.setAttribute("sortActive", "true");
        col.element.setAttribute("sortDirection", this.sortDirection);
        this.sortStartedTime = new Date().getTime(); // for null/0 dates in sort
        gEventArray.sort(compareEvents);

        document.getElementById(gUnifinderTreeName).view = this;
    },

    setTree: function uTV_setTree(tree) { this.tree = tree; },

    getCellText: function uTV_getCellText(row, column) {
        calendarEvent = gEventArray[row];

        switch (column.id) {
            case "unifinder-search-results-tree-col-title":
                return calendarEvent.title;

            case "unifinder-search-results-tree-col-startdate":
                return formatUnifinderEventDateTime(calendarEvent.startDate);

            case "unifinder-search-results-tree-col-enddate":
                var eventEndDate = calendarEvent.endDate.clone();
                // XXX reimplement
                //var eventEndDate = getCurrentNextOrPreviousRecurrence(calendarEvent);
                if (calendarEvent.startDate.isDate) {
                    // display enddate is ical enddate - 1
                    eventEndDate.day = eventEndDate.day - 1;
                }
                return formatUnifinderEventDateTime(eventEndDate);

            case "unifinder-search-results-tree-col-categories":
                return calendarEvent.getProperty("CATEGORIES");

            case "unifinder-search-results-tree-col-location":
                return calendarEvent.getProperty("LOCATION");

            case "unifinder-search-results-tree-col-status":
                return getEventStatusString(calendarEvent);

            case "unifinder-search-results-tree-col-calendarname":
                return calendarEvent.calendar.name;

            default:
                return false;
        }
    }
};

function compareEvents(eventA, eventB) {
    var modifier = (unifinderTreeView.sortDirection == "descending" ? -1 : 1);

    switch (unifinderTreeView.selectedColumn) {
        case "unifinder-search-results-tree-col-title":
            return compareString(eventA.title,  eventB.title) * modifier;

        case "unifinder-search-results-tree-col-startdate":
            var msNextStartA = msNextOrPreviousRecurrenceStart(eventA);
            var msNextStartB = msNextOrPreviousRecurrenceStart(eventB);
            return compareMSTime(msNextStartA, msNextStartB) * modifier;

        case "unifinder-search-results-tree-col-enddate":
            var msNextEndA = msNextOrPreviousRecurrenceEnd(eventA);
            var msNextEndB = msNextOrPreviousRecurrenceEnd(eventB);
            return compareMSTime(msNextEndA, msNextEndB) * modifier;

        case "unifinder-search-results-tree-col-categories":
             return compareString(eventA.getProperty("CATEGORIES"),
                                  eventB.getProperty("CATEGORIES")) * modifier;

        case "unifinder-search-results-tree-col-location":
            return compareString(eventA.getProperty("LOCATION"),
                                 eventB.getProperty("LOCATION")) * modifier;

        case "unifinder-search-results-tree-col-status":
            return compareNumber(kEventStatusOrder.indexOf(eventA.status),
                                 kEventStatusOrder.indexOf(eventB.status)) * modifier;

        case "unifinder-search-results-tree-col-calendarname":
            return compareString(eventA.calendar.name,
                                 eventB.calendar.name) * modifier;

        default:
            return 0;
     }
}

function compareString(a, b) {
    a = nullToEmpty(a);
    b = nullToEmpty(b);
    return (a < b ? -1 :
            a > b ?  1 : 0);
}

function nullToEmpty(value) {
    return value == null ? "" : value;
}

function compareMSTime(a, b) {
    return (a < b ? -1 :
            a > b ?  1 : 0);
}

function msNextOrPreviousRecurrenceStart(calendarEvent) {
    return calendarEvent.startDate.nativeTime;
    // XXX reimplement the following
    if (calendarEvent.recur && calendarEvent.start) {
        unifinderTreeView.outParameter.value = null; // avoid creating objects during sort
        if (calendarEvent.getNextRecurrence(unifinderTreeView.sortStartedTime,
                                             unifinderTreeView.outParameter) ||
            calendarEvent.getPreviousOccurrence(unifinderTreeView.sortStartedTime,
                                                unifinderTreeView.outParameter)) {
            return unifinderTreeView.outParameter.value;
        }
    }
    return dateToMilliseconds(calendarEvent.start);
}

function msNextOrPreviousRecurrenceEnd(event) {
    return event.endDate.nativeTime;
    //XXX reimplement the following
    var msNextStart = msNextOrPreviousRecurrenceStart(event);
    var msDuration = dateToMilliseconds(event.endDate)
                   - dateToMilliseconds(event.startDate);
    return msNextStart + msDuration;
}

function dateToMilliseconds(date) {
    // Treat null/0 as 'now' when sort started, so incomplete tasks stay current.
    // Time is computed once per sort (just before sort) so sort is stable.
    if (date == null) {
        return unifinderTreeView.sortStartedTime;
    }
    var ms = date.getTime();   // note: date is not a javascript date.
    if (ms == -62171262000000) { // ms value for (0000/00/00 00:00:00)
        return unifinderTreeView.sortStartedTime;
    }
    return ms;
}

function calendarEventView(eventArray) {
   this.eventArray = eventArray;
}

calendarEventView.prototype = {
    eventArray: null,

    getCalendarEventAtRow: function(i) {
        return gEventArray[i];
    },

    getRowOfCalendarEvent: function(event) {
        if (!event) {
            return null;
        }
        for (var i in gEventArray) {
            if (gEventArray[i].hashId == event.hashId) {
                return i;
            }
        }
        return null;
    }
};

function refreshEventTree() {
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

    var Today = new Date();
    // Do this to allow all day events to show up all day long.
    var StartDate = new Date(Today.getFullYear(),
                             Today.getMonth(),
                             Today.getDate(),
                             0, 0, 0);
    var EndDate;

    var ccalendar = getCompositeCalendar();
    var filter = 0;

    filter |= ccalendar.ITEM_FILTER_TYPE_EVENT;

    var filterMenulist = document.getElementById("event-filter-menulist");
    switch (filterMenulist.selectedItem.value) {
        case "all":
            StartDate = null;
            EndDate = null;
            break;

        case "today":
            EndDate = new Date(StartDate.getTime() + (1000 * 60 * 60 * 24) - 1);
            break;

        case "next7Days":
            EndDate = new Date(StartDate.getTime() + (1000 * 60 * 60 * 24 * 8));
            break;

        case "next14Days":
            EndDate = new Date(StartDate.getTime() + (1000 * 60 * 60 * 24 * 15));
            break;

        case "next31Days":
            EndDate = new Date(StartDate.getTime() + (1000 * 60 * 60 * 24 * 32));
            break;

        case "thisCalendarMonth":
            // midnight on first day of this month
            var startOfMonth = new Date(Today.getFullYear(), Today.getMonth(), 1, 0, 0, 0);
            // midnight on first day of next month
            var startOfNextMonth = new Date(Today.getFullYear(), (Today.getMonth() + 1), 1, 0, 0, 0);
            // 23:59:59 on last day of this month
            EndDate = new Date(startOfNextMonth.getTime() - 1000);
            StartDate = startOfMonth;
            break;

        case "future":
            EndDate = null;
            break;

        case "current":
            var SelectedDate = currentView().selectedDay.jsDate;
            StartDate = new Date(SelectedDate.getFullYear(), SelectedDate.getMonth(), SelectedDate.getDate(), 0, 0, 0);
            EndDate = new Date(StartDate.getTime() + (1000 * 60 * 60 * 24) - 1000);
            break;

        default:
            dump("there's no case for " + filterMenulist.selectedItem.value + "\n");
            EndDate = StartDate;
            break;
    }
    gStartDate = StartDate ? jsDateToDateTime(StartDate).getInTimezone(calendarDefaultTimezone()) : null;
    gEndDate = EndDate ? jsDateToDateTime(EndDate).getInTimezone(calendarDefaultTimezone()) : null;
    if (StartDate && EndDate) {
        filter |= ccalendar.ITEM_FILTER_CLASS_OCCURRENCES;
    }
    ccalendar.getItems(filter, 0, gStartDate, gEndDate, refreshListener);
}

function refreshEventTreeInternal(eventArray) {
    var searchText = document.getElementById("unifinder-search-field").value;
    searchText = searchText.toLowerCase();

    // XXX match for strings with only whitespace. Skip those too
    if (searchText.length) {
        gEventArray = new Array();
        var fieldsToSearch = ["DESCRIPTION", "LOCATION", "CATEGORIES", "URL"];

        for (var j in eventArray) {
            var event = eventArray[j];
            if (event.title &&
                event.title.toLowerCase().indexOf(searchText) != -1) {
                gEventArray.push(event);
            } else {
                for (var k in fieldsToSearch) {
                    var val = event.getProperty(fieldsToSearch[k]);
                    if (val && val.toLowerCase().indexOf(searchText) != -1) {
                        gEventArray.push(event);
                        break;
                    }
                }
            }
        }
    } else {
        gEventArray = eventArray;
    }

    // Extra check to see if the events are in the daterange. Some providers
    // are broken when looking at all-day events.
    function dateFilter(event) {
        // Using .compare on the views start and end, not on the events dates,
        // because .compare uses the timezone of the datetime it is called on.
        // The view's timezone is what is important here.
        return ((!gEndDate || gEndDate.compare(event.startDate) >= 0) &&
                (!gStartDate || gStartDate.compare(event.endDate) < 0));
    }
    gEventArray = gEventArray.filter(dateFilter);

    var unifinderTree = document.getElementById(gUnifinderTreeName);
    var arrayOfTreeCols = unifinderTree.getElementsByTagName("treecol");

    for (var i = 0; i < arrayOfTreeCols.length; i++) {
        if (arrayOfTreeCols[i].getAttribute("sortActive") == "true") {
            unifinderTreeView.selectedColumn = arrayOfTreeCols[i].getAttribute("id");
            unifinderTreeView.sortDirection = arrayOfTreeCols[i].getAttribute("sortDirection");
            unifinderTreeView.sortStartedTime = new Date().getTime(); // for null/0 dates
            gEventArray.sort(compareEvents);
            break;
        }
    }

    unifinderTree.view = unifinderTreeView;
    unifinderTree.eventView = new calendarEventView(gEventArray);

    // Select selected events in the tree.
    selectSelectedEventsInTree(false);
}

function unifinderKeyPress(aEvent) {
    const kKE = Components.interfaces.nsIDOMKeyEvent;
    switch (aEvent.keyCode) {
        case 13:
            // Enter, edit the event
            modifyEventWithDialog(getSelectedItems()[0]);
            break;
        case kKE.DOM_VK_BACK_SPACE:
        case kKE.DOM_VK_DELETE:
            deleteEventCommand(true);
            break;
    }
}

function focusSearch() {
    document.getElementById("unifinder-search-field").focus();
}

window.addEventListener("load", prepareCalendarUnifinder, false);
window.addEventListener("unload", finishCalendarUnifinder, false);
