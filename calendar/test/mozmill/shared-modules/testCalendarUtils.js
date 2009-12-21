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

const MODULE_NAME = 'CalendarUtils';

const RELATIVE_ROOT = '.';
const MODULE_REQUIRES = ['ModalDialogAPI'];

const sleep = 500;
const EVENT_BOX = 0; // Use when you need an event box
const CANVAS_BOX = 1; // Use when you need a calendar canvas box
const ALLDAY = 2; // Use when you need an allday canvas or event box

/**
 *  Accept to send notification email with event to attendees
 */
function acceptSendingNotificationMail(){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      dialog.waitThenClick(new elementslib.Lookup(dialog.window.document, '/id("commonDialog")/'
        + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
    }
  );
  md.start();
}

/**
 *  Add an attachment with url
 */
function handleAddingAttachment(url){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(attachment){
      attachment.sleep(sleep);
      attachment.type(new elementslib.Lookup(attachment.window.document, '/id("commonDialog")/[4]/'
        + '[1]/id("loginContainer")/id("loginTextbox")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'), url);
      attachment.click(new elementslib.Lookup(attachment.window.document, '/id("commonDialog")/'
      + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
    }
  );
  md.start();
}

/**
 *  Choose to delete just one occurrence of a repeating event
 *  @attendees whether there are attendees that can be notified or not
 */
function handleOccurrenceDeletion(attendees){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      if(attendees)
        acceptSendingNotificationMail();
      dialog.waitThenClick(new elementslib.ID(dialog.window.document, "accept-occurrence-button"));
    }
  );
  md.start();
}

/**
 *  Choose to delete all occurrences of a repeating event
 *  @attendees whether there are attendees that can be notified or not
 */
function handleParentDeletion(attendees){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      if(attendees)
        acceptSendingNotificationMail();
      dialog.waitThenClick(new elementslib.ID(dialog.window.document, "accept-parent-button"));
    }
  );
  md.start();
}

/**
 *  Choose to modify just one occurrence of a repeating event
 *  @attendees whether there are attendees that can be notified or not
 */
function handleOccurrenceModification(attendees){
  handleOccurrenceDeletion(attendees);
}

/**
 *  Choose to modify all occurrences of a repeating event
 *  @attendees whether there are attendees that can be notified or not
 */
function handleParentModification(attendees){
  handleParentDeletion(attendees);
}

/**
 *  Switch to a view
 *  @param view - day, week, multiweek or month
 */
function switchToView(view, controller){
  switch(view){
    case "week":
      controller.click(new elementslib.ID(controller.window.document,
        "calendar-week-view-button"));
    break;
  case "multiweek":
    controller.waitThenClick(new elementslib.ID(controller.window.document,
        "calendar-multiweek-view-button"));
      break;
  case "month":
      controller.waitThenClick(new elementslib.ID(controller.window.document,
        "calendar-month-view-button"));
    break;
  default:
    controller.waitThenClick(new elementslib.ID(controller.window.document,
      "calendar-day-view-button"));
  }
  controller.sleep(500);
}

/**
 *  Go to a specific date using minimonth
 *  @param year - four-digit year
 *  @param month - 1-based index of a month
 *  @param day - 1-based index of a day
 *  @param controller - main window controller
 */
function goToDate(year, month, day, controller){
  let miniMonth = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/'
    + 'id("minimonth-pane")/{"align":"center"}/id("calMinimonthBox")/id("calMinimonth")/';
  let activeYear = (new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"years-popup"})/[0]/{"current":"true"}')).getNode().getAttribute("value");
  let yearDifference = activeYear - year;
  
  let scrollArrow = yearDifference > 0 ?
    (new elementslib.Lookup(controller.window.document, miniMonth
      + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
      + 'anon({"anonid":"years-popup"})/[0]/{"class":"autorepeatbutton-up"}')).getNode() :
    (new elementslib.Lookup(controller.window.document, miniMonth
      + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
      + 'anon({"anonid":"years-popup"})/[0]/{"class":"autorepeatbutton-down"}')).getNode();
  
  // pick year
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"yearcell"})'));
  controller.sleep(500);
  
  for(let i = 0; i < Math.abs(yearDifference); i++){
    scrollArrow.doCommand();
    controller.sleep(100);
  }
  
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"years-popup"})/[0]/{"value":"' + year + '"}'));
  controller.sleep(500);
  
  // pick month
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"monthheader"})'));
  controller.sleep(500);
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"months-popup"})/[0]/{"index":"' + (month - 1) + '"}'));
  controller.sleep(500);

  let lastDayInFirstRow = (new elementslib.Lookup(controller.window.document,
    miniMonth + 'anon({"anonid":"minimonth-calendar"})/[1]/[6]')).getNode().getAttribute("value");
  let positionOfFirst = 7 - lastDayInFirstRow;
  let dateColumn = (positionOfFirst + day - 1) % 7;
  let dateRow = Math.floor((positionOfFirst + day - 1) / 7);
  
  // pick day
  controller.click(new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-calendar"})/[' + (dateRow + 1) + ']/[' + dateColumn + ']'));
  controller.sleep(1000);
}

/**
 *  @param view - day, week, multiweek or month
 *  @param option - bg for creating event, fg for checking
 *  @param row - only used in multiweek and month view, 1-based index of a row
 *  @param column - 1-based index of a column
 *  @param hour - index of hour box
 *  @param controller - main window controller
 *  @returns path string
 */
function getEventBoxPath(view, option, row, column, hour, controller){
  let viewDeck = '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/'
    + 'id("tabpanelcontainer")/id("calendarTabPanel")/id("calendarContent")/'
    + 'id("calendarDisplayDeck")/id("calendar-view-box")/id("view-deck")';
  let dayView = viewDeck + '/id("day-view")';
  let weekView = viewDeck + '/id("week-view")';
  let multiweekView = viewDeck + '/id("multiweek-view")';
  let monthView = viewDeck + '/id("month-view")';
  
  let path = '';
  switch(view){
    case "week":
      path += weekView;
      break;
    case "multiweek":
      path += multiweekView;
      break;
    case "month":
      path += monthView;
      break;
    default: path += dayView;
  }
  
  if((view == "day" || view == "week") && option == ALLDAY){
    path += '/anon({"anonid":"mainbox"})/anon({"anonid":"headerbox"})/anon({"anonid":"headerdaybox"})';
    path += '/[' + (column - 1) + ']';
    
    return path;
  }
  else if(view == "day" || view == "week"){
    path += '/anon({"anonid":"mainbox"})/anon({"anonid":"scrollbox"})/anon({"anonid":"daybox"})';
    path += '/[' + (column - 1) + ']';
    path += '/anon({"anonid":"boxstack"})';
    
    if(option == CANVAS_BOX)
      path += '/anon({"anonid":"bgbox"})/[' + hour + ']';
    else
      path += '/anon({"anonid":"topbox"})/{"flex":"1"}/{"flex":"1"}/{"flex":"1"}';
    
    return path;
  }
  else{
    path += '/anon({"anonid":"mainbox"})/anon({"anonid":"monthgrid"})/'
      + 'anon({"anonid":"monthgridrows"})/[' + (row - 1) + ']/[' + (column - 1) + ']';
  
    if(option == CANVAS_BOX)
      path += '/anon({"anonid":"day-items"})';
    
    return path;
  }
}

/**
 * @param n - how many times next button in view is clicked
 */
function forward(n){
  for(let i = 0; i < n; i++){
    controller.click(new elementslib.ID(controller.window.document, "next-view-button"));
    controller.sleep(sleep);
  }
}
