/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This implements the Client-to-Client Protocol (CTCP), a subprotocol of IRC.
 *   REVISED AND UPDATED CTCP SPECIFICATION
 *     http://www.alien.net.au/irc/ctcp.txt
 */

const EXPORTED_SYMBOLS = ["ircCTCP", "ctcpBase"];

const Cu = Components.utils;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "PluralForm", function() {
  Cu.import("resource://gre/modules/PluralForm.jsm");
  return PluralForm;
});

// Split into a CTCP message which is a single command and a single parameter:
//   <command> " " <parameter>
// The high level dequote is to unescape \001 in the message content.
function CTCPMessage(aMessage, aRawCTCPMessage) {
  let message = aMessage;
  message.ctcp = {};
  message.ctcp.rawMessage = aRawCTCPMessage;

  // High/CTCP level dequote: replace the quote char \134 followed by a or \134
  // with \001 or \134, respectively. Any other character after \134 is replaced
  // with itself.
  let dequotedCTCPMessage = message.ctcp.rawMessage.replace(/\x5C./g,
    function(aStr) (aStr[1] == "a") ? "\x01" : aStr[1]);

  let separator = dequotedCTCPMessage.indexOf(" ");
  // If there's no space, then only a command is given.
  // Do not capitalize the command, case sensitive
  if (separator == -1) {
    message.ctcp.command = dequotedCTCPMessage;
    message.ctcp.param = "";
  }
  else {
    message.ctcp.command = dequotedCTCPMessage.slice(0, separator);
    message.ctcp.param = dequotedCTCPMessage.slice(separator + 1);
  }
  return message;
}


// This is the CTCP handler for IRC protocol, it will call each CTCP handler.
var ircCTCP = {
  name: "CTCP",
  // Slightly above default RFC 2812 priority.
  priority: ircHandlers.HIGH_PRIORITY,
  isEnabled: function() true,

  // CTCP uses only PRIVMSG and NOTICE commands.
  commands: {
    "PRIVMSG": ctcpHandleMessage,
    "NOTICE": ctcpHandleMessage
  }
}
// Parse the message and call all CTCP handlers on the message.
function ctcpHandleMessage(aMessage) {
  // If there are no CTCP handlers, then don't parse the CTCP message.
  if (!ircHandlers.hasCTCPHandlers)
    return false;

  // The raw CTCP message is in the last parameter of the IRC message.
  let rawCTCPParam = aMessage.params.slice(-1)[0];

  // Split the raw message into the multiple CTCP messages and pull out the
  // command and parameters.
  let ctcpMessages = [];
  let otherMessage = rawCTCPParam.replace(/\x01([^\x01]*)\x01/g,
    function(aMatch, aMsg) {
      if (aMsg)
        ctcpMessages.push(new CTCPMessage(aMessage, aMsg));
      return "";
    });

  // If no CTCP messages were found, return false.
  if (!ctcpMessages.length)
    return false;

  // If there's some message left, send it back through the IRC handlers after
  // stripping out the CTCP information. I highly doubt this will ever happen,
  // but just in case. ;)
  if (otherMessage) {
    let message = aMessage;
    message.params.pop();
    message.params.push(otherMessage);
    ircHandlers.handleMessage(message);
  }

  let handled = true;
  // Loop over each raw CTCP message.
  for each (let message in ctcpMessages)
    handled &= ircHandlers.handleCTCPMessage(this, message);

  return handled;
}

// This is the the basic CTCP protocol.
var ctcpBase = {
  // Parameters
  name: "CTCP",
  priority: ircHandlers.DEFAULT_PRIORITY,
  isEnabled: function() true,

  // These represent CTCP commands.
  commands: {
    "ACTION": function(aMessage) {
      // ACTION <text>
      // Display message in conversation
      this.getConversation(this.isMUCName(aMessage.params[0]) ?
                             aMessage.params[0] : aMessage.nickname)
          .writeMessage(aMessage.nickname || aMessage.servername,
                        "/me " + aMessage.ctcp.param,
                        {incoming: true});
      return true;
    },

    // Used when an error needs to be replied with.
    "ERRMSG": function(aMessage) {
      WARN(aMessage.nickname + " failed to handle CTCP message: " +
           aMessage.ctcp.param);
      return true;
    },

    // Returns the user's full name, and idle time.
    "FINGER": function(aMessage) false,

    // Dynamic master index of what a client knows.
    "CLIENTINFO": function(aMessage) false,

    // Used to measure the delay of the IRC network between clients.
    "PING": function(aMessage) {
      if (aMessage.command == "PRIVMSG") {
        // PING timestamp
        // Received PING request, send PING response.
        LOG("Received PING request from " + aMessage.nickname +
            ". Sending PING response: \"" + aMessage.ctcp.param + "\".");
        this.sendCTCPMessage("PING", aMessage.ctcp.param, aMessage.nickname,
                              true);
      }
      else {
        // PING timestamp
        // Received PING response, display to the user.
        let sentTime = new Date(aMessage.ctcp.param);

        // The received timestamp is invalid
        if (isNaN(sentTime)) {
          WARN(aMessage.nickname +
               " returned an invalid timestamp from a CTCP PING: " +
               aMessage.ctcp.param);
          return false;
        }

        // Find the delay in seconds.
        let delay = (Date.now() - sentTime) / 1000;

        let message = PluralForm.get(delay, _("ctcp.ping", aMessage.nickname))
                                .replace("#2", delay);
        this.getConversation(aMessage.nickname)
            .writeMessage(aMessage.nickname, message, {system: true});
      }
      return true;
    },

    // An encryption protocol between clients without any known reference.
    "SED": function(aMessage) false,

    // Where to obtain a copy of a client.
    "SOURCE": function(aMessage) false,

    // Gets the local date and time from other clients.
    "TIME": function(aMessage) {
      if (aMessage.command == "PRIVMSG") {
        // TIME
        // Received a TIME request, send a human readable response.
        let now = (new Date()).toString();
        LOG("Received TIME request from " + aMessage.nickname +
            ". Sending TIME response: \"" + now + "\".");
        this.sendCTCPMessage("TIME", ":" + now, aMessage.nickname, true);
      }
      else {
        // TIME :<human-readable-time-string>
        // Received a TIME reply, display it.
        // Remove the : prefix, if it exists and display the result.
        let time = aMessage.ctcp.param.slice(aMessage.ctcp.param[0] == ":");
        this.getConversation(aMessage.nickname)
            .writeMessage(aMessage.nickname,
                          _("ctcp.time", aMessage.nickname, time),
                          {system: true});
      }
      return true;
    },

    // A string set by the user (never the client coder)
    "USERINFO": function(aMessage) false,

    // The version and type of the client.
    "VERSION": function(aMessage) {
      if (aMessage.command == "PRIVMSG") {
        // VERSION
        // Received VERSION request, send VERSION response.
        let version = Services.appinfo.name + " " + Services.appinfo.version;
        LOG("Received VERSION request from " + aMessage.nickname +
            ". Sending VERSION response: \"" + version + "\".");
        this.sendCTCPMessage("VERSION", version, aMessage.nickname, true);
      }
      else if (aMessage.command == "NOTICE" && aMessage.ctcp.param.length) {
        // VERSION #:#:#
        // Received VERSION response, display to the user.
        let response = _("ctcp.version", aMessage.nickname,
                         aMessage.ctcp.param);
        this.getConversation(aMessage.nickname)
            .writeMessage(aMessage.nickname, response, {system: true});
      }
      return true;
    }
  }
};
