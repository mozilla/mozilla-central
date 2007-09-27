/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Robin Edrenius <robin.edrenius@gmail.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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


function OpCompleteListener(respFunc) {
    this.mRespFunc = respFunc;
}
OpCompleteListener.prototype = {
    onOperationComplete: function opc_onOperationComplete(calendar, status, opType, id, detail) {
        this.mRespFunc(Components.isSuccessCode(status) ? detail : null);
    },
    onGetResult: function opc_onGetResult() {
    }
};

/* all params are optional */
function createEventWithDialog(calendar, startDate, endDate, summary, event)
{
    const kDefaultTimezone = calendarDefaultTimezone();


    var onNewEvent = function(event, calendar, originalEvent) {
        doTransaction('add', event, calendar, null,
                      new OpCompleteListener(
                          function respFunc(savedItem) {
                              if (savedItem) {
                                  checkForAttendees(savedItem, originalEvent);
                              }
                          }));
    }

    if (event) {
        openEventDialog(event, calendar, "new", onNewEvent, null);
        return;
    }
    
    event = createEvent();

    if (!startDate) {
        // Have we shown the calendar view yet? (Lightning)
        if (currentView().initialized) {
            startDate = currentView().selectedDay.clone();
        } else {
            startDate = jsDateToDateTime(new Date()).getInTimezone(kDefaultTimezone);
        }
        startDate.isDate = true;
    }

    if (startDate.isDate) {
        if (!startDate.isMutable) {
            startDate = startDate.clone();
        }
        startDate.isDate = false;
        startDate.hour = now().hour;
        startDate.minute = 0;
        startDate.second = 0;
   }

    event.startDate = startDate.clone();

    if (!endDate) {
        endDate = startDate.clone();
        endDate.minute += getPrefSafe("calendar.event.defaultlength", 60);
    }
    event.endDate = endDate.clone();

    event.calendar = calendar || getSelectedCalendar();

    if (summary)
        event.title = summary;

    setDefaultAlarmValues(event);

    openEventDialog(event, calendar, "new", onNewEvent, null);
}

function createTodoWithDialog(calendar, dueDate, summary, todo)
{
    const kDefaultTimezone = calendarDefaultTimezone();

    var onNewItem = function(item, calendar, originalItem) {
        doTransaction('add', item, calendar, null,
                      new OpCompleteListener(
                          function respFunc(savedItem) {
                              if (savedItem) {
                                  checkForAttendees(savedItem, originalItem);
                              }
                          }));
    }

    if (todo) {
        openEventDialog(todo, calendar, "new", onNewItem, null);
        return;
    }

    todo = createTodo();

    todo.calendar = calendar || getSelectedCalendar();

    if (summary)
        todo.title = summary;

    if (dueDate)
        todo.dueDate = dueDate;

    var onNewItem = function(item, calendar, originalItem) {
        calendar.addItem(item,
                         new OpCompleteListener(
                             function respFunc(savedItem) {
                                 if (savedItem) {
                                     checkForAttendees(savedItem, originalItem);
                                 }
                             }));
    }

    setDefaultAlarmValues(todo);

    openEventDialog(todo, calendar, "new", onNewItem, null);
}


function modifyEventWithDialog(item, job)
{
    var onModifyItem = function(item, calendar, originalItem) {
        var listener = new OpCompleteListener(
            function respFunc(savedItem) {
                if (savedItem) {
                    checkForAttendees(savedItem, originalItem);
                }
            });
        // compare cal.uri because there may be multiple instances of
        // calICalendar or uri for the same spec, and those instances are
        // not ==.
        if (!originalItem.calendar || 
            (originalItem.calendar.uri.equals(calendar.uri)))
            doTransaction('modify', item, item.calendar, originalItem, listener);
        else {
            doTransaction('move', item, calendar, originalItem, listener);
        }
    }

    if (item) {
        openEventDialog(item, item.calendar, "modify", onModifyItem, job);
    }
}

function openEventDialog(calendarItem, calendar, mode, callback, job)
{
    // Set up some defaults
    mode = mode || "new";
    calendar = calendar || getSelectedCalendar();
    var calendars = getCalendarManager().getCalendars({});
    calendars = calendars.filter(function(el) { return !el.readOnly; });

    if (calendar.readOnly && mode == "new" && calendars.length < 1) {
        // All calendars are marked readonly, don't show the dialog
        return;
    } else if (calendar.readOnly && mode == "new") {
        // If the default calendar is marked readOnly, pick the first
        // non-readOnly calendar
        calendar = calendars[0];
        if (calendarItem) {
            // XXX The dialog currently uses the items calendar as a first
            // choice. Since we are shortly before a release to keep regression
            // risk low, explicitly set the item's calendar here.
            calendarItem.calendar = calendars[0];
        }
    }

    // Setup the window arguments
    var args = new Object();
    args.calendarEvent = calendarItem;
    args.calendar = calendar;
    args.mode = mode;
    args.onOk = callback;
    args.job = job;

    // this will be called if file->new has been selected from within the dialog
    args.onNewEvent = function(calendar) {
        createEventWithDialog(calendar, null, null);
    }

    // the dialog will reset this to auto when it is done loading.
    window.setCursor("wait");

    // ask the provide if this item is an invitation. if this is the case
    // we'll open the summary dialog since the user is not allowed to change
    // the details of the item.
    var isInvitation = false;
    try {
        isInvitation = calendar.isInvitation(calendarItem);
    }
    catch(e) {}

    // open the dialog modeless
    var url = "chrome://calendar/content/sun-calendar-event-dialog.xul";
    if (isInvitation || calendar.readOnly) {
        url = "chrome://calendar/content/calendar-summary-dialog.xul";
    }
    openDialog(url, "_blank", "chrome,titlebar,resizable", args);
}

// When editing a single instance of a recurring event, we need to figure out
// whether the user wants to edit all instances, or just this one.  This
// function prompts this question (if the item is actually an instance of a
// recurring event) and returns the appropriate item that should be modified.
// Returns null if the prompt was cancelled.
function getOccurrenceOrParent(occurrence) {
    // Check if this actually is an instance of a recurring event
    if (occurrence == occurrence.parentItem) {
        return occurrence;
    }

    // if the user wants to edit an occurrence which is already
    // an exception, always edit this single item.
    var parentItem = occurrence.parentItem;
    var rec = parentItem.recurrenceInfo;
    if (rec) {
        var exceptions = rec.getExceptionIds({});
        if (exceptions.some(function (exid) {
                                return exid.compare(occurrence.recurrenceId) == 0;
                            })) {
            return occurrence;
        }
    }

    var promptService = 
             Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Components.interfaces.nsIPromptService);

    var promptTitle = calGetString("calendar", "editRecurTitle");
    var promptMessage = calGetString("calendar", "editRecurMessage");
    var buttonLabel1 = calGetString("calendar", "editRecurAll");
    var buttonLabel2 = calGetString("calendar", "editRecurSingle");

    var flags = promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0 +
                promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1 +
                promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_2;

    var choice = promptService.confirmEx(null, promptTitle, promptMessage, flags,
                                         buttonLabel1,null , buttonLabel2, null, {});
    switch(choice) {
        case 0: return occurrence.parentItem;
        case 2: return occurrence;
        default: return null;
    }
}

/**
 * Read default alarm settings from user preferences and apply them to
 * the event/todo passed in.
 *
 * @param aItem   The event or todo the settings should be applied to.
 */
function setDefaultAlarmValues(aItem)
{
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    var alarmsBranch = prefService.getBranch("calendar.alarms.");

    if (isEvent(aItem)) {
        try {
            if (alarmsBranch.getIntPref("onforevents") == 1) {
                var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                var units = alarmsBranch.getCharPref("eventalarmunit");
                alarmOffset[units] = alarmsBranch.getIntPref("eventalarmlen");
                alarmOffset.isNegative = true;
                aItem.alarmOffset = alarmOffset;
                aItem.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;
            }
        } catch (ex) {
            Components.utils.reportError(
                "Failed to apply default alarm settings to event: " + ex);
        }
    } else if (isToDo(aItem)) {
        try {
            if (alarmsBranch.getIntPref("onfortodos") == 1) {
                // You can't have an alarm if the entryDate doesn't exist.
                if (!aItem.entryDate) {
                    aItem.entryDate = getSelectedDay().clone();
                }
                var alarmOffset = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                var units = alarmsBranch.getCharPref("todoalarmunit");
                alarmOffset[units] = alarmsBranch.getIntPref("todoalarmlen");
                alarmOffset.isNegative = true;
                aItem.alarmOffset = alarmOffset;
                aItem.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;
            }
        } catch (ex) {
            Components.utils.reportError(
                "Failed to apply default alarm settings to task: " + ex);
        }
    }
}

// Undo/Redo code
function getTransactionMgr() {
    return Components.classes["@mozilla.org/calendar/transactionmanager;1"]
                     .getService(Components.interfaces.calITransactionManager);
}

function doTransaction(aAction, aItem, aCalendar, aOldItem, aListener) {
    getTransactionMgr().createAndCommitTxn(aAction,
                                           aItem,
                                           aCalendar,
                                           aOldItem,
                                           aListener);
    updateUndoRedoMenu();
}

function undo() {
    getTransactionMgr().undo();
    updateUndoRedoMenu();
}

function redo() {
    getTransactionMgr().redo();
    updateUndoRedoMenu();
}

function startBatchTransaction() {
    getTransactionMgr().beginBatch();
}
function endBatchTransaction() {
    getTransactionMgr().endBatch();
    updateUndoRedoMenu();
}

function canUndo() {
    return getTransactionMgr().canUndo();
}
function canRedo() {
    return getTransactionMgr().canRedo();
}

/**
 * checkForAttendees
 * Checks to see if the attendees were added or changed between the original
 * and new item.  If there is a change, it launches the calIITipTransport
 * service and sends the invitations
 */
function checkForAttendees(aItem, aOriginalItem)
{
    // iTIP is only supported in Lightning right now
    if (isSunbird()) {
        return;
    }

    // Only send invitations for providers which need it.
    if (!aItem.calendar.sendItipInvitations) {
        return;
    }

    // Only send invitations if the user checked the checkbox.
    if (!aItem.hasProperty("X-MOZ-SEND-INVITATIONS")) {
        return;
    } else if (aItem.getProperty("X-MOZ-SEND-INVITATIONS") != "TRUE") {
        return;
    }

    var sendInvite = false;
    var itemAtt = aItem.getAttendees({});

    if (itemAtt.length > 0) {
        var originalAtt = aOriginalItem.getAttendees({});

        if ( (originalAtt.length > 0) &&
             (originalAtt.length == itemAtt.length) )
        {
            for (var i=0; i < itemAtt.length; i++) {
                if (originalAtt[i].id != itemAtt[i].id) {
                    sendInvite = true;
                    break;
                }
            }
        } else {
            // We have attendees on item, not on original, attendees were
            // added.
            sendInvite = true;
        }
    }

    // XXX Until we rethink attendee support and until such support
    // is worked into the event dialog (which has been done in the prototype
    // dialog to a degree) then we are going to simply hack in some attendee
    // support so that we can round-trip iTIP invitations.
    if (sendInvite) {
        // Since there is no way to determine the type of transport an
        // attendee requires, we default to email
        var emlSvc = Components.classes["@mozilla.org/calendar/itip-transport;1?type=email"]
                               .createInstance(Components.interfaces.calIItipTransport);

        var itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                                 .createInstance(Components.interfaces.calIItipItem);

        var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService);

        var sb = sbs.createBundle("chrome://lightning/locale/lightning.properties");
        var recipients = [];

        // We have to modify our item a little, so we clone it.
        var item = aItem.clone();

        // Fix up our attendees for invitations using some good defaults
        itemAtt = item.getAttendees({}); // reuse cloned attendees
        item.removeAllAttendees();
        for each (var attendee in itemAtt) {
            attendee.role = "REQ-PARTICIPANT";
            attendee.participationStatus = "NEEDS-ACTION";
            attendee.rsvp = true;
            item.addAttendee(attendee);
            recipients.push(attendee);
        }

        // XXX The event dialog has no means to set us as the organizer
        // since we defaulted to email above, we know we need to prepend
        // mailto when we convert it to an attendee
        var organizer = Components.classes["@mozilla.org/calendar/attendee;1"]
                                  .createInstance(Components.interfaces.calIAttendee);
        organizer.id = "mailto:" + emlSvc.defaultIdentity;
        organizer.role = "REQ-PARTICIPANT";
        organizer.participationStatus = "ACCEPTED";
        organizer.isOrganizer = true;

        // Add our organizer to the item. Again, the event dialog really doesn't
        // have a mechanism for creating an item with a method, so let's add
        // that too while we're at it.  We'll also fake Sequence ID support.
        item.organizer = organizer;
        item.setProperty("METHOD", "REQUEST");
        item.setProperty("SEQUENCE", "1");

        var summary
        if (item.getProperty("SUMMARY")) {
            summary = item.getProperty("SUMMARY");
        } else {
            summary = "";
        }

        // Initialize and set our properties on the item
        itipItem.init(item.icalString);
        itipItem.isSend = true;
        itipItem.receivedMethod = "REQUEST";
        itipItem.responseMethod = "REQUEST";
        itipItem.autoResponse = Components.interfaces.calIItipItem.USER;

        // Get ourselves some default text - when we handle organizer properly
        // We'll need a way to configure the Common Name attribute and we should
        // use it here rather than the email address
        var subject = sb.formatStringFromName("itipRequestSubject",
                                              [summary], 1);
        var body = sb.formatStringFromName("itipRequestBody",
                                           [emlSvc.defaultIdentity, summary],
                                           2);

        // Send it!
        emlSvc.sendItems(recipients.length, recipients, subject, body, itipItem);
    }
}
