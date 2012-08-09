/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");

const sleep = 500;
var calendar = "Mozmill";
var startYear = 1950;
var epoch = 1970;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testAnnualRecurrence = function () {
  var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, startYear, 1, 1);
  
  // rotate view
  controller.mainMenu.click("#ltnViewRotated");
  controller.waitFor(function() {
    let view = (new elementslib.ID(controller.window.document, "day-view")).getNode();
    return view.orient == "horizontal"});
  
  // create yearly recurring all-day event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
                 .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "yearly");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  let checkYears = [startYear, startYear + 1, epoch - 1, epoch, epoch + 1];
  let box = "";
  for(let i = 0; i < checkYears.length; i++){
    calUtils.goToDate(controller, checkYears[i], 1, 1);
    let date = new Date(checkYears[i], 0, 1);
    let column = date.getDay() + 1;
    
    // day view
    calUtils.switchToView(controller, "day");
    box = calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // week view
    calUtils.switchToView(controller, "week");
    box = calUtils.getEventBoxPath(controller, "week", calUtils.ALLDAY, undefined, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // multiweek view
    calUtils.switchToView(controller, "multiweek");
    box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.ALLDAY, 1, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // month view
    calUtils.switchToView(controller, "month");
    box = calUtils.getEventBoxPath(controller, "month", calUtils.ALLDAY, 1, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // delete event
  calUtils.goToDate(controller, checkYears[0], 1, 1);
  calUtils.switchToView(controller, "day");
  box = calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)
    + eventPath;
  calUtils.handleParentDeletion(controller, false);
  controller.click(new elementslib.Lookup(controller.window.document, box));
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, box));
  
  // reset view
  controller.mainMenu.click("#ltnViewRotated");
  controller.waitFor(function() {
    let view = (new elementslib.ID(controller.window.document, "day-view")).getNode();
    return view.orient == "vertical"});
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
