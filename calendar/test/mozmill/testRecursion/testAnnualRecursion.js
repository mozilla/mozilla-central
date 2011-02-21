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

const sleep = 500;
var calendar = "Mozmill";
var startYear = 1950;
var epoch = 1970;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testAnnualRecursion = function () {
  var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, startYear, 1, 1);
  
  // create yearly recurring all-day event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
                 .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "yearly");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  let checkYears = [startYear, startYear + 1, epoch - 1, epoch, epoch + 1];
  let box = "";
  for(let i = 0; i < checkYears.length; i++){
    calUtils.goToDate(controller, checkYears[i], 1, 1);
    let date = new Date(checkYears[i], 0, 1);
    let column = date.getDay() + 1;
    
    // day view
    calUtils.switchToView(controller, "day");
    box = calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // week view
    calUtils.switchToView(controller, "week");
    box = calUtils.getEventBoxPath(controller, "week", calUtils.ALLDAY, undefined, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // multiweek view
    calUtils.switchToView(controller, "multiweek");
    box = calUtils.getEventBoxPath(controller, "multiweek", calUtils.ALLDAY, 1, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // month view
    calUtils.switchToView(controller, "month");
    box = calUtils.getEventBoxPath(controller, "month", calUtils.ALLDAY, 1, column, undefined)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // delete event
  calUtils.goToDate(controller, checkYears[0], 1, 1);
  calUtils.switchToView(controller, "day");
  box = calUtils.getEventBoxPath(controller, "day", calUtils.ALLDAY, undefined, 1, undefined)
    + eventPath;
  calUtils.handleParentDeletion(controller, false);
  controller.click(new elementslib.Lookup(controller.window.document, box));
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  controller.waitForElementNotPresent(new elementslib.Lookup(controller.window.document, box));
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, calendar);
}
