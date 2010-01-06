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

var RELATIVE_ROOT = './shared-modules';
var MODULE_REQUIRES = ['CalendarUtils', 'ModalDialogAPI'];

const sleep = 500;
var hour = 8;
var calendar;
var uri;
var file;
var title;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
  
  // unique name needed as deleting a calendar only unsubscribes from it
  // and if same file were used on next testrun then previously created event would show up
  let time = (new Date()).getTime() + '';
  calendar = time;
  title = time;
  
  file = Components.classes["@mozilla.org/file/directory_service;1"]
                   .getService(Components.interfaces.nsIProperties)
                   .get("TmpD", Components.interfaces.nsIFile);
  file.append(calendar + ".ics");
  let fileURI = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService)
                          .newFileURI(file);
  uri = fileURI.prePath + fileURI.path;
}

var testLocalICS = function () {
  controller.click(new elementslib.ID(controller.window.document,"calendar-tab-button"));
  controller.sleep(sleep);
  CalendarUtils.switchToView("day", controller);
  
  let md = new ModalDialogAPI.modalDialog(handleNewCalendarWizard);
  md.start();
  controller.click(new elementslib.Elem(controller
    .menus["menu_File"]["menu_New"]["ltnNewCalendar"]));
  controller.sleep(sleep);
  
  // create new event
  controller.doubleClick(new elementslib.Lookup(controller.window.document,
    CalendarUtils.getEventBoxPath("day", CalendarUtils.CANVAS_BOX, undefined, 1, hour,
    controller)));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils
    .getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  // title
  event.type(new elementslib.Lookup(event.window.document, '/id("calendar-event-dialog")/'
    + 'id("event-grid")/id("event-grid-rows")/id("event-grid-title-row")/'
    + 'id("item-title")/anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    title);
  
  // set calendar
  event.select(new elementslib.ID(event.window.document, "item-calendar"), undefined,
    calendar);
  
  // save
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // assert presence in view
  let box = CalendarUtils.getEventBoxPath("day", CalendarUtils.EVENT_BOX, undefined, 1, hour,
    controller) + '/{"tooltip":"itemTooltip","calendar":"' + calendar + '"}';
  controller.assertNode(new elementslib.Lookup(controller.window.document, box));
  
  // verify in file
  let contents = "";
  let fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                          .createInstance(Components.interfaces.nsIFileInputStream);
  let cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                          .createInstance(Components.interfaces.nsIConverterInputStream);
  
  fstream.init(file, -1, 0, 0);
  cstream.init(fstream, "UTF-8", 0, 0);
  
  let (str = {}) {
    cstream.readString(-1, str);
    contents = str.value;
  }
  
  cstream.close();
  controller.assertJS(contents.indexOf("SUMMARY:" + title) != -1);
}

var teardownTest = function(module) {
  CalendarUtils.deleteCalendars(calendar);
}

function handleNewCalendarWizard(wizard) {
  let buttonDeck = '/id("calendar-wizard")/anon({"anonid":"Buttons"})/'
    + 'anon({"class":"wizard-buttons-box-1"})/{"class":"wizard-buttons-box-2"}/'
    + 'anon({"anonid":"WizardButtonDeck"})';
  let nextButton = buttonDeck + '/[1]/{"dlgtype":"next"}';
  let finishButton = buttonDeck + '/[0]/{"dlgtype":"finish"}';
  
  // choose network calendar
  wizard.sleep(sleep);
  wizard.click(new elementslib.Lookup(wizard.window.document, '/id("calendar-wizard")/'
    + '{"pageid":"initialPage"}/id("calendar-type")/{"value":"remote"}'));
  wizard.click(new elementslib.Lookup(wizard.window.document, nextButton));
  wizard.sleep(sleep);
  
  // choose ical
  wizard.click(new elementslib.Lookup(wizard.window.document, '/id("calendar-wizard")/'
    + '{"pageid":"locationPage"}/[1]/[1]/[0]/{"value":"ics"}'));
  // enter location
  wizard.type(new elementslib.Lookup(wizard.window.document, '/id("calendar-wizard")/'
    + '{"pageid":"locationPage"}/[1]/[1]/{"align":"center"}/id("calendar-uri")/'
    + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
    uri);
  wizard.click(new elementslib.Lookup(wizard.window.document, nextButton));
  wizard.sleep(sleep);
  
  // name is filled in automatically using filename
  wizard.click(new elementslib.Lookup(wizard.window.document, nextButton));
  wizard.sleep(sleep);
  
  // finish
  wizard.click(new elementslib.Lookup(wizard.window.document, finishButton));
}
