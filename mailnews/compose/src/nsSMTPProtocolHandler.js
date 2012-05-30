/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kNetworkProtocolCIDPrefix = "@mozilla.org/network/protocol;1?name=";
const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;

function makeProtocolHandler(aProtocol, aDefaultPort, aClassID) {
  return {
    classID: Components.ID(aClassID),
    QueryInterface: XPCOMUtils.generateQI([nsIProtocolHandler]),

    scheme: aProtocol,
    defaultPort: aDefaultPort,
    protocolFlags: nsIProtocolHandler.URI_NORELATIVE |
                   nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
      nsIProtocolHandler.URI_NON_PERSISTABLE |
      nsIProtocolHandler.URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT,

    newURI: function (aSpec, aOriginCharset, aBaseURI) {
      var url = Components.classes["@mozilla.org/messengercompose/smtpurl;1"]
                          .createInstance(Components.interfaces.nsIURI);

      url.spec = aSpec;

      return url;
    },

    newChannel: function (aURI) {
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    allowPort: function (port, scheme) {
      return port == aDefaultPort;
    }
  };
}

function nsSMTPProtocolHandler() {}

nsSMTPProtocolHandler.prototype =
  makeProtocolHandler("smtp",
                      Components.interfaces.nsISmtpUrl.DEFAULT_SMTP_PORT,
                      "b14c2b67-8680-4c11-8d63-9403c7d4f757");

function nsSMTPSProtocolHandler() {}

nsSMTPSProtocolHandler.prototype =
  makeProtocolHandler("smtps",
                      Components.interfaces.nsISmtpUrl.DEFAULT_SMTPS_PORT,
                      "057d0997-9e3a-411e-b4ee-2602f53fe05f");

var components = [nsSMTPProtocolHandler, nsSMTPSProtocolHandler];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
