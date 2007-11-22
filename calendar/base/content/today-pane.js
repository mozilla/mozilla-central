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
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2005
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



var TodayPane = {
  CurrentPaneView: 0,
  paneViews: null,
  stodaypaneButton: "calendar-show-todaypane-button",
  start: null,
  cwlabel: null,
  dateFormatter: Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                      .getService(Components.interfaces.calIDateTimeFormatter),
  weekFormatter: Components.classes["@mozilla.org/calendar/weektitle-service;1"]
                .getService(Components.interfaces.calIWeekTitleService),

  onLoad: function () {
    var addToolbarbutton = false;
    var todaypanebox = document.getElementById("today-pane-panel");
    this.paneViews = [ calGetString("calendar", "eventsandtasks"), calGetString("calendar", "tasksonly"), calGetString("calendar", "eventsonly") ];
    var mailToolbar = getMailBar();
    var defaultSetString = mailToolbar.getAttribute("defaultset");
    if (defaultSetString.indexOf(this.stodaypaneButton) == -1) {
      defaultSetString = this.addButtonToDefaultset(defaultSetString);
      mailToolbar.setAttribute("defaultset", defaultSetString);
    }

    // add the toolbarbutton to the mailtoolbarpalette on first startup
    if (todaypanebox.hasAttribute("addtoolbarbutton")) {
      addToolbarbutton = (todaypanebox.getAttribute("addtoolbarbutton") == "true");
    }
    if (addToolbarbutton) {
      var currentSetString = mailToolbar.getAttribute("currentset");
      if (currentSetString.indexOf(this.stodaypaneButton) == -1) {
        this.addButtonToToolbarset();
      }
      todaypanebox.setAttribute("addtoolbarbutton", "false");
    }

    var agendapanel = document.getElementById("agenda-tab-panel");
    var todopanel = document.getElementById("todo-tab-panel");
    if (agendapanel.hasAttribute("collapsed")) {
      if (!todopanel.hasAttribute("collapsed")) {
        this.CurrentPaneView = 1;
      }
      else{
        dump("Cannot display todaypane with both subpanes collapsed");
      }
    }
    else {
      if (todopanel.hasAttribute("collapsed")) {
        this.CurrentPaneView = 2
      }
    }
    var todayheader = document.getElementById("today-header");
    todayheader.setAttribute("value", this.paneViews[this.CurrentPaneView]);

    // add a menuitem to the 'View/Layout' -menu. As the respective "Layout" menupopup
    // carries no 'id' attribute it cannot be overlaid
    var todayMenuItem = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
    todayMenuItem.setAttribute("id", "menu_showTodayPane");
    todayMenuItem.setAttribute("type", "checkbox");
    todayMenuItem.setAttribute("command", "cmd_toggleTodayPane");
    todayMenuItem.setAttribute("accesskey", calGetString("calendar", "todaypane-accesskey"));
    todayMenuItem.setAttribute("key", "todaypanekey");
    todayMenuItem.setAttribute("persist", "checked");
    todayMenuItem.setAttribute("label", todaylabel);
    var messagePaneMenu = document.getElementById("menu_MessagePaneLayout");
    var messagePanePopupMenu = messagePaneMenu.firstChild;
    messagePanePopupMenu.appendChild(todayMenuItem);
    var checked = !todaypanebox.hasAttribute("collapsedinMailMode");
    updateTodayPaneDisplay(checked);
    this.checkMenuItem(checked);
    this.initializeMiniday();
    document.getElementById("today-splitter").addEventListener("DOMAttrModified", this.onModified, false);
    this.setShortWeekdays();
  },

  checkMenuItem: function(checked)
  {
    document.getElementById('cmd_toggleTodayPane').setAttribute("checked", checked);
    var todayMenuItem = document.getElementById("menu_showTodayPane");
    todayMenuItem.setAttribute("checked", checked);
    var toolbarbutton = document.getElementById(this.stodaypaneButton);
    if (toolbarbutton != null) {
      toolbarbutton.setAttribute("checked", checked);
    }
    var todayCloser = document.getElementById("today-closer");
    todayCloser.setAttribute("checked", false);
  },

  initializeMiniday: function()
  {
    // initialize the label denoting the current month, year and calendarweek
    // with numbers that are supposed to consume the largest width 
    // in order to guarantee that the text will not be cropped when modified
    // during runtime
    const kYEARINIT= "5555";
    const kCALWEEKINIT= "55";
    var monthdisplaydeck = document.getElementById("monthNameContainer");
    var childNodes = monthdisplaydeck.childNodes;

    for (var i = 0; i < childNodes.length; i++) {
      var monthlabel = childNodes[i];
      this.setMonthDescription(monthlabel, i,  kYEARINIT, kCALWEEKINIT);
    }
    agendaTreeView.addListener(this);
    this.setDay(now());
  },

  setMonthDescription: function(aMonthLabel, aIndex, aYear, aCalWeek)
  {
    if (this.cwlabel == null) {
      this.cwlabel = calGetString("calendar", "shortcalendarweek");
    }
    return aMonthLabel.value = this.dateFormatter.shortMonthName(aIndex)
            + " " + aYear +  ", " + this.cwlabel + " " +  aCalWeek;
  },

  addButtonToDefaultset: function(toolbarSetString)
  {
    var mailToolbar = getMailBar();
    var elementcount = mailToolbar.childNodes.length;
    var buttonisWithinSet = false;
    // by default the todaypane-button is to be placed before the first
    // separator of the toolbar
    for (var i = 0; i < elementcount; i++) {
      var element = mailToolbar.childNodes[i];
      if (element.localName == "toolbarseparator") {
          var separatorindex = toolbarSetString.indexOf("separator");
          if (separatorindex > -1) {
            var firstSubString = toolbarSetString.substring(0, separatorindex);
            var secondSubString = toolbarSetString.substring(separatorindex);
            toolbarSetString = firstSubString + this.stodaypaneButton + "," + secondSubString;
          }
          buttonisWithinSet = true;
          break;
      }
    }
    if (!buttonisWithinSet) {
      // in case there is no separator within the toolbar we append the 
      // toddaypane-button
      toolbarSetString += "," + this.stodaypaneButton;
    }
    return toolbarSetString;
  },

  addButtonToToolbarset: function()
  {
    var mailToolbar = getMailBar();
    var elementcount = mailToolbar.childNodes.length;
    var buttonisWithinSet = false;
    // by default the todaypane-button is to be placed before the first
    // separator of the toolbar
    for (var i = 0; i < elementcount; i++) {
      var element = mailToolbar.childNodes[i];
      if (element.localName == "toolbarseparator") {
          mailToolbar.insertItem(this.stodaypaneButton, element, null, false);
          buttonisWithinSet = true;
          break;
      }
    }
    if (!buttonisWithinSet) {
      // in case there is no separator within the toolbar we append the 
      // toddaypane-button
      mailToolbar.insertItem(this.stodaypaneButton, null, null, false);
    }
  },

  // we can cycle the pane view forward or backwards
  cyclePaneView: function(aCycleForward)
  {
    function _collapsePanel(oPanel, bCollapse)
    {
      if (bCollapse) {
        oPanel.setAttribute("collapsed", bCollapse)
      }
      else{
        oPanel.removeAttribute("collapsed")
      }
    }

    this.CurrentPaneView = this.CurrentPaneView + aCycleForward;
    var nViewLen = this.paneViews.length;
    if (this.CurrentPaneView >= nViewLen) {
      this.CurrentPaneView = 0;
    }
    else if (this.CurrentPaneView == -1) {
      this.CurrentPaneView = nViewLen -1;
    }
    var agendapanel = document.getElementById("agenda-tab-panel");
    var todopanel = document.getElementById("todo-tab-panel");
    var todayheader = document.getElementById("today-header");
    todayheader.setAttribute("value", this.paneViews[this.CurrentPaneView]);
    switch (this.CurrentPaneView) {
      case 0:
        _collapsePanel(agendapanel, false);
        _collapsePanel(todopanel, false);
        document.getElementById("today-pane-splitter").removeAttribute("hidden");
        break;
      case 1:
        _collapsePanel(agendapanel, true);
        _collapsePanel(todopanel, false);
        document.getElementById("today-pane-splitter").setAttribute("hidden", "true");
        break;
      case 2:
        _collapsePanel(agendapanel, false);
        _collapsePanel(todopanel, true);
        document.getElementById("today-pane-splitter").setAttribute("hidden", "true");
        break;
    }
  },

  setShortWeekdays: function()
  {
    var weekdisplaydeck = document.getElementById("weekdayNameContainer");
    var childNodes = weekdisplaydeck.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      childNodes[i].setAttribute("value", calGetString("dateFormat","day." + (i+1) + ".Mmm"));
    }
 },


setDaywithjsDate: function(aNewDate)
{
  var newdatetime = jsDateToDateTime(aNewDate);
  newdatetime = newdatetime.getInTimezone(calendarDefaultTimezone());
  document.getElementById("aMinimonthPopupset").hidePopup();
  return this.setDay(newdatetime);
 },

  setDay: function(aNewDate)
  {
    this.start = aNewDate.clone();

    var daylabel = document.getElementById("datevalue-label");
    daylabel.value = this.start.day;
    var weekdaylabel = document.getElementById("weekdayNameContainer");
    weekdaylabel.selectedIndex = this.start.weekday;

    var monthnamedeck = document.getElementById("monthNameContainer");
    monthnamedeck.selectedIndex = this.start.month;

    var selMonthPanel = monthnamedeck.selectedPanel;
    if (agendaTreeView.initialized) {
      this.updatePeriod();
    }
    return this.setMonthDescription(selMonthPanel, this.start.month,
                                   this.start.year,
                                   this.weekFormatter.getWeekTitle(this.start));
  },

  advance: function(dir)
  {
    this.start.day += dir;
    this.setDay(this.start);
  },

  showsToday: function()
  {
    return (sameDay(now(), this.start));
  },
  
  showsYesterday: function()
  {
    return (sameDay(yesterday(), this.start));
  },

  updatePeriod: function()
  {
    var date = this.start.clone();
    return agendaTreeView.refreshPeriodDates(date);
  },

  // DOMAttrModified handler that listens to the todaypane-splitter
  onModified: function(aEvent) {
    if (aEvent.attrName == "state") {
      var checked = aEvent.newValue != "collapsed";
      TodayPane.checkMenuItem(checked);
      var todaypanebox = document.getElementById("today-pane-panel");
      if (checked) {
        todaypanebox.removeAttribute("collapsedinMailMode");
      }
      else {
        todaypanebox.setAttribute("collapsedinMailMode", true);
      }
    }
  }
};


function loadTodayPane() {
  TodayPane.onLoad();
}

window.addEventListener("load", loadTodayPane, false);

function updateTodayPaneDisplay() {
  var deck = document.getElementById("displayDeck");
  var id = null;
  try { id = deck.selectedPanel.id } catch (e) { }

  var todaysplitter = document.getElementById("today-splitter");
  if (id == "calendar-view-box" || id == "calendar-task-box") {
    // we collapse the todaypane but don't not affect the 
    // attribute "collapsedinMailMode". Therefor this function is only to be used
    // when switching to calendar mode
    var oTodayPane = document.getElementById("today-pane-panel");
    oTodayPane.setAttribute("collapsed", true);
    document.getElementById('cmd_toggleTodayPane').setAttribute("disabled","true");
    todaysplitter.setAttribute("collapsed", "true");
  }
  else {
    // only show the today-pane if was not collapsed during the last 
    // "mail-mode session"
    var oTodayPane = document.getElementById("today-pane-panel");
    if (!oTodayPane.hasAttribute("collapsedinMailMode")) {
      if (oTodayPane.hasAttribute("collapsed")) {
        oTodayPane.removeAttribute("collapsed");
      }
    }
    document.getElementById('cmd_toggleTodayPane').removeAttribute("disabled");
    todaysplitter.removeAttribute("collapsed");
  }
}

document.getElementById("displayDeck").
    addEventListener("select", updateTodayPaneDisplay, true);
