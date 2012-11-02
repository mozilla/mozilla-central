/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/xmpp.jsm");
Cu.import("resource:///modules/xmpp-session.jsm");

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/xmpp.properties")
);

function OdnoklassnikiAccount(aProtoInstance, aImAccount) {
  this._init(aProtoInstance, aImAccount);
}
OdnoklassnikiAccount.prototype = {
  __proto__: XMPPAccountPrototype,
  get canJoinChat() false,
  connect: function() {
    if (this.name.indexOf("@") == -1) {
      let jid = this.name + "@odnoklassniki.ru/" + XMPPDefaultResource;
      this._jid = this._parseJID(jid);
    }
    else {
      this._jid = this._parseJID(this.name);
      if (this._jid.domain != "odnoklassniki.ru") {
        // We can't use this.onError because this._connection doesn't exist.
        this.reportDisconnecting(Ci.prplIAccount.ERROR_INVALID_USERNAME,
                                 _("connection.error.invalidUsername"));
        this.reportDisconnected();
        return;
      }
    }

    this._connection = new XMPPSession("odnoklassniki.ru", 5222,
                                       "require_tls", this._jid,
                                       this.imAccount.password, this);
  }
};

function OdnoklassnikiProtocol() {
}
OdnoklassnikiProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() "odnoklassniki",
  get name() "Odnoklassniki",
  get iconBaseURI() "chrome://prpl-odnoklassniki/skin/",
  get usernameEmptyText() _("odnoklassniki.usernameHint"),
  getAccount: function(aImAccount) new OdnoklassnikiAccount(this, aImAccount),
  classID: Components.ID("{29b09a83-81c1-2032-11e2-6d9bc4f8e969}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([OdnoklassnikiProtocol]);
