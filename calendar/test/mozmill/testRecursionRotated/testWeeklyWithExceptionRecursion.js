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
var eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['CalendarUtils', 'ModalDialogAPI', 'UtilsAPI'];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testWeeklyWithExceptionRecursion = function () {
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  CalendarUtils.switchToView("day", controller);
  // rotate view
  controller.click(new elementslib.Elem(controller.menus.menu_View.ltnCalendarMenu.ltnCalendarCurrentViewMenu.ltnViewRotated));
  CalendarUtils.goToDate(2009, 1, 5, controller);
  
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
  
  // move 5th January occurrence to 6th January
  CalendarUtils.handleOccurrenceModification(false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
      + eventPath));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  let startDate = new elementslib.Lookup(event.window.document, '/id("calendar-event-dialog")/'
    + 'id("event-grid")/id("event-grid-rows")/id("event-grid-startdate-row")/'
    + 'id("event-grid-startdate-picker-box")/id("event-starttime")/anon({"anonid":"hbox"})/'
    + 'anon({"anonid":"date-picker"})/anon({"class":"datepicker-box-class"})/'
    + '{"class":"datepicker-text-class"}/anon({"class":"menulist-editable-box textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  let endDate = new elementslib.Lookup(event.window.document, '/id("calendar-event-dialog")/'
    + 'id("event-grid")/id("event-grid-rows")/id("event-grid-enddate-row")/[1]/'
    + 'id("event-grid-enddate-picker-box")/id("event-endtime")/anon({"anonid":"hbox"})/'
    + 'anon({"anonid":"date-picker"})/anon({"class":"datepicker-box-class"})/'
    + '{"class":"datepicker-text-class"}/anon({"class":"menulist-editable-box textbox-input-box"})/'
    + 'anon({"anonid":"input"})');

  event.keypress(startDate, "a", {ctrlKey:true});
  event.type(startDate, "06.01.2009");
  // applies startdate change
  event.click(endDate);

  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // change recurrence rule
  CalendarUtils.goToDate(2009, 1, 7, controller);
  CalendarUtils.handleParentModification(false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
      + eventPath));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  let md = new ModalDialogAPI.modalDialog(changeRecurrence);
  md.start();
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined, "custom");
  
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // check two weeks
  // day view
  CalendarUtils.switchToView("day", controller);
  let path = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
    + eventPath;
  
  CalendarUtils.goToDate(2009, 1, 5, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  CalendarUtils.forward(1);
  let tuesPath = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/id("calendar-view-box")/'
    + 'id("view-deck")/id("day-view")/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[0]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}/{"flex":"1"}/[eventIndex]';
  // assert exactly two
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "0") + eventPath));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "1") + eventPath));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("eventIndex", "2") + eventPath));
  
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // next week
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  CalendarUtils.forward(1);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // week view
  CalendarUtils.switchToView("week", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller);
  
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 2, hour, controller)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  tuesPath = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/id("calendar-view-box")/'
    + 'id("view-deck")/id("week-view")/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[dayIndex]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}/{"flex":"1"}/[eventIndex]';
  // assert exactly two
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "0") + eventPath));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "1") + eventPath));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    tuesPath.replace("dayIndex", "2").replace("eventIndex", "2") + eventPath));
  
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 4, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 5, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 6, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 7, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  CalendarUtils.forward(1);
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 2, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 3, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 4, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 5, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 6, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path));
  path = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 7, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path));
  
  // multiweek view
  CalendarUtils.switchToView("multiweek", controller);
  CalendarUtils.goToDate(2009, 1, 5, controller);
  checkMultiWeekView("multiweek");
  
  // month view
  CalendarUtils.switchToView("month", controller);
  checkMultiWeekView("month");
  
  // delete event
  CalendarUtils.switchToView("day", controller);
  CalendarUtils.goToDate(2009, 1, 12, controller);
  controller.click(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
      + eventPath));
  CalendarUtils.handleParentDeletion(false);
  controller.keypress(new elementslib.ID(controller.window.document, "day-view"),
    "VK_DELETE", {});
  
  // reset view
  controller.click(new elementslib.Elem(controller.menus.menu_View.ltnCalendarMenu.ltnCalendarCurrentViewMenu.ltnViewRotated));
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
    
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function changeRecurrence(recurrence){
  recurrence.sleep(sleep);
  
  // weekly
  recurrence.select(new elementslib.ID(recurrence.window.document, "period-list"), undefined, undefined, "1");
  recurrence.sleep(sleep);
  
  let mon = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.2.Mmm");
  let tue = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.3.Mmm");
  let wed = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.4.Mmm");
  let fri = UtilsAPI.getProperty("chrome://calendar/locale/dateFormat.properties", "day.6.Mmm");
  
  let days = '/id("calendar-event-dialog-recurrence")/id("recurrence-pattern-groupbox")/'
    + 'id("recurrence-pattern-grid")/id("recurrence-pattern-rows")/id("recurrence-pattern-period-row")/'
    + 'id("period-deck")/id("period-deck-weekly-box")/[1]/id("daypicker-weekday")/anon({"anonid":"mainbox"})/';
  
  // check old rule
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + mon + '"}'));
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + wed + '"}'));
  recurrence.assertChecked(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + fri + '"}'));
  
  // check Tuesday
  recurrence.click(new elementslib.Lookup(recurrence.window.document, days + '{"label":"' + tue + '"}'));
  
  // close dialog
  recurrence.click(new elementslib.Lookup(recurrence.window.document, '/id("calendar-event-dialog-recurrence")/'
    + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
}

function checkMultiWeekView(view){
  let startWeek = view == "multiweek" ? 1 : 2

  let path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 2, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  // assert exactly two
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 3, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + '/[0]'));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 3, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + '/[1]'));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 3, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + '/[2]'));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 4, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 5, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 6, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek, 7, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 1, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 2, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 3, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 4, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 5, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 6, hour, controller);
  controller.assertNode(new elementslib.Lookup(controller.window.document, path + eventPath));
  path = CalendarUtils.getEventBoxPath(view, CalendarUtils.EVENT_BOX, startWeek + 1, 7, hour, controller);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, path + eventPath));
}
