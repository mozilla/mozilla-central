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
 * This contains an implementation of the Direct Client-to-Client (DCC)
 * protocol.
 *   A description of the DCC protocol
 *     http://www.irchelp.org/irchelp/rfc/dccspec.html
 */

const EXPORTED_SYMBOLS = ["ctcpDCC", "dccBase"];

const Cu = Components.utils;

Cu.import("resource:///modules/ircHandlers.jsm");
Cu.import("resource:///modules/ircUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");

// Parse a CTCP message into a DCC message. A DCC message is a CTCP message of
// the form:
//   DCC <type> <argument> <address> <port> [<size>]
function DCCMessage(aMessage) {
  let message = aMessage;
  let params = message.ctcp.param.split(" ");
  if (params.length < 4) {
    ERROR("Not enough DCC parameters:\n" + JSON.stringify(aMessage));
    return null;
  }

  try {
    // Address, port and size should be treated as unsigned long, unsigned short
    // and unsigned long, respectively. The protocol is designed to handle
    // further arguements, if necessary.
    message.ctcp.dcc = {
      type: params[0],
      argument: params[1],
      address: new Number(params[2]),
      port: new Number(params[3]),
      size: params.length == 5 ? new Number(params[4]) : null,
      furtherArguments: params.length > 5 ? params.slice(5) : []
    };
  } catch (e) {
    ERROR("Error parsing DCC parameters:\n" + JSON.stringify(aMessage));
    return null;
  }

  return message;
}

// This is the DCC handler for CTCP, it will call each DCC handler.
var ctcpDCC = {
  name: "DCC",
  // Slightly above default CTCP priority.
  priority: ircHandlers.HIGH_PRIORITY + 10,
  isEnabled: function() true,

  commands: {
    // Handle a DCC message by parsing the message and executing any handlers.
    "DCC": function(aMessage) {
      // If there are no DCC handlers, then don't parse the DCC message.
      if (!ircHandlers.hasDCCHandlers)
        return false;

      // Parse the message and attempt to handle it.
      return ircHandlers.handleMessage(this, DCCMessage(aMessage));
    }
  }
};
