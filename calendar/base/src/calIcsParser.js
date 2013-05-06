/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function calIcsParser() {
    this.wrappedJSObject = this;
    this.mItems = new Array();
    this.mParentlessItems = new Array();
    this.mComponents = new Array();
    this.mProperties = new Array();
}
const calIcsParserClassID = Components.ID("{6fe88047-75b6-4874-80e8-5f5800f14984}");
const calIcsParserInterfaces = [Components.interfaces.calIIcsParser];
calIcsParser.prototype = {
    classID: calIcsParserClassID,
    QueryInterface: XPCOMUtils.generateQI(calIcsParserInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calIcsParserClassID,
        contractID: "@mozilla.org/calendar/ics-parser;1",
        classDescription: "Calendar ICS Parser",
        interfaces: calIcsParserInterfaces,
        flags: Components.interfaces.nsIClassInfo.THREADSAFE
    }),

    processIcalComponent: function ip_processIcalComponent(rootComp, aAsyncParsing) {
        let calComp;
        // libical returns the vcalendar component if there is just one vcalendar.
        // If there are multiple vcalendars, it returns an xroot component, with
        // vcalendar children. We need to handle both cases.
        if (rootComp) {
            if (rootComp.componentType == 'VCALENDAR') {
                calComp = rootComp;
            } else {
                calComp = rootComp.getFirstSubcomponent('VCALENDAR');
            }
        }

        if (!calComp) {
            cal.ERROR("Parser Error. Could not find 'VCALENDAR' component: \n" +
                      rootComp + "\nStack: \n" + cal.STACK(10));
        }

        let self = this;
        let state = new parserState(this, aAsyncParsing);

        while (calComp) {
            // Get unknown properties from the VCALENDAR
            this.mProperties = this.mProperties.concat(
                [ prop for (prop in cal.ical.propertyIterator(calComp))
                        if (prop.propertyName != "VERSION" &&
                            prop.propertyName != "PRODID") ]);

            for (let subComp in cal.ical.subcomponentIterator(calComp)) {
                state.submit(subComp);
            }
            calComp = rootComp.getNextSubcomponent("VCALENDAR");
        }

        state.join(function() {
            let fakedParents = {};
            // tag "exceptions", i.e. items with rid:
            for each (let item in state.excItems) {
                let parent = state.uid2parent[item.id];

                if (!parent) { // a parentless one, fake a master and override it's occurrence
                    parent = isEvent(item) ? createEvent() : createTodo();
                    parent.id = item.id;
                    parent.setProperty("DTSTART", item.recurrenceId);
                    parent.setProperty("X-MOZ-FAKED-MASTER", "1"); // this tag might be useful in the future
                    parent.recurrenceInfo = cal.createRecurrenceInfo(parent);
                    fakedParents[item.id] = true;
                    state.uid2parent[item.id] = parent;
                    state.items.push(parent);
                }
                if (item.id in fakedParents) {
                    let rdate = Components.classes["@mozilla.org/calendar/recurrence-date;1"]
                                          .createInstance(Components.interfaces.calIRecurrenceDate);
                    rdate.date = item.recurrenceId;
                    parent.recurrenceInfo.appendRecurrenceItem(rdate);
                    // we'll keep the parentless-API until we switch over using itip-process for import (e.g. in dnd code)
                    self.mParentlessItems.push(item);
                }

                parent.recurrenceInfo.modifyException(item, true);
            }

            if (Object.keys(state.tzErrors).length > 0) {
                // Use an alert rather than a prompt because problems may appear in
                // remote subscribed calendars the user cannot change.
                if (Components.classes["@mozilla.org/alerts-service;1"]) {
                    let notifier = Components.classes["@mozilla.org/alerts-service;1"]
                                             .getService(Components.interfaces.nsIAlertsService);
                    let title = calGetString("calendar", "TimezoneErrorsAlertTitle");
                    let text = calGetString("calendar", "TimezoneErrorsSeeConsole");
                    notifier.showAlertNotification("", title, text, false, null, null, title);
                }
            }

            // We are done, push the items to the parser and notify the listener
            self.mItems = self.mItems.concat(state.items);
            self.mComponents = self.mComponents.concat(state.extraComponents);

            if (aAsyncParsing) {
                aAsyncParsing.onParsingComplete(Components.results.NS_OK, self);
            }
        });
    },

    parseString: function ip_parseString(aICSString, aTzProvider, aAsyncParsing) {
        if (aAsyncParsing) {
            let self = this;

            let start = new Date();

            // We are using two types of very similar listeners here:
            // aAsyncParsing is a calIcsParsingListener that returns the ics
            //   parser containing the processed items.
            // The listener passed to parseICSAsync is a calICsComponentParsingListener
            //   required by the ics service, that receives the parsed root component.
            cal.getIcsService().parseICSAsync(aICSString, aTzProvider, {
                onParsingComplete: function(rc, rootComp) {
                    if (Components.isSuccessCode(rc)) {
                        self.processIcalComponent(rootComp, aAsyncParsing);
                    } else {
                        cal.ERROR("Error Parsing ICS: " + rc);
                        aAsyncParsing.onParsingComplete(rc, self);
                    }
                }
            });
        } else {
            this.processIcalComponent(cal.getIcsService().parseICS(aICSString, aTzProvider));
        }
    },

    parseFromStream: function ip_parseFromStream(aStream, aTzProvider, aAsyncParsing) {
        // Read in the string. Note that it isn't a real string at this point,
        // because likely, the file is utf8. The multibyte chars show up as multiple
        // 'chars' in this string. So call it an array of octets for now.

        let octetArray = [];
        let binaryIS = Components.classes["@mozilla.org/binaryinputstream;1"]
                                 .createInstance(Components.interfaces.nsIBinaryInputStream);
        binaryIS.setInputStream(aStream);
        octetArray = binaryIS.readByteArray(binaryIS.available());

        // Some other apps (most notably, sunbird 0.2) happily splits an UTF8
        // character between the octets, and adds a newline and space between them,
        // for ICS folding. Unfold manually before parsing the file as utf8.This is
        // UTF8 safe, because octets with the first bit 0 are always one-octet
        // characters. So the space or the newline never can be part of a multi-byte
        // char.
        for (let i = octetArray.length - 2; i >= 0; i--) {
            if (octetArray[i] == "\n" && octetArray[i+1] == " ") {
                octetArray = octetArray.splice(i, 2);
            }
        }

        // Interpret the byte-array as a UTF8-string, and convert into a
        // javascript string.
        let unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                         .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        // ICS files are always UTF8
        unicodeConverter.charset = "UTF-8";
        let stringData = unicodeConverter.convertFromByteArray(octetArray, octetArray.length);

        this.parseString(stringData, aTzProvider, aAsyncParsing);
    },

    getItems: function ip_getItems(aCount) {
        aCount.value = this.mItems.length;
        return this.mItems.concat([]); //clone
    },

    getParentlessItems: function ip_getParentlessItems(aCount) {
        aCount.value = this.mParentlessItems.length;
        return this.mParentlessItems.concat([]); //clone
    },

    getProperties: function ip_getProperties(aCount) {
        aCount.value = this.mProperties.length;
        return this.mProperties.concat([]); //clone
    },

    getComponents: function ip_getComponents(aCount) {
        aCount.value = this.mComponents.length;
        return this.mComponents.concat([]); //clone
    }
};

/**
 * The parser state, which helps process ical components without clogging up the
 * event queue.
 *
 * @param aParser       The parser that is using this state
 */
function parserState(aParser, aListener) {
    this.parser = aParser;
    this.listener = aListener;

    this.extraComponents = [];
    this.items = [];
    this.uid2parent = {};
    this.excItems = [];
    this.tzErrors = {};
}

parserState.prototype = {
    parser: null,
    joinFunc: null,
    threadCount: 0,

    extraComponents: null,
    items: null,
    uid2parent: null,
    excItems: null,
    tzErrors: null,
    listener: null,

    /**
     * Checks if the timezones are missing and notifies the user via error console
     *
     * @param item      The item to check for
     * @param dt        The datetime object to check with
     */
    checkTimezone: function checkTimezone(item, dt) {
        if (dt && cal.isPhantomTimezone(dt.timezone)) {
            let tzid = dt.timezone.tzid;
            let hid = item.hashId + "#" + tzid;
            if (!(hid in this.tzErrors)) {
                // For now, publish errors to console and alert user.
                // In future, maybe make them available through an interface method
                // so this UI code can be removed from the parser, and caller can
                // choose whether to alert, or show user the problem items and ask
                // for fixes, or something else.
                let msg = (calGetString("calendar", "unknownTimezoneInItem",
                                        [tzid, item.title, cal.getDateFormatter().formatDateTime(dt)]) +
                           "\n" + item.icalString);
                cal.ERROR(msg);
                this.tzErrors[hid] = true;
            }
        }
    },

    /**
     * Submit processing of a subcomponent to the event queue
     *
     * @param subComp       The component to process
     */
    submit: function submit(subComp) {
        let state = this;
        let runner = {
            run: function run() {
                let item = null;
                switch (subComp.componentType) {
                    case "VEVENT":
                        item = cal.createEvent();
                        item.icalComponent = subComp;
                        state.checkTimezone(item, item.startDate);
                        state.checkTimezone(item, item.endDate);
                        break;
                    case "VTODO":
                        item = cal.createTodo();
                        item.icalComponent = subComp;
                        state.checkTimezone(item, item.entryDate);
                        state.checkTimezone(item, item.dueDate);
                        // completed is defined to be in UTC
                        break;
                    case "VTIMEZONE":
                        // this should already be attached to the relevant
                        // events in the calendar, so there's no need to
                        // do anything with it here.
                        break;
                    default:
                        state.extraComponents.push(subComp);
                        break;
                }

                if (item) {
                    let rid = item.recurrenceId;
                    if (!rid) {
                        state.items.push(item);
                        if (item.recurrenceInfo) {
                            state.uid2parent[item.id] = item;
                        }
                    } else {
                        state.excItems.push(item);
                    }
                }
                state.threadCount--;
                state.checkCompletion();
            }
        };

        this.threadCount++;
        if (this.listener) {
            // If we have a listener, we are doing this asynchronously. Go ahead
            // and use the thread manager to dispatch the above runner
            Services.tm.currentThread.dispatch(runner, Components.interfaces.nsIEventTarget.DISPATCH_NORMAL);
        } else {
            // No listener means synchonous. Just run the runner instead
            runner.run();
        }
    },

    /**
     * Checks if the processing of all events has completed. If a join function
     * has been set, this function is called.
     *
     * @return      True, if all tasks have been completed
     */
    checkCompletion: function() {
        if (this.joinFunc && this.threadCount == 0) {
            this.joinFunc();
            return true;
        }
        return false;
    },

    /**
     * Sets a join function that is called when all tasks have been completed
     *
     * @param joinFunc      The join function to call
     */
    join: function join(joinFunc) {
        this.joinFunc = joinFunc;
        this.checkCompletion();
    }
};
