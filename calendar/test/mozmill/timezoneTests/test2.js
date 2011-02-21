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

var calUtils = require("../shared-modules/calendar-utils");
var modalDialog = require("../shared-modules/modal-dialog");
var timezoneUtils = require("../shared-modules/timezone-utils");

const sleep = 500;
var calendar = "Mozmill";
var timezones = ["America/St_Johns", "America/Caracas", "America/Phoenix", "America/Los_Angeles",
                 "America/Argentina/Buenos_Aires", "Europe/Paris", "Asia/Kathmandu", "Australia/Adelaide"];
var times = [[4, 30], [4, 30], [3, 0], [3, 0], [9, 0], [14, 0], [19, 45], [1, 30]];
var gTimezone;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testTimezones2_CreateEvents = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  // create daily recurring events in all timezones
  let time = new Date();
  for (let i = 0; i < timezones.length; i++) {
    controller.doubleClick(new elementslib.Lookup(controller.window.document,
      calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, i + 8)), 1, 1);
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
    let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
    
    time.setHours(times[i][0]);
    time.setMinutes(times[i][1]);
    
    // set timezone
    setTimezone(event, timezones[i]);
    
    // set title and repeat
    calUtils.setData(event, {title:timezones[i], repeat:"weekly", starttime:time});

    // save
    event.click(new elementslib.ID(event.window.document, "button-save"));
    controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
  }
}

var teardownTest = function(module) {
  timezoneUtils.switchAppTimezone(timezones[0]);
}

function setTimezone(event, timezone) {
  gTimezone = timezone;
  
  // for some reason setting checked is needed, no other menuitem with checkbox needs it
  let menuitem = new elementslib.ID(event.window.document, "options-timezone-menuitem");
  event.waitForElement(menuitem);
  menuitem.getNode().setAttribute("checked", "true");
  event.click(menuitem);
  
  let modal = new modalDialog.modalDialog(event.window);
  modal.start(eventCallback);
  event.waitForElement(new elementslib.ID(event.window.document, "timezone-starttime"));
  event.click(new elementslib.ID(event.window.document, "timezone-starttime"));
}

function eventCallback(timezone) {
  let item = new elementslib.XPath(timezone.window.document, "/*[name()='dialog']/"
     + "*[name()='menulist'][1]/*[name()='menupopup'][1]/*[@value='" + gTimezone + "']");
  timezone.waitForElement(item);
  timezone.click(item);
  timezone.click(new elementslib.Lookup(timezone.window.document, '/id("calendar-event-dialog-timezone")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}
