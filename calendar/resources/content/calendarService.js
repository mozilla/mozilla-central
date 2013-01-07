/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This file contains the following calendar related components:
 * 1. Command line handler service, for responding to the -webcal command line
 *    option. (CLineHandler)
 * 2. Content handler for responding to content of type text/calendar
 *    (ICALContentHandler)
 * 3. Protocol handler for supplying a channel to the browser when an webcal://
 *    link is clicked. (ICALProtocolHandler)
 * 4. A (nearly empty) imeplementation of nsIChannel for telling the browser
 *    that webcal:// links have the content type text/calendar (BogusChannel)
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

/* Command Line handler service */
function CLineService() {
}

CLineService.prototype = {
    getInterfaces: function getInterfaces(aCount) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.nsICommandLineHandler
        ];

        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/commandlinehandler/general-startup;1?type=calendar",
    classDescription: "Calendar Commandline Handler",
    classID: Components.ID("{65ef4b0b-d116-4b93-bf8a-84525992bf27}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, CLineService.prototype, aIID, null, this);
    },

    /* nsICommandLineHandler */
    handle : function service_handle(cmdLine) {
        if (!cmdLine.preventDefault) {
            // just pass all arguments on to the Sunbird window
            Services.ww.openWindow(null, "chrome://sunbird/content/calendar.xul",
                                   "_blank", "chrome,dialog=no,all", cmdLine);
            cmdLine.preventDefault = true;
        }
    },

    helpInfo : "  -subscribe or -url   Pass in a path pointing to a calendar\n" +
               "                       to subscribe to.\n" +
               "  -showdate            Pass in a value for a javascript date\n" +
               "                       to show this date on startup.\n"
};

/* text/calendar content handler */
function ICALContentHandler() {}

ICALContentHandler.prototype = {
    getInterfaces: function getInterfaces(aCount) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.nsIContentHandler
        ];

        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/uriloader/content-handler;1?type=text/calendar",
    classDescription: "text/calendar Content Handler",
    classID: Components.ID("{9ebf4c8a-7770-40a6-aeed-e1738129535a}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, ICALContentHandler.prototype, aIID, null, this);
    },

    handleContent: function handleContent(aContentType, aWindowTarget, aRequest) {
        let channel = aRequest.QueryInterface(Components.interfaces.nsIChannel);

        // Cancel the request ...
        let uri = channel.URI;
        const NS_BINDING_ABORTED = 0x804b0002 // from nsError.h
        aRequest.cancel(NS_BINDING_ABORTED);

        // ... Subscribe to the uri ...
        let calendarManager = cal.getCalendarManager();
        let newCalendar = calendarManager.createCalendar('ics', uri);

        // XXX Come up with a better name, like the filename or X-WR-CALNAME
        // XXX Also, make up a color
        newCalendar.name = "temp";

        calendarManager.registerCalendar(newCalendar);

        // ... and open or focus a calendar window.
        let w = cal.getCalendarWindow();

        if (w) {
            w.focus();
        } else {
            w = Services.appShell.hiddenDOMWindow;

            let args = {};
            args.channel = channel;
            w.openDialog("chrome://sunbird/content/calendar.xul",
                         "calendar",
                         "chrome,menubar,resizable,scrollbars,status,toolbar,dialog=no",
                         args);
        }
    }
};

function NYI() {
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
}

/* bogus webcal channel used by the ICALProtocolHandler */
function BogusChannel(aURI) {
    this.URI = aURI;
    this.originalURI = aURI;
}

BogusChannel.prototype = {
    getInterfaces: function getInterfaces(aCount) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.nsIRequest,
            Components.interfaces.nsIChannel
        ];

        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/webcal-channel;1",
    classDescription: "webcal bogus channel",

    classID: Components.ID("{1e36ef5d-92d9-488f-ada6-9f15a1b57acf}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,

    URI: null,
    originalURI: null,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, BogusChannel.prototype, aIID, null, this);
    },

    /* nsIChannel */
    loadAttributes: null,
    contentType: "text/calendar",
    contentLength: 0,
    owner: null,
    loadGroup: null,
    notificationCallbacks: null,
    securityInfo: null,

    open: NYI,
    asyncOpen: NYI,

    asyncOpen: function asyncOpen(observer, ctxt) {
        observer.onStartRequest(this, ctxt);
    },

    asyncRead: function asyncRead(listener, ctxt) {
        return listener.onStartRequest(this, ctxt);
    },

    /* nsIRequest */
    isPending: function() true,
    status: Components.results.NS_OK,

    cancel: function cancel(aStatus) {
        this.status = aStatus;
    },

    suspend: NYI,
    resume: NYI
};

var components = [CLineService, ICALContentHandler, BogusChannel];
var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
