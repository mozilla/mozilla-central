/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @title Test default alarm settings for events and tasks
 * @litmus 2510
 */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource:///modules/PluralForm.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var MODULE_NAME = "testAlarmDefaultValue";
var RELATIVE_ROOT = "./shared-modules";
var MODULE_REQUIRES = ["calendar-utils"];

var calendarController;
var calUtils = require("shared-modules/calendar-utils");

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

  // Configure the lightning preferences
  calUtils.open_lightning_prefs(handle_pref_dialog, calendarController, collector);

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

function handle_pref_dialog(prefsController) {
  // Click on the alarms tab
  prefsController.click(new elementslib.ID(prefsController.window.document, "calPreferencesTabAlarms"));

  // Turn on alarms for events and tasks
  prefsController.waitThenClick(new elementslib.ID(prefsController.window.document, "eventdefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmon"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmon"));

  // Selects "days" as a unit
  prefsController.select(new elementslib.ID(prefsController.window.document, "tododefalarmunit"),
                         null, null, "days");
  prefsController.select(new elementslib.ID(prefsController.window.document, "eventdefalarmunit"),
                         null, null, "days");

  // Sets default alarm length for events to "50"
  let eventdefalarmlen = new elementslib.ID(prefsController.window.document, "eventdefalarmlen");
  let tododefalarmlen = new elementslib.ID(prefsController.window.document, "tododefalarmlen");
  prefsController.keypress(eventdefalarmlen, "a", {accelKey:true});
  prefsController.type(eventdefalarmlen ,"50");
  prefsController.keypress(tododefalarmlen, "a", {accelKey:true});
  prefsController.type(tododefalarmlen ,"50");
}

function teardownTest(module) {
  Services.prefs.clearUserPref("calendar.alarms.eventalarmlen");
  Services.prefs.clearUserPref("calendar.alarms.eventalarmunit");
  Services.prefs.clearUserPref("calendar.alarms.onforevents");
  Services.prefs.clearUserPref("calendar.alarms.onfortodos");
  Services.prefs.clearUserPref("calendar.alarms.todoalarmlen");
  Services.prefs.clearUserPref("calendar.alarms.todoalarmunit");
}
