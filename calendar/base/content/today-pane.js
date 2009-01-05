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
    paneViews: null,
    start: null,
    cwlabel: null,

  onLoad: function onLoad() {
      this.paneViews = [ calGetString("calendar", "eventsandtasks"), calGetString("calendar", "tasksonly"), calGetString("calendar", "eventsonly") ];
      agendaListbox.setupCalendar();
      this.initializeMiniday();
      this.setShortWeekdays();
      document.getElementById("modeBroadcaster").addEventListener("DOMAttrModified", this.onModeModified, false);
      this.setTodayHeader();
      document.getElementById("today-splitter").addEventListener("command", onCalendarViewResize, false);
  },

  onUnload: function onUnload() {
      document.getElementById("modeBroadcaster").removeEventListener("DOMAttrModified", this.onModeModified, false);
      document.getElementById("today-splitter").removeEventListener("command", onCalendarViewResize, false);
  },

  setTodayHeader: function setTodayHeader() {
      var currentMode = document.getElementById("modeBroadcaster").getAttribute("mode");
      var agendaIsVisible = document.getElementById("agenda-panel").isVisible(currentMode);
      var todoIsVisible = document.getElementById("todo-tab-panel").isVisible(currentMode);
      var index = 2;
      if (agendaIsVisible && todoIsVisible) {
          index = 0;
      } else if (!agendaIsVisible && (todoIsVisible)) {
          index = 1;
      } else if (agendaIsVisible && (!todoIsVisible)) {
          index = 2;
      } else { // agendaIsVisible == false && todoIsVisible == false:
          // In this case something must have gone wrong
          // - probably in the previous session - and no pane is displayed.
          // We set a default by only displaying agenda-pane.
          agendaIsVisible = true;
          document.getElementById("agenda-panel").setVisible(agendaIsVisible);
          index = 2;
      }
      var todayHeader = document.getElementById("today-pane-header");
      todayHeader.setAttribute("index", index);
      todayHeader.setAttribute("value", this.paneViews[index]);
      var todayPaneSplitter = document.getElementById("today-pane-splitter");
      setBooleanAttribute(todayPaneSplitter, "hidden", (index != 0));
      var todayIsVisible = document.getElementById("today-pane-panel").isVisible();
      this.disableMenuItems(!todayIsVisible || !agendaIsVisible);
      onCalendarViewResize();
  },

  initializeMiniday: function initializeMiniday() {
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
      agendaListbox.addListener(this);
      this.setDay(now());
  },

  setMonthDescription: function setMonthDescription(aMonthLabel, aIndex, aYear, aCalWeek) {
      if (this.cwlabel == null) {
          this.cwlabel = calGetString("calendar", "shortcalendarweek");
      }
      return aMonthLabel.value = getDateFormatter().shortMonthName(aIndex)
              + " " + aYear +  ", " + this.cwlabel + " " +  aCalWeek;
  },

  // we can cycle the pane view forward or backwards
  cyclePaneView: function cyclePaneView(aCycleForward) {
      if (this.paneViews == null) {
          return;
      }
      var index = parseInt(document.getElementById("today-pane-header").getAttribute("index"));
      index = index + aCycleForward;
      var nViewLen = this.paneViews.length;
      if (index >= nViewLen) {
          index = 0;
      } else if (index == -1) {
         index = nViewLen - 1;
      }
      var agendaPanel = document.getElementById("agenda-panel");
      var todoPanel = document.getElementById("todo-tab-panel");
      var currentMode = document.getElementById("modeBroadcaster").getAttribute("mode");
      var isTodoPanelVisible = (index != 2 && todoPanel.isVisibleInMode(currentMode));
      var isAgendaPanelVisible = (index != 1 && agendaPanel.isVisibleInMode(currentMode));
      todoPanel.setVisible(isTodoPanelVisible);
      agendaPanel.setVisible(isAgendaPanelVisible);
      this.setTodayHeader();
  },

  setShortWeekdays: function setShortWeekdays() {
      var weekdisplaydeck = document.getElementById("weekdayNameContainer");
      var childNodes = weekdisplaydeck.childNodes;
      for (var i = 0; i < childNodes.length; i++) {
          childNodes[i].setAttribute("value", calGetString("dateFormat","day." + (i+1) + ".Mmm"));
      }
  },

  setDaywithjsDate: function setDaywithjsDate(aNewDate) {
      var newdatetime = jsDateToDateTime(aNewDate, floating());
      newdatetime = newdatetime.getInTimezone(calendarDefaultTimezone());
      document.getElementById("aMinimonthPopupset").hidePopup();
      return this.setDay(newdatetime, true);
  },

  getDay: function getDay(aNewDate) {
      return this.start;
  },

  setDay: function setDay(aNewDate, aDontUpdateMinimonth) {
      this.start = aNewDate.clone();

      var daylabel = document.getElementById("datevalue-label");
      daylabel.value = this.start.day;
      var weekdaylabel = document.getElementById("weekdayNameContainer");
      weekdaylabel.selectedIndex = this.start.weekday;

      var monthnamedeck = document.getElementById("monthNameContainer");
      monthnamedeck.selectedIndex = this.start.month;

      var selMonthPanel = monthnamedeck.selectedPanel;
      this.setMonthDescription(selMonthPanel,
                               this.start.month,
                               this.start.year,
                               getWeekInfoService().getWeekTitle(this.start));
      if (!aDontUpdateMinimonth || !aDontUpdateMinimonth) {
          document.getElementById("today-Minimonth").value = this.start.jsDate;
      }
      this.updatePeriod();
  },

  advance: function advance(dir) {
      this.start.day += dir;
      this.setDay(this.start);
  },

  showsToday: function showsToday() {
      return (sameDay(now(), this.start));
  },

  showsYesterday: function showsYesterday() {
      return (sameDay(yesterday(), this.start));
  },

  updatePeriod: function updatePeriod() {
      var date = this.start.clone();
      return agendaListbox.refreshPeriodDates(date);
  },

  displayMiniSection: function displayMiniSection(aIndex) {
      document.getElementById("today-minimonth-box").setVisible(aIndex == 2);
      document.getElementById("mini-day-box").setVisible(aIndex == 1);
      document.getElementById("today-none-box").setVisible(aIndex == 3);
      setBooleanAttribute(document.getElementById("today-Minimonth"), "freebusy", aIndex == 2);
},

  disableMenuItems: function disableMenuItems(disable) {
       var menu = document.getElementById("today-pane-menu");
       if (menu) {
           setAttributeToChildren(menu.firstChild, "disabled", disable, "name", "minidisplay");
       }
  },

  // DOMAttrModified handler that listens to the todaypane-splitter
  onModeModified: function onModeModified(aEvent) {
      if (aEvent.attrName == "mode") {
          TodayPane.setTodayHeader();
          var todaypanebox = document.getElementById("today-pane-panel");
          if (todaypanebox.isVisible()) {
              document.getElementById("today-splitter").setAttribute("state", "open");
          }
      }
  }};

function loadTodayPane() {
    TodayPane.onLoad();
}

window.addEventListener("load", loadTodayPane, false);
