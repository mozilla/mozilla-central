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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Michiel van Leeuwen <mvl@exedo.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <mozilla@boelzle.org>
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

function calIcsParser() {
    this.wrappedJSObject = this;
    this.mItems = new Array();
    this.mParentlessItems = new Array();
    this.mComponents = new Array();
    this.mProperties = new Array();
}

var gIcsParserClassInfo = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIIcsParser,
            Components.interfaces.nsIClassInfo
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/ics-parser;1",
    classDescription: "Calendar ICS Parser",
    classID: Components.ID("{6fe88047-75b6-4874-80e8-5f5800f14984}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.THREADSAFE
};

calIcsParser.prototype.QueryInterface =
function ip_QueryInterface(aIID) {
    return doQueryInterface(this, calIcsParser.prototype, aIID, null, gIcsParserClassInfo);
};

calIcsParser.prototype.processIcalComponent =
function ip_processIcalComponent(rootComp) {
    let calComp;
    // libical returns the vcalendar component if there is just one vcalendar.
    // If there are multiple vcalendars, it returns an xroot component, with
    // those vcalendar children. We need to handle both.
    if (rootComp.componentType == 'VCALENDAR') {
        calComp = rootComp;
    } else {
        calComp = rootComp.getFirstSubcomponent('VCALENDAR');
    }

    let uid2parent = {};
    let excItems = [];
    let fakedParents = {};

    let tzErrors = {};
    function checkTimezone(item, dt) {
        if (dt && cal.isPhantomTimezone(dt.timezone)) {
            let tzid = dt.timezone.tzid;
            let hid = item.hashId + "#" + tzid;
            if (tzErrors[hid] === undefined) {
                // For now, publish errors to console and alert user.
                // In future, maybe make them available through an interface method
                // so this UI code can be removed from the parser, and caller can
                // choose whether to alert, or show user the problem items and ask
                // for fixes, or something else.
                let msg = (calGetString("calendar", "unknownTimezoneInItem",
                                        [tzid, item.title, cal.getDateFormatter().formatDateTime(dt)]) +
                           "\n" + item.icalString);
                cal.ERROR(msg);
                tzErrors[hid] = true;
            }
        }
    }

    while (calComp) {

        // Get unknown properties
        this.mProperties = [ prop for (prop in cal.ical.propertyIterator(calComp))
                                  if (prop.propertyName != "VERSION" &&
                                      prop.propertyName != "PRODID") ];

        let prodId = calComp.getFirstProperty("PRODID");
        let isFromOldSunbird = (prodId && prodId.value == "-//Mozilla.org/NONSGML Mozilla Calendar V1.0//EN");

        for (let subComp in cal.ical.subcomponentIterator(calComp)) {
            let item = null;
            switch (subComp.componentType) {
                case "VEVENT":
                    item = cal.createEvent();
                    item.icalComponent = subComp;
                    checkTimezone(item, item.startDate);
                    checkTimezone(item, item.endDate);
                    break;
                case "VTODO":
                    item = cal.createTodo();
                    item.icalComponent = subComp;
                    checkTimezone(item, item.entryDate);
                    checkTimezone(item, item.dueDate);
                    // completed is defined to be in UTC
                    break;
                case "VTIMEZONE":
                    // this should already be attached to the relevant
                    // events in the calendar, so there's no need to
                    // do anything with it here.
                    break;
                default:
                    this.mComponents.push(subComp);
                    break;
            }

            if (item) {
                // Only try to fix ICS from Sunbird 0.2 (and earlier) if it
                // has an EXDATE.
                hasExdate = subComp.getFirstProperty("EXDATE");
                if (isFromOldSunbird && hasExdate) {
                    item = fixOldSunbirdExceptions(item);
                }

                let rid = item.recurrenceId;
                if (!rid) {
                    this.mItems.push(item);
                    if (item.recurrenceInfo) {
                        uid2parent[item.id] = item;
                    }
                } else {
                    excItems.push(item);
                }
            }
        }
        calComp = rootComp.getNextSubcomponent("VCALENDAR");

        cal.processPendingEvent();
    }

    // tag "exceptions", i.e. items with rid:
    for each (let item in excItems) {
        let parent = uid2parent[item.id];

        if (!parent) { // a parentless one, fake a master and override it's occurrence
            parent = isEvent(item) ? createEvent() : createTodo();
            parent.id = item.id;
            parent.setProperty("DTSTART", item.recurrenceId);
            parent.setProperty("X-MOZ-FAKED-MASTER", "1"); // this tag might be useful in the future
            parent.recurrenceInfo = cal.createRecurrenceInfo(parent);
            fakedParents[item.id] = true;
            uid2parent[item.id] = parent;
            this.mItems.push(parent);
        }
        if (item.id in fakedParents) { 
            let rdate = Components.classes["@mozilla.org/calendar/recurrence-date;1"]
                                  .createInstance(Components.interfaces.calIRecurrenceDate);
            rdate.date = item.recurrenceId;
            parent.recurrenceInfo.appendRecurrenceItem(rdate);
            // we'll keep the parentless-API until we switch over using itip-process for import (e.g. in dnd code)
            this.mParentlessItems.push(item);
        }

        parent.recurrenceInfo.modifyException(item, true);

        cal.processPendingEvent();
    }
    
    for (let e in tzErrors) { // if any error has occurred
        // Use an alert rather than a prompt because problems may appear in
        // remote subscribed calendars the user cannot change.
        if (Components.classes["@mozilla.org/alerts-service;1"]) {
            let notifier = Components.classes["@mozilla.org/alerts-service;1"]
                                     .getService(Components.interfaces.nsIAlertsService);
            let title = calGetString("calendar", "TimezoneErrorsAlertTitle")
            let text = calGetString("calendar", "TimezoneErrorsSeeConsole");
            notifier.showAlertNotification("", title, text, false, null, null, title);
        }
        break;
    }
};

calIcsParser.prototype.parseString =
function ip_parseString(aICSString, aTzProvider, aAsyncParsing) {
    if (aAsyncParsing) {
        let this_ = this;
        let rootComp = null;
        // Do the actual ical parsing on a thread, but process the parsed ical
        // components on main/UI thread.
        cal.execWorker(
            function parseString_worker(responseThread) {
                rootComp = cal.getIcsService().parseICS(aICSString, aTzProvider);
            },
            function parseString_done(exc) {
                this_.processIcalComponent(rootComp);
                aAsyncParsing.onParsingComplete(exc ? exc.result : Components.results.NS_OK, this_);
            });
    } else {
        this.processIcalComponent(cal.getIcsService().parseICS(aICSString, aTzProvider));
    }
};

calIcsParser.prototype.parseFromStream =
function ip_parseFromStream(aStream, aTzProvider, aAsyncParsing) {
    function readString(aStream_) {
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
        for (var i = octetArray.length - 2; i >= 0; i--) {
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
        return unicodeConverter.convertFromByteArray(octetArray, octetArray.length);
    }

    if (aAsyncParsing) {
        let this_ = this;
        let rootComp = null;
        // Do the actual string reading and ical parsing on a athread, but process the parsed ical
        // components on main/UI thread.
        cal.execWorker(
            function parseString_worker(responseThread) {
                rootComp = cal.getIcsService().parseICS(readString(aStream), aTzProvider);
            },
            function parseString_done(exc) {
                this_.processIcalComponent(rootComp);
                aAsyncParsing.onParsingComplete(exc ? exc.result : Components.results.NS_OK, this_);
            });
    } else {
        this.processIcalComponent(cal.getIcsService().parseICS(readString(aStream), aTzProvider));
    }
}

calIcsParser.prototype.getItems =
function ip_getItems(aCount) {
    aCount.value = this.mItems.length;
    return this.mItems.concat([]); //clone
}

calIcsParser.prototype.getParentlessItems =
function ip_getParentlessItems(aCount) {
    aCount.value = this.mParentlessItems.length;
    return this.mParentlessItems.concat([]); //clone
}

calIcsParser.prototype.getProperties =
function ip_getProperties(aCount) {
    aCount.value = this.mProperties.length;
    return this.mProperties.concat([]); //clone
}

calIcsParser.prototype.getComponents =
function ip_getComponents(aCount) {
    aCount.value = this.mComponents.length;
    return this.mComponents.concat([]); //clone
}

// Helper function to deal with the busted exdates from Sunbird 0.2
// When Sunbird 0.2 (and earlier) creates EXDATEs, they are set to
// 00:00:00 floating rather than to the item's DTSTART. This fixes that.
// (bug 354073)
function fixOldSunbirdExceptions(aItem) {
    const kCalIRecurrenceDate = Components.interfaces.calIRecurrenceDate;

    var item = aItem;
    var ritems = aItem.recurrenceInfo.getRecurrenceItems({});
    for each (var ritem in ritems) {
        // EXDATEs are represented as calIRecurrenceDates, which are
        // negative and finite.
        if (calInstanceOf(ritem, kCalIRecurrenceDate) &&
            ritem.isNegative &&
            ritem.isFinite) {
            // Only mess with the exception if its time is wrong.
            var oldDate = aItem.startDate || aItem.entryDate;
            if (ritem.date.compare(oldDate) != 0) {
                var newRitem = ritem.clone();
                // All we want from aItem is the time and timezone.
                newRitem.date.timezone = oldDate.timezone;
                newRitem.date.hour     = oldDate.hour;
                newRitem.date.minute   = oldDate.minute;
                newRitem.date.second   = oldDate.second;
                item.recurrenceInfo.appendRecurrenceItem(newRitem);
                item.recurrenceInfo.deleteRecurrenceItem(ritem);
            }
        }
    }
    return item;
}
