/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calRecurrenceUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

try {
    Components.utils.import("resource:///modules/cloudFileAccounts.js");
} catch (e) {
    // This will fail on Seamonkey, but thats ok since the pref for cloudfiles
    // is false, which means the UI will not be shown
}

// the following variables are constructed if the jsContext this file
// belongs to gets constructed. all those variables are meant to be accessed
// from within this file only.
var gStartTime = null;
var gEndTime = null;
var gItemDuration = null;
var gStartTimezone = null;
var gEndTimezone = null;
var gUntilDate = null;
var gIsReadOnly = false;
var gPrivacy = null;
var gAttachMap = {};
var gPriority = 0;
var gStatus = "NONE";
var gConfirmCancel = true;
var gLastRepeatSelection = 0;
var gIgnoreUpdate = false;
var gShowTimeAs = null;
var gWarning = false;

var eventDialogQuitObserver = {
  observe: function(aSubject, aTopic, aData) {
    // Check whether or not we want to veto the quit request (unless another
    // observer already did.
    if (aTopic == "quit-application-requested" &&
        (aSubject instanceof Components.interfaces.nsISupportsPRBool) &&
        !aSubject.data)
      aSubject.data = !onCancel();
  }
};

/**
 * Checks if the given calendar supports notifying attendees. The item is needed
 * since calendars may support notifications for only some types of items.
 *
 * @param aCalendar   The calendar to check
 * @param item        The item to check support for.
 */
function canNotifyAttendees(aCalendar, item) {
    try {
        var calendar = aCalendar.QueryInterface(Components.interfaces.calISchedulingSupport);
        return (calendar.canNotify("REQUEST", item) && calendar.canNotify("CANCEL", item));
    } catch (exc) {
        return false;
    }
}

/**
 * Update menu items that rely on focus
 */
function goUpdateGlobalEditMenuItems() {
    goUpdateCommand('cmd_undo');
    goUpdateCommand('cmd_redo');
    goUpdateCommand('cmd_cut');
    goUpdateCommand('cmd_copy');
    goUpdateCommand('cmd_paste');
    goUpdateCommand('cmd_selectAll');
}

/**
 * Update menu items that rely on the current selection
 */
function goUpdateSelectEditMenuItems() {
    goUpdateCommand('cmd_cut');
    goUpdateCommand('cmd_copy');
    goUpdateCommand('cmd_delete');
    goUpdateCommand('cmd_selectAll');
}

/**
 * Update menu items that relate to undo/redo
 */
function goUpdateUndoEditMenuItems() {
    goUpdateCommand('cmd_undo');
    goUpdateCommand('cmd_redo');
}

/**
 * Update menu items that depend on clipboard contents
 */
function goUpdatePasteMenuItems() {
    goUpdateCommand('cmd_paste');
}

/**
 * Sets up the event dialog from the window arguments, also setting up all
 * dialog controls from the window's item.
 */
function onLoad() {
    // first of all retrieve the array of
    // arguments this window has been called with.
    var args = window.arguments[0];

    // The calling entity provides us with an object that is responsible
    // for recording details about the initiated modification. the 'finalize'
    // property is our hook in order to receive a notification in case the
    // operation needs to be terminated prematurely. This function will be
    // called if the calling entity needs to immediately terminate the pending
    // modification. In this case we serialize the item and close the window.
    if (args.job) {
        // keep this context...
        var self = this;

        // store the 'finalize'-functor in the provided job-object.
        args.job.finalize = function() {
            // store any pending modifications...
            self.onAccept();

            var item = window.calendarItem;

            // ...and close the window.
            window.close();

            return item;
        }
    }

    window.fbWrapper = args.fbWrapper;

    // the most important attribute we expect from the
    // arguments is the item we'll edit in the dialog.
    var item = args.calendarEvent;

    // set the dialog-id to enable the right window-icon to be loaded.
    if (!cal.isEvent(item)) {
        setDialogId(document.documentElement, "calendar-task-dialog");
    }

    // new items should have a non-empty title.
    if (item.isMutable && (!item.title || item.title.length <= 0)) {
        item.title = calGetString("calendar-event-dialog",
                                  isEvent(item) ? "newEvent" : "newTask");
    }

    window.onAcceptCallback = args.onOk;
    window.mode = args.mode

    // we store the item in the window to be able
    // to access this from any location. please note
    // that the item is either an occurrence [proxy]
    // or the stand-alone item [single occurrence item].
    window.calendarItem = item;
    // store the initial date value for datepickers in New Task dialog
    window.initialStartDateValue = args.initialStartDateValue;

    // we store the array of attendees in the window.
    // clone each existing attendee since we still suffer
    // from the 'lost x-properties'-bug.
    window.attendees = [];
    var attendees = item.getAttendees({});
    if (attendees && attendees.length) {
        for each (var attendee in attendees) {
            window.attendees.push(attendee.clone());
        }
    }

    window.organizer = null;
    if (item.organizer) {
        window.organizer = item.organizer.clone();
    } else if (item.getAttendees({}).length > 0) {
        // previous versions of calendar may have filled ORGANIZER correctly on overridden instances:
        let orgId = item.calendar.getProperty("organizerId");
        if (orgId) {
            let organizer = cal.createAttendee();
            organizer.id = orgId;
            organizer.commonName = item.calendar.getProperty("organizerCN");
            organizer.role = "REQ-PARTICIPANT";
            organizer.participationStatus = "ACCEPTED";
            organizer.isOrganizer = true;
            window.organizer = organizer;
        }
    }

    // we store the recurrence info in the window so it
    // can be accessed from any location. since the recurrence
    // info is a property of the parent item we need to check
    // whether or not this item is a proxy or a parent.
    var parentItem = item;
    if (parentItem.parentItem != parentItem) {
        parentItem = parentItem.parentItem;
    }

    window.recurrenceInfo = null;
    if (parentItem.recurrenceInfo) {
        window.recurrenceInfo = parentItem.recurrenceInfo.clone();
    }

    document.documentElement.getButton("accept")
            .setAttribute("collapsed", "true");
    document.documentElement.getButton("cancel")
            .setAttribute("collapsed", "true");
    document.documentElement.getButton("cancel")
            .parentNode.setAttribute("collapsed", "true");

    // Set initial values for datepickers in New Tasks dialog
    if (isToDo(item)) {
        let initialDatesValue = args.initialStartDateValue.jsDate;
        setElementValue("completed-date-picker", initialDatesValue);
        setElementValue("todo-entrydate", initialDatesValue);
        setElementValue("todo-duedate", initialDatesValue);
    }
    loadDialog(window.calendarItem);

    opener.setCursor("auto");

    document.getElementById("item-title").focus();
    document.getElementById("item-title").select();

    // This causes the app to ask if the window should be closed when the
    // application is closed.
    Services.obs.addObserver(eventDialogQuitObserver,
                             "quit-application-requested", false);

    // Normally, Enter closes a <dialog>. We want this to rather on Ctrl+Enter.
    // Stopping event propagation doesn't seem to work, so just overwrite the
    // function that does this.
    document.documentElement._hitEnter = function() {};
}

function onEventDialogUnload() {
  Services.obs.removeObserver(eventDialogQuitObserver,
                              "quit-application-requested");
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    dispose();
    onCommandSave(true);
    return !gWarning;
}

/**
 * Asks the user if the item should be saved and does so if requested. If the
 * user cancels, the window should stay open.
 *
 * XXX Could possibly be consolidated into onCancel()
 *
 * @return    Returns true if the window should be closed.
 */
function onCommandCancel() {
    // Allow closing if the item has not changed and no warning dialog has to be showed.
    if (!isItemChanged() && !gWarning) {
        return true;
    }

    var promptService = Components.interfaces.nsIPromptService;

    var promptTitle = calGetString("calendar",
                                   isEvent(window.calendarItem) ?
                                      "askSaveTitleEvent" :
                                      "askSaveTitleTask");
    var promptMessage = calGetString("calendar",
                                     isEvent(window.calendarItem) ?
                                        "askSaveMessageEvent" :
                                        "askSaveMessageTask");

    var flags = promptService.BUTTON_TITLE_SAVE *
                promptService.BUTTON_POS_0 +
                promptService.BUTTON_TITLE_CANCEL *
                promptService.BUTTON_POS_1 +
                promptService.BUTTON_TITLE_DONT_SAVE *
                promptService.BUTTON_POS_2;

    var choice = Services.prompt.confirmEx(null,
                                           promptTitle,
                                           promptMessage,
                                           flags,
                                           null,
                                           null,
                                           null,
                                           null,
                                           {});
    switch (choice) {
        case 0: // Save
            onCommandSave(true);
            return true;
        case 2: // Don't save
            // Don't show any warning dialog when closing without saving.
            gWarning = false;
            return true;
        default: // Cancel
            return false;
    }
}

/**
 * Handler function to be called when the cancel button is pressed.
 *
 * @return    Returns true if the window should be closed.
 */
function onCancel() {
    // The datepickers need to remove the focus in order to trigger the
    // validation of the values just edited, with the keyboard, but not yet
    // confirmed (i.e. not followed by a click, a tab or enter keys pressure).
    document.documentElement.focus();

    if (!gConfirmCancel || (gConfirmCancel && onCommandCancel())) {
        dispose();
        // Don't allow closing the dialog when the user inputs a wrong
        // date then closes the dialog and answers with "Save" in
        // the "Save Event" dialog.
        return !gWarning;
    }
    return false;
}

/**
 * Sets up all dialog controls from the information of the passed item.
 *
 * @param item      The item to parse information out of.
 */
function loadDialog(item) {
    setElementValue("item-title", item.title);
    setElementValue("item-location", item.getProperty("LOCATION"));

    loadDateTime(item);

    // add calendars to the calendar menulist
    var calendarList = document.getElementById("item-calendar");
    var indexToSelect = appendCalendarItems(item, calendarList, window.arguments[0].calendar);
    if (indexToSelect > -1) {
        calendarList.selectedIndex = indexToSelect;
    }

    // Categories
    loadCategories(item);

    // Attachment
    loadCloudProviders();
    var hasAttachments = capSupported("attachments");
    var attachments = item.getAttachments({});
    if (hasAttachments && attachments && attachments.length > 0) {
        for each (var attachment in attachments) {
            addAttachment(attachment);
        }
    } else {
        updateAttachment();
    }

    // URL link
    updateLink();

    // Description
    setElementValue("item-description", item.getProperty("DESCRIPTION"));

    // Status
    if (isEvent(item)) {
        gStatus = item.hasProperty("STATUS") ?
            item.getProperty("STATUS") : "NONE";
        updateStatus();
    } else {
        let todoStatus = document.getElementById("todo-status");
        setElementValue(todoStatus, item.getProperty("STATUS"));
        if (!todoStatus.selectedItem) {
            // No selected item means there was no <menuitem> that matches the
            // value given. Select the "NONE" item by default.
            setElementValue(todoStatus, "NONE");
        }
    }

    // Task completed date
    if (item.completedDate) {
        updateToDoStatus(item.status, item.completedDate.jsDate);
    } else {
        updateToDoStatus(item.status);
    }

    // Task percent complete
    if (isToDo(item)) {
        var percentCompleteInteger = 0;
        var percentCompleteProperty = item.getProperty("PERCENT-COMPLETE");
        if (percentCompleteProperty != null) {
            percentCompleteInteger = parseInt(percentCompleteProperty);
        }
        if (percentCompleteInteger < 0) {
            percentCompleteInteger = 0;
        } else if (percentCompleteInteger > 100) {
            percentCompleteInteger = 100;
        }
        setElementValue("percent-complete-textbox", percentCompleteInteger);
    }

    // Set Item-Menu label to Event or Task
    let menuItem = document.getElementById("item-menu");
    menuItem.setAttribute("label", calGetString("calendar-event-dialog",
                                          cal.isEvent(item) ? "itemMenuLabelEvent" : "itemMenuLabelTask"));
    menuItem.setAttribute("accesskey", calGetString("calendar-event-dialog",
                                          cal.isEvent(item) ? "itemMenuAccesskeyEvent2" : "itemMenuAccesskeyTask2"));

    // Priority
    gPriority = parseInt(item.priority);
    updatePriority();

    // Privacy
    gPrivacy = item.privacy;
    updatePrivacy();

    // load repeat details
    loadRepeat(item);

    // load reminder details
    loadReminders(item.getAlarms({}));

    // hide rows based on if this is an event or todo
    updateStyle();

    // Synchronize link-top-image with keep-duration-button status
    let keepAttribute = document.getElementById("keepduration-button").getAttribute("keep") == "true";
    setBooleanAttribute("link-image-top", "keep", keepAttribute);

    updateDateTime();

    updateCalendar();

    // figure out what the title of the dialog should be and set it
    updateTitle();

    let notifyCheckbox = document.getElementById("notify-attendees-checkbox");
    if (canNotifyAttendees(item.calendar, item)) {
        // visualize that the server will send out mail:
        notifyCheckbox.checked = true;
    } else {
        let itemProp = item.getProperty("X-MOZ-SEND-INVITATIONS");
        notifyCheckbox.checked = (item.calendar.getProperty("imip.identity") &&
                                  ((itemProp === null)
                                   ? getPrefSafe("calendar.itip.notify", true)
                                   : (itemProp == "TRUE")));
    }

    updateAttendees();
    updateRepeat(true);
    updateReminder(true);

    gShowTimeAs = item.getProperty("TRANSP");
    updateShowTimeAs();
}

/**
 * Loads the item's categories into the category panel
 *
 * @param aItem     The item to load into the category panel
 */
function loadCategories(aItem) {
    let categoryPanel = document.getElementById("item-categories-panel");
    categoryPanel.loadItem(aItem);
    updateCategoryMenulist();
}

/**
 * Updates the category menulist to show the correct label, depending on the
 * selected categories in the category panel
 */
function updateCategoryMenulist() {
    let categoryMenulist = document.getElementById("item-categories");
    let categoryPanel = document.getElementById("item-categories-panel");
    let categoryList = categoryPanel.categories;

    let label;
    if (categoryList.length > 1) {
        label = cal.calGetString("calendar", "multipleCategories");
    } else if (categoryList.length == 1) {
        label = categoryList[0];
    } else {
        label = cal.calGetString("calendar", "None");
    }
    categoryMenulist.setAttribute("label", label);
}

/**
 * Saves the selected categories into the passed item
 *
 * @param aItem     The item to set the categories on
 */
function saveCategories(aItem) {
    let categoryPanel = document.getElementById("item-categories-panel");
    let categoryList = categoryPanel.categories;
    aItem.setCategories(categoryList.length, categoryList);
}

/**
 * Sets up all date related controls from the passed item
 *
 * @param item      The item to parse information out of.
 */
function loadDateTime(item) {
    var kDefaultTimezone = calendarDefaultTimezone();
    if (isEvent(item)) {
        var startTime = item.startDate;
        var endTime = item.endDate;
        var duration = endTime.subtractDate(startTime);

        // Check if an all-day event has been passed in (to adapt endDate).
        if (startTime.isDate) {
            startTime = startTime.clone();
            endTime = endTime.clone();

            endTime.day--;
            duration.days--;
        }

        // store the start/end-times as calIDateTime-objects
        // converted to the default timezone. store the timezones
        // separately.
        gStartTimezone = startTime.timezone;
        gEndTimezone = endTime.timezone;
        gStartTime = startTime.getInTimezone(kDefaultTimezone);
        gEndTime = endTime.getInTimezone(kDefaultTimezone);
        gItemDuration = duration;
    }

    if (isToDo(item)) {
        var startTime = null;
        var endTime = null;
        var duration = null;

        var hasEntryDate = (item.entryDate != null);
        if (hasEntryDate) {
            startTime = item.entryDate;
            gStartTimezone = startTime.timezone;
            startTime = startTime.getInTimezone(kDefaultTimezone);
        } else {
            gStartTimezone = kDefaultTimezone;
        }
        var hasDueDate = (item.dueDate != null);
        if (hasDueDate) {
            endTime = item.dueDate;
            gEndTimezone = endTime.timezone;
            endTime = endTime.getInTimezone(kDefaultTimezone);
        } else {
            gEndTimezone = kDefaultTimezone;
        }
        if (hasEntryDate && hasDueDate) {
            duration = endTime.subtractDate(startTime);
        }
        setElementValue("cmd_attendees", !(hasEntryDate && hasDueDate), "disabled");
        setBooleanAttribute("keepduration-button", "disabled", !(hasEntryDate && hasDueDate));
        gStartTime = startTime;
        gEndTime = endTime;
        gItemDuration = duration;
    }
}

/**
 * Toggles the "keep" attribute every time the keepduration-button is pressed.
 */
function toggleKeepDuration() {
    let kdb = document.getElementById("keepduration-button");
    let keepAttribute = kdb.getAttribute("keep") == "true";
    // To make the "keep" attribute persistent, it mustn't be removed when in
    // false state (bug 15232).
    kdb.setAttribute("keep", keepAttribute ? "false" : "true");
    setBooleanAttribute("link-image-top", "keep", !keepAttribute);
}

/**
 * Handler function to be used when the Start time or End time of the event have
 * changed.
 * When changing the Start date, the End date changes automatically so the
 * event/task's duration stays the same. Instead the End date is not linked
 * to the Start date unless the the keepDurationButton has the "keep" attribute
 * set to true. In this case modifying the End date changes the Start date in
 * order to keep the same duration.
 *
 * @param aStartDatepicker     If true the Start or Entry datepicker has changed,
 *                             otherwise the End or Due datepicker has changed.
 */
function dateTimeControls2State(aStartDatepicker) {
    if (gIgnoreUpdate) {
        return;
    }
    let keepAttribute = document.getElementById("keepduration-button")
                                .getAttribute("keep") == "true";
    let allDay = getElementValue("event-all-day", "checked");
    var startWidgetId;
    var endWidgetId;
    if (isEvent(window.calendarItem)) {
        startWidgetId = "event-starttime";
        endWidgetId = "event-endtime";
    } else {
        if (!getElementValue("todo-has-entrydate", "checked")) {
            gItemDuration = null;
        }
        if (!getElementValue("todo-has-duedate", "checked")) {
            gItemDuration = null;
        }
        startWidgetId = "todo-entrydate";
        endWidgetId = "todo-duedate";
    }

    var saveStartTime = gStartTime;
    var saveEndTime = gEndTime;
    var kDefaultTimezone = calendarDefaultTimezone();

    let timezonesEnabled = document.getElementById('options-timezone-menuitem')
                           .getAttribute('checked') == 'true';
    if (gStartTime) {
        // jsDate is always in OS timezone, thus we create a calIDateTime
        // object from the jsDate representation then we convert the timezone
        // in order to keep gStartTime in default timezone.
        gStartTime = cal.jsDateToDateTime(getElementValue(startWidgetId),
                                          (timezonesEnabled || allDay) ? gStartTimezone : kDefaultTimezone);
        if (timezonesEnabled || allDay) {
            gStartTime = gStartTime.getInTimezone(kDefaultTimezone);
        }
        gStartTime.isDate = allDay;
    }
    if (gEndTime) {
        if (aStartDatepicker) {
            // Change the End date in order to keep the duration.
            gEndTime = gStartTime.clone();
            if (gItemDuration) {
                gEndTime.addDuration(gItemDuration);
            }
        } else {
            let timezone = gEndTimezone;
            if (timezone.isUTC) {
                if (gStartTime && !compareObjects(gStartTimezone, gEndTimezone)) {
                    timezone = gStartTimezone;
                }
            }
            gEndTime = cal.jsDateToDateTime(getElementValue(endWidgetId),
                                            (timezonesEnabled || allDay) ? timezone : kDefaultTimezone);
            if (timezonesEnabled || allDay) {
                gEndTime = gEndTime.getInTimezone(kDefaultTimezone);
            }

            gEndTime.isDate = allDay;
            if (keepAttribute && gItemDuration) {
                // Keepduration-button links the the Start to the End date. We
                // have to change the Start date in order to keep the duration.
                let fduration = gItemDuration.clone();
                fduration.isNegative = true;
                gStartTime = gEndTime.clone();
                gStartTime.addDuration(fduration);
            }
        }
    }

    if (allDay) {
        gStartTime.isDate = true;
        gEndTime.isDate = true;
        gItemDuration = gEndTime.subtractDate(gStartTime);
    }

    // calculate the new duration of start/end-time.
    // don't allow for negative durations.
    var warning = false;
    if (!aStartDatepicker && gStartTime && gEndTime) {
        if (gEndTime.compare(gStartTime) >= 0) {
            gItemDuration = gEndTime.subtractDate(gStartTime);
        } else {
            gStartTime = saveStartTime;
            gEndTime = saveEndTime;
            warning = true;
        }
    }

    updateDateTime();
    updateTimezone();
    updateAccept();

    if (warning) {
        // Disable the "Save" and "Save and Close" commands as long as the
        // warning dialog is showed.
        enableAcceptCommand(false);
        gWarning = true;
        let callback = function func() {
            Services.prompt.alert(null,
                                  document.title,
                                  cal.calGetString("calendar", "warningEndBeforeStart"));
            gWarning = false;
            updateAccept();
        };
        setTimeout(callback, 1);
    }
}

/**
 * Updates the entry date checkboxes, used for example when choosing an alarm:
 * the entry date needs to be checked in that case.
 */
function updateEntryDate() {
    updateDateCheckboxes(
        "todo-entrydate",
        "todo-has-entrydate",
        {
            isValid: function() {
                return gStartTime != null;
            },
            setDateTime: function(dt) {
                gStartTime = dt;
            }
        });
}

/**
 * Updates the due date checkboxes.
 */
function updateDueDate() {
    updateDateCheckboxes(
        "todo-duedate",
        "todo-has-duedate",
        {
            isValid: function() {
                return gEndTime != null;
            },
            setDateTime: function(dt) {
                gEndTime = dt;
            }
        });
}

/**
 * Common function used by updateEntryDate and updateDueDate to set up the
 * checkboxes correctly.
 *
 * @param aDatePickerId     The XUL id of the datepicker to update.
 * @param aCheckboxId       The XUL id of the corresponding checkbox.
 * @param aDateTime         An object implementing the isValid and setDateTime
 *                            methods. XXX explain.
 */
function updateDateCheckboxes(aDatePickerId, aCheckboxId, aDateTime) {
    if (gIgnoreUpdate) {
        return;
    }

    if (!isToDo(window.calendarItem)) {
        return;
    }

    // force something to get set if there was nothing there before
    setElementValue(aDatePickerId, getElementValue(aDatePickerId));

    // first of all disable the datetime picker if we don't have a date
    let hasDate = getElementValue(aCheckboxId, "checked");
    setElementValue(aDatePickerId, !hasDate, "disabled");

    // create a new datetime object if date is now checked for the first time
    if (hasDate && !aDateTime.isValid()) {
        let dt = cal.jsDateToDateTime(getElementValue(aDatePickerId), cal.calendarDefaultTimezone());
        aDateTime.setDateTime(dt);
    } else if (!hasDate && aDateTime.isValid()) {
        aDateTime.setDateTime(null);
    }

    // calculate the duration if possible
    let hasEntryDate = getElementValue("todo-has-entrydate", "checked");
    let hasDueDate = getElementValue("todo-has-duedate", "checked");
    if (hasEntryDate && hasDueDate) {
        let start = cal.jsDateToDateTime(getElementValue("todo-entrydate"));
        let end = cal.jsDateToDateTime(getElementValue("todo-duedate"));
        gItemDuration = end.subtractDate(start);
    } else {
        gItemDuration = null;
    }
    setElementValue("cmd_attendees", !(hasEntryDate && hasDueDate), "disabled");
    setBooleanAttribute("keepduration-button", "disabled", !(hasEntryDate && hasDueDate));
    updateDateTime();
    updateTimezone();
}

/**
 * Update the dialog controls to display the item's recurrence information
 * nicely.
 *
 * @param item    The item to load.
 */
function loadRepeat(item) {
    var recurrenceInfo = window.recurrenceInfo;
    setElementValue("item-repeat", "none");
    if (recurrenceInfo) {
        setElementValue("item-repeat", "custom");
        var ritems = recurrenceInfo.getRecurrenceItems({});
        var rules = [];
        var exceptions = [];
        for each (var r in ritems) {
            if (r.isNegative) {
                exceptions.push(r);
            } else {
                rules.push(r);
            }
        }
        if (rules.length == 1) {
            var rule = rules[0];
            if (calInstanceOf(rule, Components.interfaces.calIRecurrenceRule)) {
                switch (rule.type) {
                    case 'DAILY':
                        if (!checkRecurrenceRule(rule, ['BYSECOND',
                                                        'BYMINUTE',
                                                        'BYHOUR',
                                                        'BYMONTHDAY',
                                                        'BYYEARDAY',
                                                        'BYWEEKNO',
                                                        'BYMONTH',
                                                        'BYSETPOS'])) {
                            let ruleComp = rule.getComponent("BYDAY", {});
                            if (rule.interval == 1) {
                                if (ruleComp.length > 0) {
                                    if (ruleComp.length == 5) {
                                        for (var i = 0; i < 5; i++) {
                                            if (ruleComp[i] != i + 2) {
                                                break;
                                            }
                                        }
                                        if (i==5) {
                                            if (!rule.isFinite || !rule.isByCount) {
                                                setElementValue("item-repeat", "every.weekday");
                                                updateUntilControls(rule);
                                            }
                                        }
                                    }
                                } else {
                                    if (!rule.isFinite || !rule.isByCount) {
                                        setElementValue("item-repeat", "daily");
                                        updateUntilControls(rule);
                                    }
                                }
                            }
                        }
                        break;
                    case 'WEEKLY':
                        if (!checkRecurrenceRule(rule, ['BYSECOND',
                                                        'BYMINUTE',
                                                        'BYDAY',
                                                        'BYHOUR',
                                                        'BYMONTHDAY',
                                                        'BYYEARDAY',
                                                        'BYWEEKNO',
                                                        'BYMONTH',
                                                        'BYSETPOS'])) {
                            let weekType=["weekly", "bi.weekly"];
                            if ((rule.interval == 1 || rule.interval == 2) &&
                                (!rule.isFinite || !rule.isByCount)) {
                                  setElementValue("item-repeat", weekType[rule.interval - 1]);
                                updateUntilControls(rule);
                            }
                        }
                        break;
                    case 'MONTHLY':
                        if (!checkRecurrenceRule(rule, ['BYSECOND',
                                                        'BYMINUTE',
                                                        'BYDAY',
                                                        'BYHOUR',
                                                        'BYMONTHDAY',
                                                        'BYYEARDAY',
                                                        'BYWEEKNO',
                                                        'BYMONTH',
                                                        'BYSETPOS'])) {
                            if (rule.interval == 1 && (!rule.isFinite || !rule.isByCount)) {
                                setElementValue("item-repeat", "monthly");
                                updateUntilControls(rule);
                            }
                        }
                        break;
                    case 'YEARLY':
                        if (!checkRecurrenceRule(rule, ['BYSECOND',
                                                        'BYMINUTE',
                                                        'BYDAY',
                                                        'BYHOUR',
                                                        'BYMONTHDAY',
                                                        'BYYEARDAY',
                                                        'BYWEEKNO',
                                                        'BYMONTH',
                                                        'BYSETPOS'])) {
                            if (rule.interval == 1 && (!rule.isFinite || !rule.isByCount)) {
                                setElementValue("item-repeat", "yearly");
                                updateUntilControls(rule);
                            }
                        }
                        break;
                }
            }
        }
    }

    var repeatMenu = document.getElementById("item-repeat");
    gLastRepeatSelection = repeatMenu.selectedIndex;

    if (item.parentItem != item) {
        disableElement("item-repeat");
        disableElement("repeat-until-datepicker");
    }
}

/**
 * Shows the repeat-until-datepicker and sets its date
 *
 * @param rule    The recurrence rule.
 */
function updateUntilControls(rule) {
    let untilDate = "forever";
    if (!rule.isByCount) {
        gUntilDate = rule.untilDate;
        if (gUntilDate) {
            untilDate = gUntilDate.getInTimezone(cal.floating()).jsDate;
        }
    }
    document.getElementById("repeat-deck").selectedIndex = 0;
    setElementValue("repeat-until-datepicker", untilDate);
}

/**
 * Update reminder related elements on the dialog.
 *
 * @param aSuppressDialogs     If true, controls are updated without prompting
 *                               for changes with the custom dialog
 */
function updateReminder(aSuppressDialogs) {
    commonUpdateReminder(aSuppressDialogs);
    updateAccept();
}

/**
 * Saves all values the user chose on the dialog to the passed item
 *
 * @param item    The item to save to.
 */
function saveDialog(item) {
    // Calendar
    item.calendar = getCurrentCalendar();

    setItemProperty(item, "title", getElementValue("item-title"));
    setItemProperty(item, "LOCATION", getElementValue("item-location"));

    saveDateTime(item);

    if (isToDo(item)) {
        var percentCompleteInteger = 0;
        if (getElementValue("percent-complete-textbox") != "") {
            percentCompleteInteger =
                parseInt(getElementValue("percent-complete-textbox"));
        }
        if (percentCompleteInteger < 0) {
            percentCompleteInteger = 0;
        } else if (percentCompleteInteger > 100) {
            percentCompleteInteger = 100;
        }
        setItemProperty(item, "PERCENT-COMPLETE", percentCompleteInteger);
    }

    // Categories
    saveCategories(item);

    // Attachment
    // We want the attachments to be up to date, remove all first.
    item.removeAllAttachments();

    // Now add back the new ones
    for each (var att in gAttachMap) {
        item.addAttachment(att);
    }

    // Description
    setItemProperty(item, "DESCRIPTION", getElementValue("item-description"));

    // Event Status
    if (isEvent(item)) {
        if(gStatus && gStatus != "NONE") {
            item.setProperty("STATUS", gStatus);
        } else {
            item.deleteProperty("STATUS");
        }
    } else {
        var status = getElementValue("todo-status");
        if (status != "COMPLETED") {
            item.completedDate = null;
        }
        setItemProperty(item, "STATUS", (status != "NONE") ? status : null);
    }

    // set the "PRIORITY" property if a valid priority has been
    // specified (any integer value except *null*) OR the item
    // already specifies a priority. in any other case we don't
    // need this property and can safely delete it. we need this special
    // handling since the WCAP provider always includes the priority
    // with value *null* and we don't detect changes to this item if
    // we delete this property.
    if (capSupported("priority") &&
        (gPriority || item.hasProperty("PRIORITY"))) {
        item.setProperty("PRIORITY", gPriority);
    } else {
        item.deleteProperty("PRIORITY");
    }

    // Transparency
    if (gShowTimeAs) {
        item.setProperty("TRANSP", gShowTimeAs);
    } else {
        item.deleteProperty("TRANSP");
    }

    // Privacy
    setItemProperty(item, "CLASS", gPrivacy, "privacy");

    if (item.status == "COMPLETED" && isToDo(item)) {
        var elementValue = getElementValue("completed-date-picker");
        item.completedDate = cal.jsDateToDateTime(elementValue);
    }

    saveReminder(item);
}

/**
 * Save date and time related values from the dialog to the passed item.
 *
 * @param item    The item to save to.
 */
function saveDateTime(item) {
    var kDefaultTimezone = calendarDefaultTimezone();
    if (isEvent(item)) {
        var startTime = gStartTime.getInTimezone(gStartTimezone);
        var endTime = gEndTime.getInTimezone(gEndTimezone);
        var isAllDay = getElementValue("event-all-day", "checked");
        if (isAllDay) {
            startTime = startTime.clone();
            endTime = endTime.clone();
            startTime.isDate = true;
            endTime.isDate = true;
            endTime.day += 1;
        } else {
            startTime = startTime.clone();
            startTime.isDate = false;
            endTime = endTime.clone();
            endTime.isDate = false;
        }
        setItemProperty(item, "startDate", startTime);
        setItemProperty(item, "endDate", endTime);
    }
    if (isToDo(item)) {
        var startTime = gStartTime && gStartTime.getInTimezone(gStartTimezone);
        var endTime = gEndTime && gEndTime.getInTimezone(gEndTimezone);
        setItemProperty(item, "entryDate", startTime);
        setItemProperty(item, "dueDate", endTime);
    }
}

/**
 * Updates the dialog title based on item type and if the item is new or to be
 * modified.
 */
function updateTitle() {
    let strName;
    if (cal.isEvent(window.calendarItem)) {
        strName = (window.mode == "new" ? "newEventDialog" : "editEventDialog");
    } else if (cal.isToDo(window.calendarItem)) {
        strName = (window.mode == "new" ? "newTaskDialog" : "editTaskDialog");
    } else {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }
    document.title = cal.calGetString("calendar", strName) + ": " +
                        getElementValue("item-title");
}

/**
 * Updates the stylesheet to add rules to hide certain aspects (i.e task only
 * elements when editing an event).
 *
 * TODO We can use general rules here, i.e
 *      dialog[itemType="task"] .event-only,
 *      dialog[itemType="event"] .task-only,
 *      dialog:not([product="lightning"]) .lightning-only {
 *          display: none;
 *      }
 */
function updateStyle() {
    const kDialogStylesheet = "chrome://calendar/skin/calendar-event-dialog.css";

    for each (let stylesheet in document.styleSheets) {
        if (stylesheet.href == kDialogStylesheet) {
            if (cal.isSunbird()) {
                stylesheet.insertRule(".lightning-only { display: none; }",
                                      stylesheet.cssRules.length);
            }
            if (cal.isEvent(window.calendarItem)) {
                stylesheet.insertRule(".todo-only { display: none; }",
                                      stylesheet.cssRules.length);
            } else if (cal.isToDo(window.calendarItem)) {
                stylesheet.insertRule(".event-only { display: none; }",
                                      stylesheet.cssRules.length);
            }
            return;
        }
    }
}

/**
 * Handler function for showing the options menu
 *
 * XXX This function could go away with more general CSS rules?
 *
 * @param menuPopup   The menupopup node targeted by the event.
 */
function onPopupShowing(menuPopup) {
    if (isToDo(window.calendarItem)) {
        var nodes = menuPopup.childNodes;
        for (var i = nodes.length - 1; i >= 0; --i) {
            var node = nodes[i];
            if (node.hasAttribute('class')) {
                if (node.getAttribute('class').split(' ').some(
                    function (element) {
                        return element.toLowerCase() == 'event-only';
                    })) {
                    menuPopup.removeChild(node);
                }
            }
        }
    }
}

/**
 * Update the disabled status of the accept button. The button is enabled if all
 * parts of the dialog have options selected that make sense.
 * constraining factors like
 */
function updateAccept() {
    let enableAccept = true;
    let kDefaultTimezone = calendarDefaultTimezone();
    let startDate;
    let endDate;
    let isEvent = cal.isEvent(window.calendarItem);

    // don't allow for end dates to be before start dates
    if (isEvent) {
        startDate = cal.jsDateToDateTime(getElementValue("event-starttime"));
        endDate = cal.jsDateToDateTime(getElementValue("event-endtime"));
    } else {
        startDate = getElementValue("todo-has-entrydate", "checked") ?
            cal.jsDateToDateTime(getElementValue("todo-entrydate")) : null;
        endDate = getElementValue("todo-has-duedate", "checked") ?
            cal.jsDateToDateTime(getElementValue("todo-duedate")) : null;
    }

    if (startDate && endDate) {
        var menuItem = document.getElementById('options-timezone-menuitem');
        if (menuItem.getAttribute('checked') == 'true') {
            var startTimezone = gStartTimezone;
            var endTimezone = gEndTimezone;
            if (endTimezone.isUTC) {
                if (!compareObjects(gStartTimezone, gEndTimezone)) {
                    endTimezone = gStartTimezone;
                }
            }

            startDate = startDate.getInTimezone(kDefaultTimezone);
            endDate = endDate.getInTimezone(kDefaultTimezone);

            startDate.timezone = startTimezone;
            endDate.timezone = endTimezone;
        }

        startDate = startDate.getInTimezone(kDefaultTimezone);
        endDate = endDate.getInTimezone(kDefaultTimezone);

        // For all-day events we are not interested in times and compare only
        // dates.
        if (isEvent && getElementValue("event-all-day", "checked")) {
            // jsDateToDateTime returnes the values in UTC. Depending on the
            // local timezone and the values selected in datetimepicker the date
            // in UTC might be shifted to the previous or next day.
            // For example: The user (with local timezone GMT+05) selected
            // Feb 10 2006 00:00:00. The corresponding value in UTC is
            // Feb 09 2006 19:00:00. If we now set isDate to true we end up with
            // a date of Feb 09 2006 instead of Feb 10 2006 resulting in errors
            // during the following comparison.
            // Calling getInTimezone() ensures that we use the same dates as
            // displayed to the user in datetimepicker for comparison.
            startDate.isDate = true;
            endDate.isDate = true;
        }
    }

    if (endDate && startDate && endDate.compare(startDate) == -1) {
        enableAccept = false;
    }

    enableAcceptCommand(enableAccept);

    return enableAccept;
}

/**
 * Enables/disables the commands cmd_accept and cmd_save related to the
 * save operation.
 *
 * @param aEnable           true: enables the command
 */
function enableAcceptCommand(aEnable) {
    setElementValue("cmd_accept", !aEnable, "disabled");
    setElementValue("cmd_save", !aEnable, "disabled");
}

// Global variables used to restore start and end date-time when changing the
// "all day" status in the onUpdateAllday() function.
var gOldStartTime = null;
var gOldEndTime = null;
var gOldStartTimezone = null;
var gOldEndTimezone = null;

/**
 * Handler function to update controls in consequence of the "all day" checkbox
 * being clicked.
 */
function onUpdateAllDay() {
    if (!isEvent(window.calendarItem)) {
        return;
    }
    let allDay = getElementValue("event-all-day", "checked");
    let kDefaultTimezone = calendarDefaultTimezone();

    if (allDay) {
        // Store date-times and related timezones so we can restore
        // if the user unchecks the "all day" checkbox.
        gOldStartTime = gStartTime.clone();
        gOldEndTime = gEndTime.clone();
        gOldStartTimezone = gStartTimezone;
        gOldEndTimezone = gEndTimezone;
        // When events that end at 0:00 become all-day events, we need to
        // subtract a day from the end date because the real end is midnight.
        if (gEndTime.hour == 0 && gEndTime.minute == 0) {
            let tempStartTime = gStartTime.clone();
            let tempEndTime = gEndTime.clone();
            tempStartTime.isDate = true;
            tempEndTime.isDate = true;
            tempStartTime.day++;
            if (tempEndTime.compare(tempStartTime) >= 0) {
                gEndTime.day--;
            }
        }
    } else {
        gStartTime.isDate = false;
        gEndTime.isDate = false;
        if (!gOldStartTime && !gOldEndTime) {
            // The checkbox has been unchecked for the first time, the event
            // was an "All day" type, so we have to set default values.
            gStartTime.hour = getDefaultStartDate(window.initialStartDateValue).hour;
            gEndTime.hour = gStartTime.hour;
            gEndTime.minute += getPrefSafe("calendar.event.defaultlength", 60);
            gOldStartTimezone = kDefaultTimezone;
            gOldEndTimezone = kDefaultTimezone;
        } else {
            // Restore date-times previously stored.
            gStartTime.hour = gOldStartTime.hour;
            gStartTime.minute = gOldStartTime.minute;
            gEndTime.hour = gOldEndTime.hour;
            gEndTime.minute = gOldEndTime.minute;
            // When we restore 0:00 as end time, we need to add one day to
            // the end date in order to include the last day until midnight.
            if (gEndTime.hour == 0 && gEndTime.minute == 0) {
                gEndTime.day++;
            }
        }
    }
    gStartTimezone = (allDay ? cal.floating() : gOldStartTimezone);
    gEndTimezone = (allDay ? cal.floating() : gOldEndTimezone);

    updateAllDay();
}

/**
 * This function sets the enabled/disabled state of the following controls:
 * - 'event-starttime'
 * - 'event-endtime'
 * - 'timezone-starttime'
 * - 'timezone-endtime'
 * the state depends on whether or not the event is configured as 'all-day' or not.
 */
 function updateAllDay() {
    if (gIgnoreUpdate) {
        return;
    }

    if (!isEvent(window.calendarItem)) {
        return;
    }

    let allDay = getElementValue("event-all-day", "checked");
    setElementValue("event-starttime", allDay, "timepickerdisabled");
    setElementValue("event-endtime", allDay, "timepickerdisabled");

    setShowTimeAs(allDay);

    gStartTime.isDate = allDay;
    gEndTime.isDate = allDay;
    gItemDuration = gEndTime.subtractDate(gStartTime);

    updateDateTime();
    updateRepeatDetails();
    updateAccept();
}

/**
 * Use the window arguments to cause the opener to create a new event on the
 * item's calendar
 */
function openNewEvent() {
    var item = window.calendarItem;
    var args = window.arguments[0];
    args.onNewEvent(item.calendar);
}

/**
 * Use the window arguments to cause the opener to create a new event on the
 * item's calendar
 */
function openNewTask() {
    var item = window.calendarItem;
    var args = window.arguments[0];
    args.onNewTodo(item.calendar);
}

/**
 * Open a new Thunderbird compose window.
 */
function openNewMessage() {
    MailServices.compose.OpenComposeWindow(null,
                                           null,
                                           null,
                                           Components.interfaces.nsIMsgCompType.New,
                                           Components.interfaces.nsIMsgCompFormat.Default,
                                           null,
                                           null);
}

/**
 * Open a new addressbook window
 */
function openNewCardDialog() {
    window.openDialog(
        "chrome://messenger/content/addressbook/abNewCardDialog.xul",
        "",
        "chrome,modal,resizable=no,centerscreen");
}

/**
 * Update the transparency status of this dialog, depending on if the event
 * is all-day or not.
 *
 * @param allDay    If true, the event is all-day
 */
function setShowTimeAs(allDay) {
    gShowTimeAs = (allDay ? getPrefSafe("calendar.allday.defaultTransparency", "TRANSPARENT") : "OPAQUE");
    updateShowTimeAs();
}

function editAttendees() {
    let savedWindow = window;
    let calendar = getCurrentCalendar();

    var callback = function(attendees, organizer, startTime, endTime) {
        savedWindow.attendees = attendees;
        if (organizer) {
            // In case we didn't have an organizer object before we
            // added attendees to our event we take the one created
            // by the 'invite attendee'-dialog.
            if (savedWindow.organizer) {
                // The other case is that we already had an organizer object
                // before we went throught the 'invite attendee'-dialog. In that
                // case make sure we don't carry over attributes that have been
                // set to their default values by the dialog but don't actually
                // exist in the original organizer object.
                if (!savedWindow.organizer.id) {
                    organizer.id = null;
                }
                if (!savedWindow.organizer.role) {
                    organizer.role = null;
                }
                if (!savedWindow.organizer.participationStatus) {
                    organizer.participationStatus = null;
                }
                if (!savedWindow.organizer.commonName) {
                    organizer.commonName = null;
                }
            }
            savedWindow.organizer = organizer;
        }
        var duration = endTime.subtractDate(startTime);
        startTime = startTime.clone();
        endTime = endTime.clone();
        var kDefaultTimezone = calendarDefaultTimezone();
        gStartTimezone = startTime.timezone;
        gEndTimezone = endTime.timezone;
        gStartTime = startTime.getInTimezone(kDefaultTimezone);
        gEndTime = endTime.getInTimezone(kDefaultTimezone);
        gItemDuration = duration;
        updateAttendees();
        updateDateTime();
        updateAllDay();
        if (isAllDay != gStartTime.isDate){
            setShowTimeAs(gStartTime.isDate)
        }
    };

    var startTime = gStartTime.getInTimezone(gStartTimezone);
    var endTime = gEndTime.getInTimezone(gEndTimezone);

    var isAllDay = getElementValue("event-all-day", "checked");
    if (isAllDay) {
        startTime.isDate = true;
        endTime.isDate = true;
        endTime.day += 1;
    } else {
        startTime.isDate = false;
        endTime.isDate = false;
    }

    var menuItem = document.getElementById('options-timezone-menuitem');
    var displayTimezone = menuItem.getAttribute('checked') == 'true';

    var args = new Object();
    args.startTime = startTime;
    args.endTime = endTime;
    args.displayTimezone = displayTimezone;
    args.attendees = window.attendees;
    args.organizer = window.organizer && window.organizer.clone();
    args.calendar = calendar;
    args.item = window.calendarItem;
    args.onOk = callback;
    args.fbWrapper = window.fbWrapper;

    // open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-attendees.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

/**
 * This function rotates the Privacy of an item to the next value
 * following the sequence  -> PUBLIC -> CONFIDENTIAL -> PRIVATE ->.
 */
function rotatePrivacy() {
    const states = ["PUBLIC","CONFIDENTIAL","PRIVATE"];
    gPrivacy = states[(states.indexOf(gPrivacy) + 1) % states.length];
    updatePrivacy();
}

/**
 * This function sets the privacy of an item to the value specified by
 * the attribute "privacy" of the UI-element "target".
 *
 * @param target    the calling UI-element;
 * @param event     the UI-element selection event (only for the popup menu
 *                  event-privacy-menupopup in the Privacy toolbar button).
 */
function editPrivacy(target, event) {
    gPrivacy = target.getAttribute("privacy");
    if (event) {
        event.stopPropagation();
    }
    updatePrivacy();
}

/**
 * This function updates the UI according to the global field 'gPrivacy' and the
 * selected calendar. If the selected calendar does not support privacy or only
 * certain values, these are removed from the UI. This function should be called
 * any time that gPrivacy is updated.
 */
function updatePrivacy() {
    let calendar = getCurrentCalendar();
    let hasPrivacy = capSupported("privacy");

    if (hasPrivacy) {
        var numChilds;
        var privacyValues = capValues("privacy",
                                      ["PUBLIC", "CONFIDENTIAL", "PRIVATE"]);

        // Update privacy capabilities (toolbar)
        var menupopup = document.getElementById("event-privacy-menupopup");
        if (menupopup) {
            // Only update the toolbar if the button is actually there
            numChilds = menupopup.childNodes.length;
            for (var i = 0; i < numChilds; i++) {
                var node = menupopup.childNodes[i];
                if (node.hasAttribute("privacy")) {
                    var currentPrivacyValue = node.getAttribute("privacy");
                    // Collapsed state

                    // Hide the toolbar if the value is unsupported or is for a
                    // specific provider and doesn't belong to the current provider.
                    if (privacyValues.indexOf(currentPrivacyValue) < 0 ||
                        (currentProvider && currentProvider != calendar.type)) {
                        node.setAttribute("collapsed", "true");
                    } else {
                        node.removeAttribute("collapsed");
                    }

                    // Checked state
                    if (gPrivacy == currentPrivacyValue) {
                        node.setAttribute("checked", "true");
                    } else {
                        node.removeAttribute("checked");
                    }
                }
            }
        }

        // Update privacy capabilities (menu)
        menupopup = document.getElementById("options-privacy-menupopup");
        numChilds = menupopup.childNodes.length;
        for (var i = 0; i < numChilds; i++) {
            var node = menupopup.childNodes[i];
            var currentProvider = node.getAttribute("provider");
            if (node.hasAttribute("privacy")) {
                var currentPrivacyValue = node.getAttribute("privacy");
                // Collapsed state

                // Hide the menu if the value is unsupported or is for a
                // specific provider and doesn't belong to the current provider.
                if (privacyValues.indexOf(currentPrivacyValue) < 0 ||
                    (currentProvider && currentProvider != calendar.type)) {
                    node.setAttribute("collapsed", "true");
                } else {
                    node.removeAttribute("collapsed");
                }

                // Checked state
                if (gPrivacy == currentPrivacyValue) {
                    node.setAttribute("checked", "true");
                } else {
                    node.removeAttribute("checked");
                }
            }
        }

        // Update privacy capabilities (statusbar)
        var privacyPanel = document.getElementById("status-privacy");
        var hasAnyPrivacyValue = false;
        numChilds = privacyPanel.childNodes.length;
        for (var i = 0; i < numChilds; i++) {
            var node = privacyPanel.childNodes[i];
            var currentProvider = node.getAttribute("provider");
            if (node.hasAttribute("privacy")) {
                var currentPrivacyValue = node.getAttribute("privacy");

                // Hide the panel if the value is unsupported or is for a
                // specific provider and doesn't belong to the current provider,
                // or is not the items privacy value
                if (privacyValues.indexOf(currentPrivacyValue) < 0 ||
                    (currentProvider && currentProvider != calendar.type) ||
                    gPrivacy != currentPrivacyValue) {
                    node.setAttribute("collapsed", "true");
                } else {
                    node.removeAttribute("collapsed");
                    hasAnyPrivacyValue = true;
                }
            }
        }

        // Don't show the status panel if no valid privacy value is selected
        if (!hasAnyPrivacyValue) {
            privacyPanel.setAttribute("collapsed", "true");
        } else {
            privacyPanel.removeAttribute("collapsed");
        }

    } else {
        setElementValue("button-privacy", !hasPrivacy && "true", "disabled");
        setElementValue("options-privacy-menu", !hasPrivacy && "true", "disabled");
        setElementValue("status-privacy", !hasPrivacy && "true", "collapsed");
    }
}

/**
 * Handler function to change the priority from the dialog elements
 *
 * @param target    A XUL node with a value attribute which should be the new
 *                    priority.
 */
function editPriority(target) {
    gPriority = parseInt(target.getAttribute("value"));
    updatePriority();
}

/**
 * Update the dialog controls related related to priority.
 */
function updatePriority() {
    // Set up capabilities
    var hasPriority = capSupported("priority");
    setElementValue("options-priority-menu", !hasPriority && "true", "disabled");
    setElementValue("status-priority", !hasPriority && "true", "collapsed");

    if (hasPriority) {
        var priorityLevel = "none";
        if (gPriority >= 1 && gPriority <= 4) {
            priorityLevel = "high";
        } else if (gPriority == 5) {
            priorityLevel = "normal";
        } else if (gPriority >= 6 && gPriority <= 9) {
            priorityLevel = "low";
        }

        var priorityNone = document.getElementById("cmd_priority_none");
        var priorityLow = document.getElementById("cmd_priority_low");
        var priorityNormal = document.getElementById("cmd_priority_normal");
        var priorityHigh = document.getElementById("cmd_priority_high");

        priorityNone.setAttribute("checked",
                                  priorityLevel == "none" ? "true" : "false");
        priorityLow.setAttribute("checked",
                                 priorityLevel == "low" ? "true" : "false");
        priorityNormal.setAttribute("checked",
                                    priorityLevel == "normal" ? "true" : "false");
        priorityHigh.setAttribute("checked",
                                  priorityLevel == "high" ? "true" : "false");

        // Status bar panel
        var priorityPanel = document.getElementById("status-priority");
        if (priorityLevel == "none") {
            // If the priority is none, don't show the status bar panel
            priorityPanel.setAttribute("collapsed", "true");
        } else {
            priorityPanel.removeAttribute("collapsed");
            var numChilds = priorityPanel.childNodes.length;
            var foundPriority = false;
            for (var i = 0; i < numChilds; i++) {
                var node = priorityPanel.childNodes[i];
                if (foundPriority) {
                    node.setAttribute("collapsed", "true");
                } else {
                    node.removeAttribute("collapsed");
                }
                if (node.getAttribute("value") == priorityLevel) {
                    foundPriority = true;
                }
            }
        }
    }
}

/**
 * Handler function to change the status from the dialog elements
 *
 * @param target    A XUL node with a value attribute which should be the new
 *                    status.
 */
function editStatus(target) {
    gStatus = target.getAttribute("value");
    updateStatus();
}

/**
 * Update the dialog controls related related to status.
 */
function updateStatus() {
    let found = false;
    [ "cmd_status_none",
      "cmd_status_tentative",
      "cmd_status_confirmed",
      "cmd_status_cancelled" ].forEach(
          function(element, index, array) {
              let node = document.getElementById(element);
              let matches = (node.getAttribute("value") == gStatus);
              found = found || matches;

              node.setAttribute("checked", matches ? "true" : "false");
          }
      );
    if (!found) {
        // The current Status value is invalid. Change the status to not
        // specified and update the status again.
        gStatus = "NONE";
        updateStatus();
    }
}

/**
 * Handler function to change the transparency from the dialog elements
 *
 * @param target    A XUL node with a value attribute which should be the new
 *                    transparency.
 */
function editShowTimeAs(target) {
    gShowTimeAs = target.getAttribute("value");
    updateShowTimeAs();
}

/**
 * Update the dialog controls related to transparency.
 */
function updateShowTimeAs() {
    var showAsBusy = document.getElementById("cmd_showtimeas_busy");
    var showAsFree = document.getElementById("cmd_showtimeas_free");

    showAsBusy.setAttribute("checked",
                            gShowTimeAs == "OPAQUE" ? "true" : "false");
    showAsFree.setAttribute("checked",
                            gShowTimeAs == "TRANSPARENT" ? "true" : "false");
}

function loadCloudProviders() {
    let cloudFileEnabled = cal.getPrefSafe("mail.cloud_files.enabled", false)
    let cmd = document.getElementById("cmd_attach_cloud");

    if (!cloudFileEnabled) {
        // If cloud file support is disabled, just hide the attach item
        cmd.hidden = true;
        return;
    }

    cmd.hidden = (cloudFileAccounts.accounts.length == 0);
    let toolbarPopup = document.getElementById("button-attach-menupopup");
    let optionsPopup = document.getElementById("options-attachments-menupopup");
    let attachmentPopup = document.getElementById("attachment-popup");

    for (let [,cloudProvider] in Iterator(cloudFileAccounts.accounts)) {
        let item = createXULElement("menuitem");
        let displayName = cloudFileAccounts.getDisplayName(cloudProvider);
        let label = cal.calGetString("calendar-event-dialog", "attachViaFilelink", [displayName]);
        item.setAttribute("label", label);
        item.setAttribute("observes", "cmd_attach_cloud");
        item.setAttribute("oncommand", "attachFile(event.target.cloudProvider); event.stopPropagation();");

        if (cloudProvider.iconClass) {
            item.setAttribute("class", "menuitem-iconic");
            item.setAttribute("image", cloudProvider.iconClass);
        }

        // Add the item to the different places we advertise cloud providers
        if (toolbarPopup) {
            toolbarPopup.appendChild(item.cloneNode()).cloudProvider = cloudProvider;
        }
        attachmentPopup.appendChild(item.cloneNode()).cloudProvider = cloudProvider;

        // The last one doesn't need to clone, just use the item itself.
        optionsPopup.appendChild(item).cloudProvider = cloudProvider;
    }
}

/**
 * Prompts the user to attach an url to this item.
 */
function attachURL() {
    if (Services.prompt) {
        // ghost in an example...
        var result = { value: "http://" };
        if (Services.prompt.prompt(window,
                                   calGetString("calendar-event-dialog",
                                                "specifyLinkLocation"),
                                   calGetString("calendar-event-dialog",
                                                "enterLinkLocation"),
                                   result,
                                   null,
                                   { value: 0 })) {

            try {
                // If something bogus was entered, makeURL may fail.
                var attachment = createAttachment();
                attachment.uri = makeURL(result.value);
                addAttachment(attachment);
            } catch (e) {
                // TODO We might want to show a warning instead of just not
                // adding the file
            }
        }
    }
}

/**
 * Attach a file to the item. Not passing a cloud provider is currently unsupported.
 *
 * @param cloudProvider     If set, the cloud provider will be used for attaching
 */
function attachFile(cloudProvider) {
    if (!cloudProvider) {
        cal.ERROR("[calendar-event-dialog] Could not attach file wthout cloud provider" + cal.STACK(10));
    }

    var files;
    try {
        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        let fp = Components.classes["@mozilla.org/filepicker;1"]
                           .createInstance(nsIFilePicker);
        fp.init(window,
                calGetString("calendar-event-dialog", "selectAFile"),
                nsIFilePicker.modeOpenMultiple);

        // Check for the last directory
        let lastDir = lastDirectory();
        if (lastDir) {
            fp.displayDirectory = lastDir;
        }

        // Get the attachment
        if (fp.show() == nsIFilePicker.returnOK) {
            files = fp.files;
        }
    } catch (ex) {
        dump("failed to get attachments: " +ex+ "\n");
    }

    // Check if something has to be done
    if (!files || !files.hasMoreElements()) {
        return;
    }

    // Create the attachment
    while (files.hasMoreElements()) {
        let file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);

        let fileHandler = Services.io.getProtocolHandler("file")
                                     .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
        let uriSpec = fileHandler.getURLSpecFromFile(file);

        if (!(uriSpec in gAttachMap)) {
            // If the attachment hasn't been added, then set the last display
            // directory.
            lastDirectory(uriSpec);

            // ... and add the attachment.
            let attachment = cal.createAttachment();
            if (cloudProvider) {
                attachment.uri = makeURL(uriSpec);
            } else {
                // TODO read file into attachment
            }
            addAttachment(attachment, cloudProvider);
        }
    }
}

/**
 * Helper function to remember the last directory chosen when attaching files.
 *
 * @param aFileUri    (optional) If passed, the last directory will be set and
 *                                 returned. If null, the last chosen directory
 *                                 will be returned.
 * @return            The last directory that was set with this function.
 */
function lastDirectory(aFileUri) {
    if (aFileUri) {
        // Act similar to a setter, save the passed uri.
        var uri = makeURL(aFileUri);
        var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
        lastDirectory.mValue = file.parent.QueryInterface(Components.interfaces.nsILocalFile);
    }

    // In any case, return the value
    return (lastDirectory.mValue !== undefined ? lastDirectory.mValue : null);
}

/**
 * Turns an url into a string that can be used in UI.
 * - For a file:// url, shows the filename.
 * - For a http:// url, removes protocol and trailing slash
 *
 * @param aUri    The uri to parse.
 * @return        A string that can be used in UI.
 */
function makePrettyName(aUri){
    var name = aUri.spec;
    if (aUri.schemeIs("file")) {
        name = aUri.spec.split("/").pop();
    } else if (aUri.schemeIs("http")) {
        name = aUri.spec.replace(/\/$/, "").replace(/^http:\/\//, "");
    }
    return name;
}

/**
 * Asynchronously uploads the given attachment to the cloud provider, updating
 * the passed listItem as things progress.
 *
 * @param attachment        A calIAttachment to upload
 * @param cloudProvider     The clould provider to upload to
 * @param listItem          The listitem in attachment-link listbox to update.
 */
function uploadCloudAttachment(attachment, cloudProvider, listItem) {
    let file = attachment.uri.QueryInterface(Components.interfaces.nsIFileURL).file;
    listItem.attachLocalFile = file;
    listItem.attachCloudProvider = cloudProvider;
    cloudProvider.uploadFile(file, {
        onStartRequest: function onStartRequest() {
            listItem.setAttribute("image", "chrome://messenger/skin/icons/loading.png");
        },

        onStopRequest: function onStopRequest(aRequest, aContext, aStatusCode) {
            if (Components.isSuccessCode(aStatusCode)) {
                delete gAttachMap[attachment.hashId];
                attachment.uri = makeURL(cloudProvider.urlForFile(file));
                attachment.setParameter("FILENAME", file.leafName);
                attachment.setParameter("PROVIDER", cloudProvider.type);
                listItem.setAttribute("label", file.leafName);
                gAttachMap[attachment.hashId] = attachment;
                listItem.setAttribute("image", cloudProvider.iconClass);
                updateAttachment();
            } else {
                cal.ERROR("[calendar-event-dialog] Uploading cloud attachment " +
                          "failed. Status code: " + aStatusCode);

                // Uploading failed. First of all, show an error icon. Also,
                // delete it from the attach map now, this will make sure it is
                // not serialized if the user saves.
                listItem.setAttribute("image", "chrome://messenger/skin/icons/error.png");
                delete gAttachMap[attachment.hashId];

                // Keep the item for a while so the user can see something failed.
                // When we have a nice notification bar, we can show more info
                // about the failure.
                setTimeout(function() {
                    let documentLink = document.getElementById("attachment-link");
                    documentLink.removeChild(listItem);
                    updateAttachment();
                }, 5000);
            }
        }
    });
}

/**
 * Adds the given attachment to dialog controls.
 *
 * @param attachment    The calIAttachment object to add
 * @param cloudProvider (optional) If set, the given cloud provider will be used.
 */
function addAttachment(attachment, cloudProvider) {
    if (!attachment ||
        !attachment.hashId ||
        attachment.hashId in gAttachMap) {
        return;
    }

    // We currently only support uri attachments
    if (attachment.uri) {
        let documentLink = document.getElementById("attachment-link");
        let listItem = createXULElement("listitem");

        // Set listitem attributes
        listItem.setAttribute("label", makePrettyName(attachment.uri));
        listItem.setAttribute("crop", "end");
        listItem.setAttribute("class", "listitem-iconic");
        listItem.setAttribute("tooltiptext", attachment.uri.spec);
        if (cloudProvider) {
            if (attachment.uri.schemeIs("file")) {
                // Its still a local url, needs to be uploaded
                listItem.setAttribute("image", "chrome://messenger/skin/icons/connecting.png");
                uploadCloudAttachment(attachment, cloudProvider, listItem);
            } else {
                let leafName = attachment.getParameter("FILENAME");
                listItem.setAttribute("image", cloudProvider.iconClass);
                if (leafName) {
                    listItem.setAttribute("label", leafName);
                }
            }
        } else {
            if (attachment.uri.schemeIs("file")) {
                listItem.setAttribute("image", "moz-icon://" + attachment.uri);
            } else {
                let leafName = attachment.getParameter("FILENAME");
                let providerType = attachment.getParameter("PROVIDER");
                let cloudFileEnabled = cal.getPrefSafe("mail.cloud_files.enabled", false);

                if (leafName) {
                    // TODO security issues?
                    listItem.setAttribute("label", leafName);
                }
                if (providerType && cloudFileEnabled) {
                    let cloudProvider = cloudFileAccounts.getProviderForType(providerType);
                    listItem.setAttribute("image", cloudProvider.iconClass);
                } else {
                    listItem.setAttribute("image", "moz-icon://dummy.html");
                }
            }
        }

        // Now that everything is set up, add it to the attachment box.
        documentLink.appendChild(listItem);

        // full attachment object is stored here
        listItem.attachment = attachment;

        // Update the number of rows and save our attachment globally
        documentLink.rows = documentLink.getRowCount();
    }

    gAttachMap[attachment.hashId] = attachment;
    updateAttachment();
}

/**
 * Removes the currently selected attachment from the dialog controls.
 *
 * XXX This could use a dialog maybe?
 */
function deleteAttachment() {
    let documentLink = document.getElementById("attachment-link");
    let item = documentLink.selectedItem;
    delete gAttachMap[item.attachment.hashId];
    documentLink.removeItemAt(documentLink.selectedIndex);

    if (item.attachLocalFile && item.attachCloudProvider) {
        try {
            item.attachCloudProvider.deleteFile(item.attachLocalFile, {
                onStartRequest: function() {},
                onStopRequest: function(aRequest, aContext, aStatusCode) {
                    if (!Components.isSuccessCode(aStatusCode)) {
                        // TODO With a notification bar, we could actually show this error.
                        cal.ERROR("[calendar-event-dialog] Deleting cloud attachment " +
                                  "failed, file will remain on server. " +
                                  " Status code: " + aStatusCode);
                    }
                }
            });
        } catch (e) {
            cal.ERROR("[calendar-event-dialog] Deleting cloud attachment " +
                      "failed, file will remain on server. " +
                      "Exception: " + e);
        }
    }

    updateAttachment();
}

/**
 * Removes all attachments from the dialog controls.
 */
function deleteAllAttachments() {
    var documentLink = document.getElementById("attachment-link");
    var itemCount = documentLink.getRowCount();
    var ok = (itemCount < 2);

    if (itemCount > 1) {
        ok = Services.prompt.confirm(window,
                                     calGetString("calendar-event-dialog",
                                                  "removeCalendarsTitle"),
                                     calGetString("calendar-event-dialog",
                                                  "removeCalendarsText",
                                                  [itemCount]),
                                     {});
    }

    if (ok) {
        let child;
        let documentLink = document.getElementById("attachment-link");
        while (documentLink.hasChildNodes()) {
            child = documentLink.removeChild(documentLink.lastChild);
            child.attachment = null;
        }
        gAttachMap = {};
    }
    updateAttachment();
}

/**
 * Opens the selected attachment using the external protocol service.
 * @see nsIExternalProtocolService
 */
function openAttachment() {
    // Only one file has to be selected and we don't handle base64 files at all
    var documentLink = document.getElementById("attachment-link");
    if (documentLink.selectedItems.length == 1) {
        var attURI = documentLink.getSelectedItem(0).attachment.uri;
        var externalLoader = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                                       .getService(Components.interfaces.nsIExternalProtocolService);
        // TODO There should be a nicer dialog
        externalLoader.loadUrl(attURI);
    }
}

/**
 * Copies the link location of the first selected attachment to the clipboard
 */
function copyAttachment() {
    let documentLink = document.getElementById("attachment-link");
    let attURI = documentLink.getSelectedItem(0).attachment.uri.spec;
    let clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                              .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(attURI);
}

/**
 * Handler function to handle pressing keys in the attachment listbox.
 *
 * @param event     The DOM event caused by the key press.
 */
function attachmentLinkKeyPress(event) {
    const kKE = Components.interfaces.nsIDOMKeyEvent;
    switch (event.keyCode) {
        case kKE.DOM_VK_BACK_SPACE:
        case kKE.DOM_VK_DELETE:
            deleteAttachment();
            break;
        case kKE.DOM_VK_ENTER:
            openAttachment();
            break;
    }
}

/**
 * Handler function to take care of clicking on an attachment
 *
 * @param event     The DOM event caused by the clicking.
 */
function attachmentLinkClicked(event) {
    event.currentTarget.focus();

    if (event.button != 0) {
        return;
    }

    if (event.originalTarget.localName == "listboxbody") {
        attachURL();
    } else if (event.originalTarget.localName == "listitem" && event.detail == 2) {
        openAttachment();
    }
}

/**
 * Update the dialog controls related related to the item's calendar.
 */
function updateCalendar() {
    let item = window.calendarItem;
    let calendar = getCurrentCalendar();

    gIsReadOnly = calendar.readOnly;

    // We might have to change the organizer, let's see
    let calendarOrgId = calendar.getProperty("organizerId");
    if (window.organizer && calendar.aclEntry && calendarOrgId &&
        calendar.id != item.calendar.id) {
        window.organizer.id = calendarOrgId;
        window.organizer.commonName = calendar.getProperty("organizerCN");
    }

    if (!canNotifyAttendees(calendar, item) && calendar.getProperty("imip.identity")) {
        enableElement("notify-attendees-checkbox");
    } else {
        disableElement("notify-attendees-checkbox");
    }

    // update the accept button
    updateAccept();

    // TODO: the code above decided about whether or not the item is readonly.
    // below we enable/disable all controls based on this decision.
    // unfortunately some controls need to be disabled based on some other
    // criteria. this is why we enable all controls in case the item is *not*
    // readonly and run through all those updateXXX() functions to disable
    // them again based on the specific logic build into those function. is this
    // really a good idea?
    if (gIsReadOnly) {
        var disableElements = document.getElementsByAttribute("disable-on-readonly", "true");
        for (var i = 0; i < disableElements.length; i++) {
            disableElements[i].setAttribute('disabled', 'true');

            // we mark link-labels with the hyperlink attribute, since we need
            // to remove their class in case they get disabled. TODO: it would
            // be better to create a small binding for those link-labels
            // instead of adding those special stuff.
            if (disableElements[i].hasAttribute('hyperlink')) {
                disableElements[i].removeAttribute('class');
                disableElements[i].removeAttribute('onclick');
            }
        }

        var collapseElements = document.getElementsByAttribute("collapse-on-readonly", "true");
        for (var i = 0; i < collapseElements.length; i++) {
            collapseElements[i].setAttribute('collapsed', 'true');
        }
    } else {
        var enableElements = document.getElementsByAttribute("disable-on-readonly", "true");
        for (var i = 0; i < enableElements.length; i++) {
            enableElements[i].removeAttribute('disabled');
            if (enableElements[i].hasAttribute('hyperlink')) {
                enableElements[i].setAttribute('class', 'text-link');
            }
        }

        var collapseElements = document.getElementsByAttribute("collapse-on-readonly", "true");
        for (var i = 0; i < collapseElements.length; i++) {
            collapseElements[i].removeAttribute('collapsed');
        }

        // Task completed date
        if (item.completedDate) {
            updateToDoStatus(item.status, item.completedDate.jsDate);
        } else {
            updateToDoStatus(item.status);
        }

        // disable repeat menupopup if this is an occurrence
        var item = window.calendarItem;
        if (item.parentItem != item) {
            disableElement("item-repeat");
            disableElement("repeat-until-datepicker");
            var repeatDetails = document.getElementById("repeat-details");
            var numChilds = repeatDetails.childNodes.length;
            for (var i = 0; i < numChilds; i++) {
                var node = repeatDetails.childNodes[i];
                node.setAttribute('disabled', 'true');
                node.removeAttribute('class');
                node.removeAttribute('onclick');
            }
        }

        // If the item is a proxy occurrence/instance, a few things aren't
        // valid.
        if (item.parentItem != item) {
            disableElement("item-calendar");

            // don't allow to revoke the entrydate of recurring todo's.
            disableElementWithLock("todo-has-entrydate", "permanent-lock");
        }

        // update datetime pickers, disable checkboxes if dates are required by
        // recurrence or reminders.
        updateRepeat(true);
        updateReminder(true);
        updateAllDay();
    }

    // Make sure capabilties are reflected correctly
    updateCapabilities();
}

/**
 * Opens the recurrence dialog modally to allow the user to edit the recurrence
 * rules.
 */
function editRepeat() {
    var args = new Object();
    args.calendarEvent = window.calendarItem;
    args.recurrenceInfo = window.recurrenceInfo;
    args.startTime = gStartTime;
    args.endTime = gEndTime;

    var savedWindow = window;
    args.onOk = function(recurrenceInfo) {
        savedWindow.recurrenceInfo = recurrenceInfo;
    };

    window.setCursor("wait");

    // open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-recurrence.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

/**
 * This function is responsilble for propagating UI state to controls
 * depending on the repeat setting of an item. This functionality is used
 * after the dialog has been loaded as well as if the repeat pattern has
 * been changed.
 *
 * @param aSuppressDialogs     If true, controls are updated without prompting
 *                               for changes with the recurrence dialog
 * @param aItemRepeatCall      True when the function is being called from
 *                               the item-repeat menu list. It allows to detect
 *                               a change from the "custom" option.
 */
function updateRepeat(aSuppressDialogs, aItemRepeatCall) {
    function setUpEntrydateForTask(item) {
        // if this item is a task, we need to make sure that it has
        // an entry-date, otherwise we can't create a recurrence.
        if (isToDo(item)) {
            // automatically check 'has entrydate' if needed.
            if (!getElementValue("todo-has-entrydate", "checked")) {
                setElementValue("todo-has-entrydate", "true", "checked");

                // make sure gStartTime is properly initialized
                updateEntryDate();
            }

            // disable the checkbox to indicate that we need
            // the entry-date. the 'disabled' state will be
            // revoked if the user turns off the repeat pattern.
            disableElementWithLock("todo-has-entrydate", "repeat-lock");
        }
    }

    let repeatMenu = document.getElementById("item-repeat");
    let repeatValue = repeatMenu.selectedItem.getAttribute("value");
    let repeatDeck = document.getElementById("repeat-deck");

    if (repeatValue == 'none') {
        repeatDeck.selectedIndex = -1;
        window.recurrenceInfo = null;
        var item = window.calendarItem;
        if (isToDo(item)) {
            enableElementWithLock("todo-has-entrydate", "repeat-lock");
        }
    } else if (repeatValue == 'custom') {
        let lastRepeatDeck = repeatDeck.selectedIndex;
        repeatDeck.selectedIndex = 1;
        // the user selected custom repeat pattern. we now need to bring
        // up the appropriate dialog in order to let the user specify the
        // new rule. First of all, retrieve the item we want to specify
        // the custom repeat pattern for.
        var item = window.calendarItem;

        setUpEntrydateForTask(item);

        // retrieve the current recurrence info, we need this
        // to find out whether or not the user really created
        // a new repeat pattern.
        var recurrenceInfo = window.recurrenceInfo;

        // now bring up the recurrence dialog.
        // don't pop up the dialog if aSuppressDialogs was specified or if
        // called during initialization of the dialog.
        if (!aSuppressDialogs && repeatMenu.hasAttribute("last-value")) {
            editRepeat();
        }

        // we need to address two separate cases here.
        // 1)- We need to revoke the selection of the repeat
        //     drop down list in case the user didn't specify
        //     a new repeat pattern (i.e. canceled the dialog);
        //   - re-enable the 'has entrydate' option in case
        //     we didn't end up with a recurrence rule.
        // 2)  Check whether the new recurrence rule needs the
        //     recurrence details text or it can be displayed
        //     only with the repeat-until-datepicker.
        if (recurrenceInfo == window.recurrenceInfo) {
            repeatMenu.selectedIndex = gLastRepeatSelection;
            repeatDeck.selectedIndex = lastRepeatDeck;
            if (isToDo(item)) {
                if (!window.recurrenceInfo) {
                    enableElementWithLock("todo-has-entrydate", "repeat-lock");
                }
            }
        } else {
            // From the Edit Recurrence dialog, the rules "every day" and
            // "every weekday" don't need the recurrence details text when they
            // have only the until date. The loadRepeat() function verifies
            // whether this is the case and properly sets the controls.
            loadRepeat(item);
        }
    } else {
        let item = window.calendarItem;
        let recurrenceInfo = window.recurrenceInfo || item.recurrenceInfo;
        let proposedUntilDate = (gStartTime || window.initialStartDateValue).clone();

        if (recurrenceInfo) {
            recurrenceInfo = recurrenceInfo.clone();
            let rrules = splitRecurrenceRules(recurrenceInfo);
            let rule = rrules[0][0];

            // If the previous rule was "custom" we have to recover the until
            // date, or the last occurrence's date in order to set the
            // repeat-until-datepicker with the same date.
            if (aItemRepeatCall && repeatDeck.selectedIndex == 1) {
                if (!rule.isByCount || !rule.isFinite) {
                    setElementValue("repeat-until-datepicker",
                                    !rule.isByCount ? rule.untilDate.getInTimezone(cal.floating()).jsDate
                                                    : "forever");
                } else {
                    // Try to recover the last occurrence in 10(?) years.
                    let endDate = gStartTime.clone();
                    endDate.year += 10;
                    let lastOccurrenceDate = null;
                    let dates = recurrenceInfo.getOccurrenceDates(gStartTime, endDate, 0, {});
                    if (dates) {
                        lastOccurrenceDate = dates[dates.length - 1];
                    }
                    setElementValue("repeat-until-datepicker",
                                    (lastOccurrenceDate || proposedUntilDate).getInTimezone(cal.floating()).jsDate);
                }
            }
            if (rrules[0].length > 0) {
                recurrenceInfo.deleteRecurrenceItem(rule);
            }
        } else {
            // New event proposes "forever" as default until date.
            recurrenceInfo = createRecurrenceInfo(item);
            setElementValue("repeat-until-datepicker", "forever");
        }

        repeatDeck.selectedIndex = 0;

        let recRule = createRecurrenceRule();
        recRule.interval = 1;
        switch (repeatValue) {
            case 'daily':
              recRule.type = 'DAILY';
              break;
            case 'weekly':
              recRule.type = 'WEEKLY';
              break;
            case 'every.weekday':
              recRule.type = 'DAILY';
              let onDays = [2, 3, 4, 5, 6];
              recRule.setComponent("BYDAY", onDays.length, onDays);
              break;
            case 'bi.weekly':
              recRule.type = 'WEEKLY';
              recRule.interval = 2;
              break;
            case 'monthly':
              recRule.type = 'MONTHLY';
              break;
            case 'yearly':
              recRule.type = 'YEARLY';
              break;
        }

        setUpEntrydateForTask(item);
        let repeatUntilDate = getElementValue("repeat-until-datepicker");

        if (repeatUntilDate != "forever") {
            let untilDate = cal.jsDateToDateTime(repeatUntilDate, gStartTime.timezone);
            untilDate.isDate = gStartTime.isDate; // enforce same value type as DTSTART
            if (!gStartTime.isDate) {
                untilDate.hour = gStartTime.hour;
                untilDate.minute = gStartTime.minute;
                untilDate.second = gStartTime.second;
            }
            recRule.untilDate = untilDate;
            gUntilDate = untilDate;
        } else {
            // Rule that recurs forever.
            recRule.count = -1;
            gUntilDate = null;
        }

        recurrenceInfo.insertRecurrenceItemAt(recRule, 0);
        window.recurrenceInfo = recurrenceInfo;

        if (isToDo(item)) {
            if (!getElementValue("todo-has-entrydate", "checked")) {
                setElementValue("todo-has-entrydate", "true", "checked");
            }
            disableElementWithLock("todo-has-entrydate", "repeat-lock");
        }
    }

    gLastRepeatSelection = repeatMenu.selectedIndex;
    repeatMenu.setAttribute("last-value", repeatValue);

    updateRepeatDetails();
    updateEntryDate();
    updateDueDate();
    updateAccept();
}

/**
 * Updates the UI controls related to a task's completion status.
 *
 * @param status                    The item's completion status or a string
 *                                  that allows to identify a change in the
 *                                  percent-complete's textbox.
 * @param passedInCompletedDate     The item's completed date (as a JSDate).
 */
function updateToDoStatus(status, passedInCompletedDate) {
  // RFC2445 doesn't support completedDates without the todo's status
  // being "COMPLETED", however twiddling the status menulist shouldn't
  // destroy that information at this point (in case you change status
  // back to COMPLETED). When we go to store this VTODO as .ics the
  // date will get lost.

  // remember the original values
  let oldPercentComplete = getElementValue("percent-complete-textbox");
  let oldCompletedDate = getElementValue("completed-date-picker");

  // If the percent completed has changed to 100 or from 100 to another
  // value, the status must change.
  if (status == "percent-changed") {
      let menuItemCompleted = document.getElementById("todo-status").selectedIndex == 3;
      if (oldPercentComplete == "100") {
          status = "COMPLETED";
      } else if (menuItemCompleted) {
          status = "IN-PROCESS";
      } else {
          // Changing to any other value doesn't change the status.
          return;
      }
  }

  let completedDate;
  if (passedInCompletedDate) {
      completedDate = passedInCompletedDate;
  } else {
      completedDate = null;
  }

  switch (status) {
      case null:
      case "":
      case "NONE":
          oldPercentComplete = 0;
          document.getElementById("todo-status").selectedIndex = 0;
          disableElement("percent-complete-textbox");
          disableElement("percent-complete-label");
          break;
      case "CANCELLED":
          document.getElementById("todo-status").selectedIndex = 4;
          disableElement("percent-complete-textbox");
          disableElement("percent-complete-label");
          break;
      case "COMPLETED":
          document.getElementById("todo-status").selectedIndex = 3;
          enableElement("percent-complete-textbox");
          enableElement("percent-complete-label");
          // if there isn't a completedDate, set it to the previous value
          if (!completedDate) {
              completedDate = oldCompletedDate;
          }
          break;
      case "IN-PROCESS":
          document.getElementById("todo-status").selectedIndex = 2;
          disableElement("completed-date-picker");
          enableElement("percent-complete-textbox");
          enableElement("percent-complete-label");
          break;
      case "NEEDS-ACTION":
          document.getElementById("todo-status").selectedIndex = 1;
          enableElement("percent-complete-textbox");
          enableElement("percent-complete-label");
          break;
  }

  if ((status == "IN-PROCESS" || status == "NEEDS-ACTION") &&
       oldPercentComplete == "100") {
      setElementValue("percent-complete-textbox", "0");
      setElementValue("completed-date-picker", oldCompletedDate);
      disableElement("completed-date-picker");
  } else if (status == "COMPLETED") {
      setElementValue("percent-complete-textbox", "100");
      setElementValue("completed-date-picker", completedDate);
      enableElement("completed-date-picker");
  } else {
      setElementValue("percent-complete-textbox", oldPercentComplete);
      setElementValue("completed-date-picker", oldCompletedDate);
      disableElement("completed-date-picker");
  }
}

/**
 * Saves all dialog controls back to the item.
 *
 * @return      a copy of the original item with changes made.
 */
function saveItem() {
    // we need to clone the item in order to apply the changes.
    // it is important to not apply the changes to the original item
    // (even if it happens to be mutable) in order to guarantee
    // that providers see a proper oldItem/newItem pair in case
    // they rely on this fact (e.g. WCAP does).
    var originalItem = window.calendarItem;
    var item = originalItem.clone();

    // override item's recurrenceInfo *before* serializing date/time-objects.
    if (!item.recurrenceId) {
        item.recurrenceInfo = window.recurrenceInfo;
    }

    // serialize the item
    saveDialog(item);

    item.organizer = window.organizer;

    item.removeAllAttendees();
    if (window.attendees && (window.attendees.length > 0)) {
        for each (var attendee in window.attendees) {
           item.addAttendee(attendee);
        }

        let notifyCheckbox = document.getElementById("notify-attendees-checkbox");
        if (notifyCheckbox.disabled || document.getElementById("event-grid-attendee-row-2").collapsed) {
            item.deleteProperty("X-MOZ-SEND-INVITATIONS");
        } else {
            item.setProperty("X-MOZ-SEND-INVITATIONS", notifyCheckbox.checked ? "TRUE" : "FALSE");
        }
    }

    // We check if the organizerID is different from our
    // calendar-user-address-set. The organzerID is the owner of the calendar.
    // If it's different, that is because someone is acting on behalf of
    // the organizer.
    if (item.organizer && item.calendar.aclEntry) {
        let userAddresses = item.calendar.aclEntry.getUserAddresses({});
        if (userAddresses.length > 0
            && !cal.attendeeMatchesAddresses(item.organizer, userAddresses)) {
            let organizer = item.organizer.clone();
            organizer.setProperty("SENT-BY", "mailto:" + userAddresses[0]);
            item.organizer = organizer;
        }
    }
    return item;
}

/**
 * Action to take when the user chooses to save. This can happen either by
 * saving directly or the user selecting to save after being prompted when
 * closing the dialog.
 *
 * This function also takes care of notifying this dialog's caller that the item
 * is saved.
 *
 * @param aIsClosing            If true, the save action originates from the
 *                                save prompt just before the window is closing.
 */
function onCommandSave(aIsClosing) {
    // The datepickers need to remove the focus in order to trigger the
    // validation of the values just edited, with the keyboard, but not yet
    // confirmed (i.e. not followed by a click, a tab or enter keys pressure).
    document.documentElement.focus();

    // Don't save if a warning dialog about a wrong input date must be showed.
    if (gWarning) {
        return;
    }

    let originalItem = window.calendarItem;
    let item = saveItem();
    let calendar = getCurrentCalendar();

    item.makeImmutable();
    // Set the item for now, the callback below will set the full item when the
    // call succeeded
    window.calendarItem = item;

    // When the call is complete, we need to set the new item, so that the
    // dialog is up to date.

    // XXX Do we want to disable the dialog or at least the save button until
    // the call is complete? This might help when the user tries to save twice
    // before the call is complete. In that case, we do need a progress bar and
    // the ability to cancel the operation though.
    var listener = {
        onOperationComplete: function(aCalendar, aStatus, aOpType, aId, aItem) {
            // Check if the current window has a calendarItem first, because in case of undo
            // window refers to the main window and we would get a 'calendarItem is undefined' warning.
            if ("calendarItem" in window) {
                // If we changed the calendar of the item, onOperationComplete will be called multiple
                // times. We need to make sure we're receiving the update on the right calendar.
                if ((!window.calendarItem.id ||aId == window.calendarItem.id) &&
                    (aCalendar.id == window.calendarItem.calendar.id) &&
                    Components.isSuccessCode(aStatus)) {
                    if (window.calendarItem.recurrenceId) {
                        // TODO This workaround needs to be removed in bug 396182
                        // We are editing an occurrence. Make sure that the returned
                        // item is the same occurrence, not its parent item.
                        let occ = aItem.recurrenceInfo
                                       .getOccurrenceFor(window.calendarItem.recurrenceId);
                        window.calendarItem = occ;
                    } else {
                        // We are editing the parent item, no workarounds needed
                        window.calendarItem = aItem;
                    }

                    // We now have an item, so we must change to an edit.
                    window.mode = "modify";
                    updateTitle();
                }
            }
        }
    };

    // Let the caller decide how to handle the modified/added item. Only pass
    // the above item if we are not closing, otherwise the listener will be
    // missing its window afterwards.
    window.onAcceptCallback(item, calendar, originalItem, !aIsClosing && listener);

}

/**
 * This function is called when the user chooses to delete an Item
 * from the Event/Task dialog
 *
 */
function onCommandDeleteItem() {
    // only ask for confirmation, if the User changed anything on a new item or we modify an existing item
    if (isItemChanged() || window.mode != "new") {
        let promptTitle = "";
        let promptMessage = "";

        if (cal.isEvent(window.calendarItem)) {
            promptTitle = calGetString("calendar", "deleteEventLabel");
            promptMessage = calGetString("calendar", "deleteEventMessage");
        } else if (cal.isToDo(window.calendarItem)) {
            promptTitle = calGetString("calendar", "deleteTaskLabel");
            promptMessage = calGetString("calendar", "deleteTaskMessage");
        }

        let answerDelete = Services.prompt.confirm(
                                    null,
                                    promptTitle,
                                    promptMessage);
        if (!answerDelete) {
            return;
        }
    }

    if (window.mode != "new") {
        let deleteListener = {
            // when deletion of item is complete, close the dialog
            onOperationComplete: function(aCalendar, aStatus, aOperationType, aId, aDetail) {
                // Check if the current window has a calendarItem first, because in case of undo
                // window refers to the main window and we would get a 'calendarItem is undefined' warning.
                if ("calendarItem" in window) {
                    if (aId == window.calendarItem.id && Components.isSuccessCode(aStatus)) {
                        gConfirmCancel = false;
                        document.documentElement.cancelDialog();
                    }
                }
            }
        };

        if (window.calendarItem.parentItem.recurrenceInfo && window.calendarItem.recurrenceId) {
            // if this is a single occurrence of a recurring item
            let newItem = window.calendarItem.parentItem.clone();
            newItem.recurrenceInfo.removeOccurrenceAt(window.calendarItem.recurrenceId);

            window.opener.doTransaction("modify", newItem, newItem.calendar,
                                        window.calendarItem.parentItem, deleteListener);
        } else {
            window.opener.doTransaction("delete", window.calendarItem, window.calendarItem.calendar,
                                        null, deleteListener);
        }
    } else {
        gConfirmCancel = false;
        document.documentElement.cancelDialog();
    }
}

/**
 * Handler function to toggle toolbar visibility.
 *
 * @param aToolbarId        The id of the XUL toolbar node to toggle.
 * @param aMenuitemId       The corresponding menuitem in the view menu.
 */
function onCommandViewToolbar(aToolbarId, aMenuItemId) {
    var toolbar = document.getElementById(aToolbarId);
    var menuItem = document.getElementById(aMenuItemId);

    if (!toolbar || !menuItem) {
        return;
    }

    var toolbarCollapsed = toolbar.collapsed;

    // toggle the checkbox
    menuItem.setAttribute('checked', toolbarCollapsed);

    // toggle visibility of the toolbar
    toolbar.collapsed = !toolbarCollapsed;

    document.persist(aToolbarId, 'collapsed');
    document.persist(aMenuItemId, 'checked');
}

/**
 * DialogToolboxCustomizeDone() is called after the customize toolbar dialog
 * has been closed by the user. We need to restore the state of all buttons
 * and commands of all customizable toolbars.
 *
 * @param aToolboxChanged       If true, the toolbox has changed.
 */
function DialogToolboxCustomizeDone(aToolboxChanged) {

    var menubar = document.getElementById("event-menubar");
    for (var i = 0; i < menubar.childNodes.length; ++i) {
        menubar.childNodes[i].removeAttribute("disabled");
    }

    // make sure our toolbar buttons have the correct enabled state restored to them...
    document.commandDispatcher.updateCommands('itemCommands');

    // Enable the toolbar context menu items
    document.getElementById("cmd_customize").removeAttribute("disabled");

    // Update privacy items to make sure the toolbarbutton's menupopup is set
    // correctly
    updatePrivacy();
}

/**
 * Handler function to start the customize toolbar dialog for the event dialog's
 * toolbar.
 */
function onCommandCustomize() {
    // install the callback that handles what needs to be
    // done after a toolbar has been customized.
    var toolbox = document.getElementById("event-toolbox");
    toolbox.customizeDone = DialogToolboxCustomizeDone;

    var menubar = document.getElementById("event-menubar");
    for (var i = 0; i < menubar.childNodes.length; ++i) {
        menubar.childNodes[i].setAttribute("disabled", true);
    }

    // Disable the toolbar context menu items
    document.getElementById("cmd_customize").setAttribute("disabled", "true");

    var id = "event-toolbox";
    if (isSunbird()) {
        window.openDialog("chrome://global/content/customizeToolbar.xul",
                          "CustomizeToolbar",
                          "chrome,all,dependent",
                          document.getElementById(id));
    } else {
        var wintype = document.documentElement.getAttribute("windowtype");
        wintype = wintype.replace(/:/g, "");

        window.openDialog("chrome://global/content/customizeToolbar.xul",
                          "CustomizeToolbar" + wintype,
                          "chrome,all,dependent",
                          document.getElementById(id), // toolbar dom node
                          false,                       // is mode toolbar yes/no?
                          null,                        // callback function
                          "dialog");                   // name of this mode
    }
}

/**
 * Prompts the user to change the start timezone.
 */
function editStartTimezone() {
    editTimezone("timezone-starttime",
                 gStartTime.getInTimezone(gStartTimezone),
                 editStartTimezone.complete);
}
editStartTimezone.complete = function(datetime) {
    var equalTimezones = false;
    if (gStartTimezone && gEndTimezone) {
        if (gStartTimezone == gEndTimezone) {
            equalTimezones = true;
        }
    }
    gStartTimezone = datetime.timezone;
    if (equalTimezones) {
      gEndTimezone = datetime.timezone;
    }
    updateDateTime();
};

/**
 * Prompts the user to change the end timezone.
 */
function editEndTimezone() {
    editTimezone("timezone-endtime",
                 gEndTime.getInTimezone(gEndTimezone),
                 editEndTimezone.complete);
}
editEndTimezone.complete = function(datetime) {
    gEndTimezone = datetime.timezone;
    updateDateTime();
};

/**
 * Called to choose a recent timezone from the timezone popup.
 *
 * @param event     The event with a target that holds the timezone id value.
 */
function chooseRecentTimezone(event) {
    let tzid = event.target.value;
    let timezonePopup = document.getElementById("timezone-popup");
    let tzProvider = getCurrentCalendar().getProperty("timezones.provider") ||
                     cal.getTimezoneService();

    if (tzid != "custom") {
        let zone = tzProvider.getTimezone(tzid);
        let datetime = timezonePopup.dateTime.getInTimezone(zone);
        timezonePopup.editTimezone.complete(datetime);
    }
}

/**
 * Opens the timezone popup on the node the event target points at.
 *
 * @param event     The event causing the popup to open
 * @param dateTime  The datetime for which the timezone should be modified
 * @param editFunc  The function to be called when the custom menuitem is clicked.
 */
function showTimezonePopup(event, dateTime, editFunc) {
    // Don't do anything for right/middle-clicks. Also, don't show the popup if
    // the opening node is disabled.
    if (event.button != 0 || event.target.disabled) {
        return;
    }

    let timezonePopup = document.getElementById("timezone-popup");
    let timezoneDefaultItem = document.getElementById("timezone-popup-defaulttz");
    let timezoneSeparator = document.getElementById("timezone-popup-menuseparator");
    let defaultTimezone = cal.calendarDefaultTimezone();
    let recentTimezones = cal.getRecentTimezones(true);

    // Set up the right editTimezone function, so the custom item can use it.
    timezonePopup.editTimezone = editFunc;
    timezonePopup.dateTime = dateTime;

    // Set up the default timezone item
    timezoneDefaultItem.value = defaultTimezone.tzid;
    timezoneDefaultItem.label = defaultTimezone.displayName;

    // Clear out any old recent timezones
    while (timezoneDefaultItem.nextSibling != timezoneSeparator) {
        timezonePopup.removeChild(timezoneDefaultItem.nextSibling);
    }

    // Fill in the new recent timezones
    for each (let tz in recentTimezones) {
        let menuItem = createXULElement("menuitem");
        menuItem.setAttribute("value", tz.tzid);
        menuItem.setAttribute("label", tz.displayName);
        timezonePopup.insertBefore(menuItem, timezoneDefaultItem.nextSibling);
    }

    // Show the popup
    timezonePopup.openPopup(event.target, "after_start", 0, 0, true);
}

/**
 * Common function of edit(Start|End)Timezone() to prompt the user for a
 * timezone change.
 *
 * @param aElementId        The XUL element id of the timezone label.
 * @param aDateTime         The Date/Time of the time to change zone on.
 * @param aCallback         What to do when the user has chosen a zone.
 */
function editTimezone(aElementId,aDateTime,aCallback) {
    if (document.getElementById(aElementId)
        .hasAttribute("disabled")) {
        return;
    }

    // prepare the arguments that will be passed to the dialog
    var args = new Object();
    args.time = aDateTime;
    args.calendar = getCurrentCalendar();
    args.onOk = function(datetime) {
        cal.saveRecentTimezone(datetime.timezone.tzid);
        return aCallback(datetime);
    };

    // open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-timezone.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

/**
 * This function initializes the following controls:
 * - 'event-starttime'
 * - 'event-endtime'
 * - 'event-all-day'
 * - 'todo-has-entrydate'
 * - 'todo-entrydate'
 * - 'todo-has-duedate'
 * - 'todo-duedate'
 * The date/time-objects are either displayed in their respective
 * timezone or in the default timezone. This decision is based
 * on whether or not 'options-timezone-menuitem' is checked.
 * the necessary information is taken from the following variables:
 * - 'gStartTime'
 * - 'gEndTime'
 * - 'window.calendarItem' (used to decide about event/task)
 */
function updateDateTime() {
    gIgnoreUpdate = true;

    var item = window.calendarItem;
    var menuItem = document.getElementById('options-timezone-menuitem');

    // Convert to default timezone if the timezone option
    // is *not* checked, otherwise keep the specific timezone
    // and display the labels in order to modify the timezone.
    if (menuItem.getAttribute('checked') == 'true') {
        if (isEvent(item)) {
          var startTime = gStartTime.getInTimezone(gStartTimezone);
          var endTime = gEndTime.getInTimezone(gEndTimezone);

          setElementValue("event-all-day", startTime.isDate, "checked");

          // In the case where the timezones are different but
          // the timezone of the endtime is "UTC", we convert
          // the endtime into the timezone of the starttime.
          if (startTime && endTime) {
            if (!compareObjects(startTime.timezone, endTime.timezone)) {
              if (endTime.timezone.isUTC) {
                endTime = endTime.getInTimezone(startTime.timezone);
              }
            }
          }

          // before feeding the date/time value into the control we need
          // to set the timezone to 'floating' in order to avoid the
          // automatic conversion back into the OS timezone.
          startTime.timezone = floating();
          endTime.timezone = floating();

          setElementValue("event-starttime", startTime.jsDate);
          setElementValue("event-endtime", endTime.jsDate);
        }

        if (isToDo(item)) {
          var startTime = gStartTime && gStartTime.getInTimezone(gStartTimezone);
          var endTime = gEndTime && gEndTime.getInTimezone(gEndTimezone);
          var hasEntryDate = (startTime != null);
          var hasDueDate = (endTime != null);

          if (hasEntryDate && hasDueDate) {
              setElementValue("todo-has-entrydate", hasEntryDate, "checked");
              startTime.timezone = floating();
              setElementValue("todo-entrydate", startTime.jsDate);

              setElementValue("todo-has-duedate", hasDueDate, "checked");
              endTime.timezone = floating();
              setElementValue("todo-duedate", endTime.jsDate);
          } else if (hasEntryDate) {
              setElementValue("todo-has-entrydate", hasEntryDate, "checked");
              startTime.timezone = floating();
              setElementValue("todo-entrydate", startTime.jsDate);

              startTime.timezone = floating();
              setElementValue("todo-duedate", startTime.jsDate);
          } else if (hasDueDate) {
              endTime.timezone = floating();
              setElementValue("todo-entrydate", endTime.jsDate);

              setElementValue("todo-has-duedate", hasDueDate, "checked");
              endTime.timezone = floating();
              setElementValue("todo-duedate", endTime.jsDate);
          } else {
              startTime = window.initialStartDateValue;
              startTime.timezone = floating();
              endTime = startTime.clone();

              setElementValue("todo-entrydate", startTime.jsDate);
              setElementValue("todo-duedate", endTime.jsDate);
          }
        }
    } else {
        var kDefaultTimezone = calendarDefaultTimezone();

        if (isEvent(item)) {
            var startTime = gStartTime.getInTimezone(kDefaultTimezone);
            var endTime = gEndTime.getInTimezone(kDefaultTimezone);
            setElementValue("event-all-day", startTime.isDate, "checked");

            // before feeding the date/time value into the control we need
            // to set the timezone to 'floating' in order to avoid the
            // automatic conversion back into the OS timezone.
            startTime.timezone = floating();
            endTime.timezone = floating();
            setElementValue("event-starttime", startTime.jsDate);
            setElementValue("event-endtime", endTime.jsDate);
        }

        if (isToDo(item)) {
            var startTime = gStartTime &&
                            gStartTime.getInTimezone(kDefaultTimezone);
            var endTime = gEndTime && gEndTime.getInTimezone(kDefaultTimezone);
            var hasEntryDate = (startTime != null);
            var hasDueDate = (endTime != null);

            if (hasEntryDate && hasDueDate) {
                setElementValue("todo-has-entrydate", hasEntryDate, "checked");
                startTime.timezone = floating();
                setElementValue("todo-entrydate", startTime.jsDate);

                setElementValue("todo-has-duedate", hasDueDate, "checked");
                endTime.timezone = floating();
                setElementValue("todo-duedate", endTime.jsDate);
            } else if (hasEntryDate) {
                setElementValue("todo-has-entrydate", hasEntryDate, "checked");
                startTime.timezone = floating();
                setElementValue("todo-entrydate", startTime.jsDate);

                startTime.timezone = floating();
                setElementValue("todo-duedate", startTime.jsDate);
            } else if (hasDueDate) {
                endTime.timezone = floating();
                setElementValue("todo-entrydate", endTime.jsDate);

                setElementValue("todo-has-duedate", hasDueDate, "checked");
                endTime.timezone = floating();
                setElementValue("todo-duedate", endTime.jsDate);
            } else {
                startTime = window.initialStartDateValue
                startTime.timezone = floating();
                endTime = startTime.clone();

                setElementValue("todo-entrydate", startTime.jsDate);
                setElementValue("todo-duedate", endTime.jsDate);
            }
        }
    }

    updateTimezone();
    updateAllDay();
    updateRepeatDetails();

    gIgnoreUpdate = false;
}

/**
 * This function initializes the following controls:
 * - 'timezone-starttime'
 * - 'timezone-endtime'
 * the timezone-links show the corrosponding names of the
 * start/end times. if 'options-timezone-menuitem' is not checked
 * the links will be collapsed.
 */
function updateTimezone() {
    let menuItem = document.getElementById('options-timezone-menuitem');

    // convert to default timezone if the timezone option
    // is *not* checked, otherwise keep the specific timezone
    // and display the labels in order to modify the timezone.
    if (menuItem.getAttribute('checked') == 'true') {
        let startTimezone = gStartTimezone;
        let endTimezone = gEndTimezone;

        function updateTimezoneElement(aTimezone, aId, aDateTime) {
            let element = document.getElementById(aId);
            if (!element) {
                return;
            }

            if (aTimezone) {
                element.removeAttribute('collapsed');
                element.value = aTimezone.displayName || aTimezone.tzid;
                if (!aDateTime || !aDateTime.isValid || gIsReadOnly || aDateTime.isDate) {
                    if (element.hasAttribute('class')) {
                        element.setAttribute('class-on-enabled',
                                             element.getAttribute('class'));
                        element.removeAttribute('class');
                    }
                    if (element.hasAttribute('onclick')) {
                        element.setAttribute('onclick-on-enabled',
                                             element.getAttribute('onclick'));
                        element.removeAttribute('onclick');
                    }
                    element.setAttribute('disabled', 'true');
                } else {
                    if (element.hasAttribute('class-on-enabled')) {
                        element.setAttribute('class',
                                             element.getAttribute('class-on-enabled'));
                        element.removeAttribute('class-on-enabled');
                    }
                    if (element.hasAttribute('onclick-on-enabled')) {
                        element.setAttribute('onclick',
                                             element.getAttribute('onclick-on-enabled'));
                        element.removeAttribute('onclick-on-enabled');
                    }
                    element.removeAttribute('disabled');
                }
            } else {
                element.setAttribute('collapsed', 'true');
            }
        }

        updateTimezoneElement(startTimezone,
                              'timezone-starttime',
                              gStartTime);
        updateTimezoneElement(endTimezone,
                              'timezone-endtime',
                              gEndTime);
    } else {
        document.getElementById('timezone-starttime')
                .setAttribute('collapsed', 'true');
        document.getElementById('timezone-endtime')
                .setAttribute('collapsed', 'true');
    }
}

/**
 * This function updates dialog controls related to item attachments
 */
function updateAttachment() {
    var hasAttachments = capSupported("attachments");
    setElementValue("cmd_attach_url", !hasAttachments && "true", "disabled");

    var documentRow = document.getElementById("event-grid-attachment-row");
    var attSeparator = document.getElementById("event-grid-attachment-separator");
    if (!hasAttachments) {
        documentRow.setAttribute("collapsed", "true");
        attSeparator.setAttribute("collapsed", "true");
    } else {
        var documentLink = document.getElementById("attachment-link");
        setElementValue(documentRow, documentLink.getRowCount() < 1 && "true", "collapsed");
        setElementValue(attSeparator, documentLink.getRowCount() < 1 && "true", "collapsed");
    }
}

/**
 * Toggles the visibility of the related link (rfc2445 URL property)
 */
function toggleLink() {
    var linkCommand = document.getElementById("cmd_toggle_link");
    var row = document.getElementById("event-grid-link-row");
    var separator = document.getElementById("event-grid-link-separator");

    var isHidden = row.hidden;
    row.hidden = !isHidden;
    separator.hidden = !isHidden;

    linkCommand.setAttribute("checked", isHidden ? "true" : "false");

    updateLink();
}

/**
 * This function updates dialog controls related to attendees.
 */
function updateAttendees() {
    let attendeeRow = document.getElementById("event-grid-attendee-row");
    let attendeeRow2 = document.getElementById("event-grid-attendee-row-2");
    if (window.attendees && window.attendees.length > 0) {
        attendeeRow.removeAttribute('collapsed');
        if (isEvent(window.calendarItem)) { // sending email invitations currently only supported for events
            attendeeRow2.removeAttribute('collapsed');
        } else {
            attendeeRow2.setAttribute('collapsed', 'true');
        }

        let attendeeNames = [];
        let attendeeEmails = [];
        let numAttendees = window.attendees.length;
        let emailRE = new RegExp("^mailto:(.*)", "i");
        for (let i = 0; i < numAttendees; i++) {
            let attendee = window.attendees[i];
            let name = attendee.commonName;
            if (name && name.length) {
                attendeeNames.push(name);
                let email = attendee.id;
                if (email && email.length) {
                    if (emailRE.test(email)) {
                        name += ' <' + RegExp.$1 + '>';
                    } else {
                        name += ' <' + email + '>';
                    }
                    attendeeEmails.push(name);
                }
            } else if (attendee.id && attendee.id.length) {
                let email = attendee.id;
                if (emailRE.test(email)) {
                    attendeeNames.push(RegExp.$1);
                } else {
                    attendeeNames.push(email);
                }
            } else {
                continue;
            }
        }

        let attendeeList = document.getElementById("attendee-list");
        let callback = function func() {
            attendeeList.setAttribute('value', attendeeNames.join(', '));
            attendeeList.setAttribute('tooltiptext', attendeeEmails.join(', '));
        };
        setTimeout(callback, 1);
    } else {
        attendeeRow.setAttribute('collapsed', 'true');
        attendeeRow2.setAttribute('collapsed', 'true');
    }
}

/**
 * This function updates dialog controls related to recurrence, in this case the
 * text describing the recurrence rule.
 */
function updateRepeatDetails() {
    // Don't try to show the details text for
    // anything but a custom recurrence rule.
    let recurrenceInfo = window.recurrenceInfo;
    let itemRepeat = document.getElementById("item-repeat");
    if (itemRepeat.value == "custom" && recurrenceInfo) {
        let item = window.calendarItem;
        document.getElementById("repeat-deck").selectedIndex = 1;
        // First of all collapse the details text. If we fail to
        // create a details string, we simply don't show anything.
        // this could happen if the repeat rule is something exotic
        // we don't have any strings prepared for.
        let repeatDetails = document.getElementById("repeat-details");
        repeatDetails.setAttribute("collapsed", "true");

        // Try to create a descriptive string from the rule(s).
        let kDefaultTimezone = calendarDefaultTimezone();
        let event = cal.isEvent(item);

        let startDate = getElementValue(event ? "event-starttime" : "todo-entrydate");
        let endDate = getElementValue(event ? "event-endtime" : "todo-duedate");
        startDate = cal.jsDateToDateTime(startDate, kDefaultTimezone);
        endDate = cal.jsDateToDateTime(endDate, kDefaultTimezone);

        let allDay = getElementValue("event-all-day", "checked");
        let detailsString = recurrenceRule2String(recurrenceInfo, startDate,
                                                  endDate, allDay);

        if (!detailsString) {
            detailsString = cal.calGetString("calendar-event-dialog", "ruleTooComplex");
        }

        // Now display the string...
        let lines = detailsString.split("\n");
        repeatDetails.removeAttribute("collapsed");
        while (repeatDetails.childNodes.length > lines.length) {
            repeatDetails.removeChild(repeatDetails.lastChild);
        }
        let numChilds = repeatDetails.childNodes.length;
        for (let i = 0; i < lines.length; i++) {
            if (i >= numChilds) {
                var newNode = repeatDetails.childNodes[0]
                                           .cloneNode(true);
                repeatDetails.appendChild(newNode);
            }
            repeatDetails.childNodes[i].value = lines[i];
            repeatDetails.childNodes[i].setAttribute("tooltiptext",
                                                     detailsString);
        }
    } else {
        let repeatDetails = document.getElementById("repeat-details");
        repeatDetails.setAttribute("collapsed", "true");
    }
}

/**
 * This function does not strictly check if the given attendee has the status
 * TENTATIVE, but also if he hasn't responded.
 *
 * @param aAttendee     The attendee to check.
 * @return              True, if the attendee hasn't responded.
 */
function isAttendeeUndecided(aAttendee) {
    return aAttendee.participationStatus != "ACCEPTED" &&
           aAttendee.participationStatus != "DECLINED" &&
           aAttendee.participationStatus != "DELEGATED";
}

/**
 * Event handler to set up the attendee-popup. This builds the popup menuitems.
 *
 * @param event         The popupshowing event
 */
function showAttendeePopup(event) {
    // Don't do anything for right/middle-clicks
    if (event.button != 0) {
        return;
    }

    var responsiveAttendees = 0;

    // anonymous helper function to
    // initialize a dynamically created menuitem
    function setup_node(aNode, aAttendee) {
        // Count attendees that have done something.
        if (!isAttendeeUndecided(aAttendee)) {
            responsiveAttendees++;
        }

        aNode.setAttribute("label", aAttendee.toString());
        aNode.setAttribute("status", aAttendee.participationStatus);
        aNode.attendee = aAttendee;
    }

    // Setup the first menuitem, this one serves as the template for further
    // menuitems.
    var attendees = window.attendees;
    var popup = document.getElementById("attendee-popup");
    var separator = document.getElementById("attendee-popup-separator");
    var template = separator.nextSibling;

    setup_node(template, attendees[0]);

    // Remove all remaining menu items after the separator and the template menu
    // item.
    while (template.nextSibling) {
        popup.removeChild(template.nextSibling);
    }

    // Add the rest of the attendees.
    for (var i = 1; i < attendees.length; i++) {
        var attendee = attendees[i];
        var newNode = template.cloneNode(true);
        setup_node(newNode, attendee);
        popup.appendChild(newNode);
    }

    // Set up the unanswered attendees item.
    if (responsiveAttendees == attendees.length) {
        document.getElementById("cmd_email_undecided")
                .setAttribute("disabled", "true");
    } else {
        document.getElementById("cmd_email_undecided")
                .removeAttribute("disabled");
    }

    // Show the popup.
    var attendeeList = document.getElementById("attendee-list");
    popup.openPopup(attendeeList, "after_start", 0, 0, true);
}

/**
 * Send Email to all attendees that haven't responded or are tentative.
 *
 * @param aAttendees    The attendees to check.
 */
function sendMailToUndecidedAttendees(aAttendees) {
    var targetAttendees = attendees.filter(isAttendeeUndecided);
    sendMailToAttendees(targetAttendees);
}

/**
 * Send Email to all given attendees.
 *
 * @param aAttendees    The attendees to send mail to.
 */
function sendMailToAttendees(aAttendees) {
    var toList = "";
    var item = saveItem();

    for each (var attendee in aAttendees) {
        if (attendee.id && attendee.id.length) {
            var email = attendee.id;
            var re = new RegExp("^mailto:(.*)", "i");
            if (email && email.length) {
                if (re.test(email)) {
                    email = RegExp.$1;
                } else {
                    email = email;
                }
            }
            // Prevent trailing commas.
            if (toList.length > 0) {
                toList += ",";
            }
            // Add this recipient id to the list.
            toList += email;
        }
    }

    // Set up the subject
    var emailSubject = calGetString("calendar-event-dialog",
                                    "emailSubjectReply",
                                    [item.title]);

    sendMailTo(toList, emailSubject);
}

/**
 * Make sure all fields that may have calendar specific capabilities are updated
 */
function updateCapabilities() {
    updateAttachment();
    updatePriority();
    updatePrivacy();
    updateReminderDetails();
}

/**
 * find out if the User already changed values in the Dialog
 *
 * @return:    true if the values in the Dialog have changed. False otherwise.
 */
function isItemChanged() {
    let newItem = saveItem();
    let oldItem = window.calendarItem.clone();

    // we need to guide the description text through the text-field since
    // newlines are getting converted which would indicate changes to the
    // text.
    setElementValue("item-description", oldItem.getProperty("DESCRIPTION"));
    setItemProperty(oldItem,
                    "DESCRIPTION",
                    getElementValue("item-description"));
    setElementValue("item-description", newItem.getProperty("DESCRIPTION"));

    if ((newItem.calendar.id == oldItem.calendar.id) &&
        compareItemContent(newItem, oldItem)) {
        return false;
    }
    return true;
}

/**
 * Test if a specific capability is supported
 *
 * @param aCap      The capability from "capabilities.<aCap>.supported"
 */
function capSupported(aCap) {
    let calendar = getCurrentCalendar();
    return calendar.getProperty("capabilities." + aCap + ".supported") !== false;
}

/**
 * Return the values for a certain capability.
 *
 * @param aCap      The capability from "capabilities.<aCap>.values"
 * @return          The values for this capability
 */
function capValues(aCap, aDefault) {
    let calendar = getCurrentCalendar();
    let vals = calendar.getProperty("capabilities." + aCap + ".values");
    return (vals === null ? aDefault : vals);
}

 /**
 * Checks the until date just entered in the datepicker in order to avoid
 * setting a date earlier than the start date.
 * Restores the previous correct date; sets the warning flag to prevent closing
 * the dialog when the user enters a wrong until date.
 */
function checkUntilDate() {
    let repeatUntilDate = getElementValue("repeat-until-datepicker");
    if (repeatUntilDate == "forever") {
        updateRepeat();
        // "forever" is never earlier than another date.
        return;
    }

    // The "time" part of the until date will be correctly assigned in the
    // updateRepeat() function, but here we need to check only the date.
    let untilDate = cal.jsDateToDateTime(repeatUntilDate, gStartTime.timezone);
    let startDate = gStartTime.clone();
    startDate.isDate = true;
    if (untilDate.compare(startDate) < 0) {
        // Restore the previous date. Since we are checking an until date,
        // a null value for gUntilDate means repeat "forever".
        setElementValue("repeat-until-datepicker",
                        gUntilDate ? gUntilDate.getInTimezone(cal.floating()).jsDate
                                   : "forever");
        gWarning = true;
        let callback = function() {
            // Disable the "Save" and "Save and Close" commands as long as the
            // warning dialog is showed.
            enableAcceptCommand(false);

            Services.prompt.alert(
                null,
                document.title,
                calGetString("calendar", "warningUntilBeforeStart"));
            enableAcceptCommand(true);
            gWarning = false;
        };
        setTimeout(callback, 1);
    } else {
        gUntilDate = untilDate;
        updateRepeat();
    }
}
