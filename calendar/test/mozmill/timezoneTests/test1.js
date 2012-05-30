/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var calUtils = require("../shared-modules/calendar-utils");
var timezoneUtils = require("../shared-modules/timezone-utils");

var calendar = "Mozmill";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, calendar);
}

var testTimezones1_SetGMT = function () {
  timezoneUtils.switchAppTimezone("Europe/London");
}