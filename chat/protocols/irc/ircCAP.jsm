/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This implements the IRC Client Capabilities sub-protocol.
 *   Client Capab Proposal
 *     http://www.leeh.co.uk/ircd/client-cap.txt
 *   RFC Drafts: IRC Client Capabilities
 *     http://tools.ietf.org/html/draft-baudis-irc-capab-00
 *     http://tools.ietf.org/html/draft-mitchell-irc-capabilities-01
 *
 * Note that this doesn't include any implementation as these RFCs do not even
 * include example parameters.
 */

const EXPORTED_SYMBOLS = ["ircCAP"];

const Cu = Components.utils;

Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

// This matches a modifier, followed by the name spaces (network specific or
// standardized), followed by the capability name.
const capParameterExp = /^([\-=~])?((?:(?:[A-Z][A-Z0-9\-]*\.)*[A-Z][A-Z0-9\-]*\/)?[A-Z][A-Z0-9\-]*)$/i;

/*
 * Parses a CAP message of the form:
 *   CAP <subcommand> [<parameters>]
 * The cap field is added to the message and it has the following fields:
 *   subcommand
 *   parameters A list of capabilities.
 */
function capMessage(aMessage) {
  // The CAP parameters are space separated as the last parameter.
  let parameters = aMessage.params.slice(-1)[0].trim().split(" ");
  aMessage.cap = {
    subcommand: aMessage.params[aMessage.params.length == 3 ? 1 : 0]
  };

  return parameters.map(function(aParameter) {
    // Clone the original object.
    let message = JSON.parse(JSON.stringify(aMessage));
    let matches = aParameter.match(capParameterExp);

    message.cap.modifier = matches[1];
    // The names are case insensitive, arbitrarily choose lowercase.
    message.cap.parameter = matches[2].toLowerCase();
    message.cap.disable = matches[1] == "-";
    message.cap.sticky = matches[1] == "=";
    message.cap.ack = matches[1] == "~";

    return message;
  });
}

var ircCAP = {
  name: "Client Capabilities",
  // Slightly above default RFC 2812 priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    "CAP": function(aMessage) {
      // [* | <nick>] <subcommand> :<parameters>
      let messages = capMessage(aMessage);

      messages = messages.filter(function(aMessage)
        !ircHandlers.handleCAPMessage(this, aMessage), this);
      if (messages.length) {
        // Display the list of unhandled CAP messages.
        let unhandledMessages =
          messages.map(function(aMsg) aMsg.cap.parameter).join(" ");
        this.WARN("Unhandled CAP messages: " + unhandledMessages +
                  "\nRaw message: " + aMessage.rawMessage);
      }

      // If no CAP handlers were added, just tell the server we're done.
      if (!this._caps.length)
        this.sendMessage("CAP", "END");
      return true;
    },

    "410": function(aMessage) { // ERR_INVALIDCAPCMD
      // <unrecognized subcommand> :Invalid CAP subcommand
      this.WARN("Invalid subcommand: " + aMessage.params[1]);
      return true;
    }
  }
};
