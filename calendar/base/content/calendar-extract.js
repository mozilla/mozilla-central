/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calExtract.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

let calendarExtract = {
    onShowLocaleMenu: function onShowLocaleMenu(target) {
        let localeList = document.getElementById(target.id);
        let langs = new Array();
        let chrome = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                               .getService(Components.interfaces.nsIXULChromeRegistry);
        chrome.QueryInterface(Components.interfaces.nsIToolkitChromeRegistry);
        let locales = chrome.getLocalesForPackage("calendar");
        let langRegex = /^((..)-*(.*))$/;

        while (locales.hasMore()) {
            let localeParts = langRegex.exec(locales.getNext());
            let langName = localeParts[2];

            try {
                langName = cal.calGetString("languageNames", langName, null, "global");
            } catch (ex) {}

            let label = cal.calGetString("calendar", "extractUsing", [langName]);
            if (localeParts[3] != "") {
                label = cal.calGetString("calendar", "extractUsingRegion", [langName, localeParts[3]]);
            }

            langs.push([label, localeParts[1]]);
        }

        // sort
        let pref = "calendar.patterns.last.used.languages";
        let lastUsedLangs = cal.getPrefSafe(pref, "");

        function createLanguageComptor(lastUsedLangs) {
            return function compare(a, b) {
                let idx_a = lastUsedLangs.indexOf(a[1]);
                let idx_b = lastUsedLangs.indexOf(b[1]);

                if (idx_a == -1 && idx_b == -1) {
                    return a[0].localeCompare(b[0]);
                } else if (idx_a != -1 && idx_b != -1) {
                    return idx_a - idx_b;
                } else if (idx_a != -1) {
                    return -1;
                } else {
                    return 1;
                }
            }
        }

        langs.sort(createLanguageComptor(lastUsedLangs));
        removeChildren(localeList);

        for (let lang of langs) {
            addMenuItem(localeList, lang[0], lang[1], null);
        }
    },

    extractWithLocale: function extractWithLocale(event, isEvent) {
        event.stopPropagation();
        let locale = event.target.value;
        this.extractFromEmail(isEvent, true, locale);
    },

    extractFromEmail: function extractFromEmail(isEvent, fixedLang, fixedLocale) {
        // TODO would be nice to handle multiple selected messages,
        // though old conversion functionality didn't
        let message = gFolderDisplay.selectedMessage;
        let messenger = Components.classes["@mozilla.org/messenger;1"]
                                  .createInstance(Components.interfaces.nsIMessenger);
        let listener = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
                                 .createInstance(Components.interfaces.nsISyncStreamListener);
        let uri = message.folder.getUriForMsg(message);
        messenger.messageServiceFromURI(uri)
                 .streamMessage(uri, listener, null, null, false, "");
        let folder = message.folder;
        let title = message.mime2DecodedSubject;
        let content = folder.getMsgTextFromStream(listener.inputStream,
                                                  message.Charset,
                                                  65536,
                                                  32768,
                                                  false,
                                                  true,
                                                  { });
        cal.LOG("[calExtract] Original email content: \n" + title + "\r\n" + content);
        let date = new Date(message.date/1000);
        let time = (new Date()).getTime();

        let locale = cal.getPrefSafe("general.useragent.locale", "en-US");
        let baseUrl = "jar:resource://calendar/chrome/calendar-LOCALE.jar!/locale/LOCALE/calendar/calendar-extract.properties";
        let dayStart = cal.getPrefSafe("calendar.view.daystarthour", 6);
        let extractor;

        if (fixedLang) {
            extractor = new Extractor(baseUrl, fixedLocale, dayStart);
        } else {
            extractor = new Extractor(baseUrl, locale, dayStart, false);
        }

        let item;
        item = isEvent ? cal.createEvent() : cal.createTodo();
        item.title = message.mime2DecodedSubject;
        item.calendar = getSelectedCalendar();
        item.setProperty("DESCRIPTION", content);
        cal.setDefaultStartEndHour(item);
        cal.alarms.setDefaultValues(item);
        let sel = GetMessagePaneFrame().getSelection();
        let collected = extractor.extract(title, content, date, sel);

        // if we only have email date then use default start and end
        if (collected.length == 1) {
            cal.LOG("[calExtract] Date and time information was not found in email/selection.");
            createEventWithDialog(null, null, null, null, item);
        } else {
            let guessed = extractor.guessStart(!isEvent);
            let endGuess = extractor.guessEnd(guessed, !isEvent);
            let allDay = (guessed.hour == null || guessed.minute == null) && isEvent;

            if (isEvent) {
                if (guessed.year != null) {
                    item.startDate.year = guessed.year;
                }
                if (guessed.month != null) {
                    item.startDate.month = guessed.month - 1;
                }
                if (guessed.day != null) {
                    item.startDate.day = guessed.day;
                }
                if (guessed.hour != null) {
                    item.startDate.hour = guessed.hour;
                }
                if (guessed.minute != null) {
                    item.startDate.minute = guessed.minute;
                }

                item.endDate = item.startDate.clone();
                item.endDate.minute += cal.getPrefSafe("calendar.event.defaultlength", 60);

                if (endGuess.year != null) {
                    item.endDate.year = endGuess.year;
                }
                if (endGuess.month != null) {
                    item.endDate.month = endGuess.month - 1;
                }
                if (endGuess.day != null) {
                    item.endDate.day = endGuess.day;
                    if (allDay) {
                        item.endDate.day++;
                    }
                }
                if (endGuess.hour != null) {
                    item.endDate.hour = endGuess.hour;
                }
                if (endGuess.minute != null) {
                    item.endDate.minute = endGuess.minute;
                }
            } else {
                let dtz = cal.calendarDefaultTimezone();
                let dueDate = new Date();
                // set default
                dueDate.setHours(0);
                dueDate.setMinutes(0);
                dueDate.setSeconds(0);

                if (endGuess.year != null) {
                    dueDate.setYear(endGuess.year);
                }
                if (endGuess.month  != null) {
                    dueDate.setMonth(endGuess.month - 1);
                }
                if (endGuess.day != null) {
                    dueDate.setDate(endGuess.day);
                }
                if (endGuess.hour != null) {
                    dueDate.setHours(endGuess.hour);
                }
                if (endGuess.minute != null) {
                    dueDate.setMinutes(endGuess.minute);
                }

                setItemProperty(item, "entryDate", cal.jsDateToDateTime(date, dtz));
                if (endGuess.year != null) {
                    setItemProperty(item, "dueDate", cal.jsDateToDateTime(dueDate, dtz));
                }
            }

            // if time not guessed set allday for events
            if (allDay) {
                createEventWithDialog(null, null, null, null, item, true);
            } else {
                createEventWithDialog(null, null, null, null, item);
            }
        }

        let timeSpent = (new Date()).getTime() - time;
        cal.LOG("[calExtract] Total time spent for conversion (including loading of dictionaries): " + timeSpent + "ms");
    },

    addListeners: function addListeners() {
        if (window.top.document.location == "chrome://messenger/content/messenger.xul") {
            // covers initial load and folder change
            let folderTree = document.getElementById("folderTree");
            folderTree.addEventListener("select", this.setState, false);

            // covers selection change in a folder
            let msgTree = window.top.GetThreadTree();
            msgTree.addEventListener("select", this.setState, false);
        }
    },

    setState: function setState() {
        let eventButton = document.getElementById("extractEventButton");
        let taskButton = document.getElementById("extractTaskButton");
        let hdrEventButton = document.getElementById("hdrExtractEventButton");
        let hdrTaskButton = document.getElementById("hdrExtractTaskButton");
        let contextMenu = document.getElementById("mailContext-calendar-convert-menu");
        let state = (gFolderDisplay.selectedCount == 0);
        let contextState = state;
        let newEvent = document.getElementById("calendar_new_event_command");
        if (newEvent.getAttribute("disabled") == "true") {
            state = true;
        }
        if (eventButton)
            eventButton.disabled = state
        if (taskButton)
            taskButton.disabled = state;
        if (hdrEventButton)
            hdrEventButton.disabled = state;
        if (hdrTaskButton)
            hdrTaskButton.disabled = state;
        contextMenu.disabled = contextState;
    }
};

calendarExtract.addListeners();
