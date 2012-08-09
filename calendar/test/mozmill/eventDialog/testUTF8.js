/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var prefs = require("../shared-modules/prefs");
// needed to set utf8 values in prefs
Components.utils.import("resource://calendar/modules/calUtils.jsm");

var sleep = 500;
var UTF8string = "õäöü";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, UTF8string);
  cal.setLocalizedPref("calendar.categories.names", UTF8string);
}

var testUTF8 = function () {
  let eventDialog = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/';
  
  controller.click(new elementslib.ID(controller.window.document,"calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  
  // create new event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, 8)));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // fill in name, location, description
  let titleTextBox = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  event.waitForElement(titleTextBox);
  event.type(titleTextBox, UTF8string);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    UTF8string);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    UTF8string);
  
  // select category
  event.select(new elementslib.ID(event.window.document, "item-categories"), undefined,
    UTF8string);
  
  // save
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // open
  let eventBox = new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)
    + '/{"tooltip":"itemTooltip","calendar":"' + UTF8string.toLowerCase() + '"}');
  controller.waitForElement(eventBox);
  controller.doubleClick(eventBox);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // check values
  titleTextBox = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  event.waitForElement(titleTextBox);
  event.assertValue(titleTextBox, UTF8string);
  event.assertValue(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    UTF8string);
  event.assertValue(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    UTF8string);
  event.assertValue(new elementslib.ID(event.window.document, "item-categories"),
    UTF8string);
  
  // escape the event window
  event.keypress(undefined, "VK_ESCAPE", {});
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, UTF8string);
  prefs.preferences.clearUserPref("calendar.categories.names");
}
