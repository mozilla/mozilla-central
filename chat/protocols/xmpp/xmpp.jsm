/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = [
  "XMPPConversationPrototype",
  "XMPPMUCConversationPrototype",
  "XMPPAccountBuddyPrototype",
  "XMPPAccountPrototype"
];

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imStatusUtils.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/socket.jsm");
Cu.import("resource:///modules/xmpp-xml.jsm");
Cu.import("resource:///modules/xmpp-session.jsm");

XPCOMUtils.defineLazyGetter(this, "DownloadUtils", function() {
  Components.utils.import("resource://gre/modules/DownloadUtils.jsm");
  return DownloadUtils;
});
XPCOMUtils.defineLazyGetter(this, "FileUtils", function() {
  Components.utils.import("resource://gre/modules/FileUtils.jsm");
  return FileUtils;
});
XPCOMUtils.defineLazyGetter(this, "NetUtil", function() {
  Components.utils.import("resource://gre/modules/NetUtil.jsm");
  return NetUtil;
});
XPCOMUtils.defineLazyServiceGetter(this, "imgTools",
                                   "@mozilla.org/image/tools;1",
                                   "imgITools");

initLogModule("xmpp", this);

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/xmpp.properties")
);

/* This is an ordered list, used to determine chat buddy flags:
 *  index < member    -> noFlags
 *  index = member    -> voiced
 *          moderator -> halfOp
 *          admin     -> op
 *          owner     -> founder
 */
const kRoles = ["outcast", "visitor", "participant", "member", "moderator",
                "admin", "owner"];

function MUCParticipant(aNick, aName, aStanza)
{
  this._jid = aName;
  this.name = aNick;
  this.stanza = aStanza;
}
MUCParticipant.prototype = {
  __proto__: ClassInfo("prplIConvChatBuddy", "XMPP ConvChatBuddy object"),

  buddy: false,
  get alias() this.name,

  role: 2, // "participant" by default
  set stanza(aStanza) {
    this._stanza = aStanza;

    let x =
      aStanza.getChildren("x").filter(function (c) c.uri == Stanza.NS.muc_user);
    if (x.length == 0)
      return;
    x = x[0];
    let item = x.getElement(["item"]);
    if (!item)
      return;

    this.role = Math.max(kRoles.indexOf(item.attributes["role"]),
                         kRoles.indexOf(item.attributes["affiliation"]));
  },

  get noFlags() this.role < kRoles.indexOf("member"),
  get voiced() this.role == kRoles.indexOf("member"),
  get halfOp() this.role == kRoles.indexOf("moderator"),
  get op() this.role == kRoles.indexOf("admin"),
  get founder() this.role == kRoles.indexOf("owner"),
  typing: false
};

// MUC (Multi-User Chat)
const XMPPMUCConversationPrototype = {
  __proto__: GenericConvChatPrototype,

  _init: function(aAccount, aJID, aNick) {
    GenericConvChatPrototype._init.call(this, aAccount, aJID, aNick);
  },

  get normalizedName() this.name,

  _targetResource: "",

  /* Called when the user enters a chat message */
  sendMsg: function (aMsg) {
    let s = Stanza.message(this.name, aMsg, null, {type: "groupchat"});
    this._account.sendStanza(s);
  },

  /* Called by the account when a presence stanza is received for this muc */
  onPresenceStanza: function(aStanza) {
    let from = aStanza.attributes["from"];
    let nick = this._account._parseJID(from).resource;
    if (aStanza.attributes["type"] == "unavailable") {
      if (!(nick in this._participants)) {
        WARN("received unavailable presence for an unknown MUC participant: " +
             from);
        return;
      }
      delete this._participants[nick];
      let nickString = Cc["@mozilla.org/supports-string;1"]
                       .createInstance(Ci.nsISupportsString);
      nickString.data = nick;
      this.notifyObservers(new nsSimpleEnumerator([nickString]),
                           "chat-buddy-remove");
      return;
    }
    if (!hasOwnProperty(this._participants, nick)) {
      this._participants[nick] = new MUCParticipant(nick, from, aStanza);
      this.notifyObservers(new nsSimpleEnumerator([this._participants[nick]]),
                           "chat-buddy-add");
    }
    else {
      this._participants[nick].stanza = aStanza;
      this.notifyObservers(this._participants[nick], "chat-buddy-update");
    }
  },

  /* Called by the account when a messsage is received for this muc */
  incomingMessage: function(aMsg, aStanza, aDate) {
    let from = this._account._parseJID(aStanza.attributes["from"]).resource;
    let flags = {};
    if (!from) {
      flags.system = true;
      from = this.name;
    }
    else if (from == this._nick)
      flags.outgoing = true;
    else
      flags.incoming = true;
    if (aDate) {
      flags.time = aDate / 1000;
      flags.delayed = true;
    }
    this.writeMessage(from, aMsg, flags);
  },

  getNormalizedChatBuddyName: function(aNick) this.name + "/" + aNick,

  /* Called when the user closed the conversation */
  close: function() {
    if (!this.left) {
      this._account.sendStanza(Stanza.presence({to: this.name + "/" + this._nick,
                                               type: "unavailable"}));
    }
    GenericConvChatPrototype.close.call(this);
  },
  unInit: function() {
    this._account.removeConversation(this.name);
    GenericConvChatPrototype.unInit.call(this);
  }
};
function XMPPMUCConversation(aAccount, aJID, aNick)
{
  this._init(aAccount, aJID, aNick);
}
XMPPMUCConversation.prototype = XMPPMUCConversationPrototype;

/* Helper class for buddy conversations */
const XMPPConversationPrototype = {
  __proto__: GenericConvIMPrototype,

  _typingTimer: null,
  _supportChatStateNotifications: true,
  _typingState: "active",

  _init: function(aAccount, aBuddy) {
    this.buddy = aBuddy;
    GenericConvIMPrototype._init.call(this, aAccount, aBuddy.normalizedName);
  },

  get title() this.buddy.contactDisplayName,
  get normalizedName() this.buddy.normalizedName,

  get shouldSendTypingNotifications()
    this._supportChatStateNotifications &&
    Services.prefs.getBoolPref("purple.conversations.im.send_typing"),
  set supportChatStateNotifications(val) {
    this._supportChatStateNotifications = val;
  },

  /* Called when the user is typing a message
   * aLength - length of the typed message */
  sendTyping: function(aLength) {
    if (!this.shouldSendTypingNotifications)
      return;

    this._cancelTypingTimer();
    if (aLength)
      this._typingTimer = setTimeout(this.finishedComposing.bind(this), 10000);

    this._setTypingState(aLength ? "composing" : "active");
  },

  finishedComposing: function() {
    if (!this.shouldSendTypingNotifications)
      return;

    this._setTypingState("paused");
  },

  _setTypingState: function(aNewState) {
    if (this._typingState == aNewState)
      return;

    /* to, msg, state, attrib, data */
    let s = Stanza.message(this.to, null, aNewState);
    this._account.sendStanza(s);
    this._typingState = aNewState;
  },
  _cancelTypingTimer: function() {
    if (this._typingTimer) {
      clearTimeout(this._typingTimer);
      delete this._typingTimer;
    }
  },

  _targetResource: "",
  get to() {
    let to = this.buddy.userName;
    if (this._targetResource)
      to += "/" + this._targetResource;
    return to;
  },

  /* Called when the user enters a chat message */
  sendMsg: function (aMsg) {
    this._cancelTypingTimer();
    let cs = this.shouldSendTypingNotifications ? "active" : null;
    let s = Stanza.message(this.to, aMsg, cs);
    this._account.sendStanza(s);
    let who;
    if (this._account._connection)
      who = this._account._connection._jid.jid;
    if (!who)
      who = this._account.name;
    let alias = this.account.alias || this.account.statusInfo.displayName;
    let msg = Components.classes["@mozilla.org/txttohtmlconv;1"]
                        .getService(Ci.mozITXTToHTMLConv)
                        .scanTXT(aMsg, Ci.mozITXTToHTMLConv.kEntities);
    this.writeMessage(who, msg, {outgoing: true, _alias: alias});
    delete this._typingState;
  },

  /* Called by the account when a messsage is received from the buddy */
  incomingMessage: function(aMsg, aStanza, aDate) {
    let from = aStanza.attributes["from"];
    this._targetResource = this._account._parseJID(from).resource;
    let flags = {incoming: true, _alias: this.buddy.contactDisplayName};
    if (aDate) {
      flags.time = aDate / 1000;
      flags.delayed = true;
    }
    this.writeMessage(from, aMsg, flags);
  },

  /* Called when the user closed the conversation */
  close: function() {
    // TODO send the stanza indicating we have left the conversation?
    GenericConvIMPrototype.close.call(this);
  },
  unInit: function() {
    this._account.removeConversation(this.buddy.normalizedName);
    delete this.buddy;
    GenericConvIMPrototype.unInit.call(this);
  }
};
function XMPPConversation(aAccount, aBuddy)
{
  this._init(aAccount, aBuddy);
}
XMPPConversation.prototype = XMPPConversationPrototype;

/* Helper class for buddies */
const XMPPAccountBuddyPrototype = {
  __proto__: GenericAccountBuddyPrototype,

  subscription: "none",
  /* Returns a list of TooltipInfo objects to be displayed when the user hovers over the buddy */
  getTooltipInfo: function() {
    if (!this._account.connected)
      return null;

    let tooltipInfo = [];
    if (this._resources) {
      for (let r in this._resources) {
        let status = this._resources[r];
        let statusString = Status.toLabel(status.statusType);
        if (status.statusType == Ci.imIStatusInfo.STATUS_IDLE &&
            status.idleSince) {
          let now = Math.floor(Date.now() / 1000);
          let valuesAndUnits =
            DownloadUtils.convertTimeUnits(now - status.idleSince);
          if (!valuesAndUnits[2])
            valuesAndUnits.splice(2, 2);
          statusString += " (" + valuesAndUnits.join(" ") + ")";
        }
        if (status.statusText)
          statusString += " - " + status.statusText;
        let label = r ? _("tooltip.status", r) : _("tooltip.statusNoResource");
        tooltipInfo.push(new TooltipInfo(label, statusString));
      }
    }

    // The subscription value is interesting to display only in unusual cases.
    if (this.subscription != "both") {
      tooltipInfo.push(new TooltipInfo(_("tooltip.subscription"),
                                       this.subscription));
    }

    return new nsSimpleEnumerator(tooltipInfo);
  },

  get normalizedName() this.userName,
  /* Display name of the buddy */
  get contactDisplayName() this.buddy.contact.displayName || this.displayName,

  remove: function() {
    if (!this._account.connected)
      return;

    let s = Stanza.iq("set", null, null,
                      Stanza.node("query", Stanza.NS.roster, null,
                                  Stanza.node("item", null,
                                              {jid: this.normalizedName,
                                               subscription: "remove"})));
    this._account._connection.sendStanza(s);
  },

  _photoHash: null,
  _saveIcon: function(aPhotoNode) {
    let type = aPhotoNode.getElement(["TYPE"]).innerText;
    const kExt = {"image/gif": "gif", "image/jpeg": "jpg", "image/png": "png"};
    if (!kExt.hasOwnProperty(type))
      return;

    let data = aPhotoNode.getElement(["BINVAL"]).innerText;
    let content = atob(data.replace(/[^A-Za-z0-9\+\/\=]/g, ""));

    // Store a sha1 hash of the photo we have just received.
    let ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    ch.init(ch.SHA1);
    let dataArray = [content.charCodeAt(i) for (i in content)];
    ch.update(dataArray, dataArray.length);
    let hash = ch.finish(false);
    function toHexString(charCode) ("0" + charCode.toString(16)).slice(-2)
    this._photoHash = [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");

    let istream = Cc["@mozilla.org/io/string-input-stream;1"]
                  .createInstance(Ci.nsIStringInputStream);
    istream.setData(content, content.length);

    let fileName = this._photoHash + "." + kExt[type];
    let file = FileUtils.getFile("ProfD", ["icons",
                                           this.account.protocol.normalizedName,
                                           this.account.normalizedName,
                                           fileName]);
    let ostream = FileUtils.openSafeFileOutputStream(file);
    let buddy = this;
    NetUtil.asyncCopy(istream, ostream, function(rc) {
      if (Components.isSuccessCode(rc))
        buddy.buddyIconFilename = Services.io.newFileURI(file).spec;
    });
  },

  _preferredResource: undefined,
  _resources: null,
  onAccountDisconnected: function() {
    delete this._preferredResource;
    delete this._resources;
  },
  // Called by the account when a presence stanza is received for this buddy.
  onPresenceStanza: function(aStanza) {
    let preferred = this._preferredResource;

    // Facebook chat's XMPP server doesn't send resources, let's
    // replace undefined resources with empty resources.
    let resource =
      this._account._parseJID(aStanza.attributes["from"]).resource || "";

    let type = aStanza.attributes["type"];
    if (type == "unavailable") {
      if (!this._resources || !(resource in this._resources))
        return; // ignore for already offline resources.
      delete this._resources[resource];
      if (preferred == resource)
        preferred = undefined;
    }
    else if (type != "unsubscribe" && type != "unsubscribed" &&
             type != "subscribed") {
      let statusType = Ci.imIStatusInfo.STATUS_AVAILABLE;
      let show = aStanza.getElement(["show"]);
      if (show) {
        show = show.innerText;
        if (show == "away")
          statusType = Ci.imIStatusInfo.STATUS_AWAY;
        else if (show == "chat")
          statusType = Ci.imIStatusInfo.STATUS_AVAILABLE; //FIXME
        else if (show == "dnd")
          statusType = Ci.imIStatusInfo.STATUS_UNAVAILABLE;
        else if (show == "xa")
          statusType = Ci.imIStatusInfo.STATUS_IDLE;
      }

      let idleSince = 0;
      let query = aStanza.getElement(["query"]);
      if (query && query.uri == Stanza.NS.last) {
        let now = Math.floor(Date.now() / 1000);
        idleSince = now - parseInt(query.attributes["seconds"], 10);
        statusType = Ci.imIStatusInfo.STATUS_IDLE;
      }

      let status = aStanza.getElement(["status"]);
      status = status ? status.innerText : "";

      let priority = aStanza.getElement(["priority"]);
      priority = priority ? parseInt(priority.innerText, 10) : 0;

      if (!this._resources)
        this._resources = {};
      this._resources[resource] = {
        statusType: statusType,
        statusText: status,
        idleSince: idleSince,
        priority: priority,
        stanza: aStanza
      };
    }

    let photo = aStanza.getElement(["x", "photo"]);
    if (photo && photo.uri == Stanza.NS.vcard_update) {
      let hash = photo.innerText;
      if (hash && hash != this._photoHash)
        this._account._requestVCard(this.normalizedName);
      else if (!hash && this._photoHash) {
        delete this._photoHash;
        this.buddyIconFilename = "";
      }
    }

    for (let r in this._resources) {
      if (preferred === undefined ||
          this._resources[r].statusType > this._resources[preferred].statusType)
        // FIXME also compare priorities...
        preferred = r;
    }
    if (preferred != undefined && preferred == this._preferredResource &&
        resource != preferred) {
      // The presence information change is only for an unused resource,
      // only potential buddy tooltips need to be refreshed.
      this._notifyObservers("status-detail-changed");
      return;
    }

    // Presence info has changed enough that if we are having a
    // conversation with one resource of this buddy, we should send
    // the next message to all resources.
    // FIXME: the test here isn't exactly right...
    if (this._preferredResource != preferred &&
        this._account._conv.hasOwnProperty(this.normalizedName))
      delete this._account._conv[this.normalizedName]._targetResource;

    this._preferredResource = preferred;
    if (preferred === undefined) {
      let statusType = Ci.imIStatusInfo.STATUS_UNKNOWN;
      if (type == "unavailable")
        statusType = Ci.imIStatusInfo.STATUS_OFFLINE;
      this.setStatus(statusType, "");
    }
    else {
      preferred = this._resources[preferred];
      this.setStatus(preferred.statusType, preferred.statusText);
    }
  },

  /* Can send messages to buddies who appear offline */
  get canSendMessage() this.account.connected,

  /* Called when the user wants to chat with the buddy */
  createConversation: function()
    this._account.createConversation(this.normalizedName)
};
function XMPPAccountBuddy(aAccount, aBuddy, aTag, aUserName)
{
  this._init(aAccount, aBuddy, aTag, aUserName);
}
XMPPAccountBuddy.prototype = XMPPAccountBuddyPrototype;

/* Helper class for account */
const XMPPAccountPrototype = {
  __proto__: GenericAccountPrototype,

  _jid: null, // parsed Jabber ID: node, domain, resource
  _connection: null, // XMPP Connection

  _init: function(aProtoInstance, aImAccount) {
    GenericAccountPrototype._init.call(this, aProtoInstance, aImAccount);

    /* Ongoing conversations */
    this._conv = {};
    this._buddies = {};
    this._mucs = {};
    this._pendingAuthRequests = [];
  },

  get canJoinChat() true,
  chatRoomFields: {
    room: {get label() _("chatRoomField.room"), required: true},
    server: {get label() _("chatRoomField.server"), required: true},
    nick: {get label() _("chatRoomField.nick"), required: true},
    password: {get label() _("chatRoomField.password"), isPassword: true}
  },
  parseDefaultChatName: function(aDefaultChatName) {
    if (!aDefaultChatName)
      return {nick: this._jid.node};

    let jid = this._parseJID(aDefaultChatName);
    return {
      room: jid.node,
      server: jid.domain,
      nick: jid.resource || this._jid.node
    };
  },
  getChatRoomDefaultFieldValues: function(aDefaultChatName) {
    let rv = GenericAccountPrototype.getChatRoomDefaultFieldValues
                                    .call(this, aDefaultChatName);
    if (!rv.values.nick)
      rv.values.nick = this._jid.node;

    return rv;
  },
  joinChat: function(aComponents) {
    let jid =
      aComponents.getValue("room") + "@" + aComponents.getValue("server");
    let nick = aComponents.getValue("nick");
    if (jid in this._mucs) {
      if (!this._mucs[jid].left)
        return; // We are already in this conversation.
      this._mucs[jid].left = false; // We are rejoining.
    }
    else
      this._mucs[jid] = nick;

    let x;
    let password = aComponents.getValue("password");
    if (password) {
      x = Stanza.node("x", Stanza.NS.muc, null,
                      Stanza.node("password", null, null, password));
    }
    this._connection.sendStanza(Stanza.presence({to: jid + "/" + nick}, x));
  },

  get normalizedName() this._normalizeJID(this.name),

  _idleSince: 0,
  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "idle-time-changed") {
      let idleTime = parseInt(aData, 10);
      if (idleTime)
        this._idleSince = Math.floor(Date.now() / 1000) - idleTime;
      else
        delete this._idleSince;
      this._shouldSendPresenceForIdlenessChange = true;
      executeSoon((function() {
        if ("_shouldSendPresenceForIdlenessChange" in this)
          this._sendPresence();
      }).bind(this));
    }
    else if (aTopic == "status-changed")
      this._sendPresence();
    else if (aTopic == "user-icon-changed") {
      delete this._cachedUserIcon;
      this._sendVCard();
    }
    else if (aTopic == "user-display-name-changed")
      this._sendVCard();
  },

  /* GenericAccountPrototype events */
  /* Connect to the server */
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

    //FIXME if we have changed this._jid.resource, then this._jid.jid
    // needs to be updated. This value is however never used because
    // while connected it's the jid of the session that's interesting.

    this._connection =
      new XMPPSession(this.getString("server") || this._jid.domain,
                      this.getInt("port") || 5222,
                      this.getString("connection_security"), this._jid,
                      this.imAccount.password, this);
  },

  remove: function() {
    for each (let conv in this._conv)
      conv.close();
    for each (let muc in this._mucs)
      muc.close();
    for (let jid in this._buddies)
      this._forgetRosterItem(jid);
  },

  unInit: function() {
    if (this._connection)
      this._disconnect(undefined, undefined, true);
    delete this._jid;
    delete this._conv;
    delete this._buddies;
    delete this._mucs;
  },

  /* Disconnect from the server */
  disconnect: function() {
    this._disconnect();
  },

  addBuddy: function(aTag, aName) {
    if (!this._connection)
      throw "The account isn't connected";

    let jid = this._normalizeJID(aName);
    if (!jid || jid.indexOf("@") == -1)
      throw "Invalid username";

    if (this._buddies.hasOwnProperty(jid)) {
      let subscription = this._buddies[jid].subscription;
      if (subscription && (subscription == "both" || subscription == "to")) {
        DEBUG("not re-adding an existing buddy");
        return;
      }
    }
    else {
      let s = Stanza.iq("set", null, null,
                        Stanza.node("query", Stanza.NS.roster, null,
                                    Stanza.node("item", null, {jid: jid},
                                                Stanza.node("group", null, null,
                                                            aTag.name))));
      this._connection.sendStanza(s);
    }
    this._connection.sendStanza(Stanza.presence({to: jid, type: "subscribe"}));
  },

  /* Loads a buddy from the local storage.
   * Called for each buddy locally stored before connecting
   * to the server. */
  loadBuddy: function(aBuddy, aTag) {
    let buddy = new this._accountBuddyConstructor(this, aBuddy, aTag);
    this._buddies[buddy.normalizedName] = buddy;
    return buddy;
  },

  /* XMPPSession events */
  /* Called when the XMPP session is started */
  onConnection: function() {
    this.reportConnecting(_("connection.downloadingRoster"));
    let s = Stanza.iq("get", null, null, Stanza.node("query", Stanza.NS.roster));

    /* Set the call back onRoster */
    this._connection.sendStanza(s, this.onRoster, this);
  },


  /* Called whenever a stanza is received */
  onXmppStanza: function(aStanza) {
  },

  /* Called when a iq stanza is received */
  onIQStanza: function(aStanza, aHandled) {
    if (aHandled)
      return;

    if (aStanza.attributes["type"] == "set") {
      for each (let qe in aStanza.getChildren("query")) {
        if (qe.uri != Stanza.NS.roster)
          continue;

        for each (let item in qe.getChildren("item")) {
          this._onRosterItem(item, true);
          let jid = item.attributes["jid"];
        }
        return;
      }
    }

    if (aStanza.attributes["from"] == this._jid.domain) {
      let ping = aStanza.getElement(["ping"]);
      if (ping && ping.uri == Stanza.NS.ping) {
        let s = Stanza.iq("result", aStanza.attributes["id"], this._jid.domain);
        this._connection.sendStanza(s);
      }
    }
  },

  /* Called when a presence stanza is received */
  onPresenceStanza: function(aStanza) {
    let from = aStanza.attributes["from"];
    DEBUG("Received presence stanza for " + from);

    let jid = this._normalizeJID(from);
    if (jid in this._buddies)
      this._buddies[jid].onPresenceStanza(aStanza);
    else if (jid in this._mucs) {
      if (typeof(this._mucs[jid]) == "string") {
        // We have attempted to join, but not created the conversation yet.
        if (aStanza.attributes["type"] == "error") {
          delete this._mucs[jid];
          ERROR("Failed to join MUC: " + aStanza.convertToString());
          return;
        }
        let nick = this._mucs[jid];
        this._mucs[jid] = new this._MUCConversationConstructor(this, jid, nick);
      }
      this._mucs[jid].onPresenceStanza(aStanza);
    }
    else if (aStanza.attributes["type"] == "subscribe") {
      let authRequest = {
        _account: this,
        get account() this._account.imAccount,
        userName: jid,
        _sendReply: function(aReply) {
          let connection = this._account._connection;
          if (!connection)
            return;
          this._account._pendingAuthRequests =
            this._account._pendingAuthRequests.filter(function(r) r !== this);
          connection.sendStanza(Stanza.presence({to: this.userName,
                                                 type: aReply}));
        },
        grant: function() { this._sendReply("subscribed"); },
        deny: function() { this._sendReply("unsubscribed"); },
        cancel: function() {
          Services.obs.notifyObservers(this,
                                       "buddy-authorization-request-canceled",
                                       null);
        },
        QueryInterface: XPCOMUtils.generateQI([Ci.prplIBuddyRequest])
      };
      Services.obs.notifyObservers(authRequest, "buddy-authorization-request",
                                   null);
      this._pendingAuthRequests.push(authRequest);
    }
    else if (from != this._connection._jid.jid)
      WARN("received presence stanza for unknown buddy " + from);
  },

  /* Called when a message stanza is received */
  onMessageStanza: function(aStanza) {
    let norm = this._normalizeJID(aStanza.attributes["from"]);

    let body;
    let b = aStanza.getElement(["body"]);
    if (b)
      body = b.getXML();
    if (body) {
      let date;
      let delay = aStanza.getElement(["delay"]);
      if (delay && delay.uri == Stanza.NS.delay) {
        if (delay.attributes["stamp"])
          date = new Date(delay.attributes["stamp"]);
      }
      if (date && isNaN(date))
        date = undefined;
      if (aStanza.attributes["type"] == "groupchat") {
        if (!this._mucs.hasOwnProperty(norm)) {
          WARN("Received a groupchat message for unknown MUC " + norm);
          return;
        }
        this._mucs[norm].incomingMessage(body, aStanza, date);
        return;
      }

      if (!this.createConversation(norm))
        return;
      this._conv[norm].incomingMessage(body, aStanza, date);
    }

    // Don't create a conversation to only display the typing notifications.
    if (!this._conv.hasOwnProperty(norm))
      return;

    let state;
    let s = aStanza.getChildrenByNS(Stanza.NS.chatstates);
    if (s.length > 0)
      state = s[0].localName;
    if (state) {
      DEBUG(state);
      if (state == "active")
        this._conv[norm].updateTyping(Ci.prplIConvIM.NOT_TYPING);
      else if (state == "composing")
        this._conv[norm].updateTyping(Ci.prplIConvIM.TYPING);
      else if (state == "paused")
        this._conv[norm].updateTyping(Ci.prplIConvIM.TYPED);
    }
    else
      this._conv[norm].supportChatStateNotifications = false;
  },

  /* Called when there is an error in the xmpp session */
  onError: function(aError, aException) {
    if (aError === null || aError === undefined)
      aError = Ci.prplIAccount.ERROR_OTHER_ERROR;
    this._disconnect(aError, aException.toString());
  },

  /* Callbacks for Query stanzas */
  /* When a vCard is recieved */
  onVCard: function(aStanza) {
    let jid = this._normalizeJID(aStanza.attributes["from"]);
    if (!jid || !this._buddies.hasOwnProperty(jid))
      return;
    let buddy = this._buddies[jid];

    let vCard = aStanza.getElement(["vCard"]);
    if (!vCard)
      return;

    for each (let c in vCard.children) {
      if (c.type != "node")
        continue;
      if (c.localName == "FN")
        buddy.serverAlias = c.innerText;
      if (c.localName == "PHOTO")
        buddy._saveIcon(c);
    }
  },

  _normalizeJID: function(aJID) {
    let slashIndex = aJID.indexOf("/");
    if (slashIndex != -1)
      aJID = aJID.substr(0, slashIndex);
    return aJID.toLowerCase();
  },

  _parseJID: function(aJid) {
    let match =
      /^(?:([^@/<>'\"]+)@)?([^@/<>'\"]+)(?:\/([^<>'\"]*))?$/.exec(aJid);
    if (!match)
      return null;

    let result = {
      node: match[1].toLowerCase(),
      domain: match[2].toLowerCase(),
      resource: match[3]
    };
    let jid = result.domain;
    if (result.node)
      jid = result.node + "@" + jid;
    if (result.resource)
      jid += "/" + result.resource;
    result.jid = jid;
    return result;
  },

  _onRosterItem: function(aItem, aNotifyOfUpdates) {
    let jid = aItem.attributes["jid"];
    if (!jid) {
      WARN("Received a roster item without jid: " + aItem.getXML());
      return "";
    }
    jid = this._normalizeJID(jid);

    let subscription =  "";
    if ("subscription" in aItem.attributes)
      subscription = aItem.attributes["subscription"];
    if (subscription == "both" || subscription == "to")
      this._requestVCard(jid);
    else if (subscription == "remove") {
      this._forgetRosterItem(jid);
      return "";
    }

    let buddy;
    if (this._buddies.hasOwnProperty(jid))
      buddy = this._buddies[jid];
    else {
      let tagName = _("defaultGroup");
      for each (let group in aItem.getChildren("group")) {
        let name = group.innerText;
        if (name) {
          tagName = name;
          break; // TODO we should create an accountBuddy per group,
                 // but this._buddies would probably not like that...
        }
      }
      let tag = Services.tags.createTag(tagName);
      buddy = new this._accountBuddyConstructor(this, null, tag, jid);
    }

    let alias = "name" in aItem.attributes ? aItem.attributes["name"] : "";
    if (alias) {
      if (aNotifyOfUpdates && this._buddies.hasOwnProperty(jid))
        buddy.serverAlias = alias;
      else
        buddy._serverAlias = alias;
    }
    if (subscription)
      buddy.subscription = subscription;
    if (!this._buddies.hasOwnProperty(jid)) {
      this._buddies[jid] = buddy;
      Services.contacts.accountBuddyAdded(buddy);
    }
    else if (aNotifyOfUpdates)
      buddy._notifyObservers("status-detail-changed");
    return jid;
  },
  _forgetRosterItem: function(aJID) {
    Services.contacts.accountBuddyRemoved(this._buddies[aJID]);
    delete this._buddies[aJID];
  },
  _requestVCard: function(aJID) {
    let s = Stanza.iq("get", null, aJID,
                      Stanza.node("vCard", Stanza.NS.vcard));
    this._connection.sendStanza(s, this.onVCard, this);
  },

  /* When the roster is received */
  onRoster: function(aStanza) {
    for each (let qe in aStanza.getChildren("query")) {
      if (qe.uri != Stanza.NS.roster)
        continue;

      let savedRoster = Object.keys(this._buddies);
      let newRoster = {};
      for each (let item in qe.getChildren("item")) {
        let jid = this._onRosterItem(item);
        if (jid)
          newRoster[jid] = true;
      }
      for each (let jid in savedRoster) {
        if (!hasOwnProperty(newRoster, jid))
          this._forgetRosterItem(jid);
      }
      break;
    }

    this._sendPresence();
    for each (let b in this._buddies) {
      if (b.subscription == "both" || b.subscription == "to")
        b.setStatus(Ci.imIStatusInfo.STATUS_OFFLINE, "");
    }
    this.reportConnected();
    this._sendVCard();
  },

  /* Public methods */
  /* Send a stanza to a buddy */
  sendStanza: function(aStanza) {
    this._connection.sendStanza(aStanza);
  },

  // Variations of the XMPP protocol can change these default constructors:
  _conversationConstructor: XMPPConversation,
  _MUCConversationConstructor: XMPPMUCConversation,
  _accountBuddyConstructor: XMPPAccountBuddy,

  /* Create a new conversation */
  createConversation: function(aNormalizedName) {
    if (!this._buddies.hasOwnProperty(aNormalizedName)) {
      ERROR("Trying to create a conversation; buddy not present: " + aNormalizedName);
      return null;
    }

    if (!this._conv.hasOwnProperty(aNormalizedName)) {
      this._conv[aNormalizedName] =
        new this._conversationConstructor(this, this._buddies[aNormalizedName]);
    }

    return this._conv[aNormalizedName];
  },

  /* Remove an existing conversation */
  removeConversation: function(aNormalizedName) {
    if (aNormalizedName in this._conv)
      delete this._conv[aNormalizedName];
    else if (aNormalizedName in this._mucs)
      delete this._mucs[aNormalizedName];
  },

  /* Private methods */

  /* Disconnect from the server */
  /* The aError and aErrorMessage parameters are passed to reportDisconnecting
   * and used by the account manager.
   * The aQuiet parameter is to avoid sending status change notifications
   * during the uninitialization of the account. */
  _disconnect: function(aError, aErrorMessage, aQuiet) {
    if (!this._connection)
      return;

    if (aError === undefined)
      aError = Ci.prplIAccount.NO_ERROR;
    this.reportDisconnecting(aError, aErrorMessage);

    for each (let b in this._buddies) {
      if (!aQuiet)
        b.setStatus(Ci.imIStatusInfo.STATUS_UNKNOWN, "");
      b.onAccountDisconnected();
    }

    for each (let muc in this._mucs)
      muc.left = true;

    for each (let request in this._pendingAuthRequests)
      request.cancel();
    this._pendingAuthRequests = [];

    this._connection.disconnect();
    delete this._connection;

    // We won't receive "user-icon-changed" notifications while the
    // account isn't connected, so clear the cache to avoid keeping an
    // obsolete icon.
    delete this._cachedUserIcon;

    this.reportDisconnected();
  },

  /* Set the user status on the server */
  _sendPresence: function() {
    delete this._shouldSendPresenceForIdlenessChange;

    if (!this._connection)
      return;

    let si = this.imAccount.statusInfo;
    let statusType = si.statusType;
    let show = "";
    if (statusType == Ci.imIStatusInfo.STATUS_UNAVAILABLE)
      show = "dnd";
    else if (statusType == Ci.imIStatusInfo.STATUS_AWAY ||
             statusType == Ci.imIStatusInfo.STATUS_IDLE)
      show = "away";
    let children = [];
    if (show)
      children.push(Stanza.node("show", null, null, show));
    let statusText = si.statusText;
    if (statusText)
      children.push(Stanza.node("status", null, null, statusText));
    if (this._idleSince) {
      let time = Math.floor(Date.now() / 1000) - this._idleSince;
      children.push(Stanza.node("query", Stanza.NS.last, {seconds: time}));
    }
    this._connection.sendStanza(Stanza.presence({"xml:lang": "en"}, children));
  },

  _cachingUserIcon: false,
  _cacheUserIcon: function() {
    let userIcon = this.imAccount.statusInfo.getUserIcon();
    if (!userIcon) {
      this._cachedUserIcon = null;
      this._sendVCard();
      return;
    }

    this._cachingUserIcon = true;
    let channel = Services.io.newChannelFromURI(userIcon);
    NetUtil.asyncFetch(channel, (function(inputStream, resultCode) {
      if (!Components.isSuccessCode(resultCode))
        return;
      try {
        let readImage = {value: null};
        let type = channel.contentType;
        imgTools.decodeImageData(inputStream, type, readImage);
        readImage = readImage.value;
        let scaledImage;
        if (readImage.width <= 96 && readImage.height <= 96)
          scaledImage = imgTools.encodeImage(readImage, type);
        else {
          if (type != "image/jpeg")
            type = "image/png";
          scaledImage = imgTools.encodeScaledImage(readImage, type, 64, 64);
        }

        let bstream = Components.classes["@mozilla.org/binaryinputstream;1"].
                      createInstance(Ci.nsIBinaryInputStream);
        bstream.setInputStream(scaledImage);

        let data = bstream.readBytes(bstream.available());
        this._cachedUserIcon = {
          type: type,
          binval: btoa(data).replace(/.{74}/g, "$&\n")
        };
      } catch (e) {
        Components.utils.reportError(e);
        this._cachedUserIcon = null;
      }
      delete this._cachingUserIcon;
      this._sendVCard();
    }).bind(this));
  },
  _sendVCard: function() {
    if (!this._connection)
      return;

    if (!this.hasOwnProperty("_cachedUserIcon")) {
      if (!this._cachingUserIcon)
        this._cacheUserIcon();
      return;
    }

    let vCardEntries = [];
    let displayName = this.imAccount.statusInfo.displayName;
    if (displayName)
      vCardEntries.push(Stanza.node("FN", Stanza.NS.vcard, null, displayName));
    if (this._cachedUserIcon) {
      let photoChildren = [
        Stanza.node("TYPE", Stanza.NS.vcard, null, this._cachedUserIcon.type),
        Stanza.node("BINVAL", Stanza.NS.vcard, null, this._cachedUserIcon.binval)
      ];
      vCardEntries.push(Stanza.node("PHOTO", Stanza.NS.vcard, null,
                                    photoChildren));
    }
    let s = Stanza.iq("set", null, null,
                      Stanza.node("vCard", Stanza.NS.vcard, null, vCardEntries));

    this._connection.sendStanza(s);
  }
};
