/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");
var utils = require("../shared-modules/utils");

var sleep = 500;
var calendar = "Mozmill";
var title = "Event";
var location = "Location";
var desc = "Event Decription";
var attendee = "foo@bar.com";
var url = "http://mozilla.org";
var tmp;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testEventDialog = function () {
  // paths
  let monthView = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/'
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("month-view")/';
  let miniMonth = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/'
    + 'id("minimonth-pane")/{"align":"center"}/id("calMinimonthBox")/id("calMinimonth")/';
  let eventDialog = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/';

  let eventBox = monthView + 'anon({"anonid":"mainbox"})/anon({"anonid":"monthgrid"})/'
    + 'anon({"anonid":"monthgridrows"})/[rowNumber]/[columnNumber]/'
    + '{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}/anon({"flex":"1"})/'
    + '[0]/anon({"anonid":"event-container"})/{"class":"calendar-event-selection"}/'
    + 'anon({"anonid":"eventbox"})/{"class":"calendar-event-details"}';

  // open month view
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.waitThenClick(new elementslib.ID(controller.window.document, "calendar-month-view-button"));
    
  // pick year
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"yearcell"})'));
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"years-popup"})/[0]/{"value":"2009"}'));
  
  // pick month
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"monthheader"})'));
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"months-popup"})/[0]/{"index":"0"}'));

  // pick day
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-calendar"})/[1]/{"value":"1"}'));
  controller.sleep(sleep);
  
  // create new event
  controller.mainMenu.click("#ltnNewEvent");
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // check that the start time is correct
  // next full hour except last hour hour of the day
  let now = new Date();
  let hour = now.getHours();
  let startHour = (hour == 23)? hour : (hour + 1) % 24;
  let ampm = "";
  if (now.toLocaleTimeString().match(/AM|PM/)) {
    ampm = (hour >= 12 ? " PM" : " AM")
    startHour = startHour % 12;
    if (startHour == 0) startHour = 12;
  }

  let startTime = startHour + ':00' + ampm;
  let endTime = ((startHour + 1) % 24) + ':00' + ampm;
  let startTimeInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-startdate-row")/id("event-grid-startdate-picker-box")/'
    + 'id("event-starttime")/anon({"anonid":"hbox"})/anon({"anonid":"time-picker"})/'
    + 'anon({"class":"timepicker-box-class"})/id("timepicker-text")/'
    + 'anon({"class":"menulist-editable-box textbox-input-box"})/anon({"anonid":"input"})'
    );
  event.waitForElement(startTimeInput);
  event.assertValue(startTimeInput, startTime);
  
  // check selected calendar
  event.assertNode(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-category-color-row")/id("event-grid-category-box")/id("item-calendar")/[0]/'
    + '{"selected":"true","label":"' + calendar + '"}'))
  
  // fill in name, location, description
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    title);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'), location);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    desc);
  
  // set category
  let categories = utils.getProperty("chrome://calendar/locale/categories.properties", "categories2");
  let category = categories.split(',')[4]; // pick 4th value in a comma-separated list
  event.select(new elementslib.ID(event.window.document, "item-categories"), null, category);

  // repeat daily
  event.click(new elementslib.ID(event.window.document, "repeat-daily-menuitem"));
  
  // add reminder
  event.click(new elementslib.ID(event.window.document, "reminder-5minutes-menuitem"));
  
  // add an attendee and verify added
  let md = new modalDialog.modalDialog(event.window);
  md.start(handleAttendees);
  event.click(new elementslib.ID(event.window.document, "button-attendees"));
  event.assertValue(new elementslib.ID(event.window.document, "attendee-list"),
    attendee);
  
  // make it private and verify label visible
  event.click(new elementslib.ID(event.window.document, "button-privacy"));
  event.click(new elementslib.ID(event.window.document, "event-privacy-private-menuitem"));
  let label = (new elementslib.ID(event.window.document, "status-privacy-private-box"));
  event.assertJS(event.window.getComputedStyle(label.getNode(), null).getPropertyValue("visibility") == "visible");
  
  // add attachment and verify added
  calUtils.handleAddingAttachment(event, url);
  event.click(new elementslib.ID(event.window.document, "button-url"));
  event.assertNode(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-attachment-row")/id("attachment-link")/{"label":"mozilla.org"}'));
  
  // save
  calUtils.acceptSendingNotificationMail(event);
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // catch and dismiss alarm
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:AlarmWindow").length > 0}, sleep);
  let alarm = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:AlarmWindow")[0]);
  // dismiss all button, label in .dtd file, bug #504635
  alarm.waitThenClick(new elementslib.Lookup(alarm.window.document, '/id("calendar-alarm-dialog")/'
    + 'id("alarm-actionbar")/[1]'));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:AlarmWindow").length == 0}, sleep);
  
  // verify event and alarm icon visible every day of the month and check tooltip
  // 1st January is Thursday so there's three days to check in the first row
  controller.assertNode(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "4")));
  checkIcon(eventBox, "0", "4");
  checkTooltip(monthView, "0", "4", "1", startTime, endTime);
  
  controller.assertNode(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "5")));
  checkIcon(eventBox, "0", "5");
  checkTooltip(monthView, "0", "5", "2", startTime, endTime);
  
  controller.assertNode(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "6")));
  checkIcon(eventBox, "0", "6");
  checkTooltip(monthView, "0", "6", "3", startTime, endTime);
  
  // 31st of January is Saturday so there's four more full rows to check
  let date = 4;
  for(row = 1; row < 5; row++){
    for(col = 0; col < 7; col++){
        controller.assertNode(new elementslib.Lookup(controller.window.document, 
          eventBox.replace("rowNumber", row).replace("columnNumber", col)));
        checkIcon(eventBox, row, col);
        checkTooltip(monthView, row, col, date, startTime, endTime);
        date++;
    }
  }
  
  // delete and verify deleted 2nd Jan
  calUtils.handleOccurrenceDeletion(controller);
  controller.click(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "5")));
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "5")));
  
  // verify all others still exist
  controller.assertNode(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "4")));
  controller.assertNode(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "6")));
    
  for(row = 1; row < 5; row++)
    for(col = 0; col < 7; col++)
        controller.assertNode(new elementslib.Lookup(controller.window.document, 
          eventBox.replace("rowNumber", row).replace("columnNumber", col)));
  
  // delete series by deleting 3rd January and confirming to delete all
  calUtils.handleParentDeletion(controller);
  controller.click(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "6")));
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  
  // verify all deleted
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "4")));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "5")));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, 
    eventBox.replace("rowNumber", "0").replace("columnNumber", "6")));
    
  for(row = 1; row < 5; row++)
    for(col = 0; col < 7; col++)
        controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, 
          eventBox.replace("rowNumber", row).replace("columnNumber", col)));
}

function handleAttendees(attendees){
  let input = new elementslib.Lookup(attendees.window.document,
    '/id("calendar-event-dialog-attendees-v2")/[6]/[0]/id("attendees-list")/'
    + 'anon({"anonid":"listbox"})/[1]/[1]/anon({"anonid":"input"})/'
    + 'anon({"class":"autocomplete-textbox-container"})/'
    + '{"class":"textbox-input-box"}/anon({"anonid":"input"})');
  attendees.waitForElement(input);
  attendees.type(input, attendee);
  attendees.click(new elementslib.Lookup(attendees.window.document, 
    '/id("calendar-event-dialog-attendees-v2")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function checkIcon(eventBox, row, col){
  let icon = new elementslib.Lookup(controller.window.document,
    (eventBox + '/anon({"anonid":"category-box-stack"})/anon({"align": "right"})/anon({"class":"alarm-icons-box"})/anon({"class": "reminder-icon"})')
    .replace("rowNumber", row).replace("columnNumber", col));
  controller.assertJS(icon.getNode().getAttribute("value") == "DISPLAY");
}

function checkTooltip(monthView, row, col, date, startTime, endTime){
  let mouseOverItem = monthView + 'anon({"anonid":"mainbox"})/anon({"anonid":"monthgrid"})/'
    + 'anon({"anonid":"monthgridrows"})/[rowNumber]/[columnNumber]/'
    + '{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  controller.mouseOver(new elementslib.Lookup(controller.window.document, 
          mouseOverItem.replace("rowNumber", row).replace("columnNumber", col)));
  
  // check title
  let eventName = new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("calendar-popupset")/id("itemTooltip")/'
    + '{"class":"tooltipBox"}/{"class":"tooltipHeaderGrid"}/[1]/[0]/[1]');
  controller.assertJS(eventName.getNode().textContent == title);
  
  // check date and time
  // date-time string contains strings formatted in operating system language so check numeric values only
  let dateTime = new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("calendar-popupset")/id("itemTooltip")/'
    + '{"class":"tooltipBox"}/{"class":"tooltipHeaderGrid"}/[1]/[2]/[1]').getNode().textContent + '';
  controller.assertJS(dateTime.indexOf(date) != -1 && dateTime.indexOf(startTime) != -1
    && dateTime.indexOf(endTime) != -1);
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
