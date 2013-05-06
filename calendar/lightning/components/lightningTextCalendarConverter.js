/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calXMLUtils.jsm");
Components.utils.import("resource://calendar/modules/calRecurrenceUtils.jsm");

function ltnMimeConverter() {
    this.wrappedJSObject = this;
}

const ltnMimeConverterClassID = Components.ID("{c70acb08-464e-4e55-899d-b2c84c5409fa}");
const ltnMimeConverterInterfaces = [Components.interfaces.nsISimpleMimeConverter];
ltnMimeConverter.prototype = {
    classID: ltnMimeConverterClassID,
    QueryInterface: XPCOMUtils.generateQI(ltnMimeConverterInterfaces),

    classInfo: XPCOMUtils.generateCI({
        classID: ltnMimeConverterClassID,
        contractID: "@mozilla.org/lightning/mime-converter;1",
        classDescription: "Lightning text/calendar handler",
        interfaces: ltnMimeConverterInterfaces
    }),

    /**
     * Append the text to node, converting contained URIs to <a> links.
     *
     * @param text      The text to convert.
     * @param node      The node to append the text to.
     */
    linkifyText: function linkifyText(text, node) {
        let doc = node.ownerDocument;
        let localText = text;

        // XXX This should be improved to also understand abbreviated urls, could be
        // extended to only linkify urls that have an internal protocol handler, or
        // have an external protocol handler that has an app assigned. The same
        // could be done for mailto links which are not handled here either.

        // XXX Ideally use mozITXTToHTMLConv here, but last time I tried it didn't work.

        while (localText.length) {
            let pos = localText.search(/(^|\s+)([a-zA-Z0-9]+):\/\/[^\s]+/);
            if (pos == -1) {
                node.appendChild(doc.createTextNode(localText));
                break;
            }
            pos += localText.substr(pos).match(/^\s*/)[0].length;
            let endPos = pos + localText.substr(pos).search(/([.!,<>(){}]+)?(\s+|$)/);
            let url = localText.substr(pos, endPos - pos);

            if (pos > 0) {
                node.appendChild(doc.createTextNode(localText.substr(0, pos)));
            }
            let a = doc.createElement("a");
            a.setAttribute("href", url);
            a.textContent = url;

            node.appendChild(a);

            localText = localText.substr(endPos);
        }
    },

    /**
     * Returns a header title for an ITIP item depending on the response method
     * @param       aItipItem  the event
     * @return string the header title
     */
    getItipHeader: function getItipHeader(aItipItem) {
        let header;

        if (aItipItem) {
            let item = aItipItem.getItemList({})[0];
            let summary = item.getProperty("SUMMARY") || "";
            let organizer = item.organizer;
            let organizerString = organizer.toString();
            if (organizer.commonName) {
                organizerString = organizer.commonName;
            }

            switch (aItipItem.responseMethod) {
                case "REQUEST":
                    header = cal.calGetString("lightning",
                                              "itipRequestBody",
                                              [organizerString, summary],
                                              "lightning");
                    break;
                case "CANCEL":
                    header = cal.calGetString("lightning",
                                              "itipCancelBody",
                                              [organizerString, summary],
                                              "lightning");
                    break;
                case "REPLY": {
                    // This is a reply received from someone else, there should
                    // be just one attendee, the attendee that replied. If
                    // there is more than one attendee, just take the first so
                    // code doesn't break here.
                    let attendees = item.getAttendees({});
                    if (attendees && attendees.length >= 1) {
                        let sender = attendees[0];
                        let statusString = (sender.participationStatus == "DECLINED" ?
                                            "itipReplyBodyDecline" :
                                            "itipReplyBodyAccept");

                        header = cal.calGetString("lightning",
                                                  statusString,
                                                  [sender.toString()],
                                                  "lightning");
                    } else {
                        header = "";
                    }
                    break;
                }
            }
        }

        if (!header) {
            header = cal.calGetString("lightning", "imipHtml.header", null, "lightning");
        }

        return header;
    },

    /**
     * Returns the html representation of the event as a DOM document.
     *
     * @param event         The calIItemBase to parse into html.
     * @param aNewItipItem  The parsed itip item.
     * @return              The DOM document with values filled in.
     */
    createHtml: function createHtml(event, aNewItipItem) {
        // Creates HTML using the Node strings in the properties file
        let doc = cal.xml.parseFile("chrome://lightning/content/lightning-invitation.xhtml");
        let formatter = cal.getDateFormatter();

        let self = this;
        function field(field, contentText, linkify) {
            let descr = doc.getElementById("imipHtml-" + field + "-descr");
            if (descr) {
                let labelText = cal.calGetString("lightning", "imipHtml." + field, null, "lightning");
                descr.textContent = labelText;
            }

            if (contentText) {
                let content = doc.getElementById("imipHtml-" + field + "-content");
                doc.getElementById("imipHtml-" + field + "-row").hidden = false;
                if (linkify) {
                    self.linkifyText(contentText, content);
                } else {
                    content.textContent = contentText;
                }
            }
        }

        // Simple fields
        let headerDescr = doc.getElementById("imipHtml-header-descr");
        if (headerDescr) {
            headerDescr.textContent = this.getItipHeader(aNewItipItem);
        }

        field("summary", event.title);
        field("location", event.getProperty("LOCATION"));

        let dateString = formatter.formatItemInterval(event);

        if (event.recurrenceInfo) {
            let kDefaultTimezone = cal.calendarDefaultTimezone();
            let startDate =  event.startDate;
            let endDate = event.endDate;
            startDate = startDate ? startDate.getInTimezone(kDefaultTimezone) : null;
            endDate = endDate ? endDate.getInTimezone(kDefaultTimezone) : null;
            let repeatString = recurrenceRule2String(event.recurrenceInfo, startDate,
                                                     endDate, startDate.isDate);
            if (repeatString) {
                dateString = repeatString;
            }

            let formattedExDates = [];
            let modifiedOccurrences = [];
            function dateComptor(a,b) a.startDate.compare(b.startDate);

            // Show removed instances
            for each (let exc in event.recurrenceInfo.getRecurrenceItems({})) {
                if (exc instanceof Components.interfaces.calIRecurrenceDate) {
                    if (exc.isNegative) {
                        // This is an EXDATE
                        formattedExDates.push(formatter.formatDateTime(exc.date));
                    } else {
                        // This is an RDATE, close enough to a modified occurrence
                        let excItem = event.recurrenceInfo.getOccurrenceFor(exc.date);
                        cal.binaryInsert(modifiedOccurrences, excItem, dateComptor, true)
                    }
                }
            }
            if (formattedExDates.length > 0) {
                field("canceledOccurrences", formattedExDates.join("\n"));
            }

            // Show modified occurrences
            for each (let recurrenceId in event.recurrenceInfo.getExceptionIds({})) {
                let exc = event.recurrenceInfo.getExceptionFor(recurrenceId);
                let excLocation = exc.getProperty("LOCATION");

                // Only show modified occurrence if start, duration or location
                // has changed.
                if (exc.startDate.compare(exc.recurrenceId) != 0 ||
                    exc.duration.compare(event.duration) != 0 ||
                    excLocation != event.getProperty("LOCATION")) {
                    cal.binaryInsert(modifiedOccurrences, exc, dateComptor, true)
                }
            }

            function stringifyOcc(occ) {
                let formattedExc = formatter.formatItemInterval(occ);
                let occLocation = occ.getProperty("LOCATION");
                if (occLocation != event.getProperty("LOCATION")) {
                    let location = cal.calGetString("lightning", "imipHtml.newLocation", [occLocation], "lightning");
                    formattedExc += " (" + location + ")";
                }
                return formattedExc;
            }

            if (modifiedOccurrences.length > 0) {
                field("modifiedOccurrences", modifiedOccurrences.map(stringifyOcc).join("\n"));
            }
        }

        field("when", dateString);
        field("comment", event.getProperty("COMMENT"), true);

        // DESCRIPTION field
        let eventDescription = (event.getProperty("DESCRIPTION") || "")
                                    /* Remove the useless "Outlookism" squiggle. */
                                    .replace("*~*~*~*~*~*~*~*~*~*", "");
        field("description", eventDescription, true);

        // ATTENDEE and ORGANIZER fields
        let attendees = event.getAttendees({});
        let attendeeTemplate = doc.getElementById("attendee-template");
        let attendeeTable = doc.getElementById("attendee-table");
        let organizerTable = doc.getElementById("organizer-table");
        doc.getElementById("imipHtml-attendees-row").hidden = (attendees.length < 1);
        doc.getElementById("imipHtml-organizer-row").hidden = !event.organizer;

        function setupAttendee(attendee) {
            let row = attendeeTemplate.cloneNode(true);
            row.removeAttribute("id");
            row.removeAttribute("hidden");
            row.getElementsByClassName("status-icon")[0].setAttribute("status", attendee.participationStatus);
            row.getElementsByClassName("attendee-name")[0].textContent = attendee.toString();
            return row;
        }

        // Fill rows for attendees and organizer
        field("attendees");
        for each (let attendee in attendees) {
            attendeeTable.appendChild(setupAttendee(attendee));
        }

        field("organizer");
        if (event.organizer) {
            organizerTable.appendChild(setupAttendee(event.organizer));
        }

        return doc;
    },


    /* nsISimpleMimeConverter */

    uri: null,

    convertToHTML: function lmcCTH(contentType, data) {
        let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                               .createInstance(Components.interfaces.calIIcsParser);
        parser.parseString(data);
        let event = null;
        for each (let item in parser.getItems({})) {
            if (cal.isEvent(item)) {
                if (item.hasProperty("X-MOZ-FAKED-MASTER")) {
                    // if it's a faked master, take any overridden item to get a real occurrence:
                    let exc = item.recurrenceInfo.getExceptionFor(item.startDate);
                    cal.ASSERT(exc, "unexpected!");
                    if (exc) {
                        item = exc;
                    }
                }
                event = item;
                break;
            }
        }
        if (!event) {
            return '';
        }

        let itipItem = null;

        try {
            // this.uri is the message URL that we are processing.
            // We use it to get the nsMsgHeaderSink to store the calItipItem.
            if (this.uri) {
                let msgWindow = null;
                try {
                    let msgUrl = this.uri.QueryInterface(Components.interfaces.nsIMsgMailNewsUrl);
                    // msgWindow is optional in some scenarios
                    // (e.g. gloda in action, throws NS_ERROR_INVALID_POINTER then)
                    msgWindow = msgUrl.msgWindow;
                } catch (exc) {
                }
                if (msgWindow) {
                    itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                                             .createInstance(Components.interfaces.calIItipItem);
                    itipItem.init(data);

                    let sinkProps = msgWindow.msgHeaderSink.properties;
                    sinkProps.setPropertyAsInterface("itipItem", itipItem);

                    // Notify the observer that the itipItem is available
                    Services.obs.notifyObservers(null, "onItipItemCreation", 0);
                }
            }
        } catch (e) {
            cal.ERROR("[ltnMimeConverter] convertToHTML: " + e);
        }

        // Create the HTML string for display
        return cal.xml.serializeDOM(this.createHtml(event, itipItem));
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([ltnMimeConverter]);
