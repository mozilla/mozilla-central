/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://calendar/modules/calRecurrenceUtils.jsm");

/**
 * Dispose of controlling operations of this event dialog. Uses
 * window.arguments[0].job.dispose()
 */
function dispose() {
    var args = window.arguments[0];
    if (args.job && args.job.dispose) {
        args.job.dispose();
    }
    resetDialogId(document.documentElement);
}

/**
 * Sets the id of a Dialog to another value to allow different window-icons to be displayed.
 * The original name is stored as new Attribute of the Dialog to set it back later.
 *
 * @param aDialog               The Dialog to be changed.
 * @param aNewId                The new ID as String.
 */
function setDialogId(aDialog, aNewId) {
    aDialog.setAttribute("originalId", aDialog.getAttribute("id"));
    aDialog.setAttribute("id", aNewId);
}

/**
 * Sets the Dialog id back to previously stored one,
 * so that the persisted values are correctly saved.
 *
 * @param aDialog               The Dialog which is to be restored.
 */
function resetDialogId(aDialog) {
    let id = aDialog.getAttribute("originalId");
    if (id != "") {
        aDialog.setAttribute("id", id);
    }
    aDialog.removeAttribute("originalId");
}

/**
 * Create a calIAlarm from the given menuitem. The menuitem must have the
 * following attributes: unit, length, origin, relation.
 *
 * @param menuitem      The menuitem to create the alarm from.
 * @return              The calIAlarm with information from the menuitem.
 */
function createReminderFromMenuitem(aMenuitem) {
    let reminder = aMenuitem.reminder || cal.createAlarm();
    let offset = cal.createDuration();
    offset[aMenuitem.getAttribute("unit")] = aMenuitem.getAttribute("length");
    offset.normalize();
    offset.isNegative = (aMenuitem.getAttribute("origin") == "before");
    reminder.related = (aMenuitem.getAttribute("relation") == "START" ?
                        reminder.ALARM_RELATED_START : reminder.ALARM_RELATED_END);
    reminder.offset = offset;
    reminder.action = getDefaultAlarmType();
    return reminder;
}

/**
 * This function opens the needed dialogs to edit the reminder. Note however
 * that calling this function from an extension is not recommended. To allow an
 * extension to open the reminder dialog, set the menulist "item-alarm" to the
 * custom menuitem and call updateReminder().
 */
function editReminder() {
    let customItem =  document.getElementById("reminder-custom-menuitem");
    let args = {};
    args.reminders = customItem.reminders;
    args.item = window.calendarItem;
    args.timezone = (window.gStartTimezone ||
                     window.gEndTimezone ||
                     calendarDefaultTimezone());

    args.calendar = getCurrentCalendar();
    let savedWindow = window;

    // While these are "just" callbacks, the dialog is opened modally, so aside
    // from whats needed to set up the reminders, nothing else needs to be done.
    args.onOk = function(reminders) {
        customItem.reminders = reminders;
    };
    args.onCancel = function() {
        document.getElementById("item-alarm").selectedIndex = gLastAlarmSelection;
    };

    window.setCursor("wait");

    // open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-reminder.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

/**
 * Update the reminder details from the selected alarm. This shows a string
 * describing the reminder set, or nothing in case a preselected reminder was
 * chosen.
 */
function updateReminderDetails() {
    // find relevant elements in the document
    let reminderList = document.getElementById("item-alarm");
    let reminderMultipleLabel = document.getElementById("reminder-multiple-alarms-label");
    let iconBox = document.getElementById("reminder-icon-box");
    let reminderSingleLabel = document.getElementById("reminder-single-alarms-label");
    let reminders = document.getElementById("reminder-custom-menuitem").reminders || [];
    let calendar = getCurrentCalendar();
    let actionValues = calendar.getProperty("capabilities.alarms.actionValues") || ["DISPLAY"];
    let actionMap = {};
    for each (var action in actionValues) {
        actionMap[action] = true;
    }

    // Filter out any unsupported action types.
    reminders = reminders.filter(function(x) x.action in actionMap);

    if (reminderList.value == "custom") {
        // Depending on how many alarms we have, show either the "Multiple Alarms"
        // label or the single reminder label.
        setElementValue(reminderMultipleLabel,
                        reminders.length < 2 && "true",
                        "hidden");
        setElementValue(reminderSingleLabel,
                        reminders.length > 1 && "true",
                        "hidden");

        cal.alarms.addReminderImages(iconBox, reminders);

        // If there is only one reminder, display the reminder string
        if (reminders.length == 1) {
            setElementValue(reminderSingleLabel,
                            reminders[0].toString(window.calendarItem));
        }
    } else {
        hideElement(reminderMultipleLabel);
        hideElement(reminderSingleLabel);
        if (reminderList.value != "none") {
            // This is one of the predefined dropdown items. We should show a single
            // icon in the icons box to tell the user what kind of alarm this will
            // be.
            let mockAlarm = cal.createAlarm();
            mockAlarm.action = getDefaultAlarmType();
            cal.alarms.addReminderImages(iconBox, [mockAlarm]);
        } else {
            // No reminder selected means show no icons.
            removeChildren(iconBox);
        }
    }
}

var gLastAlarmSelection = 0;

function matchCustomReminderToMenuitem(reminder) {
    let defaultAlarmType = getDefaultAlarmType();
    let reminderList = document.getElementById("item-alarm");
    let reminderPopup = reminderList.firstChild;
    if (reminder.related != Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE &&
        reminder.offset &&
        reminder.action == defaultAlarmType) {
        // Exactly one reminder thats not absolute, we may be able to match up
        // popup items.
        let relation = (reminder.related == reminder.ALARM_RELATED_START ? "START" : "END");
        let origin;

        // If the time duration for offset is 0, means the reminder is '0 minutes before'
        if (reminder.offset.inSeconds == 0 || reminder.offset.isNegative) {
            origin = "before";
        } else {
            origin = "after";
        }

        let unitMap = {
          days: 86400,
          hours: 3600,
          minutes: 60
        };

        for each (let menuitem in Array.slice(reminderPopup.childNodes)) {
            if (menuitem.localName == "menuitem" &&
                menuitem.hasAttribute("length") &&
                menuitem.getAttribute("origin") == origin &&
                menuitem.getAttribute("relation") == relation) {
                let unitMult = unitMap[menuitem.getAttribute("unit")] || 1;
                let length = menuitem.getAttribute("length") * unitMult;

                if (Math.abs(reminder.offset.inSeconds) == length) {
                    menuitem.reminder = reminder.clone();
                    reminderList.selectedItem = menuitem;
                    // We've selected an item, so we are done here.
                    return true;
                }
            }
        }
    }

    return false;
}
/**
 * Load an item's reminders into the dialog
 *
 * @param reminders     An array of calIAlarms to load. 
 */
function loadReminders(reminders) {
    // select 'no reminder' by default
    let reminderList = document.getElementById("item-alarm");
    let reminderPopup = reminderList.firstChild;
    let customItem = document.getElementById("reminder-custom-menuitem");
    reminderList.selectedIndex = 0;
    gLastAlarmSelection = 0;

    if (!reminders || !reminders.length) {
        // No reminders selected, we are done
        return;
    }

    if (reminders.length > 1 ||
        !matchCustomReminderToMenuitem(reminders[0])) {
        // If more than one alarm is selected, or we didn't find a matching item
        // above, then select the "custom" item and attach the item's reminders to
        // it.
        reminderList.value = 'custom';
        customItem.reminders = reminders;
    }

    // remember the selected index
    gLastAlarmSelection = reminderList.selectedIndex;
}

/**
 * Save the selected reminder into the passed item.
 *
 * @param item      The item save the reminder into.
 */
function saveReminder(item) {
    // We want to compare the old alarms with the new ones. If these are not
    // the same, then clear the snooze/dismiss times
    let oldAlarmMap = {};
    for each (let alarm in item.getAlarms({})) {
        oldAlarmMap[alarm.icalString] = true;
    }

    // Clear the alarms so we can add our new ones.
    item.clearAlarms();

    let reminderList = document.getElementById("item-alarm");
    if (reminderList.value != 'none') {
        let menuitem = reminderList.selectedItem;
        let reminders;

        if (menuitem.reminders) {
            // Custom reminder entries carry their own reminder object with
            // them. Make sure to clone in case these are the original item's
            // reminders.

            // XXX do we need to clone here?
            reminders = menuitem.reminders.map(function(x) x.clone());
        } else {
            // Pre-defined entries specify the necessary information
            // as attributes attached to the menuitem elements.
            reminders = [createReminderFromMenuitem(menuitem)];
        }

        let alarmCaps = item.calendar.getProperty("capabilities.alarms.actionValues") ||
                        ["DISPLAY"];
        let alarmActions = {};
        for each (let action in alarmCaps) {
            alarmActions[action] = true;
        }

        // Make sure only alarms are saved that work in the given calendar.
        reminders.filter(function(x) x.action in alarmActions)
                 .forEach(item.addAlarm, item);
    }

    // Compare alarms to see if something changed.
    for each (let alarm in item.getAlarms({})) {
        let ics = alarm.icalString;
        if (ics in oldAlarmMap) {
            // The new alarm is also in the old set, remember this
            delete oldAlarmMap[ics];
        } else {
            // The new alarm is not in the old set, this means the alarms
            // differ and we can break out.
            oldAlarmMap[ics] = true;
            break;
       }
    }

    // If the alarms differ, clear the snooze/dismiss properties
    if (Object.keys(oldAlarmMap).length > 0) {
        let cmp = "X-MOZ-SNOOZE-TIME";
        let cmpLength = cmp.length;

        // Recurring item alarms potentially have more snooze props, remove them
        // all.
        let propIterator = fixIterator(item.propertyEnumerator, Components.interfaces.nsIProperty);
        let propsToDelete = [
            prop.name
            for each (prop in propIterator)
            if (prop.name.substr(0, cmpLength) == cmp)
        ];

        item.alarmLastAck = null;
        propsToDelete.forEach(item.deleteProperty, item);
    }
}

/**
 * Get the default alarm type for the currently selected calendar. If the
 * calendar supports DISPLAY alarms, this is the default. Otherwise it is the
 * first alarm action the calendar supports.
 *
 * @return      The default alarm type.
 */
function getDefaultAlarmType() {
    let calendar = getCurrentCalendar();
    let alarmCaps = calendar.getProperty("capabilities.alarms.actionValues") ||
                    ["DISPLAY"];
    return (alarmCaps.indexOf("DISPLAY") < 0 ? alarmCaps[0] : "DISPLAY");
}

/**
 * Get the currently selected calendar. For dialogs with a menulist of
 * calendars, this is the currently chosen calendar, otherwise its the fixed
 * calendar from the window's item.
 *
 * @return      The currently selected calendar.
 */
function getCurrentCalendar() {
    let calendarNode = document.getElementById("item-calendar");
    return (calendarNode && calendarNode.selectedItem ?
                calendarNode.selectedItem.calendar :
                window.calendarItem.calendar);
}

/**
 * Common update functions for both event dialogs. Called when a reminder has
 * been selected from the menulist.
 *
 * @param aSuppressDialogs     If true, controls are updated without prompting
 *                               for changes with the dialog
 */
function commonUpdateReminder(aSuppressDialogs) {
    // if a custom reminder has been selected, we show the appropriate
    // dialog in order to allow the user to specify the details.
    // the result will be placed in the 'reminder-custom-menuitem' tag.
    let reminderList = document.getElementById("item-alarm");
    if (reminderList.value == 'custom') {
        // Clear the reminder icons first, this will make sure that while the
        // dialog is open the default reminder image is not shown which may
        // confuse users.
        removeChildren("reminder-icon-box");

        // show the dialog. This call blocks until the dialog is closed. Don't
        // pop up the dialog if aSuppressDialogs was specified or if this
        // happens during initialization of the dialog
        if (!aSuppressDialogs && reminderList.hasAttribute("last-value")) {
            editReminder();
        }

        if (reminderList.value == 'custom') {
            // Only do this if the 'custom' item is still selected. If the edit
            // reminder dialog was canceled then the previously selected
            // menuitem is selected, which may not be the custom menuitem.

            // If one or no reminders were selected, we have a chance of mapping
            // them to the existing elements in the dropdown.
            let customItem = reminderList.selectedItem;
            if (customItem.reminders.length == 0) {
                // No reminder was selected
                reminderList.value = "none";
            } else if (customItem.reminders.length == 1) {
                // We might be able to match the custom reminder with one of the
                // default menu items.
                matchCustomReminderToMenuitem(customItem.reminders[0]);
            }
        }
    }

    // remember the current reminder drop down selection index.
    gLastAlarmSelection = reminderList.selectedIndex;
    reminderList.setAttribute("last-value", reminderList.value);

    // possibly the selected reminder conflicts with the item.
    // for example an end-relation combined with a task without duedate
    // is an invalid state we need to take care of. we take the same
    // approach as with recurring tasks. in case the reminder is related
    // to the entry date we check the entry date automatically and disable
    // the checkbox. the same goes for end related reminder and the due date.
    if (isToDo(window.calendarItem)) {
        // In general, (re-)enable the due/entry checkboxes. This will be
        // changed in case the alarms are related to START/END below.
        enableElementWithLock("todo-has-duedate", "reminder-lock");
        enableElementWithLock("todo-has-entrydate", "reminder-lock");

        let menuitem = reminderList.selectedItem;
        if (menuitem.value != 'none') {
            // In case a reminder is selected, retrieve the array of alarms from
            // it, or create one from the currently selected menuitem.
            let reminders = menuitem.reminders || [createReminderFromMenuitem(menuitem)];

            // If a reminder is related to the entry date...
            if (reminders.some(function(x) x.related == x.ALARM_RELATED_START)) {
                // ...automatically check 'has entrydate'.
                if (!getElementValue("todo-has-entrydate", "checked")) {
                    setElementValue("todo-has-entrydate", "true", "checked");

                    // Make sure gStartTime is properly initialized
                    updateEntryDate();
                }

                // Disable the checkbox to indicate that we need the entry-date.
                disableElementWithLock("todo-has-entrydate", "reminder-lock");
            }

            // If a reminder is related to the due date...
            if (reminders.some(function(x) x.related == x.ALARM_RELATED_END)) {
                // ...automatically check 'has duedate'.
                if (!getElementValue("todo-has-duedate", "checked")) {
                    setElementValue("todo-has-duedate", "true", "checked");

                    // Make sure gStartTime is properly initialized
                    updateDueDate();
                }

                // Disable the checkbox to indicate that we need the entry-date.
                disableElementWithLock("todo-has-duedate", "reminder-lock");
            }
        }
    }

    updateReminderDetails();
}

/**
 * Updates the related link on the dialog
 */
function updateLink() {
    var itemUrlString = window.calendarItem.getProperty("URL") || "";
    var linkCommand = document.getElementById("cmd_toggle_link");

    function hideOrShow(aBool) {
        setElementValue("event-grid-link-row", !aBool && "true", "hidden");
        var separator = document.getElementById("event-grid-link-separator");
        if (separator) {
            // The separator is not there in the summary dialog
            setElementValue("event-grid-link-separator", !aBool && "true", "hidden");
        }
    }

    if (linkCommand) {
        // Disable if there is no url
        setElementValue(linkCommand,
                        !itemUrlString.length && "true",
                        "disabled");
    }

    if ((linkCommand && linkCommand.getAttribute("checked") != "true") ||
        !itemUrlString.length) {
        // Hide if there is no url, or the menuitem was chosen so that the url
        // should be hidden
        hideOrShow(false);
    } else {
        var handler, uri;
        try {
            uri = makeURL(itemUrlString);
            handler = Services.io.getProtocolHandler(uri.scheme);
        } catch (e) {
            // No protocol handler for the given protocol, or invalid uri
            hideOrShow(false);
            return;
        }

        // Only show if its either an internal protcol handler, or its external
        // and there is an external app for the scheme
        handler = cal.wrapInstance(handler, Components.interfaces.nsIExternalProtocolHandler);
        hideOrShow(!handler||
                   handler.externalAppExistsForScheme(uri.scheme));

        setTimeout(function() {
          // HACK the url-link doesn't crop when setting the value in onLoad
          setElementValue("url-link", itemUrlString);
          setElementValue("url-link", itemUrlString, "href");
        }, 0);
    }
}
