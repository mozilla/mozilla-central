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
 
const sleep = 500;
var calendar = "Mozmill";
var hour = 8;

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['CalendarUtils', 'ModalDialogAPI'];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  CalendarUtils.createCalendar(calendar);
}

var testLastDayOfMonthRecursion = function () {
  var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  CalendarUtils.switchToView("day", controller);
  // rotate view
  controller.click(new elementslib.Elem(controller.menus.menu_View.ltnCalendarMenu.ltnCalendarCurrentViewMenu.ltnViewRotated));
  CalendarUtils.goToDate(2008, 1, 31, controller); // start with a leap year
  
  // create monthly recurring event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.CANVAS_BOX, undefined, 1, hour,
      controller)));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  let md = new ModalDialogAPI.modalDialog(setRecurrence);
  md.start();
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  //                        date     correct row in month view      
  let checkingData = [[2008,  1, 31, 5],
                      [2008,  2, 29, 5],
                      [2008,  3, 31, 6],
                      [2008,  4, 30, 5],
                      [2008,  5, 31, 5],
                      [2008,  6, 30, 5],
                      [2008,  7, 31, 5],
                      [2008,  8, 31, 6],
                      [2008,  9, 30, 5],
                      [2008, 10, 31, 5],
                      [2008, 11, 30, 6],
                      [2008, 12, 31, 5],
                      [2009,  1, 31, 5],
                      [2009,  2, 28, 4],
                      [2009,  3, 31, 5]];
  let box = "";
  
  // check all dates
  for(let i = 0; i < checkingData.length; i++){
    CalendarUtils.goToDate(checkingData[i][0], checkingData[i][1], checkingData[i][2], controller);
    
    // day view
    CalendarUtils.switchToView("day", controller);
    box = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour,
      controller) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // week view
    CalendarUtils.switchToView("week", controller);
    let date = new Date(checkingData[i][0], checkingData[i][1] - 1, checkingData[i][2]);
    let column = date.getDay() + 1;
    box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, column, hour,
      controller) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // multiweek view
    CalendarUtils.switchToView("multiweek", controller);
    box = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, 1, column, undefined,
      controller) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    // month view
    CalendarUtils.switchToView("month", controller);
    box = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, checkingData[i][3],
      column, undefined, controller) + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // delete event
  CalendarUtils.goToDate(checkingData[0][0], checkingData[0][1], checkingData[0][2], controller);
  CalendarUtils.switchToView("day", controller);
  box = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX,
    undefined, 1, hour, controller) + eventPath;
  CalendarUtils.handleParentDeletion(false);
  controller.click(new elementslib.Lookup(controller.window.document, box));
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  
  // reset view
  controller.click(new elementslib.Elem(controller.menus.menu_View.ltnCalendarMenu.ltnCalendarCurrentViewMenu.ltnViewRotated));
}

function setRecurrence(recurrence){
  recurrence.sleep(sleep);
  
  // monthly
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined,
    undefined, "2");
  
  // last day of month
  recurrence.click(new elementslib.ID(recurrence.window.document, "montly-period-relative-date-radio"));
  recurrence.sleep(sleep);
  recurrence.select(new elementslib.ID(recurrence.window.document, "monthly-ordinal"), undefined,
    undefined, "-1");
  recurrence.sleep(sleep);
  recurrence.select(new elementslib.ID(recurrence.window.document, "monthly-weekday"), undefined,
    undefined, "-1");
  recurrence.sleep(sleep);
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document,
    '/id("calendar-event-dialog-recurrence")/anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

var teardownTest = function(module) {
  CalendarUtils.deleteCalendars(calendar);
}
