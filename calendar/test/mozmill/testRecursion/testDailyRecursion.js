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
var MODULE_REQUIRES = ['CalendarUtils'];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testDailyRecursion = function () {
  let eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  CalendarUtils.switchToView("day", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  // create daily event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.CANVAS_BOX, undefined, 1, hour, controller)));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "daily");
  event.sleep(0);
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // check day view for 7 days
  let box = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, undefined, controller)
    + eventPath;
  controller.waitForElement(new elementslib.Lookup(controller.window.document, box));
  
  for(let day = 1; day <= 7; day++){
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
    controller.sleep(sleep);
  }
  
  // check week view for 2 weeks
  CalendarUtils.switchToView("week", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let day = 5; day <= 7; day++){
    let box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, 1, day, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
  controller.sleep(sleep);
  
  for(let day = 1; day <= 7; day++){
    let box = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, 2, day, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  // check multiweek view for 4 weeks
  CalendarUtils.switchToView("multiweek", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let day = 5; day <= 7; day++){
    let box = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, 1, day, hour, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  for(let week = 2; week <= 4; week++){
    for(let day = 1; day <= 7; day++){
      let box = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, week, day, hour, controller)
        + eventPath;
      controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    }
  }
  
  // check month view for all 5 weeks
  CalendarUtils.switchToView("month", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let day = 5; day <= 7; day++){
    let box = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, 1, day, undefined, controller)
      + eventPath;
    controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  }
  
  for(let week = 2; week <= 5; week++){
    for(let day = 1; day <= 7; day++){
      let box = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, week, day, undefined, controller)
        + eventPath;
      controller.assertNode(new elementslib.Lookup(controller.window.document, box));
    }
  }
  
  // delete 3rd January occurrence
  let saturday = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, 1, 7, undefined, controller)
    + eventPath;
  CalendarUtils.handleOccurrenceDeletion(false);
  controller.click(new elementslib.Lookup(controller.window.document, saturday));
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
  controller.sleep(sleep);
  
  // verify in all views
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
  
  CalendarUtils.switchToView("multiweek", controller);
  saturday = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, 1, 7, undefined, controller)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
    
  CalendarUtils.switchToView("week", controller);
  saturday = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 7, undefined, controller)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
    
  CalendarUtils.switchToView("day", controller);
  saturday = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, undefined, controller)
    + eventPath;
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, saturday));
  
  // go to previous day to edit event to occur only on weekdays
  controller.click(new elementslib.ID(controller.window.document, "previous-view-button"));
  controller.sleep(sleep);
  
  CalendarUtils.handleParentModification(false);
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour, controller)
      + eventPath));
  
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
    "every.weekday");
  event.sleep(0);
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // check day view for 7 days
  let day = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, undefined, controller)
    + eventPath;
  var dates = [[2009, 1, 3],
               [2009, 1, 4]];
  for(let i = 0; i < dates.length; i++){
    CalendarUtils.goToDate(dates[i][0], dates[i][1], dates[i][2], controller);
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // check week view for 2 weeks
  CalendarUtils.switchToView("week", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let i = 0; i <= 1; i++){
    let day = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 1, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = CalendarUtils.getEventBoxPath("week", CalendarUtils.EVENT_BOX, undefined, 7, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
    controller.sleep(sleep);
  }
  
  // check multiweek view for 4 weeks
  CalendarUtils.switchToView("multiweek", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let i = 1; i <= 4; i++){
    let day = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, i, 1, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = CalendarUtils.getEventBoxPath("multiweek", CalendarUtils.EVENT_BOX, i, 7, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // check month view for all 5 weeks
  CalendarUtils.switchToView("month", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  for(let i = 1; i <= 5; i++){
    let day = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, i, 1, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
    day = CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, i, 7, undefined, controller)
      + eventPath;
    controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document, day));
  }
  
  // delete event
  controller.click(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("month", CalendarUtils.EVENT_BOX, 1, 5, undefined, controller)
      + eventPath));
  CalendarUtils.handleParentDeletion(false);
  controller.keypress(new elementslib.ID(controller.window.document, "month-view"),
    "VK_DELETE", {});
}
