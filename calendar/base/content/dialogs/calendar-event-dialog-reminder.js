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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

let allowedActionsMap = {}; 

/**
 * Sets up the reminder dialog.
 */
function onLoad() {
    let calendar = window.arguments[0].calendar;

    // Make sure the origin menulist uses the right labels, depending on if the
    // dialog is showing an event or task.
    document.getElementById("reminder-origin-start-menuitem")
            .setAttribute("label", calGetString("calendar-alarms",
                                                getItemBundleStringName("reminderDialogOriginBegin")));
    document.getElementById("reminder-origin-end-menuitem")
            .setAttribute("label", calGetString("calendar-alarms",
                                                getItemBundleStringName("reminderDialogOriginEnd")));

    // Set up the action map
    let supportedActions = calendar.getProperty("capabilities.alarms.actionValues") ||
                           ["DISPLAY" /* TODO email support, "EMAIL" */];
    for each (let action in supportedActions) {
        allowedActionsMap[action] = true;
    }

    // Hide all actions that are not supported by this provider
    let firstAvailableItem;
    let actionNodes = document.getElementById("reminder-actions-menupopup").childNodes;
    for each (let actionNode in Array.slice(actionNodes)) {
        let shouldHide = (!(actionNode.value in allowedActionsMap) ||
                          (actionNode.hasAttribute("provider") &&
                           actionNode.getAttribute("provider") != calendar.type));
        setElementValue(actionNode, shouldHide && "true", "hidden");
        if (!firstAvailableItem && !shouldHide) {
            firstAvailableItem = actionNode;
        }
    }

    // Correct the selected item on the supported actions list. This will be
    // changed when reminders are loaded, but in case there are none we need to
    // provide a sensible default.
    if (firstAvailableItem) {
        document.getElementById("reminder-actions-menulist").selectedItem = firstAvailableItem;
    }

    loadReminders();
    opener.setCursor("auto");
}

/**
 * Load Reminders from the window's arguments and set up dialog controls to
 * their initial values.
 */
function loadReminders() {
    let args = window.arguments[0];
    let listbox = document.getElementById("reminder-listbox");
    let reminders = args.reminders || args.item.getAlarms({});

    // This dialog should not be shown if the calendar doesn't support alarms at
    // all, so the case of maxCount = 0 breaking this logic doesn't apply.
    let maxReminders = args.calendar.getProperty("capabilities.alarms.maxCount");
    let count = Math.min(reminders.length, maxReminders || reminders.length);
    for (let i = 0; i < count; i++) {
        if (reminders[i].action in allowedActionsMap) {
            // Set up the listitem and add it to the listbox, but only if the
            // action is actually supported by the calendar.
            listbox.appendChild(setupListItem(null, reminders[i].clone(), args.item));
        }
    }

    // Set up a default absolute date. This will be overridden if the selected
    // alarm is absolute.
    let absDate = document.getElementById("reminder-absolute-date");
    absDate.value = getDefaultStartDate().jsDate;

    if (listbox.childNodes.length) {
        // We have reminders, select the first by default. For some reason,
        // setting the selected index in a load handler makes the selection
        // break for the set item, therefore we need a setTimeout.
        setupMaxReminders();
        setTimeout(function() { listbox.selectedIndex = 0; }, 0);
    } else {
        // Make sure the fields are disabled if we have no alarms
        setupRadioEnabledState(true);
    }
}

/**
 * Sets up the enabled state of the reminder details controls. Used when
 * switching between absolute and relative alarms to disable and enable the
 * needed controls.
 *
 * @param aDisableAll       Disable all relation controls. Used when no alarms
 *                            are added yet.
 */
function setupRadioEnabledState(aDisableAll) {
    let relationItem = document.getElementById("reminder-relation-radiogroup").selectedItem;
    let relativeDisabled, absoluteDisabled;

    // Note that the mix of string/boolean here is not a mistake.
    // setElementValue removes the attribute from the node if the second
    // parameter is === false, otherwise sets the attribute value to the given
    // string (i.e "true").
    if (aDisableAll) {
        relativeDisabled = "true";
        absoluteDisabled = "true";
    } else if (relationItem) {
        // This is not a mistake, when this function is called from onselect,
        // the value has not been set.
        relativeDisabled = (relationItem.value == "absolute") && "true";
        absoluteDisabled = (relationItem.value == "relative") && "true";
    } else {
        relativeDisabled = false;
        absoluteDisabled = false;
    }

    setElementValue("reminder-length", relativeDisabled, "disabled");
    setElementValue("reminder-unit", relativeDisabled, "disabled");
    setElementValue("reminder-relation", relativeDisabled, "disabled");
    setElementValue("reminder-origin", relativeDisabled, "disabled");

    setElementValue("reminder-absolute-date", absoluteDisabled, "disabled");

    let disableAll = (aDisableAll ? "true" : false);
    setElementValue("reminder-relative-radio", disableAll, "disabled");
    setElementValue("reminder-absolute-radio", disableAll, "disabled");
    setElementValue("reminder-actions-menulist", disableAll, "disabled");
}

/**
 * Sets up the max reminders notification. Shows or hides the notification
 * depending on if the max reminders limit has been hit or not.
 */
function setupMaxReminders() {
    let args = window.arguments[0];
    let listbox = document.getElementById("reminder-listbox");
    let notificationbox = document.getElementById("reminder-notifications");
    let maxReminders = args.calendar.getProperty("capabilities.alarms.maxCount");

    // != null is needed here to ensure cond to be true/false, instead of
    // true/null. The former is needed for setElementValue.
    let cond = (maxReminders != null && listbox.childNodes.length >= maxReminders);

    // If we hit the maximum number of reminders, show the error box and
    // disable the new button.
    setElementValue("reminder-new-button", cond && "true", "disabled");
    
    if (!setupMaxReminders.notification) {
        let notification = createXULElement("notification");
        let localeErrorString = 
            calGetString("calendar-alarms",
                         getItemBundleStringName("reminderErrorMaxCountReached"),
                         [maxReminders]);
        let pluralErrorLabel = PluralForm.get(maxReminders, localeErrorString)
                                         .replace("#1", maxReminders);

        notification.setAttribute("label", pluralErrorLabel);
        notification.setAttribute("type", "warning");
        notification.setAttribute("hideclose", "true");
        setupMaxReminders.notification = notification;
    }

    if (cond) {
        notificationbox.appendChild(setupMaxReminders.notification);
    } else {
        try {
            notificationbox.removeNotification(setupMaxReminders.notification);
        } catch (e if e.code == e.NOT_FOUND_ERR) {
            // Its ok to swallow this, if the notification element hasn't been
            // added then the call will throw a DOM NOT_FOUND_ERR.
        }
    }
}

/**
 * Sets up a reminder listitem for the list of reminders applied to this item.
 *
 * @param aListItem     (optional) A reference listitem to set up. If not
 *                                   passed, a new listitem will be created.
 * @param aReminder     The calIAlarm to display in this listitem
 * @param aItem         The item the alarm is set up on.
 * @return              The  XUL listitem node showing the passed reminder.
 */
function setupListItem(aListItem, aReminder, aItem) {
    let listitem = aListItem || createXULElement("listitem");

    // Create a random id to be used for accessibility
    let reminderId = cal.getUUID();
    let ariaLabel = "reminder-action-" + aReminder.action + " " + reminderId;

    listitem.reminder = aReminder;
    listitem.setAttribute("id", reminderId);
    listitem.setAttribute("label", aReminder.toString(aItem));
    listitem.setAttribute("aria-labelledby", ariaLabel);
    listitem.setAttribute("class", "reminder-icon listitem-iconic");
    listitem.setAttribute("value", aReminder.action);
    return listitem;
}

/**
 * Handler function to be called when a reminder is selected in the listbox.
 * Sets up remaining controls to show the selected alarm.
 */
function onReminderSelected() {
    let length = document.getElementById("reminder-length");
    let unit = document.getElementById("reminder-unit");
    let relation = document.getElementById("reminder-relation");
    let origin = document.getElementById("reminder-origin");
    let absDate = document.getElementById("reminder-absolute-date");
    let actionType = document.getElementById("reminder-actions-menulist");
    let relationType = document.getElementById("reminder-relation-radiogroup");

    let listbox = document.getElementById("reminder-listbox");
    let listitem = listbox.selectedItem;

    if (listitem) {
        let reminder = listitem.reminder;

        // Action
        actionType.value = reminder.action;

        // Absolute/relative things
        if (reminder.related == Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE) {
            relationType.value = "absolute";

            // Date
            absDate.value = (reminder.alarmDate || getDefaultStartDate()).jsDate;
        } else {
            relationType.value =  "relative";

            // Unit and length
            let alarmlen = Math.abs(reminder.offset.inSeconds / 60);
            if (alarmlen % 1440 == 0) {
                unit.value = "days";
                length.value = alarmlen / 1440;
            } else if (alarmlen % 60 == 0) {
                unit.value = "hours";
                length.value = alarmlen / 60;
            } else {
                unit.value = "minutes";
                length.value = alarmlen;
            }

            // Relation
            if (reminder.offset.isNegative) {
                relation.value =  "before";
            } else {
                relation.value = "after";
            }

            // Origin
            if (reminder.related == Components.interfaces.calIAlarm.ALARM_RELATED_START) {
                origin.value = "START";
            } else if (reminder.related == Components.interfaces.calIAlarm.ALARM_RELATED_END) {
                origin.value = "END";
            }
        }
    } else {
        // no list item is selected, disable elements
        setupRadioEnabledState(true);
    }
}

/**
 * Handler function to be called when an aspect of the alarm has been changed
 * using the dialog controls.
 *
 * @param event         The DOM event caused by the change.
 */
function updateReminder(event) {
    if (event.explicitOriginalTarget.localName == "listitem" ||
        !document.commandDispatcher.focusedElement) {
        // Do not set things if the select came from selecting an alarm from the
        // list, or from setting when the dialog initially loaded.
        // XXX Quite fragile hack since radio/radiogroup doesn't have the
        // supressOnSelect stuff.
        return;
    }
    let listbox = document.getElementById("reminder-listbox");
    let relationItem = document.getElementById("reminder-relation-radiogroup").selectedItem;
    let listitem = listbox.selectedItem;
    if (!listitem || !relationItem) {
        return;
    }
    let reminder = listitem.reminder;
    let length = document.getElementById("reminder-length");
    let unit = document.getElementById("reminder-unit");
    let relation = document.getElementById("reminder-relation");
    let origin = document.getElementById("reminder-origin");
    let absDate = document.getElementById("reminder-absolute-date");
    let action = document.getElementById("reminder-actions-menulist").selectedItem.value;

    // Action
    reminder.action = action;

    let relationType;
    if (relationItem.value == "relative") {
        if (origin.value == "START") {
            reminder.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
        } else if (origin.value == "END") {
            reminder.related = Components.interfaces.calIAlarm.ALARM_RELATED_END;
        }

        // Set up offset, taking units and before/after into account
        let offset = cal.createDuration();
        offset[unit.value] = length.value;
        offset.normalize();
        offset.isNegative = (relation.value == "before");
        reminder.offset = offset;
    } else if (relationItem.value == "absolute") {
        reminder.related = Components.interfaces.calIAlarm.ALARM_RELATED_ABSOLUTE;

        if (absDate.value) {
            reminder.alarmDate = jsDateToDateTime(absDate.value,
                                                  window.arguments[0].timezone);
        } else {
            reminder.alarmDate = null;
        }
    }

    setupListItem(listitem, reminder, window.arguments[0].item);
}

/**
 * Gets the locale stringname that is dependant on the item type. This function
 * appends the item type, i.e |aPrefix + "Event"|.
 *
 * @param aPrefix       The prefix to prepend to the item type
 * @return              The full string name.
 */
function getItemBundleStringName(aPrefix) {
    if (isEvent(window.arguments[0].item)) {
        return aPrefix + "Event";
    } else {
        return aPrefix + "Task";
    }
}

/**
 * Handler function to be called when the "new" button is pressed, to create a
 * new reminder item.
 */
function onNewReminder() {
    let itemType = (isEvent(window.arguments[0].item) ? "event" : "todo");
    let listbox = document.getElementById("reminder-listbox");

    let reminder = cal.createAlarm();
    let alarmlen = getPrefSafe("calendar.alarms." + itemType + "alarmlen", 15);

    // Default is a relative DISPLAY alarm, |alarmlen| minutes before the event.
    // If DISPLAY is not supported by the provider, then pick the provider's
    // first alarm type.
    let offset = cal.createDuration();
    offset.minutes = alarmlen;
    offset.normalize();
    offset.isNegative = true;
    reminder.related = reminder.ALARM_RELATED_START;
    reminder.offset = offset;
    if ("DISPLAY" in allowedActionsMap) {
        reminder.action = "DISPLAY";
    } else {
        let calendar = window.arguments[0].calendar
        let actions = calendar.getProperty("capabilities.alarms.actionValues") || [];
        reminder.action = actions[0];
    }

    // Set up the listbox
    let listitem = setupListItem(null, reminder, window.arguments[0].item);
    listbox.appendChild(listitem);
    listbox.selectItem(listitem);

    // Since we've added an item, its safe to always enable the button
    enableElement("reminder-remove-button");

    // Set up the enabled state and max reminders
    setupRadioEnabledState();
    setupMaxReminders();
}

/**
 * Handler function to be called when the "remove" button is pressed to remove
 * the selected reminder item and advance the selection.
 */
function onRemoveReminder() {
    let listbox = document.getElementById("reminder-listbox");
    let listitem = listbox.selectedItem;
    let newSelection = (listitem ? listitem.nextSibling ||
                                   listitem.previousSibling : null);

    listbox.clearSelection();
    listbox.removeChild(listitem);
    listbox.selectItem(newSelection);

    setElementValue("reminder-remove-button",
                    listbox.childNodes.length < 1 && "true",
                    "disabled");
    setupMaxReminders();
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    let listbox = document.getElementById("reminder-listbox");
    let reminders = [ node.reminder 
                      for each (node in Array.slice(listbox.childNodes)) ];
    if (window.arguments[0].onOk) {
        window.arguments[0].onOk(reminders);
    }

    return true;
}

/**
 * Handler function to be called when the cancel button is pressed.
 */
function onCancel() {
    if (window.arguments[0].onCancel) {
        window.arguments[0].onCancel();
    }
}
