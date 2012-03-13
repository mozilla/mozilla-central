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
 * 2010.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

Components.utils.import("resource:///modules/imXPCOMUtils.jsm");
Components.utils.import("resource:///modules/jsProtoHelper.jsm");

function Conversation(aAccount)
{
  this._init(aAccount);
}
Conversation.prototype = {
  _disconnected: false,
  _setDisconnected: function() {
    this._disconnected = true;
  },
  close: function() {
    if (!this._disconnected)
      this.account.disconnect(true);
  },
  sendMsg: function (aMsg) {
    if (this._disconnected) {
      this.writeMessage("jstest", "This message could not be sent because the conversation is no longer active: " + aMsg, {system: true, error: true});
      return;
    }

    this.writeMessage("You", aMsg, {outgoing: true});
    this.writeMessage("/dev/null", "Thanks! I appreciate your attention.",
                      {incoming: true, autoResponse: true});
  },

  get name() "/dev/null",
};
Conversation.prototype.__proto__ = GenericConvIMPrototype;

function Account(aProtoInstance, aImAccount)
{
  this._init(aProtoInstance, aImAccount);
}
Account.prototype = {
  connect: function() {
    this.reportConnecting();
    // do something here
    this.reportConnected();
    setTimeout((function() {
      this._conv = new Conversation(this);
      this._conv.writeMessage("jstest", "You are now talking to /dev/null", {system: true});
    }).bind(this), 0);
  },
  _conv: null,
  disconnect: function(aSilent) {
    this.reportDisconnecting(Components.interfaces.prplIAccount.NO_ERROR, "");
    if (!aSilent)
      this._conv.writeMessage("jstest", "You have disconnected.", {system: true});
    if (this._conv) {
      this._conv._setDisconnected();
      delete this._conv;
    }
    this.reportDisconnected();
  },

  get canJoinChat() true,
  chatRoomFields: {
    channel: {label: "_Channel Field", required: true},
    channelDefault: {label: "_Field with default", default: "Default Value"},
    password: {label: "_Password Field", default: "", isPassword: true,
               required: false},
    sampleIntField: {label: "_Int Field", default: 4, min: 0, max: 10,
                     required: true}
  }
};
Account.prototype.__proto__ = GenericAccountPrototype;

function jsTestProtocol() { }
jsTestProtocol.prototype = {
  get name() "JS Test",
  options: {
    "text": {label: "Text option",    default: "foo"},
    "bool": {label: "Boolean option", default: true},
    "int" : {label: "Integer option", default: 42},
    "list": {label: "Select option",  default: "option2",
             listValues: {"option1": "First option",
                          "option2": "Default option",
                          "option3": "Other option"}}
  },
  usernameSplits: [
    {label: "Server", separator: "@", defaultValue: "default.server",
     reverse: true}
  ],
  getAccount: function(aImAccount) new Account(this, aImAccount),
  classID: Components.ID("{a0774c5a-4aea-458b-9fbc-8d3cbf1a4630}"),
};
jsTestProtocol.prototype.__proto__ = GenericProtocolPrototype;

function overrideTestProtocol() { }
overrideTestProtocol.prototype = {
  get normalizedName() "override",
  get name() "Override Test",
  get iconBaseURI() "chrome://prpl-qq/skin/",
  get baseId() "prpl-null",
  classID: Components.ID("{88795348-8a4b-4018-890d-5314cb08ec4d}")
};
overrideTestProtocol.prototype.__proto__ = ForwardProtocolPrototype;

const NSGetFactory = XPCOMUtils.generateNSGetFactory([jsTestProtocol,
                                                      overrideTestProtocol]);
