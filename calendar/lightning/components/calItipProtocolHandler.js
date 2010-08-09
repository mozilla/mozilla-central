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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Shaver <shaver@mozilla.org>
 *   Philipp Kewisch <mozilla@kewis.ch>
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


Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

const CI = Components.interfaces;

const ITIP_HANDLER_MIMETYPE = "application/x-itip-internal";
const ITIP_HANDLER_PROTOCOL = "moz-cal-handle-itip";


function NYI()
{
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

function ItipChannel(URI)
{
   this.URI = this.originalURI = URI;
}

ItipChannel.prototype = {
    classID: Components.ID("{643e0328-36f6-411d-a107-16238dff9cd7}"),
    contractID: "@mozilla.org/calendar/itip-channel;1",
    classDescription: "Calendar Itip Channel",

    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsIChannel,
                        Components.interfaces.nsIRequest,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, ItipChannel.prototype, aIID, null, this);
    },
    
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

function ItipProtocolHandler() { }

ItipProtocolHandler.prototype = {
    classID: Components.ID("{6e957006-b4ce-11d9-b053-001124736B74}"),
    contractID: "@mozilla.org/network/protocol;1?name=" + ITIP_HANDLER_PROTOCOL,
    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsIProtocolHandler,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QI(aIID) {
        return cal.doQueryInterface(this, ItipProtocolHandler.prototype, aIID, null, this);
    },
    
    protocolFlags: CI.nsIProtocolHandler.URI_NORELATIVE | CI.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD,
    allowPort: function () { return false; },
    isSecure: false,
    newURI: function (spec, charSet, baseURI)
    {
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

function ItipContentHandler() { }

ItipContentHandler.prototype = {
    classID: Components.ID("{47c31f2b-b4de-11d9-bfe6-001124736B74}"),
    contractID: "@mozilla.org/uriloader/content-handler;1?type=" + ITIP_HANDLER_MIMETYPE,
    classDescription: "Lightning text/calendar content handler",

    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.nsIContentHandler,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function (aIID) {
        return cal.doQueryInterface(this, ItipContentHandler.prototype, aIID, null, this);
    },

    handleContent: function (contentType, windowTarget, request)
    {
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
