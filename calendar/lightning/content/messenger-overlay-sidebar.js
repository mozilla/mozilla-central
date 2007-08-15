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
 *   Mike Shaver <shaver@mozilla.org>
 *   Vladimir Vukicevic <vladimir@pobox.com>
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
 *   Simon Paquet <bugzilla@babylonsounds.com>
 *   Stefan Sitter <ssitter@googlemail.com>
 *   Thomas Benisch <thomas.benisch@sun.com>
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

var gLastShownCalendarView = null;

var CalendarController =
{
  defaultController: null,

  supportsCommand: function ccSC(command) {
    switch (command) {
      case "cmd_cut":
      case "cmd_copy":
      case "cmd_paste":
      case "cmd_undo":
      case "cmd_redo":
      case "cmd_print":
      case "cmd_printpreview":
      case "button_print":
      case "button_delete":
      case "cmd_delete":
        return true;
    }
    if (this.defaultController) {
      return this.defaultController.supportsCommand(command);
    }
    return false;
  },

  isCommandEnabled: function ccICE(command) {
    switch (command) {
      case "cmd_cut":
      case "cmd_copy":
        return currentView().getSelectedItems({}).length != 0;
      case "cmd_paste":
        return canPaste();
      case "cmd_undo":
        if (this.isCalendarInForeground()) {
          goSetMenuValue(command, 'valueDefault');
          if (canUndo()) {
            return true;
          }
        }
        break;
      case "cmd_redo":
        if (this.isCalendarInForeground()) {
          goSetMenuValue(command, 'valueDefault');
          if(canRedo()) {
            return true;
          }
        }
        break;
      case "button_print":
      case "cmd_print":
        if (this.isCalendarInForeground()) {
          return true;
        }
        break;
      case "cmd_printpreview":
        if (this.isCalendarInForeground()) {
          return false;
        }
        break;
      case "button_delete":
      case "cmd_delete":
        if (this.isCalendarInForeground()) {
          var selectedItems = currentView().getSelectedItems({});
          return selectedItems.length != 0;
        }
        break;
    }
    if (this.defaultController) {
      return this.defaultController.isCommandEnabled(command);
    }
    return false;
  },

  doCommand: function ccDC(command) {
    // if the user invoked a key short cut then it is possible that we got
    // here for a command which is really disabled. kick out if the
    // command should be disabled.
    if (!this.isCommandEnabled(command)) {
      return;
    }

    switch ( command )
    {
      case "cmd_cut":
        cutToClipboard();
        break;
      case "cmd_copy":
        copyToClipboard();
        break;
      case "cmd_paste":
        pasteFromClipboard();
        break;
      case "cmd_undo":
        if (this.isCalendarInForeground() && canUndo()) {
          getTransactionMgr().undo();
        }
        break;
      case "cmd_redo":
        if (this.isCalendarInForeground() && canRedo()) {
          getTransactionMgr().redo();
        }
        break;
      case "button_print":
      case "cmd_print":
        if (this.isCalendarInForeground()) {
          calPrint();
          return;
        }
        break;
      case "cmd_printpreview":
        if (this.isCalendarInForeground()) {
          return;
        }
        break;
      case "button_delete":
      case "cmd_delete":
        if (this.isCalendarInForeground()) {
          return;
        }
        break;
    }
    if (this.defaultController) {
      this.defaultController.doCommand(command);
    }
  },

  onEvent: function ccOE(event) {
    // do nothing here...
  },
  
  isCalendarInForeground: function ccIC() {
    return document.getElementById("displayDeck").selectedPanel.id == "calendar-view-box";
  }
};

function today()
{
    var d = Components.classes['@mozilla.org/calendar/datetime;1'].createInstance(Components.interfaces.calIDateTime);
    d.jsDate = new Date();
    return d.getInTimezone(calendarDefaultTimezone());
}

function nextMonth(dt)
{
    var d = new Date(dt);
    d.setDate(1); // make sure we avoid "June 31" when we bump the month

    var mo = d.getMonth();
    if (mo == 11) {
        d.setMonth(0);
        d.setYear(d.getYear() + 1);
    } else {
        d.setMonth(mo + 1);
    }

    return d;
}

var gMiniMonthLoading = false;
function ltnMinimonthPick(minimonth)
{
    if (gMiniMonthLoading)
        return;

    var jsDate = minimonth.value;
    document.getElementById("ltnDateTextPicker").value = jsDate;
    var cdt = jsDateToDateTime(jsDate);

    if (document.getElementById("displayDeck").selectedPanel != 
        document.getElementById("calendar-view-box")) {
        var view = currentView();

        // If we've never shown the view before, we need to do some special
        // things here.
        if (!view.initialized) {
            showCalendarView('month');
            view = currentView();
            cdt = cdt.getInTimezone(view.timezone);
            cdt.isDate = true;
            view.goToDay(cdt);
            return;
        }

        // showCalendarView is going to use the value passed in to switch to
        // foo-view, so strip off the -view part of the current view.
        var viewID = view.getAttribute("id");
        viewID = viewID.substring(0, viewID.indexOf('-'));
        showCalendarView(viewID);
    }

    cdt = cdt.getInTimezone(currentView().timezone);
    cdt.isDate = true;
    currentView().goToDay(cdt);
}

function ltnGoToDate()
{
    var goToDate = document.getElementById("ltnDateTextPicker");
    if (goToDate.value) {
        ltnMinimonthPick(goToDate);
    }
}

function ltnOnLoad(event)
{
    // Load the Calendar Manager
    loadCalendarManager();

    // take the existing folderPaneBox (that's what thunderbird displays
    // at the left side of the application window) and stuff that inside
    // of the deck we're introducing with the contentPanel. this essentially
    // rearranges the DOM tree and allows us to switch between content that
    // lives inside of the left pane.
    var folderPaneBox = document.getElementById("folderPaneBox");
    var contentPanel = document.getElementById("contentPanel");
    contentPanel.insertBefore(folderPaneBox, contentPanel.firstChild);

    // we're taking care of the mode toolbar (that's the small toolbar on
    // the lower left with the 'mail', 'calendar', 'task' buttons on it).
    // since we want to have this particular toolbar displayed at the
    // top or bottom inside the folderPaneBox (basically on top or bottom
    // of the window) we need to go to great length in order to get this
    // damned thing working. i decided to dynamically place the toolbox
    // inside the DOM tree, that appears to be the most clean solution to
    // the problem. unfortunately, it didn't work out that easy. as soon
    // as we call insertBefore() to place the node somewhere different, the
    // constructor of the appropriate binding gets called again. this has
    // the nasty side-effect that the toolbar get a bit confused, since it
    // thinks it is customized, which just isn't the case. that's why we need
    // to carry some internal toolbar properties over. and that's what those
    // functions retrieveToolbarProperties() and restoreToolbarProperties()
    // are all about.
    var retrieveToolbarProperties = function(toolbox)
    {
      var toolbars = {};
      var toolbar = toolbox.firstChild;
      while (toolbar) {
        if (toolbar.localName == "toolbar") {
          if (toolbar.getAttribute("customizable") == "true") {
            if (!toolbar.hasAttribute("customindex")) {
              var propertybag = {};
              propertybag.firstPermanentChild = toolbar.firstPermanentChild;
              propertybag.lastPermanentChild = toolbar.lastPermanentChild;
              toolbars[toolbar.id] = propertybag;
            }
          }
        }
        toolbar = toolbar.nextSibling;
      }
      return toolbars;
    }
    
    var restoreToolbarProperties = function(toolbox,toolbars)
    {
      var toolbar = toolbox.firstChild;
      while (toolbar) {
        if (toolbar.localName == "toolbar") {
          if (toolbar.getAttribute("customizable") == "true") {
            if (!toolbar.hasAttribute("customindex")) {
              var propertybag = toolbars[toolbar.id];
              toolbar.firstPermanentChild = propertybag.firstPermanentChild;
              toolbar.lastPermanentChild = propertybag.lastPermanentChild;
            }
          }
        }
        toolbar = toolbar.nextSibling;
      }
    }
    
    // DOMAttrModified handler that listens on the toolbox element
    var onModified = function(aEvent)
    {
      if(aEvent.attrName == "location") {
        var contentPanel = document.getElementById("contentPanel");
        var modeToolbox = document.getElementById("mode-toolbox");
        var palette = modeToolbox.palette;
        modeToolbox.removeEventListener("DOMAttrModified", onModified, false);
        var bag = retrieveToolbarProperties(modeToolbox);
        if(aEvent.newValue == "top" && aEvent.prevValue == "bottom") {
          // place the mode toolbox at the top of the left pane
          modeToolbox = contentPanel.parentNode.insertBefore(modeToolbox, contentPanel);
          modeToolbox.palette = palette;
          var toolbar = document.getElementById("mode-toolbar");
        } else if(aEvent.newValue == "bottom" && aEvent.prevValue == "top") {
          // place the mode toolbox at the bottom of the left pane
          modeToolbox = contentPanel.parentNode.appendChild(modeToolbox);
          modeToolbox.palette = palette;
        }
        restoreToolbarProperties(modeToolbox,bag);
        modeToolbox.addEventListener("DOMAttrModified", onModified, false);
      }
    }

    // install the handler that listens for modified 'location' attribute
    // on the toolbox. the value is changed by the toolbar customize dialog.
    var modeToolbox = document.getElementById("mode-toolbox");
    if(modeToolbox.getAttribute("location") != "bottom") {
      var palette = modeToolbox.palette;
      var bag = retrieveToolbarProperties(modeToolbox);
      modeToolbox = contentPanel.parentNode.insertBefore(modeToolbox, contentPanel);
      modeToolbox.palette = palette;
      restoreToolbarProperties(modeToolbox,bag);
    }
    modeToolbox.addEventListener("DOMAttrModified", onModified, false);

    ltnInitializeMode();

    gMiniMonthLoading = true;

    var today = new Date();
    var nextmo = nextMonth(today);

    document.getElementById("ltnMinimonth").value = today;
    document.getElementById("ltnDateTextPicker").value = today;

    gMiniMonthLoading = false;

    // nuke the onload, or we get called every time there's
    // any load that occurs
    document.removeEventListener("load", ltnOnLoad, true);

    // Hide the calendar view so it doesn't push the status-bar offscreen
    collapseElement(document.getElementById("calendar-view-box"));

    // fire up the alarm service
    var alarmSvc = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                   .getService(Components.interfaces.calIAlarmService);
    alarmSvc.timezone = calendarDefaultTimezone();
    alarmSvc.startup();

    // Add an unload function to the window so we don't leak any listeners
    document.getElementById("messengerWindow")
            .addEventListener("unload", ltnFinish, false);

    document.getElementById("displayDeck")
            .addEventListener("dayselect", observeViewDaySelect, false);

    // Make sure we update ourselves if the program stays open over midnight
    scheduleMidnightUpdate(refreshUIBits);

    if (getPrefSafe("calendar.prototypes.wcap", false)) {
        document.loadOverlay(
            "chrome://lightning/content/sun-messenger-overlay-sidebar.xul",
            null);
    }

    // we need to put our new command controller *before* the one that
    // gets installed by thunderbird. since we get called pretty early
    // during startup we need to install the function below as a callback
    // that periodically checks when the original thunderbird controller
    // gets alive. please note that setTimeout with a value of 0 means that
    // we leave the current thread in order to re-enter the message loop.
    var injectCommandController = function inject() {
      var controller = top.controllers.getControllerForCommand("cmd_undo");
      if (!controller) {
        setTimeout(injectCommandController, 0);
      } else {
        CalendarController.defaultController = controller;
        top.controllers.insertControllerAt(0, CalendarController);
      }
    }
    injectCommandController();

    getViewDeck().addEventListener("itemselect", onSelectionChanged, true);
}

function onSelectionChanged(aEvent) {
  var elements = document.getElementsByAttribute("disabledwhennoeventsselected", "true");
  var selectedItems = aEvent.detail;
  for (var i = 0; i < elements.length; i++) {
    if (selectedItems.length >= 1) {
      elements[i].removeAttribute("disabled");
    } else {
      elements[i].setAttribute("disabled", "true");
    }
  }
  document.commandDispatcher.updateCommands('mail-toolbar');
  document.commandDispatcher.updateCommands('calendar_commands');
}

/* Called at midnight to tell us to redraw date-specific widgets.  Do NOT call
 * this for normal refresh, since it also calls scheduleMidnightRefresh.
 */
function refreshUIBits() {
    agendaTreeView.refreshPeriodDates();
    document.getElementById("ltnMinimonth").refreshDisplay();

    // refresh the current view, if it has ever been shown
    var cView = currentView();
    if (cView.initialized) {
        cView.goToDay(cView.selectedDay);
    }

    // schedule our next update...
    scheduleMidnightUpdate(refreshUIBits);
}

function showCalendarView(type)
{
    gLastShownCalendarView = type;

    // If we got this call while a mail-view is being shown, we need to
    // hide all of the mail stuff so we have room to display the calendar
    var calendarViewBox = document.getElementById("calendar-view-box");
    if (calendarViewBox.style.visibility == "collapse") {
        collapseElement(GetMessagePane());
        collapseElement(document.getElementById("threadpane-splitter"));
        var searchBox = findMailSearchBox();
        if (searchBox) {
            collapseElement(searchBox);
        }
        uncollapseElement(calendarViewBox);
    }

    var view = document.getElementById(type+"-view");
    var rotated = document.getElementById("ltn-multiday-rotated");

    if (!view.initialized) {
        // Set up this view with the current view-checkbox values
        var workdaysMenu = document.getElementById("ltn-workdays-only");
        view.workdaysOnly = (workdaysMenu.getAttribute("checked") == 'true');

        var tasksMenu = document.getElementById("ltn-tasks-in-view")
        view.tasksInView = (tasksMenu.getAttribute("checked") == 'true');
        view.showCompleted = document.getElementById("completed-tasks-checkbox").checked;

        view.rotated = (rotated.getAttribute("checked") == 'true');
    }

    // Disable the menuitem when not in day or week view.
    if (type == "day" || type == "week") {
        rotated.removeAttribute("disabled");
    } else {
        rotated.setAttribute("disabled", true);
    }

    document.getElementById("displayDeck").selectedPanel =  calendarViewBox;
    switchToView(type);

    // Set the labels for the context-menu
    var nextCommand = document.getElementById("context_next");
    nextCommand.setAttribute("label", nextCommand.getAttribute("label-"+type));
    var previousCommand = document.getElementById("context_previous")
    previousCommand.setAttribute("label", previousCommand.getAttribute("label-"+type));

    // Set up the commands
    var availableViews = getViewDeck();
    for (var i = 0; i < availableViews.childNodes.length; i++) {
        var view = availableViews.childNodes[i];
        var command = document.getElementById(view.id+"-command");
        if (view.id == type+"-view") {
           command.setAttribute("checked", true);
        } else {
           command.removeAttribute("checked");
        }
    }
}

function goToToday()
{
    // set the current date in the minimonth control;
    // note, that the current view in the calendar-view-box is automatically updated
    var currentDay = today();
    document.getElementById("ltnMinimonth").value = currentDay.jsDate;
}


function toggleTodayPaneinMailMode()
{
  var oTodayPane = document.getElementById("today-pane-box");
  var todayPaneCommand = document.getElementById('cmd_toggleTodayPane');
  if (oTodayPane.hasAttribute("collapsed")) {
    oTodayPane.removeAttribute("collapsed");
    oTodayPane.removeAttribute("collapsedinMailMode");
    todayPaneCommand.setAttribute("checked","true");
    document.getElementById("today-closer").setAttribute("checked", "false");
  }
  else {
    oTodayPane.setAttribute("collapsed", true);
    oTodayPane.setAttribute("collapsedinMailMode", "true");
    todayPaneCommand.setAttribute("checked", "false");
  }
}

function selectedCalendarPane(event)
{
    var deck = document.getElementById("displayDeck");

    // If we're already showing a calendar view, don't do anything
    if (deck.selectedPanel.id == "calendar-view-box")
        return;

    deck.selectedPanel = document.getElementById("calendar-view-box");

    showCalendarView('week');
}

function LtnObserveDisplayDeckChange(event)
{
    var deck = event.target;

    // Bug 309505: The 'select' event also fires when we change the selected
    // panel of calendar-view-box.  Workaround with this check.
    if (deck.id != "displayDeck") {
        return;
    }

    var id = null;
    try { id = deck.selectedPanel.id } catch (e) { }

    // Now we're switching back to the mail view, so put everything back that
    // we collapsed in showCalendarView()
    if (id != "calendar-view-box") {
        collapseElement(document.getElementById("calendar-view-box"));
        uncollapseElement(GetMessagePane());
        uncollapseElement(document.getElementById("threadpane-splitter"));
        var searchBox = findMailSearchBox();
        if (searchBox) {
            uncollapseElement(searchBox);
        }

        // Disable the rotate view menuitem
        document.getElementById("ltn-multiday-rotated")
                .setAttribute("disabled", true);
    }
}

function ltnFinish() {
    getCompositeCalendar().removeObserver(agendaTreeView.calendarObserver);

    unloadCalendarManager();
}

function ltnEditSelectedItem() {
    var selectedItems = currentView().getSelectedItems({});
    for each (var item in selectedItems) {
        calendarViewController.modifyOccurrence(item);
    }
}

function ltnDeleteSelectedItem() {
    var selectedItems = currentView().getSelectedItems({});
    calendarViewController.deleteOccurrences(selectedItems.length,
                                             selectedItems,
                                             false,
                                             false);
}

// After 1.5 was released, the search box was moved into an optional toolbar
// item, with a different ID.  This function keeps us compatible with both.
function findMailSearchBox() {
    var tb15Box = document.getElementById("searchBox");
    if (tb15Box) {
        return tb15Box;
    }

    var tb2Box = document.getElementById("searchInput");
    if (tb2Box) {
        return tb2Box;
    }

    // In later versions, it's possible that a user removed the search box from
    // the toolbar.
    return null;
}

function updateOrientation() {

    var value = (document.getElementById("ltn-multiday-rotated")
                         .getAttribute("checked") == 'true');

    var deck = getViewDeck();
    for each (view in deck.childNodes) {
        view.rotated = value;
    }
}

function toggleWorkdaysOnly() {
    for each (view in getViewDeck().childNodes) {
        view.workdaysOnly = !view.workdaysOnly;
    }

    // Refresh the current view
    currentView().goToDay(currentView().selectedDay);
}

function toggleTasksInView() {
    for each (view in getViewDeck().childNodes) {
        view.tasksInView = !view.tasksInView;
    }

    // Refresh the current view
    currentView().goToDay(currentView().selectedDay);
}

document.getElementById("displayDeck").
    addEventListener("select", LtnObserveDisplayDeckChange, true);

document.addEventListener("load", ltnOnLoad, true);
