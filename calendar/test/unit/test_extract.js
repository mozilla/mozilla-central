/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calExtract.jsm");
var baseUrl = "jar:resource://calendar/chrome/calendar-LOCALE.jar!/locale/LOCALE/calendar/calendar-extract.properties";
var extractor = new Extractor(baseUrl, "en-US", 8);

function run_test() {
    test_event_start_end();
    test_event_start_duration();
    test_event_start_end_whitespace();
    test_event_without_date();
    test_event_next_year();
    test_task_due();
    test_overrides();
}

function test_event_start_end() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Wednesday meetup";
    let content = "We'll meet at 2 pm and discuss until 3 pm.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart();
    let endGuess = extractor.guessEnd(guessed);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 3);
    do_check_eq(guessed.hour, 14);
    do_check_eq(guessed.minute, 0);

    do_check_eq(endGuess.year, 2012);
    do_check_eq(endGuess.month, 10);
    do_check_eq(endGuess.day, 3);
    do_check_eq(endGuess.hour, 15);
    do_check_eq(endGuess.minute, 0);
}

function test_event_start_duration() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Wednesday meetup";
    let content = "We'll meet at 2 pm and discuss for 30 minutes.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart();
    let endGuess = extractor.guessEnd(guessed);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 3);
    do_check_eq(guessed.hour, 14);
    do_check_eq(guessed.minute, 0);

    do_check_eq(endGuess.year, 2012);
    do_check_eq(endGuess.month, 10);
    do_check_eq(endGuess.day, 3);
    do_check_eq(endGuess.hour, 14);
    do_check_eq(endGuess.minute, 30);
}

function test_event_start_end_whitespace() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Wednesday meetup";
    let content = "We'll meet at2pm and discuss until\r\n3pm.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart();
    let endGuess = extractor.guessEnd(guessed);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 3);
    do_check_eq(guessed.hour, 14);
    do_check_eq(guessed.minute, 0);

    do_check_eq(endGuess.year, 2012);
    do_check_eq(endGuess.month, 10);
    do_check_eq(endGuess.day, 3);
    do_check_eq(endGuess.hour, 15);
    do_check_eq(endGuess.minute, 0);
}

function test_event_without_date() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Meetup";
    let content = "We'll meet at 2 pm and discuss until 3 pm.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart();
    let endGuess = extractor.guessEnd(guessed);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 1);
    do_check_eq(guessed.hour, 14);
    do_check_eq(guessed.minute, 0);

    do_check_eq(endGuess.year, 2012);
    do_check_eq(endGuess.month, 10);
    do_check_eq(endGuess.day, 1);
    do_check_eq(endGuess.hour, 15);
    do_check_eq(endGuess.minute, 0);
}

function test_event_next_year() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Open day";
    let content = "FYI: Next open day is planned for February 5th.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart();
    let endGuess = extractor.guessEnd(guessed);

    do_check_eq(guessed.year, 2013);
    do_check_eq(guessed.month, 2);
    do_check_eq(guessed.day, 5);
    do_check_eq(guessed.hour, undefined);
    do_check_eq(guessed.minute, undefined);

    do_check_eq(endGuess.year, undefined);
    do_check_eq(endGuess.month, undefined);
    do_check_eq(endGuess.day, undefined);
    do_check_eq(endGuess.hour, undefined);
    do_check_eq(endGuess.minute, undefined);
}

function test_task_due() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Assignment deadline";
    let content = "This is a reminder that all assignments must be sent in by October 5th!.";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart(true);
    let endGuess = extractor.guessEnd(guessed, true);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 1);
    do_check_eq(guessed.hour, 9);
    do_check_eq(guessed.minute, 0);

    do_check_eq(endGuess.year, 2012);
    do_check_eq(endGuess.month, 10);
    do_check_eq(endGuess.day, 5);
    do_check_eq(endGuess.hour, 0);
    do_check_eq(endGuess.minute, 0);
}

function test_overrides() {
    let date = new Date(2012, 9, 1, 9, 0);
    let title = "Event invitation";
    let content = "We'll meet 10:11 worromot";

    let collected = extractor.extract(title, content, date, undefined);
    let guessed = extractor.guessStart(false);
    let endGuess = extractor.guessEnd(guessed, true);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 1);
    do_check_eq(guessed.hour, 10);
    do_check_eq(guessed.minute, 11);

    do_check_eq(endGuess.year, undefined);
    do_check_eq(endGuess.month, undefined);
    do_check_eq(endGuess.day, undefined);
    do_check_eq(endGuess.hour, undefined);
    do_check_eq(endGuess.minute, undefined);

    // recognize a custom "tomorrow" and hour.minutes pattern
    let overrides = {"from.hour.minutes":
                      {"add": "%2$S:%1$S", "remove": "%1$S:%2$S"},
                     "from.tomorrow":
                      {"add": "worromot"}};
    cal.setPref("calendar.patterns.override", JSON.stringify(overrides));

    collected = extractor.extract(title, content, date, undefined);
    guessed = extractor.guessStart(false);
    endGuess = extractor.guessEnd(guessed, true);

    do_check_eq(guessed.year, 2012);
    do_check_eq(guessed.month, 10);
    do_check_eq(guessed.day, 2);
    do_check_eq(guessed.hour, 11);
    do_check_eq(guessed.minute, 10);

    do_check_eq(endGuess.year, undefined);
    do_check_eq(endGuess.month, undefined);
    do_check_eq(endGuess.day, undefined);
    do_check_eq(endGuess.hour, undefined);
    do_check_eq(endGuess.minute, undefined);
}
