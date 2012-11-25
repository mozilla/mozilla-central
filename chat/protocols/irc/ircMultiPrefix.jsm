/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This contains an implementation of the multi-prefix IRC extension. This fixes
 * a protocol level bug where the following can happen:
 *   foo MODE +h
 *   foo MODE +o
 *   bar JOINs the channel (and receives @foo)
 *   foo MODE -o
 * foo knows that it has mode +h, but bar does not know foo has +h set.
 *
 *   http://wiki.inspircd.org/Modules/2.1/namesx
 *   http://ircv3.atheme.org/extensions/multi-prefix-3.1
 */

const EXPORTED_SYMBOLS = ["isupportNAMESX", "capMultiPrefix"];

Components.utils.import("resource:///modules/ircHandlers.jsm");

var isupportNAMESX = {
  name: "ISUPPORT NAMESX",
  // Slightly above default ISUPPORT priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    "NAMESX": function(aMessage) {
      this.sendMessage("PROTOCTL", "NAMESX");
      return true;
    }
  }
};

var capMultiPrefix = {
  name: "CAP multi-prefix",
  // Slightly above default ISUPPORT priority.
  priority: ircHandlers.HIGH_PRIORITY,
  isEnabled: function() true,

  commands: {
    "multi-prefix": function(aMessage) {
      // Request to use multi-prefix if it is supported.
      if (aMessage.cap.subcommand == "LS") {
        this.addCAP("multi-prefix");
        this.sendMessage("CAP", ["REQ", "multi-prefix"]);
      }
      else if (aMessage.cap.subcommand == "ACK")
        this.removeCAP("multi-prefix");
      else
        return false;
      return true;
    }
  }
};
