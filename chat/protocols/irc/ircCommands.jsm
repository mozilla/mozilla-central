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

// This is to be exported directly onto the IRC prplIProtocol object, directly
// implementing the commands field before we register them.
const EXPORTED_SYMBOLS = ["commands"];

Components.utils.import("resource:///modules/ircUtils.jsm");

// Shortcut to get the JavaScript account object.
function getAccount(aConv) aConv.wrappedJSObject._account;

// Kick a user from a channel
// aMsg is <user> [comment]
function kickCommand(aMsg, aConv) {
  if (!aMsg.length)
    return false;

  let params = [aConv.name];
  let offset = aMsg.indexOf(" ");
  if (offset != -1) {
    params.push(aMsg.slice(0, offset));
    params.push(aMsg.slice(offset + 1));
  }
  else
    params.push(aMsg);

  getAccount(aConv).sendMessage("KICK", params);
  return true;
}

// Send a message directly to a user.
// aMsg is <user> <message>
function messageCommand(aMsg, aConv) {
  let sep = aMsg.indexOf(" ");
  // If no space in the message or the first space is at the end of the message.
  if (sep == -1 || (sep + 1) == aMsg.length) {
    let msg = aMsg.trim();
    if (!msg.length)
      return false;
    getAccount(aConv).createConversation(msg);
    return true;
  }

  return privateMessage(aConv, aMsg.slice(sep + 1), aMsg.slice(0, sep));
}

// aAdd is true to add a mode, false to remove a mode.
function setMode(aNickname, aConv, aMode, aAdd) {
  if (!aNickname.length)
    return false;

  // Change the mode for each nick, as separator by spaces.
  return aNickname.split(" ").every(function(aNick)
    simpleCommand(aConv, "MODE",
                  [aConv.name, (aAdd ? "+" : "-") + aMode, aNick]));
}

function actionCommand(aMsg, aConv) {
  if (!ctcpCommand(aConv, aConv.name, "ACTION", aMsg))
    return false;

  // Show the action on our conversation.
  let account = getAccount(aConv);
  account.getConversation(aConv.name)
         .writeMessage(account._nickname, "/me " + aMsg, {outgoing: true});
  return true;
}

// Helper functions
function privateMessage(aConv, aMsg, aNickname) {
  if (!aMsg.length)
    return false;

  // This will open the conversation, send and display the text
  getAccount(aConv).getConversation(aNickname).sendMsg(aMsg);
  return true;
}

// This will send a command to the server, if no parameters are given, it is
// assumed that the command takes no parameters. aParams can be either a single
// string or an array of parameters.
function simpleCommand(aConv, aCommand, aParams) {
  if (!aParams || !aParams.length)
    getAccount(aConv).sendMessage(aCommand);
  else
    getAccount(aConv).sendMessage(aCommand, aParams);
  return true;
}

function ctcpCommand(aConv, aTarget, aCommand, aMsg) {
  if (!aTarget.length)
    return false;

  getAccount(aConv).sendCTCPMessage(aCommand, aMsg, aTarget, false);
  return true;
}

var commands = [
  {
    name: "action",
    get helpString() _("command.action", "action"),
    run: actionCommand
  },
  {
    name: "ctcp",
    get helpString() _("command.ctcp", "ctcp"),
    run: function(aMsg, aConv) {
      let separator = aMsg.indexOf(" ");
      if (separator == -1 && (separator + 1) != aMsg.length)
        return false;

      return ctcpCommand(aConv, aMsg.slice(0, separator),
                         aMsg.slice(separator + 1));
    }
  },
  {
    name: "chanserv",
    get helpString() _("command.chanserv", "chanserv"),
    run: function(aMsg, aConv) privateMessage(aConv, aMsg, "ChanServ")
  },
  {
    name: "deop",
    get helpString() _("command.deop", "deop"),
    run: function(aMsg, aConv) setMode(aMsg, aConv, "o", false)
  },
  {
    name: "devoice",
    get helpString() _("command.devoice", "devoice"),
    run: function(aMsg, aConv) setMode(aMsg, aConv, "v", false)
  },
  {
    name: "invite",
    get helpString() _("command.invite", "invite"),
    run: function(aMsg, aConv) simpleCommand(aConv, "INVITE", aMsg)
  },
  {
    name: "j",
    get helpString() _("command.join", "j"),
    run: function(aMsg, aConv) simpleCommand(aConv, "JOIN", aMsg)
  },
  {
    name: "join",
    get helpString() _("command.join", "join"),
    run: function(aMsg, aConv) simpleCommand(aConv, "JOIN", aMsg)
  },
  {
    name: "kick",
    get helpString() _("command.kick", "kick"),
    run: kickCommand
  },
  {
    name: "list",
    get helpString() _("command.list", "list"),
    run: function(aMsg, aConv) simpleCommand(aConv, "LIST")
  },
  {
    name: "me",
    get helpString() _("command.action", "me"),
    run: actionCommand
  },
  {
    name: "memoserv",
    get helpString() _("command.memoserv", "memoserv"),
    run: function(aMsg, aConv) privateMessage(aConv, aMsg, "MemoServ")
  },
  {
    name: "mode",
    get helpString() _("command.mode", "mode"),
    run: function(aMsg, aConv) simpleCommand(aConv, "MODE", aMsg)
  },
  {
    name: "msg",
    get helpString() _("command.msg", "msg"),
    run: messageCommand
  },
  {
    name: "nick",
    get helpString() _("command.nick", "nick"),
    run: function(aMsg, aConv) simpleCommand(aConv, "NICK", aMsg)
  },
  {
    name: "nickserv",
    get helpString() _("command.nickserv", "nickserv"),
    run: function(aMsg, aConv) privateMessage(aConv, aMsg, "NickServ")
  },
  {
    name: "notice",
    get helpString() _("command.notice", "notice"),
    run: function(aMsg, aConv) simpleCommand(aConv, "NOTICE", aMsg)
  },
  {
    name: "op",
    get helpString() _("command.op", "op"),
    run: function(aMsg, aConv) setMode(aMsg, aConv, "o", true)
  },
  {
    name: "operwall",
    get helpString() _("command.wallops", "operwall"),
    run: function(aMsg, aConv) simpleCommand(aConv, "WALLOPS", aMsg)
  },
  {
    name: "operserv",
    get helpString() _("command.operserv", "operserv"),
    run: function(aMsg, aConv) privateMessage(aConv, aMsg, "OperServ")
  },
  {
    name: "part",
    get helpString() _("command.part", "part"),
    run: function (aMsg, aConv) {
      aConv.wrappedJSObject.part(aMsg);
      return true;
    }
  },
  {
    name: "ping",
    get helpString() _("command.ping", "ping"),
    run: function(aMsg, aConv) ctcpCommand(aConv, aMsg, "PING")
  },
  {
    name: "query",
    get helpString() _("command.msg", "query"),
    run: messageCommand
  },
  {
    name: "quit",
    get helpString() _("command.quit", "quit"),
    run: function(aMsg, aConv) {
      getAccount(aConv).quit(aMsg);
      return true;
    }
  },
  {
    name: "quote",
    get helpString() _("command.quote", "quote"),
    run: function(aMsg, aConv) {
      if (!aMsg.length)
        return false;

      getAccount(aConv).sendRawMessage(aMsg);
      return true;
    }
  },
  {
    name: "remove",
    get helpString() _("command.kick", "remove"),
    run: kickCommand
  },
  {
    name: "time",
    get helpString() _("command.time", "time"),
    run: function(aMsg, aConv) simpleCommand(aConv, "TIME")
  },
  {
    name: "topic",
    get helpString() _("command.topic", "topic"),
    run: function(aMsg, aConv) {
      aConv.topic = aMsg;
      return true;
    }
  },
  {
    name: "umode",
    get helpString() _("command.umode", "umode"),
    run: function(aMsg, aConv) simpleCommand(aConv, "MODE", aMsg)
  },
  {
    name: "version",
    get helpString() _("command.version", "version"),
    run: function(aMsg, aConv) ctcpCommand(aConv, aMsg, "VERSION")
  },
  {
    name: "voice",
    get helpString() _("command.voice", "voice"),
    run: function(aMsg, aConv) setMode(aMsg, aConv, "v", true)
  },
  {
    name: "wallops",
    get helpString() _("command.wallops", "wallops"),
    run: function(aMsg, aConv) simpleCommand(aConv, "WALLOPS", aMsg)
  },
  {
    name: "whowas",
    get helpString() _("command.whowas", "whowas"),
    run: function(aMsg, aConv) simpleCommand(aConv, "WHOWAS", aMsg)
  }
];
