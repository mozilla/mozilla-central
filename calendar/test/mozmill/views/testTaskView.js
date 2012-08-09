/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var utils = require("../shared-modules/utils");

var sleep = 500;
var calendar = "Mozmill";
var title = "Task";
var description = "1. Do A\n2. Do B";
var percentComplete = "50";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

// mozmill doesn't support trees yet, therefore completed checkbox and line-through style are not
// checked
var testTaskView = function () {
  // paths
  let taskView = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/'
    + 'id("calendarDisplayDeck")/id("calendar-task-box")/';
  let taskDialog = '/id("calendar-task-dialog")/id("event-grid")/id("event-grid-rows")/';
  let treeChildren = taskView + '[1]/id("calendar-task-tree")/anon({"anonid":"calendar-task-tree"})/'
    + '{"tooltip":"taskTreeTooltip"}';
  let taskTree = taskView + '[1]/id("calendar-task-tree")';
  let toolTip = '/id("messengerWindow")/id("calendar-popupset")/id("taskTreeTooltip")';
  let toolTipGrid = toolTip + '/{"class":"tooltipBox"}/{"class":"tooltipHeaderGrid"}/';
  
  // open task view
  controller.click(new elementslib.ID(controller.window.document, "task-tab-button"));
  controller.sleep(sleep);
  
  // make sure that testing calendar is selected
  let calendarTree = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/id("calendar-panel")/'
    + 'id("calendar-list-pane")/id("calendar-listtree-pane")/id("calendar-list-tree-widget")'))
    .getNode();
  for(i = 0; i < calendarTree.mCalendarList.length; i++)
    if(calendarTree.mCalendarList[i].name == calendar)
      calendarTree.tree.view.selection.select(i);
  
  let taskTreeNode = (new elementslib.Lookup(controller.window.document, taskTree)).getNode();
  let countBefore = taskTreeNode.mTaskArray.length;
  
  // add task
  controller.type(new elementslib.Lookup(controller.window.document, taskView
    + 'id("task-addition-box")/id("view-task-edit-field")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    title);
  controller.keypress(new elementslib.Lookup(controller.window.document, taskView
    + 'id("task-addition-box")/id("view-task-edit-field")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    "VK_RETURN",
    {});
  
  // verify added
  let countAfter;
  controller.waitFor(function() {countAfter = taskTreeNode.mTaskArray.length;
                                 return countBefore + 1 == countAfter});
  
  // last added task is automatically selected so verify detail window data
  controller.assertJSProperty(new elementslib.ID(controller.window.document,
    "calendar-task-details-title"), "textContent", title);
  
  // open added task
  // doubleclick on completion checkbox is ignored as opening action, so don't click at immediate
  // left where the checkbox is located
  controller.doubleClick(new elementslib.Lookup(controller.window.document, treeChildren), 50, 0);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let task = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // verify calendar
  task.waitForElement(new elementslib.Lookup(task.window.document, taskDialog
    + 'id("event-grid-category-color-row")/id("event-grid-category-box")/id("item-calendar")/[0]/'
    + '{"selected":"true","label":"' + calendar + '"}'))
  
  // add description, mark needs action and add percent complete
  task.type(new elementslib.Lookup(task.window.document, taskDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    description);
  task.click(new elementslib.ID(task.window.document, "todo-status-needsaction-menuitem"));
  
  // delete default 0 percent complete
  task.keypress(new elementslib.Lookup(task.window.document, taskDialog
    + 'id("event-grid-todo-status-row")/id("event-grid-todo-status-picker-box")/'
    + 'id("percent-complete-textbox")/anon({"class":"textbox-input-box numberbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    "VK_DELETE", {});
  task.type(new elementslib.Lookup(task.window.document, taskDialog
    + 'id("event-grid-todo-status-row")/id("event-grid-todo-status-picker-box")/'
    + 'id("percent-complete-textbox")/anon({"class":"textbox-input-box numberbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    percentComplete);
  
  // save
  task.click(new elementslib.ID(task.window.document, "button-save"));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  
  // verify description and status in details pane
  controller.assertValue(new elementslib.Lookup(controller.window.document, taskView
    + '{"flex":"1"}/id("calendar-task-details-container")/id("calendar-task-details-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    description);
  let status = utils.getProperty("chrome://calendar/locale/calendar.properties",
    "taskDetailsStatusNeedsAction");
  controller.assertValue(new elementslib.ID(controller.window.document, "calendar-task-details-status"),
    status);
  
  // set high priority and verify it in detail pane
  controller.click(new elementslib.ID(controller.window.document, "task-actions-priority"));
  controller.sleep(sleep);
  controller.click(new elementslib.ID(controller.window.document, "priority-1-menuitem"));
  controller.sleep(sleep);
  let priorityNode = new elementslib.ID(controller.window.document, "calendar-task-details-priority-high");
  controller.assertNotDOMProperty(priorityNode, "hidden");
  
  // verify that tooltip shows status, priority and percent complete
  let toolTipNode = new elementslib.Lookup(controller.window.document, toolTip).getNode();
  toolTipNode.ownerDocument.defaultView.showToolTip(toolTipNode, taskTreeNode.getTaskAtRow(0));
  
  let toolTipName = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[0]/[1]');
  let toolTipCalendar = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[1]/[1]');
  let toolTipPriority = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[2]/[1]');
  let toolTipStatus = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[3]/[1]');
  let toolTipComplete = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[4]/[1]');
  let priority = utils.getProperty("chrome://calendar/locale/calendar.properties",
    "highPriority");
  
  controller.assertJSProperty(toolTipName, "textContent", title);
  controller.assertJSProperty(toolTipCalendar, "textContent", calendar);
  controller.assertJSProperty(toolTipPriority, "textContent", priority);
  controller.assertJS(toolTipStatus.getNode().textContent.toLowerCase() == status.toLowerCase());
  controller.assertJSProperty(toolTipComplete, "textContent", percentComplete + '%');
  
  // mark completed, verify
  controller.click(new elementslib.ID(controller.window.document,
                                      "task-actions-markcompleted"));
  controller.sleep(sleep);
  
  status = utils.getProperty("chrome://calendar/locale/calendar.properties",
    "taskDetailsStatusCompleted");
  toolTipNode.ownerDocument.defaultView.showToolTip(toolTipNode, taskTreeNode.getTaskAtRow(0));
  controller.assertJS(toolTipStatus.getNode().textContent.toLowerCase() == status.toLowerCase());
  
  // delete task, verify
  controller.click(new elementslib.ID(controller.window.document, "task-context-menu-delete"));
  controller.click(new elementslib.ID(controller.window.document, "calendar-delete-task-button"));
  let countAfterDelete = taskTreeNode.mTaskArray.length;
  controller.assertJS(countAfter - 1 == countAfterDelete);
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
