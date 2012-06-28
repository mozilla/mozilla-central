/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * There are a variety of non-standard extensions to IRC that are implemented by
 * different servers. This implementation is based on a combination of
 * documentation and reverse engineering. Each handler must include a comment
 * listing the known servers that support this extension.
 *
 * Resources for these commands include:
 *  http://hg.atheme.org/charybdis/file/tip/include/numeric.h
 *  http://hg.unrealircd.com/hg/unreal/raw-file/tip/include/numeric.h
 */
const EXPORTED_SYMBOLS = ["ircNonStandard"];

const Cu = Components.utils;

Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

var ircNonStandard = {
  name: "Non-Standard IRC Extensions",
  priority: ircHandlers.DEFAULT_PRIORITY + 1,
  isEnabled: function() true,

  commands: {
    "307": function(aMessage) {
      // TODO RPL_SUSERHOST (AustHex)
      // TODO RPL_USERIP (Undernet)
      // <user ips>

      // RPL_WHOISREGNICK (Unreal & Bahamut)
      // <nick> :is a registered nick
      if (aMessage.params.length == 3)
        return this.setWhois(aMessage.params[1], {registered: true});

      return false;
    },

    "317": function(aMessage) { // RPL_WHOISIDLE (Unreal & Charybdis)
      // <nick> <integer> <integer> :seconds idle, signon time
      // This is a non-standard extension to RPL_WHOISIDLE which includes the
      // sign-on time.
      if (aMessage.params.length == 5)
        this.setWhois(aMessage.params[1], {signonTime: aMessage.params[3]});

      return false;
    },

    "329": function(aMessage) { // RPL_CREATIONTIME (Bahamut & Unreal)
      // <channel> <creation time>
      return true;
    },

    "378": function(aMessage) { // RPL_WHOISHOST (Unreal & Charybdis)
      // <nick> :is connecting from <host> <ip>
      let [host, ip] = aMessage.params[2].split(" ").slice(-2);
      return this.setWhois(aMessage.params[1], {host: host, ip: ip});
    },

    "671": function(aMessage) { // RPL_WHOISSECURE (Unreal & Charybdis)
      // <nick> :is using a Secure connection
      return this.setWhois(aMessage.params[1], {secure: true});
    }
  }
};
