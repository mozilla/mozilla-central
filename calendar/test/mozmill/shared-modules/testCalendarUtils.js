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
const MODULE_REQUIRES = ['ModalDialogAPI', 'UtilsAPI'];

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
      let input = new elementslib.ID(attachment.window.document, 'loginTextbox');
      attachment.waitForElement(input);
      input.getNode().value = url;
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
  let activeMonth = (new elementslib.Lookup(controller.window.document, miniMonth
    + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
    + 'anon({"anonid":"months-popup"})/[0]/{"current":"true"}')).getNode().getAttribute("index");
  let yearDifference = activeYear - year;
  let monthDifference = activeMonth - (month - 1);
  
  if (yearDifference != 0) {
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
  }
  
  if (monthDifference != 0) {
    // pick month
    controller.click(new elementslib.Lookup(controller.window.document, miniMonth
      + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"monthheader"})/[' + activeMonth
      + ']'));
    controller.sleep(500);
    controller.click(new elementslib.Lookup(controller.window.document, miniMonth
      + 'anon({"anonid":"minimonth-header"})/anon({"anonid":"minmonth-popupset"})/'
      + 'anon({"anonid":"months-popup"})/[0]/{"index":"' + (month - 1) + '"}'));
    controller.sleep(500);
  }
  
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

/**
 * @param n - how many times previous button in view is clicked
 */
function back(n){
  for(let i = 0; i < n; i++){
    controller.click(new elementslib.ID(controller.window.document, "previous-view-button"));
    controller.sleep(sleep);
  }
}

/**
 * Deletes all calendars with given name
 * @param name - calendar name
 */
function deleteCalendars(name){
  let defaultView = (new elementslib.ID(controller.window.document, "messengerWindow"))
                    .getNode().ownerDocument.defaultView;
  let manager = defaultView.getCalendarManager();
  let cals = manager.getCalendars({});

  for (let i = 0; i < cals.length; i++)
    if (cals[i].name == name){
      manager.unregisterCalendar(cals[i]);
      manager.deleteCalendar(cals[i]);
    }
}

/**
 * Creates local calendar with given name and select it in calendars list
 * @param name - calendar name
 */
function createCalendar(name){
  let defaultView = (new elementslib.ID(controller.window.document, "messengerWindow"))
                    .getNode().ownerDocument.defaultView;
  let manager = defaultView.getCalendarManager();

  let url = defaultView.makeURL("moz-profile-calendar://");
  let calendar = manager.createCalendar("storage", url);
  calendar.name = name;
  manager.registerCalendar(calendar);
  
  let id = calendar.id;
  let calendarTree = (new elementslib.Lookup(controller.window.document,
    '/id("messengerWindow")/id("tabmail-container")/id("tabmail")/id("tabpanelcontainer")/'
    + 'id("calendarTabPanel")/id("calendarContent")/id("ltnSidebar")/id("calendar-panel")/'
    + 'id("calendar-list-pane")/id("calendar-listtree-pane")/id("calendar-list-tree-widget")'))
    .getNode();
  for(i = 0; i < calendarTree.mCalendarList.length; i++)
    if(calendarTree.mCalendarList[i].id == id)
      calendarTree.tree.view.selection.select(i);
}

/**
 * Retrieves array of all calendar-event-box elements in node
 * @param node - node to be searched
 * @param eventNodes - array where to put resultíng nodes
 */
function findEventsInNode(node, eventNodes) {
  if(node.tagName == "calendar-event-box") {
    eventNodes.push(node);
    return;
  }
  else if(node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      findEventsInNode(node.children[i], eventNodes);
    }
  }
}

/**
 *  Helper function to enter event dialog data
 *  @param data - dataset object
 *                  title - event title
 *                  location - event location
 *                  description - event description
 *                  category - category label
 *                  allday - boolean value
 *                  startdate - Date object
 *                  starttime - Date object
 *                  enddate - Date object
 *                  endtime - Date object
 *                  timezone - false for local, true for set timezone
 *                  repeat - reccurrence value, one of none/daily/weekly/every.weekday/bi.weekly/
 *                           monthly/yearly/custom
 *                  reminder - reminder option index
 *                  priority - none/low/normal/high
 *                  privacy - public/confidential/private
 *                  status - none/tentative/confirmed/cancelled
 *                  freebusy - free/busy
 *                  attachment.add - url to add
 *                  attachment.remove - label of url to remove (without http://)
 *  @param event - event controller
 */
function setData(data, event) {
  let eventDialog = '/id("calendar-event-dialog")/id("event-grid")/id("event-grid-rows")/';
  let dateInput = 'anon({"anonid":"hbox"})/anon({"anonid":"date-picker"})/'
    + 'anon({"class":"datepicker-box-class"})/{"class":"datepicker-text-class"}/'
    + 'anon({"class":"menulist-editable-box textbox-input-box"})/anon({"anonid":"input"})';
  let timeInput = 'anon({"anonid":"hbox"})/anon({"anonid":"time-picker"})/'
    + 'anon({"class":"timepicker-box-class"})/anon({"class":"timepicker-text-class"})/'
    + 'anon({"flex":"1"})/anon({"anonid":"input"})'
  let startDateInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-startdate-row")/id("event-grid-startdate-picker-box")/id("event-starttime")/'
    + dateInput);
  let endDateInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-enddate-row")/[1]/id("event-grid-enddate-picker-box")/id("event-endtime")/'
    + dateInput);
  let startTimeInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-startdate-row")/id("event-grid-startdate-picker-box")/id("event-starttime")/'
    + timeInput);
  let endTimeInput = new elementslib.Lookup(event.window.document, eventDialog
    + 'id("event-grid-enddate-row")/[1]/id("event-grid-enddate-picker-box")/id("event-endtime")/'
    + timeInput);
  let dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                              .getService(Components.interfaces.nsIScriptableDateFormat);
  let utilsapi = collector.getModule('UtilsAPI');
  let mac = utilsapi.appInfo.os.toLowerCase().indexOf("darwin") != -1;
  // wait for input elements' values to be populated
  event.sleep(sleep);
  
  // title
  if (data.title != undefined) {
    if (!mac) {
      event.keypress(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'),
        'a', {ctrlKey: true});
      event.type(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-title-row")/id("item-title")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'),
        data.title);
    } else {
      let titleField = new elementslib.ID(event.window.document, "item-title");
      titleField.getNode().value = data.title;
    }
  }
  
  // location
  if (data.location != undefined) {
    if (!mac) {
      event.keypress(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'),
        'a', {ctrlKey: true});
      event.type(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-location-row")/id("item-location")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'),
        data.location);
    } else {
      let locationField = new elementslib.ID(event.window.document, "item-location");
      locationField.getNode().value = data.location;
    }
  }
  
  // category
  if (data.category != undefined) {
    event.select(new elementslib.ID(event.window.document, "item-categories"), undefined,
      data.category);
    event.sleep(sleep);
  }
  
  // all-day
  if (data.allday != undefined) {
    event.check(new elementslib.ID(event.window.document, "event-all-day"), data.allday);
  }
  
  // timezone
  if (data.timezone != undefined) {
    let menuitem = new elementslib.Elem(event.menus["options-menu"]["options-timezone-menuitem"]);
    menuitem.getNode().setAttribute("checked", data.timezone);
    event.click(menuitem);
  }
  
  // startdate
  if (data.startdate != undefined && data.startdate.constructor.name == 'Date') {
    let startdate = dateService.FormatDate("", dateService.dateFormatShort,
      data.startdate.getFullYear(), data.startdate.getMonth() + 1, data.startdate.getDate());
    if (utilsapi.appInfo.os.toLowerCase().indexOf("darwin") == -1) {
      event.keypress(startDateInput, 'a', {ctrlKey: true});
      event.type(startDateInput, startdate);
    } else {
      startDateInput.getNode().value = startdate;
    }
  }
  
  // starttime
  if (data.starttime != undefined && data.starttime.constructor.name == 'Date') {
    let starttime = dateService.FormatTime("", dateService.timeFormatNoSeconds,
      data.starttime.getHours(), data.starttime.getMinutes(), 0);
    if (utilsapi.appInfo.os.toLowerCase().indexOf("darwin") == -1) {
      event.keypress(startTimeInput, 'a', {ctrlKey: true});
      event.type(startTimeInput, starttime);
    } else {
      startTimeInput.getNode().value = starttime;
      event.sleep(sleep);
    }
  }
  
  if (data.enddate != undefined && data.enddate.constructor.name == 'Date') {
    let enddate = dateService.FormatDate("", dateService.dateFormatShort,
      data.enddate.getFullYear(), data.enddate.getMonth() + 1, data.enddate.getDate());
    if (utilsapi.appInfo.os.toLowerCase().indexOf("darwin") == -1) {
      event.keypress(endDateInput, 'a', {ctrlKey: true});
      event.type(endDateInput, enddate);
    } else {
      endDateInput.getNode().value = enddate;
    }
  }
  
  // endttime
  if (data.endtime != undefined && data.endtime.constructor.name == 'Date') {
    let endtime = dateService.FormatTime("", dateService.timeFormatNoSeconds,
      data.endtime.getHours(), data.endtime.getMinutes(), 0);
    if (utilsapi.appInfo.os.toLowerCase().indexOf("darwin") == -1) {
      event.keypress(endTimeInput, 'a', {ctrlKey:true});
      event.type(endTimeInput, endtime);
    } else {
      endTimeInput.getNode().value = endtime;
      event.sleep(sleep);
    }
  }
  
  // recurrence
  if (data.repeat != undefined) {
    event.select(new elementslib.ID(event.window.document, "item-repeat"), undefined, undefined,
      data.repeat);
  }
  
  // reminder
  if (data.reminder != undefined) {
    event.select(new elementslib.ID(event.window.document, "item-alarm"), data.reminder);
  }
  
  // description
  if (data.description != undefined) {
    if (!mac) {
      event.keypress(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-description-row")/id("item-description")/'
        + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
        'a', {ctrlKey: true});
      event.type(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-description-row")/id("item-description")/'
        + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})'),
        data.description);
    } else {
      let descField = new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-description-row")/id("item-description")/'
        + 'anon({"class":"textbox-input-box"})/anon({"anonid":"input"})');
      descField.getNode().value = data.description;
    }
  }
  
  // priority
  if (data.priority != undefined) {
    event.click(new elementslib.Elem(event
      .menus["options-menu"]["options-priority-menu"]["options-priority-" + data.priority
      + "-label"]));
  }
  
  // privacy
  if (data.privacy != undefined) {
    event.click(new elementslib.Elem(event
      .menus["options-menu"]["options-privacy-menu"]["options-privacy-" + data.privacy
      + "-menuitem"]));
  }
  
  // status
  if (data.status != undefined) {
    event.click(new elementslib.Elem(event
      .menus["options-menu"]["options-status-menu"]["options-status-" + data.status
      + "-menuitem"]));
  }
  
  // free/busy
  if (data.freebusy != undefined) {
    event.click(new elementslib.Elem(event
      .menus["options-menu"]["options-freebusy-menu"]["options-freebusy-" + data.freebusy
      + "-menuitem"]));
  }
  
  // attachment
  if (data.attachment != undefined) {
    if (data.attachment.add != undefined) {
      handleAddingAttachment(data.attachment.add);
      event.click(new elementslib.ID(event.window.document, "button-url"));
    }
    if (data.attachment.delete != undefined) {
      event.click(new elementslib.Lookup(event.window.document, eventDialog
        + 'id("event-grid-attachment-row")/id("attachment-link")/{"label":"' +
        data.attachment.delete + '"}'));
      event.keypress(new elementslib.ID(event.window.document, "attachment-link"), "VK_DELETE", {});
    }
  }
  
  event.sleep(sleep);
}