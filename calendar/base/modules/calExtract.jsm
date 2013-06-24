/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["Extractor"];
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/**
* Initializes extraction
*
* @param baseUrl         path for the properties file containing patterns,
*                            locale in path should be substituted with LOCALE
* @param fallbackLocale  locale to use when others are not found or
*                            detection is disabled
* @param dayStart        ambiguous hours earlier than this are considered to
*                            be in the afternoon, when null then by default
*                            set to 6
*/
function Extractor(baseUrl, fallbackLocale, dayStart) {
    this.bundleUrl = baseUrl;
    this.fallbackLocale = fallbackLocale;

    if (dayStart != null) {
        this.dayStart = dayStart;
    }

    this.email = "";
    this.marker = "--MARK--";
    this.collected = [];
    this.numbers = [];
    this.hourlyNumbers = [];
    this.dailyNumbers = [];
    this.allMonths = "";
    this.months = [];
    this.dayStart = 6;
    this.now = new Date();
    this.bundle = "";
    this.overrides = {};
}

Extractor.prototype = {
    /**
    * Removes confusing data like urls, timezones and phone numbers from email
    * Also removes standard signatures and quoted content from previous emails
    */
    cleanup: function cleanup() {
        // XXX remove earlier correspondence
        // ideally this should be considered with lower certainty to fill in
        // missing information

        // remove last line preceeding quoted message and first line of the quote
        this.email = this.email.replace(/\r?\n[^>].*\r?\n>+.*$/m, "");
        // remove the rest of quoted content
        this.email = this.email.replace(/^>+.*$/gm, "");

        // urls often contain dates dates that can confuse extraction
        this.email = this.email.replace(/https?:\/\/[^\s]+\s/gm, "");
        this.email = this.email.replace(/www\.[^\s]+\s/gm, "");

        // remove phone numbers
        // TODO allow locale specific configuration of formats
        this.email = this.email.replace(/\d-\d\d\d-\d\d\d-\d\d\d\d/gm, "");

        // remove standard signature
        this.email = this.email.replace(/\r?\n-- \r?\n[\S\s]+$/, "");

        // XXX remove timezone info, for now
        this.email = this.email.replace(/gmt[+-]\d{2}:\d{2}/gi, "");
    },

    checkBundle: function checkBundle(locale) {
        let path = this.bundleUrl.replace("LOCALE", locale, "g");
        let bundle = Services.strings.createBundle(path);

        try {
            bundle.GetStringFromName("from.today");
            return true;
        } catch (ex) {
            return false;
        }
    },

    setLanguage: function setLanguage() {
        if (this.checkBundle(this.fallbackLocale)) {
            ;
        } else {
            this.fallbackLocale = "en-US";
        }

        let path = this.bundleUrl.replace("LOCALE", this.fallbackLocale, "g");
        this.bundle = Services.strings.createBundle(path);
    },

    /**
    * Extracts dates, times and durations from email
    *
    * @param body  email body
    * @param now   reference time against which relative times are interpreted,
    *                  when null current time is used
    * @param sel   selection object of email content, when defined times
    *                  outside selection are disgarded
    * @param title email title
    * @return      sorted list of extracted datetime objects
    */
    extract: function extract(title, body, now, sel) {
        let initial = {};
        this.collected = [];
        this.email = title + "\r\n" + body;
        if (now != null) {
            this.now = now;
        }

        initial.year = now.getFullYear();
        initial.month = now.getMonth() + 1;
        initial.day = now.getDate();
        initial.hour = now.getHours();
        initial.minute = now.getMinutes();

        this.collected.push({year: initial.year,
                             month: initial.month,
                             day: initial.day,
                             hour: initial.hour,
                             minute: initial.minute,
                             relation: "start"
        });

        this.cleanup();
        cal.LOG("[calExtract] Email after processing for extraction: \n" + this.email);

        this.overrides = JSON.parse(cal.getPrefSafe("calendar.patterns.override", "{}"));
        this.setLanguage();

        for (let i = 0; i <= 31; i++) {
            this.numbers[i] = this.getPatterns("number." + i);
        }
        this.dailyNumbers = this.numbers.join(this.marker);

        this.hourlyNumbers =  this.numbers[0] + this.marker;
        for (let i = 1; i <= 22; i++) {
            this.hourlyNumbers += this.numbers[i] + this.marker;
        }
        this.hourlyNumbers += this.numbers[23];

        this.hourlyNumbers = this.hourlyNumbers.replace("|", this.marker, "g");
        this.dailyNumbers = this.dailyNumbers.replace("|", this.marker, "g");

        for (let i = 0; i < 12; i++) {
            this.months[i] = this.getPatterns("month." + (i + 1));
        }
        this.allMonths = this.months.join(this.marker).replace("|", this.marker, "g");

        // time
        this.extractTime("from.noon", "start", 12, 0);
        this.extractTime("until.noon", "end", 12, 0);

        this.extractHour("from.hour", "start", "none");
        this.extractHour("from.hour.am", "start", "ante");
        this.extractHour("from.hour.pm", "start", "post");
        this.extractHour("until.hour", "end", "none");
        this.extractHour("until.hour.am", "end", "none");
        this.extractHour("until.hour.pm", "end", "none");

        this.extractHalfHour("from.half.hour.before", "start", "ante");
        this.extractHalfHour("until.half.hour.before", "end", "ante");
        this.extractHalfHour("from.half.hour.after", "start", "post");
        this.extractHalfHour("until.half.hour.after", "end", "post");

        this.extractHourMinutes("from.hour.minutes", "start", "none");
        this.extractHourMinutes("from.hour.minutes.am", "start", "ante");
        this.extractHourMinutes("from.hour.minutes.pm", "start", "post");
        this.extractHourMinutes("until.hour.minutes", "end", "none");
        this.extractHourMinutes("until.hour.minutes.am", "end", "ante");
        this.extractHourMinutes("until.hour.minutes.pm", "end", "post");

        // date
        this.extractRelativeDay("from.today", "start", 0);
        this.extractRelativeDay("from.tomorrow", "start", 1);
        this.extractRelativeDay("until.tomorrow", "end", 1);
        this.extractWeekDay("from.weekday.", "start");
        this.extractWeekDay("until.weekday.", "end");
        this.extractDate("from.ordinal.date", "start");
        this.extractDate("until.ordinal.date", "end");

        this.extractDayMonth("from.month.day", "start");
        this.extractDayMonthYear("from.year.month.day", "start");
        this.extractDayMonth("until.month.day", "end");
        this.extractDayMonthYear("until.year.month.day", "end");
        this.extractDayMonthName("from.monthname.day", "start");
        this.extractDayMonthNameYear("from.year.monthname.day", "start");
        this.extractDayMonthName("until.monthname.day", "end");
        this.extractDayMonthNameYear("until.year.monthname.day", "end");

        // duration
        this.extractDuration("duration.minutes", 1);
        this.extractDuration("duration.hours", 60);
        this.extractDuration("duration.days", 60 * 24);

        if (sel !== undefined) {
            this.markSelected(sel, title);
        }
        this.markContained();
        this.collected = this.collected.sort(this.sort);

        return this.collected;
    },

    extractDayMonthYear: function extractDayMonthYear(pattern, relation) {
        let alts = this.getRepPatterns(pattern, ["(\\d{1,2})", "(\\d{1,2})",
                                                "(\\d{2,4})" ]);
        let res;
        for (let alt in alts) {
            let positions = alts[alt].positions;
            let re = new RegExp(alts[alt].pattern, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let day = parseInt(res[positions[1]], 10);
                    let month = parseInt(res[positions[2]], 10);
                    let year = parseInt(this.normalizeYear(res[positions[3]]), 10);

                    if (this.isValidDay(day) && this.isValidMonth(month) &&
                        this.isValidYear(year)) {

                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(year, month, day, null, null,
                                   rev.start, rev.end, rev.pattern, rev.relation, pattern);
                    }
                }
            }
        }
    },

    extractDayMonthNameYear: function extractDayMonthNameYear(pattern, relation) {
        let alts = this.getRepPatterns(pattern, ["(\\d{1,2})",
                                                "(" + this.allMonths + ")",
                                                "(\\d{2,4})" ]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let positions = alts[alt].positions;
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let day = parseInt(res[positions[1]], 10);
                    let month = res[positions[2]];
                    let year = parseInt(this.normalizeYear(res[positions[3]]), 10);

                    if (this.isValidDay(day)) {
                        for (let i = 0; i < 12; i++) {
                            if (this.months[i].split("|").indexOf(month.toLowerCase()) != -1) {
                                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                                this.guess(year, i + 1, day, null, null,
                                           rev.start, rev.end, rev.pattern, rev.relation, pattern);
                                break;
                            }
                        }
                    }
                }
            }
        }
    },

    extractRelativeDay: function extractRelativeDay(pattern, relation, offset) {
        let re = new RegExp(this.getPatterns(pattern), "ig");
        let res;
        if ((res = re.exec(this.email)) != null) {
            if (!this.limitChars(res, this.email)) {
                let item = new Date(this.now.getTime() + 60 * 60 * 24 * 1000 * offset);
                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                this.guess(item.getFullYear(), item.getMonth() + 1, item.getDate(),
                           null, null,
                           rev.start, rev.end, rev.pattern, rev.relation, pattern);
            }
        }
    },

    extractDayMonthName: function extractDayMonthName(pattern, relation) {
        let alts = this.getRepPatterns(pattern,
                                       ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")",
                                       "(" + this.allMonths + ")"]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let positions = alts[alt].positions;
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let day = this.parseNumber(res[positions[1]], this.numbers);
                    let month = res[positions[2]];

                    if (this.isValidDay(day)) {
                        for (let i = 0; i < 12; i++) {
                            let ms = this.months[i].unescape().split("|");
                            if (ms.indexOf(month.toLowerCase()) != -1) {
                                let date = {year: this.now.getFullYear(), month: i + 1, day: day};
                                if (this.isPastDate(date, this.now)) {
                                    // find next such date
                                    let item = new Date(this.now.getTime());
                                    while (true) {
                                        item.setDate(item.getDate() + 1);
                                        if (item.getMonth() == date.month - 1  &&
                                            item.getDate() == date.day) {
                                            date.year = item.getFullYear();
                                            break;
                                        }
                                    }
                                }

                                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                                this.guess(date.year, date.month, date.day, null, null,
                                           rev.start, rev.end, rev.pattern, rev.relation, pattern);
                                break;
                            }
                        }
                    }
                }
            }
        }
    },

    extractDayMonth: function extractDayMonth(pattern, relation) {
        let alts = this.getRepPatterns(pattern, ["(\\d{1,2})", "(\\d{1,2})"]);
        let res;
        for (let alt in alts) {
            let re = new RegExp(alts[alt].pattern, "ig");
            let positions = alts[alt].positions;

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let day = parseInt(res[positions[1]], 10);
                    let month = parseInt(res[positions[2]], 10);

                    if (this.isValidMonth(month) && this.isValidDay(day)) {
                        let date = {year: this.now.getFullYear(), month: month, day: day};

                        if (this.isPastDate(date, this.now)) {
                            // find next such date
                            let item = new Date(this.now.getTime());
                            while (true) {
                                item.setDate(item.getDate() + 1);
                                if (item.getMonth() == date.month - 1  &&
                                    item.getDate() == date.day) {
                                    date.year = item.getFullYear();
                                    break;
                                }
                            }
                        }

                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(date.year, date.month, date.day, null, null,
                                   rev.start, rev.end, rev.pattern, rev.relation, pattern);
                    }
                }
            }
        }
    },

    extractDate: function extractDate (pattern, relation) {
        let alts = this.getRepPatterns(pattern,
                                       ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")"]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let day = this.parseNumber(res[1], this.numbers);
                    if (this.isValidDay(day)) {
                        let item = new Date(this.now.getTime());
                        if (this.now.getDate() > day) {
                            // find next nth date
                            while (true) {
                                item.setDate(item.getDate() + 1);
                                if (item.getMonth() != this.now.getMonth() &&
                                    item.getDate() == day) {
                                    break;
                                }
                            }
                        }

                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(item.getFullYear(), item.getMonth() + 1, day,
                                   null, null,
                                   rev.start, rev.end,
                                   rev.pattern, rev.relation, pattern, true);
                    }
                }
            }
        }
    },

    extractWeekDay: function extractWeekDay(pattern, relation) {
        let days = [];
        for (let i = 0; i < 7; i++) {
            days[i] = this.getPatterns(pattern + i);
            let re = new RegExp(days[i], "ig");
            let res = re.exec(this.email);
            if (res) {
                if (!this.limitChars(res, this.email)) {
                    let date = new Date();
                    date.setDate(this.now.getDate());
                    date.setMonth(this.now.getMonth());
                    date.setYear(this.now.getFullYear());

                    let diff = (i - date.getDay() + 7) % 7;
                    date.setDate(date.getDate() + diff);

                    let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                    this.guess(date.getFullYear(), date.getMonth() + 1, date.getDate(),
                               null, null,
                               rev.start, rev.end,
                               rev.pattern, rev.relation, pattern + i, true);
                }
            }
        }
    },

    extractHour: function extractHour(pattern, relation, meridiem) {
        let alts = this.getRepPatterns(pattern,
                                       ["(\\d{1,2}" + this.marker + this.hourlyNumbers + ")"]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let hour = this.parseNumber(res[1], this.numbers);

                    if (meridiem == "ante" && hour == 12) {
                        hour = hour - 12;
                    } else if (meridiem == "post" && hour != 12) {
                        hour = hour + 12;
                    } else {
                        hour = this.normalizeHour(hour);
                    }

                    if (this.isValidHour(res[1])) {
                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(null, null, null, hour, 0,
                                   rev.start, rev.end, rev.pattern, rev.relation, pattern, true);
                    }
                }
            }
        }
    },

    extractHalfHour: function extractHalfHour(pattern, relation, direction) {
        let alts = this.getRepPatterns(pattern,
                                       ["(\\d{1,2}" + this.marker + this.hourlyNumbers + ")"]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let hour = this.parseNumber(res[1], this.numbers);

                    hour = this.normalizeHour(hour);
                    if (direction == "ante") {
                        if (hour == 1) {
                            hour = 12;
                        } else {
                            hour = hour - 1;
                        }
                    }

                    if (this.isValidHour(hour)) {
                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(null, null, null, hour, 30,
                                   rev.start, rev.end, rev.pattern, rev.relation, pattern, true);
                    }
                }
            }
        }
    },

    extractHourMinutes: function extractHourMinutes(pattern, relation, meridiem) {
        let alts = this.getRepPatterns(pattern, ["(\\d{1,2})", "(\\d{2})"]);
        let res;
        for (let alt in alts) {
            let positions = alts[alt].positions;
            let re = new RegExp(alts[alt].pattern, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let hour = parseInt(res[positions[1]], 10);
                    let minute = parseInt(res[positions[2]], 10);

                    if (meridiem == "ante" && hour == 12) {
                        hour = hour - 12;
                    } else if (meridiem == "post" && hour != 12) {
                        hour = hour + 12;
                    } else {
                        hour = this.normalizeHour(hour);
                    }

                    if (this.isValidHour(hour) && this.isValidMinute(hour)) {
                        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                        this.guess(null, null, null, hour, minute,
                                   rev.start, rev.end, rev.pattern, rev.relation, pattern);
                    }
                }
            }
        }
    },

    extractTime: function extractTime(pattern, relation, hour, minute) {
        let re = new RegExp(this.getPatterns(pattern), "ig");
        let res;
        if ((res = re.exec(this.email)) != null) {
            if (!this.limitChars(res, this.email)) {
                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                this.guess(null, null, null, hour, minute,
                           rev.start, rev.end, rev.pattern, rev.relation, pattern);
            }
        }
    },

    extractDuration: function extractDuration(pattern, unit) {
        let alts = this.getRepPatterns(pattern,
                                       ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")"]);
        let res;
        for (let alt in alts) {
            let exp = alts[alt].pattern.replace(this.marker, "|", "g");
            let re = new RegExp(exp, "ig");

            while ((res = re.exec(this.email)) != null) {
                if (!this.limitNums(res, this.email) && !this.limitChars(res, this.email)) {
                    let length = this.parseNumber(res[1], this.numbers);
                    let guess = {};
                    let rev = this.prefixSuffixStartEnd(res, "duration", this.email);
                    guess.duration = length * unit;
                    guess.start = rev.start;
                    guess.end = rev.end;
                    guess.str = rev.pattern;
                    guess.relation = rev.relation;
                    guess.pattern = pattern;
                    this.collected.push(guess);
                }
            }
        }
    },

    markContained: function markContained() {
        for (let outer = 0; outer < this.collected.length; outer++) {
            for (let inner = 0; inner < this.collected.length; inner++) {
                // included but not exactly the same
                if (outer != inner &&
                    this.collected[outer].start && this.collected[outer].end &&
                    this.collected[inner].start && this.collected[inner].end &&
                    this.collected[inner].start >= this.collected[outer].start &&
                    this.collected[inner].end <= this.collected[outer].end &&
                    !(this.collected[inner].start == this.collected[outer].start &&
                        this.collected[inner].end == this.collected[outer].end)) {

                        cal.LOG("[calExtract] " + this.collected[outer].str + " found as well, disgarding " + this.collected[inner].str);
                        this.collected[inner].relation = "notadatetime";
                }
            }
        }
    },

    markSelected: function markSelected(sel, title) {
        if (sel.rangeCount > 0) {
            // mark the ones to not use
            for (let i = 0; i < sel.rangeCount; i++) {
                cal.LOG("[calExtract] Selection " + i + " is " + sel);
                for (let j = 0; j < this.collected.length; j++) {
                    let selection = sel.getRangeAt(i).toString();

                    if (!selection.contains(this.collected[j].str) &&
                        !title.contains(this.collected[j].str)) {
                        this.collected[j].relation = "notadatetime";
                        cal.LOG("[calExtract] Marked " + JSON.stringify(this.collected[j]) + " as notadatetime");
                    }
                }
            }
        }
    },

    sort: function sort(one, two) {
        let rc;
        // sort the guess from email date as the last one
        if (one.start == null && two.start != null) {
            return 1;
        } else if (one.start != null && two.start == null) {
            return -1;
        } else if (one.start == null && two.start == null) {
            return 0;
        // sort dates before times
        } else if (one.year != null && two.year == null) {
            return -1;
        } else if (one.year == null && two.year != null) {
            return 1;
        } else if (one.year != null && two.year != null) {
            rc = (one.year > two.year) - (one.year < two.year);
            if (rc != 0) {
                return rc;
            } else {
                rc = (one.month > two.month) - (one.month < two.month);
                if (rc != 0) {
                    return rc;
                } else {
                    rc = (one.day > two.day) - (one.day < two.day);
                    return rc;
                }
            }
        } else {
            rc = (one.hour > two.hour) - (one.hour < two.hour);
            if (rc != 0) {
                return rc;
            } else {
                rc = (one.minute > two.minute) - (one.minute < two.minute)
                return rc;
            }
        }
    },

    /**
    * Guesses start time from list of guessed datetimes
    *
    * @param isTask    whether start time should be guessed for task or event
    * @return          datetime object for start time
    */
    guessStart: function guessStart(isTask) {
        let startTimes = this.collected.filter(function(val) val.relation == "start");
        if (startTimes.length == 0) {
            return {};
        }

        for (let val in startTimes) {
            cal.LOG("[calExtract] Start: " + JSON.stringify(startTimes[val]));
        }

        let guess = {};
        let wDayInit = startTimes.filter(function(val) val.day != null && val.start === undefined);

        // with tasks we don't try to guess start but assume email date
        if (isTask) {
            guess.year = wDayInit[0].year;
            guess.month = wDayInit[0].month;
            guess.day = wDayInit[0].day;
            guess.hour = wDayInit[0].hour;
            guess.minute = wDayInit[0].minute;
            return guess;
        }

        let wDay = startTimes.filter(function(val) val.day != null && val.start !== undefined);
        let wDayNA = wDay.filter(function(val) val.ambiguous === undefined);

        let wMinute = startTimes.filter(function(val) val.minute != null && val.start !== undefined);
        let wMinuteNA = wMinute.filter(function(val) val.ambiguous === undefined);
        let wMinuteInit = startTimes.filter(function(val) val.minute != null && val.start === undefined);

        if (wMinuteNA.length != 0) {
            guess.hour = wMinuteNA[0].hour;
            guess.minute = wMinuteNA[0].minute;
        } else if (wMinute.length != 0) {
            guess.hour = wMinute[0].hour;
            guess.minute = wMinute[0].minute;
        }

        // first use unambiguous guesses
        if (wDayNA.length != 0) {
            guess.year = wDayNA[0].year;
            guess.month = wDayNA[0].month;
            guess.day = wDayNA[0].day;
        // then also ambiguous ones
        } else if (wDay.length != 0) {
            guess.year = wDay[0].year;
            guess.month = wDay[0].month;
            guess.day = wDay[0].day;
        // next possible day considering time
        } else if (guess.hour != null &&
                      (wDayInit[0].hour > guess.hour ||
                          (wDayInit[0].hour == guess.hour &&
                           wDayInit[0].minute > guess.minute))) {
            let nextDay = new Date(wDayInit[0].year, wDayInit[0].month - 1, wDayInit[0].day);
            nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
            guess.year = nextDay.getFullYear();
            guess.month = nextDay.getMonth() + 1;
            guess.day = nextDay.getDate();
        // and finally when nothing was found then use initial guess from send time
        } else {
            guess.year = wDayInit[0].year;
            guess.month = wDayInit[0].month;
            guess.day = wDayInit[0].day;
        }

        cal.LOG("[calExtract] Start picked: " + JSON.stringify(guess));
        return guess;
    },

    /**
    * Guesses end time from list of guessed datetimes relative to start time
    *
    * @param start     start time to consider when guessing
    * @param isTask    whether start time should be guessed for task or event
    * @return          datetime object for end time
    */
    guessEnd: function guessEnd(start, isTask) {
        let guess = {};
        let endTimes = this.collected.filter(function(val) val.relation == "end");
        let durations = this.collected.filter(function(val) val.relation == "duration");
        if (endTimes.length == 0 && durations.length == 0) {
            return {};
        } else {
            for (val in endTimes) {
                cal.LOG("[calExtract] End: " + JSON.stringify(endTimes[val]));
            }

            let wDay = endTimes.filter(function(val) val.day != null);
            let wDayNA = wDay.filter(function(val) val.ambiguous === undefined);
            let wMinute = endTimes.filter(function(val) val.minute != null);
            let wMinuteNA = wMinute.filter(function(val) val.ambiguous === undefined);

            // first set non-ambiguous dates
            let pos = isTask == true ? 0 : wDayNA.length - 1;
            if (wDayNA.length != 0) {
                guess.year = wDayNA[pos].year;
                guess.month = wDayNA[pos].month;
                guess.day = wDayNA[pos].day;
            // then ambiguous dates
            } else if (wDay.length != 0) {
                pos = isTask == true ? 0 : wDay.length - 1;
                guess.year = wDay[pos].year;
                guess.month = wDay[pos].month;
                guess.day = wDay[pos].day;
            }

            // then non-ambiguous times
            if (wMinuteNA.length != 0) {
                pos = isTask == true ? 0 : wMinuteNA.length - 1;
                guess.hour = wMinuteNA[pos].hour;
                guess.minute = wMinuteNA[pos].minute;
                if (guess.day == null || guess.day == start.day) {
                    if (wMinuteNA[pos].hour < start.hour ||
                           (wMinuteNA[pos].hour == start.hour &&
                            wMinuteNA[pos].minute < start.minute)) {
                        let nextDay = new Date(start.year, start.month - 1, start.day);
                        nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
                        guess.year = nextDay.getFullYear();
                        guess.month = nextDay.getMonth() + 1;
                        guess.day = nextDay.getDate();
                    }
                }
            // and ambiguous times
            } else if (wMinute.length != 0) {
                pos = isTask == true ? 0 : wMinute.length - 1;
                guess.hour = wMinute[pos].hour;
                guess.minute = wMinute[pos].minute;
                if (guess.day == null || guess.day == start.day) {
                    if (wMinute[pos].hour < start.hour ||
                           (wMinute[pos].hour == start.hour &&
                            wMinute[pos].minute < start.minute)) {
                        let nextDay = new Date(start.year, start.month - 1, start.day);
                        nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
                        guess.year = nextDay.getFullYear();
                        guess.month = nextDay.getMonth() + 1;
                        guess.day = nextDay.getDate();
                    }
                }
            }

            // fill in date when time was guessed
            if (guess.minute != null && guess.day == null) {
                guess.year = start.year;
                guess.month = start.month;
                guess.day = start.day;
            }

            // fill in end from total duration
            if (guess.day == null && guess.hour == null) {
                let duration = 0;

                for (val in durations) {
                    duration += durations[val].duration;
                    cal.LOG("[calExtract] Dur: " + JSON.stringify(durations[val]));
                }

                if (duration != 0) {
                    let startDate = new Date(start.year, start.month - 1, start.day);
                    if (start.hour != null) {
                        startDate.setHours(start.hour);
                        startDate.setMinutes(start.minute);
                    } else {
                        startDate.setHours(0);
                        startDate.setMinutes(0);
                    }

                    let endTime = new Date(startDate.getTime() + duration * 60 * 1000);
                    guess.year = endTime.getFullYear();
                    guess.month = endTime.getMonth() + 1;
                    guess.day = endTime.getDate();
                    if (!(endTime.getHours() == 0 && endTime.getMinutes() == 0)) {
                        guess.hour = endTime.getHours()
                        guess.minute = endTime.getMinutes();
                    }
                }
            }

            // no zero length events/tasks
            if (guess.year == start.year && guess.month == start.month &&
                guess.day == start.day && guess.hour == start.hour &&
                guess.minute == start.minute) {
                guess.year = null;
                guess.month = null;
                guess.day = null;
                guess.hour = null;
                guess.minute = null;
            }

            if (guess.year != null && guess.minute == null && isTask) {
                guess.hour = 0;
                guess.minute = 0;
            }

            cal.LOG("[calExtract] End picked: " + JSON.stringify(guess));
            return guess;
        }
    },

    getPatterns: function getPatterns(name) {
        let value;
        // this should never be found in an email
        let def = "061dc19c-719f-47f3-b2b5-e767e6f02b7a";
        try {
            value = this.bundle.GetStringFromName(name);
            if (value.trim() == "") {
                cal.LOG("[calExtract] Pattern not found: " + name);
                return def;
            }

            let vals = this.cleanPatterns(value).split("|");
            if (this.overrides[name] !== undefined &&
                this.overrides[name]["add"] !== undefined) {
                let additions = this.overrides[name]["add"];
                additions = this.cleanPatterns(additions).split("|");
                for (let pattern in additions) {
                    vals.push(additions[pattern]);
                    cal.LOG("[calExtract] Added " + additions[pattern] + " to " + name);
                }
            }

            if (this.overrides[name] !== undefined &&
                this.overrides[name]["remove"] !== undefined) {
                let removals = this.overrides[name]["remove"];
                removals = this.cleanPatterns(removals).split("|");
                for (let pattern in removals) {
                    let idx = vals.indexOf(removals[pattern]);
                    if (idx != -1) {
                        vals.splice(idx, 1);
                        cal.LOG("[calExtract] Removed " + removals[pattern] + " from " + name);
                    }
                }
            }

            vals.sort(function(one, two) {return two.length - one.length;});
            return vals.join("|");
        } catch (ex) {
            cal.LOG("[calExtract] Pattern not found: " + name);

            // fake a value to avoid empty regexes creating endless loops
            return def;
        }
    },

    getRepPatterns: function getRepPatterns(name, replaceables) {
        let alts = new Array();
        let patterns = new Array();

        try {
            let value = this.bundle.GetStringFromName(name);
            if (value.trim() == "") {
                cal.LOG("[calExtract] Pattern empty: " + name);
                return alts;
            }

            let vals = this.cleanPatterns(value).split("|");
            if (this.overrides[name] !== undefined &&
                this.overrides[name]["add"] !== undefined) {
                let additions = this.overrides[name]["add"];
                additions = this.cleanPatterns(additions).split("|");
                for (let pattern in additions) {
                    vals.push(additions[pattern]);
                    cal.LOG("[calExtract] Added " + additions[pattern] + " to " + name);
                }
            }

            if (this.overrides[name] !== undefined &&
                this.overrides[name]["remove"] !== undefined) {
                let removals = this.overrides[name]["remove"];
                removals = this.cleanPatterns(removals).split("|");
                for (let pattern in removals) {
                    let idx = vals.indexOf(removals[pattern]);
                    if (idx != -1) {
                        vals.splice(idx, 1);
                        cal.LOG("[calExtract] Removed " + removals[pattern] + " from " + name);
                    }
                }
            }

            vals.sort(function(one, two) {return two.length - one.length;});
            for (let val in vals) {
                let pattern = vals[val];
                let cnt = 1;
                for (let replaceable in replaceables) {
                    pattern = pattern.replace("%" + cnt + "$S", replaceables[cnt - 1], "g");
                    cnt++;
                }
                patterns.push(pattern);
            }

            for (let val in vals) {
                let positions = new Array();
                if (replaceables.length == 1) {
                    positions[1] = 1;
                } else {
                    positions = this.getPositionsFor(vals[val], name, replaceables.length);
                }
                alts[val] = {pattern: patterns[val], positions: positions};
            }
        } catch (ex) {
            cal.LOG("[calExtract] Pattern not found: " + name);
        }
        return alts;
    },

    getPositionsFor: function getPositionsFor(s, name, count) {
        let positions = new Array();
        let re = /\%(\d)\$S/g;
        let match;
        let i = 0;
        while (match = re.exec(s)) {
            i++;
            positions[parseInt(match[1], 10)] = i;
        }

        // correctness checking
        for (i = 1; i <= count; i++) {
            if (positions[i] === undefined) {
                Components.utils.reportError("[calExtract] Faulty extraction pattern " + name +
                                             ", missing parameter %" + i + "$S");
            }
        }
        return positions;
    },

    cleanPatterns: function cleanPatterns(pattern) {
        // remove whitespace around | if present
        let value = pattern.replace(/\s*\|\s*/g, "|");
        // allow matching for patterns with missing or excessive whitespace
        return value.replace(/\s+/g, "\\s*").sanitize();
    },

    isValidYear: function isValidYear(year) {
        return (year >= 2000  && year <= 2050);
    },

    isValidMonth: function isValidMonth(month) {
        return (month >= 1 && month <= 12);
    },

    isValidDay: function isValidDay(day) {
        return (day >= 1 && day <= 31);
    },

    isValidHour: function isValidHour(hour) {
        return (hour >= 0 && hour <= 23);
    },

    isValidMinute: function isValidMinute(minute) {
        return (minute >= 0 && minute <= 59);
    },

    isPastDate: function isPastDate(date, refDate) {
        // avoid changing original refDate
        let refDate = new Date(refDate.getTime());
        refDate.setHours(0);
        refDate.setMinutes(0);
        refDate.setSeconds(0);
        refDate.setMilliseconds(0);
        let jsDate;
        if (date.day != null) {
            jsDate = new Date(date.year, date.month - 1, date.day);
        }
        return jsDate < refDate;
    },

    normalizeHour: function normalizeHour(hour) {
        if (hour < this.dayStart && hour <= 11) {
            return hour + 12;
        }
        return hour;
    },

    normalizeYear: function normalizeYear(year) {
        return (year.length == 2) ? "20" + year : year;
    },

    limitNums: function limitNums(res, email) {
        let pattern = email.substring(res.index, res.index + res[0].length);
        let before = email.charAt(res.index - 1);
        let after = email.charAt(res.index + res[0].length);
        let result = (/\d/.exec(before) && /\d/.exec(pattern.charAt(0))) ||
                     (/\d/.exec(pattern.charAt(pattern.length - 1)) && /\d/.exec(after));
        return result != null;
    },

    limitChars: function limitChars(res, email) {
        let alphabet = this.getPatterns("alphabet");
        // for languages without regular alphabet surrounding characters are ignored
        if (alphabet == "") {
            return false;
        }

        let pattern = email.substring(res.index, res.index + res[0].length);
        let before = email.charAt(res.index - 1);
        let after = email.charAt(res.index + res[0].length);

        let w = new RegExp("[" + alphabet + "]");
        let result = (w.exec(before) && w.exec(pattern.charAt(0))) ||
                     (w.exec(pattern.charAt(pattern.length - 1)) && w.exec(after));
        return result != null;
    },

    prefixSuffixStartEnd: function prefixSuffixStart(res, relation, email) {
        let pattern = email.substring(res.index, res.index + res[0].length);
        let prev = email.substring(0, res.index);
        let next = email.substring(res.index + res[0].length);
        let prefixSuffix = {start: res.index, end: res.index + res[0].length,
                            pattern: pattern, relation: relation};
        let ch = "\\s*";
        let res;

        let re = new RegExp("(" + this.getPatterns("end.prefix") + ")" + ch + "$", "ig");
        if ((res = re.exec(prev)) != null) {
            prefixSuffix.relation = "end";
            prefixSuffix.start = res.index;
            prefixSuffix.pattern = res[0] + pattern;
        }

        re = new RegExp("^" + ch + "(" + this.getPatterns("end.suffix") + ")", "ig");
        if ((res = re.exec(next)) != null) {
            prefixSuffix.relation = "end";
            prefixSuffix.end = prefixSuffix.end + res[0].length;
            prefixSuffix.pattern = pattern + res[0];
        }

        re = new RegExp("(" + this.getPatterns("start.prefix") + ")" + ch + "$", "ig");
        if ((res = re.exec(prev)) != null) {
            prefixSuffix.relation = "start";
            prefixSuffix.start = res.index;
            prefixSuffix.pattern = res[0] + pattern;
        }

        re = new RegExp("^" + ch + "(" + this.getPatterns("start.suffix") + ")", "ig");
        if ((res = re.exec(next)) != null) {
            prefixSuffix.relation = "start";
            prefixSuffix.end = prefixSuffix.end + res[0].length;
            prefixSuffix.pattern = pattern + res[0];
        }

        re = new RegExp("\\s(" + this.getPatterns("no.datetime.prefix") + ")" + ch + "$", "ig");

        if ((res = re.exec(prev)) != null) {
            prefixSuffix.relation = "notadatetime";
        }

        re = new RegExp("^" + ch + "(" + this.getPatterns("no.datetime.suffix") + ")", "ig");
        if ((res = re.exec(next)) != null) {
            prefixSuffix.relation = "notadatetime";
        }

        return prefixSuffix;
    },

    parseNumber: function parseNumber(number, numbers) {
        let r = parseInt(number, 10);
        if (isNaN(r)) {
            for (let i = 0; i <= 31; i++) {
                let ns = numbers[i].split("|");
                if (ns.indexOf(number.toLowerCase()) != -1) {
                    return i;
                }
            }
            return -1;
        } else {
            return r;
        }
    },

    guess: function guess(year, month, day, hour, minute, start, end, str,
                          relation, pattern, ambiguous) {
        let guess = {year: year, month: month, day: day, hour: hour, minute: minute,
                     start: start, end: end, str: str, relation: relation,
                     pattern: pattern, ambiguous: ambiguous};
        // past dates are kept for containment checks
        if (this.isPastDate(guess, this.now)) {
            guess.relation = "notadatetime";
        }
        this.collected.push(guess);
    }
};

// XXX should replace all special characters for regexp not just .
String.prototype.sanitize = function() {
    let res = this.replace(/([^\\])([\.])/g, "$1\\$2");
    return res;
}

String.prototype.unescape = function() {
    let res = this.replace(/\\([\.])/g, "$1");
    return res;
}
