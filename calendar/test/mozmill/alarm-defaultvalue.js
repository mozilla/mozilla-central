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

var mozmill = {}; Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {}; Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

var calendarController;

function setupModule(module) {
  let calWindow = mozmill.utils.getWindows("mail:3pane")[0] ||
                  mozmill.utils.getWindows("calendarMainWindow")[0];
  calendarController = new mozmill.controller.MozMillController(calWindow);
}

function testDefaultAlarms() {
  // Open preferences
  calendarController.click(new elementslib.ID(calendarController.window.document, "menu_Edit"));
  calendarController.click(new elementslib.ID(calendarController.window.document, "menu_preferences"));

  calendarController.waitForEval('utils.getWindows("Mail:Preferences").length > 0 ||' +
                                 'utils.getWindows("CalendarPreferences").length > 0');
  
  // Set up prefs controller
  let prefWindow = mozmill.utils.getWindows("Mail:Preferences")[0] ||
                   mozmill.utils.getWindows("CalendarPreferences")[0];
  let prefsController = new mozmill.controller.MozMillController(prefWindow);

  // Open lightning prefs, but only if we are on lightning.
  if (!calendarController.window.isSunbird()) {
      prefsController.click(new elementslib.Lookup(prefsController.window.document,
                              '/id("MailPreferences")/anon({"orient":"vertical"})/' + 
                              'anon({"anonid":"selector"})/{"pane":"paneLightning"}'));
  }

  // Click on the alarms tab
  prefsController.click(new elementslib.ID(prefsController.window.document, "calPreferencesTabAlarms"));

  // Turn on alarms for events and tasks
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmon"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarm"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmon"));
  
  // Sets default alarm length for events to "50"
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmlen"));
  prefsController.type(new elementslib.ID(prefsController.window.document, "calendar.alarms.eventalarmlen"),"50");
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmlen"));
  prefsController.type(new elementslib.ID(prefsController.window.document, "calendar.alarms.todoalarmlen"),"50");

  // Selects "days" as a unit
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmunit"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "eventdefalarmunitday"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmunit"));
  prefsController.click(new elementslib.ID(prefsController.window.document, "tododefalarmunitday"));

  // Close the preferences dialog
  prefsController.window.close();

  // Create New Event
  calendarController.click(new elementslib.ID(calendarController.window.document, "newMsgButton-calendar-menuitem"));

  // Set up the event dialog controller
  calendarController.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0');
  let eventController = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  // Check if the "custom" item was selected
  eventController.assertProperty(new elementslib.ID(eventController.window.document, "item-alarm"),
                                 "value",
                                 "custom");
  eventController.assertProperty(new elementslib.XPath(eventController.window.document,
                                   '//*[@id="reminder-details"]/*[local-name()="label"]'),
                                 "value",
                                 "50 days before the event starts");

  // Close the event dialog
  eventController.window.close();
  calendarController.waitForEval('utils.getWindows("Calendar:EventDialog").length == 0');

  // Create New Task
  calendarController.click(new elementslib.ID(calendarController.window.document, "newMsgButton-task-menuitem"));

  // Set up the task dialog controller
  calendarController.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0');
  let taskController = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);

  // Check if the "custom" item was selected
  taskController.assertProperty(new elementslib.ID(taskController.window.document, "item-alarm"),
                                "value",
                                "custom");
  taskController.assertProperty(new elementslib.XPath(taskController.window.document,
                                  '//*[@id="reminder-details"]/*[local-name()="label"]'),
                                "value",
                                "50 days before the task starts");
  // Close the task dialog
  taskController.window.close();
  calendarController.waitForEval('utils.getWindows("Calendar:EventDialog").length == 0');
}
