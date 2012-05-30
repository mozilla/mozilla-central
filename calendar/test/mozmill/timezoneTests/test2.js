/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");
var timezoneUtils = require("../shared-modules/timezone-utils");

const sleep = 500;
var calendar = "Mozmill";
var timezones = ["America/St_Johns", "America/Caracas", "America/Phoenix", "America/Los_Angeles",
                 "America/Argentina/Buenos_Aires", "Europe/Paris", "Asia/Kathmandu", "Australia/Adelaide"];
var times = [[4, 30], [4, 30], [3, 0], [3, 0], [9, 0], [14, 0], [19, 45], [1, 30]];
var gTimezone;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testTimezones2_CreateEvents = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  // create daily recurring events in all timezones
  let time = new Date();
  for (let i = 0; i < timezones.length; i++) {
    controller.doubleClick(new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, i + 8)), 1, 1);
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
    let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
    
    time.setHours(times[i][0]);
    time.setMinutes(times[i][1]);
    
    // set timezone
    setTimezone(event, timezones[i]);
    
    // set title and repeat
    calUtils.setData(event, {title:timezones[i], repeat:"weekly", starttime:time});

    // save
    event.click(new elementslib.ID(event.window.document, "button-save"));
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  }
}

var teardownTest = function(module) {
  timezoneUtils.switchAppTimezone(timezones[0]);
}

function setTimezone(event, timezone) {
  gTimezone = timezone;
  
  // for some reason setting checked is needed, no other menuitem with checkbox needs it
  let menuitem = new elementslib.ID(event.window.document, "options-timezone-menuitem");
  event.waitForElement(menuitem);
  menuitem.getNode().setAttribute("checked", "true");
  event.click(menuitem);
  
  let modal = new modalDialog.modalDialog(event.window);
  modal.start(eventCallback);
  event.waitForElement(new elementslib.ID(event.window.document, "timezone-starttime"));
  event.click(new elementslib.ID(event.window.document, "timezone-starttime"));
}

function eventCallback(timezone) {
  let item = new elementslib.XPath(timezone.window.document, "/*[name()='dialog']/"
     + "*[name()='menulist'][1]/*[name()='menupopup'][1]/*[@value='" + gTimezone + "']");
  timezone.waitForElement(item);
  timezone.click(item);
  timezone.click(new elementslib.Lookup(timezone.window.document, '/id("calendar-event-dialog-timezone")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}
