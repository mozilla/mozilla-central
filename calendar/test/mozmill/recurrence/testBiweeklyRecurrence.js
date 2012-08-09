/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
var calUtils = require("../shared-modules/calendar-utils");

const sleep = 500;
var calendar = "Mozmill";
var hour = 8;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testBiweeklyRecurrence = function () {
  var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 31);
  
  // create biweekly event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, hour)), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined, "bi.weekly");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  let box = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
    + eventPath;
  
  // check day view
  for(let i = 0; i < 4; i++){
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 14);
  }
  
  // check week view
  calUtils.switchToView(controller, "week");
  calUtils.goToDate(controller, 2009, 1, 31);
  
  box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 7, hour)
    + eventPath;
  for(let i = 0; i < 4; i++){
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 2);
  }

  // check multiweek view
  calUtils.switchToView(controller, "multiweek");
  calUtils.goToDate(controller, 2009, 1, 31);
  
  // always two occurrences in view, 1st and 3rd or 2nd and 4th week
  for(let i = 0; i < 5; i++){
    box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, i % 2 + 1, 7,
      undefined) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, i % 2 + 3, 7,
      undefined) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 1);
  }
  
  // check month view
  calUtils.switchToView(controller, "month");
  calUtils.goToDate(controller, 2009, 1, 31);

  // January
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 5, 7, undefined)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  calUtils.forward(controller, 1);
  
  // February
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 2, 7, undefined)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 4, 7, undefined)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  calUtils.forward(controller, 1);
  
  // March
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 2, 7, undefined)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 4, 7, undefined)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));  

  // delete event
  controller.click(new elementslib.Lookup(controller.window.document, box));
  calUtils.handleParentDeletion(controller, false);
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, box));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
