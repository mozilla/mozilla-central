/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

function ltnMimeConverter() {
}

ltnMimeConverter.prototype = {
    classID: Components.ID("{c70acb08-464e-4e55-899d-b2c84c5409fa}"),

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISimpleMimeConverter]),

    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{c70acb08-464e-4e55-899d-b2c84c5409fa}"),
        contractID: "@mozilla.org/lightning/mime-converter;1",
        classDescription: "Lightning text/calendar handler",
        interfaces: [Components.interfaces.nsISimpleMimeConverter]
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
     * Synchronously read the given uri and return its xml document
     *
     * @param uri       The uri to read.
     * @return          The response DOM Document.
     */
    readChromeUri: function readChromeUri(uri) {
        let req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                            .createInstance(Components.interfaces.nsIXMLHttpRequest);

        req.open('GET', uri, false);
        req.overrideMimeType("text/xml");
        req.send(null);
        return req.responseXML;
    },

    /**
     * Returns the html representation of the event as a DOM document.
     *
     * @param event     The calIItemBase to parse into html.
     * @return          The DOM document with values filled in.
     */
    createHtml: function createHtml(event) {
        // Creates HTML using the Node strings in the properties file
        let doc = this.readChromeUri("chrome://lightning/content/lightning-invitation.xhtml");
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
        field("header", null);
        field("summary", event.title);
        field("location", event.getProperty("LOCATION"));
        field("when", cal.getDateFormatter().formatItemInterval(event));
        field("comment", event.getProperty("COMMENT"), true);

        // ORGANIZER field
        if (event.organizer && (event.organizer.commonName || event.organizer.id)) {
            // Trim any instances of "mailto:" for better readibility.
            let orgname = event.organizer.commonName ||
                          event.organizer.id.replace(/mailto:/ig, "");
            field("organizer", orgname);
        }

        // DESCRIPTION field
        let eventDescription = (event.getProperty("DESCRIPTION") || "")
                                    /* Remove the useless "Outlookism" squiggle. */
                                    .replace("*~*~*~*~*~*~*~*~*~*", "");
        field("description", eventDescription, true);

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
            return;
        }

        // Create the HTML string for display
        let serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
                                   .createInstance(Components.interfaces.nsIDOMSerializer);
        let html = serializer.serializeToString(this.createHtml(event));

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
                    let itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                                             .createInstance(Components.interfaces.calIItipItem);
                    itipItem.init(data);

                    let sinkProps = msgWindow.msgHeaderSink.properties;
                    sinkProps.setPropertyAsInterface("itipItem", itipItem);

                    // Notify the observer that the itipItem is available
                    let observer = Components.classes["@mozilla.org/observer-service;1"]
                                             .getService(Components.interfaces.nsIObserverService);
                    observer.notifyObservers(null, "onItipItemCreation", 0);
                }
            }
        } catch (e) {
            cal.ERROR("[ltnMimeConverter] convertToHTML: " + e);
        }

        return html;
    }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([ltnMimeConverter]);
