/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Mozmill Test Code.
 *
 * The Initial Developer of the Original Code is Merike Sell.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Merike Sell <merikes@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var RELATIVE_ROOT = 'shared-modules';
var MODULE_REQUIRES = ['UtilsAPI'];

var sleep = 500;
var calendar = "Mozmill";
var title = "Task";
var description = "1. Do A\n2. Do B";
var percentComplete = "50";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
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
  controller.sleep(sleep);
  
  // verify added
  let countAfter = taskTreeNode.mTaskArray.length;
  controller.assertJS(countBefore + 1 == countAfter);
  
  // last added task is automatically selected so verify detail window data
  controller.assertValue(new elementslib.ID(controller.window.document,
    "calendar-task-details-title"),
    title);
  
  // open added task
  // doubleclick on completion checkbox is ignored as opening action, so don't click at immediate
  // left where the checkbox is located
  controller.doubleClick(new elementslib.Lookup(controller.window.document, treeChildren), 50, 0);
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let task = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  task.sleep(sleep);
  
  // verify calendar
  task.assertNode(new elementslib.Lookup(task.window.document, taskDialog
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
    + 'id("percent-complete-textbox")/anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    "VK_BACK_SPACE",
    {});
  task.type(new elementslib.Lookup(task.window.document, taskDialog
    + 'id("event-grid-todo-status-row")/id("event-grid-todo-status-picker-box")/'
    + 'id("percent-complete-textbox")/anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    percentComplete);
  
  // save
  task.click(new elementslib.ID(task.window.document, "button-save"));
  controller.sleep(sleep);
  
  // verify description and status in details pane
  controller.assertValue(new elementslib.Lookup(controller.window.document, taskView
    + '{"flex":"1"}/id("calendar-task-details-container")/id("calendar-task-details-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    description);
  let status = UtilsAPI.getProperty("chrome://calendar/locale/calendar.properties",
    "taskDetailsStatusNeedsAction");
  controller.assertValue(new elementslib.ID(controller.window.document, "calendar-task-details-status"),
    status);
  
  // set high priority and verify it in detail pane
  controller.click(new elementslib.ID(controller.window.document, "task-actions-priority"));
  controller.sleep(sleep);
  controller.click(new elementslib.ID(controller.window.document, "priority-1-menuitem"));
  controller.sleep(sleep);
  let priorityNode = new elementslib.ID(controller.window.document, "calendar-task-details-priority-high");
  controller.assertPropertyNotExist(priorityNode, "hidden");
  
  // verify that tooltip shows status, priority and percent complete
  let toolTipNode = new elementslib.Lookup(controller.window.document, toolTip).getNode();
  toolTipNode.ownerDocument.defaultView.showToolTip(toolTipNode, taskTreeNode.getTaskAtRow(0));
  
  let toolTipName = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[0]/[1]');
  let toolTipPriority = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[1]/[1]');
  let toolTipStatus = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[2]/[1]');
  let toolTipComplete = new elementslib.Lookup(controller.window.document, toolTipGrid + '[1]/[3]/[1]');
  let priority = UtilsAPI.getProperty("chrome://calendar/locale/calendar.properties",
    "highPriority");
  
  controller.assertJS(toolTipName.getNode().textContent == title);
  controller.assertJS(toolTipPriority.getNode().textContent == priority);
  controller.assertJS(toolTipStatus.getNode().textContent == status);
  controller.assertJS(toolTipComplete.getNode().textContent == percentComplete + '%');
  
  // mark completed, verify
  controller.click(new elementslib.Lookup(controller.window.document, taskView
    + '[1]/id("calendar-task-details-container")/id("calendar-task-details")/'
    + 'id("other-actions-box")/id("task-actions-markcompleted")/anon({"anonid":"button"})'));
  controller.sleep(sleep);
  
  status = UtilsAPI.getProperty("chrome://calendar/locale/calendar.properties",
    "taskDetailsStatusCompleted");
  toolTipNode.ownerDocument.defaultView.showToolTip(toolTipNode, taskTreeNode.getTaskAtRow(0));
  controller.assertJS(toolTipStatus.getNode().textContent == status);
  
  // delete task, verify
  controller.click(new elementslib.ID(controller.window.document, "task-context-menu-delete"));
  controller.click(new elementslib.ID(controller.window.document, "calendar-delete-task-button"));
  let countAfterDelete = taskTreeNode.mTaskArray.length;
  controller.assertJS(countAfter - 1 == countAfterDelete);
}
