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
    - The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Berend Cornelius <berend.cornelius@sun.com>
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

function Synthetic(aOpen, aDuration) {
    this.open = aOpen;
    this.duration = aDuration;
}

var agendaListbox = {
    agendaListboxControl: null,
    pendingRefresh: null,
    kDefaultTimezone: null,
    showsToday: false
};

agendaListbox.init =
function initAgendaListbox() {
    this.agendaListboxControl = document.getElementById("agenda-listbox");
    this.agendaListboxControl.removeAttribute("suppressonselect");
    var showTodayHeader = (document.getElementById("today-header-hidden").getAttribute("checked") == "true");
    var showTomorrowHeader = (document.getElementById("tomorrow-header-hidden").getAttribute("checked") == "true");
    var showSoonHeader = (document.getElementById("nextweek-header-hidden").getAttribute("checked") == "true");
    this.today = new Synthetic(showTodayHeader, 1);
    this.addPeriodListItem(this.today, "today-header");
    this.tomorrow = new Synthetic(showTomorrowHeader, 1);
    var soondays = getPrefSafe("calendar.agendaListbox.soondays", 5);
    this.soon = new Synthetic(showSoonHeader, soondays);
    this.periods = [this.today, this.tomorrow, this.soon];

    // Make sure the agenda listbox is unloaded
    var self = this;
    window.addEventListener("unload",
                            function unload_agendaListbox() {
                                self.uninit();
                            },
                            false);
};

agendaListbox.uninit =
function uninit() {
    if (this.calendar) {
        this.calendar.removeObserver(this.calendarObserver);
    }

    for each (var period in this.periods) {
        if (period.listItem) {
            period.listItem.getCheckbox()
                  .removeEventListener("CheckboxStateChange",
                                       this.onCheckboxChange,
                                       true);
        }
    }
};

agendaListbox.addPeriodListItem =
function addPeriodListItem(aPeriod, aItemId) {
    aPeriod.listItem = document.getElementById(aItemId + "-hidden").cloneNode(true);
    agendaListbox.agendaListboxControl.appendChild(aPeriod.listItem);
    aPeriod.listItem.id = aItemId;
    aPeriod.listItem.getCheckbox().setChecked(aPeriod.open);
    aPeriod.listItem.getCheckbox().addEventListener("CheckboxStateChange", this.onCheckboxChange, true);
}

agendaListbox.removePeriodListItem =
function removePeriodListItem(aPeriod) {
    if (aPeriod.listItem) {
        aPeriod.listItem.getCheckbox().removeEventListener("CheckboxStateChange", this.onCheckboxChange, true);
        if (aPeriod.listItem) {
            this.agendaListboxControl.removeChild(aPeriod.listItem);
            aPeriod.listItem = null;
        }
    }
}

agendaListbox.onCheckboxChange =
function onCheckboxChange(event) {
    var periodCheckbox = event.target;
    var lopen = (periodCheckbox.getAttribute("checked") == "true");
    var listItem = getParentNodeOrThis(periodCheckbox, "agenda-checkbox-richlist-item");
    var period = listItem.getItem();
    period.open= lopen;
    // as the agenda-checkboxes are only transient we have to set the "checked"
    // attribute at their hidden origins to make that attribute persistent.
    document.getElementById(listItem.id + "-hidden").setAttribute("checked", 
                            periodCheckbox.getAttribute("checked"));
    if (lopen) {
        agendaListbox.refreshCalendarQuery(period.start, period.end);
    } else {
        listItem = listItem.nextSibling;
        do {
            var leaveloop = (listItem == null);
            if (!leaveloop) {
                var nextItemSibling = listItem.nextSibling;
                leaveloop = (!agendaListbox.isEventListItem(listItem));
                if (!leaveloop) {
                    agendaListbox.agendaListboxControl.removeChild(listItem);
                    listItem = nextItemSibling;
                }
            }
        } while (!leaveloop);
    }
    calendarController.onSelectionChanged({detail: []});    
};

agendaListbox.onSelect =
function onSelect(aListItem) {
    var listbox = document.getElementById("agenda-listbox");
    listbox.focus();
    listbox.removeAttribute("disabled");
    var item = aListItem || listbox.selectedItem;
    if (aListItem) {
        listbox.selectedItem = item;
    }
    if (item) {
        item.removeAttribute("disabled");
    }
    calendarController.onSelectionChanged({detail: agendaListbox.getSelectedItems()});
}

agendaListbox.onFocus =
function onFocus() {
    var listbox = document.getElementById("agenda-listbox");
    listbox.removeAttribute("disabled");
    this.enableListItems();
    calendarController.onSelectionChanged({detail: agendaListbox.getSelectedItems()});
}

agendaListbox.onBlur =
function onBlur() {
    var item  = document.getElementById("agenda-listbox").selectedItem;
    if (item) {
        item.setAttribute("disabled","true");
    }
    calendarController.onSelectionChanged({detail: []});
}

agendaListbox.enableListItems =
function enableListItems() {
    var childNodes = document.getElementById("agenda-listbox").childNodes;
    for (var i = 0;i < childNodes.length; i++) {
        var listItem = childNodes[i];
        listItem.removeAttribute("disabled");
    }
}

agendaListbox.onKeyPress =
function onKeyPress(aEvent) {
    var listItem = aEvent.target;
    if (listItem.localName == "richlistbox") {
        listItem = listItem.selectedItem;
    }
    switch(aEvent.keyCode) {
        case aEvent.DOM_VK_RETURN:
            document.getElementById('agenda_edit_event_command').doCommand();
            break;
        case aEvent.DOM_VK_DELETE:
            document.getElementById('agenda_delete_event_command').doCommand();
            aEvent.stopPropagation();
            aEvent.preventDefault();
            break;
        case aEvent.DOM_VK_LEFT:
            if (!this.isEventListItem(listItem)) {
                listItem.getCheckbox().setChecked(false);
            }
            break;
        case aEvent.DOM_VK_RIGHT:
            if (!this.isEventListItem(listItem)) {
                listItem.getCheckbox().setChecked(true);
            }
            break;
    }
}

agendaListbox.editSelectedItem =
function editSelectedItem(aEvent) {
    var listItem  = document.getElementById("agenda-listbox").selectedItem;
    if (listItem) {
        modifyEventWithDialog(listItem.occurrence, null, true);
    }
}

agendaListbox.findPeriodsForItem =
function findPeriodsForItem(aItem) {
    var retPeriods = [];
    for (var i = 0; i < this.periods.length; i++) {
        if (this.periods[i].open) {
            if (checkIfInRange(aItem, this.periods[i].start, this.periods[i].end)) {
                retPeriods.push(this.periods[i]);
            }
        }
    }
    return retPeriods;
};

agendaListbox.getStart =
function getStart(){
    var retStart = null;
    for (var i = 0; i < this.periods.length; i++) {
        if (this.periods[i].open) {
            retStart = this.periods[i].start;
            break;
        }
    }
    return retStart;
}

agendaListbox.getEnd =
function getEnd(){
    var retEnd = null;
    for (var i = this.periods.length - 1; i >= 0; i--) {
        if (this.periods[i].open) {
            retEnd = this.periods[i].end;
            break;
        }
    }
    return retEnd;
}

agendaListbox.addItemBefore =
function addItemBefore(aNewItem, aAgendaItem, aPeriod, visible) {
    var newelement = null;
    if (aNewItem.startDate.isDate) {
        newelement = createXULElement("agenda-allday-richlist-item");
    } else {
        newelement = createXULElement("agenda-richlist-item")
    }
    // set the item at the richlistItem. When the duration of the period
    // is bigger than 1 (day) the starttime of the item has to include
    // information about the day of the item
    if (aAgendaItem == null) {
        this.agendaListboxControl.appendChild(newelement);
    } else {
        this.agendaListboxControl.insertBefore(newelement, aAgendaItem);
    }
    newelement.setOccurrence(aNewItem, (aPeriod.duration > 1));
    newelement.removeAttribute("selected");
    return newelement;
}

agendaListbox.addItem =
function addItem(aItem) {
    if (!isEvent(aItem)) {
        return null;
    }
    var periods = this.findPeriodsForItem(aItem);
    if (periods.length == 0) {
        return null;
    }
    for (var i = 0; i < periods.length; i++) {
        period = periods[i];
        var complistItem = period.listItem;
        var visible = complistItem.getCheckbox().checked;
        var newlistItem = null;
        if ((aItem.startDate.isDate) && (period.duration == 1)) {
            if (this.getListItems(aItem, period).length == 0) {
                this.addItemBefore(aItem, period.listItem.nextSibling, period, visible);
            }
        } else {
            do {
                var prevlistItem = complistItem;
                var complistItem = complistItem.nextSibling;
                if (!this.isEventListItem(complistItem)) {
                    newlistItem = this.addItemBefore(aItem, complistItem, period, visible);
                    break;
                } else {
                    var compitem = complistItem.occurrence;
                    if (this.isSameEvent(aItem, compitem)) {
                        // The same event occurs on several calendars but we only
                        // display the first one.
                        // TODO: find a way to display this special circumstance
                        break;
                    } else if (this.isBefore(aItem, compitem)) {
                        if (this.isSameEvent(aItem, compitem)) {
                            newlistItem = this.addItemBefore(aItem, complistItem, period, visible);
                            break
                        } else {
                            newlistItem = this.addItemBefore(aItem, complistItem, period, visible);
                            break;
                        }
                    }
                }
            } while (complistItem)
        }
    }
    return newlistItem;
};

agendaListbox.isBefore =
function isBefore(aItem, aCompItem) {
    if (aCompItem.startDate.day == aItem.startDate.day) {
        if (aItem.startDate.isDate) {
            return true;
        } else if (aCompItem.startDate.isDate) {
            return false;
        }
    }
    var comp = aItem.startDate.compare(aCompItem.startDate);
    if (comp == 0) {
        comp = aItem.endDate.compare(aCompItem.endDate);
    }
    return (comp <= 0);
}


agendaListbox.getListItems =
function getListItems(aItem, aPeriod) {
    var retlistItems = new Array();
    var periods = [aPeriod];
    if (!aPeriod) {
        var periods = this.findPeriodsForItem(aItem);
    }
    if (periods.length > 0) {
        for (var i = 0; i < periods.length; i++) {
            period = periods[i];
            var complistItem = period.listItem;
            do {
                var complistItem = complistItem.nextSibling;
                var leaveloop = (!this.isEventListItem(complistItem));
                if (!leaveloop) {
                    if (this.isSameEvent(aItem, complistItem.occurrence)){
                        retlistItems.push(complistItem);
                        break;
                    }
                }
            } while (!leaveloop)
        }
    }
    return retlistItems;
}

agendaListbox.deleteItem =
function deleteItem(aItem, aMoveSelection) {
    var isSelected = false;
    var listItems = this.getListItems(aItem);
    if (listItems.length > 0) {
        for (var i = listItems.length - 1; i >= 0; i--) {
            var listItem = listItems[i];
            var isSelected2 = listItem.selected;
            if (isSelected2 && !isSelected) {
                isSelected = true;
                if (aMoveSelection) {
                    this.moveSelection();
                }
            }
            this.agendaListboxControl.removeChild(listItem);
        }
    }
    return isSelected;
}

agendaListbox.isSameEvent =
function isSameEvent(aItem, aCompItem) {
    return ((aItem.id == aCompItem.id) &&
            (aItem[calGetStartDateProp(aItem)].compare(aCompItem[calGetStartDateProp(aCompItem)]) == 0));
}

agendaListbox.isEventSelected =
function isEventSelected() {
    var listItem = this.agendaListboxControl.selectedItem;
    if (listItem) {
        return (this.isEventListItem(listItem));
    }
    return false;
}

agendaListbox.deleteSelectedItem =
function deleteSelectedItem(aDoNotConfirm) {
    var listItem = this.agendaListboxControl.selectedItem;
    if (this.isEventListItem(listItem)) {
        var selectedItems = [listItem.occurrence];
        calendarViewController.deleteOccurrences(selectedItems.length,
                                                 selectedItems,
                                                 false,
                                                 aDoNotConfirm);
    }
}

agendaListbox.createNewEvent =
function createNewEvent(aEvent) {
    if (!this.isEventListItem(aEvent.target)){
        // Create new event for the date currently displayed in the agenda. Setting
        // isDate = true automatically makes the start time be the next full hour.
        var eventStart = agendaListbox.today.start.clone();
        eventStart.isDate = true;
        createEventWithDialog(getSelectedCalendar(), eventStart);
    }
}

agendaListbox.buildAgendaPopupMenu =
function enableAgendaPopupMenu(aPopupMenu){
    var listItem = this.agendaListboxControl.selectedItem;
    var enabled = this.isEventListItem(listItem);
    var popup = document.getElementById("agenda-menu");
    while (popup.hasChildNodes()) {
        popup.removeChild(popup.firstChild);
    }
    var menuitems = document.getElementById("agenda-menu-box").childNodes;
    for (var i= 0; i < menuitems.length; i++) {
        setBooleanAttribute(menuitems[i], "disabled", !enabled);
        popup.appendChild(menuitems[i].cloneNode(true));
    }
    return true;
}


agendaListbox.refreshCalendarQuery =
function refreshCalendarQuery(aStart, aEnd) {
    if (this.mBatchCount > 0) {
        return;
    }
    var pendingRefresh = this.pendingRefresh;
    if (pendingRefresh) {
        if (calInstanceOf(pendingRefresh, Components.interfaces.calIOperation)) {
            this.pendingRefresh = null;
            pendingRefresh.cancel(null);
        } else {
            return;
        }
    }
    if ((!aStart) && (!aEnd)) {
        this.removeListItems();
    }
    if (!aStart) {
        aStart = this.getStart();
    }
    if (!aEnd) {
        aEnd = this.getEnd();
    }
    if (aStart && aEnd) {
        var filter = this.calendar.ITEM_FILTER_CLASS_OCCURRENCES |
                     this.calendar.ITEM_FILTER_TYPE_EVENT;
        this.pendingRefresh = true;
        pendingRefresh = this.calendar.getItems(filter, 0, aStart, aEnd,
                                                this.calendarOpListener);
        if (pendingRefresh && pendingRefresh.isPending) { // support for calIOperation
            this.pendingRefresh = pendingRefresh;
        }
    }
};

agendaListbox.setupCalendar =
function setupCalendar() {
    this.init();
    if (this.calendar == null) {
        this.calendar = getCompositeCalendar();
    }
    if (this.calendar) {
        // XXX This always gets called, does that happen on purpose?
        this.calendar.removeObserver(this.calendarObserver);
    }
    this.calendar.addObserver(this.calendarObserver);
    if (this.mListener){
        this.mListener.updatePeriod();
    }
};

agendaListbox.refreshPeriodDates =
function refreshPeriodDates(newDate) {
     this.kDefaultTimezone = calendarDefaultTimezone();
    // Today: now until midnight of tonight
    var oldshowstoday = this.showstoday;
    this.showstoday = this.showsToday(newDate);
    if ((this.showstoday) && (!oldshowstoday))  {
        this.addPeriodListItem(this.tomorrow, "tomorrow-header");
        this.addPeriodListItem(this.soon, "nextweek-header");
    } else if (!this.showstoday) {
        this.removePeriodListItem(this.tomorrow);
        this.removePeriodListItem(this.soon);
    }
    newDate.isDate = true;
    for (var i = 0; i < this.periods.length; i++) {
        var curPeriod = this.periods[i];
        newDate.hour = newDate.minute = newDate.second = 0;
        if ((i == 0)  && (this.showstoday)){
            curPeriod.start = now();
        } else {
            curPeriod.start = newDate.clone();
        }
        newDate.day += curPeriod.duration;
        curPeriod.end = newDate.clone();
        curPeriod.listItem.setItem(curPeriod, this.showstoday);
    }
    this.refreshCalendarQuery();
};

agendaListbox.addListener =
function addListener(aListener) {
    this.mListener = aListener;
}

agendaListbox.showsToday =
function showsToday(aStartDate) {
    var lstart = aStartDate;
    if (!lstart) {
        lstart = this.today.start;
    }
    var lshowsToday = (sameDay(now(), lstart));
    if (lshowsToday) {
        this.periods = [this.today, this.tomorrow, this.soon];
    } else {
        this.periods = [this.today];
    }
    return lshowsToday;
};

agendaListbox.moveSelection =
function moveSelection() {
    var selindex = this.agendaListboxControl.selectedIndex;
    if ( !this.isEventListItem(this.agendaListboxControl.selectedItem.nextSibling)) {
        this.agendaListboxControl.goUp();
    } else {
        this.agendaListboxControl.goDown();
    }
}

agendaListbox.getSelectedItems =
function getSelectedItems() {
    var selindex = this.agendaListboxControl.selectedIndex;
    var items = [];
    if (this.isEventListItem(this.agendaListboxControl.selectedItem)) {
        // If at some point we support selecting multiple items, this array can
        // be expanded.
        items = [this.agendaListboxControl.selectedItem.occurrence];
    }
    return items;
}

agendaListbox.isEventListItem =
function isEventListItem(aListItem) {
    var isEventListItem = (aListItem != null);
    if (isEventListItem) {
        var localName = aListItem.localName;
        isEventListItem = ((localName ==  "agenda-richlist-item") ||
                          (localName ==  "agenda-allday-richlist-item"));
    }
    return isEventListItem;
}

agendaListbox.removeListItems =
function removeListItems() {
    var listItem = this.agendaListboxControl.lastChild;
    if (listItem) {
        var leaveloop = false;
        do {
            var newlistItem = null;
            if (listItem) {
                newlistItem = listItem.previousSibling;
            } else {
                leaveloop = true;
            }
            if (this.isEventListItem(listItem)) {
                if (!listItem.isSameNode(this.agendaListboxControl.firstChild)) {
                    this.agendaListboxControl.removeChild(listItem);
                } else {
                    leaveloop = true;
                }
            }
            listItem = newlistItem;
        } while (!leaveloop)
    }
}

agendaListbox.getListItemByHashId =
function getListItemByHashId(ahashId) {
    var listItem = this.agendaListboxControl.firstChild;
    var leaveloop = false;
    do {
        if (this.isEventListItem(listItem)) {
            if (listItem.occurrence.hashId == ahashId) {
                return listItem;
            }
        }
        listItem = listItem.nextSibling;
        leaveloop = (listItem == null);
    } while (!leaveloop)
    return null;
}

agendaListbox.calendarOpListener = {
    agendaListbox : agendaListbox
};

agendaListbox.calendarOpListener.onOperationComplete =
function listener_onOperationComplete(calendar, status, optype, id,
                                      detail) {
    // signal that the current operation finished.
    this.agendaListbox.pendingRefresh = null;
    setCurrentEvent();
};

agendaListbox.calendarOpListener.onGetResult =
function listener_onGetResult(calendar, status, itemtype, detail, count, items) {
    if (!Components.isSuccessCode(status))
        return;
    items.forEach(this.agendaListbox.addItem, this.agendaListbox);
};

agendaListbox.calendarObserver = {
    agendaListbox : agendaListbox
};

agendaListbox.calendarObserver.QueryInterface =
function agenda_QI(aIID) {
    if (!aIID.equals(Components.interfaces.calIObserver) &&
        !aIID.equals(Components.interfaces.calICompositeObserver) &&
        !aIID.equals(Components.interfaces.nsISupports)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
};

// calIObserver:
agendaListbox.calendarObserver.onStartBatch = function agenda_onBatchStart() {
    this.mBatchCount++;
};

agendaListbox.calendarObserver.onEndBatch =
function() {
    this.mBatchCount--;
    if (this.mBatchCount == 0) {
        // Rebuild everything
        this.agendaListbox.refreshCalendarQuery();
    }
};

agendaListbox.calendarObserver.onLoad = function() {
    this.agendaListbox.refreshCalendarQuery();
};

agendaListbox.calendarObserver.onAddItem =
function observer_onAddItem(item)
{
  if (this.mBatchCount) {
      return;
  }
  if (!isEvent(item)) {
      return;
  }
// get all sub items if it is a recurring item
  var occs = this.getOccurrencesBetween(item);
  occs.forEach(this.agendaListbox.addItem, this.agendaListbox);
  setCurrentEvent();
};

agendaListbox.calendarObserver.getOccurrencesBetween =
function getOccurrencesBetween(aItem) {
    var occs = [];
    var start = this.agendaListbox.getStart();
    var end = this.agendaListbox.getEnd();
    if (start && end) {
        occs = aItem.getOccurrencesBetween(start, end, {});
    }
    return occs;
}

agendaListbox.calendarObserver.onDeleteItem =
function observer_onDeleteItem(item, rebuildFlag) {
    this.onLocalDeleteItem(item, true);
};

agendaListbox.calendarObserver.onLocalDeleteItem =
function observer_onLocalDeleteItem(item, moveSelection) {
    if (this.mBatchCount) {
      return false;
    }
    if (!isEvent(item)) {
        return false;
    }
    var selectedItemHashId = -1;
// get all sub items if it is a recurring item
    var occs = this.getOccurrencesBetween(item);
    for (var i = 0; i < occs.length; i++) {
        var isSelected = this.agendaListbox.deleteItem(occs[i], moveSelection);
        if (isSelected) {
            selectedItemHashId = occs[i].hashId;
        }
    }
    return selectedItemHashId;
};

agendaListbox.calendarObserver.onModifyItem =
function observer_onModifyItem(newItem, oldItem) {
    if (this.mBatchCount) {
        return;
    }
    var selectedItemHashId = this.onLocalDeleteItem(oldItem, false);
    if (!isEvent(newItem)) {
        return;
    }
    this.onAddItem(newItem);
    if (selectedItemHashId != -1) {
        var listItem = agendaListbox.getListItemByHashId(selectedItemHashId);
        if (listItem) {
            agendaListbox.agendaListboxControl.clearSelection();
            agendaListbox.agendaListboxControl.ensureElementIsVisible(listItem);
            agendaListbox.agendaListboxControl.selectedItem = listItem;
        }
    }
    setCurrentEvent();
};

agendaListbox.calendarObserver.onError = function(cal, errno, msg) {};

agendaListbox.calendarObserver.onPropertyChanged = function(aCalendar, aName, aValue, aOldValue) {
    switch (aName) {
        case "disabled":
            this.agendaListbox.refreshCalendarQuery();
            break;
        case "color":
            for (var node = agendaListbox.agendaListboxControl.firstChild;
                 node;
                 node = node.nextSibling) {
                // Change color on all nodes that don't do so themselves, which
                // is currently only he agenda-richlist-item
                if (node.localName != "agenda-richlist-item") {
                    continue;
                }
                node.refreshColor();
            }
            break;
    }
};

agendaListbox.calendarObserver.onPropertyDeleting = function(aCalendar, aName) {
    this.onPropertyChanged(aCalendar, aName, null, null);
};


agendaListbox.calendarObserver.onCalendarRemoved =
function agenda_calRemove(aCalendar) {
    this.agendaListbox.refreshCalendarQuery();
};

agendaListbox.calendarObserver.onCalendarAdded =
function agenda_calAdd(aCalendar) {
    this.agendaListbox.refreshCalendarQuery();
};

agendaListbox.calendarObserver.onDefaultCalendarChanged = function(aCalendar) {
};

function setCurrentEvent() {
    if (agendaListbox.showsToday() && agendaListbox.today.open) {

        var msScheduleTime = -1;
        var complistItem = agendaListbox.tomorrow.listItem.previousSibling;
        var removelist = [];
        var anow = now();
        var msuntillend = 0;
        var msuntillstart = 0;
        do {
            var leaveloop = (!agendaListbox.isEventListItem(complistItem));
            if (!leaveloop) {
                msuntillstart =  complistItem.occurrence.startDate
                                .getInTimezone(agendaListbox.kDefaultTimezone)
                                .subtractDate(anow).inSeconds;
                if (msuntillstart <= 0) {
                    var msuntillend = complistItem.occurrence.endDate
                                        .getInTimezone(agendaListbox.kDefaultTimezone)
                                        .subtractDate(anow).inSeconds;
                    if (msuntillend >= 0) {
                        complistItem.setAttribute("current", "true");
                        if ((msuntillend < msScheduleTime)  || (msScheduleTime == -1)){
                            msScheduleTime = msuntillend;
                        }
                    } else {
                         removelist.push(complistItem);
                    }
                } else {
                    complistItem.removeAttribute("current");
                }
                if ((msScheduleTime == -1) || (msuntillstart < msScheduleTime)) {
                    if (msuntillstart > 0) {
                        msScheduleTime = msuntillstart;
                    }
                }
            }
            if (!leaveloop) {
                complistItem = complistItem.previousSibling;
            }
        } while (!leaveloop)
        if (msScheduleTime > -1) {
            scheduleNextCurrentEventUpdate(setCurrentEvent, msScheduleTime * 1000);
        }
    }
    if (removelist) {
      if (removelist.length > 0) {
          for (var i = 0;i < removelist.length; i++) {
              agendaListbox.agendaListboxControl.removeChild(removelist[i]);
          }
      }
    }
}

var gEventTimer;

/** Creates a timer that will fire after the next event is current.
    Pass in a function as
 * aRefreshCallback that should be called at that time.
 */
function scheduleNextCurrentEventUpdate(aRefreshCallback, aMsUntill) {

    // Is an nsITimer/callback extreme overkill here? Yes, but it's necessary to
    // workaround bug 291386.  If we don't, we stand a decent chance of getting
    // stuck in an infinite loop.
    var udCallback = {
        notify: function(timer) {
            aRefreshCallback();
        }
    };

    if (!gEventTimer) {
        // Observer for wake after sleep/hibernate/standby to create new timers and refresh UI
        var wakeObserver = {
           observe: function(aSubject, aTopic, aData) {
               if (aTopic == "wake_notification") {
                   aRefreshCallback();
               }
           }
        };
        // Add observer
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                        .getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(wakeObserver, "wake_notification", false);

        // Remove observer on unload
        window.addEventListener("unload",
                                function() {
                                    observerService.removeObserver(wakeObserver, "wake_notification");
                                }, false);

        gEventTimer = Components.classes["@mozilla.org/timer;1"]
                                   .createInstance(Components.interfaces.nsITimer);
    } else {
        gEventTimer.cancel();
    }
    gEventTimer.initWithCallback(udCallback, aMsUntill, gEventTimer.TYPE_ONE_SHOT);
}
