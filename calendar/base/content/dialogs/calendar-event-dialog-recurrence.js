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
 *   Joey Minta <jminta@gmail.com>
 *   Michael Buettner <michael.buettner@sun.com>
 *   Hubert Gajewski <hubert@hubertgajewski.com>, Aviary.pl
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

var gIsReadOnly = false;
var gStartTime = null;
var gEndTime = null;

/**
 * Sets up the recurrence dialog from the window arguments. Takes care of filling
 * the dialog controls with the recurrence information for this window.
 */
function onLoad() {
    changeWidgetsOrder();

    var args = window.arguments[0];
    var item = args.calendarEvent;
    var calendar = item.calendar;
    var recinfo = args.recurrenceInfo;

    gStartTime = args.startTime;
    gEndTime = args.endTime;
    var preview = document.getElementById("recurrence-preview");
    preview.dateTime = gStartTime.getInTimezone(calendarDefaultTimezone());

    onChangeCalendar(calendar);

    // Set starting value for 'repeat until' rule.
    setElementValue("repeat-until-date", gStartTime.getInTimezone(floating()).jsDate);

    if (item.parentItem != item) {
        item = item.parentItem;
    }
    var rule = null;
    if (recinfo) {
        // Split out rules and exceptions
        try {
            var rrules = splitRecurrenceRules(recinfo);
            var rules = rrules[0];
            var exceptions = rrules[1];
            // Deal with the rules
            if (rules.length > 0) {
                // We only handle 1 rule currently
                if (calInstanceOf(rules[0], Components.interfaces.calIRecurrenceRule)) {
                    rule = rules[0];
                }
            }
        } catch (ex) {
            Components.utils.reportError(ex);
        }
    }
    if (!rule) {
        rule = createRecurrenceRule();
        rule.type = 'DAILY';
        rule.interval = 1;
        rule.count = -1;
    }
    initializeControls(rule);

    // Update controls
    updateRecurrenceDeck();

    opener.setCursor("auto");
    self.focus();
}

/**
 * Initialize the dialog controls according to the passed rule
 *
 * @param rule    The recurrence rule to parse.
 */
function initializeControls(rule) {
    function getOrdinalAndWeekdayOfRule(aByDayRuleComponent) {
        return {
            ordinal: (aByDayRuleComponent - (aByDayRuleComponent % 8)) / 8,
            weekday: Math.abs(aByDayRuleComponent % 8)
        };
    }
    
    switch (rule.type) {
        case "DAILY":
            document.getElementById("period-list").selectedIndex = 0;
            setElementValue("daily-days", rule.interval);
            break;
        case "WEEKLY":
            setElementValue("weekly-weeks", rule.interval);
            document.getElementById("period-list").selectedIndex = 1;
            break;
        case "MONTHLY":
            setElementValue("monthly-interval", rule.interval);
            document.getElementById("period-list").selectedIndex = 2;
            break;
        case "YEARLY":
            setElementValue("yearly-interval", rule.interval);
            document.getElementById("period-list").selectedIndex = 3;
            break;
        default:
            document.getElementById("period-list").selectedIndex = 0;
            dump("unable to handle your rule type!\n");
            break;
    }

    var byDayRuleComponent = rule.getComponent("BYDAY", {});
    var byMonthDayRuleComponent = rule.getComponent("BYMONTHDAY", {});
    var byMonthRuleComponent = rule.getComponent("BYMONTH", {});
    var kDefaultTimezone = calendarDefaultTimezone();
    var startDate = gStartTime.getInTimezone(kDefaultTimezone);

    // "DAILY" ruletype
    // byDayRuleComponents may have been set priorily by "MONTHLY"- ruletypes
    // where they have a different context-
    // that's why we also query the current rule-type
    if (byDayRuleComponent.length == 0  || rule.type != "DAILY") {
        document.getElementById("daily-group").selectedIndex = 0;
    } else {
        document.getElementById("daily-group").selectedIndex = 1;
    }

    // "WEEKLY" ruletype
    if (byDayRuleComponent.length == 0 || rule.type != "WEEKLY") {
        document.getElementById("daypicker-weekday").days = [startDate.weekday + 1];
    } else {
        document.getElementById("daypicker-weekday").days = byDayRuleComponent;
    }

    // "MONTHLY" ruletype
    var ruleComponentsEmpty = (byDayRuleComponent.length == 0 &&
                               byMonthDayRuleComponent.length == 0);
    if (ruleComponentsEmpty || rule.type != "MONTHLY") {
        document.getElementById("monthly-group").selectedIndex = 1;
        document.getElementById("monthly-days").days = [startDate.day];
        var day = Math.floor((startDate.day - 1) / 7) + 1;
        setElementValue("monthly-ordinal", day);
        setElementValue("monthly-weekday", startDate.weekday + 1);
    } else {
        if (byDayRuleComponent.length > 0) {
            document.getElementById("monthly-group").selectedIndex = 0;
            var ruleInfo = getOrdinalAndWeekdayOfRule(byDayRuleComponent[0]);
            setElementValue("monthly-ordinal", ruleInfo.ordinal);
            setElementValue("monthly-weekday", ruleInfo.weekday);
        } else if (byMonthDayRuleComponent.length > 0) {
            if (byMonthDayRuleComponent.length == 1 && byDayRuleComponent[0] == -1) {
                document.getElementById("monthly-group").selectedIndex = 0;
                setElementValue("monthly-ordinal", byMonthDayRuleComponent[0]);
                setElementValue("monthly-weekday", byMonthDayRuleComponent[0]);
            } else {
                document.getElementById("monthly-group").selectedIndex = 1;
                document.getElementById("monthly-days").days = byMonthDayRuleComponent;
            }
        }
    }

    // "YEARLY" ruletype
    if (byMonthRuleComponent.length == 0  || rule.type != "YEARLY") {
        setElementValue("yearly-days", startDate.day);
        setElementValue("yearly-month-ordinal", startDate.month + 1);
        var day = Math.floor((startDate.day - 1) / 7) + 1;
        setElementValue("yearly-ordinal", day);
        setElementValue("yearly-weekday", startDate.weekday + 1);
        setElementValue("yearly-month-rule", startDate.month + 1);
    } else {
        if (byMonthDayRuleComponent.length > 0) {
            document.getElementById("yearly-group").selectedIndex = 0;
            setElementValue("yearly-month-ordinal", byMonthRuleComponent[0]);
            setElementValue("yearly-days", byMonthDayRuleComponent[0]);
        } else if (byDayRuleComponent.length > 0) {
            document.getElementById("yearly-group").selectedIndex = 1;
            var ruleInfo = getOrdinalAndWeekdayOfRule(byDayRuleComponent[0]);
            setElementValue("yearly-ordinal", ruleInfo.ordinal);
            setElementValue("yearly-weekday", ruleInfo.weekday);
            setElementValue("yearly-month-rule", byMonthRuleComponent[0]);
        }
    }

    /* load up the duration of the event radiogroup */
    if (rule.isByCount) {
        if (rule.count == -1) {
            setElementValue("recurrence-duration", "forever");
        } else {
            setElementValue("recurrence-duration", "ntimes");
            setElementValue("repeat-ntimes-count", rule.count );
        }
    } else {
        var endDate = rule.endDate;
        if (!endDate) {
            setElementValue("recurrence-duration", "forever");
        } else {
            endDate = endDate.getInTimezone(gStartTime.timezone); // calIRecurrenceRule::endDate is always UTC or floating
            setElementValue("recurrence-duration", "until");
            setElementValue("repeat-until-date", endDate.getInTimezone(floating()).jsDate);
        }
    }
}

/**
 * Save the recurrence information selected in the dialog back to the given
 * item.
 *
 * @param item    The item to save back to.
 * @return        The saved recurrence info.
 */
function onSave(item) {
    // Always return 'null' if this item is an occurrence.
    if (!item || item.parentItem != item) {
        return null;
    }

    // This works, but if we ever support more complex recurrence,
    // e.g. recurrence for Martians, then we're going to want to
    // not clone and just recreate the recurrenceInfo each time.
    // The reason is that the order of items (rules/dates/datesets)
    // matters, so we can't always just append at the end.  This
    // code here always inserts a rule first, because all our
    // exceptions should come afterward.
    var deckNumber = Number(getElementValue("period-list"));

    var args = window.arguments[0];
    var recurrenceInfo = args.recurrenceInfo;
    if (recurrenceInfo) {
        recurrenceInfo = recurrenceInfo.clone();
        var rrules = splitRecurrenceRules(recurrenceInfo);
        if (rrules[0].length > 0) {
            recurrenceInfo.deleteRecurrenceItem(rrules[0][0]);
        }
        recurrenceInfo.item = item;
    } else {
        recurrenceInfo = createRecurrenceInfo(item);
    }

    var recRule = createRecurrenceRule();
    switch (deckNumber) {
    case 0:
        recRule.type = "DAILY";
        var dailyGroup = document.getElementById("daily-group");
        if (dailyGroup.selectedIndex == 0) {
            var ndays = Math.max(1, Number(getElementValue("daily-days")));
            recRule.interval = ndays;
        } else {
            recRule.interval = 1;
            var onDays = [2, 3, 4, 5, 6];
            recRule.setComponent("BYDAY", onDays.length, onDays);
        }
        break;
    case 1:
        recRule.type = "WEEKLY";
        var ndays = Number(getElementValue("weekly-weeks"));
        recRule.interval = ndays;
        var onDays = document.getElementById("daypicker-weekday").days;
        if (onDays.length > 0) {
            recRule.setComponent("BYDAY", onDays.length, onDays);
        }
        break;
    case 2:
        recRule.type = "MONTHLY";
        var monthInterval = Number(getElementValue("monthly-interval"));
        recRule.interval = monthInterval;
        var monthlyGroup = document.getElementById("monthly-group");
        if (monthlyGroup.selectedIndex==0) {
            var ordinal = Number(getElementValue("monthly-ordinal"));
            var day_of_week = Number(getElementValue("monthly-weekday"));
            if (day_of_week < 0) {
                recRule.setComponent("BYMONTHDAY", 1, [ ordinal ]);
            } else {
                var sign = ordinal < 0 ? -1 : 1;
                var onDays = [ (Math.abs(ordinal) * 8 + day_of_week) * sign ];
                recRule.setComponent("BYDAY", onDays.length, onDays);
            }
        } else {
            var monthlyDays = document.getElementById("monthly-days").days;
            if (monthlyDays.length > 0) {
                recRule.setComponent("BYMONTHDAY", monthlyDays.length, monthlyDays);
            }
        }
        break;
    case 3:
        recRule.type = "YEARLY";
        var yearInterval = Number(getElementValue("yearly-interval"));
        recRule.interval = yearInterval;
        var yearlyGroup = document.getElementById("yearly-group");
        if (yearlyGroup.selectedIndex == 0) {
            var yearlyByMonth = [ Number(getElementValue("yearly-month-ordinal")) ];
            recRule.setComponent("BYMONTH", yearlyByMonth.length, yearlyByMonth);
            var yearlyByDay = [ Number(getElementValue("yearly-days")) ];
            recRule.setComponent("BYMONTHDAY", yearlyByDay.length, yearlyByDay);
        } else {
            var yearlyByMonth = [ Number(getElementValue("yearly-month-rule")) ];
            recRule.setComponent("BYMONTH", yearlyByMonth.length, yearlyByMonth);
            var ordinal = Number(getElementValue("yearly-ordinal"));
            var day_of_week = Number(getElementValue("yearly-weekday"));
            var sign = ordinal < 0 ? -1 : 1;
            var onDays = [ (Math.abs(ordinal) * 8 + day_of_week) * sign ];
            recRule.setComponent("BYDAY", onDays.length, onDays);
        }
        break;
    }

    // Figure out how long this event is supposed to last
    switch (document.getElementById("recurrence-duration").selectedItem.value) {
        case "forever":
            recRule.count = -1;
            break;
        case "ntimes":
            recRule.count = Math.max(1, getElementValue("repeat-ntimes-count"));
            break;
        case "until":
            var endDate = jsDateToDateTime(getElementValue("repeat-until-date"), gStartTime.timezone);
            endDate.isDate = gStartTime.isDate; // enforce same value type as DTSTART
            if (!gStartTime.isDate) {
                // correct UNTIL to exactly match start date's hour, minute, second:
                endDate.hour = gStartTime.hour;
                endDate.minute = gStartTime.minute;
                endDate.second = gStartTime.second;
            }
            recRule.endDate = endDate;
            break;
    }

    if (recRule.interval < 1) {
        return null;
    }

    recurrenceInfo.insertRecurrenceItemAt(recRule, 0);
    return recurrenceInfo;
}

/**
 * Handler function to be called when the accept button is pressed.
 *
 * @return      Returns true if the window should be closed
 */
function onAccept() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    args.onOk(onSave(item));
    return true;
}

/**
 * Handler function called when the calendar is changed (also for initial
 * setup).
 *
 * XXX we don't change the calendar in this dialog, this function should be
 * consolidated or renamed.
 *
 * @param calendar    The calendar to use for setup.
 */
function onChangeCalendar(calendar) {
    var args = window.arguments[0];
    var item = args.calendarEvent;

    // Set 'gIsReadOnly' if the calendar is read-only
    gIsReadOnly = false;
    if (calendar && calendar.readOnly) {
        gIsReadOnly = true;
    }

    // Disable or enable controls based on a set or rules
    // - whether this item is a stand-alone item or an occurrence
    // - whether or not this item is read-only
    // - whether or not the state of the item allows recurrence rules
    //     - tasks without an entrydate are invalid
    disableOrEnable(item);

    updateRecurrenceControls();
}

/**
 * Disable or enable certain controls based on the given item:
 * Uses the following attribute:
 *
 * - disable-on-occurrence
 * - disable-on-readonly
 *
 * A task without a start time is also considered readonly.
 *
 * @param item        The item to check.
 */
function disableOrEnable(item) {
    if (item.parentItem != item) {
       disableRecurrenceFields("disable-on-occurrence");
    } else if (gIsReadOnly) {
        disableRecurrenceFields("disable-on-readonly");
    } else if (isToDo(item) && !gStartTime) {
        disableRecurrenceFields("disable-on-readonly");
    } else {
        enableRecurrenceFields("disable-on-readonly");
    }
}

/**
 * Disables all fields that have an attribute that matches the argument and is
 * set to "true".
 *
 * @param aAttributeName    The attribute to search for.
 */
function disableRecurrenceFields(aAttributeName) {
    var disableElements = document.getElementsByAttribute(aAttributeName, "true");
    for (var i = 0; i < disableElements.length; i++) {
        disableElements[i].setAttribute('disabled', 'true');
    }
}

/**
 * Enables all fields that have an attribute that matches the argument and is
 * set to "true".
 *
 * @param aAttributeName    The attribute to search for.
 */
function enableRecurrenceFields(aAttributeName) {
    var enableElements = document.getElementsByAttribute(aAttributeName, "true");
    for (var i = 0; i < enableElements.length; i++) {
        enableElements[i].removeAttribute('disabled');
    }
}

/**
 * Split rules into negative and positive rules.
 *
 * XXX This function is duplicate from calendar-dialog-utils.js, which we may
 * want to include in this dialog.
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
 * Handler function to update the period-deck when an item from the period-list
 * is selected. Also updates the controls on that deck.
 */
function updateRecurrenceDeck() {
    document.getElementById("period-deck")
            .selectedIndex = Number(getElementValue("period-list"));
    updateRecurrenceControls();
}

/**
 * Updates the controls regarding ranged controls (i.e repeat forever, repeat
 * until, repeat n times...)
 */
function updateRecurrenceRange() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    if (item.parentItem != item || gIsReadOnly) {
        return;
    }

    var radioRangeForever =
        document.getElementById("recurrence-range-forever");
    var radioRangeFor =
        document.getElementById("recurrence-range-for");
    var radioRangeUntil =
        document.getElementById("recurrence-range-until");
    var rangeTimesCount =
        document.getElementById("repeat-ntimes-count");
    var rangeUntilDate =
        document.getElementById("repeat-until-date");
    var rangeAppointmentsLabel =
        document.getElementById("repeat-appointments-label");

    var deckNumber = Number(getElementValue("period-list"));

    radioRangeForever.removeAttribute("disabled");
    radioRangeFor.removeAttribute("disabled");
    radioRangeUntil.removeAttribute("disabled");
    rangeAppointmentsLabel.removeAttribute("disabled");

    var durationSelection = document.getElementById("recurrence-duration")
                                    .selectedItem.value;
    if (durationSelection == "forever") {
    }

    if (durationSelection == "ntimes") {
        rangeTimesCount.removeAttribute("disabled");
    } else {
        rangeTimesCount.setAttribute("disabled", "true");
    }

    if (durationSelection == "until") {
        rangeUntilDate.removeAttribute("disabled");
    } else {
        rangeUntilDate.setAttribute("disabled", "true");
    }
}

/**
 * Updates the recurrence preview calendars using the window's item.
 */
function updatePreview() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    if (item.parentItem != item) {
        item = item.parentItem;
    }

    // TODO: We should better start the whole dialog with a newly cloned item
    // and always pump changes immediately into it. This would eliminate the
    // need to break the encapsulation, as we do it here. But we need the item
    // to contain the startdate in order to calculate the recurrence preview.
    item = item.clone();
    var kDefaultTimezone = calendarDefaultTimezone();
    if (isEvent(item)) {
        var startDate = gStartTime.getInTimezone(kDefaultTimezone);
        var endDate = gEndTime.getInTimezone(kDefaultTimezone);
        if (startDate.isDate) {
            endDate.day--;
        }

        item.startDate = startDate;
        item.endDate = endDate;
    }
    if (isToDo(item)) {
        var entryDate = gStartTime;
        if (entryDate) {
            entryDate = entryDate.getInTimezone(kDefaultTimezone);
        } else {
            item.recurrenceInfo = null;
        }
        item.entryDate = entryDate;
        var dueDate = gEndTime;
        if (dueDate) {
            dueDate = dueDate.getInTimezone(kDefaultTimezone);
        }
        item.dueDate = dueDate;
    }

    var recInfo = onSave(item);
    var preview = document.getElementById("recurrence-preview");
    preview.updatePreview(recInfo);
}

/**
 * Update all recurrence controls on the dialog.
 */
function updateRecurrenceControls() {
    updateRecurrencePattern();
    updateRecurrenceRange();
    updatePreview();
}

/**
 * Disables/enables controls related to the recurrence pattern.
 * the status of the controls depends on which period entry is selected
 * and which form of pattern rule is selected.
 */
function updateRecurrencePattern() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    if (item.parentItem != item || gIsReadOnly) {
        return;
    }

    switch (Number(getElementValue("period-list"))) {
        // daily
        case 0:
            var dailyGroup = document.getElementById("daily-group");
            var dailyDays = document.getElementById("daily-days");
            dailyDays.removeAttribute("disabled", "true");
            if (dailyGroup.selectedIndex == 1) {
                dailyDays.setAttribute("disabled", "true");
            }
            break;
        // weekly
        case 1:
            break;
        // monthly
        case 2:
            var monthlyGroup = document.getElementById("monthly-group");
            var monthlyOrdinal = document.getElementById("monthly-ordinal");
            var monthlyWeekday = document.getElementById("monthly-weekday");
            var monthlyDays = document.getElementById("monthly-days");
            monthlyOrdinal.removeAttribute("disabled", "true");
            monthlyWeekday.removeAttribute("disabled", "true");
            monthlyDays.removeAttribute("disabled", "true");
            if (monthlyGroup.selectedIndex == 0) {
                monthlyDays.setAttribute("disabled", "true");
            } else {
                monthlyOrdinal.setAttribute("disabled", "true");
                monthlyWeekday.setAttribute("disabled", "true");
            }
            break;
        // yearly
        case 3:
            var yearlyGroup = document.getElementById("yearly-group");
            var yearlyDays = document.getElementById("yearly-days");
            var yearlyMonthOrdinal = document.getElementById("yearly-month-ordinal");
            var yearlyOrdinal = document.getElementById("yearly-ordinal");
            var yearlyWeekday = document.getElementById("yearly-weekday");
            var yearlyMonthRule = document.getElementById("yearly-month-rule");
            yearlyDays.removeAttribute("disabled", "true");
            yearlyMonthOrdinal.removeAttribute("disabled", "true");
            yearlyOrdinal.removeAttribute("disabled", "true");
            yearlyWeekday.removeAttribute("disabled", "true");
            yearlyMonthRule.removeAttribute("disabled", "true");
            if (yearlyGroup.selectedIndex == 0) {
                yearlyOrdinal.setAttribute("disabled", "true");
                yearlyWeekday.setAttribute("disabled", "true");
                yearlyMonthRule.setAttribute("disabled", "true");
            } else {
                yearlyDays.setAttribute("disabled", "true");
                yearlyMonthOrdinal.setAttribute("disabled", "true");
            }
            break;
    }
}

/**
 * This function changes the order for certain elements using a locale string.
 * This is needed for some locales that expect a different wording order.
 *
 * @param aPropKey      The locale property key to get the order from
 * @param aPropParams   An array of ids to be passed to the locale property.
 *                        These should be the ids of the elements to change
 *                        the order for.
 */
function changeOrderForElements(aPropKey, aPropParams) {
    var localeOrder;
    var parents = {};
    var i = 0;

    for (var key in aPropParams) {
        // Save original parents so that the nodes to reorder get appended to
        // the correct parent nodes.
        parents[key] = document.getElementById(aPropParams[key]).parentNode;
    }

    try {
        localeOrder = calGetString("calendar-event-dialog",
                                   aPropKey,
                                   aPropParams);

        localeOrder = localeOrder.split(" ");
    } catch (ex) {
        var s = "The key " + aPropKey + " in calendar-event-dialog.prop" +
                "erties has incorrect number of params. Expected " +
                aPropParams.length + " params.";
        Components.utils.reportError(s + " " + ex);
        return;
    }

    // Add elements in the right order, removing them from their old parent
    for (var i = 0; i < aPropParams.length; i++) {
        var newEl = document.getElementById(localeOrder[i]);
        parents[i].appendChild(newEl.parentNode.removeChild(newEl));

    }
}

/**
 * Change locale-specific widget order for Edit Recurrence window
 */
function changeWidgetsOrder() {
    changeOrderForElements("monthlyOrder",
                           ["monthly-ordinal",
                            "monthly-weekday"]);
    changeOrderForElements("yearlyOrder",
                           ["yearly-days",
                            "yearly-period-of-month-label",
                            "yearly-month-ordinal"]);
    changeOrderForElements("yearlyOrder2",
                           ["yearly-ordinal",
                            "yearly-weekday",
                            "yearly-period-of-label",
                            "yearly-month-rule"]);
}
