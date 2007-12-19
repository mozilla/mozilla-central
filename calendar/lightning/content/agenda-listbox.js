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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Berend Cornelius <berend.cornelius@sun.com>
 *   Mike Shaver <shaver@mozilla.org>
 *   Vladimir Vukicevic <vladimir@pobox.com>
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
 *   Stefan Sitter <ssitter@googlemail.com>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   gekacheka@yahoo.com
 *   richard@duif.net
 *   Matthew Willis <mattwillis@gmail.com>
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
    eventlistItem: null,
    newalldayeventlistItem: null,
    kDefaultTimezone: null,
    showsToday: false
};

agendaListbox.init =
function initAgendaListbox() {
    this.agendaListboxControl = document.getElementById("agenda-listbox");
    this.agendaListboxControl.removeAttribute("suppressonselect");
    this.newalldayeventlistItem = document.getElementById("richlistitem-container").firstChild;
    this.eventlistItem = this.newalldayeventlistItem.nextSibling;
    this.today = new Synthetic(true, 1);
    this.addPeriodlistItem(this.today, "today-header");
    this.tomorrow = new Synthetic(false, 1);
    this.soon = new Synthetic(false, 5);
    this.periods = [this.today, this.tomorrow, this.soon];
};

agendaListbox.addPeriodlistItem =
function addPeriodlistItem(aPeriod, aItemId) {
    aPeriod.listItem = document.getElementById(aItemId).cloneNode(true);
    agendaListbox.agendaListboxControl.appendChild(aPeriod.listItem);
    aPeriod.listItem.getCheckbox().setChecked(aPeriod.open);
    aPeriod.listItem.getCheckbox().addEventListener("CheckboxStateChange", this.onCheckboxChange, true);
}

agendaListbox.removePeriodlistItem =
function removePeriodlistItem(aPeriod) {
    if (aPeriod.listItem) {
        this.agendaListboxControl.removeChild(aPeriod.listItem);
        aPeriod.listItem = null;
    }
}

agendaListbox.onCheckboxChange =
function onCheckboxChange(event) {
    var periodCheckbox = event.target;
    var lopen = (periodCheckbox.getAttribute("checked") == "true");
    var listItem = getParentNode(periodCheckbox, "agenda-checkbox-richlist-item");
    var period = listItem.getItem();
    period.open= lopen;
    if (lopen) {
        agendaListbox.refreshCalendarQuery(period.start, period.end);
    } else {
        listItem = listItem.nextSibling;
        do {
            var leaveloop = (listItem == null);
            if (!leaveloop) {
                var nextItemSibling = listItem.nextSibling;
                leaveloop = (!agendaListbox.isEventlistItem(listItem));
                if (!leaveloop) {
                    agendaListbox.agendaListboxControl.removeChild(listItem);
                    listItem = nextItemSibling;
                }
            }
        } while (!leaveloop);
    }
};

agendaListbox.onSelect =
function onSelect() {
    var listbox = document.getElementById("agenda-listbox");
    listbox.focus();
    listbox.removeAttribute("disabled");
    var item  = listbox.selectedItem;
    if (item) {
        item.selected = true;
        item.removeAttribute("disabled");
    }
}

agendaListbox.onFocus =
function onFocus() {
    var listbox = document.getElementById("agenda-listbox");
    listbox.removeAttribute("disabled");
    this.enablelistItems();
}

agendaListbox.onBlur =
function onBlur() {
    var item  = document.getElementById("agenda-listbox").selectedItem;
    if (item) {
        item.setAttribute("disabled","true");
    }
}

agendaListbox.enablelistItems =
function enablelistItems() {
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
            createNewEvent();
            break;
        case aEvent.DOM_VK_DELETE:
            document.getElementById('agenda_delete_event_command').doCommand();
            aEvent.stopPropagation();
            aEvent.preventDefault();
            break;
        case aEvent.DOM_VK_LEFT:
            if (!this.isEventlistItem(listItem)) {
                listItem.getCheckbox().setChecked(false);
            }
            break;
        case aEvent.DOM_VK_RIGHT:
            if (!this.isEventlistItem(listItem)) {
                listItem.getCheckbox().setChecked(true);
            }
            break;
    }
}

agendaListbox.editSelectedItem =
function editSelectedItem(aEvent) {
    var listItem  = document.getElementById("agenda-listbox").selectedItem;
    if (agendaListbox.isEventlistItem(listItem)) {
        this.callModifyEventDialog(null, listItem.getItem());
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
        newelement = this.newalldayeventlistItem.cloneNode(true);
    } else {
       newelement = this.eventlistItem.cloneNode(true);
    }
    // set the item at the richlistItem. When the duration of the period
    // is bigger than 1 (day) the starttime of the item has to include
    // information about the day of the item
    if (aAgendaItem == null) {
        this.agendaListboxControl.appendChild(newelement);
    } else {
        this.agendaListboxControl.insertBefore(newelement, aAgendaItem);
    }
    newelement.setItem(aNewItem, (aPeriod.duration > 1));
    newelement.removeAttribute("selected");
    return newelement;
}

agendaListbox.addItem =
function addItem(aItem) {
    if (!isEvent(aItem)) {
        return;
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
            if (this.getlistItems(aItem, period).length == 0) {
                this.addItemBefore(aItem, period.listItem.nextSibling, period, visible);
            }
        } else {
            do {
                var prevlistItem = complistItem;
                var complistItem = complistItem.nextSibling;
                if (!this.isEventlistItem(complistItem)) {
                    newlistItem = this.addItemBefore(aItem, complistItem, period, visible);
                    break;
                } else {
                    var compitem = complistItem.getItem();
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


agendaListbox.getlistItems =
function getlistItems(aItem, aPeriod) {
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
                var leaveloop = (!this.isEventlistItem(complistItem));
                if (!leaveloop) {
                    if (this.isSameEvent(aItem, complistItem.getItem())){
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
function deleteItem(aItem) {
    var isSelected = false;
    var listItems = this.getlistItems(aItem);
    if (listItems.length > 0) {
        for (var i = listItems.length - 1; i >= 0; i--) {
            var listItem = listItems[i];
            isSelected = listItem.selected;
            if (isSelected) {
                this.moveSelection();
            }
            if ((!this.isEventlistItem(listItem.previousSibling)) &&
                (!this.isEventlistItem(listItem.nextSibling))) {
                var prevlistItem = listItem.previousSibling;
                this.agendaListboxControl.removeChild(listItem);
                prevlistItem.getCheckbox().setChecked(false);
            } else {
                this.agendaListboxControl.removeChild(listItem);
            }
        }
    }
    return isSelected;
}

agendaListbox.isSameEvent =
function isSameEvent(aItem, aCompItem) {
    return ((aItem.id == aCompItem.id) &&
            (calGetStartDate(aItem).compare(calGetStartDate(aCompItem)) == 0));
}

agendaListbox.deleteSelectedItem =
function deleteSelectedItem(aDoNotConfirm) {
    var listItem = this.agendaListboxControl.selectedItem;
    var selectedItems = [listItem.getItem()];
    if (this.isEventlistItem(listItem)) {
        calendarViewController.deleteOccurrences(selectedItems.length,
                                                 selectedItems,
                                                 false,
                                                 aDoNotConfirm);
    }
}

agendaListbox.createNewEvent =
function createNewEvent(aEvent) {
    if (aEvent.target instanceof Components.interfaces.nsIDOMXULSelectControlItemElement) {
        return;
    }
    var eventStart = now();
    eventStart.day = this.today.start.day;
    eventStart.minute = eventStart.second = 0;
    var eventEnd = eventStart.clone();
    eventEnd.hour++;
    createEventWithDialog(getSelectedCalendar(), eventStart, eventEnd)
}

agendaListbox.buildAgendaPopupMenu =
function enableAgendaPopupMenu(aPopupMenu){
    var listItem = this.agendaListboxControl.selectedItem;
    var enabled = this.isEventlistItem(listItem);
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
    var pendingRefresh = this.pendingRefresh;
    if (pendingRefresh) {
        if (pendingRefresh instanceof Components.interfaces.calIOperation) {
            this.pendingRefresh = null;
            pendingRefresh.cancel(null);
        } else {
            return;
        }
    }
    if ((!aStart) && (!aEnd)) {
        this.removelistItems();
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
        this.addPeriodlistItem(this.tomorrow, "tomorrow-header");
        this.addPeriodlistItem(this.soon, "nextweek-header");
    } else if (!this.showstoday) {
        this.removePeriodlistItem(this.tomorrow);
        this.removePeriodlistItem(this.soon);
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
    this.periods[0].listItem.getCheckbox().setChecked(true);
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

agendaListbox.callModifyEventDialog =
function callModifyEventDialog(aEvent, aItem) {
    // We only care about left-clicks
    if (aEvent) {
        if (aEvent.button != 0) {
            return;
        }
    }
    if (!aItem) {
        createEventWithDialog(this.calendar, this.today.start, this.today.start);
        return;
    } else {
        modifyEventWithDialog(aItem);
    }
}

agendaListbox.moveSelection =
function moveSelection() {
    var selindex = this.agendaListboxControl.selectedIndex;
    if ( !this.isEventlistItem(this.agendaListboxControl.selectedItem.nextSibling)) {
        this.agendaListboxControl.goUp();
    } else {
        this.agendaListboxControl.goDown();
    }
}

agendaListbox.isEventlistItem =
function isEventlistItem(aListItem) {
    var isEventlistItem = (aListItem != null);
    if (isEventlistItem) {
        var localName = aListItem.localName;
        isEventlistItem = ((localName ==  "agenda-richlist-item") ||
                          (localName ==  "agenda-allday-richlist-item"));
    }
    return isEventlistItem;
}

agendaListbox.removelistItems =
function removelistItems() {
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
            if (this.isEventlistItem(listItem)) {
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
  var occs = item.getOccurrencesBetween(this.agendaListbox.getStart(),
                                        this.agendaListbox.getEnd(), {});
  occs.forEach(this.agendaListbox.addItem, this.agendaListbox);
  setCurrentEvent();
};

agendaListbox.calendarObserver.onDeleteItem =
function observer_onDeleteItem(item, rebuildFlag) {
    this.onLocalDeleteItem(item, rebuildFlag);
};

agendaListbox.calendarObserver.onLocalDeleteItem =
function observer_onLocalDeleteItem(item, rebuildFlag) {
    if (this.mBatchCount) {
      return;
    }
    if (!isEvent(item)) {
        return;
    }
    var isSelected = false;
// get all sub items if it is a recurring item
    var occs = item.getOccurrencesBetween(this.agendaListbox.getStart(),
                                          this.agendaListbox.getEnd(), {});
    occs.forEach(isSelected = this.agendaListbox.deleteItem, this.agendaListbox);
    return isSelected;
};

agendaListbox.calendarObserver.onModifyItem =
function observer_onModifyItem(newItem, oldItem) {
    if (this.mBatchCount) {
        return;
    }
    var isItemSelected = this.onLocalDeleteItem(oldItem);
    if (!isEvent(newItem)) {
        return;
    }
    this.onAddItem(newItem);
    var newlistItems = agendaListbox.getlistItems(newItem);
    if ((newlistItems) && (newlistItems.length > 0) && (isItemSelected)) {
        var periods = agendaListbox.findPeriodsForItem(newlistItems[0].getItem());
        if (!periods || periods.length == 0) {
            return;
        }
        agendaListbox.agendaListboxControl.clearSelection();
        newlistItems[0].selected = true;
        agendaListbox.agendaListboxControl.ensureElementIsVisible(newlistItems[0]);
    }
  setCurrentEvent();
};

agendaListbox.calendarObserver.onError = function(errno, msg) {};

agendaListbox.calendarObserver.onPropertyChanged = function(aCalendar, aName, aValue, aOldValue) {};

agendaListbox.calendarObserver.onPropertyDeleting = function(aCalendar, aName) {};


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
            var leaveloop = (!agendaListbox.isEventlistItem(complistItem));
            if (!leaveloop) {
                msuntillstart =  complistItem.getItem().startDate
                                .getInTimezone(agendaListbox.kDefaultTimezone)
                                .subtractDate(anow).inSeconds;
                if (msuntillstart <= 0) {
                    var msuntillend = complistItem.getItem().endDate
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
