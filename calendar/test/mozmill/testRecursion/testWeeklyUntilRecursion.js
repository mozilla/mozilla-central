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
var endDate = new Date(2009, 0, 26); // last Monday in month

var hour = 8;
var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['CalendarUtils', 'ModalDialogAPI', 'UtilsAPI'];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  CalendarUtils.createCalendar(calendar);
}

var testWeeklyUntilRecursion = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  CalendarUtils.switchToView("day", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller); // Monday
  
  // create weekly recurring event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.CANVAS_BOX, undefined, 1, hour, controller)));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  let md = new ModalDialogAPI.modalDialog(setRecurrence);
  md.start();
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined, "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  let box = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
    + eventPath;
  
  // check day view
  for(let week = 0; week < 3; week++){
    // Monday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    CalendarUtils.forward(2);
    // Wednesday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    CalendarUtils.forward(2);
    // Friday
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    CalendarUtils.forward(3);
  }
  
  // Monday, last occurrence
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  CalendarUtils.forward(2);
  // Wednesday
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
  CalendarUtils.forward(2);
  
  // check week view
  CalendarUtils.switchToView("week", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller);
  for(let week = 0; week < 3; week++){
    // Monday
    box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 2, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Wednesday
    box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 4, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Friday
    box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 6, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    
    CalendarUtils.forward(1);
  }
  
  // Monday, last occurrence
  box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 2, hour, controller)
    + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  // Wednesday
  box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 4, hour, controller)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
  
  // check multiweek view
  CalendarUtils.switchToView("multiweek", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller);
  checkMultiWeekView("multiweek");
  
  // check month view
  CalendarUtils.switchToView("month", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller);
  checkMultiWeekView("month");
  
  // delete event
  controller.click(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, 2, 2, undefined, controller)
      + eventPath));
  CalendarUtils.handleParentDeletion(false);
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
}

function setRecurrence(recurrence){
  recurrence.sleep(sleep);
  
  // weekly
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined, undefined, "1");
  recurrence.sleep(sleep);
  
  let mon = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.2.Mmm");
  let wed = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.4.Mmm");
  let fri = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.6.Mmm");
  
  let days = '/id("calendar-event-dialog-recurrence")/id("recurrence-pattern-groupbox")/'
    + 'id("recurrence-pattern-grid")/id("recurrence-pattern-rows")/id("recurrence-pattern-period-row")/'
    + 'id("period-deck")/id("period-deck-weekly-box")/[1]/id("daypicker-weekday")/anon({"anonid":"mainbox"})/';
  
  // starting from Monday so it should be checked
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + mon + '"}'));
  // check Wednesday and Friday too
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + wed + '"}'));
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + fri + '"}'));
  
  // set until date
  recurrence.click(new elementslib.ID(recurrence.window.document, "recurrence-range-until"));
  let input = '/id("calendar-event-dialog-recurrence")/id("recurrence-range-groupbox")/[1]/'
    + 'id("recurrence-duration")/id("recurrence-range-until-box")/id("repeat-until-date")/'
    + 'anon({"class":"datepicker-box-class"})/{"class":"datepicker-text-class"}/'
    + 'anon({"class":"menulist-editable-box textbox-input-box"})/anon({"anonid":"input"})';
  // delete previous date
  recurrence.keypress(new elementslib.Lookup(recurrence.window.document, input), "a", {ctrlKey:true});
  recurrence.keypress(new elementslib.Lookup(recurrence.window.document, input), "VK_DELETE", {});

  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                     .getService(Components.interfaces.nsIScriptableDateFormat);
  let endDateString = dateService.FormatDate("", dateService.dateFormatShort, 
                                             endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate());
  recurrence.type(new elementslib.Lookup(recurrence.window.document, input), endDateString);
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function checkMultiWeekView(view){
  let startWeek = 1;
  
  // in month view event starts from 2nd row
  if(view == "month") startWeek++;

  for(let week = startWeek; week < startWeek + 3; week++){
    // Monday
    let box = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, week, 2, undefined, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Wednesday
    box = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, week, 4, undefined, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    // Friday
    box = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, week, 6, undefined, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // Monday, last occurrence
  let box = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 3, 2, 
    undefined, controller) + eventPath;
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  // Wednesday
  box = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 3, 4,
    undefined, controller) + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, box));
}

var teardownTest = function(module) {
  CalendarUtils.deleteCalendars(calendar);
}
