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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Bienvenu <dbienvenu@mozilla.com>
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
 * Tests imap save of message as a template, and test initial save right after
 * creation of folder.
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/mailServices.js");
Components.utils.import("resource:///modules/MailUtils.js");

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

setupIMAPPump();

var tests = [
  loadImapMessage,
  saveAsTemplate,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  let gMessageGenerator = new MessageGenerator();
  // create a synthetic message with attachment
  let smsg = gMessageGenerator.makeMessage();

  let msgURI =
    Services.io.newURI("data:text/plain;base64," +
                        btoa(smsg.toMessageString()),
                        null, null);
  let imapInbox =  gIMAPDaemon.getMailbox("INBOX")
  let message = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(message);
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  yield false;
  MailServices.mfn.addListener(mfnListener, MailServices.mfn.msgAdded);
  yield true;
}

// Cleanup
function endTest()
{
  teardownIMAPPump();
  yield true;
}

function saveAsUrlListener(aUri, aIdentity) {
  this.uri = aUri;
  this.identity = aIdentity;
}

saveAsUrlListener.prototype = {
  OnStartRunningUrl: function(aUrl) {
  },
  OnStopRunningUrl: function(aUrl, aExitCode) {
    let messenger = Cc["@mozilla.org/messenger;1"]
                      .createInstance(Ci.nsIMessenger);
    messenger.saveAs(this.uri, false, this.identity, null);
  }
};

// This is similar to the method in mailCommands.js, to test the way that
// it creates a new templates folder before saving the message as a template.
function saveAsTemplate() {
  let hdr = firstMsgHdr(gIMAPInbox);
  let uri = gIMAPInbox.getUriForMsg(hdr);
  const Ci = Components.interfaces;
  let identity = MailServices.accounts
                  .getFirstIdentityForServer(gIMAPIncomingServer);
  identity.stationeryFolder = gIMAPIncomingServer.rootFolder.URI + "/Templates";
  let templates = MailUtils.getFolderForURI(identity.stationeryFolder, false);
  // Verify that Templates folder doesn't exist, and then create it.
  do_check_eq(templates.parent, null);
  templates.setFlag(Ci.nsMsgFolderFlags.Templates);
  templates.createStorageIfMissing(new saveAsUrlListener(uri, identity));
  yield false;
}

var UrlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    async_driver();
  }
};

// listener for saveAsTemplate adding a message to the templates folder.
mfnListener =
{
  msgAdded: function msgAdded(aMsg)
  {
    // Check this is the templates folder.
    do_check_eq(aMsg.folder.prettyName, "Templates");
    async_driver();
  },
};


function run_test()
{
  async_run_tests(tests);
}

// get the first message header found in a folder
function firstMsgHdr(folder) {
  let enumerator = folder.msgDatabase.EnumerateMessages();
  if (enumerator.hasMoreElements())
    return enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}
