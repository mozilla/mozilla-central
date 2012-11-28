/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This implements SASL for IRC.
 *   https://raw.github.com/atheme/atheme/master/doc/SASL
 */

const EXPORTED_SYMBOLS = ["ircSASL", "capSASL"];

const Cu = Components.utils;

Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

var ircSASL = {
  name: "SASL AUTHENTICATE",
  priority: ircHandlers.DEFAULT_PRIORITY,
  isEnabled: function() true,

  commands: {
    "AUTHENTICATE": function(aMessage) {
      // Expect an empty response, if something different is received abort.
      if (aMessage.params[0] != "+") {
        this.sendMessage("AUTHENTICATE", "*");
        this.WARN("Aborting SASL authentication, unexpected message " +
                  "received:\n" + aMessage.rawMessage);
        return true;
      }

      // An authentication identity, authorization identity and password are
      // used, separated by null.
      let data = [this._requestedNickname, this._requestedNickname,
                  this.imAccount.password].join("\0");
      // btoa for Unicode, see https://developer.mozilla.org/en-US/docs/DOM/window.btoa
      let base64Data = btoa(unescape(encodeURIComponent(data)));
      this.sendMessage("AUTHENTICATE", base64Data,
                       "AUTHENTICATE <base64 encoded nick, user and password not logged>");
      return true;
    },

    "900": function(aMessage) {
      // Now logged in.
      this.isAuthenticated = true;
      this.LOG("SASL authentication successful.");
      this.removeCAP("sasl");
      return true;
    },

    "903": function(aMessage) {
      // Authentication was successful.
      return true;
    },

    "904": function(aMessage) {
      // AUTHENTICATE message failed.
      // Only PLAIN is currently supported, so fail here.
      this.WARN("The server does not support SASL PLAIN authentication.");
      this.removeCAP("sasl");
      return true;
    },

    "905": function(aMessage) {
      this.ERROR("Authentication with SASL failed.");
      this.removeCAP("sasl");
      return true;
    },

    "906": function(aMessage) {
      // The client completed registration before SASL authentication completed.
      this.ERROR("Registration completed before SASL authentication completed.");
      this.removeCAP("sasl");
      return true;
    },

    "907": function(aMessage) {
      // Response if client attempts to AUTHENTICATE after successful
      // authentication.
      this.ERROR("Attempting SASL authentication twice?!");
      this.removeCAP("sasl");
      return true;
    }
  }
};

var capSASL = {
  name: "SASL CAP",
  priority: ircHandlers.DEFAULT_PRIORITY,
  isEnabled: function() true,

  commands: {
    "sasl": function(aMessage) {
      if (aMessage.cap.subcommand == "LS" && this.imAccount.password) {
        // If it supports SASL, let the server know we're requiring SASL.
        this.sendMessage("CAP", ["REQ", "sasl"]);
        this.addCAP("sasl");
      }
      else if (aMessage.cap.subcommand == "ACK") {
        // The server acknowledges our choice to use SASL, send the first
        // message.
        this.sendMessage("AUTHENTICATE", "PLAIN");
      }

      return true;
    }
  }
};
