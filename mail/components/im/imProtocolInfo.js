/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function imProtocolInfo() { }

imProtocolInfo.prototype = {

  defaultLocalPath: null,
  get serverIID() null,
  get requiresUsername() true,
  get preflightPrettyNameWithEmailAddress() false,
  get canDelete() true,
  // Even though IM accounts can login at startup, canLoginAtStartUp
  // should be false as it's used to decide if new messages should be
  // fetched at startup and that concept of message doesn't apply to
  // IM accounts.
  get canLoginAtStartUp() false,
  get canDuplicate() false,
  getDefaultServerPort: function() 0,
  get canGetMessages() false,
  get canGetIncomingMessages() false,
  get defaultDoBiff() false,
  get showComposeMsgLink() false,
  get foldersCreatedAsync() false,

  classDescription: "IM Msg Protocol Info implementation",
  classID: Components.ID("{13118758-dad2-418c-a03d-1acbfed0cd01}"),
  contractID: "@mozilla.org/messenger/protocol/info;1?type=im",
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgProtocolInfo])
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([imProtocolInfo]);
