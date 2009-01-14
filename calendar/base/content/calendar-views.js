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
 * The Original Code is Calendar views code
 *
 * The Initial Developer of the Original Code is
 *   the Mozilla Calendar Squad
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Joey Minta <jminta@gmail.com>
 *   Michael Buettner <michael.buettner@sun.com>
 *   gekacheka@yahoo.com
 *   Matthew Willis <lilmatt@mozilla.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
 *   Berend Cornelius <berend.cornelius@sun.com>
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

var calendarViewController = {
    QueryInterface: function(aIID) {
        if (!aIID.equals(Components.interfaces.calICalendarViewController) &&
            !aIID.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        return this;
    },

    createNewEvent: function (aCalendar, aStartTime, aEndTime, aForceAllday) {
        aCalendar = aCalendar || getSelectedCalendar();

        // if we're given both times, skip the dialog
        if (aStartTime && aEndTime && !aStartTime.isDate && !aEndTime.isDate) {
            var event = createEvent();
            event.startDate = aStartTime;
            event.endDate = aEndTime;
            var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                .getService(Components.interfaces.nsIStringBundleService);
            var props = sbs.createBundle("chrome://calendar/locale/calendar.properties");
            event.title = props.GetStringFromName("newEvent");
            setDefaultAlarmValues(event);
            doTransaction('add', event, aCalendar, null, null);
        } else {
            createEventWithDialog(aCalendar, aStartTime, null, null, null, aForceAllday);
        }
    },

    pendingJobs: [],

    // in order to initiate a modification for the occurrence passed as argument
    // we create an object that records the necessary details and store it in an
    // internal array ('pendingJobs'). this way we're in a position to terminate
    // any pending modification if need should be.
    createPendingModification: function (aOccurrence) {
        // finalize a (possibly) pending modification. this will notify
        // an open dialog to save any outstanding modifications.
        aOccurrence = this.finalizePendingModification(aOccurrence);

        // XXX TODO logic to ask for which occurrence to modify is currently in
        // modifyEventWithDialog, since the type of transactions done depend on
        // this. This in turn makes the aOccurrence here be potentially wrong, I
        // haven't seen it used anywhere though.
        var pendingModification = {
            controller: this,
            item: aOccurrence,
            finalize: null,
            dispose: function() {
                var array = this.controller.pendingJobs;
                for (var i=0; i<array.length; i++) {
                    if (array[i] == this) {
                        array.splice(i,1);
                        break;
                    }
                }
            }
        }

        this.pendingJobs.push(pendingModification);

        modifyEventWithDialog(aOccurrence, pendingModification, true);
    },

    // iterate the list of pending modifications and see if the occurrence
    // passed as argument is currently about to be modified (event dialog is
    // open with the item in question). if this should be the case we call
    // finalize() in order to bring the dialog down and avoid dataloss.
    finalizePendingModification: function (aOccurrence) {

      for each (var job in this.pendingJobs) {
          var item = job.item;
          var parent = item.parent;
          if ((item.hashId == aOccurrence.hashId) ||
              (item.parentItem.hashId == aOccurrence.hashId) ||
              (item.hashId == aOccurrence.parentItem.hashId)) {
              // terminate() will most probably create a modified item instance.
              aOccurrence = job.finalize();
              break;
        }
      }

      return aOccurrence;
    },

    modifyOccurrence: function (aOccurrence, aNewStartTime, aNewEndTime, aNewTitle) {

        aOccurrence = this.finalizePendingModification(aOccurrence);

        // if modifying this item directly (e.g. just dragged to new time),
        // then do so; otherwise pop up the dialog
        if (aNewStartTime || aNewEndTime || aNewTitle) {
            var instance = aOccurrence.clone();

            if (aNewTitle) {
                instance.title = aNewTitle;
            }

            // When we made the executive decision (in bug 352862) that
            // dragging an occurrence of a recurring event would _only_ act
            // upon _that_ occurrence, we removed a bunch of code from this
            // function. If we ever revert that decision, check CVS history
            // here to get that code back.

            if (aNewStartTime || aNewEndTime) {
                // Yay for variable names that make this next line look silly
                if (isEvent(instance)) {
                    if (aNewStartTime && instance.startDate) {
                        instance.startDate = aNewStartTime;
                    }
                    if (aNewEndTime && instance.endDate) {
                        instance.endDate = aNewEndTime;
                    }
                } else {
                    if (aNewStartTime && instance.entryDate) {
                        instance.entryDate = aNewStartTime;
                    }
                    if (aNewEndTime && instance.dueDate) {
                        instance.dueDate = aNewEndTime;
                    }
                }
            }

            doTransaction('modify', instance, instance.calendar, aOccurrence, null);
        } else {
            this.createPendingModification(aOccurrence);
        }
    },

    deleteOccurrences: function (aCount,
                                 aOccurrences,
                                 aUseParentItems,
                                 aDoNotConfirm) {
        startBatchTransaction();
        var recurringItems = {};

        function getSavedItem(aItemToDelete) {
            // Get the parent item, saving it in our recurringItems object for
            // later use.
            var hashVal = aItemToDelete.parentItem.hashId;
            if (!recurringItems[hashVal]) {
                recurringItems[hashVal] = {
                    oldItem: aItemToDelete.parentItem,
                    newItem: aItemToDelete.parentItem.clone()
                };
            }
            return recurringItems[hashVal];
        }

        // Make sure we are modifying a copy of aOccurrences, otherwise we will
        // run into race conditions when the view's doDeleteItem removes the
        // array elements while we are iterating through them. While we are at
        // it, filter out any items that have readonly calendars, so that
        // checking for one total item below also works out if all but one item
        // are readonly.
        var occurrences = aOccurrences.filter(function(item) { return isCalendarWritable(item.calendar); });

        for each (var itemToDelete in occurrences) {
            if (aUseParentItems) {
                // Usually happens when ctrl-click is used. In that case we
                // don't need to ask the user if he wants to delete an
                // occurrence or not.
                itemToDelete = itemToDelete.parentItem;
            } else if (!aDoNotConfirm && occurrences.length == 1) {
                // Only give the user the selection if only one occurrence is
                // selected. Otherwise he will get a dialog for each occurrence
                // he deletes.
                var [itemToDelete, hasFutureItem, response] = promptOccurrenceModification(itemToDelete, false, "delete");
                if (!response) {
                    // The user canceled the dialog, bail out
                    break;
                }
            }

            // Now some dirty work: Make sure more than one occurrence can be
            // deleted by saving the recurring items and removing occurrences as
            // they come in. If this is not an occurrence, we can go ahead and
            // delete the whole item.
            itemToDelete = this.finalizePendingModification(itemToDelete);
            if (itemToDelete.parentItem.hashId != itemToDelete.hashId) {
                var savedItem = getSavedItem(itemToDelete);
                savedItem.newItem.recurrenceInfo
                         .removeOccurrenceAt(itemToDelete.recurrenceId);
                // Dont start the transaction yet. Do so later, in case the
                // parent item gets modified more than once.
            } else {
                doTransaction('delete', itemToDelete, itemToDelete.calendar, null, null);
            }
        }

        // Now handle recurring events. This makes sure that all occurrences
        // that have been passed are deleted.
        for each (var ritem in recurringItems) {
            doTransaction('modify',
                          ritem.newItem,
                          ritem.newItem.calendar,
                          ritem.oldItem,
                          null);
        }
        endBatchTransaction();
    }
};

/**
 * This function provides a neutral way to switch between views.
 * XXX Kind of confusing. This function calls the app specific function, which
 * again calls the common switchToView function. They should be consolidated in
 * a different bug.
 */
function showCalendarView(type, event) {
    if (isSunbird()) {
        sbSwitchToView(type, event);
    } else if (document.getElementById('switch2calendar').getAttribute('checked')) {
        ltnShowCalendarView(type, event);
    }
    onCalendarViewResize(event);
}

/**
 * This function acts like the above, but does not bring the view to the front
 * if the application is showing other elements (i.e Lightning).
 */
function selectCalendarView(type) {
    if (isSunbird()) {
        sbSwitchToView(type);
    } else {
        ltnSelectCalendarView(type);
    }
}

/**
 * This function does the common steps to switch between views. Should be called
 * from app-specific view switching functions
 */
function switchToView(aViewType) {
    var viewDeck = getViewDeck();
    var selectedDay;
    var currentSelection = [];

    // Set up the view commands
    var views = viewDeck.childNodes;
    for (var i = 0; i < views.length; i++) {
        var view = views[i];
        var commandId = "calendar_" + view.id + "_command";
        var command = document.getElementById(commandId);
        if (view.id == aViewType + "-view") {
            command.setAttribute("checked", "true");
            document.getElementById("calendar-nav-control").setAttribute("selectedIndex", i);
        } else {
            command.removeAttribute("checked");
        }
    }

    // Set the labels for the context-menu
    var nextCommand = document.getElementById("calendar-view-context-menu-next");
    nextCommand.setAttribute("label", nextCommand.getAttribute("label-"+aViewType));
    var previousCommand = document.getElementById("calendar-view-context-menu-previous")
    previousCommand.setAttribute("label", previousCommand.getAttribute("label-"+aViewType));

    // Disable the menuitem when not in day or week view.
    var rotated = document.getElementById("calendar_toggle_orientation_command");
    if (aViewType == "day" || aViewType == "week") {
        rotated.removeAttribute("disabled");
    } else {
        rotated.setAttribute("disabled", "true");
    }

    try {
        selectedDay = viewDeck.selectedPanel.selectedDay;
        currentSelection = viewDeck.selectedPanel.getSelectedItems({});
    } catch (ex) {
        // This dies if no view has even been chosen this session, but that's
        // ok because we'll just use now() below.
    }

    if (!selectedDay) {
        selectedDay = now();
    }

    // Anyone wanting to plug in a view needs to follow this naming scheme
    var view = document.getElementById(aViewType + "-view");
    viewDeck.selectedPanel = view;

    var compositeCal = getCompositeCalendar();
    if (view.displayCalendar != compositeCal) {
        view.displayCalendar = compositeCal;
        view.timezone = calendarDefaultTimezone();
        view.controller = calendarViewController;
    }

    view.goToDay(selectedDay);
    view.setSelectedItems(currentSelection.length, currentSelection);
}

/**
 * Returns the calendar view deck.
 */
function getViewDeck() {
    return document.getElementById("view-deck");
}

/**
 * Returns the currently visible calendar view.
 */
function currentView() {
    return getViewDeck().selectedPanel;
}

/**
 * Returns the selected day in the views in a app (Sunbird vs. Lightning)
 * neutral way
 */
function getSelectedDay() {
    return currentView().selectedDay;
}

var gMidnightTimer;

/** Creates a timer that will fire after midnight.  Pass in a function as
 * aRefreshCallback that should be called at that time.
 */
function scheduleMidnightUpdate(aRefreshCallback) {
    var jsNow = new Date();
    var tomorrow = new Date(jsNow.getFullYear(), jsNow.getMonth(), jsNow.getDate() + 1);
    var msUntilTomorrow = tomorrow.getTime() - jsNow.getTime();

    // Is an nsITimer/callback extreme overkill here? Yes, but it's necessary to
    // workaround bug 291386.  If we don't, we stand a decent chance of getting
    // stuck in an infinite loop.
    var udCallback = {
        notify: function(timer) {
            aRefreshCallback();
        }
    };

    if (!gMidnightTimer) {
        // Observer for wake after sleep/hibernate/standby to create new timers and refresh UI
        var wakeObserver = {
           observe: function(aSubject, aTopic, aData) {
               if (aTopic == "wake_notification") {
                   // postpone refresh for another couple of seconds to get netwerk ready:
                   if (this.mTimer) {
                       this.mTimer.cancel();
                   } else {
                       this.mTimer = Components.classes["@mozilla.org/timer;1"]
                                               .createInstance(Components.interfaces.nsITimer);
                   }
                   this.mTimer.initWithCallback(udCallback, 10 * 1000,
                                                Components.interfaces.nsITimer.TYPE_ONE_SHOT);
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
        gMidnightTimer = Components.classes["@mozilla.org/timer;1"]
                                   .createInstance(Components.interfaces.nsITimer);
    } else {
        gMidnightTimer.cancel();
    }
    gMidnightTimer.initWithCallback(udCallback, msUntilTomorrow, gMidnightTimer.TYPE_ONE_SHOT);
}

// Returns the actual style sheet object with the specified path.  Callers are
// responsible for any caching they may want to do.
function getStyleSheet(aStyleSheetPath) {
    for each (var sheet in document.styleSheets) {
        if (sheet.href == aStyleSheetPath) {
            return sheet;
        }
    }
    // Avoid the js strict "function does not always return a value" warning.
    return null;
}

/**
 * Updates the style rules for a particular object.  If the object is a
 * category (and hence doesn't have a uri), we set the category bar color.
 * If it's a calendar, we set the background color and contrasting text color.
 * @param aObject either a calendar (with a .uri), or the category color
 * pref key suffix [the non-unicode part after "calendar.category.color.",
 * equivalent to formatStringForCSSRule(categoryNameInUnicode)].
 */
function updateStyleSheetForObject(aObject, aSheet) {
    var selectorPrefix, name, ruleUpdaterFunc, classPrefix;
    if (aObject.uri) {
        // For a calendar, set background and contrasting text colors
        name = aObject.uri.spec;
        classPrefix = ".calendar-color-box";
        selectorPrefix = "item-calendar=";
        ruleUpdaterFunc = function calendarRuleFunc(aRule, aIndex) {
            var color = aObject.getProperty('color');
            if (!color) {
                color = "#A8C2E1";
            }
            aRule.style.backgroundColor = color;
            aRule.style.color = getContrastingTextColor(color);
        };
    } else {
        // For a category, set the category bar color.  Also note that
        // it uses the ~= selector, since there could be multiple categories.
        name = aObject;
        selectorPrefix = "categories~=";
        classPrefix = ".category-color-box"
        ruleUpdaterFunc = function categoryRuleFunc(aRule, aIndex) {
            var color = getPrefSafe("calendar.category.color."+name, null);
            if (color) {
                aRule.style.backgroundColor = color;
            } else {
                aSheet.deleteRule(aIndex);
            }
        };
    }

    var selector = classPrefix + '[' + selectorPrefix + '"' + name + '"]';

    // Now go find our rule
    var rule, ruleIndex;
    for (var i = 0; i < aSheet.cssRules.length; i++) {
        var maybeRule = aSheet.cssRules[i];
        if (maybeRule.selectorText && (maybeRule.selectorText == selector)) {
            rule = maybeRule;
            ruleIndex = i;
            break;
        }
    }

    if (!rule) {
        aSheet.insertRule(selector + ' { }', aSheet.cssRules.length);
        rule = aSheet.cssRules[aSheet.cssRules.length-1];
    }

    ruleUpdaterFunc(rule, ruleIndex);
}

/**
 *  Sets the selected day in the minimonth to the currently selected day
 *  in the embedded view.
 */
function observeViewDaySelect(event) {
    var date = event.detail;
    var jsDate = new Date(date.year, date.month, date.day);

    // for the month and multiweek view find the main month,
    // which is the month with the most visible days in the view;
    // note, that the main date is the first day of the main month
    var jsMainDate;
    if (!event.originalTarget.supportsDisjointDates) {
        var mainDate = null;
        var maxVisibleDays = 0;
        var startDay = currentView().startDay;
        var endDay = currentView().endDay;
        var firstMonth = startDay.startOfMonth;
        var lastMonth = endDay.startOfMonth;
        for (var month = firstMonth.clone(); month.compare(lastMonth) <= 0; month.month += 1) {
            var visibleDays = 0;
            if (month.compare(firstMonth) == 0) {
                visibleDays = startDay.endOfMonth.day - startDay.day + 1;
            } else if (month.compare(lastMonth) == 0) {
                visibleDays = endDay.day;
            } else {
                visibleDays = month.endOfMonth.day;
            }
            if (visibleDays > maxVisibleDays) {
                mainDate = month.clone();
                maxVisibleDays = visibleDays;
            }
        }
        jsMainDate = new Date(mainDate.year, mainDate.month, mainDate.day);
    }

    getMinimonth().selectDate(jsDate, jsMainDate);
    currentView().focus();
}

/** Provides a neutral way to get the minimonth, regardless of whether we're in
 * Sunbird or Lightning.
 */
function getMinimonth() {
    return document.getElementById("calMinimonth");
}

/**
 * Update the view orientation based on the checked state of the command
 */
function toggleOrientation() {
    var cmd = document.getElementById("calendar_toggle_orientation_command");
    var newValue = (cmd.getAttribute("checked") == "true" ? "false" : "true");
    cmd.setAttribute("checked", newValue);

    var deck = getViewDeck();
    for each (var view in deck.childNodes) {
        view.rotated = (newValue == "true");
    }

    // orientation refreshes automatically
}

/**
 * Toggle the workdays only checkbox and refresh the current view
 */
function toggleWorkdaysOnly() {
    var cmd = document.getElementById("calendar_toggle_workdays_only_command");
    var newValue = (cmd.getAttribute("checked") == "true" ? "false" : "true");
    cmd.setAttribute("checked", newValue);

    var deck = getViewDeck();
    for each (var view in deck.childNodes) {
        view.workdaysOnly = (newValue == "true");
    }

    // Refresh the current view
    currentView().goToDay(currentView().selectedDay);
}

/**
 * Toggle the tasks in view checkbox and refresh the current view
 */
function toggleTasksInView() {
    var cmd = document.getElementById("calendar_toggle_tasks_in_view_command");
    var newValue = (cmd.getAttribute("checked") == "true" ? "false" : "true");
    cmd.setAttribute("checked", newValue);

    var deck = getViewDeck();
    for each (var view in deck.childNodes) {
        view.tasksInView = (newValue == "true");
    }

    // Refresh the current view
    currentView().goToDay(currentView().selectedDay);
}

/**
 * Toggle the show completed in view checkbox and refresh the current view
 */
function toggleShowCompletedInView() {
    var cmd = document.getElementById("calendar_toggle_show_completed_in_view_command");
    var newValue = (cmd.getAttribute("checked") == "true" ? "false" : "true");
    cmd.setAttribute("checked", newValue);

    var deck = getViewDeck();
    for each (var view in deck.childNodes) {
        view.showCompleted = (newValue == "true");
    }

    // Refresh the current view
    currentView().goToDay(currentView().selectedDay);
}

/**
 * Provides a neutral way to go to the current day
 */
function goToDate(aDate) {
    getMinimonth().value = aDate.jsDate;
    currentView().goToDay(aDate);
}

/**
 * Returns the calendar view that was selected before restart, or the current
 * calendar view if it has already been set in this session
 */
function getLastCalendarView() {
    var deck = getViewDeck();
    if (deck.selectedIndex > -1) {
        var viewNode = deck.childNodes[deck.selectedIndex];
        return viewNode.id.replace(/-view/, "");
    }

    // No deck item was selected beforehand, default to week view.
    return "week";
}

/**
 *  Deletes items currently selected in the view
 *  and clears selection.
 */
function deleteSelectedEvents() {
    var selectedItems = currentView().getSelectedItems({});
    calendarViewController.deleteOccurrences(selectedItems.length,
                                             selectedItems,
                                             false,
                                             false);
    // clear selection
    currentView().setSelectedItems(0, [], true);
}

/**
 *  Edit the items currently selected in the view.
 */
function editSelectedEvents() {
    var selectedItems = currentView().getSelectedItems({});
    if (selectedItems && selectedItems.length >= 1) {
        modifyEventWithDialog(selectedItems[0], null, true);
    }
}

/**
 * Select all events from all calendars
 */
function selectAllEvents() {
    var items = [];
    var listener = {
        onOperationComplete: function selectAll_ooc(aCalendar, aStatus,
                                                    aOperationType, aId,
                                                    aDetail) {
            currentView().setSelectedItems(items.length, items, false);
        },
        onGetResult: function selectAll_ogr(aCalendar, aStatus, aItemType,
                                            aDetail, aCount, aItems) {
            for each (var item in aItems) {
                items.push(item);
            }
        }
    };

    var composite = getCompositeCalendar();
    var filter = composite.ITEM_FILTER_CLASS_OCCURRENCES;

    if (currentView().tasksInView) {
        filter |= composite.ITEM_FILTER_TYPE_ALL;
    } else {
        filter |= composite.ITEM_FILTER_TYPE_EVENT;
    }
    if (currentView().showCompleted) {
        filter |= composite.ITEM_FILTER_COMPLETED_ALL;
    } else {
        filter |= composite.ITEM_FILTER_COMPLETED_NO;
    }

    // Need to move one day out to get all events
    var end = currentView().endDay.clone();
    end.day += 1;

    composite.getItems(filter, 0, currentView().startDay, end, listener);
}

let cal = cal || {};
cal.navigationBar = {
    onLoad: function loadNavigationBar() {
      let viewTabs = document.getElementById("view-tabs");
      for (let i = 0; i < viewTabs.childNodes.length; i++) {
          let node = viewTabs.childNodes[i];
          if (node.localName == "tab") {
              node.setAttribute("style", "min-width: " + node.label.length + "em;");
          }
      }
    },

    setDateRange: function setDateRange(aStartDate, aEndDate, aToolTipTexts) {
        let docTitle = "";
        if (aStartDate) {
            let intervalLabel = document.getElementById("intervalDescription");
            let firstWeekNo = getWeekInfoService().getWeekTitle(aStartDate);
            let secondWeekNo = firstWeekNo;
            let weekLabel = document.getElementById("calendarWeek");
            if (aStartDate.nativeTime == aEndDate.nativeTime) {
                intervalLabel.value = getDateFormatter().formatDate(aStartDate);
            } else {
                intervalLabel.value = currentView().getRangeDescription();
                secondWeekNo = getWeekInfoService().getWeekTitle(aEndDate);
            }
            if (secondWeekNo == firstWeekNo) {
                weekLabel.value = calGetString("calendar", "singleShortCalendarWeek", [firstWeekNo]);
                weekLabel.tooltipText = calGetString("calendar", "singleLongCalendarWeek", [firstWeekNo]);
            } else {
                weekLabel.value = calGetString("calendar", "severalShortCalendarWeeks", [firstWeekNo, secondWeekNo]);
                weekLabel.tooltipText = calGetString("calendar", "severalLongCalendarWeeks", [firstWeekNo, secondWeekNo]);
            }
            document.getElementById("previous-view-button").setAttribute("tooltiptext", aToolTipTexts[0]);
            document.getElementById("today-view-button").setAttribute("tooltiptext", aToolTipTexts[1]);
            document.getElementById("next-view-button").setAttribute("tooltiptext", aToolTipTexts[2]);
            docTitle = intervalLabel.value;
        }
        if (document.getElementById("modeBroadcaster").getAttribute("mode") == "calendar") {
            document.title = (docTitle ? docTitle + " - " : "") +
                calGetString("brand", "brandShortName", null, "branding");
        }
        let viewTabs = document.getElementById("view-tabs");
        viewTabs.selectedIndex = getViewDeck().selectedIndex;
    }
};
function loadNavigationBar() {
    cal.navigationBar.onLoad();
}

window.addEventListener("load", loadNavigationBar, false);
