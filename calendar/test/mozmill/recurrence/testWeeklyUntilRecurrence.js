/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");
var utils = require("../shared-modules/utils");

const sleep = 500;
var calendar = "Mozmill";
var endDate = new Date(2009, 0, 26); // last Monday in month

var hour = 8;
var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testWeeklyUntilRecurrence = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 5); // Monday
  
  // create weekly recurring event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, hour)), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  let md = new modalDialog.modalDialog(event.window);
  md.start(setRecurrence);
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined, "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  let box = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
    + eventPath;
  
  // check day view
  for(let week = 0; week < 3; week++){
    // Monday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 2);
    // Wednesday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 2);
    // Friday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 3);
  }
  
  // Monday, last occurrence
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  calUtils.forward(controller, 2);
  // Wednesday
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
  calUtils.forward(controller, 2);
  
  // check week view
  calUtils.switchToView(controller, "week");
  calUtils.goToDate(controller, 2009, 1, 5);
  for(let week = 0; week < 3; week++){
    // Monday
    box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 2, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Wednesday
    box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 4, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Friday
    box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 6, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    calUtils.forward(controller, 1);
  }
  
  // Monday, last occurrence
  box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 2, hour)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  // Wednesday
  box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 4, hour)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
  
  // check multiweek view
  calUtils.switchToView(controller, "multiweek");
  calUtils.goToDate(controller, 2009, 1, 5);
  checkMultiWeekView("multiweek");
  
  // check month view
  calUtils.switchToView(controller, "month");
  calUtils.goToDate(controller, 2009, 1, 5);
  checkMultiWeekView("month");
  
  // delete event
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 2, 2, undefined)
    + eventPath;
  controller.click(new elementslib.Lookup(controller.window.document, box));
  calUtils.handleParentDeletion(controller, false);
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, box));
}

function setRecurrence(recurrence){
  // weekly
  recurrence.waitForElement(new elementslib.ID(recurrence.window.document, "period-list"));
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined, undefined, "1");
  recurrence.sleep(sleep);
  
  let mon = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.2.Mmm");
  let wed = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.4.Mmm");
  let fri = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.6.Mmm");
  
  let days = '/id("calendar-event-dialog-recurrence")/id("recurrence-pattern-groupbox")/'
    + 'id("recurrence-pattern-grid")/id("recurrence-pattern-rows")/id("recurrence-pattern-period-row")/'
    + 'id("period-deck")/id("period-deck-weekly-box")/[1]/id("daypicker-weekday")/anon({"anonid":"mainbox"})/';
  
  // starting from Monday so it should be checked
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + mon + '"}'));
  // check Wednesday and Friday too
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + wed + '"}'));
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + fri + '"}'));
  
  // set until date
  recurrence.click(new elementslib.ID(recurrence.window.document, "recurrence-range-until"));
  let input = '/id("calendar-event-dialog-recurrence")/id("recurrence-range-groupbox")/[1]/'
    + 'id("recurrence-duration")/id("recurrence-range-until-box")/id("repeat-until-date")/'
    + 'anon({"class":"datepicker-box-class"})/{"class":"datepicker-text-class"}/'
    + 'anon({"class":"menulist-editable-box textbox-input-box"})/anon({"anonid":"input"})';
  // delete previous date
  recurrence.keypress(new elementslib.Lookup(recurrence.window.document, input), "a", {ctrlKey:true});
  recurrence.keypress(new elementslib.Lookup(recurrence.window.document, input), "VK_DELETE", {});

  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                     .getService(Components.interfaces.nsIScriptableDateFormat);
  let endDateString = dateService.FormatDate("", dateService.dateFormatShort, 
                                             endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
  recurrence.type(new elementslib.Lookup(recurrence.window.document, input), endDateString);
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function checkMultiWeekView(view){
  let startWeek = 1;
  
  // in month view event starts from 2nd row
  if(view == "month") startWeek++;

  for(let week = startWeek; week < startWeek + 3; week++){
    // Monday
    let box = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, week, 2, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Wednesday
    box = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, week, 4, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Friday
    box = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, week, 6, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // Monday, last occurrence
  let box = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 3, 2,
    undefined) + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  // Wednesday
  box = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 3, 4,
    undefined) + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
