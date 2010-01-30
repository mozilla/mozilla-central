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
var dates = [[2009,  1,  1], [2009,  4,  2], [2009,  4, 16], [2009,  4, 30],
             [2009,  7,  2], [2009, 10, 15], [2009, 10, 29], [2009, 11,  5]];
var timezones = ["America/St_Johns", "America/Caracas", "America/Phoenix", "America/Los_Angeles",
                 "America/Argentina/Buenos_Aires", "Europe/Paris", "Asia/Kathmandu", "Australia/Adelaide"];
/* rows - dates
   columns - correct time for each event */
var times = [[[13, 45], [14, 45], [15, 45], [16, 45], [17, 45], [18, 45], [19, 45], [20, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [20, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [21, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [17, 45], [19, 45], [20, 45]],
             [[12, 45], [14, 45], [15, 45], [15, 45], [17, 45], [18, 45], [19, 45], [20, 45]],
             [[13, 45], [14, 45], [15, 45], [16, 45], [17, 45], [18, 45], [19, 45], [20, 45]]]

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['CalendarUtils', 'TimezoneUtils'];

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testTimezones9_checkKathmandu = function () {
  let eventPath = '/{"tooltip":"itemTooltip","calendar":"' + calendar.toLowerCase() + '"}';
  
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.sleep(sleep);
  
  CalendarUtils.switchToView("day", controller);
  CalendarUtils.goToDate(2009, 1, 1, controller);
  
  TimezoneUtils.verify(dates, timezones, times, controller);
}

var teardownTest = function(module) {
  TimezoneUtils.switchAppTimezone(timezones[7], controller);
}
