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

var testDailyRecurrence = function () {
  let eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  // create daily event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, hour)), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "daily");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // check day view for 7 days
  let box = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour, undefined)
    + eventPath;
  controller.waitForElement(new elementslib.Lookup(controller.window.document, box));
  
  for(let day = 1; day <= 7; day++){
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    calUtils.forward(controller, 1);
  }
  
  // check week view for 2 weeks
  calUtils.switchToView(controller, "week");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let day = 5; day <= 7; day++){
    let box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, 1, day, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  calUtils.forward(controller, 1);
  
  for(let day = 1; day <= 7; day++){
    let box = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, 2, day, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // check multiweek view for 4 weeks
  calUtils.switchToView(controller, "multiweek");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let day = 5; day <= 7; day++){
    let box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, 1, day, hour)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  for(let week = 2; week <= 4; week++){
    for(let day = 1; day <= 7; day++){
      let box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, week, day, hour)
        + eventPath;
      controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    }
  }
  
  // check month view for all 5 weeks
  calUtils.switchToView(controller, "month");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let day = 5; day <= 7; day++){
    let box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 1, day, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  for(let week = 2; week <= 5; week++){
    for(let day = 1; day <= 7; day++){
      let box = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, week, day, undefined)
        + eventPath;
      controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    }
  }
  
  // delete 3rd January occurrence
  let saturday = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 1, 7, undefined)
    + eventPath;
  calUtils.handleOccurrenceDeletion(controller, false);
  controller.click(new elementslib.Lookup(controller.window.document, saturday));
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  
  // verify in all views
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, saturday));
  
  calUtils.switchToView(controller, "multiweek");
  saturday = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, 1, 7, undefined)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
    
  calUtils.switchToView(controller, "week");
  saturday = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 7, undefined)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
    
  calUtils.switchToView(controller, "day");
  saturday = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, undefined)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
  
  // go to previous day to edit event to occur only on weekdays
  calUtils.back(controller, 1);
  
  calUtils.handleParentModification(controller, false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
      + eventPath));
  
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "every.weekday");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  // check day view for 7 days
  let day = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, undefined)
    + eventPath;
  var dates = [[2009, 1, 3],
               [2009, 1, 4]];
  for(let i = 0; i < dates.length; i++){
    calUtils.goToDate(controller, dates[i][0], dates[i][1], dates[i][2]);
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // check week view for 2 weeks
  calUtils.switchToView(controller, "week");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let i = 0; i <= 1; i++){
    let day = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 1, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 7, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    calUtils.forward(controller, 1);
  }
  
  // check multiweek view for 4 weeks
  calUtils.switchToView(controller, "multiweek");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let i = 1; i <= 4; i++){
    let day = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, i, 1, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = calUtils.getEventBoxPath(controller, "multiweek", calUtils.EVENT_BOX, i, 7, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // check month view for all 5 weeks
  calUtils.switchToView(controller, "month");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  for(let i = 1; i <= 5; i++){
    let day = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, i, 1, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, i, 7, undefined)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // delete event
  let day = calUtils.getEventBoxPath(controller, "month", calUtils.EVENT_BOX, 1, 5, undefined)
    + eventPath;
  controller.click(new elementslib.Lookup(controller.window.document, day));
  calUtils.handleParentDeletion(controller, false);
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, day));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
