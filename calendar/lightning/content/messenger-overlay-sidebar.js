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

function yesterday()
{
    var d = now();
    d.day--;
    return d;
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
        ltnShowCalendarView(gLastShownCalendarView);
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
        if(aEvent.newValue == "top" && !aEvent.prevValue || aEvent.prevValue == "bottom") {
          // place the mode toolbox at the top of the left pane
          modeToolbox = contentPanel.parentNode.insertBefore(modeToolbox, contentPanel);
          modeToolbox.palette = palette;
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

    // To make sure the folder pane doesn't disappear without any possibility
    // to get it back, we need to reveal it when the mode box is collapsed.
    function modeBoxAttrModified(event) {
        if (event.attrName == "collapsed") {
            document.getElementById("folderPaneBox")
                    .removeAttribute("collapsed");
        }
    }

    document.getElementById("ltnModeBox").addEventListener("DOMAttrModified",
                                                           modeBoxAttrModified,
                                                           true);

    // Set up the views
    initializeViews();

    // Initialize Minimonth
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

    prepareCalendarToDoUnifinder();

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
        ltnInitializeCalendarMenu();
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
    document.getElementById("ltnMinimonth").refreshDisplay();

    // refresh the current view, if it has ever been shown
    var cView = currentView();
    if (cView.initialized) {
        cView.goToDay(cView.selectedDay);
    }

    if (TodayPane.showsYesterday()) {
      TodayPane.setDay(now());
    }
    // schedule our next update...
    scheduleMidnightUpdate(refreshUIBits);
}

/**
 * Select the calendar view in the background, not switching to calendar mode if
 * in mail mode.
 */
function ltnSelectCalendarView(type) {
    gLastShownCalendarView = type;

    // Sunbird/Lightning Common view switching code
    switchToView(type);

    // Set the labels for the context-menu
    var nextCommand = document.getElementById("context_next");
    nextCommand.setAttribute("label", nextCommand.getAttribute("label-"+type));
    var previousCommand = document.getElementById("context_previous")
    previousCommand.setAttribute("label", previousCommand.getAttribute("label-"+type));

}

function toggleControlDisplay(aCommandId, aControlId) {
    var control = document.getElementById(aControlId);
    var command = document.getElementById(aCommandId);
    if (control.getAttribute("collapsedinMode") == "false") {
        if (control.hasAttribute("collapsed")) {
            control.removeAttribute("collapsed");
            command.setAttribute("checked", "true");
            return;
        }
    }
    command.setAttribute("checked", "false");
}

function toggleControlinMode(aCommandId, aControlId) {
    var control = document.getElementById(aControlId);
    var command = document.getElementById(aCommandId);
    if (control.hasAttribute("collapsed")) {
        control.removeAttribute("collapsed");
        control.setAttribute("collapsedinMode", "false");
        command.setAttribute("checked","true");
    }
    else {
        control.setAttribute("collapsed", "true");
        control.setAttribute("collapsedinMode", "true");
        command.setAttribute("checked", "false");
    }
}

function toggleToolbar(aCommandId, aToolbarId) {
    var toolBar = document.getElementById(aToolbarId);
    var command = document.getElementById(aCommandId);
    if (toolBar.hasAttribute("collapsed")) {
       toolBar.removeAttribute("collapsed");
       command.setAttribute("checked", "true");
    }
    else {
       toolBar.setAttribute("collapsed", "true");
       command.setAttribute("checked", "false");
    }
 }



/**
 * Show the calendar view, also switching to calendar mode if in mail mode
 */
function ltnShowCalendarView(type)
{
    gLastShownCalendarView = type;

    if (gCurrentMode != 'calendar') {
        // This function in turn calls showCalendarView(), so return afterwards.
        ltnSwitch2Calendar();
        return;
    }

    ltnSelectCalendarView(type);
}

function toggleTodayPaneinMailMode()
{
  var oTodayPane = document.getElementById("today-pane-panel");
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


/**
 * This function has the sole responsibility to switch back to
 * mail mode (by calling ltnSwitch2Mail()) if we are getting
 * notifications from other panels (besides the calendar views)
 * but find out that we're not in mail mode. This situation can
 * for example happen if we're in calendar mode but the 'new mail'
 * slider gets clicked and wants to display the appropriate mail.
 * All necessary logic for switching between the different modes
 * should live inside of the corresponding functions:
 * - ltnSwitch2Mail()
 * - ltnSwitch2Calendar()
 * - ltnSwitch2Task()
 */
function LtnObserveDisplayDeckChange(event) {
    var deck = event.target;

    // Bug 309505: The 'select' event also fires when we change the selected
    // panel of calendar-view-box.  Workaround with this check.
    if (deck.id != "displayDeck") {
        return;
    }

    var id = null;
    try { id = deck.selectedPanel.id } catch (e) { }

    // Switch back to mail mode in case we find that this
    // notification has been fired but we're still in calendar or task mode.
    // Specifically, switch back if we're *not* in mail mode but the notification
    // did *not* come from either the "calendar-view-box" or the "calendar-task-box".
    if (gCurrentMode != 'mail') {
        if (id != "calendar-view-box" && id != "calendar-task-box") {
            ltnSwitch2Mail();
        }
    }
}

function ltnFinish() {
    getCompositeCalendar().removeObserver(agendaTreeView.calendarObserver);

    unloadCalendarManager();
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

var gSelectFolder = SelectFolder;
var gSelectMessage = SelectMessage;

SelectFolder = function(folderUri) {
    document.getElementById("switch2mail").doCommand();
    gSelectFolder(folderUri);
}



var calendarpopuplist = new Array();
var mailpopuplist = new Array();
var menulist = new Array();

function ltnInitializeCalendarMenu() {
    function copyPopupMenus() {
        addToPopuplists(document.getElementById("menu_File"));
        addToPopuplists(document.getElementById("menu_Edit"));
        var menuView = document.getElementById("menu_View");
        addToPopuplists(menuView);
        addToPopuplists(menuView.nextSibling, document.getElementById("calendar-GoPopupMenu"));
        addToPopuplists(document.getElementById("messageMenu"), document.getElementById("calendarCalendarPopupMenu"));
        var tasksMenu = document.getElementById("tasksMenu");
        addToPopuplists(tasksMenu);
    }

    function addToPopuplists(aMenuElement, acalendarpopupmenu) {
        var child = aMenuElement.firstChild;
        if (child) {
            if (child.localName == "menupopup") {
                var newcalendarPopupMenu = acalendarpopupmenu;
                if (newcalendarPopupMenu == null) {
                    newcalendarPopupMenu = child.cloneNode(true);
                }
                if (aMenuElement.getAttribute("id") != "menu_Edit") {
                    newcalendarPopupMenu.removeAttribute("onpopupshowing");
                }
                removeMenuElements(child, "calendar");
                calendarpopuplist.push(newcalendarPopupMenu);
                mailpopuplist.push(child);
                menulist.push(aMenuElement);
            }
        }
    }

    function getCalendarMenuElementById(aElementId, aMenuPopup) {
        var element = null;
        var elements = aMenuPopup.getElementsByAttribute("id", aElementId);
        if (elements.length > 0) {
            element = elements[0];
        }
        return element;
    }
    
    copyPopupMenus();


// "File" - menu
    [getCalendarMenuElementById("openMessageFileMenuitem", calendarpopuplist[0]),
     getCalendarMenuElementById("newAccountMenuItem", calendarpopuplist[0]),
     getCalendarMenuElementById("fileAttachmentMenu", calendarpopuplist[0]),
     getAdjacentSibling(getCalendarMenuElementById("menu_saveAs", calendarpopuplist[0]), 2),

// "Edit" - menu
     getCalendarMenuElementById("menu_find", calendarpopuplist[1]),
     getCalendarMenuElementById("menu_favoriteFolder", calendarpopuplist[1]),
     getCalendarMenuElementById("menu_properties", calendarpopuplist[1]),
     getCalendarMenuElementById("menu_accountmgr", calendarpopuplist[1]),

// "View"-menu
     getCalendarMenuElementById("menu_showMessengerToolbar", calendarpopuplist[2]),

// "Tools"-menu
     getCalendarMenuElementById("tasksMenuMail", calendarpopuplist[5]),
     getCalendarMenuElementById("menu_import", calendarpopuplist[5])].forEach(function(element) {
        try {
            if (element) {
                element.parentNode.removeChild(element);
            }
        } catch (e) {
            dump("Element '" + element.getAttribute("id") + "' could not be removed\n");
        }
    });

    calendarpopuplist.forEach(function(aMenuPopup) {
        var child = aMenuPopup.lastChild;
        if (child) {
            if (child.localName == "menuseparator") {
                try {
                    aMenuPopup.removeChild(child)
                } catch (e) {
                    dump("Element '" + child.getAttribute("id") + "' could not be removed\n");
                }
            }
        }
    });

// "File" - menu
    [getCalendarMenuElementById("menu_newFolder", calendarpopuplist[0]),
     getCalendarMenuElementById("menu_saveAs", calendarpopuplist[0]),
     getCalendarMenuElementById("menu_getnextnmsg", calendarpopuplist[0]),
     getCalendarMenuElementById("menu_renameFolder", calendarpopuplist[0]),
     getCalendarMenuElementById("offlineMenuItem", calendarpopuplist[0]),
// "Edit" - menu
     getCalendarMenuElementById("menu_delete", calendarpopuplist[1]),
     getCalendarMenuElementById("menu_select", calendarpopuplist[1]),
    
// "View"-menu
     getCalendarMenuElementById("menu_MessagePaneLayout", calendarpopuplist[2]),
     getCalendarMenuElementById("viewSortMenu", calendarpopuplist[2]),
     getCalendarMenuElementById("viewheadersmenu", calendarpopuplist[2]),
     getCalendarMenuElementById("viewTextSizeMenu", calendarpopuplist[2]),
     getCalendarMenuElementById("pageSourceMenuItem", calendarpopuplist[2]),

// "Tools"-menu
     getCalendarMenuElementById("filtersCmd", calendarpopuplist[5]),
     getCalendarMenuElementById("runJunkControls", calendarpopuplist[5])].forEach(function(element){

/**  removes all succeedingmenu elements of a container up to the next
*    menuseparator that thus denotes the end of the section. Elements with the
*    attribute mode == 'calendar' are ignored
*/
        function removeMenuElementsInSection(aElement) {
            var element = aElement
            var bleaveloop = false;
            while (!bleaveloop) {
                var ignore = false;
                bleaveloop = element.localName == "menuseparator";
                if (bleaveloop) {
                    // we delete the menuseparator only if it's the last element
                    // within its container
                    bleaveloop = (element.nextSibling != null);
                }
                if (element.hasAttribute("mode")) {
                    ignore = element.getAttribute("mode") == "calendar";
                }
                var nextMenuElement = element.nextSibling;
                if (!ignore) {
                    try {
                        element.parentNode.removeChild(element);
                    } catch (e) {
                        dump("Element '" + element.getAttribute("id") + "' could not be removed\n");
                    }
                }
                if (!bleaveloop) {
                    element = nextMenuElement;
                    bleaveloop = (element == null);
                }
            }
        }
        removeMenuElementsInSection(element);
    });

    document.getElementById("calendar-toolbar").setAttribute("collapsed", "true")
    var modeToolbar = document.getElementById("mode-toolbar");
    var visible = !modeToolbar.hasAttribute("collapsed");
    document.getElementById("modeBroadcaster").setAttribute("checked", visible);
}

function swapPopupMenus() {
    var showStatusbar = document.getElementById("menu_showTaskbar").getAttribute("checked");
    var newmenupopuplist = null;
    if (gCurrentMode == "mail") {
        newmenupopuplist = mailpopuplist;
    }
    else if (gCurrentMode == "calendar") {
        newmenupopuplist = calendarpopuplist;
    }
    for (var i = 0; i < menulist.length; i++) {
        var menu = menulist[i];
        var oldmenupopup = menu.firstChild;
        if (oldmenupopup) {
            menu.replaceChild(newmenupopuplist[i], oldmenupopup);
        }
    }
    document.getElementById("menu_showTaskbar").setAttribute("checked", showStatusbar);
    var messageMenu = document.getElementById("messageMenu");
    if (gCurrentMode == "mail") {
        messageMenu.setAttribute("label", messagemenulabel);
        messageMenu.setAttribute("accesskey", messagemenuaccesskey);
    }
    else {
        messageMenu.setAttribute("label", calendarmenulabel);
        messageMenu.setAttribute("accesskey", calendarmenuaccesskey);
    }
}

function removeMenuElements(aRoot, aModeValue) {
    var modeElements = aRoot.getElementsByAttribute("mode", aModeValue);
    if (modeElements.length > 0) {
        for (var i = modeElements.length-1; i >=0; i--) {
            var element = modeElements[i];
            if (element) {
                var localName = element.localName;
                if (localName =="menuitem" || localName == "menuseparator" || localName == "menu"){
                    element.parentNode.removeChild(element);
                }
            }
        }
    }
}



SelectMessage = function(messageUri) {
    document.getElementById("switch2mail").doCommand();
    gSelectMessage(messageUri);
}

document.getElementById("displayDeck").
    addEventListener("select", LtnObserveDisplayDeckChange, true);

document.addEventListener("load", ltnOnLoad, true);
