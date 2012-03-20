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
 * The Original Code is the Instantbird messenging client, released
 * 2011.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
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

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/commands.properties")
);

function CommandsService() { }
CommandsService.prototype = {
  initCommands: function() {
    this._commands = {};
    // The say command is directly implemented in the UI layer, but has a
    // dummy command registered here so it shows up as a command (e.g. when
    // using the /help command).
    this.registerCommand({
      name: "say",
      get helpString() _("sayHelpString"),
      usageContext: Ci.imICommand.CONTEXT_ALL,
      priority: Ci.imICommand.PRIORITY_HIGH,
      run: function(aMsg, aConv) {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
      }
    });

    this.registerCommand({
      name: "raw",
      get helpString() _("rawHelpString"),
      usageContext: Ci.imICommand.CONTEXT_ALL,
      priority: Ci.imICommand.PRIORITY_DEFAULT,
      run: function(aMsg, aConv) {
        aConv.sendMsg(aMsg);
        return true;
      }
    });

    this.registerCommand({
      // Reference the command service so we can use the internal properties
      // directly.
      cmdSrv: this,

      name: "help",
      get helpString() _("helpHelpString"),
      usageContext: Ci.imICommand.CONTEXT_ALL,
      priority: Ci.imICommand.PRIORITY_DEFAULT,
      run: function(aMsg, aConv) {
        let conv = Services.conversations.getUIConversation(aConv);
        if (!conv)
          return false;

        // Handle when no command is given, list all possible commands that are
        // available for this conversation (alphabetically).
        if (!aMsg) {
          let commands = this.cmdSrv.listCommandsForConversation(aConv, {});
          if (!commands.length)
            return false;

          // Concatenate the command names (separated by a comma and space).
          let cmds = commands.map(function(aCmd) aCmd.name).sort().join(", ");
          let message = _("commands", cmds);

          // Display the message
          conv.systemMessage(message);
          return true;
        }

        // A command name was given, find the commands that match.
        let cmdArray = this.cmdSrv._findCommands(aConv, aMsg);

        if (!cmdArray.length) {
          // No command that matches.
          let message = _("noCommand", aMsg);
          conv.systemMessage(message);
          return true;
        }

        // Only show the help for the one of the highest priority.
        let cmd = cmdArray[0];

        let text = cmd.helpString;
        if (!text)
          text = _("noHelp", cmd.name);

        // Display the message.
        conv.systemMessage(text);
        return true;
      }
    });

    // Status commands
    let status = {
      back: "AVAILABLE",
      away: "AWAY",
      busy: "UNAVAILABLE",
      dnd: "UNAVAILABLE",
      offline: "OFFLINE"
    };
    for (let cmd in status) {
      let statusValue = Ci.imIStatusInfo["STATUS_" + status[cmd]];
      this.registerCommand({
        name: cmd,
        get helpString() _("statusCommand", this.name, _(this.name)),
        usageContext: Ci.imICommand.CONTEXT_ALL,
        priority: Ci.imICommand.PRIORITY_HIGH,
        run: function(aMsg) {
          Services.core.globalUserStatus.setStatus(statusValue, aMsg);
          return true;
        }
      });
    }
  },
  unInitCommands: function() {
    delete this._commands;
  },

  registerCommand: function(aCommand, aPrplId) {
    let name = aCommand.name;
    if (!name)
      throw Cr.NS_ERROR_INVALID_ARG;

    if (!(this._commands.hasOwnProperty(name)))
      this._commands[name] = {};
    this._commands[name][aPrplId || ""] = aCommand;
  },
  unregisterCommand: function(aCommandName, aPrplId) {
    if (this._commands.hasOwnProperty(aCommandName)) {
      let prplId = aPrplId || "";
      let commands = this._commands[aCommandName];
      if (commands.hasOwnProperty(aPrplId))
        delete commands[aPrplId];
      if (!Object.keys(commands).length)
        delete this._commands[aCommandName];
    }
  },
  listCommandsForConversation: function(aConversation, commandCount) {
    let result = [];
    let prplId = aConversation && aConversation.account.protocol.id;
    for (let name in this._commands) {
      let commands = this._commands[name];
      if (commands.hasOwnProperty(""))
        result.push(commands[""]);
      if (prplId && commands.hasOwnProperty(prplId))
        result.push(commands[prplId]);
    }
    result = result.filter(this._usageContextFilter(aConversation));
    commandCount.value = result.length;
    return result;
  },
  // List only the commands for a protocol (excluding the global commands).
  listCommandsForProtocol: function(aPrplId, commandCount) {
    if (!aPrplId)
      throw "You must provide a prpl ID.";

    let result = [];
    for (let name in this._commands) {
      let commands = this._commands[name];
      if (commands.hasOwnProperty(aPrplId))
        result.push(commands[aPrplId]);
    }
    commandCount.value = result.length;
    return result;
  },
  _usageContextFilter: function(aConversation) {
    let usageContext =
      Ci.imICommand["CONTEXT_" + (aConversation.isChat ? "CHAT" : "IM")];
    return function(c) c.usageContext & usageContext;
  },
  _findCommands: function(aConversation, aName) {
    if (!(this._commands.hasOwnProperty(aName)))
      return [];

    // Get the 2 possible commands (the global and the proto specific)
    let cmdArray = [];
    let commands = this._commands[aName];
    if (commands.hasOwnProperty(""))
      cmdArray.push(commands[""]);

    if (aConversation) {
      let prplId = aConversation.account.protocol.id;
      if (commands.hasOwnProperty(prplId))
        cmdArray.push(commands[prplId]);
    }

    // Remove the commands that can't apply in this context.
    cmdArray = cmdArray.filter(this._usageContextFilter(aConversation));

    // Sort the matching commands by priority before returning the array.
    return cmdArray.sort(function(a, b) b.priority - a.priority);
  },
  executeCommand: function (aMessage, aConversation) {
    if (!aMessage)
      throw Cr.NS_ERROR_INVALID_ARG;

    let matchResult;
    if (aMessage[0] != "/" ||
        !(matchResult = /^\/([a-z]+)(?: |$)([\s\S]*)/.exec(aMessage)))
      return false;

    let [, name, args] = matchResult;

    let cmdArray = this._findCommands(aConversation, name);
    if (!cmdArray.length)
      return false;

    // cmdArray contains commands sorted by priority, attempt to apply
    // them in order until one succeeds.
    if (!cmdArray.some(function (aCmd) aCmd.run(args, aConversation))) {
      // If they all failed, print help message.
      this.executeCommand("/help " + name, aConversation);
    }
    return true;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.imICommandsService]),
  classDescription: "Commands",
  classID: Components.ID("{7cb20c68-ccc8-4a79-b6f1-0b4771ed6c23}"),
  contractID: "@mozilla.org/chat/commands-service;1"
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([CommandsService]);
