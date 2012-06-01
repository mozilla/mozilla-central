/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/ircUtils.jsm");
Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");
Cu.import("resource:///modules/socket.jsm");

/*
 * Parses a raw IRC message into an object (see section 2.3 of RFC 2812). This
 * returns an object with the following fields:
 *   rawMessage The initial message string received without any processing.
 *   command    A string that is the command or response code.
 *   params     An array of strings for the parameters. The last parameter is
 *              stripped of its : prefix.
 * If the message is from a user:
 *   nickname   The user's nickname.
 *   user       The user's username, note that this can be undefined.
 *   host       The user's hostname, note that this can be undefined.
 *   source     A "nicely" formatted combination of user & host, which is
 *              <user>@<host> or <user> if host is undefined.
 * Otherwise if it's from a server:
 *   servername This is the address of the server as a host (e.g.
 *              irc.mozilla.org) or an IPv4 address (e.g. 1.2.3.4) or IPv6
 *              address (e.g. 3ffe:1900:4545:3:200:f8ff:fe21:67cf).
 */
function ircMessage(aData) {
  LOG(aData);
  let message = {rawMessage: aData};
  let temp, prefix;

  // Splits the raw string into four parts (the second is required), the command
  // is required. A raw string looks like:
  //   [":" <prefix> " "] <command> [" " <parameter>]* [":" <last parameter>]
  //     <prefix>: :(<server name> | <nickname> [["!" <user>] "@" <host>])
  //     <command>: /[^ ]+/
  //     <parameter>: /[^ ]+/
  //     <last parameter>: /.+/
  // See http://joshualuckers.nl/2010/01/10/regular-expression-to-match-raw-irc-messages/
  if ((temp = aData.match(/^(?::([^ ]+) )?([^ ]+)(?: ((?:[^: ][^ ]* ?)*))?(?: ?:(.*))?$/))) {
    // Assume message is from the server if not specified
    prefix = temp[1];
    message.command = temp[2];
    // Space separated parameters
    message.params = temp[3] ? temp[3].trim().split(/ +/) : [];
    // Last parameter can contain spaces or be an empty string.
    if (temp[4] != undefined)
      message.params.push(temp[4]);

    // The source string can be split into multiple parts as:
    //   :(server|nickname[[!user]@host]
    // If the source contains a . or a :, assume it's a server name. See RFC
    // 2812 Section 2.3 definition of servername vs. nickname.
    if (prefix &&
        (temp = prefix.match(/^([^ !@\.:]+)(?:!([^ @]+))?(?:@([^ ]+))?$/))) {
      message.nickname = temp[1];
      message.user = temp[2] || null; // Optional
      message.host = temp[3] || null; // Optional
      if (message.user)
        message.source = message.user + "@" + message.host;
      else
        message.source = message.host; // Note: this can be null!
    }
    else if (prefix)
      message.servername = prefix;
  }

  return message;
}

// This handles a mode change string for both channels and participants. A mode
// change string is of the form:
//   ("+" | "-")<mode key>[<mode key>]*
// e.g. +iaw or -i
function _setMode(aNewMode) {
  // Are we going to add or remove the modes?
  if (aNewMode[0] != "+" && aNewMode[0] != "-") {
    WARN("Invalid mode string: " + aNewMode);
    return;
  }
  let addNewMode = aNewMode[0] == "+";

  // Check each mode being added and update the user
  for (let i = 1; i < aNewMode.length; ++i) {
    let index = this._modes.indexOf(aNewMode[i]);
    // If the mode is in the list of modes and we want to remove it.
    if (index != -1 && !addNewMode)
      this._modes.splice(index, 1);
    // If the mode is not in the list of modes and we want to add it.
    else if (index == -1 && addNewMode)
      this._modes.push(aNewMode[i]);
  }
}

function ircChannel(aAccount, aName, aNick) {
  this._init(aAccount, aName, aNick);
  this._modes = [];
  this._observedNicks = [];
}
ircChannel.prototype = {
  __proto__: GenericConvChatPrototype,
  _modes: [],
  _receivedInitialMode: false,
  _observedNicks: [],
  // This is set to true after a message is sent to notify the 401
  // ERR_NOSUCHNICK handler to write an error message to the conversation.
  _pendingMessage: false,

  sendMsg: function(aMessage) {
    this._account.sendMessage("PRIVMSG", [this.name, aMessage]);

    // Since we don't receive a message back from the server, just assume it
    // was received and write it. An IRC bouncer will send us our message back
    // though, try to handle that.
    if (this.hasParticipant(this._account._nickname))
      this.writeMessage(this.nick, aMessage, {outgoing: true});

    this._pendingMessage = true;
  },
  // Overwrite the writeMessage function to apply CTCP formatting before
  // display.
  writeMessage: function(aWho, aText, aProperties) {
    GenericConvChatPrototype.writeMessage.call(this, aWho,
                                               ctcpFormatToHTML(aText),
                                               aProperties);
  },

  // Section 3.2.2 of RFC 2812.
  part: function(aMessage) {
    let params = [this.name];

    // If a valid message was given, use it as the part message.
    // Otherwise, fall back to the default part message, if it exists.
    let msg = aMessage || this._account.getString("partmsg");
    if (msg)
      params.push(msg);

    this._account.sendMessage("PART", params);
  },

  close: function() {
    // Part the room if we're connected.
    if (this._account.connected && !this.left)
      this.part();
    GenericConvChatPrototype.close.call(this);
  },

  unInit: function() {
    this._account.removeConversation(this.name);
    GenericConvChatPrototype.unInit.call(this);
    if (this._observedNicks.length)
      Services.obs.removeObserver(this, "user-info-received");
  },

  getNormalizedChatBuddyName: function(aNick)
    this._account.normalize(aNick, this._account.userPrefixes),

  hasParticipant: function(aNick)
    hasOwnProperty(this._participants, this.getNormalizedChatBuddyName(aNick)),

  getParticipant: function(aNick, aNotifyObservers) {
    let normalizedNick = this.getNormalizedChatBuddyName(aNick);
    if (this.hasParticipant(aNick))
      return this._participants[normalizedNick];

    let participant = new ircParticipant(aNick, this);
    this._participants[normalizedNick] = participant;

    // Add the participant to the whois table if it is not already there.
    this._account.setWhoisFromNick(participant._name);

    if (aNotifyObservers) {
      this.notifyObservers(new nsSimpleEnumerator([participant]),
                           "chat-buddy-add");
    }
    return participant;
  },
  updateNick: function(aOldNick, aNewNick) {
    let isParticipant = this.hasParticipant(aOldNick);
    if (this._account.normalize(aOldNick) == this._account.normalize(this.nick)) {
      // If this is the user's nick, change it.
      this.nick = aNewNick;
      // If the account was disconnected, it's OK the user is not a participant.
      if (!isParticipant)
        return;
    }
    else if (!isParticipant) {
      ERROR("Trying to rename nick that doesn't exist! " + aOldNick + " to " +
            aNewNick);
      return;
    }

    // Get the original ircParticipant and then remove it.
    let participant = this.getParticipant(aOldNick);
    this.removeParticipant(aOldNick);

    // Update the nickname and add it under the new nick.
    participant._name = aNewNick;
    this._participants[this.getNormalizedChatBuddyName(aNewNick)] = participant;

    this.notifyObservers(participant, "chat-buddy-update", aOldNick);
  },
  removeParticipant: function(aNick, aNotifyObservers) {
    if (!this.hasParticipant(aNick))
      return;

    if (aNotifyObservers) {
      let stringNickname = Cc["@mozilla.org/supports-string;1"]
                              .createInstance(Ci.nsISupportsString);
      stringNickname.data = aNick;
      this.notifyObservers(new nsSimpleEnumerator([stringNickname]),
                           "chat-buddy-remove");
    }
    delete this._participants[this.getNormalizedChatBuddyName(aNick)];
  },
  // Use this before joining to avoid errors of trying to re-add an existing
  // participant
  removeAllParticipants: function() {
    let stringNicknames = [];
    for (let nickname in this._participants) {
      let stringNickname = Cc["@mozilla.org/supports-string;1"]
                              .createInstance(Ci.nsISupportsString);
      stringNickname.data = this._participants[nickname].name;
      stringNicknames.push(stringNickname);
    }
    this.notifyObservers(new nsSimpleEnumerator(stringNicknames),
                         "chat-buddy-remove");
    this._participants = {};
  },

  setMode: function(aNewMode, aMessage) {
    _setMode.call(this, aNewMode);

    // Notify the UI of changes, this message can come from the server or
    // from a user.
    let source = aMessage.nickname || aMessage.servername;
    let msg = _("message.mode", this.name, aNewMode, source);
    this.writeMessage(source, msg, {system: true});
    this.checkTopicSettable();

    this._receivedInitialMode = true;
  },

  setModesFromRestriction: function(aRestriction) {
    // First remove all types from the list of modes.
    for each (let mode in this._account.channelRestrictionToModeMap) {
      let index = this._modes.indexOf(mode);
      this._modes.splice(index, index != -1);
    }

    // Add the new mode onto the list.
    if (aRestriction in this._account.channelRestrictionToModeMap) {
      let mode = this._account.channelRestrictionToModeMap[aRestriction];
      if (mode)
        this._modes.push(mode);
    }
  },

  get topic() this._topic, // can't add a setter without redefining the getter
  set topic(aTopic) {
    this._account.sendMessage("TOPIC", [this.name, aTopic]);
  },
  _previousTopicSettable: null,
  checkTopicSettable: function() {
    if (this.topicSettable == this._previousTopicSettable &&
        this._previousTopicSettable != null)
      return;

    this.notifyObservers(this, "chat-update-topic");
  },
  get topicSettable() {
    // If we're not in the room yet, we don't exist.
    if (!this.hasParticipant(this.nick))
      return false;

    // If the channel mode is +t, hops and ops can set the topic; otherwise
    // everyone can.
    let participant = this.getParticipant(this.nick);
    return this._modes.indexOf("t") == -1 || participant.op ||
           participant.halfOp;
  },

  get normalizedName() this._account.normalize(this.name),

  requestBuddyInfo: function(aNick) {
    if (!this._observedNicks.length)
      Services.obs.addObserver(this, "user-info-received", false);
    this._observedNicks.push(this._account.normalize(aNick));
    this._account.requestBuddyInfo(aNick);
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "user-info-received")
      return;

    let nickIndex = this._observedNicks.indexOf(this._account.normalize(aData));
    if (nickIndex == -1)
      return;
    this._observedNicks.splice(nickIndex, 1);
    if (!this._observedNicks.length)
      Services.obs.removeObserver(this, "user-info-received");
    this._account.writeWhois(this, aData,
                             aSubject.QueryInterface(Ci.nsISimpleEnumerator));
  }
};

function ircParticipant(aName, aConv) {
  this._name = aName;
  this._conv = aConv;
  this._account = aConv._account;
  this._modes = [];

  if (this._name[0] in this._account.userPrefixToModeMap) {
    this._modes.push(this._account.userPrefixToModeMap[this._name[0]]);
    this._name = this._name.slice(1);
  }
}
ircParticipant.prototype = {
  __proto__: GenericConvChatBuddyPrototype,

  setMode: function(aNewMode, aSetter) {
    _setMode.call(this, aNewMode);

    // Notify the UI of changes.
    let msg = _("message.mode", this.name, aNewMode, aSetter);
    this._conv.writeMessage(aSetter, msg, {system: true});
    this._conv.notifyObservers(this, "chat-buddy-update");

    // In case the new mode now lets us edit the topic.
    if (this._account.normalize(this.name) ==
        this._account.normalize(this._account._nickname))
      this._conv.checkTopicSettable();
  },

  get voiced() this._modes.indexOf("v") != -1,
  get halfOp() this._modes.indexOf("h") != -1,
  get op() this._modes.indexOf("o") != -1,
  get founder() this._modes.indexOf("n") != -1,
  get typing() false
};

function ircConversation(aAccount, aName) {
  this.buddy = aAccount.getBuddy(aName);
  let nick = aAccount.normalize(aName);
  if (hasOwnProperty(aAccount.whoisInformation, nick))
    aName = aAccount.whoisInformation[nick]["nick"];

  this._init(aAccount, aName);
  this._observedNicks = [];

  // Fetch correctly capitalized name.
  // Always request the info as it may be out of date.
  this._waitingForNick = true;
  this.requestBuddyInfo(aName);
}
ircConversation.prototype = {
  __proto__: GenericConvIMPrototype,
  _observedNicks: [],
  _waitingForNick: false,
  // This is set to true after a message is sent to notify the 401
  // ERR_NOSUCHNICK handler to write an error message to the conversation.
  _pendingMessage: false,

  sendMsg: function(aMessage) {
    this._account.sendMessage("PRIVMSG", [this.name, aMessage]);

    // Since the server doesn't send us a message back, just assume the message
    // was received and immediately show it.
    this.writeMessage(this._account._nickname, aMessage, {outgoing: true});

    this._pendingMessage = true;
  },

  // Overwrite the writeMessage function to apply CTCP formatting before
  // display.
  writeMessage: function(aWho, aText, aProperties) {
    GenericConvIMPrototype.writeMessage.call(this, aWho,
                                             ctcpFormatToHTML(aText),
                                             aProperties);
  },

  get normalizedName() this._account.normalize(this.name),

  unInit: function() {
    this._account.removeConversation(this.name);
    GenericConvIMPrototype.unInit.call(this);
    if (this._observedNicks.length)
      Services.obs.removeObserver(this, "user-info-received");
  },

  updateNick: function(aNewNick) {
    this._name = aNewNick;
    this.notifyObservers(null, "update-conv-title");
  },

  requestBuddyInfo: function(aNick) {
    if (!this._observedNicks.length)
      Services.obs.addObserver(this, "user-info-received", false);
    this._observedNicks.push(this._account.normalize(aNick));
    this._account.requestBuddyInfo(aNick);
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "user-info-received")
      return;

    let nick = this._account.normalize(aData);
    let nickIndex = this._observedNicks.indexOf(nick);
    if (nickIndex == -1)
      return;
    this._observedNicks.splice(nickIndex, 1);
    if (!this._observedNicks.length)
      Services.obs.removeObserver(this, "user-info-received");

    // If we are waiting for the conversation name, set it.
    if (this._waitingForNick && nick == this.normalizedName) {
      if (hasOwnProperty(this._account.whoisInformation, nick))
        this.updateNick(this._account.whoisInformation[nick]["nick"]);
      delete this._waitingForNick;
      return;
    }

    // Otherwise, print the requested whois information.
    this._account.writeWhois(this, aData,
                             aSubject.QueryInterface(Ci.nsISimpleEnumerator));
  }
};

function ircSocket(aAccount) {
  this._account = aAccount;
  this._initCharsetConverter();
}
ircSocket.prototype = {
  __proto__: Socket,
  delimiter: "\r\n",
  connectTimeout: 60, // Failure to connect after 1 minute
  readWriteTimeout: 300, // Failure when no data for 5 minutes
  _converter: null,

  _initCharsetConverter: function() {
    this._converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                        .createInstance(Ci.nsIScriptableUnicodeConverter);
    try {
      this._converter.charset = this._account._encoding;
    } catch (e) {
      delete this._converter;
      ERROR("Failed to set character set to: " + this._account._encoding + " for " +
            this._account.name + ".");
    }
  },

  // Implement Section 5 of RFC 2812.
  onDataReceived: function(aRawMessage) {
    DEBUG(aRawMessage);
    if (this._converter) {
      try {
        aRawMessage = this._converter.ConvertToUnicode(aRawMessage);
      } catch (e) {
        WARN("This message doesn't seem to be " + this._account._encoding +
             " encoded: " + aRawMessage);
        // Unfortunately, if the unicode converter failed once,
        // it will keep failing so we need to reinitialize it.
        this._initCharsetConverter();
      }
    }

    // If nothing handled the message, throw an error.
    if (!ircHandlers.handleMessage(this._account, new ircMessage(aRawMessage)))
      WARN("Unhandled IRC message: " + aRawMessage);
  },
  onConnection: function() {
    this._account._connectionRegistration.call(this._account);
  },

  // Throw errors if the socket has issues.
  onConnectionClosed: function () {
    if (!this._account.imAccount || this._account.disconnecting ||
        this._account.disconnected)
      return;

    ERROR("Connection closed by server.");
    this._account.gotDisconnected(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                                  _("connection.error.lost"));
  },
  onConnectionReset: function () {
    ERROR("Connection reset.");
    this._account.gotDisconnected(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                                  _("connection.error.lost"));
  },
  onConnectionTimedOut: function() {
    ERROR("Connection timed out.");
    this._account.gotDisconnected(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                                  _("connection.error.timeOut"));
  },
  onCertificationError: function(aSocketInfo, aStatus, aTargetSite) {
    ERROR("Certification error.");
    this._account.gotDisconnected(Ci.prplIAccount.ERROR_CERT_OTHER_ERROR,
                                  _("connection.error.certError"));
  },
  log: LOG
};

function ircAccountBuddy(aAccount, aBuddy, aTag, aUserName) {
  this._init(aAccount, aBuddy, aTag, aUserName);
}
ircAccountBuddy.prototype = {
  __proto__: GenericAccountBuddyPrototype,

  // Returns a list of imITooltipInfo objects to be displayed when the user
  // hovers over the buddy.
  getTooltipInfo: function() this._account.getBuddyInfo(this.normalizedName),

  get normalizedName() this._account.normalize(this.userName),

  // Can not send messages to buddies who appear offline.
  get canSendMessage() this.account.connected,

  // Called when the user wants to chat with the buddy.
  createConversation: function() this._account.createConversation(this.userName)
};

function ircAccount(aProtocol, aImAccount) {
  this._buddies = {};
  this._init(aProtocol, aImAccount);
  this._conversations = {};

  // Split the account name into usable parts.
  let splitter = aImAccount.name.lastIndexOf("@");
  this._nickname = aImAccount.name.slice(0, splitter);
  this._originalNickname = this._nickname;
  this._server = aImAccount.name.slice(splitter + 1);

  // For more information, see where these are defined in the prototype below.
  this._isOnQueue = [];
  this.pendingIsOnQueue = [];
  this.whoisInformation = {};
}
ircAccount.prototype = {
  __proto__: GenericAccountPrototype,
  _socket: null,
  _originalNickname: null,
  _MODE_WALLOPS: 1 << 2, // mode 'w'
  _MODE_INVISIBLE: 1 << 3, // mode 'i'
  get _mode() 0,

  get noNewlines() true,

  get normalizedName() this.normalize(this.name),

  // Parts of the specification give max lengths, keep track of them since a
  // server can overwrite them. The defaults given here are from RFC 2812.
  maxNicknameLength: 9, // 1.2.1 Users
  maxChannelLength: 50, // 1.3 Channels
  maxMessageLength: 512, // 2.3 Messages
  maxHostnameLength: 63, // 2.3.1 Message format in Augmented BNF

  // The default prefixes.
  userPrefixes: ["@", "!", "%", "+"],
  // The default prefixes to modes.
  userPrefixToModeMap: {"@": "o", "!": "n", "%": "h", "+": "v"},
  channelPrefixes: ["&", "#", "+", "!"], // 1.3 Channels
  channelRestrictionToModeMap: {"@": "s", "*": "p", "=": null}, // 353 RPL_NAMREPLY

  // Handle Scandanavian lower case (optionally remove status indicators).
  // See Section 2.2 of RFC 2812: the characters {}|^ are considered to be the
  // lower case equivalents of the characters []\~, respectively.
  normalize: function(aStr, aPrefixes) {
    let str = aStr;
    if (aPrefixes && aPrefixes.indexOf(aStr[0]) != -1)
      str = str.slice(1);

    return str.replace(/[\x41-\x5E]/g,
                       function(c) String.fromCharCode(c.charCodeAt(0) + 0x20));
  },

  isMUCName: function(aStr) {
    return (this.channelPrefixes.indexOf(aStr[0]) != -1);
  },

  // Tell the server about status changes. IRC is only away or not away;
  // consider the away, idle and unavailable status type to be away.
  isAway: false,
  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "status-changed")
      return;

    let {statusType: type, statusText: text} = this.imAccount.statusInfo;
    DEBUG("New status received:\ntype = " + type + "\ntext = " + text);

    // Tell the server to mark us as away.
    if (type < Ci.imIStatusInfo.STATUS_AVAILABLE) {
      // We have to have a string in order to set IRC as AWAY.
      if (!text) {
        // If no status is given, use the the default idle/away message.
        const IDLE_PREF_BRANCH = "messenger.status.";
        const IDLE_PREF = "defaultIdleAwayMessage";
        text = Services.prefs.getComplexValue(IDLE_PREF_BRANCH + IDLE_PREF,
                                              Ci.nsIPrefLocalizedString).data;

        if (!text) {
          // Get the default value of the localized preference.
          text = Services.prefs.getDefaultBranch(IDLE_PREF_BRANCH)
                         .getComplexValue(IDLE_PREF,
                                          Ci.nsIPrefLocalizedString).data;
        }
        // The last resort, fallback to a non-localized string.
        if (!text)
          text = "Away";
      }
      this.sendMessage("AWAY", text); // Mark as away.
    }
    else if (type == Ci.imIStatusInfo.STATUS_AVAILABLE && this.isAway)
      this.sendMessage("AWAY"); // Mark as back.
  },

  // The whois information: nicks are used as keys and refer to a map of field
  // to value.
  whoisInformation: {},
  // Request WHOIS information on a buddy when the user requests more
  // information.
  requestBuddyInfo: function(aBuddyName) {
    if (!this.connected)
      return;

    this.removeBuddyInfo(aBuddyName);
    this.sendMessage("WHOIS", aBuddyName);
  },
  // Request WHOWAS information on a buddy when the user requests more
  // information.
  requestOfflineBuddyInfo: function(aBuddyName) {
    this.removeBuddyInfo(aBuddyName);
    this.sendMessage("WHOWAS", aBuddyName);
  },
  // Return an nsISimpleEnumerator of imITooltipInfo for a given nick.
  getBuddyInfo: function(aNick) {
    let nick = this.normalize(aNick);
    if (!hasOwnProperty(this.whoisInformation, nick))
      return EmptyEnumerator;

    let whoisInformation = this.whoisInformation[nick];
    let tooltipInfo = [];
    for (let field in whoisInformation) {
      if (field != "nick" && field != "offline") {
        let value = whoisInformation[field];
        tooltipInfo.push(new TooltipInfo(_("tooltip." + field), value));
      }
    }

    return new nsSimpleEnumerator(tooltipInfo);
  },
  // Remove a WHOIS entry.
  removeBuddyInfo: function(aNick) {
    let nick = this.normalize(aNick);
    if (hasOwnProperty(this.whoisInformation, nick))
      delete this.whoisInformation[nick];
  },
  // Set minimal WHOIS entry containing only the capitalized nick,
  // if no WHOIS info exists already.
  setWhoisFromNick: function(aNick) {
    let nick = this.normalize(aNick);
    if (!hasOwnProperty(this.whoisInformation, nick))
      this.whoisInformation[nick] = {"nick": aNick};
  },
  // Write WHOIS information to a conversation.
  writeWhois: function(aConv, aNick, aTooltipInfo) {
    let nick = this.normalize(aNick);
    // RFC 2812 errors 401 and 406 result in there being no entry for the nick.
    if (!hasOwnProperty(this.whoisInformation, nick)) {
      aConv.writeMessage(null, _("message.unknownNick", nick), {system: true});
      return;
    }
    // If the nick is offline, tell the user. In that case, it's WHOWAS info.
    let msgType = "message.whois";
    if ("offline" in this.whoisInformation[nick])
      msgType = "message.whowas";
    let msg = _(msgType, this.whoisInformation[nick]["nick"]);
    while (aTooltipInfo.hasMoreElements()) {
      let elt = aTooltipInfo.getNext().QueryInterface(Ci.prplITooltipInfo);
      switch (elt.type) {
        case Ci.prplITooltipInfo.pair:
        case Ci.prplITooltipInfo.sectionHeader:
          msg += "\n" + _("message.whoisEntry", elt.label, elt.value);
          break;
        case Ci.prplITooltipInfo.sectionBreak:
          break;
      }
    }
    aConv.writeMessage(null, msg, {system: true});
  },

  trackBuddy: function(aNick) {
    // Put the username as the first to be checked on the next ISON call.
    this._isOnQueue.unshift(aNick);
  },
  addBuddy: function(aTag, aName) {
    let buddy = new ircAccountBuddy(this, null, aTag, aName);
    this._buddies[buddy.normalizedName] = buddy;
    this.trackBuddy(buddy.userName);

    Services.contacts.accountBuddyAdded(buddy);
  },
  // Loads a buddy from the local storage. Called for each buddy locally stored
  // before connecting to the server.
  loadBuddy: function(aBuddy, aTag) {
    let buddy = new ircAccountBuddy(this, aBuddy, aTag);
    this._buddies[buddy.normalizedName] = buddy;
    this.trackBuddy(buddy.userName);

    return buddy;
  },
  hasBuddy: function(aName)
    hasOwnProperty(this._buddies, this.normalize(aName, this.userPrefixes)),
  // Return an array of buddy names.
  getBuddyNames: function() {
    let buddies = [];
    for each (let buddyName in Object.keys(this._buddies))
      buddies.push(this._buddies[buddyName].userName);
    return buddies;
  },
  getBuddy: function(aName) {
    if (this.hasBuddy(aName))
      return this._buddies[this.normalize(aName, this.userPrefixes)];
    return null;
  },
  changeBuddyNick: function(aOldNick, aNewNick) {
    let msg;
    if (this.normalize(aOldNick) == this.normalize(this._nickname)) {
      // Your nickname changed!
      this._nickname = aNewNick;
      msg = _("message.nick.you", aNewNick);
      for each (let conversation in this._conversations) {
        // Update the nick for chats, and inform the user in every conversation.
        if (conversation.isChat)
          conversation.updateNick(aOldNick, aNewNick);
        conversation.writeMessage(aOldNick, msg, {system: true});
      }
    }
    else {
      msg = _("message.nick", aOldNick, aNewNick);
      for each (let conversation in this._conversations) {
        if (conversation.isChat && conversation.hasParticipant(aOldNick)) {
          // Update the nick in every chat conversation it is in.
          conversation.updateNick(aOldNick, aNewNick);
          conversation.writeMessage(aOldNick, msg, {system: true});
        }
      }
    }

    // Adjust the whois table where necessary.
    this.removeBuddyInfo(aOldNick);
    this.setWhoisFromNick(aNewNick);

    // If a private conversation is open with that user, change its title.
    if (this.hasConversation(aOldNick)) {
      // Get the current conversation and rename it.
      let conversation = this.getConversation(aOldNick);

      // Remove the old reference to the conversation and create a new one.
      this.removeConversation(aOldNick);
      this._conversations[this.normalize(aNewNick)] = conversation;

      conversation.updateNick(aNewNick);
      conversation.writeMessage(aOldNick, msg, {system: true});
    }
  },

  countBytes: function(aStr) {
    // Assume that if it's not UTF-8 then each character is 1 byte.
    if (this._encoding != "UTF-8")
      return aStr.length;

    // Count the number of bytes in a UTF-8 encoded string.
    function charCodeToByteCount(c) {
      // UTF-8 stores:
      // - code points below U+0080 on 1 byte,
      // - code points below U+0800 on 2 bytes,
      // - code points U+D800 through U+DFFF are UTF-16 surrogate halves
      // (they indicate that JS has split a 4 bytes UTF-8 character
      // in two halves of 2 bytes each),
      // - other code points on 3 bytes.
      return c < 0x80 ? 1 : (c < 0x800 || (c >= 0xD800 && c <= 0xDFFF)) ? 2 : 3;
    }
    let bytes = 0;
    for (let i = 0; i < aStr.length; i++)
      bytes += charCodeToByteCount(aStr.charCodeAt(i));
    return bytes;
  },

  // To check if users are online, we need to queue multiple messages.
  // An internal queue of all nicks that we wish to know the status of.
  _isOnQueue: [],
  // The nicks that were last sent to the server that we're waiting for a
  // response about.
  pendingIsOnQueue: [],
  // The time between sending isOn messages (milliseconds).
  _isOnDelay: 60 * 1000,
  _isOnTimer: null,
  // The number of characters that are available to be filled with nicks for
  // each ISON message.
  _isOnLength: null,
  // Generate and send an ISON message to poll for each nick's status.
  sendIsOn: function() {
    // Add any previously pending queue to the end of the ISON queue.
    if (this.pendingIsOnQueue)
      this._isOnQueue = this._isOnQueue.concat(this.pendingIsOnQueue);

    // If no buddies, just look again after the timeout.
    if (this._isOnQueue.length) {
      // Calculate the possible length of names we can send.
      if (!this._isOnLength) {
        let length = this.countBytes(this.buildMessage("ISON", " ")) + 2;
        this._isOnLength = this.maxMessageLength - length + 1;
      }

      // Always add the next nickname to the pending queue, this handles a silly
      // case where the next nick is greater than or equal to the maximum
      // message length.
      this.pendingIsOnQueue = [this._isOnQueue.shift()];

      // Attempt to maximize the characters used in each message, this may mean
      // that a specific user gets sent very often since they have a short name!
      let buddiesLength = this.countBytes(this.pendingIsOnQueue[0]);
      for (let i = 0; i < this._isOnQueue.length; i++) {
        // If we can fit the nick, add it to the current buffer.
        if ((buddiesLength + this.countBytes(this._isOnQueue[i])) < this._isOnLength) {
          // Remove the name from the list and add it to the pending queue.
          let nick = this._isOnQueue.splice(i--, 1)[0];
          this.pendingIsOnQueue.push(nick);

          // Keep track of the length of the string, the + 1 is for the spaces.
          buddiesLength += this.countBytes(nick) + 1;

          // If we've filled up the message, stop looking for more nicks.
          if (buddiesLength >= this._isOnLength)
            break;
        }
      }

      // Send the message.
      this.sendMessage("ISON", this.pendingIsOnQueue.join(" "));
    }

    // Call this function again in _isOnDelay seconds.
    // This makes the assumption that this._isOnDelay >> the response to ISON
    // from the server.
    this._isOnTimer = setTimeout(this.sendIsOn.bind(this), this._isOnDelay);
  },

  connect: function() {
    this.reportConnecting();

    // Load preferences.
    this._port = this.getInt("port");
    this._ssl = this.getBool("ssl");

    // Use the display name as the user's real name.
    this._realname = this.imAccount.statusInfo.displayName;
    this._encoding = this.getString("encoding") || "UTF-8";
    this._showServerTab = this.getBool("showServerTab");

    // Open the socket connection.
    this._socket = new ircSocket(this);
    this._socket.connect(this._server, this._port, this._ssl ? ["ssl"] : []);
  },

  // Used to wait for a response from the server.
  _quitTimer: null,
  // RFC 2812 Section 3.1.7.
  quit: function(aMessage) {
    this.reportDisconnecting(Ci.prplIAccount.NO_ERROR);
    this.sendMessage("QUIT",
                     aMessage || this.getString("quitmsg") || undefined);
  },
  // When the user clicks "Disconnect" in account manager
  disconnect: function() {
    if (this.disconnected || this.disconnecting)
       return;

    this.reportDisconnecting(Ci.prplIAccount.NO_ERROR);

    // If there's no socket, disconnect immediately to avoid waiting 2 seconds.
    if (!this._socket || !this._socket.isConnected) {
      this.gotDisconnected();
      return;
    }

    // Let the server know we're going to disconnect.
    this.quit();

    // Give the server 2 seconds to respond, otherwise just forcefully
    // disconnect the socket. This will be cancelled if a response is heard from
    // the server.
    this._quitTimer = setTimeout(this.gotDisconnected.bind(this), 2 * 1000);
  },

  createConversation: function(aName) this.getConversation(aName),

  // aComponents implements prplIChatRoomFieldValues.
  joinChat: function(aComponents) {
    let params = [aComponents.getValue("channel")];
    let password = aComponents.getValue("password");
    if (password)
      params.push(password);
    this.sendMessage("JOIN", params);
  },

  chatRoomFields: {
    "channel": {"label": _("joinChat.channel"), "required": true},
    "password": {"label": _("joinChat.password"), "isPassword": true}
  },

  parseDefaultChatName: function(aDefaultName) {
    let params = aDefaultName.split(" ");
    let chatFields = {channel: params[0]};
    if (params.length > 1)
      chatFields.password = params[1];
    return chatFields;
  },

  // Attributes
  get canJoinChat() true,

  hasConversation: function(aConversationName)
    hasOwnProperty(this._conversations, this.normalize(aConversationName)),

  // Returns a conversation (creates it if it doesn't exist)
  getConversation: function(aName) {
    let name = this.normalize(aName);
    if (!this.hasConversation(aName)) {
      let constructor = this.isMUCName(aName) ? ircChannel : ircConversation;
      this._conversations[name] = new constructor(this, aName, this._nickname);
    }
    return this._conversations[name];
  },

  removeConversation: function(aConversationName) {
    if (this.hasConversation(aConversationName))
      delete this._conversations[this.normalize(aConversationName)];
  },

  // This builds the message string that will be sent to the server.
  buildMessage: function(aCommand, aParams) {
    if (!aCommand) {
      ERROR("IRC messages must have a command.");
      return null;
    }

    // Ensure a command is only characters or numbers.
    if (!/^[A-Z0-9]+$/i.test(aCommand)) {
      ERROR("IRC command invalid: " + aCommand);
      return null;
    }

    let message = aCommand;
    // If aParams is empty, then use an empty array. If aParams is not an array,
    // consider it to be a single parameter and put it into an array.
    let params = !aParams ? [] : Array.isArray(aParams) ? aParams : [aParams];
    if (params.length) {
      if (params.slice(0, -1).some(function(p) p.indexOf(" ") != -1)) {
        ERROR("IRC parameters cannot have spaces: " + params.slice(0, -1));
        return null;
      }
      // Join the parameters with spaces. There are three cases in which the
      // last parameter ("trailing" in RFC 2812) must be prepended with a colon:
      //  1. If the last parameter contains a space.
      //  2. If the first character of the last parameter is a colon.
      //  3. If the last parameter is an empty string.
      let trailing = params.slice(-1)[0];
      if (!trailing.length || trailing.indexOf(" ") != -1 || trailing[0] == ":")
        params.push(":" + params.pop());
      message += " " + params.join(" ");
    }

    return message;
  },

  // Shortcut method to build & send a message at once. Use aLoggedData to log
  // something different than what is actually sent.
  sendMessage: function(aCommand, aParams, aLoggedData) {
    this.sendRawMessage(this.buildMessage(aCommand, aParams), aLoggedData);
  },

  // This sends a message over the socket and catches any errors. Use
  // aLoggedData to log something different than what is actually sent.
  sendRawMessage: function(aMessage, aLoggedData) {
    // TODO This should escape any characters that can't be used in IRC (e.g.
    // \001, \r\n).

    if (!this._socket || !this._socket.isConnected) {
      this.gotDisconnected(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                           _("connection.error.lost"));
    }

    let length = this.countBytes(aMessage) + 2;
    if (length > this.maxMessageLength) {
      // Log if the message is too long, but try to send it anyway.
      WARN("Message length too long (" + length + " > " +
           this.maxMessageLength + "\n" + aMessage);
    }

    try {
      this._socket.sendString(aMessage, this._encoding, aLoggedData);
    } catch (e) {
      try {
        WARN("Failed to convert " + aMessage + " from Unicode to " +
             this._encoding + ".");
        this._socket.sendData(aMessage, aLoggedData);
      } catch(e) {
        ERROR("Socket error: " + e);
        this.gotDisconnected(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                             _("connection.error.lost"));
      }
    }
  },

  // CTCP messages are \001<COMMAND> [<parameters>]*\001.
  sendCTCPMessage: function(aCommand, aParams, aTarget, aIsNotice) {
    // Combine the CTCP command and parameters into the single IRC param.
    let ircParam = "\x01" + aCommand;
    // If aParams is empty, then use an empty array. If aParams is not an array,
    // consider it to be a single parameter and put it into an array.
    let params = !aParams ? [] : Array.isArray(aParams) ? aParams : [aParams];
    if (params.length)
      ircParam += " " + params.join(" ");
    ircParam += "\x01";

    // Send the IRC message as a NOTICE or PRIVMSG.
    this.sendMessage(aIsNotice ? "NOTICE" : "PRIVMSG", [aTarget, ircParam]);
  },

  // Implement section 3.1 of RFC 2812
  _connectionRegistration: function() {
    // Send the password message, if provided (section 3.1.1).
    if (this.imAccount.password) {
      this.sendMessage("PASS", this.imAccount.password,
                       "PASS <password not logged>");
    }
    // Send the nick message (section 3.1.2).
    this.sendMessage("NICK", this._originalNickname);

    // Send the user message (section 3.1.3).
    // Use brandShortName as the username.
    let username =
      l10nHelper("chrome://branding/locale/brand.properties")("brandShortName");
    this.sendMessage("USER", [username, this._mode.toString(), "*",
                              this._realname || this._originalNickname]);
  },

  gotDisconnected: function(aError, aErrorMessage) {
    if (!this.imAccount || this.disconnected)
       return;

    if (aError === undefined)
      aError = Ci.prplIAccount.NO_ERROR;
    // If we are already disconnecting, this call to gotDisconnected
    // is when the server acknowledges our disconnection.
    // Otherwise it's because we lost the connection.
    if (!this.disconnecting)
      this.reportDisconnecting(aError, aErrorMessage);
    this._socket.disconnect();
    delete this._socket;

    clearTimeout(this._isOnTimer);
    delete this._isOnTimer;

    // Clean up each conversation: mark as left and remove participant.
    for each (let conversation in this._conversations) {
      if (conversation.isChat) {
        // Remove the user's nick and mark the conversation as left as that's
        // the final known state of the room.
        conversation.removeParticipant(this._nickname, true);
        conversation.left = true;
      }
    }

    // Mark all contacts on the account as having an unknown status.
    for each (let buddy in this._buddies)
      buddy.setStatus(Ci.imIStatusInfo.STATUS_UNKNOWN, "");

    // Clear whois table.
    this.whoisInformation = {};

    this.reportDisconnected();
  },

  remove: function() {
    for each (let conv in this._conversations)
      conv.close();
    delete this._conversations;
    for each (let buddy in this._buddies)
      buddy.remove();
    delete this._buddies;
  },

  unInit: function() {
    // Disconnect if we're online while this gets called.
    if (this._socket) {
      if (!this.disconnecting)
        this.quit();
      this._socket.disconnect();
    }
    delete this.imAccount;
    clearTimeout(this._isOnTimer);
    clearTimeout(this._quitTimer);
  }
};

function ircProtocol() {
  // ircCommands.jsm exports one variable: commands. Import this directly into
  // the protocol object.
  Cu.import("resource:///modules/ircCommands.jsm", this);
  this.registerCommands();

  // Register the standard handlers.
  let tempScope = {};
  Cu.import("resource:///modules/ircBase.jsm", tempScope);
  Cu.import("resource:///modules/ircISUPPORT.jsm", tempScope);
  Cu.import("resource:///modules/ircCTCP.jsm", tempScope);
  Cu.import("resource:///modules/ircDCC.jsm", tempScope);
  Cu.import("resource:///modules/ircServices.jsm", tempScope);

  // Extra features.
  Cu.import("resource:///modules/ircWatchMonitor.jsm", tempScope);

  // Register default IRC handlers (IRC base, CTCP).
  ircHandlers.registerHandler(tempScope.ircBase);
  ircHandlers.registerHandler(tempScope.ircISUPPORT);
  ircHandlers.registerHandler(tempScope.ircCTCP);
  ircHandlers.registerHandler(tempScope.ircServices);
  // Register default ISUPPORT handler (ISUPPORT base).
  ircHandlers.registerISUPPORTHandler(tempScope.isupportBase);
  // Register default CTCP handlers (CTCP base, DCC).
  ircHandlers.registerCTCPHandler(tempScope.ctcpBase);
  ircHandlers.registerCTCPHandler(tempScope.ctcpDCC);
  // Register default IRC Services handlers (IRC Services base).
  ircHandlers.registerServicesHandler(tempScope.servicesBase);

  // Register extra features.
  ircHandlers.registerHandler(tempScope.ircWATCH);
  ircHandlers.registerISUPPORTHandler(tempScope.isupportWATCH);
  ircHandlers.registerHandler(tempScope.ircMONITOR);
  ircHandlers.registerISUPPORTHandler(tempScope.isupportMONITOR);
}
ircProtocol.prototype = {
  __proto__: GenericProtocolPrototype,
  get name() "IRC",
  get iconBaseURI() "chrome://prpl-irc/skin/",
  get baseId() "prpl-irc",

  usernameSplits: [
    {label: _("options.server"), separator: "@",
     defaultValue: "chat.freenode.net", reverse: true}
  ],

  options: {
    // TODO Default to IRC over SSL.
    "port": {label: _("options.port"), default: 6667},
    "ssl": {label: _("options.ssl"), default: false},
    // TODO We should attempt to auto-detect encoding instead.
    "encoding": {label: _("options.encoding"), default: "UTF-8"},
    "quitmsg": {label: _("options.quitMessage"),
                get default() Services.prefs.getCharPref("chat.irc.defaultQuitMessage")},
    "partmsg": {label: _("options.partMessage"), default: ""},
    "showServerTab": {label: _("options.showServerTab"), default: false}
  },

  get chatHasTopic() true,
  get slashCommandsNative() true,
  //  Passwords in IRC are optional, and are needed for certain functionality.
  get passwordOptional() true,

  getAccount: function(aImAccount) new ircAccount(this, aImAccount),
  classID: Components.ID("{607b2c0b-9504-483f-ad62-41de09238aec}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([ircProtocol]);
