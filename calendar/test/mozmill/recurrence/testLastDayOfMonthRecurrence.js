/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");

const sleep = 500;
var calendar = "Mozmill";
var hour = 8;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testLastDayOfMonthRecurrence = function () {
  var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2008, 1, 31); // start with a leap year
  
  // create monthly recurring event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, hour)), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  let md = new modalDialog.modalDialog(event.window);
  md.start(setRecurrence);
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  //                        date     correct row in month view
  let checkingData = [[2008,  1, 31, 5],
                      [2008,  2, 29, 5],
                      [2008,  3, 31, 6],
                      [2008,  4, 30, 5],
                      [2008,  5, 31, 5],
                      [2008,  6, 30, 5],
                      [2008,  7, 31, 5],
                      [2008,  8, 31, 6],
                      [2008,  9, 30, 5],
                      [2008, 10, 31, 5],
                      [2008, 11, 30, 6],
                      [2008, 12, 31, 5],
                      [2009,  1, 31, 5],
                      [2009,  2, 28, 4],
                      [2009,  3, 31, 5]];
  let box = "";
  
  // check all dates
  for(let i = 0; i < checkingData.length; i++){
    calUtils.goToDate(controller, checkingData[i][0], checkingData[i][1], checkingData[i][2]);
    
    // day view
    calUtils.switchToView(controller, "day");
    box = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
      + eventPath;
    controller.waitForElement(new elementslib.Lookup(controller.window.document, box));
    
    // week view
    calUtils.switchToView(controller, "week");
    let date = new Date(checkingData[i][0], checkingData[i][1] - 1, checkingData[i][2]);
    let column = date.getDay() + 1;
    box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, column, hour)
      + eventPath;
    controller.waitForElement(new elementslib.Lookup(controller.window.document, box));
    
    // multiweek view
    calUtils.switchToView(controller, "multiweek");
    box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, 1, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // month view
    calUtils.switchToView(controller, "month");
    box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, checkingData[i][3],
      column, undefined) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // delete event
  calUtils.goToDate(controller, checkingData[0][0], checkingData[0][1], checkingData[0][2]);
  calUtils.switchToView(controller, "day");
  box = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX,
    undefined, 1, hour) + eventPath;
  calUtils.handleParentDeletion(controller, false);
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, box));
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, box));
}

function setRecurrence(recurrence){
  recurrence.sleep(sleep);
  
  // monthly
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined,
    undefined, "2");
  
  // last day of month
  recurrence.click(new elementslib.ID(recurrence.window.document, "montly-period-relative-date-radio"));
  recurrence.sleep(sleep);
  recurrence.select(new elementslib.ID(recurrence.window.document, "monthly-ordinal"), undefined,
    undefined, "-1");
  recurrence.sleep(sleep);
  recurrence.select(new elementslib.ID(recurrence.window.document, "monthly-weekday"), undefined,
    undefined, "-1");
  recurrence.sleep(sleep);
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document,
    '/id("calendar-event-dialog-recurrence")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
