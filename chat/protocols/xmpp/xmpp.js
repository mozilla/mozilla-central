/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  get name() "XMPP",
  get iconBaseURI() "chrome://prpl-jabber/skin/",
  getAccount: function(aImAccount) new XMPPAccount(this, aImAccount),
  options: {
    resource: {get label() _("options.resource"),
               get default() XMPPDefaultResource},
    priority: {get label() _("options.priority"), default: 0},
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
