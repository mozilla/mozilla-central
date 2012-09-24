/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

(function load_lightning_manifest() {
  let bindir = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties)
                         .get("CurProcD", Components.interfaces.nsIFile);
  bindir.append("extensions");
  bindir.append("{e2fda1a4-762b-4020-b5ad-a41df1933103}");
  bindir.append("chrome.manifest");
  Components.manager.autoRegister(bindir);
})();

Components.utils.import("resource://calendar/modules/calUtils.jsm");

// we might want to use calUtils.jsm only in the future throughout all tests,
// but for now source in good old calUtils.js:
cal.loadScripts(["calUtils.js"], Components.utils.getGlobalForObject(Cc));

function createDate(aYear, aMonth, aDay, aHasTime, aHour, aMinute, aSecond, aTimezone) {
    var cd = Cc["@mozilla.org/calendar/datetime;1"]
             .createInstance(Ci.calIDateTime);
    cd.resetTo(aYear,
               aMonth,
               aDay,
               aHour || 0,
               aMinute || 0,
               aSecond || 0,
               aTimezone || UTC());
    cd.isDate = !aHasTime;
    return cd;
}

function createEventFromIcalString(icalString) {
    if (/^BEGIN:VCALENDAR/.test(icalString)) {
        var parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                               .createInstance(Components.interfaces.calIIcsParser);
        parser.parseString(icalString);
        var items = parser.getItems({});
        ASSERT(items.length == 1);
        return items[0];
    } else {
        var event = Cc["@mozilla.org/calendar/event;1"].createInstance(Ci.calIEvent);
        event.icalString = icalString;
    }
    return event;
}

function createTodoFromIcalString(icalString) {
    var todo = Cc["@mozilla.org/calendar/todo;1"]
               .createInstance(Ci.calITodo);
    todo.icalString = icalString;
    return todo;
}

function getMemoryCal() {
    // create memory calendar
    var memoryCalendar = Cc["@mozilla.org/calendar/calendar;1?type=memory"]
                         .createInstance(Ci.calISyncWriteCalendar);

    // remove existing items
    var calendar = memoryCalendar.QueryInterface(Ci.calICalendarProvider);
    try {
        calendar.deleteCalendar(calendar, null);
    } catch (e) {
        print("*** error purging calendar: " + e);
    }
    return memoryCalendar;
}

function getStorageCal() {
    var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties);
    var db = dirSvc.get("TmpD", Ci.nsIFile);
    db.append("test_storage.sqlite");

    // create URI
    var uri = Services.io.newFileURI(db);

    // Make sure timezone service is initialized
    Components.classes["@mozilla.org/calendar/timezone-service;1"]
              .getService(Components.interfaces.calIStartupService)
              .startup(null);

    // create storage calendar
    var stor = Cc["@mozilla.org/calendar/calendar;1?type=storage"]
              .createInstance(Ci.calISyncWriteCalendar);
    stor.uri = uri;
    stor.id = cal.getUUID();

    // remove existing items
    var calendar = stor.QueryInterface(Ci.calICalendarProvider);
    try {
        calendar.deleteCalendar(calendar, null);
    } catch (e) {
        print("*** error purging calendar: " + e);
    }
    return stor;
}

/**
 * Return an item property as string.
 * @param aItem
 * @param string aProp possible item properties: start, end, duration,
 *                     generation, title,
 *                     id, calendar, creationDate, lastModifiedTime,
 *                     stampTime, priority, privacy, status,
 *                     alarmLastAck, recurrenceStartDate
 *                     and any property that can be obtained using getProperty()
 */
function getProps(aItem, aProp) {
    var value = null;
    switch (aProp) {
        case "start":
            value = aItem.startDate || aItem.entryDate || null;
            break;
        case "end":
            value = aItem.endDate || aItem.dueDate || null;
            break;
        case "duration":
            value = aItem.duration || null;
            break;
        case "generation":
            value = aItem.generation;
            break;
        case "title":
            value = aItem.title;
            break;
        case "id":
            value = aItem.id;
            break;
        case "calendar":
            value = aItem.calendar.id;
            break;
        case "creationDate":
            value = aItem.creationDate;
            break;
        case "lastModifiedTime":
            value = aItem.lastModifiedTime;
            break;
        case "stampTime":
            value = aItem.stampTime;
            break;
        case "priority":
            value = aItem.priority;
            break;
        case "privacy":
            value = aItem.privacy;
            break;
        case "status":
            value = aItem.status;
            break;
        case "alarmLastAck":
            value = aItem.alarmLastAck;
            break;
        case "recurrenceStartDate":
            value = aItem.recurrenceStartDate;
            break;
        default:
            value = aItem.getProperty(aProp);
    }
    if (value) {
        return value.toString();
    } else {
        return null;
    }
}

function compareItemsSpecific(aLeftItem, aRightItem, aPropArray) {
    if (!aPropArray) {
        // left out:  "id", "calendar", "lastModifiedTime", "generation",
        // "stampTime" as these are expected to change
        aPropArray = ["start", "end", "duration",
                      "title", "priority", "privacy", "creationDate",
                      "status", "alarmLastAck",
                      "recurrenceStartDate"];
    }
    for (var i = 0; i < aPropArray.length; i++) {
        do_check_eq(getProps(aLeftItem, aPropArray[i]),
                    getProps(aRightItem,
                    aPropArray[i]));
    }
}

/**
 * Test whether specified function throws exception with expected
 * result.
 *
 * @param func
 *        Function to be tested.
 * @param result
 *        Expected result. <code>null</code> for no throws.
 * @param stack
 *        Optional stack object to be printed. <code>null</code> for
 *        Components#stack#caller.
 */
function do_check_throws(func, result, stack)
{
  if (!stack)
    stack = Components.stack.caller;

  try {
    func();
  } catch (exc) {
    if (exc.result == result)
      return;
    do_throw("expected result " + result + ", caught " + exc, stack);
  }

  if (result) {
    do_throw("expected result " + result + ", none thrown", stack);
  }
}

function ics_foldline(aLine) {
  const NEWLINE_CHAR = "\r\n";
  const FOLD_LENGTH = 74;
  let result = "";
  let line = aLine || "";

  while (line.length) {
    result += NEWLINE_CHAR + " " + line.substr(0, FOLD_LENGTH);
    line = line.substr(FOLD_LENGTH);
  }
  return result.substr(NEWLINE_CHAR.length + 1);
}
