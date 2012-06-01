/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This implements the WATCH and MONITOR commands: ways to more efficiently
 * (compared to ISON) keep track of a user's status.
 *
 *   MONITOR (supported by Charybdis)
 *     http://hg.atheme.org/charybdis/raw-file/tip/doc/monitor.txt
 *   WATCH (supported by Bahamut and UnrealIRCd)
 *     http://www.stack.nl/~jilles/cgi-bin/hgwebdir.cgi/irc-documentation-jilles/raw-file/tip/reference/draft-meglio-irc-watch-00.txt
 */

const EXPORTED_SYMBOLS = ["ircWATCH", "isupportWATCH", "ircMONITOR",
                          "isupportMONITOR"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

function setStatus(aAccount, aNick, aStatus) {
  if (!aAccount.watchEnabled && !aAccount.monitorEnabled)
    return false;

  if (aStatus == "AWAY") {
    // We need to request the away message.
    aAccount.requestBuddyInfo(aNick);
  }
  else {
    // Clear the WHOIS information.
    aAccount.removeBuddyInfo(aNick);
  }

  let buddy = aAccount.getBuddy(aNick);
  if (!buddy)
    return false;
  buddy.setStatus(Ci.imIStatusInfo["STATUS_" + aStatus], "");
  return true;
}

function trackBuddyWatch(aNicks) {
  let nicks = (Array.isArray(aNicks) ? aNicks : [aNicks])
                    .map(function(aNick) "+" + aNick);

  if (!nicks.length)
    return;

  let newWatchLength = this.watchLength + nicks.length;
  if (newWatchLength > this.maxWatchLength) {
    WARN("Attempting to WATCH " + newWatchLength + " nicks; maximum size is " +
         this.maxWatchLength + ".");
    // TODO We should trim the list and add the extra users to an ISON queue,
    // but that's not currently implemented, so just hope the server doesn't
    // enforce it's own limit.
  }
  this.watchLength = newWatchLength;

  // Watch away as well as online.
  let params = [];
  if (this.watchAwayEnabled)
    params.push("A");
  let maxLength = this.maxMessageLength - 2 -
                  this.countBytes(this.buildMessage("WATCH", params));
  for each (let nick in nicks) {
    if (this.countBytes(params + " " + nick) >= maxLength) {
      // If the message would be too long, first send this message.
      this.sendMessage("WATCH", params);
      // Reset for the next message.
      params = [];
      if (this.watchAwayEnabled)
        params.push("A");
    }
    params.push(nick);
  }
  this.sendMessage("WATCH", params);
}

var isupportWATCH = {
  name: "WATCH",
  // Slightly above default ISUPPORT priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    "WATCH": function(aMessage) {
      if (!aMessage.isupport.useDefault)
        this.maxWatchLength = 128;
      else {
        let size = parseInt(aMessage.isupport.value, 10);
        if (isNaN(size))
          return false;
        this.maxWatchLength = size;
      }

      this.watchEnabled = true;

      // Clear our watchlist in case there is garbage in it.
      this.sendMessage("WATCH", "C");

      // Kill the ISON polling loop.
      clearTimeout(this._isOnTimer);

      return true;
    },

    "WATCHOPTS": function(aMessage) {
      const watchOptToOption = {
        "H": "watchMasksEnabled",
        "A": "watchAwayEnabled"
      };

      // For each option, mark it as supported.
      aMessage.isupport.value.split("").forEach(function(aWatchOpt) {
        if (watchOptToOption.hasOwnProperty(aWatchOpt))
          this[watchOptToOption[aWatchOpt]] = true;
      }, this);

      return true;
    }
  }
};

var ircWATCH = {
  name: "WATCH",
  // Slightly above default IRC priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  // Use WATCH if it is supported.
  isEnabled: function()
    this.hasOwnProperty("watchEnabled") && this.watchEnabled,

  commands: {
    "251": function(aMessage) { // RPL_LUSERCLIENT
      // ":There are <integer> users and <integer> services on <integer> servers"
      // Assume that this will always be sent after the 005 handler on
      // connection registration. If WATCH is enabled, then set the new function
      // to keep track of nicks and send the messages to watch the nicks.

      // Ensure that any new buddies are set to be watched.
      this.trackBuddy = trackBuddyWatch;

      // Build the watchlist from the current list of nicks.
      this._isOnQueue = this._isOnQueue.concat(this.pendingIsOnQueue);
      this.trackBuddy(this._isOnQueue);

      // Fall through to other handlers since we're only using this as an entry
      // point and not actually handling the message.
      return false;
    },

    "301": function(aMessage) { // RPL_AWAY
      // <nick> :<away message>
      // Set the received away message.
      let buddy = this.getBuddy(aMessage.params[1]);
      if (buddy)
        buddy.setStatus(Ci.imIStatusInfo.STATUS_AWAY, aMessage.params[2]);

      // Fall through to the other implementations after setting the status
      // message.
      return false;
    },

    "303": function(aMessage) { // RPL_ISON
      // :*1<nick> *( " " <nick> )
      // We don't want ircBase to interfere with us, so override the ISON
      // handler to do nothing.
      return true;
    },

    "512": function(aMessage) { // ERR_TOOMANYWATCH
      // Maximum size for WATCH-list is <watchlimit> entries
      ERROR("Maximum size for WATCH list exceeded (" + this.watchLength + ").");
      return true;
    },

    "598": function(aMessage) { // RPL_GONEAWAY
      // <nickname> <username> <hostname> <awaysince> :is now away
      return setStatus(this, aMessage.params[1], "AWAY");
    },

    "599": function(aMessage) { // RPL_NOTAWAY
      // <nickname> <username> <hostname> <awaysince> :is no longer away
      return setStatus(this, aMessage.params[1], "AVAILABLE");
    },

    "600": function(aMessage) { // RPL_LOGON
      // <nickname> <username> <hostname> <signontime> :logged on
      return setStatus(this, aMessage.params[1], "AVAILABLE");
    },

    "601": function(aMessage) { // RPL_LOGOFF
      // <nickname> <username> <hostname> <lastnickchange> :logged off
      return setStatus(this, aMessage.params[1], "OFFLINE");
    },

    "602": function(aMessage) { // RPL_WATCHOFF
      // <nickname> <username> <hostname> <lastnickchange> :stopped watching
      // TODO I don't think we really need to care about this.
      return false;
    },

    "603": function(aMessage) { // RPL_WATCHSTAT
      // You have <entrycount> and are on <onlistcount> WATCH entries
      // TODO I don't think we really need to care about this.
      return false;
    },

    "604": function(aMessage) { // RPL_NOWON
      // <<nickname> <username> <hostname> <lastnickchange> :is online
      return setStatus(this, aMessage.params[1], "AVAILABLE");
    },

    "605": function(aMessage) { // RPL_NOWOFF
      // <nickname> <username> <hostname> <lastnickchange> :is offline
      return setStatus(this, aMessage.params[1], "OFFLINE");
    },

    "606": function(aMessage) { // RPL_WATCHLIST
      // <entrylist>
      // TODO
      return false;
    },

    "607": function(aMessage) { // RPL_ENDOFWATCHLIST
      // End of WATCH <parameter>
      // TODO
      return false;
    },

    "608": function(aMessage) { // RPL_CLEARWATCH
      // Your WATCH list is now empty
      // Note that this is optional for servers to send, so ignore it.
      return true;
    },

    "609": function(aMessage) { // RPL_NOWISAWAY
      // <nickname> <username> <hostname> <awaysince> :is away
      return setStatus(this, aMessage.params[1], "AWAY");
    }
  }
};

var isupportMONITOR = {
  name: "MONITOR",
  // Slightly above default ISUPPORT priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    "MONITOR": function(aMessage) {
      if (!aMessage.isupport.useDefault)
        this.maxMonitorLength = Infinity;
      else {
        let size = parseInt(aMessage.isupport.value, 10);
        if (isNaN(size))
          return false;
        this.maxMonitorLength = size;
      }

      this.monitorEnabled = true;

      // Clear our monitor list in case there is garbage in it.
      this.sendMessage("MONITOR", "C");

      // Kill the ISON polling loop.
      clearTimeout(this._isOnTimer);

      return true;
    }
  }
};

function trackBuddyMonitor(aNicks) {
  let nicks = Array.isArray(aNicks) ? aNicks : [aNicks];

  if (!nicks.length)
    return;

  let newMonitorLength = this.monitorLength + nicks.length;
  if (newMonitorLength > this.maxMonitorLength) {
    WARN("Attempting to MONITOR " + newMonitorLength +
         " nicks; maximum size is " + this.maxMonitorLength + ".");
    // TODO We should trim the list and add the extra users to an ISON queue,
    // but that's not currently implemented, so just hope the server doesn't
    // enforce it's own limit.
  }
  this.monitorLength = newMonitorLength;

  let params = [];
  let maxLength = this.maxMessageLength - 2 -
                  this.countBytes(this.buildMessage("MONITOR",
                                                    ["+", params.join(",")]));
  for each (let nick in nicks) {
    if (this.countBytes(params + " " + nick) >= maxLength) {
      // If the message would be too long, first send this message.
      this.sendMessage("MONITOR", ["+", params.join(",")]);
      // Reset for the next message.
      params = [];
    }
    params.push(nick);
  }
  this.sendMessage("MONITOR", ["+", params.join(",")]);
}

var ircMONITOR = {
  name: "MONITOR",
  // Slightly above default IRC priority.
  priority: ircHandlers.DEFAULT_PRIORITY + 10,
  // Use MONITOR only if MONITOR is enabled and WATCH is not enabled, as WATCH
  // supports more features.
  isEnabled: function()
    this.hasOwnProperty("monitorEnabled") && this.monitorEnabled &&
    !(this.hasOwnProperty("watchEnabled") && this.watchEnabled),

  commands: {
    "251": function(aMessage) { // RPL_LUSERCLIENT
      // ":There are <integer> users and <integer> services on <integer> servers"
      // Assume that this will always be sent after the 005 handler on
      // connection registration. If MONITOR is enabled, then set the new
      // function to keep track of nicks and send the messages to watch the
      // nicks.

      // Ensure that any new buddies are set to be watched.
      this.trackBuddy = trackBuddyMonitor;

      // Build the watchlist from the current list of nicks.
      this._isOnQueue = this._isOnQueue.concat(this.pendingIsOnQueue);
      this.trackBuddy(this._isOnQueue);

      // Fall through to other handlers since we're only using this as an entry
      // point and not actually handling the message.
      return false;
    },

    "303": function(aMessage) { // RPL_ISON
      // :*1<nick> *( " " <nick> )
      // We don't want ircBase to interfere with us, so override the ISON
      // handler to do nothing if we're using MONITOR.
      return true;
    },

    "730": function(aMessage) { // RPL_MONONLINE
      // :<server> 730 <nick> :nick!user@host[,nick!user@host]*
      // Mark each nick as online.
      return aMessage.params[1].split(",")
                               .map(function(aNick)
                                      setStatus(this, aNick.split("!", 1)[0],
                                                "AVAILABLE"),
                                    this).every(function(aResult) aResult);
    },

    "731": function(aMessage) { // RPL_MONOFFLINE
      // :<server> 731 <nick> :nick[,nick1]*
      return aMessage.params[1].split(",")
                               .map(function(aNick)
                                      setStatus(this, aNick, "OFFLINE"),
                                    this).every(function(aResult) aResult);
    },

    "732": function(aMessage) { // RPL_MONLIST
      // :<server> 732 <nick> :nick[,nick1]*
      return false;
    },

    "733": function(aMessage) { // RPL_ENDOFMONLIST
      // :<server> 733 <nick> :End of MONITOR list
      return false;
    },

    "734": function(aMessage) { // ERR_MONLISTFULL
      // :<server> 734 <nick> <limit> <nicks> :Monitor list is full.
      ERROR("Maximum size for MONITOR list exceeded (" + this.params[1] + ").");
      return true;
    }
  }
};
