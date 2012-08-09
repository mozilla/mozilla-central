/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");

var sleep = 500;
var calendar = "Mozmill";
var title1 = "Week View Event";
var title2 = "Week View Event Changed";
var desc = "Week View Event Description";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testWeekView = function () {
  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                              .getService(Components.interfaces.nsIScriptableDateFormat);
  // paths
  let miniMonth = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/'
    + 'id("minimonth-pane")/{"align":"center"}/id("calMinimonthBox")/id("calMinimonth")/';
  let weekView = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/'
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("week-view")/';
  let eventDialog = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/';
  let eventBox = weekView + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[4]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}/{"flex":"1"}/{"flex":"1"}/{"tooltip":"itemTooltip","calendar":"'
    + calendar.toLowerCase() + '"}';
    
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.waitThenClick(new elementslib.ID(controller.window.document, "calendar-week-view-button"));
  
  // pick year
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"yearcell"})'));
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"years-popup"})/[0]/{"value":"2009"}'));
  
  // pick month
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"monthheader"})'));
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"months-popup"})/[0]/{"index":"0"}'));

  // pick day
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-calendar"})/[1]/{"value":"1"}'));
  
  // verify date
  let day = new elementslib.Lookup(controller.window.document, weekView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"labelbox"})/anon({"anonid":"labeldaybox"})/'
    + '{"selected":"true"}');
  controller.waitFor(function() {return day.getNode().mDate.icalString == "20090101"});

  // create event at 8 AM
  // Thursday of 2009-01-01 is 4th with default settings
  controller.doubleClick(new elementslib.Lookup(controller.window.document, weekView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '[4]/anon({"anonid":"boxstack"})/anon({"anonid":"bgbox"})/[8]'), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // check that the start time is correct
  let startTimeInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-startdate-row")/id("event-grid-startdate-picker-box")/'
    + 'id("event-starttime")/anon({"anonid":"hbox"})/anon({"anonid":"time-picker"})/'
    + 'anon({"class":"timepicker-box-class"})/anon({"class":"timepicker-text-class"})/'
    + 'anon({"flex":"1"})/anon({"anonid":"input"})');
  event.waitForElement(startTimeInput);
  event.assertValue(startTimeInput, '8:00');
  let date = dateService.FormatDate("", dateService.dateFormatShort,
    2009, 1, 1);
  event.assertValue(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-startdate-row")/id("event-grid-startdate-picker-box")/'
    + 'id("event-starttime")/anon({"anonid":"hbox"})/anon({"anonid":"date-picker"})/'
    + 'anon({"flex":"1","id":"hbox","class":"datepicker-box-class"})/'
    + '{"class":"datepicker-text-class"}/anon({"class":"menulist-editable-box textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    date);
    
  // fill in title, description and calendar
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    title1);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    desc);
  event.select(new elementslib.ID(event.window.document, "item-calendar"), null, calendar);
  
  // save
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // if it was created successfully, it can be opened
  controller.waitForElement(new elementslib.Lookup(controller.window.document, eventBox));
  controller.doubleClick(new elementslib.Lookup(controller.window.document, eventBox));
  controller.waitFor(function () {return utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // change title and save changes
  let titleTextBox = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  event.waitForElement(titleTextBox);
  event.type(titleTextBox, title2);
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // check if name was saved
  let eventName = new elementslib.Lookup(controller.window.document, eventBox
    + '/anon({"flex":"1"})/anon({"anonid":"event-container"})/{"class":"calendar-event-selection"}/'
    + 'anon({"anonid":"eventbox"})/{"class":"calendar-event-details"}/'
    + 'anon({"anonid":"event-name"})');
  controller.waitForElement(eventName);
  controller.assertJSProperty(eventName, "textContent", title2);
  
  // delete event
  controller.click(new elementslib.Lookup(controller.window.document, eventBox));
  controller.keypress(new elementslib.ID(controller.window.document, "week-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, eventBox));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
