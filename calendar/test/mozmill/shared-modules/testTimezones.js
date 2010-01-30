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
 
const MODULE_NAME = 'TimezoneUtils';
const sleep = 500;

const RELATIVE_ROOT = '.';
const MODULE_REQUIRES = ['CalendarUtils', 'PrefsAPI'];

function switchAppTimezone(timezone) {
  // change directly as Mac has different Lookup & XPath than Windows & Linux, bug 536605
  let api = collector.getModule('PrefsAPI');
  api.preferences.setPref("calendar.timezone.local", timezone);
}

function verify(dates, timezones, times, controller) {
  let dayView = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/'
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")/id("day-view")';
  let dayStack = dayView + '/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/'
    + 'anon({"anonid":"daybox"})/[0]/anon({"anonid":"boxstack"})/anon({"anonid":"topbox"})/'
    + '{"flex":"1"}';
  let timeLine = dayView + '/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"timebar"})/'
    + 'anon({"anonid":"topbox"})/';
  let allowedDifference = 3;
  
  /* Event box' time can't be deduced from it's position in                    ----------------
     xul element tree because for each event a box is laid over whole day and  |___spacer_____|
     a spacer is added to push the event to it's correct location.             |__event_box___|
     But timeline can be used to retrieve the position of a particular hour    |day continues |
     on screen and it can be compared against the position of the event.       ----------------
  */
  for (let date = 0; date < dates.length; date++) {
    let utils = collector.getModule('CalendarUtils');
    utils.goToDate(dates[date][0], dates[date][1], dates[date][2], controller);
    
    // find event with timezone tz
    for (let tz = 0; tz < timezones.length; tz++) {
      let found = false;
      
      let correctHour = times[date][tz][0];
      let minutes = times[date][tz][1];
      let day = times[date][tz][2];
      
      let timeNode = (new elementslib.Lookup(controller.window.document, 
                                             timeLine + '[' + correctHour + ']')).getNode();
      let timeY = timeNode.boxObject.y;
      timeY += timeNode.boxObject.height * (minutes / 60);
      
      let stackNode;
      let eventNodes = new Array();
      
      // same day
      if(day == undefined) {
        stackNode = (new elementslib.Lookup(controller.window.document, dayStack)).getNode();
      }
      
      // following day
      if(day != undefined && day == 1) {
        utils.forward(1);
        stackNode = (new elementslib.Lookup(controller.window.document, dayStack)).getNode();
      }
      
      // previous day
      if(day != undefined && day == -1) {
        utils.back(1);
        stackNode = (new elementslib.Lookup(controller.window.document, dayStack)).getNode();
      }
      
      utils.findEventsInNode(stackNode, eventNodes);
      
      for each (node in eventNodes) {
        if (Math.abs(timeY - node.boxObject.y) < allowedDifference &&
                     timezones[tz] == node.mOccurrence.title) {
          found = true;
          break;
        }
      }
      
      if(day != undefined && day == 1) {
        utils.back(1);
      }
      
      if(day != undefined && day == -1) {
        utils.forward(1);
      }
      controller.assertJS(found == true);
    }
  }
}
