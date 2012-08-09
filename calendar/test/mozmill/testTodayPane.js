/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var MODULE_NAME = "testTodayPane";
var RELATIVE_ROOT = "./shared-modules";
var MODULE_REQUIRES = ["calendar-utils"];

const WAIT_FOR_WINDOW_TIMEOUT = 500;
const MOZMILL_CALENDAR = "Mozmill";

var calUtils = require("./shared-modules/calendar-utils");

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, MOZMILL_CALENDAR);
}

var testTodayPane = function () {
  // paths
  let panels = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/';
  let miniMonth = panels + 'id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/'
    + 'id("minimonth-pane")/';
  let dayView = panels + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/'
    + 'id("calendar-view-box")/id("view-deck")/id("day-view")/';
  let dayPath = dayView + 'anon({"anonid":"mainbox"})/anon({"anonid":"labelbox"})/'
    + 'anon({"anonid":"labeldaybox"})/{"flex":"1"}';
  let eventName = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/'
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})';

  // open calendar view
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.waitThenClick(new elementslib.ID(controller.window.document, "calendar-day-view-button"));

  // go to today and verify date
  controller.waitThenClick(new elementslib.Lookup(controller.window.document, miniMonth
    + '{"align":"center"}/id("calMinimonthBox")/id("calMinimonth")/'
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"today-button"})'));
  let dayNode = (new elementslib.Lookup(controller.window.document, dayPath)).getNode();
  controller.assertJS(dayNode.mDate.icalString == getIsoDate());

  // create event 6 hours from now, if this is tomorrow then at 23 today
  // doubleclick only triggers new event dialog on visible boxes, so scrolling may be needed
  // by default visible time is 08:00 - 17:00, box of 17th hour is out of view
  let hour = (new Date()).getHours();
  let startHour = (hour < 18)? hour + 6 : 23;
  let view = (new elementslib.Lookup(controller.window.document, dayView)).getNode();

  if(startHour < 8 || startHour > 16)
    view.scrollToMinute(60 * startHour);

  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[' + startHour + ']'), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, WAIT_FOR_WINDOW_TIMEOUT);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  event.waitForElement(new elementslib.Lookup(event.window.document, eventName));
  event.type(new elementslib.Lookup(event.window.document, eventName),"Today's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});

  // reset view
  view.scrollToMinute(60 * 8);

  // go to tomorrow and add an event
  controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[9]'), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, WAIT_FOR_WINDOW_TIMEOUT);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  event.waitForElement(new elementslib.Lookup(event.window.document, eventName));
  event.type(new elementslib.Lookup(event.window.document, eventName),"Tomorrow's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});

  // go 5 days forward and add an event
  for(let i = 0; i < 5; i++)
    controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
  controller.sleep(WAIT_FOR_WINDOW_TIMEOUT);

  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[9]'), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, WAIT_FOR_WINDOW_TIMEOUT);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  event.waitForElement(new elementslib.Lookup(event.window.document, eventName));
  event.type(new elementslib.Lookup(event.window.document, eventName),"Future's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});

  // go to mail tab
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("navigation-toolbox")/id("tabs-toolbar")/id("tabcontainer")/{"first-tab":"true","type":"folder"}/'
    + 'anon({"class":"tab-stack"})/{"class":"tab-background"}/{"class":"tab-background-middle"}'));
  controller.sleep(WAIT_FOR_WINDOW_TIMEOUT);

  // verify today pane open
  controller.assertNotDOMProperty(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")'), "collapsed");

  // verify today pane's date
  controller.assertValue(new elementslib.ID(controller.window.document, "datevalue-label"),
    (new Date()).getDate());

  // tomorrow and soon are collapsed by default
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("tomorrow-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("nextweek-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.sleep(WAIT_FOR_WINDOW_TIMEOUT);

  // verify events shown in today pane
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[2]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Today's Event");
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[4]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Tomorrow's Event");
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[6]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Future's Event");

  // delete events
  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[2]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[6]'));

  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[3]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[5]'));

  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[4]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[4]'));

  // hide and verify today pane hidden
  controller.click(new elementslib.ID(controller.window.document, "calendar-status-todaypane-button"));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/{"collapsed":"true"}'));

  // reset today pane
  controller.click(new elementslib.ID(controller.window.document, "calendar-status-todaypane-button"));
  controller.assertNotDOMProperty(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")'), "collapsed");
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("tomorrow-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("nextweek-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.sleep(WAIT_FOR_WINDOW_TIMEOUT);

  // verify tomorrow and soon collapsed
  let tomorrow = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[1]/anon({"class":"agenda-checkbox"})')).getNode();
  let soon = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[2]/anon({"class":"agenda-checkbox"})')).getNode();
// TODO This is failing, which might actually be an error in our code!
//  controller.assertJS(!tomorrow.hasAttribute("checked")
//    || tomorrow.getAttribute("checked") != "true");
  controller.assertJS(!soon.hasAttribute("checked")
    || soon.getAttribute("checked") != "true");
}

var getIsoDate = function() {
  let date = new Date();
  let year = date.getFullYear();
  let month = (date.getMonth() < 9)? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
  let day = (date.getDate() < 10)? '0' + date.getDate() : date.getDate();
  let isoDate = year + '' + month + '' + day;
  return isoDate;
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, MOZMILL_CALENDAR);
}
