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
 * Patrick Cloke <clokep@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/*
 * This implements the ISUPPORT parameters for the 005 numeric to allow a server
 * to notify a client of what capabilities it supports.
 *   The 005 numeric
 *     http://www.irc.org/tech_docs/005.html
 *   RFC Drafts: IRC RPL_ISUPPORT Numeric Definition
 *     http://tools.ietf.org/html/draft-brocklesby-irc-isupport-03
 *     http://tools.ietf.org/html/draft-hardy-irc-isupport-00
 */

const EXPORTED_SYMBOLS = ["ircISUPPORT", "isupportBase"];

const Cu = Components.utils;

Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

/*
 * Parses a individual token from a ISUPPORT message of the form:
 *   <parameter>=<value> or -<value>
 * The isupport field is added to the message and it has the following fields:
 *   parameter  What is being configured by this ISUPPORT token.
 *   useDefault Whether this parameter should be reset to the default value, as
 *              defined by the RFC.
 *   value      The new value for the parameter.
 */
function isupportMessage(aMessage, aToken) {
  let message = aMessage;
  message.isupport = {};
  message.isupport.useDefault = aToken[0] == "-";

  let token = message.isupport.useDefault ? aToken.slice(1) : aToken;
  [message.isupport.parameter, message.isupport.value] = token.split("=");

  return message;
}

var ircISUPPORT = {
  name: "ISUPPORT",
  // Slightly above default RFC 2812 priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    // RPL_ISUPPORT
    // [-]<parameter>[=<value>] :are supported by this server
    "005": function(aMessage) {
      if (!("ISUPPORT" in this))
        this.ISUPPORT = {};

      // Seperate the ISUPPORT parameters.
      let tokens = aMessage.params.slice(1, -1);

      let handled = true;
      for each (let token in tokens) {
        let message = isupportMessage(aMessage, token);
        handled &= ircHandlers.handleISUPPORTMessage(this, message);
      }

      return handled;
    }
  }
}

function setSimpleNumber(aAccount, aField, aMessage, aDefaultValue) {
  let value =
    aMessage.isupport.value ? new Number(aMessage.isupport.value) : null;
  aAccount[aField] = (value && !isNaN(value)) ? value : aDefaultValue;
  return true;
}

// Generates a function that will set the ASCII range of aStart-aEnd as the
// uppercase of (aStart-aEnd) + 0x20.
function generateNormalize(aStart, aEnd) {
  const exp = new RegExp("[\\x" + aStart.toString(16) + "-\\x" +
                         aEnd.toString(16) + "]", "g");
  return function(aStr, aPrefixes) {
    let str = aStr;
    if (aPrefixes && aPrefixes.indexOf(aStr[0]) != -1)
      str = str.slice(1);
      return str.replace(exp,
                         function(c) String.fromCharCode(c.charCodeAt(0) + 0x20));
  };
}

var isupportBase = {
  name: "ISUPPORT",
  priority: ircHandlers.DEFAULT_PRIORITY,
  isEnabled: function() true,

  commands: {
    "CASEMAPPING": function(aMessage) {
      // CASEMAPPING=<mapping>
      // Allows the server to specify which method it uses to compare equality
      // of case-insensitive strings.

      // By default, use rfc1459 type case mapping.
      let value = aMessage.isupport.useDefault ?
        "rfc1493" : aMessage.isupport.value;

      // Set the normalize function of the account to use the proper case
      // mapping.
      if (value == "ascii") {
        // The ASCII characters 97 to 122 (decimal) are the lower-case
        // characters of ASCII 65 to 90 (decimal).
        this.normalize = generateNormalize(65, 90);
      }
      else if (value == "rfc1493") {
        // The ASCII characters 97 to 126 (decimal) are the lower-case
        // characters of ASCII 65 to 94 (decimal).
        this.normalize = generateNormalize(65, 94);
      }
      else if (value == "strict-rfc1459") {
        // The ASCII characters 97 to 125 (decimal) are the lower-case
        // characters of ASCII 65 to 93 (decimal).
        this.normalize = generateNormalize(65, 93);
      }
      return true;
    },
    "CHANLIMIT": function(aMessage) {
      // CHANLIMIT=<prefix>:<number>[,<prefix>:<number>]*
      // Note that each <prefix> can actually contain multiple prefixes, this
      // means the sum of those prefixes is given.
      this.maxChannels = {};

      let pairs = aMessage.isupport.value.split(",");
      for each (let pair in pairs) {
        let [prefix, num] = pair.split(":");
        this.maxChannels[prefix] = num;
      }
      return true;
    },
    "CHANMODES": function(aMessage) false,
    "CHANNELLEN": function(aMessage) {
      // CHANNELLEN=<number>
      // Default is from RFC 1493.
      return setSimpleNumber(this, "maxChannelLength", aMessage, 200);
    },
    "CHANTYPES": function(aMessage) {
      // CHANTYPES=[<channel prefix>]*
      let value = aMessage.isupport.useDefault ? "#&" : aMessage.isupport.value;
      this.channelPrefixes = value.split("");
      return true;
    },
    "EXCEPTS": function(aMessage) false,
    "IDCHAN": function(aMessage) false,
    "INVEX": function(aMessage) false,
    "KICKLEN": function(aMessage) {
      // KICKLEN=<number>
      // Default value is Infinity.
      return setSimpleNumber(this, "maxKickLength", aMessage, Infinity);
    },
    "MAXLIST": function(aMessage) false,
    "MODES": function(aMessage) false,
    "NETWORK": function(aMessage) false,
    "NICKLEN": function(aMessage) {
      // NICKLEN=<number>
      // Default value is from RFC 1493.
      return setSimpleNumber(this, "maxNicknameLength", aMessage, 9);
    },
    "PREFIX": function(aMessage) {
      // PREFIX=[(<mode character>*)<prefix>*]
      let value =
        aMessage.isupport.useDefault ? "(ov)@+" : aMessage.isupport.value;

      this.userPrefixToModeMap = {};
      // A null value specifier indicates that no prefixes are supported.
      if (!value.length)
        return true;

      let matches = /\(([a-z]*)\)(.*)/i.exec(value);
      if (!matches) {
        // The pattern doesn't match.
        WARN("Invalid PREFIX value: " + value);
        return false;
      }
      if (matches[1].length != matches[2].length) {
        WARN("Invalid PREFIX value, does not provide one-to-one mapping:" +
             value);
        return false;
      }

      for (let i = 0; i < matches[2].length; i++)
        this.userPrefixToModeMap[matches[2][i]] = matches[1][i];
      return true;
    },
    "SAFELIST": function(aMessage) false,
    "STATUSMSG": function(aMessage) false,
    "STD": function(aMessage) {
      // This was never updated as the RFC was never formalized.
      if (aMessage.isupport.value != "rfcnnnn")
        WARN("Unknown ISUPPORT numeric form: " + aMessage.isupport.value);
      return true;
    },
    "TARGMAX": function(aMessage) {
      // TARGMAX=<command>:<max targets>[,<command>:<max targets>]*
      if (aMessage.isupport.useDefault) {
        this.maxTargets = 1;
        return true;
      }

      this.maxTargets = {};
      let commands = aMessage.isupport.value.split(",");
      for (let i = 0; i < commands.length; i++) {
        let [command, limitStr] = commands[i].split("=");
        let limit = limitStr ? new Number(limit) : Infinity;
        if (isNaN(limit)) {
          WARN("Invalid maximum number of targets: " + limitStr);
          continue;
        }
        this.maxTargets[command] = limit;
      }
      return true;
    },
    "TOPICLEN": function(aMessage) {
      // TOPICLEN=<number>
      // Default value is Infinity.
      return setSimpleNumber(this, "maxTopicLength", aMessage, Infinity);
    },

    // The following are considered "obsolete" by the RFC, but are still in use.
    "CHARSET": function(aMessage) false,
    "MAXBANS": function(aMessage) false,
    "MAXCHANNELS": function(aMessage) false,
    "MAXTARGETS": function(aMessage) {
      return setSimpleNumber(this, "maxTargets", aMessage, 1);
    }
  }
};
