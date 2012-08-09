/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");
var utils = require("../shared-modules/utils");

const sleep = 500;
var calendar = "Mozmill";
var hour = 8;
var startDate = new Date(2009, 0, 6);
var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testWeeklyWithExceptionRecurrence = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 5);
  
  // rotate view
  controller.mainMenu.click("#ltnViewRotated");
  controller.waitFor(function() {
    let view = (new elementslib.ID(controller.window.document, "day-view")).getNode();
    return view.orient == "horizontal"});
  
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
  
  // move 5th January occurrence to 6th January
  calUtils.handleOccurrenceModification(controller, false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
      + eventPath));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  let startDateInput = new elementslib.Lookup(event.window.document, '/id("calendar-event-dialog")/'
    + 'id("event-grid")/id("event-grid-rows")/id("event-grid-startdate-row")/'
    + 'id("event-grid-startdate-picker-box")/id("event-starttime")/anon({"anonid":"hbox"})/'
    + 'anon({"anonid":"date-picker"})/anon({"class":"datepicker-box-class"})/'
    + '{"class":"datepicker-text-class"}/anon({"class":"menulist-editable-box textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  let endDateInput = new elementslib.Lookup(event.window.document, '/id("calendar-event-dialog")/'
    + 'id("event-grid")/id("event-grid-rows")/id("event-grid-enddate-row")/[1]/'
    + 'id("event-grid-enddate-picker-box")/id("event-endtime")/anon({"anonid":"hbox"})/'
    + 'anon({"anonid":"date-picker"})/anon({"class":"datepicker-box-class"})/'
    + '{"class":"datepicker-text-class"}/anon({"class":"menulist-editable-box textbox-input-box"})/'
    + 'anon({"anonid":"input"})');

  event.keypress(startDateInput, "a", {ctrlKey:true});
  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                     .getService(Components.interfaces.nsIScriptableDateFormat);
  let startDateString = dateService.FormatDate("", dateService.dateFormatShort, 
                                             startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  event.type(startDateInput, startDateString);
  // applies startdate change
  event.click(endDateInput);

  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  // change recurrence rule
  calUtils.goToDate(controller, 2009, 1, 7);
  calUtils.handleParentModification(controller, false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
      + eventPath));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  let md = new modalDialog.modalDialog(event.window);
  md.start(changeRecurrence);
  event.waitForElement(new elementslib.ID(event.window.document, "item-repeat"));
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined, "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  // check two weeks
  // day view
  calUtils.switchToView(controller, "day");
  let path = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
    + eventPath;
  
  calUtils.goToDate(controller, 2009, 1, 5);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  calUtils.forward(controller, 1);
  let tuesPath = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/id("calendar-view-box")/'
    + 'id("view-deck")/id("day-view")/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[0]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}/{"flex":"1"}/[eventIndex]';
  // assert exactly two
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "0") + eventPath));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "1") + eventPath));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "2") + eventPath));
  
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // next week
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  calUtils.forward(controller, 1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // week view
  calUtils.switchToView(controller, "week");
  calUtils.goToDate(controller, 2009, 1, 5);
  
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 2, hour)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  tuesPath = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/id("calendar-view-box")/'
    + 'id("view-deck")/id("week-view")/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[dayIndex]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}/{"flex":"1"}/[eventIndex]';
  // assert exactly two
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "0") + eventPath));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "1") + eventPath));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "2") + eventPath));
  
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 4, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 5, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 6, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 7, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  calUtils.forward(controller, 1);
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 1, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 2, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 3, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 4, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 5, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 6, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = calUtils.getEventBoxPath(controller, "week", calUtils.EVENT_BOX, undefined, 7, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // multiweek view
  calUtils.switchToView(controller, "multiweek");
  calUtils.goToDate(controller, 2009, 1, 5);
  checkMultiWeekView("multiweek");
  
  // month view
  calUtils.switchToView(controller, "month");
  checkMultiWeekView("month");
  
  // delete event
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 12);
  path = calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, hour)
    + eventPath;
  controller.click(new elementslib.Lookup(controller.window.document, path));
  calUtils.handleParentDeletion(controller, false);
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, path));
  
  // reset view
  controller.mainMenu.click("#ltnViewRotated");
  controller.waitFor(function() {
    let view = (new elementslib.ID(controller.window.document, "day-view")).getNode();
    return view.orient == "vertical"});
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
    
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function changeRecurrence(recurrence){
  // weekly
  recurrence.waitForElement(new elementslib.ID(recurrence.window.document, "period-list"));
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined, undefined, "1");
  recurrence.sleep(sleep);
  
  let mon = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.2.Mmm");
  let tue = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.3.Mmm");
  let wed = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.4.Mmm");
  let fri = utils.getProperty("chrome://calendar/locale/dateFormat.properties", "day.6.Mmm");
  
  let days = '/id("calendar-event-dialog-recurrence")/id("recurrence-pattern-groupbox")/'
    + 'id("recurrence-pattern-grid")/id("recurrence-pattern-rows")/id("recurrence-pattern-period-row")/'
    + 'id("period-deck")/id("period-deck-weekly-box")/[1]/id("daypicker-weekday")/anon({"anonid":"mainbox"})/';
  
  // check old rule
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + mon + '"}'));
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + wed + '"}'));
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + fri + '"}'));
  
  // check Tuesday
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + tue + '"}'));
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function checkMultiWeekView(view){
  let startWeek = view == "multiweek" ? 1 : 2

  let path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 2, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  // assert exactly two
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 3, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + '/[0]'));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 3, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + '/[1]'));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 3, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + '/[2]'));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 4, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 5, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 6, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek, 7, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 1, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 2, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 3, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 4, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 5, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 6, hour);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = calUtils.getEventBoxPath(controller, view, calUtils.EVENT_BOX, startWeek + 1, 7, hour);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
