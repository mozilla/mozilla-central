/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cu = Components.utils;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/xmpp.jsm");
Cu.import("resource:///modules/xmpp-session.jsm");
Cu.import("resource:///modules/xmpp-xml.jsm");

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/xmpp.properties")
);

// PlainFullBindAuth is an authentication mechanism that works like
// the standard PLAIN mechanism but adds a client-uses-full-bind-result
// attribute to the auth stanza to tell the Google Talk servers that we
// support their JID Domain Discovery extension.
// See https://developers.google.com/talk/jep_extensions/jid_domain_change
function PlainFullBindAuth(username, password, domain) {
  this._key = btoa("\0"+ username + "\0" + password);
}
PlainFullBindAuth.prototype = {
  next: function(aStanza) {
    let attrs = {
      mechanism: "PLAIN",
      "xmlns:ga": "http://www.google.com/talk/protocol/auth",
      "ga:client-uses-full-bind-result": "true"
    };
    return {
      done: true,
      send: Stanza.node("auth", Stanza.NS.sasl, attrs, this._key)
    };
  }
};

function GTalkAccount(aProtoInstance, aImAccount) {
  this._init(aProtoInstance, aImAccount);
}
GTalkAccount.prototype = {
  __proto__: XMPPAccountPrototype,
  connect: function() {
    this._jid = this._parseJID(this.name);
    // The XMPP spec says that the node part of a JID is optional, but
    // in the case of Google Talk if the username typed by the user
    // doesn't contain an @, we prefer assuming that it's the domain
    // part that's been omitted.
    if (!this._jid.node) {
      // If the domain part was omitted, swap the node and domain parts,
      // use 'gmail.com' as the default domain, and tell the Google
      // Talk server that we will use the full bind result.
      this._jid.node = this._jid.domain;
      this._jid.domain = "gmail.com";
      this.authMechanisms = {PLAIN: PlainFullBindAuth};
    }

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

    let jid = this._jid.node + "@" + this._jid.domain;
    if (this._jid.resource)
      jid += "/" + this._jid.resource;
    this._jid.jid = jid;

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
