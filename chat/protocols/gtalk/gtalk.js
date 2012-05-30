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

function GTalkAccount(aProtoInstance, aImAccount) {
  this._init(aProtoInstance, aImAccount);
}
GTalkAccount.prototype = {
  __proto__: XMPPAccountPrototype,
  connect: function() {
    this._jid = this._parseJID(this.name);

    // For the resource, if the user has edited the option to a non
    // empty value, use that.
    if (this.prefs.prefHasUserValue("resource")) {
      let resource = this.getString("resource");
      if (resource)
        this._jid.resource = resource;
    }
    // Otherwise, if the username doesn't contain a resource, use the
    // value of the resource option (it will be the default value).
    // If we set an empty resource, XMPPSession will fallback to
    // XMPPDefaultResource (set to brandShortName).
    if (!this._jid.resource)
      this._jid.resource = this.getString("resource");

    this._connection =
      new XMPPSession("talk.google.com", 443,
                      "require_tls", this._jid,
                      this.imAccount.password, this);
  }
};

function GTalkProtocol() {
}
GTalkProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() "gtalk",
  get name() "Google Talk",
  get iconBaseURI() "chrome://prpl-gtalk/skin/",
  get usernameEmptyText() _("gtalk.usernameHint"),
  getAccount: function(aImAccount) new GTalkAccount(this, aImAccount),
  options: {
    resource: {get label() _("options.resource"),
               get default() XMPPDefaultResource}
  },
  get chatHasTopic() true,
  classID: Components.ID("{38a224c1-6748-49a9-8ab2-efc362b1000d}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([GTalkProtocol]);
