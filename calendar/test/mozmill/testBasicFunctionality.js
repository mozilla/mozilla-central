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

var mozmill = {}; Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {}; Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

var RELATIVE_ROOT = 'shared-modules';
var MODULE_REQUIRES = ['ModalDialogAPI'];

var sleep = 500;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  module.modalDialogAPI = collector.getModule('ModalDialogAPI');
}

var testSmokeTest = function () {
  let path = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/';

  // open calendar view
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  // check for minimonth
  controller.assertNode(new elementslib.ID(controller.window.document, "calMinimonth"));
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
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("day-view")/'
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"timebar"})/'
    + 'anon({"anonid":"topbox"})/[9]/{"class":"calendar-time-bar-label","value":"09:00",}'));
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("day-view")/'
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/[0]/'
    + 'anon({"anonid":"boxstack"})/anon({"anonid":"bgbox"})/[9]'));
    
  // open tasks view
  controller.click(new elementslib.ID(controller.window.document, "task-tab-button"));
  controller.sleep(sleep);
  // should be possible to filter today's tasks
  controller.assertNode(new elementslib.ID(controller.window.document, "opt_today_filter"));
  // check for task add button
  controller.assertNode(new elementslib.ID(controller.window.document, "calendar-add-task-button"));
  // check for filtered tasks list
  controller.assertNode(new elementslib.Lookup(controller.window.document, path
    + 'id("calendarDisplayDeck")/id("calendar-task-box")/[1]/id("calendar-task-tree")/'
    + 'anon({"anonid":"calendar-task-tree"})/{"tooltip":"taskTreeTooltip"}'));
    
  // create test calendar
  let md = new modalDialogAPI.modalDialog(handleDialog);
  md.start();
  controller.doubleClick(new elementslib.Lookup(controller.window.document, path 
    + '/id("ltnSidebar")/id("calendar-panel")/id("calendar-list-pane")/id("calendar-listtree-pane")/'
    + 'id("calendar-list-tree-widget")/anon({"anonid":"tree"})/anon({"anonid":"treechildren"})'));
}

function handleDialog(controller) { 
  let wizardPath = '/id("calendar-wizard")/anon({"anonid":"Buttons"})/'
    + 'anon({"class":"wizard-buttons-box-1"})/{"class":"wizard-buttons-box-2"}/'
    + 'anon({"anonid":"WizardButtonDeck"})/';
  
  // click next
  controller.click(new elementslib.Lookup(controller.window.document, wizardPath
    + '[1]/{"dlgtype":"next"}'));
  controller.sleep(sleep);
  
  // set calendar name
  controller.type(new elementslib.Lookup(controller.window.document, '/id("calendar-wizard")/'
    + '{"pageid":"customizePage"}/[1]/id("customize-rows")/id("customize-name-row")/'
    + 'id("calendar-name")/anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'), 
    "Mozmill");
  controller.sleep(sleep);
  
  // click next
  controller.click(new elementslib.Lookup(controller.window.document, wizardPath
    + '[1]/{"dlgtype":"next"}'));
  controller.sleep(sleep);
  
  // click finish
  controller.click(new elementslib.Lookup(controller.window.document, wizardPath
    + '/[0]/{"dlgtype":"finish"}'));
}
