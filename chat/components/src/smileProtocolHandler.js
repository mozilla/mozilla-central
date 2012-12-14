/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/imSmileys.jsm");

const kSmileRegexp = /^smile:\/\//;

function smileProtocolHandler() { }

smileProtocolHandler.prototype = {
  scheme: "smile",
  defaultPort: -1,
  protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE |
                 Ci.nsIProtocolHandler.URI_NOAUTH |
                 Ci.nsIProtocolHandler.URI_IS_UI_RESOURCE |
                 Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE,
  newURI: function SPH_newURI(aSpec, aOriginCharset, aBaseURI) {
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    uri.QueryInterface(Ci.nsIMutable);
    uri.mutable = false;
    return uri;
  },
  newChannel: function SPH_newChannel(aURI) {
    let smile = aURI.spec.replace(kSmileRegexp, "");
    let channel = Services.io.newChannel(getSmileRealURI(smile), null, null);
    channel.originalURI = aURI;
    return channel;
  },
  allowPort: function  SPH_allowPort(aPort, aScheme) false,

  classDescription: "Smile Protocol Handler",
  classID: Components.ID("{04e58eae-dfbc-4c9e-8130-6d9ef19cbff4}"),
  contractID: "@mozilla.org/network/protocol;1?name=smile",
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler])
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([smileProtocolHandler]);
