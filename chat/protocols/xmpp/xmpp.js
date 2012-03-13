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
 * The Original Code is Instantbird.
 *
 * The Initial Developer of the Original Code is
 * Varuna JAYASIRI <vpjayasiri@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Florian Quèze <florian@queze.net>
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

const Cu = Components.utils;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/xmpp.jsm");
Cu.import("resource:///modules/xmpp-session.jsm");

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/xmpp.properties")
);

function XMPPAccount(aProtoInstance, aImAccount) {
  this._init(aProtoInstance, aImAccount);
}
XMPPAccount.prototype = XMPPAccountPrototype;

function XMPPProtocol() {
}
XMPPProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() "jabber",
  get name() "XMPP (JS)",
  get iconBaseURI() "chrome://prpl-jabber/skin/",
  getAccount: function(aImAccount) new XMPPAccount(this, aImAccount),
  options: {
    resource: {get label() _("options.resource"),
               get default() XMPPDefaultResource},
    connection_security: {
      get label() _("options.connectionSecurity"),
      listValues: {
        get require_tls() _("options.connectionSecurity.requireEncryption"),
        get opportunistic_tls() _("options.connectionSecurity.opportunisticTLS"),
        get allow_unencrypted_plain_auth() _("options.connectionSecurity.allowUnencryptedAuth"),
        // "old_ssl" and "none" are also supported, but not exposed in the UI.
        // Any unknown value will fallback to the opportunistic_tls behavior.
      },
      default: "opportunistic_tls"
    },
    server: {get label() _("options.connectServer"), default: ""},
    port: {get label() _("options.connectPort"), default: 5222}
  },
  get chatHasTopic() true,

  classID: Components.ID("{dde786d1-6f59-43d0-9bc8-b505a757fb30}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([XMPPProtocol]);
