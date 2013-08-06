/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
EXPORTED_SYMBOLS = ["recurrenceRule2String", "splitRecurrenceRules", "checkRecurrenceRule"];

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
    function getRString(name, args) cal.calGetString("calendar-event-dialog", name, args);

    // Retrieve a valid recurrence rule from the currently
    // set recurrence info. Bail out if there's more
    // than a single rule or something other than a rule.
    recurrenceInfo = recurrenceInfo.clone();
    let rrules = splitRecurrenceRules(recurrenceInfo);
    if (rrules[0].length == 1) {
        let rule = cal.wrapInstance(rrules[0][0], Components.interfaces.calIRecurrenceRule);
        // currently we don't allow for any BYxxx-rules.
        if (rule &&
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
            function nounClass(aDayString, aRuleString) {
                // Select noun class (grammatical gender) for rule string
                let nounClass = getRString(aDayString + "Nounclass");
                return aRuleString + nounClass.substr(0, 1).toUpperCase() +
                       nounClass.substr(1);
            }
            function pluralWeekday(aDayString) {
                let plural = getRString("pluralForWeekdays") == "true";
                return (plural ? aDayString + "Plural" : aDayString);
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
                        return null;
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
                    // create a string like 'Monday, Tuesday and Wednesday'
                    let days = rule.getComponent("BYDAY", {});
                    let weekdays = "";
                    // select noun class (grammatical gender) according to the
                    // first day of the list
                    let weeklyString = nounClass("repeatDetailsDay" + days[0], "weeklyNthOn");
                    for (let i = 0; i < days.length; i++) {
                        if (rule.interval == 1) {
                            weekdays += getRString(pluralWeekday("repeatDetailsDay" + days[i]));
                        } else {
                            weekdays += getRString("repeatDetailsDay" + days[i]);
                        }
                        if (days.length > 1 && i == (days.length - 2)) {
                            weekdays += ' ' + getRString("repeatDetailsAnd") + ' ';
                        } else if (i < days.length - 1) {
                            weekdays += ', ';
                        }
                    }

                    weeklyString = getRString(weeklyString, [weekdays]);
                    ruleString= PluralForm.get(rule.interval, weeklyString)
                                          .replace("#2", rule.interval);

                } else {
                    let weeklyString = getRString("weeklyEveryNth");
                    ruleString = PluralForm.get(rule.interval, weeklyString)
                                           .replace("#1", rule.interval);
                }
            } else if (rule.type == 'MONTHLY') {
                if (checkRecurrenceRule(rule, ['BYDAY'])) {
                    let weekdaysString_every = "";
                    let weekdaysString_position = "";
                    let byday = rule.getComponent("BYDAY", {});
                    let firstDay = byday[0];
                    // build two strings for weekdays with and without
                    // "position" prefix, then join these strings
                    for (let i = 0 ; i < byday.length; i++) {
                        if (day_position(byday[i]) == 0) {
                            if (!weekdaysString_every) {
                                firstDay = byday[i];
                            }
                            weekdaysString_every += getRString(pluralWeekday("repeatDetailsDay" + byday[i])) + ", ";
                        } else {
                            if (day_position(byday[i]) < -1 || day_position(byday[i]) > 5) {
                                // we support only weekdays with -1 as negative
                                // position ('THE LAST ...')
                                return null;
                            }
                            if (byday.some(function(element) {
                                               return (day_position(element) == 0 &&
                                                       day_of_week(byday[i]) == day_of_week(element));
                                           })) {
                                // prevent to build strings such as for example:
                                // "every Monday and the second Monday..."
                                continue;
                            }
                            let ordinalString = "repeatOrdinal" + day_position(byday[i]);
                            let dayString = "repeatDetailsDay" + day_of_week(byday[i]);
                            ordinalString = nounClass(dayString, ordinalString);
                            ordinalString = getRString(ordinalString);
                            dayString = getRString(dayString);
                            let stringOrdinalWeekday = getRString("ordinalWeekdayOrder",
                                                                  [ordinalString, dayString]);
                            weekdaysString_position += stringOrdinalWeekday + ", ";
                        }
                    }
                    let weekdaysString = weekdaysString_every + weekdaysString_position;
                    weekdaysString = weekdaysString.slice(0,-2)
                                     .replace(/,(?= [^,]*$)/, ' ' + getRString("repeatDetailsAnd"));

                    let monthlyString = weekdaysString_every ? "monthlyEveryOfEvery" : "monthlyRuleNthOfEvery";
                    monthlyString = nounClass("repeatDetailsDay" + day_of_week(firstDay), monthlyString);
                    monthlyString = getRString(monthlyString, [weekdaysString]);
                    ruleString = PluralForm.get(rule.interval, monthlyString).
                                            replace("#2", rule.interval);
                } else if (checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    let component = rule.getComponent("BYMONTHDAY", {});

                    // First, find out if the 'BYMONTHDAY' component contains
                    // any elements with a negative value lesser than -1 ("the
                    // last day"). If so we currently don't support any rule
                    if (component.some(function(element, index, array) {
                                           return element < -1;
                                       })) {
                        // we don't support any other combination for now...
                        return getRString("ruleTooComplex");
                    } else {
                        if (component.length == 1 && component[0] == -1) {
                            // i.e. one day, the last day of the month
                            let monthlyString = getRString("monthlyLastDayOfNth");
                            ruleString = PluralForm.get(rule.interval, monthlyString)
                                                   .replace("#1", rule.interval);
                        } else if (component.length == 31 &&
                                    component.every(function (element, index, array) {
                                                        for (let i = 0; i < array.length; i++) {
                                                            if ((index + 1) == array[i])
                                                                return true;
                                                        }
                                                        return false;
                                                    })) {
                            // i.e. every day every N months
                            ruleString = getRString("monthlyEveryDayOfNth");
                            ruleString = PluralForm.get(rule.interval, ruleString)
                                                   .replace("#2", rule.interval);
                        } else {
                            // i.e. one or more monthdays every N months
                            let day_string = "";
                            let lastDay = false;
                            for (let i = 0; i < component.length; i++) {
                                if (component[i] == -1) {
                                    lastDay = true;
                                    continue;
                                }
                                day_string += component[i] + ", ";
                            }
                            if (lastDay) {
                                day_string += getRString("monthlyLastDay") + ", ";
                            }
                            day_string = day_string.slice(0,-2)
                                         .replace(/,(?= [^,]*$)/, ' ' + getRString("repeatDetailsAnd"));
                            let monthlyString = getRString("monthlyDayOfNth", [day_string]);
                            ruleString = PluralForm.get(rule.interval, monthlyString)
                                                   .replace("#2", rule.interval);
                        }
                    }
                } else {
                    let monthlyString = getRString("monthlyDayOfNth", [startDate.day]);
                    ruleString = PluralForm.get(rule.interval, monthlyString)
                                           .replace("#2", rule.interval);
                }
            } else if (rule.type == 'YEARLY') {
                let bymonth = rule.getComponent("BYMONTH", {});
                if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                    checkRecurrenceRule(rule, ['BYMONTHDAY'])) {
                    let bymonthday = rule.getComponent("BYMONTHDAY", {});

                    if (bymonth.length == 1 && bymonthday.length == 1) {
                        let monthNameString = getRString("repeatDetailsMonth" + bymonth[0]);

                        let yearlyString = getRString("yearlyNthOn",
                                                      [monthNameString, bymonthday[0]]);
                        ruleString = PluralForm.get(rule.interval, yearlyString)
                                               .replace("#3", rule.interval);
                    }
                } else if (checkRecurrenceRule(rule, ['BYMONTH']) &&
                           checkRecurrenceRule(rule, ['BYDAY'])) {
                    let byday = rule.getComponent("BYDAY", {});

                    if (bymonth.length == 1 && byday.length == 1) {
                        let dayString = "repeatDetailsDay" + day_of_week(byday[0]);
                        let month = getRString("repeatDetailsMonth" + bymonth[0]);
                        if (day_position(byday[0]) == 0) {
                            let yearlyString = "yearlyOnEveryNthOfNth";
                            yearlyString = nounClass(dayString, yearlyString);
                            let day = getRString(pluralWeekday(dayString));
                            yearlyString = getRString(yearlyString, [day, month]);
                            ruleString = PluralForm.get(rule.interval, yearlyString)
                                                   .replace("#3", rule.interval);
                        } else {
                            let yearlyString = "yearlyNthOnNthOf";
                            let ordinalString = "repeatOrdinal" + day_position(byday[0])
                            yearlyString = nounClass(dayString, yearlyString);
                            ordinalString = nounClass(dayString, ordinalString);
                            let ordinal = getRString(ordinalString);
                            let day = getRString(dayString);
                            yearlyString = getRString(yearlyString, [ordinal, day, month]);
                            ruleString = PluralForm.get(rule.interval, yearlyString)
                                                   .replace("#4", rule.interval);
                        }
                    } else {
                        return null;
                    }
                } else {
                    let monthNameString = getRString("repeatDetailsMonth" + (startDate.month + 1));

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
                        let untilDate = rule.untilDate.getInTimezone(kDefaultTimezone);
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
                        let untilDate = rule.untilDate.getInTimezone(kDefaultTimezone);
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
    return null;
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
