/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
var calUtils = require("calendar-utils");
var prefs = require("prefs");

const sleep = 500;

function switchAppTimezone(timezone) {
  // change directly as Mac has different Lookup & XPath than Windows & Linux, bug 536605
  prefs.preferences.setPref("calendar.timezone.local", timezone);
}

function verify(controller, dates, timezones, times) {
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
    calUtils.goToDate(controller, dates[date][0], dates[date][1], dates[date][2]);
    
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
        calUtils.forward(controller, 1);
        stackNode = (new elementslib.Lookup(controller.window.document, dayStack)).getNode();
      }
      
      // previous day
      if(day != undefined && day == -1) {
        calUtils.back(controller, 1);
        stackNode = (new elementslib.Lookup(controller.window.document, dayStack)).getNode();
      }
      
      calUtils.findEventsInNode(stackNode, eventNodes);
      
      for each (node in eventNodes) {
        if (Math.abs(timeY - node.boxObject.y) < allowedDifference &&
                     timezones[tz] == node.mOccurrence.title) {
          found = true;
          break;
        }
      }
      
      if(day != undefined && day == 1) {
        calUtils.back(controller, 1);
      }
      
      if(day != undefined && day == -1) {
        calUtils.forward(controller, 1);
      }
      controller.assertJS(found == true);
    }
  }
}

// Export of functions
exports.switchAppTimezone = switchAppTimezone;
exports.verify = verify;
