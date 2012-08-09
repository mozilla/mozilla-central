/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "testBasicFunctionality";
const RELATIVE_ROOT = "./shared-modules";
const MODULE_REQUIRES = ["calendar-utils", "window-helpers"];

var calUtils = require("shared-modules/calendar-utils");
const TIMEOUT_MODAL_DIALOG = 30000;

var modalDialog;
var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  modalDialog = collector.getModule('window-helpers');
}

var testSmokeTest = function () {
  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                              .getService(Components.interfaces.nsIScriptableDateFormat);
  let path = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/';

  // open calendar view
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  
  // check for minimonth
  controller.waitForElement(new elementslib.ID(controller.window.document, "calMinimonth"));
  // every month has a first
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("ltnSidebar")/id("minimonth-pane")/{"align":"center"}/id("calMinimonthBox")/'
    + 'id("calMinimonth")/anon({"anonid":"minimonth-calendar"})/[1]/{"value":"1"}'));
  
  // check for calendar list
  controller.assertNode(new elementslib.ID(controller.window.document, "calendar-list-pane"));
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("ltnSidebar")/id("calendar-panel")/id("calendar-list-pane")/id("calendar-listtree-pane")/'
    + 'id("calendar-list-tree-widget")/anon({"anonid":"tree"})/anon({"anonid":"treechildren"})'));
  
  // check for event search
  controller.assertNode(new elementslib.ID(controller.window.document, "bottom-events-box"));
  // there should be search field
  controller.assertNode(new elementslib.ID(controller.window.document, "unifinder-search-field"));
  
  // default view is day view which should have 09:00 label and box
  let label = dateService.FormatTime("", dateService.timeFormatNoSeconds, 9, 0, 0);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("day-view")/'
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"timebar"})/'
    + 'anon({"anonid":"topbox"})/[9]/{"class":"calendar-time-bar-label","value":"' + label + '"}'));
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("day-view")/'
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/[0]/'
    + 'anon({"anonid":"boxstack"})/anon({"anonid":"bgbox"})/[9]'));
    
  // open tasks view
  controller.click(new elementslib.ID(controller.window.document, "task-tab-button"));
  // should be possible to filter today's tasks
  controller.waitForElement(new elementslib.ID(controller.window.document, "opt_today_filter"));
  // check for task add button
  controller.assertNode(new elementslib.ID(controller.window.document, "calendar-add-task-button"));
  // check for filtered tasks list
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-task-box")/[1]/id("calendar-task-tree")/'
    + 'anon({"anonid":"calendar-task-tree"})/{"tooltip":"taskTreeTooltip"}'));
  
  // create test calendar
  modalDialog.plan_for_modal_dialog("Calendar:NewCalendarWizard", handleNewCalendarWizard);
  let calendarList = new elementslib.Lookup(controller.window.document, path 
    + '/id("ltnSidebar")/id("calendar-panel")/id("calendar-list-pane")/id("calendar-listtree-pane")/'
    + 'id("calendar-list-tree-widget")/anon({"anonid":"tree"})/anon({"anonid":"treechildren"})');
  controller.doubleClick(calendarList, 0, calendarList.getNode().boxObject.height); // bottom left
  modalDialog.wait_for_modal_dialog("Calendar:NewCalendarWizard", TIMEOUT_MODAL_DIALOG);
}

function handleNewCalendarWizard(controller) {
  let docEl = controller.window.document.documentElement;
  // click next
  docEl.getButton("next").doCommand();

  // set calendar name
  let calendarNameTextBox = new elementslib.Lookup(controller.window.document, '/id("calendar-wizard")/'
    + '{"pageid":"customizePage"}/[1]/id("customize-rows")/id("customize-name-row")/'
    + 'id("calendar-name")/anon({"class":"textbox-input-box"})/anon({"anonid":"input"})');
  controller.waitForElement(calendarNameTextBox);
  controller.type(calendarNameTextBox, "Mozmill");
  
  // click next
  docEl.getButton("next").doCommand();
  
  // click finish
  docEl.getButton("finish").doCommand();
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, "Mozmill");
}
