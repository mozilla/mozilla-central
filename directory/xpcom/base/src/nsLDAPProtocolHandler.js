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
 * The Original Code is LDAP Protocol Handler.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

const kNetworkProtocolCIDPrefix = "@mozilla.org/network/protocol;1?name=";
const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;

function makeProtocolHandler(aProtocol, aDefaultPort) {
  return {
    classDescription: "LDAP Protocol Handler",
    contractID: kNetworkProtocolCIDPrefix + aProtocol,
    classID: Components.ID("{b3de9249-b0e5-4c12-8d91-c9a434fd80f5}"),
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

nsLDAPProtocolHandler.prototype = makeProtocolHandler("ldap", 389);

function nsLDAPSProtocolHandler() {}

nsLDAPSProtocolHandler.prototype = makeProtocolHandler("ldaps", 636);

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([nsLDAPProtocolHandler,
                                    nsLDAPSProtocolHandler]);
}
