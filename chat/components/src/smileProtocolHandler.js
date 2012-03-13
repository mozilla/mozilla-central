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
 * The Original Code is the Instantbird messenging client, released
 * 2009.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

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
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel(getSmileRealURI(smile), null, null);
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
