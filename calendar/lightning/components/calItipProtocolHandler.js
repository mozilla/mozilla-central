/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

const CI = Components.interfaces;

const ITIP_HANDLER_MIMETYPE = "application/x-itip-internal";
const ITIP_HANDLER_PROTOCOL = "moz-cal-handle-itip";


function NYI() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

function ItipChannel(URI) {
   this.URI = this.originalURI = URI;
}
const ItipChannelClassID = Components.ID("{643e0328-36f6-411d-a107-16238dff9cd7}");
const ItipChannelInterfaces = [
    Components.interfaces.nsIChannel,
    Components.interfaces.nsIRequest
];
ItipChannel.prototype = {
    classID: ItipChannelClassID,
    QueryInterface: XPCOMUtils.generateQI(ItipChannelInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: ItipChannelClassID,
        contractID: "@mozilla.org/calendar/itip-channel;1",
        classDescription: "Calendar Itip Channel",
        interfaces: ItipChannelInterfaces,
    }),

    contentType: ITIP_HANDLER_MIMETYPE,
    loadAttributes: null,
    contentLength: 0,
    owner: null,
    loadGroup: null,
    notificationCallbacks: null,
    securityInfo: null,
    
    open: NYI,
    asyncOpen: function (observer, ctxt) {
        observer.onStartRequest(this, ctxt);
    },
    asyncRead: function (listener, ctxt) {
        return listener.onStartRequest(this, ctxt);
    },
    
    isPending: function () { return true; },
    status: Components.results.NS_OK,
    cancel: function (status) { this.status = status; },
    suspend: NYI,
    resume: NYI,
};

function ItipProtocolHandler() {
    this.wrappedJSObject = this;
}
const ItipProtocolHandlerClassID = Components.ID("{6e957006-b4ce-11d9-b053-001124736B74}");
const ItipProtocolHandlerInterfaces = [Components.interfaces.nsIProtocolHandler];
ItipProtocolHandler.prototype = {
    classID: ItipProtocolHandlerClassID,
    QueryInterface: XPCOMUtils.generateQI(ItipProtocolHandlerInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: ItipProtocolHandlerClassID,
        contractID: "@mozilla.org/network/protocol;1?name=" + ITIP_HANDLER_PROTOCOL,
        classDescription: "iTIP Protocol Handler",
        interfaces: ItipProtocolHandlerInterfaces
    }),

    protocolFlags: CI.nsIProtocolHandler.URI_NORELATIVE | CI.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD,
    allowPort: function () false,
    isSecure: false,
    newURI: function (spec, charSet, baseURI) {
        let cls = Components.classes["@mozilla.org/network/standard-url;1"];
        let url = cls.createInstance(CI.nsIStandardURL);
        url.init(CI.nsIStandardURL.URLTYPE_STANDARD, 0, spec, charSet, baseURI);
        dump("Creating new URI for " + spec + "\n");
        return url.QueryInterface(CI.nsIURI);
    },
    
    newChannel: function (URI) {
        dump("Creating new ItipChannel for " + URI + "\n");
        return new ItipChannel(URI);
    },
};

function ItipContentHandler() {
    this.wrappedJSObject = this;
}
const ItipContentHandlerClassID = Components.ID("{47c31f2b-b4de-11d9-bfe6-001124736B74}");
const ItipContentHandlerInterfaces = [Components.interfaces.nsIContentHandler];
ItipContentHandler.prototype = {
    classID: ItipContentHandlerClassID,
    QueryInterface: XPCOMUtils.generateQI(ItipContentHandlerInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: ItipContentHandlerClassID,
        contractID: "@mozilla.org/uriloader/content-handler;1?type=" + ITIP_HANDLER_MIMETYPE,
        classDescription: "Lightning text/calendar content handler",
        interfaces: ItipContentHandlerInterfaces
    }),

    handleContent: function (contentType, windowTarget, request) {
        let channel = request.QueryInterface(CI.nsIChannel);
        let uri = channel.URI.spec;
        if (uri.indexOf(ITIP_HANDLER_PROTOCOL + ":") != 0) {
            cal.ERROR("Unexpected iTIP uri: " + uri + "\n");
            return Components.results.NS_ERROR_FAILURE;
        }
        // moz-cal-handle-itip:///?
        let paramString = uri.substring(ITIP_HANDLER_PROTOCOL.length + 4);
        let paramArray = paramString.split("&");
        let paramBlock = { };
        paramArray.forEach(function (v) {
            let parts = v.split("=");
            paramBlock[parts[0]] = unescape(unescape(parts[1]));
            });
        // dump("content-handler: have params " + paramBlock.toSource() + "\n");
        let event = cal.createEvent(paramBlock.data);
        dump("Processing iTIP event '" + event.title + "' from " +
            event.organizer.id + " (" + event.id + ")\n");
        let calMgr = cal.getCalendarManager();
        let cals = calMgr.getCalendars({});
        cals[0].addItem(event, null);
    }
};

var components = [ItipChannel, ItipProtocolHandler, ItipContentHandler];
var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
