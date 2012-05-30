/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var prefs = require("../shared-modules/prefs");
var timezoneUtils = require("../shared-modules/timezone-utils");

const sleep = 500;
var calendar = "Mozmill";
var dates = [[2009,  1,  1], [2009,  4,  2], [2009,  4, 16], [2009,  4, 30],
             [2009,  7,  2], [2009, 10, 15], [2009, 10, 29], [2009, 11,  5]];
var timezones = ["America/St_Johns", "America/Caracas", "America/Phoenix", "America/Los_Angeles",
                 "America/Argentina/Buenos_Aires", "Europe/Paris", "Asia/Kathmandu", "Australia/Adelaide"];
/* rows - dates
   columns - correct time for each event */
var times = [[[18, 30], [19, 30], [20, 30], [21, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]],
             [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [22, 30], [0, 30, +1], [1, 30, +1]],
             [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30],    [1, 30, +1]],
             [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30],    [1, 30, +1]],
             [[16, 30], [18, 30], [19, 30], [19, 30], [21, 30], [21, 30], [23, 30],    [1, 30, +1]],
             [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [22, 30], [0, 30, +1], [1, 30, +1]],
             [[17, 30], [19, 30], [20, 30], [20, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]],
             [[18, 30], [19, 30], [20, 30], [21, 30], [22, 30], [23, 30], [0, 30, +1], [1, 30, +1]]]

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testTimezones10_checkAdelaide = function () {
  let eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  calUtils.goToDate(controller, 2009, 1, 1);
  
  timezoneUtils.verify(controller, dates, timezones, times);
}

var teardownTest = function(module) {
  prefs.preferences.clearUserPref("calendar.timezone.local");
  calUtils.deleteCalendars(controller, calendar);
}
