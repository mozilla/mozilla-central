/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["ircHandlers"];

const Cu = Components.utils;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/ircUtils.jsm");

var ircHandlers = {
  /*
   * Object to hold the IRC handlers, each handler is an object that implements:
   *   name        The display name of the handler.
   *   priority    The priority of the handler (0 is default, positive is
   *               higher priority)
   *   isEnabled   A function where 'this' is bound to the account object. This
   *               should reflect whether this handler should be used for this
   *               account.
   *   commands    An object of commands, each command is a function which
   *               accepts a message object and has 'this' bound to the account
   *               object. It should return whether the message was successfully
   *               handler or not.
   */
  _ircHandlers: [],
  // Object to hold the ISUPPORT handlers, expects the same fields as
  // _ircHandlers.
  _isupportHandlers: [],
  // Object to hold the CTCP handlers, expects the same fields as _ircHandlers.
  _ctcpHandlers: [],
  // Object to hold the DCC handlers, expects the same fields as _ircHandlers.
  _dccHandlers: [],
  // Object to hold the Services handlers, expects the same fields as
  // _ircHandlers.
  _servicesHandlers: [],

  _registerHandler: function(aArray, aHandler) {
    // Protect ourselves from adding broken handlers.
    if (!("commands" in aHandler)) {
      ERROR("IRC handlers must have a \"commands\" property: " + aHandler.name);
      return false;
    }
    if (!("isEnabled" in aHandler)) {
      ERROR("IRC handlers must have a \"isEnabled\" property: " + aHandler.name);
      return false;
    }

    aArray.push(aHandler);
    aArray.sort(function(a, b) b.priority - a.priority);
    return true;
  },

  _unregisterHandler: function(aArray, aHandler) {
    aArray = aArray.filter(function(h) h.name != aHandler.name);
  },

  registerHandler: function(aHandler)
    this._registerHandler(this._ircHandlers, aHandler),
  unregisterHandler: function(aHandler)
    this._unregisterHandler(this._ircHandlers, aHandler),

  registerISUPPORTHandler: function(aHandler)
    this._registerHandler(this._isupportHandlers, aHandler),
  unregisterISUPPORTHandler: function(aHandler)
    this._unregisterHandler(this._isupportHandlers, aHandler),

  registerCTCPHandler: function(aHandler)
    this._registerHandler(this._ctcpHandlers, aHandler),
  unregisterCTCPHandler: function(aHandler)
    this._unregisterHandler(this._ctcpHandlers, aHandler),

  registerDCCHandler: function(aHandler)
    this._registerHandler(this._dccHandlers, aHandler),
  unregisterDCCHandler: function(aHandler)
    this._unregisterHandler(this._dccHandlers, aHandler),

  registerServicesHandler: function(aHandler)
    this._registerHandler(this._servicesHandlers, aHandler),
  unregisterServicesHandler: function(aHandler)
    this._unregisterHandler(this._servicesHandlers, aHandler),

  // Handle a message based on a set of handlers.
  _handleMessage: function(aHandlers, aAccount, aMessage, aCommand) {
    // Loop over each handler and run the command until one handles the message.
    for each (let handler in aHandlers) {
      try {
        // Attempt to execute the command, by checking if the handler has the
        // command.
        // Parse the command with the JavaScript account object as "this".
        if (handler.isEnabled.call(aAccount) &&
            hasOwnProperty(handler.commands, aCommand) &&
            handler.commands[aCommand].call(aAccount, aMessage)) {
          DEBUG(JSON.stringify(aMessage));
          return true;
        }
      } catch (e) {
        // We want to catch an error here because one of our handlers are broken,
        // if we don't catch the error, the whole IRC plug-in will die.
        ERROR("Error running command " + aCommand + " with handler " +
              handler.name + ":\n" + JSON.stringify(aMessage));
        Cu.reportError(e);
      }
    }

    return false;
  },

  handleMessage: function(aAccount, aMessage)
    this._handleMessage(this._ircHandlers, aAccount, aMessage,
                        aMessage.command.toUpperCase()),

  handleISUPPORTMessage: function(aAccount, aMessage)
    this._handleMessage(this._isupportHandlers, aAccount, aMessage,
                        aMessage.isupport.parameter),

  // aMessage is a CTCP Message, which inherits from an IRC Message.
  handleCTCPMessage: function(aAccount, aMessage)
    this._handleMessage(this._ctcpHandlers, aAccount, aMessage,
                        aMessage.ctcp.command),

  // aMessage is a DCC Message, which inherits from a CTCP Message.
  handleDCCMessage: function(aAccount, aMessage)
    this._handleMessage(this._dccHandlers, aAccount, aMessage,
                        aMessage.ctcp.dcc.type),

  // aMessage is a Services Message.
  handleServicesMessage: function(aAccount, aMessage)
    this._handleMessage(this._servicesHandlers, aAccount, aMessage,
                        aMessage.serviceName),

  // Checking if handlers exist.
  get hasHandlers() this._ircHandlers.length > 0,
  get hasISUPPORTHandlers() this._isupportHandlers.length > 0,
  get hasCTCPHandlers() this._ctcpHandlers.length > 0,
  get hasDCCHandlers() this._dccHandlers.length > 0,
  get hasServicesHandlers() this._servicesHandlers.length > 0,

  // Some constant priorities.
  get LOW_PRIORITY() -100,
  get DEFAULT_PRIORITY() 0,
  get HIGH_PRIORITY() 100
}
