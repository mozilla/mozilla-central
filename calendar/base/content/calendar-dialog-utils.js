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
 *   Michael Buettner <michael.buettner@sun.com>
 *   Stefan Sitter <ssitter@gmail.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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

Components.utils.import("resource://gre/modules/PluralForm.jsm");

/**
 * This function takes the recurrence info passed as argument and creates a
 * literal string representing the repeat pattern in natural language.
 *
 * @param recurrenceInfo    An item's recurrence info to parse.
 * @param startDate         The start date to base rules on.
 * @param endDate           The end date to base rules on.
 * @param allDay            If true, the pattern should assume an allday item.
 * @return                  A human readable string describing the recurrence.
 */
function recurrenceRule2String(recurrenceInfo, startDate, endDate, allDay) {
    function getRString(name, args) calGetString("calendar-event-dialog", name, args);
    function getDString(name, args) calGetString("dateFormat", name, args);

    // Retrieve a valid recurrence rule from the currently
    // set recurrence info. Bail out if there's more
    // than a single rule or something other than a rule.
    recurrenceInfo = recurrenceInfo.clone();
    let rrules = splitRecurrenceRules(recurrenceInfo);
    if (rrules[0].length == 1) {
        let rule = rrules[0][0];
        // currently we don't allow for any BYxxx-rules.
        if (calInstanceOf(rule, Components.interfaces.calIRecurrenceRule) &&
            !checkRecurrenceRule(rule, ['BYSECOND',
                                        'BYMINUTE',
                                        //'BYDAY',
                                        'BYHOUR',
                                        //'BYMONTHDAY',
                                        'BYYEARDAY',
                                        'BYWEEKNO',
                                        //'BYMONTH',
                                        'BYSETPOS'])) {
            function day_of_week(day) {
                return Math.abs(day) % 8;
            }
            function day_position(day) {
                let dow = day_of_week(day);
                return (Math.abs(day) - dow) / 8 * (day < 0 ? -1 : 1);
            }

            let ruleString;
            if (rule.type == 'DAILY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    let days = rule.getComponent("BYDAY", {});
                    let weekdays = [2, 3, 4, 5, 6];
                    if (weekdays.length == days.length) {
                        let i;
                        for (i = 0; i < weekdays.length; i++) {
                            if (weekdays[i] != days[i]) {
                                break;
                            }
                        }
                        if (i == weekdays.length) {
                            ruleString = getRString("repeatDetailsRuleDaily4");
                        }
                    } else {
                        return getRString("ruleTooComplex");
                    }
                } else {
                    let dailyString = getRString("dailyEveryNth");
                    ruleString = PluralForm.get(rule.interval, dailyString)
                                           .replace("#1", rule.interval);
                }
            } else if (rule.type == 'WEEKLY') {
                // weekly recurrence, currently we
                // support a single 'BYDAY'-rule only.
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    // create a string like 'Monday, Tuesday and
                    // Wednesday'
                    let days = rule.getComponent("BYDAY", {});
                    var weekdays = "";
                    for (let i = 0; i < days.length; i++) {
                        weekdays += getDString("day." + days[i] + ".name")
                        if (days.length > 1 && i == (days.length - 2)) {
                            weekdays += ' ' + getRString("repeatDetailsAnd") + ' ';
                        } else if (i < days.length - 1) {
                            weekdays += ', ';
                        }
                    }

                    let weeklyString = getRString("weeklyNthOn", [weekdays]);
                    ruleString= PluralForm.get(rule.interval, weeklyString)
                                          .replace("#2", rule.interval);

                } else {
                    let weeklyString = getRString("weeklyEveryNth");
                    ruleString = PluralForm.get(rule.interval, weeklyString)
                                           .replace("#1", rule.interval);
                }
            } else if (rule.type == 'MONTHLY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    let byday = rule.getComponent("BYDAY", {});
                    if (day_position(byday[0]) == 0) {
                        // i.e every MONDAY of every N months
                        let day = getDString("day." + day_of_week(byday[0]) + ".name");
                        ruleString = getRString("monthlyEveryOfEvery", [day]);
                        ruleString = PluralForm.get(rule.interval, ruleString)
                                               .replace("#2", rule.interval);
                    } else {
                        // i.e the FIRST MONDAY of every N months
                        let ordinal = getRString("repeatDetailsOrdinal" + day_position(byday[0]));
                        let day = getDString("day." + day_of_week(byday[0]) + ".name");
                        ruleString = getRString("monthlyNthOfEvery", [ordinal, day]);
                        ruleString = PluralForm.get(rule.interval, ruleString)
                                               .replace("#3", rule.interval);
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    let component = rule.getComponent("BYMONTHDAY", {});

                    // First, find out if the 'BYMONTHDAY' component contains
                    // any elements with a negative value. If so we currently
                    // don't support anything but the 'last day of the month' rule.
                    if (component.some(function(element, index, array) {
                                           return element < 0;
                                       })) {
                        if (component.length == 1 && component[0] == -1) {
                            let monthlyString = getRString("monthlyLastDayOfNth");
                            ruleString = PluralForm.get(rule.interval, monthlyString)
                                                   .replace("#1", rule.interval);
                        } else {
                            // we don't support any other combination for now...
                            return getRString("ruleTooComplex");
                        }
                    } else {
                        let day_string = "";
                        for (let i = 0; i < component.length; i++) {
                            day_string += component[i];
                            if (component.length > 1 &&
                                i == (component.length - 2)) {
                                day_string += ' ' + getRString("repeatDetailsAnd") + ' ';
                            } else if (i < component.length-1) {
                                day_string += ', ';
                            }
                        }
                        let monthlyString = getRString("monthlyDayOfNth", [day_string]);
                        ruleString = PluralForm.get(rule.interval, monthlyString)
                                               .replace("#2", rule.interval);

                    }
                } else {
                    let monthlyString = getRString("monthlyDayOfNth", [startDate.day]);
                    ruleString = PluralForm.get(rule.interval, monthlyString)
                                           .replace("#1", rule.interval);
                }
            } else if (rule.type == 'YEARLY') {
                if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                    checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    bymonth = rule.getComponent("BYMONTH", {});
                    bymonthday = rule.getComponent("BYMONTHDAY", {});

                    if (bymonth.length == 1 && bymonthday.length == 1) {
                        let monthNameString = getDString("month." + bymonth[0] + ".name");

                        let yearlyString = getRString("yearlyNthOn",
                                                      [monthNameString, bymonthday[0]]);
                        ruleString = PluralForm.get(rule.interval, yearlyString)
                                               .replace("#3", rule.interval);
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                           checkRecurrenceRule(rule, ['BYDAY'])) {
                    bymonth = rule.getComponent("BYMONTH", {});
                    byday = rule.getComponent("BYDAY", {});

                    if (bymonth.length == 1 && byday.length == 1) {
                        let dayString = getDString("day." + day_of_week(byday[0]) + ".name");
                        let monthString = getDString("month." + bymonth[0] + ".name");
                        if (day_position(byday[0]) == 0) {
                            let yearlyString = getRString("yearlyEveryNthOfNth",
                                                          [dayString, monthString]);
                            ruleString = PluralForm.get(rule.interval, yearlyString)
                                                   .replace("#3", rule.interval);
                        } else {
                            let ordinalString = getRString("repeatDetailsOrdinal" +
                                                           day_position(byday[0]));

                            let yearlyString = getRString("yearlyNthOnNthOf",
                                                          [ordinalString,
                                                           dayString,
                                                           monthString]);
                            ruleString = PluralForm.get(rule.interval, yearlyString)
                                                   .replace("#4", rule.interval);
                        }
                    } else {
                        return getRString("ruleTooComplex");
                    }
                } else {
                    let monthNameString = getDString("month." + (startDate.month + 1) + ".name");

                    let yearlyString = getRString("yearlyNthOn",
                                                  [monthNameString, startDate.day]);
                    ruleString = PluralForm.get(rule.interval, yearlyString)
                                           .replace("#3", rule.interval);
                }
            }

            let kDefaultTimezone = cal.calendarDefaultTimezone();
            let dateFormatter = cal.getDateFormatter();

            let detailsString;
            if (!endDate || allDay) {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        let countString = getRString("repeatCountAllDay",
                            [ruleString,
                             dateFormatter.formatDateShort(startDate)]);
                        detailsString = PluralForm.get(rule.count, countString)
                                                  .replace("#3", rule.count);
                    } else {
                        let untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = getRString("repeatDetailsUntilAllDay",
                            [ruleString,
                             dateFormatter.formatDateShort(startDate),
                             dateFormatter.formatDateShort(untilDate)]);
                    }
                } else {
                    detailsString = getRString("repeatDetailsInfiniteAllDay",
                                               [ruleString,
                                                dateFormatter.formatDateShort(startDate)]);
                }
            } else {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        let countString = getRString("repeatCount",
                            [ruleString,
                             dateFormatter.formatDateShort(startDate),
                             dateFormatter.formatTime(startDate),
                             dateFormatter.formatTime(endDate) ]);
                        detailsString = PluralForm.get(rule.count, countString)
                                                  .replace("#5", rule.count);
                    } else {
                        let untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = getRString("repeatDetailsUntil",
                            [ruleString,
                             dateFormatter.formatDateShort(startDate),
                             dateFormatter.formatDateShort(untilDate),
                             dateFormatter.formatTime(startDate),
                             dateFormatter.formatTime(endDate)]);
                    }
                } else {
                    detailsString = getRString("repeatDetailsInfinite",
                        [ruleString,
                         dateFormatter.formatDateShort(startDate),
                         dateFormatter.formatTime(startDate),
                         dateFormatter.formatTime(endDate) ]);
                }
            }
            return detailsString;
        }
    }
    return getRString("ruleTooComplex");
}

/**
 * Split rules into negative and positive rules.
 *
 * @param recurrenceInfo    An item's recurrence info to parse.
 * @return                  An array with two elements: an array of positive
 *                            rules and an array of negative rules.
 */
function splitRecurrenceRules(recurrenceInfo) {
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
    return [rules, exceptions];
}

/**
 * Check if a recurrence rule's component is valid.
 *
 * @see                     calIRecurrenceRule
 * @param aRule             The recurrence rule to check.
 * @param aArray            An array of component names to check.
 * @return                  Returns true if the rule is valid.
 */
function checkRecurrenceRule(aRule, aArray) {
    for each (var comp in aArray) {
        var ruleComp = aRule.getComponent(comp, {});
        if (ruleComp && ruleComp.length > 0) {
            return true;
        }
    }
    return false;
}

/**
 * Dispose of controlling operations of this event dialog. Uses
 * window.arguments[0].job.dispose()
 */
function dispose() {
    var args = window.arguments[0];
    if (args.job && args.job.dispose) {
        args.job.dispose();
    }
}

/**
 * Opens the edit reminder dialog modally, setting the custom menuitem's
 * 'reminder' property when done.
 */
function editReminder() {
    var customReminder =
        document.getElementById("reminder-custom-menuitem");
    var args = new Object();
    args.reminder = customReminder.reminder;
    var savedWindow = window;
    args.onOk = function(reminder) {
        customReminder.reminder = reminder;
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
    var reminderPopup = document.getElementById("item-alarm");
    var reminderDetails = document.getElementById("reminder-details");
    var reminder = document.getElementById("reminder-custom-menuitem").reminder;

    // first of all collapse the details text. if we fail to
    // create a details string, we simply don't show anything.
    reminderDetails.setAttribute("collapsed", "true");

    // don't try to show the details text
    // for anything but a custom recurrence rule.
    if (reminderPopup.value == "custom" && reminder) {
        var unitString;
        switch (reminder.unit) {
            case 'minutes':
                unitString = Number(reminder.length) <= 1 ?
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitMinute") :
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitMinutes");
                break;
            case 'hours':
                unitString = Number(reminder.length) <= 1 ?
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitHour") :
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitHours");
                break;
            case 'days':
                unitString = Number(reminder.length) <= 1 ?
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitDay") :
                    calGetString(
                        "calendar-event-dialog",
                        "reminderCustomUnitDays");
                break;
        }

        var relationString;
        switch (reminder.relation) {
            case 'START':
                relationString = calGetString(
                    "calendar-event-dialog",
                    "reminderCustomRelationBefore");
                break;
            case 'END':
                relationString = calGetString(
                    "calendar-event-dialog",
                    "reminderCustomRelationAfter");
                break;
        }

        var originString;
        if (reminder.origin && reminder.origin < 0) {
            originString = calGetString(
                "calendar-event-dialog",
                "reminderCustomOriginEndEvent");
        } else {
            originString = calGetString(
                "calendar-event-dialog",
                "reminderCustomOriginBeginEvent");
        }

        var detailsString = calGetString(
          "calendar-event-dialog",
          "reminderCustomTitle",
          [ reminder.length,
            unitString,
            relationString,
            originString]);

        var lines = detailsString.split("\n");
        reminderDetails.removeAttribute("collapsed");
        while (reminderDetails.childNodes.length > lines.length) {
            reminderDetails.removeChild(reminderDetails.lastChild);
        }
        var numChilds = reminderDetails.childNodes.length;
        for (var i = 0; i < lines.length; i++) {
            if (i >= numChilds) {
                var newNode = reminderDetails.childNodes[0].cloneNode(true);
                reminderDetails.appendChild(newNode);
            }
            var node = reminderDetails.childNodes[i];
            node.setAttribute('value', lines[i]);
        }
    }
}

var gLastAlarmSelection = 0;

/**
 * Load an item's reminders into the dialog
 *
 * @param item      The item to load.
 */
function loadReminder(item) {
    // select 'no reminder' by default
    let reminderPopup = document.getElementById("item-alarm");
    reminderPopup.selectedIndex = 0;
    gLastAlarmSelection = 0;

    // TODO ALARMSUPPORT right now, just consider the first relative alarm. This
    // should change as soon as the UI supports multiple alarms.
    let alarms = item.getAlarms({})
                     .filter(function(x) x.related != x.ALARM_RELATED_ABSOLUTE);
    let alarm = alarms[0];
    if (!alarm) {
        return;
    }
    // END TODO ALARMSUPPORT
        

    // try to match the reminder setting with the available popup items
    let origin = "1";
    if (alarm.related == Components.interfaces.calIAlarm.ALARM_RELATED_END) {
        origin = "-1";
    }
    let duration = alarm.offset.clone();
    let relation = "END";
    if (duration.isNegative) {
        duration.isNegative = false;
        duration.normalize();
        relation = "START";
    }
    let matchingItem = null;
    let menuItems = reminderPopup.getElementsByTagName("menuitem");
    let numItems = menuItems.length;
    for (let i = 0; i < numItems; i++) {
        let menuitem = menuItems[i];
        if (menuitem.hasAttribute("length")) {
            if (menuitem.getAttribute("origin") == origin &&
                menuitem.getAttribute("relation") == relation) {
                let unit = menuitem.getAttribute("unit");
                let length = menuitem.getAttribute("length");
                if (unit == "days") {
                    length = length * 60 * 60 * 24;
                } else if (unit == "hours") {
                    length = length * 60 * 60;
                } else if (unit == "minutes") {
                    length = length * 60;
                } else {
                    continue;
                }
                if (duration.inSeconds == length) {
                    matchingItem = menuitem;
                    break;
                }
            }
        }
    }

    if (matchingItem) {
        var numChilds = reminderPopup.childNodes[0].childNodes.length;
        for (var i = 0; i < numChilds; i++) {
            var node = reminderPopup.childNodes[0].childNodes[i];
            if (node == matchingItem) {
                reminderPopup.selectedIndex = i;
                break;
            }
        }
    } else {
        reminderPopup.value = 'custom';
        var customReminder =
            document.getElementById("reminder-custom-menuitem");
        var reminder = {};
        if (alarm.related == Components.interfaces.calIAlarm.ALARM_RELATED_START) {
            reminder.origin = "1";
        } else {
            reminder.origin = "-1";
        }
        let offset = alarm.offset.clone();
        relation = "END";
        if (offset.isNegative) {
            offset.isNegative = false;
            offset.normalize();
            relation = "START";
        }
        reminder.relation = relation;
        if (offset.minutes) {
            let minutes = offset.minutes +
                          offset.hours * 60 +
                          offset.days * 24 * 60 +
                          offset.weeks * 60 * 24 * 7;
            reminder.unit = 'minutes';
            reminder.length = minutes;
        } else if (offset.hours) {
            var hours = offset.hours + offset.days * 24 + offset.weeks * 24 * 7;
            reminder.unit = 'hours';
            reminder.length = hours;
        } else {
            var days = offset.days + offset.weeks * 7;
            reminder.unit = 'days';
            reminder.length = days;
        }
        customReminder.reminder = reminder;
    }

    // remember the selected index
    gLastAlarmSelection = reminderPopup.selectedIndex;
}

/**
 * Save the selected reminder into the passed item.
 *
 * @param item      The item save the reminder into.
 */
function saveReminder(item) {
    item.clearAlarms();
    var reminderPopup = document.getElementById("item-alarm");
    if (reminderPopup.value == 'none') {
        item.alarmLastAck = null;
    } else {
        var menuitem = reminderPopup.selectedItem;

        // custom reminder entries carry their own reminder object
        // with them, pre-defined entries specify the necessary information
        // as attributes attached to the menuitem elements.
        var reminder = menuitem.reminder;
        if (!reminder) {
            reminder = {};
            reminder.length = menuitem.getAttribute('length');
            reminder.unit = menuitem.getAttribute('unit');
            reminder.relation = menuitem.getAttribute('relation');
            reminder.origin = menuitem.getAttribute('origin');
        }

        var duration = Components.classes["@mozilla.org/calendar/duration;1"]
                       .createInstance(Components.interfaces.calIDuration);

        duration[reminder.unit] = Number(reminder.length);
        if (reminder.relation != "END") {
            duration.isNegative = true;
        }
        duration.normalize();
        let alarm = cal.createAlarm();

        if (Number(reminder.origin) >= 0) {
            alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_START;
        } else {
            alarm.related = Components.interfaces.calIAlarm.ALARM_RELATED_END;
        }

        alarm.offset = duration;
        item.addAlarm(alarm);
    }
}

/**
 * Common update functions for both event dialogs. Called when a reminder has
 * been selected from the menulist.
 */
function commonUpdateReminder() {
    // if a custom reminder has been selected, we show the appropriate
    // dialog in order to allow the user to specify the details.
    // the result will be placed in the 'reminder-custom-menuitem' tag.
    var reminderPopup = document.getElementById("item-alarm");
    if (reminderPopup.value == 'custom') {
        // show the dialog.
        // don't pop up the dialog if this happens during
        // initialization of the dialog.
        if (reminderPopup.hasAttribute("last-value")) {
            editReminder();
        }

        // Now check if the resulting custom reminder is valid.
        // possibly we receive an invalid reminder if the user cancels the
        // dialog. In that case we revert to the previous selection of the
        // reminder drop down.
        if (!document.getElementById("reminder-custom-menuitem").reminder) {
            reminderPopup.selectedIndex = gLastAlarmSelection;
        }
    }

    // remember the current reminder drop down selection index.
    gLastAlarmSelection = reminderPopup.selectedIndex;
    reminderPopup.setAttribute("last-value", reminderPopup.value);

    // possibly the selected reminder conflicts with the item.
    // for example an end-relation combined with a task without duedate
    // is an invalid state we need to take care of. we take the same
    // approach as with recurring tasks. in case the reminder is related
    // to the entry date we check the entry date automatically and disable
    // the checkbox. the same goes for end related reminder and the due date.
    if (isToDo(window.calendarItem)) {

        // custom reminder entries carry their own reminder object
        // with them, pre-defined entries specify the necessary information
        // as attributes attached to the menuitem elements.
        var menuitem = reminderPopup.selectedItem;
        if (menuitem.value == 'none') {
            enableElementWithLock("todo-has-entrydate", "reminder-lock");
            enableElementWithLock("todo-has-duedate", "reminder-lock");
        } else {
            var reminder = menuitem.reminder;
            if (!reminder) {
                reminder = {};
                reminder.length = menuitem.getAttribute('length');
                reminder.unit = menuitem.getAttribute('unit');
                reminder.relation = menuitem.getAttribute('relation');
                reminder.origin = menuitem.getAttribute('origin');
            }

            // if this reminder is related to the entry date...
            if (Number(reminder.origin) > 0) {

                // ...automatically check 'has entrydate'.
                if (!getElementValue("todo-has-entrydate", "checked")) {
                    setElementValue("todo-has-entrydate", "true", "checked");

                    // make sure gStartTime is properly initialized
                    updateEntryDate();
                }

                // disable the checkbox to indicate that we need
                // the entry-date. the 'disabled' state will be
                // revoked if the user turns off the repeat pattern.
                disableElementWithLock("todo-has-entrydate", "reminder-lock");
                enableElementWithLock("todo-has-duedate", "reminder-lock");
            }

            // if this reminder is related to the due date...
            if (Number(reminder.origin) < 0) {

                // ...automatically check 'has duedate'.
                if (!getElementValue("todo-has-duedate", "checked")) {
                    setElementValue("todo-has-duedate", "true", "checked");

                    // make sure gStartTime is properly initialized
                    updateDueDate();
                }

                // disable the checkbox to indicate that we need
                // the entry-date. the 'disabled' state will be
                // revoked if the user turns off the repeat pattern.
                disableElementWithLock("todo-has-duedate", "reminder-lock");
                enableElementWithLock("todo-has-entrydate", "reminder-lock");
            }
        }
    }

    updateReminderDetails();
}

/**
 * Updates the related link on the dialog
 */
function updateLink() {
    var itemUrlString = (window.calendarItem || window.item).getProperty("URL") || "";
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
            handler = getIOService().getProtocolHandler(uri.scheme);
        } catch (e) {
            // No protocol handler for the given protocol, or invalid uri
            hideOrShow(false);
            return;
        }

        // Only show if its either an internal protcol handler, or its external
        // and there is an external app for the scheme
        hideOrShow(!calInstanceOf(handler, Components.interfaces.nsIExternalProtocolHandler) ||
                   handler.externalAppExistsForScheme(uri.scheme));

        setTimeout(function() {
          // HACK the url-link doesn't crop when setting the value in onLoad
          setElementValue("url-link", itemUrlString);
          setElementValue("url-link", itemUrlString, "href");
        }, 0);
    }
}
