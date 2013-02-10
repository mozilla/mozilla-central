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

function VkontakteAccount(aProtoInstance, aImAccount) {
  this._init(aProtoInstance, aImAccount);
}
VkontakteAccount.prototype = {
  __proto__: XMPPAccountPrototype,
  get canJoinChat() false,
  connect: function() {
    if (!this.name.contains("@")) {
      let jid = this.name + "@vk.com/" + XMPPDefaultResource;
      this._jid = this._parseJID(jid);
    }
    else {
      this._jid = this._parseJID(this.name);
      if (this._jid.domain != "vk.com") {
        // We can't use this.onError because this._connection doesn't exist.
        this.reportDisconnecting(Ci.prplIAccount.ERROR_INVALID_USERNAME,
                                 _("connection.error.invalidUsername"));
        this.reportDisconnected();
        return;
      }
    }

    this._connection = new XMPPSession("vkmessenger.com", 5222,
                                       "require_tls", this._jid,
                                       this.imAccount.password, this);
  }
};

function VkontakteProtocol() {
}
VkontakteProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get normalizedName() "vkontakte",
  get name() "Vkontakte",
  get iconBaseURI() "chrome://prpl-vkontakte/skin/",
  get usernameEmptyText() _("vkontakte.usernameHint"),
  getAccount: function(aImAccount) new VkontakteAccount(this, aImAccount),
  classID: Components.ID("{0743ab81-8963-1743-7abc-9874823acd56}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([VkontakteProtocol]);
