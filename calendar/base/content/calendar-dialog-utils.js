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
 *   Michael Buettner <michael.buettner@sun.com>
 *   Stefan Sitter <ssitter@gmail.com>
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

/* utility functions */

function setElementValue(elementName, value, name)
{
    var element = document.getElementById(elementName);
    if (!element) {
        dump("unable to find " + elementName + "\n");
        return;
    }

    if (value === false) {
        element.removeAttribute(name ? name : "value");
    } else if (name) {
        //dump("element.setAttribute(" + name + ", " + value + ")\n");
        element.setAttribute(name, value);
    } else {
        //dump("element.value = " + value + "\n");
        element.value = value;
    }
}

function getElementValue(elementName, name)
{
    var element = document.getElementById(elementName);
    if (!element) {
        dump("unable to find " + elementName + "\n");
        return null;
    }

    if (name)
        return element[name];

    return element.value;
}

function enableElement(elementId)
{
    setElementValue(elementId, false, "disabled");
}

function disableElement(elementId)
{
    setElementValue(elementId, "true", "disabled");
}

/**
 * This function unconditionally disables the element for
 * which the id has been passed as argument. Furthermore, it
 * remembers who was responsible for this action by using
 * the given key (lockId). In case the control should be
 * enabled again the lock gets removed, but the control only
 * gets enabled if *all* possibly held locks have been removed.
 */
function disableElementWithLock(elementId,lockId) {

    // unconditionally disable the element.
    disableElement(elementId);

    // remember that this element has been locked with
    // the key passed as argument. we keep a primitive
    // form of ref-count in the attribute 'lock'.
    var element = document.getElementById(elementId);
    if (element) {
        if (!element.hasAttribute(lockId)) {
            element.setAttribute(lockId, "true");
            var n = parseInt(element.getAttribute("lock") || 0);
            element.setAttribute("lock", n + 1);
        }
    }
}

/**
 * This function is intended to be used in tandem with the
 * above defined function 'disableElementWithLock()'.
 * See the respective comment for further details.
 */
function enableElementWithLock(elementId, lockId) {

    var element = document.getElementById(elementId);
    if (!element) {
        dump("unable to find " + elementId + "\n");
        return;
    }

    if (element.hasAttribute(lockId)) {
        element.removeAttribute(lockId);
        var n = parseInt(element.getAttribute("lock") || 0) - 1;
        if (n > 0) {
            element.setAttribute("lock", n);
        } else {
            element.removeAttribute("lock");
        }
        if (n <= 0) {
            enableElement(elementId);
        }
    }
}

/* use with textfields oninput to only allow integers */
function validateIntegerRange(event, lowerBound, upperBound) {
    validateIntegers(event);

    var num = Number(event.target.value);

    // Only modify the number if a value is entered, otherwise deleting the
    // value (to maybe enter a new number) will cause the field to be set to the
    // lower bound.
    if (event.target.value != "" && (num < lowerBound || num > upperBound)) {
        event.target.value = Math.min(Math.max(num, lowerBound), upperBound);
        event.preventDefault();
    }
}

function validateIntegers(event) {
    if (isNaN(Number(event.target.value))) {
        var newValue = parseInt(event.target.value);
        event.target.value = isNaN(newValue) ? "" : newValue;
        event.preventDefault();
    }
}

function validateNaturalNums(event) {
    validateIntegers(event);
    var num = event.target.value;
    if (num < 0) {
        event.target.value = -1 * num;
        event.preventDefault();
    }
}

/**
 * This function takes the recurrence info passed as argument and creates a
 * literal string representing the repeat pattern in natural language.
 * It expects a xul <box> with the id 'repeat-details' which should hold
 * at least a single <label> element. The structure should look similar to
 * this example:
 *                     <vbox id="repeat-details">
 *                       <label/>
 *                     </vbox>
 */
function commonUpdateRepeatDetails(recurrenceInfo, startDate, endDate, allDay) {
    // First of all collapse the details text. If we fail to
    // create a details string, we simply don't show anything.
    // this could happen if the repeat rule is something exotic
    // we don't have any strings prepared for.
    var repeatDetails = document.getElementById("repeat-details");
    repeatDetails.setAttribute("collapsed", "true");

    // Retrieve a valid recurrence rule from the currently
    // set recurrence info. Bail out if there's more
    // than a single rule or something other than a rule.
    recurrenceInfo = recurrenceInfo.clone();
    var rrules = splitRecurrenceRules(recurrenceInfo);
    if (rrules[0].length == 1) {
        var rule = rrules[0][0];
        // currently we don't allow for any BYxxx-rules.
        if (rule instanceof Components.interfaces.calIRecurrenceRule &&
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
                                "sun-calendar-event-dialog",
                                "repeatDetailsRuleDaily4");
                        }
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsRuleDaily1");
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsRuleDaily2");
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleDaily3",
                          [ rule.interval ], 1);
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
                            "sun-calendar-event-dialog",
                            "repeatDetailsDay" + days[i]);
                        if (days.length > 1 && i == (days.length - 2)) {
                            weekdays += ' ' + calGetString(
                                "sun-calendar-event-dialog",
                                "repeatDetailsAnd") + ' ';
                        } else if (i < days.length - 1) {
                            weekdays += ', ';
                        }
                    }

                    // now decorate this with 'every other week, etc'.
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleWeekly1", [ weekdays ], 1);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleWeekly2", [ weekdays ], 1);
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleWeekly3",
                          [ rule.interval, weekdays ],
                          2);
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsRuleWeekly4");
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsRuleWeekly5");
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleWeekly6",
                          [ rule.interval ], 1);
                    }
                }
            } else if (rule.type == 'MONTHLY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    var component = rule.getComponent("BYDAY", {});
                    var byday = component[0];
                    var ordinal_string =
                        calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsOrdinal" + day_position(byday));
                    var day_string =
                        calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsDay" + day_of_week(byday));

                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly1",
                          [ ordinal_string, day_string ],
                          2);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly2",
                          [ ordinal_string, day_string ],
                          2);
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly3",
                          [ ordinal_string, day_string, rule.interval ],
                          3);
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
                            return;
                        }
                        day_string += component[i];
                        if (component.length > 1 &&
                            i == (component.length - 2)) {
                            day_string += ' ' +calGetString(
                                "sun-calendar-event-dialog",
                                "repeatDetailsAnd") + ' ';
                        } else if (i < component.length-1) {
                            day_string += ', ';
                        }
                    }

                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly4",
                          [ day_string ], 1);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly5",
                          [ day_string ], 1);
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly6",
                          [ day_string, rule.interval ],
                          2);
                    }
                } else {
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly4",
                          [ startDate.day ], 1);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly5",
                          [ startDate.day ], 1);
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleMonthly6",
                          [ startDate.day, rule.interval ],
                          2);
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
                                "sun-calendar-event-dialog",
                                "repeatDetailsMonth" + bymonth[0]);

                        if (rule.interval == 1) {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly1",
                              [ month_string, bymonthday[0] ],
                              2);
                        } else if (rule.interval == 2) {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly2",
                              [ month_string, bymonthday[0] ],
                              2);
                        } else {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly3",
                              [ month_string,
                                bymonthday[0],
                                rule.interval ],
                              3);
                        }
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                           checkRecurrenceRule(rule, ['BYDAY'])) {
                    bymonth = rule.getComponent("BYMONTH", {});
                    byday = rule.getComponent("BYDAY", {});

                    if (bymonth.length == 1 && byday.length == 1) {
                        var month_string =
                            calGetString(
                                "sun-calendar-event-dialog",
                                "repeatDetailsMonth" + bymonth[0]);
                        var ordinal_string =
                            calGetString(
                                "sun-calendar-event-dialog",
                                "repeatDetailsOrdinal" +
                                    day_position(byday[0]));
                        var day_string =
                            calGetString(
                                "sun-calendar-event-dialog",
                                "repeatDetailsDay" + day_of_week(byday[0]));

                        if (rule.interval == 1) {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly4",
                              [ ordinal_string, day_string, month_string ],
                              3);
                        } else if (rule.interval == 2) {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly5",
                              [ ordinal_string, day_string, month_string ],
                              3);
                        } else {
                            ruleString = calGetString(
                              "sun-calendar-event-dialog",
                              "repeatDetailsRuleYearly6",
                              [ ordinal_string,
                                day_string,
                                month_string,
                                rule.interval ],
                              4);
                        }
                    }
                } else {
                    var month_string =
                        calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsMonth" + (startDate.month+1));
                    if (rule.interval == 1) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleYearly1",
                          [ month_string, startDate.day ],
                          2);
                    } else if (rule.interval == 2) {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleYearly2",
                          [ month_string, startDate.day ],
                          2);
                    } else {
                        ruleString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsRuleYearly3",
                          [ month_string,
                            startDate.day,
                            rule.interval ],
                          3);
                    }
                }
            }

            var kDefaultTimezone = calendarDefaultTimezone();

            var dateFormatter =
                Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
                .getService(Components.interfaces.calIDateTimeFormatter);

            var detailsString;
            if (allDay) {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        detailsString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsCountAllDay",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              rule.count ], 3);
                    } else {
                        var untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsUntilAllDay",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              dateFormatter.formatDateShort(untilDate) ],
                            3);
                    }
                  } else {
                      detailsString = calGetString(
                          "sun-calendar-event-dialog",
                          "repeatDetailsInfiniteAllDay",
                          [ ruleString,
                            dateFormatter.formatDateShort(startDate) ], 2);
                  }
              } else {
                if (rule.isFinite) {
                    if (rule.isByCount) {
                        detailsString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsCount",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              rule.count,
                              dateFormatter.formatTime(startDate),
                              dateFormatter.formatTime(endDate) ], 5);
                    } else {
                        var untilDate = rule.endDate.getInTimezone(kDefaultTimezone);
                        detailsString = calGetString(
                            "sun-calendar-event-dialog",
                            "repeatDetailsUntil",
                            [ ruleString,
                              dateFormatter.formatDateShort(startDate),
                              dateFormatter.formatDateShort(untilDate),
                              dateFormatter.formatTime(startDate),
                              dateFormatter.formatTime(endDate) ], 5);
                    }
                } else {
                    detailsString = calGetString(
                        "sun-calendar-event-dialog",
                        "repeatDetailsInfinite",
                        [ ruleString,
                          dateFormatter.formatDateShort(startDate),
                          dateFormatter.formatTime(startDate),
                          dateFormatter.formatTime(endDate) ], 4);
                }
            }

            if (detailsString) {
                var lines = detailsString.split("\n");
                repeatDetails.removeAttribute("collapsed");
                while (repeatDetails.childNodes.length > lines.length) {
                    repeatDetails.removeChild(repeatDetails.lastChild);
                }
                var numChilds = repeatDetails.childNodes.length;
                for (var i = 0; i < lines.length; i++) {
                    if (i >= numChilds) {
                        var newNode = repeatDetails.childNodes[0]
                                                   .cloneNode(true);
                        repeatDetails.appendChild(newNode);
                    }
                    repeatDetails.childNodes[i].value = lines[i];
                }
            }
        }
    }
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
        "chrome://calendar/content/sun-calendar-event-dialog-reminder.xul",
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
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitMinute") :
                    calGetString(
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitMinutes");
                break;
            case 'hours':
                unitString = Number(reminder.length) <= 1 ?
                    calGetString(
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitHour") :
                    calGetString(
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitHours");
                break;
            case 'days':
                unitString = Number(reminder.length) <= 1 ?
                    calGetString(
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitDay") :
                    calGetString(
                        "sun-calendar-event-dialog",
                        "reminderCustomUnitDays");
                break;
        }

        var relationString;
        switch (reminder.relation) {
            case 'START':
                relationString = calGetString(
                    "sun-calendar-event-dialog",
                    "reminderCustomRelationStart");
                break;
            case 'END':
                relationString = calGetString(
                    "sun-calendar-event-dialog",
                    "reminderCustomRelationEnd");
                break;
        }

        var originString;
        if (reminder.origin && reminder.origin < 0) {
            originString = calGetString(
                "sun-calendar-event-dialog",
                "reminderCustomOriginEnd");
        } else {
            originString = calGetString(
                "sun-calendar-event-dialog",
                "reminderCustomOriginBegin");
        }

        var detailsString = calGetString(
          "sun-calendar-event-dialog",
          "reminderCustomTitle",
          [ reminder.length,
            unitString,
            relationString,
            originString], 4);

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
