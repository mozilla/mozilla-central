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
    "NOTICE": function(aMessage) {
      // NOTICE <msgtarget> <text>
      // If we receive a ZNC error message requesting a password, the
      // serverPassword preference was not set by the user. Attempt to log into
      // ZNC using the account password.
      if (aMessage.params[0] != "AUTH" ||
          aMessage.params[1] != "*** You need to send your password. Try /quote PASS <username>:<password>")
        return false;

      if (this.imAccount.password) {
        // Send the password now, if it is available.
        this.shouldAuthenticate = false;
        this.sendMessage("PASS", this.imAccount.password,
                         "PASS <password not logged>");
      }
      else {
        // Otherwise, put the account in an error state.
        this.gotDisconnected(Ci.prplIAccount.ERROR_AUTHENTICATION_IMPOSSIBLE,
                             _("connection.error.passwordRequired"));
      }
      return true;
    },

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

    "328": function(aMessage) { // RPL_CHANNEL_URL (Bahamut & Austhex)
      // <channel> :<URL>
      return true;
    },

    "329": function(aMessage) { // RPL_CREATIONTIME (Bahamut & Unreal)
      // <channel> <creation time>
      return true;
    },

    "330": function(aMessage) {
      // TODO RPL_WHOWAS_TIME

      // RPL_WHOISACCOUNT (Charybdis, ircu & Quakenet)
      // <nick> <authname> :is logged in as
      if (aMessage.params.length == 4) {
        let [, nick, authname] = aMessage.params;
        // If the authname differs from the nickname, add it to the WHOIS
        // information; otherwise, ignore it.
        if (this.normalize(nick) != this.normalize(authname))
          this.setWhois(nick, {registeredAs: authname});
      }
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
