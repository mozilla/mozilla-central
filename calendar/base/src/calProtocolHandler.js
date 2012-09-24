/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

/** Constructor for webcal: protocol handler */
function calProtocolHandlerWebcal() {
    calProtocolHandler.call(this, "webcal");
}

/** Constructor for webcals: protocl handler */
function calProtocolHandlerWebcals() {
    calProtocolHandler.call(this, "webcals");
}

/**
 * Generic webcal constructor
 *
 * @param scheme        The scheme to init for (webcal, webcals)
 */
function calProtocolHandler(scheme) {
    this.scheme = scheme;
    this.mHttpProtocol = Services.io.getProtocolHandler(this.scheme == "webcal" ? "http" : "https");
}

calProtocolHandler.prototype = {
    getInterfaces: function cP_getInterfaces(aCount) {
        const interfaces = [Components.interfaces.nsIProtocolHandler,
                            Components.interfaces.nsIClassInfo,
                            Components.interfaces.nsISupports];

        aCount.value = interfaces.length;
        return interfaces;
    },
    getHelperForLanguage: function cP_getHelperForLanguage(aLang) {
        return null;
    },
    classDescription: "Calendar webcal(s) protocal handler",
    /* classID/contractID is filled in at the end of this file */
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function cph_QueryInterface(aIID) {
        return cal.doQueryInterface(this, calProtocolHandler.prototype, aIID, null, this);
    },

    get defaultPort() {
        return this.mHttpProtocol.defaultPort;
    },

    get protocolFlags() {
        return this.mHttpProtocol.protocolFlags;
    },

    newURI: function cph_newURI(aSpec, anOriginalCharset, aBaseURI) {
        var uri = Components.classes["@mozilla.org/network/standard-url;1"].
                             createInstance(Components.interfaces.nsIStandardURL);
        uri.init(Components.interfaces.nsIStandardURL.URLTYPE_STANDARD, 
                 this.mHttpProtocol.defaultPort, aSpec, anOriginalCharset, aBaseURI);
        return uri;
    },
    
    newChannel: function cph_newChannel(aUri) {
        // make sure to clone the uri, because we are about to change
        // it, and we don't want to change the original uri.
        var uri = aUri.clone();
        uri.scheme = this.mHttpProtocol.scheme;

        var channel = Services.io.newChannelFromURI(uri, null);
        channel.originalURI = aUri;
        return channel;
    },
    
    allowPort: function cph_allowPort(aPort, aScheme) {
        // We are not overriding any special ports
        return false;
    }
};

calProtocolHandlerWebcal.prototype = {
    __proto__: calProtocolHandler.prototype,
    contractID: "@mozilla.org/network/protocol;1?name=webcal",
    classID: Components.ID("{1153c73a-39be-46aa-9ba9-656d188865ca}")
};
calProtocolHandlerWebcals.prototype = {
    __proto__: calProtocolHandler.prototype,
    contractID: "@mozilla.org/network/protocol;1?name=webcals",
    classID: Components.ID("{bdf71224-365d-4493-856a-a7e74026f766}")
};

