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

var sleep = 500;

var setupModule = function(module) {
  controller = mozmill.getMail3PaneController();
}

var testTodayPane = function () {
  // paths
  let panels = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/';
  let miniMonth = panels + 'id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/'
    + 'id("minimonth-pane")/';
  let dayView = panels + 'id("calendarTabPanel")/id("calendarContent")/id("calendarDisplayDeck")/'
    + 'id("calendar-view-box")/id("view-deck")/id("day-view")/';
  let dayPath = dayView + 'anon({"anonid":"mainbox"})/anon({"anonid":"labelbox"})/'
    + 'anon({"anonid":"labeldaybox"})/{"flex":"1"}';
  let eventName = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/'
    + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
    + 'anon({"anonid":"input"})';
  
  // open calendar view
  controller.click(new elementslib.ID(controller.window.document, "calendar-tab-button"));
  controller.waitThenClick(new elementslib.ID(controller.window.document, "calendar-day-view-button"));
  controller.sleep(sleep);
  
  // go to today and verify date
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + '{"align":"center"}/id("calMinimonthBox")/id("calMinimonth")/'
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"today-button"})'));
  let dayNode = (new elementslib.Lookup(controller.window.document, dayPath)).getNode();
  controller.assertJS(dayNode.mDate.icalString == getIsoDate());

  // create event 6 hours from now, if this is tomorrow then at 23 today
  // doubleclick only triggers new event dialog on visible boxes, so scrolling may be needed
  // by default visible time is 08:00 - 17:00, box of 17th hour is out of view
  let hour = (new Date()).getHours();
  let startHour = (hour < 18)? hour + 6 : 23;
  let view = (new elementslib.Lookup(controller.window.document, dayView)).getNode();
  
  if(startHour < 8 || startHour > 16)
    view.scrollToMinute(60 * startHour);
    
  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[' + startHour + ']'));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  let event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  event.type(new elementslib.Lookup(event.window.document, eventName),"Today's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // reset view
  view.scrollToMinute(60 * 8);
  
  // go to tomorrow and add an event
  controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[9]'));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  event.type(new elementslib.Lookup(event.window.document, eventName),"Tomorrow's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // go 5 days forward and add an event
  for(let i = 0; i < 5; i++)
    controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
  controller.sleep(sleep);
  
  controller.doubleClick(new elementslib.Lookup(controller.window.document, dayView
    + 'anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})/'
    + '{"class":"calendar-event-column-even"}/anon({"anonid":"boxstack"})/'
    + 'anon({"anonid":"bgbox"})/[9]'));
  controller.waitForEval('utils.getWindows("Calendar:EventDialog").length > 0', sleep);
  event = new mozmill.controller.MozMillController(mozmill.utils.getWindows("Calendar:EventDialog")[0]);
  event.sleep(sleep);
  
  event.type(new elementslib.Lookup(event.window.document, eventName),"Future's Event");
  event.click(new elementslib.ID(event.window.document, "button-save"));
  controller.sleep(sleep);
  
  // go to mail tab
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("tabmail")/anon({"anonid":"tabbox"})/anon({"anonid":"strip"})/'
    + 'anon({"anonid":"tabcontainer"})/{"type":"folder","first-tab":"true"}/'
    + 'anon({"class":"tab-image-middle"})/{"class":"tab-text"}'));
  controller.sleep(sleep);
  
  // verify today pane open
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/{"collapsed":"true"}'));
  
  // verify today pane's date
  controller.assertValue(new elementslib.ID(controller.window.document, "datevalue-label"),
    (new Date()).getDate());
    
  // tomorrow and soon are collapsed by default
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("tomorrow-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("nextweek-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.sleep(sleep);
  
  // verify events shown in today pane
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[1]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Today's Event");
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[3]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Tomorrow's Event");
  controller.assertValue(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[5]/anon({"anonid":"agenda-container-box"})/'
    + 'anon({"anonid":"agenda-description"})/[1]'),
    "Future's Event");
  
  // delete events
  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[1]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.sleep(sleep);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[5]'));
    
  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[2]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.sleep(sleep);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[4]'));
  
  controller.click(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[3]'));
  controller.keypress(new elementslib.ID(controller.window.document, "agenda-listbox"),
    "VK_DELETE",
    {});
  controller.sleep(sleep);
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[3]'));
    
  // hide and verify today pane hidden
  controller.click(new elementslib.ID(controller.window.document, "calendar-status-todaypane-button"));
  controller.assertNode(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/{"collapsed":"true"}'));
  
  // reset today pane
  controller.click(new elementslib.ID(controller.window.document, "calendar-status-todaypane-button"));
  controller.assertNodeNotExist(new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/{"collapsed":"true"}'));
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("tomorrow-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.click(new elementslib.Lookup(controller.window.document, '/id("messengerWindow")/'
    + 'id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/[3]/'
    + 'id("agenda-listbox")/id("nextweek-header")/anon({"anonid":"agenda-checkbox-widget"})/'
    + 'anon({"class":"checkbox-check"})'));
  controller.sleep(sleep);
  
  // verify tomorrow and soon collapsed
  let tomorrow = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[1]/anon({"class":"agenda-checkbox"})')).getNode();
  let soon = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("today-pane-panel")/[1]/id("agenda-panel")/'
    + '{"flex":"1"}/id("agenda-listbox")/[2]/anon({"class":"agenda-checkbox"})')).getNode();
  controller.assertJS(!tomorrow.hasAttribute("checked")
    || tomorrow.getAttribute("checked") != "true");
  controller.assertJS(!soon.hasAttribute("checked")
    || soon.getAttribute("checked") != "true");
}

var getIsoDate = function() {
  let date = new Date();
  let year = date.getFullYear();
  let month = (date.getMonth() < 9)? '0' + (date.getMonth() + 1) : (date.getMonth() + 1);
  let day = (date.getDate() < 10)? '0' + date.getDate() : date.getDate();
  let isoDate = year + '' + month + '' + day;
  return isoDate;
}
