/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kNetworkProtocolCIDPrefix = "@mozilla.org/network/protocol;1?name=";
const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;

function makeProtocolHandler(aCID, aProtocol, aDefaultPort) {
  return {
    classID: Components.ID(aCID),
    QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler]),

    scheme: aProtocol,
    defaultPort: aDefaultPort,
    protocolFlags: nsIProtocolHandler.URI_NORELATIVE |
                   nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
                   nsIProtocolHandler.ALLOWS_PROXY,

    newURI: function (aSpec, aOriginCharset, aBaseURI) {
      var url = Components.classes["@mozilla.org/network/ldap-url;1"]
                          .createInstance(Components.interfaces.nsIURI);

      if (url instanceof Components.interfaces.nsILDAPURL)
	url.init(Components.interfaces.nsIStandardURL.URLTYPE_STANDARD,
		 aDefaultPort, aSpec, aOriginCharset, aBaseURI);

      return url;
    },

    newChannel: function (aURI) {
      if ("@mozilla.org/network/ldap-channel;1" in Components.classes) {
        var channel = Components.classes["@mozilla.org/network/ldap-channel;1"]
                                .createInstance(Components.interfaces.nsIChannel);
        channel.init(aURI);
        return channel;
      }

      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    allowPort: function (port, scheme) {
      return port == aDefaultPort;
    }
  };
}

function nsLDAPProtocolHandler() {}

nsLDAPProtocolHandler.prototype = makeProtocolHandler("{b3de9249-b0e5-4c12-8d91-c9a434fd80f5}", "ldap", 389);

function nsLDAPSProtocolHandler() {}

nsLDAPSProtocolHandler.prototype = makeProtocolHandler("{c85a5ef2-9c56-445f-b029-76889f2dd29b}", "ldaps", 636);

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsLDAPProtocolHandler,
                                                      nsLDAPSProtocolHandler]);
