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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008
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

/**
 * @title Test default alarm settings for events and tasks
 * @litmus 2510
 */

var prefs = require("./shared-modules/prefs");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

var calendarController;

function setupModule(module) {
  calendarController = mozmill.getMail3PaneController();
}

function testDefaultAlarms() {
  let localeUnitString = cal.calGetString("calendar-alarms",
                                          "reminderCustomUnitDays");
  let unitString = PluralForm.get(50, localeUnitString)
                             .replace("#1", 50);
  let originStringEvent = cal.calGetString("calendar-alarms",
                                           "reminderCustomOriginBeginBeforeEvent");
  let originStringTask = cal.calGetString("calendar-alarms",
                                          "reminderCustomOriginBeginBeforeTask");
  let expectedEventReminder = cal.calGetString("calendar-alarms",
                                              "reminderCustomTitle",
                                              [unitString, originStringEvent]);
  let expectedTaskReminder = cal.calGetString("calendar-alarms",
                                              "reminderCustomTitle",
                                              [unitString, originStringTask]);
  
  // Open preferences
  calendarController.mainMenu.click("#menu_preferences");

  calendarController.waitFor(function() {
    return mozmill.utils.getWindows("Mail:Preferences").length > 0});
  
  // Set up prefs controller
  let prefWindow = mozmill.utils.getWindows("Mail:Preferences")[0];
  let prefsController = new mozmill.controller.MozMillController(prefWindow);

  // Open lightning prefs, but only if we are on lightning.
  prefsController.click(new elementslib.Lookup(prefsController.window.document,
                          '/id("MailPreferences")/anon({"orient":"vertical"})/' + 
                          'anon({"anonid":"selector"})/{"pane":"paneLightning"}'));

  // Click on the alarms tab
  prefsController.click(new elementslib.ID(prefsController.window.document, "calPreferencesTabAlarms"));
  
  // Turn on alarms for events and tasks
  prefsController.waitThenClick(new elementslib.ID(prefsController.window.document, "eventdefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmon"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmon"));
  
  // Sets default alarm length for events to "50"
  prefsController.keypress(new elementslib.ID(prefsController.window.document, "eventdefalarmlen"),
                           "a", {ctrlKey:true});
  prefsController.type(new elementslib.ID(prefsController.window.document, "calendar.alarms.eventalarmlen"),"50");
  prefsController.keypress(new elementslib.ID(prefsController.window.document, "tododefalarmlen"),
                           "a", {ctrlKey:true});
  prefsController.type(new elementslib.ID(prefsController.window.document, "calendar.alarms.todoalarmlen"),"50");

  // Selects "days" as a unit
  prefsController.select(new elementslib.ID(prefsController.window.document, "eventdefalarmunit"),
                         null, null, "days");
  prefsController.select(new elementslib.ID(prefsController.window.document, "tododefalarmunit"),
                         null, null, "days");
  
  // Close the preferences dialog
  prefsController.window.close();

  // Create New Event
  calendarController.click(new elementslib.ID(calendarController.window.document, "newMsgButton-calendar-menuitem"));

  // Set up the event dialog controller
  calendarController.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0});
  let eventController = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  // Check if the "custom" item was selected
  eventController.assertDOMProperty(new elementslib.ID(eventController.window.document, "item-alarm"),
                                    "value",
                                    "custom");
  eventController.assertDOMProperty(new elementslib.XPath(eventController.window.document,
                                      '//*[@id="reminder-details"]/*[local-name()="label" ' +
                                      'and (not(@hidden) or @hidden="false")]'),
                                    "value",
                                    expectedEventReminder);

  // Close the event dialog
  eventController.window.close();
  calendarController.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});

  // Create New Task
  calendarController.click(new elementslib.ID(calendarController.window.document, "newMsgButton-task-menuitem"));

  // Set up the task dialog controller
  calendarController.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0});
  let taskController = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  // Check if the "custom" item was selected
  taskController.assertDOMProperty(new elementslib.ID(taskController.window.document, "item-alarm"),
                                   "value",
                                   "custom");
  taskController.assertDOMProperty(new elementslib.XPath(taskController.window.document,
                                     '//*[@id="reminder-details"]/*[local-name()="label" ' +
                                      'and (not(@hidden) or @hidden="false")]'),
                                   "value",
                                   expectedTaskReminder);
  // Close the task dialog
  taskController.window.close();
  calendarController.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length == 0});
}

function teardownTest(module) {
  prefs.preferences.clearUserPref("calendar.alarms.eventalarmlen");
  prefs.preferences.clearUserPref("calendar.alarms.eventalarmunit");
  prefs.preferences.clearUserPref("calendar.alarms.onforevents");
  prefs.preferences.clearUserPref("calendar.alarms.onfortodos");
  prefs.preferences.clearUserPref("calendar.alarms.todoalarmlen");
  prefs.preferences.clearUserPref("calendar.alarms.todoalarmunit");
}
