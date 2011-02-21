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

var calUtils = require("./shared-modules/calendar-utils");
var prefs = require("./shared-modules/prefs");

var sleep = 500;
var UTF8string = "õäöü";

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  calUtils.createCalendar(controller, UTF8string);
  prefs.preferences.setPref("calendar.categories.names", UTF8string);
}

/***
 ** NOTE: This test will fail until Mozmill bug 506760 is fixed.
 ***/

var testUTF8 = function () {
  let eventDialog = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/';
  
  controller.click(new elementslib.ID(controller.window.document,"calendar-tab-button"));
  calUtils.switchToView(controller, "day");
  
  // create new event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.CANVAS_BOX, undefined, 1, 8)));
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // fill in name, location, description
  let titleTextBox = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  event.waitForElement(titleTextBox);
  event.type(titleTextBox, UTF8string);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    UTF8string);
  event.type(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    UTF8string);
  
  // select category
  event.select(new elementslib.ID(event.window.document, "item-categories"), undefined,
    UTF8string);
  
  // save
  event.click(new elementslib.ID(event.window.document, "button-save"));
  
  // open
  let eventBox = new elementslib.Lookup(controller.window.document,
    calUtils.getEventBoxPath(controller, "day", calUtils.EVENT_BOX, undefined, 1, 8)
    + '/{"tooltip":"itemTooltip","calendar":"' + UTF8string.toLowerCase() + '"}');
  controller.waitForElement(eventBox);
  controller.doubleClick(eventBox);
  controller.waitFor(function() {return mozmill.utils.getWindows("Calendar:EventDialog").length > 0}, sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  
  // check values
  titleTextBox = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})');
  event.waitForElement(titleTextBox);
  event.assertValue(titleTextBox, UTF8string);
  event.assertValue(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})'),
    UTF8string);
  event.assertValue(new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-description-row")/id("item-description")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    UTF8string);
  event.assertValue(new elementslib.ID(event.window.document, "item-categories"),
    UTF8string);
  
  // escape the event window
  event.keypress(undefined, "VK_ESCAPE", {});
}

var teardownTest = function(module) {
  calUtils.deleteCalendars(controller, UTF8string);
  prefs.preferences.clearUserPref("calendar.categories.names");
}
