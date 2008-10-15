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

/**
 * This function takes the recurrence info passed as argument and creates a
 * literal string representing the repeat pattern in natural language.
 */
function recurrenceRule2String(recurrenceInfo, startDate, endDate, allDay) {

    // Retrieve a valid recurrence rule from the currently
    // set recurrence info. Bail out if there's more
    // than a single rule or something other than a rule.
    recurrenceInfo = recurrenceInfo.clone();
    var rrules = splitRecurrenceRules(recurrenceInfo);
    if (rrules[0].length == 1) {
        var rule = rrules[0][0];
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
                var dow = day_of_week(day);
                return (Math.abs(day) - dow) / 8 * (day < 0 ? -1 : 1);
            }

            var ruleString = "???";
            if (rule.type == 'DAILY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    var days = rule.getComponent("BYDAY", {});
                    var weekdays = [2, 3, 4, 5, 6];
                    if (weekdays.length == days.length) {
                        for (var i = 0; i < weekdays.length; i++) {
                            if (weekdays[i] != days[i]) {
                                break;
                            }
                        }
                        if (i == weekdays.length) {
                            ruleString = calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsRuleDaily4");
                        }
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsRuleDaily1");
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsRuleDaily2");
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleDaily3",
                          [ rule.interval ]);
                    }
                }
            } else if (rule.type == 'WEEKLY') {
                // weekly recurrence, currently we
                // support a single 'BYDAY'-rule only.
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    // create a string like 'Monday, Tuesday and
                    // Wednesday'
                    var days = rule.getComponent("BYDAY", {});
                    var weekdays = "";
                    for (var i = 0; i < days.length; i++) {
                        weekdays += calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsDay" + days[i]);
                        if (days.length > 1 && i == (days.length - 2)) {
                            weekdays += ' ' + calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsAnd") + ' ';
                        } else if (i < days.length - 1) {
                            weekdays += ', ';
                        }
                    }

                    // now decorate this with 'every other week, etc'.
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleWeekly1", [ weekdays ]);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleWeekly2", [ weekdays ]);
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleWeekly3",
                          [ rule.interval, weekdays ]);
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsRuleWeekly4");
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsRuleWeekly5");
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleWeekly6",
                          [ rule.interval ]);
                    }
                }
            } else if (rule.type == 'MONTHLY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    var component = rule.getComponent("BYDAY", {});
                    var byday = component[0];
                    var ordinal_string =
                        calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsOrdinal" + day_position(byday));
                    var day_string =
                        calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsDay" + day_of_week(byday));

                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly1",
                          [ ordinal_string, day_string ]);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly2",
                          [ ordinal_string, day_string ]);
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly3",
                          [ ordinal_string, day_string, rule.interval ]);
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    var component = rule.getComponent("BYMONTHDAY", {});

                    var day_string = "";
                    for (var i = 0; i < component.length; i++) {
                        // TODO: we also need to handle BYMONTHDAY rules with
                        // negative array elements, but we're currently in string
                        // freeze for 0.7 so I can't add the necessary bits and
                        // pieces.
                        if (component[i] < 0) {
                            return null;
                        }
                        day_string += component[i];
                        if (component.length > 1 &&
                            i == (component.length - 2)) {
                            day_string += ' ' +calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsAnd") + ' ';
                        } else if (i < component.length-1) {
                            day_string += ', ';
                        }
                    }

                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly4",
                          [ day_string ]);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly5",
                          [ day_string ]);
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly6",
                          [ day_string, rule.interval ]);
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly4",
                          [ startDate.day ]);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly5",
                          [ startDate.day ]);
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleMonthly6",
                          [ startDate.day, rule.interval ]);
                    }
                }
            } else if (rule.type == 'YEARLY') {
                if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                    checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    bymonth = rule.getComponent("BYMONTH", {});
                    bymonthday = rule.getComponent("BYMONTHDAY", {});

                    if (bymonth.length == 1 && bymonthday.length == 1) {
                        var month_string =
                            calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsMonth" + bymonth[0]);

                        if (rule.interval == 1) {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly1",
                              [ month_string, bymonthday[0] ]);
                        } else if (rule.interval == 2) {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly2",
                              [ month_string, bymonthday[0] ]);
                        } else {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly3",
                              [ month_string,
                                bymonthday[0],
                                rule.interval ]);
                        }
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                           checkRecurrenceRule(rule, ['BYDAY'])) {
                    bymonth = rule.getComponent("BYMONTH", {});
                    byday = rule.getComponent("BYDAY", {});

                    if (bymonth.length == 1 && byday.length == 1) {
                        var month_string =
                            calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsMonth" + bymonth[0]);
                        var ordinal_string =
                            calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsOrdinal" +
                                    day_position(byday[0]));
                        var day_string =
                            calGetString(
                                "calendar-event-dialog",
                                "repeatDetailsDay" + day_of_week(byday[0]));

                        if (rule.interval == 1) {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly4",
                              [ ordinal_string, day_string, month_string ]);
                        } else if (rule.interval == 2) {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly5",
                              [ ordinal_string, day_string, month_string ]);
                        } else {
                            ruleString = calGetString(
                              "calendar-event-dialog",
                              "repeatDetailsRuleYearly6",
                              [ ordinal_string,
                                day_string,
                                month_string,
                                rule.interval ]);
                        }
                    }
                } else {
                    var month_string =
                        calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsMonth" + (startDate.month+1));
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleYearly1",
                          [ month_string, startDate.day ]);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleYearly2",
                          [ month_string, startDate.day ]);
                    } else {
                        ruleString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsRuleYearly3",
                          [ month_string,
                            startDate.day,
                            rule.interval ]);
                    }
                }
            }

            var kDefaultTimezone = calendarDefaultTimezone();

            var dateFormatter =
                Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                .getService(Components.interfaces.calIDateTimeFormatter);

            var detailsString;
            if (!endDate || allDay) {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        detailsString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsCountAllDay",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              rule.count ]);
                    } else {
                        var untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsUntilAllDay",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              dateFormatter.formatDateShort(untilDate) ]);
                    }
                  } else {
                      detailsString = calGetString(
                          "calendar-event-dialog",
                          "repeatDetailsInfiniteAllDay",
                          [ ruleString,
                            dateFormatter.formatDateShort(startDate) ]);
                  }
              } else {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        detailsString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsCount",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              rule.count,
                              dateFormatter.formatTime(startDate),
                              dateFormatter.formatTime(endDate) ]);
                    } else {
                        var untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = calGetString(
                            "calendar-event-dialog",
                            "repeatDetailsUntil",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              dateFormatter.formatDateShort(untilDate),
                              dateFormatter.formatTime(startDate),
                              dateFormatter.formatTime(endDate) ]);
                    }
                } else {
                    detailsString = calGetString(
                        "calendar-event-dialog",
                        "repeatDetailsInfinite",
                        [ ruleString,
                          dateFormatter.formatDateShort(startDate),
                          dateFormatter.formatTime(startDate),
                          dateFormatter.formatTime(endDate) ]);
                }
            }
            return detailsString;
        }
    }
    return null;
}

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

function checkRecurrenceRule(aRule, aArray) {
    for each (var comp in aArray) {
        var ruleComp = aRule.getComponent(comp, {});
        if (ruleComp && ruleComp.length > 0) {
            return true;
        }
    }
    return false;
}

function dispose() {
    var args = window.arguments[0];
    if (args.job && args.job.dispose) {
        args.job.dispose();
    }
}

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

function loadReminder(item) {
    // select 'no reminder' by default
    var reminderPopup = document.getElementById("item-alarm");
    reminderPopup.selectedIndex = 0;
    gLastAlarmSelection = 0;
    if (!item.alarmOffset) {
        return;
    }

    // try to match the reminder setting with the available popup items
    var origin = "1";
    if (item.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_END) {
        origin = "-1";
    }
    var duration = item.alarmOffset.clone();
    var relation = "END";
    if (duration.isNegative) {
        duration.isNegative = false;
        duration.normalize();
        relation = "START";
    }
    var matchingItem = null;
    var menuItems = reminderPopup.getElementsByTagName("menuitem");
    var numItems = menuItems.length;
    for (var i=0; i<numItems; i++) {
        var menuitem = menuItems[i];
        if (menuitem.hasAttribute("length")) {
            if (menuitem.getAttribute("origin") == origin &&
                menuitem.getAttribute("relation") == relation) {
                var unit = menuitem.getAttribute("unit");
                var length = menuitem.getAttribute("length");
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
        if (item.alarmRelated == Components.interfaces.calIItemBase.ALARM_RELATED_START) {
            reminder.origin = "1";
        } else {
            reminder.origin = "-1";
        }
        var offset = item.alarmOffset.clone();
        var relation = "END";
        if (offset.isNegative) {
            offset.isNegative = false;
            offset.normalize();
            relation = "START";
        }
        reminder.relation = relation;
        if (offset.minutes) {
            var minutes = offset.minutes +
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

function saveReminder(item) {
    var reminderPopup = document.getElementById("item-alarm");
    if (reminderPopup.value == 'none') {
        item.alarmOffset = null;
        item.alarmLastAck = null;
        item.alarmRelated = null;
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
        item.alarmOffset = duration;

        if (Number(reminder.origin) >= 0) {
            item.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_START;
        } else {
            item.alarmRelated = Components.interfaces.calIItemBase.ALARM_RELATED_END;
        }
    }
}

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
