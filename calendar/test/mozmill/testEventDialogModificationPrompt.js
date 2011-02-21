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

var calUtils = require("./shared-modules/calendar-utils");
var modalDialog = require("./shared-modules/modal-dialog");
var prefs = require("./shared-modules/prefs");

const sleep = 500;
var calendar = "Mozmill";
var title = "Title";
var location = "Location";
var description = "Description\ncontinuing";
var pass;
var date1 = new Date(2009, 0, 1,  8, 0);
var date2 = new Date(2009, 0, 2,  9, 0);
var date3 = new Date(2009, 0, 3, 10, 0);
var data = [{title: "title1", location: "location1", description: "description1", allday: false,
             startdate: date1, starttime: date1, enddate: date2, endtime: date2, repeat: "none",
             reminder: 0, priority: "normal", privacy: "public", status: "confirmed",
             freebusy: "busy", timezone: true, attachment: {add: "http://mozilla.org"}},
            {title: "title2", location: "location2", description: "description2", allday: true,
             startdate: date2, starttime: date2, enddate: date3, endtime: date3, repeat: "daily",
             reminder: 2, priority: "high", privacy: "private", status: "tentative",
             freebusy: "free", timezone: true, attachment: {delete: "mozilla.org"}}];
var newlines = [{title: "title", description: "  test spaces  "},
                {title: "title", description: "\ntest newline\n"},
                {title: "title", description: "\rtest \\r\r"},
                {title: "title", description: "\r\ntest \\r\\n\r\n"},
                {title: "title", description: "\ttest \\t\t"}];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
  
  let categories = prefs.preferences.getPref("calendar.categories.names", "string").split(',');
  data[0].category = categories[0];
  data[1].category = categories[1];
}

// Test that closing an event dialog with no changes does not prompt for save
var testEventDialogModificationPrompt = function () {
  controller.click(new elementslib.ID(controller.window.document,"calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  // create new event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, 8)), 1, 1);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  // enter first set of data
  calUtils.setData(event, data[0]);
  
  // save
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // open, but change nothing
  let eventBox = new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)
    + '/{"tooltip":"itemTooltip"}');
  controller.waitForElement(eventBox);
  controller.doubleClick(eventBox);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  // modal dialog setup
  let md = new modalDialog.modalDialog(event.window);
  md.start(handleSavePrompt);
  
  // escape the event window, there should be no prompt to save event
  event.keypress(undefined, "VK_ESCAPE", {});
  controller.sleep(sleep);
  md.stop();
  
  // open
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)
    + '/{"tooltip":"itemTooltip"}'));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  
  md = new modalDialog.modalDialog(event.window);
  md.start(handleSavePrompt);
  
  // change all values
  calUtils.setData(event, data[1]);
  
  // edit all values back to original
  calUtils.setData(event, data[0]);
  
  // escape the event window, there should be no prompt to save event
  event.keypress(undefined, "VK_ESCAPE", {});
  controller.sleep(sleep); 
  md.stop();
  
  // delete event
  controller.click(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)));
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)));
  
  for(let i = 0; i < newlines.length; i++) {
    // test set i
    controller.doubleClick(new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, 8)));
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
    event = new mozmill.controller.MozMillController(mozmill.utils
      .getWindows("Calendar:EventDialog")[0]);
    calUtils.setData(event, newlines[i]);
    event.click(new elementslib.ID(event.window.document, "button-save"));
    
    // open and close
    eventBox = new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)
      + '/{"tooltip":"itemTooltip"}');
    controller.waitForElement(eventBox);
    controller.doubleClick(eventBox);
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
    event = new mozmill.controller.MozMillController(mozmill.utils
      .getWindows("Calendar:EventDialog")[0]);
    md = new modalDialog.modalDialog(event.window);
    md.start(handleSavePrompt);
    event.keypress(undefined, "VK_ESCAPE", {});
    controller.sleep(sleep);
    md.stop();
    
    // delete it
    controller.click(new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)));
    controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
      "VK_DELETE", {});
    controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)));
  }
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
  if (pass != undefined && pass == false) {
    controller.assertJS('"Prompt appeared" == "Prompt didn\'t appear."');
  }
}

function handleSavePrompt(controller) {
  // unexpected prompt, thus the test has already failed
  // can't trigger a failure though, because the following click wouldn't be executed
  // so remembering it
  pass = false;
  // application close is blocked without it
  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("commonDialog")/anon({"anonid":"buttons"})/{"dlgtype":"extra1"}'));
}