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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Bienvenu <bienvenu@mozillamessaging.com>
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

// This tests our handling of server timeouts during online move of
// an imap message. The move is done as an offline operation and then
// played back, to copy what the apps do.

let prefs = Components.classes["@mozilla.org/preferences-service;1"].
                getService(Components.interfaces.nsIPrefService).getBranch("");
prefs.setIntPref("mailnews.tcptimeout", 2);

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");
load("../../../resources/messageGenerator.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

// Globals

setupIMAPPump();

var gGotAlert = false;

var dummyDocShell =
{
  getInterface: function (iid) {
    if (iid.equals(Ci.nsIAuthPrompt)) {
      return Cc["@mozilla.org/login-manager/prompter;1"]
               .getService(Ci.nsIAuthPrompt);
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDocShell,
                                         Ci.nsIInterfaceRequestor])
}

function alert(aDialogTitle, aText) {
  do_check_eq(aText.indexOf("Connection to server Mail for  timed out."), 0);
  gGotAlert = true;
}

// Dummy message window so we can do the move as an offline operation.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};

var CopyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    async_driver();
  }
};

// Definition of tests
var tests = [
  createTargetFolder,
  loadImapMessage,
  moveMessageToTargetFolder,
  waitForOfflinePlayback,
  updateTargetFolder,
  endTest
]

let gTargetFolder;
function createTargetFolder()
{
  gIMAPServer._handler.copySleep = 5000;
  gIMAPIncomingServer.rootFolder.createSubfolder("targetFolder", null);
  yield false; 
  gTargetFolder = gIMAPIncomingServer.rootFolder.getChildNamed("targetFolder");
  do_check_true(gTargetFolder instanceof Ci.nsIMsgImapMailFolder);
  gTargetFolder.updateFolderWithListener(null, UrlListener);
  yield false;
}  

// load and update a message in the imap fake server
function loadImapMessage()
{
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  let msgURI =
    ioService.newURI("data:text/plain;base64," +
                     btoa(messages[0].toMessageString()),
                     null, null);
  let imapInbox =  gIMAPDaemon.getMailbox("INBOX")
  gMessage = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(gMessage);
  gIMAPInbox.updateFolder(null);
  yield false;
  do_check_eq(1, gIMAPInbox.getTotalMessages(false));
  let msgHdr = firstMsgHdr(gIMAPInbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);

  yield true;
}

// move the message to a diffent folder
function moveMessageToTargetFolder()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);

  // Now move this message to the target folder.
  var messages = Cc["@mozilla.org/array;1"]
                   .createInstance(Ci.nsIMutableArray);
  messages.appendElement(msgHdr, false);
  let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
  // This should cause the move to be done as an offline imap operation
  // that's played back immediately.
  copyService.CopyMessages(gIMAPInbox, messages, gTargetFolder, true,
                           CopyListener, dummyMsgWindow, true);
  yield false;
}

function waitForOfflinePlayback()
{
  // Offline playback starts 500MS after the offline op is run, so
  // let's wait a second.
  do_timeout(1000, async_driver);
  yield false;
}

function updateTargetFolder()
{
  gTargetFolder.updateFolderWithListener(null, UrlListener);
  yield false;
}

var UrlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    async_driver();
  }
};

// Cleanup
function endTest()
{
  do_check_true(gGotAlert);
  // Make sure neither source nor target folder have offline events.
  do_check_false(gIMAPInbox.getFlag(Ci.nsMsgFolderFlags.OfflineEvents));
  do_check_false(gTargetFolder.getFlag(Ci.nsMsgFolderFlags.OfflineEvents));

  // fake server does the copy, but then times out, so make sure the target
  // folder has only 1 message, not the multiple ones it would have if we
  // retried.
  do_check_eq(gTargetFolder.getTotalMessages(false), 1);
  teardownIMAPPump();
}

// listeners

mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    // we are only using async yield on the target folder add
    if (aFolder.name == "targetFolder")
      async_driver();
  },

  msgAdded: function msgAdded(aMsg)
  {
    async_driver();
  },

};

function run_test()
{
  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  let MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(nsIMFNService);
  let flags =
        nsIMFNService.folderAdded |
        nsIMFNService.msgAdded;
  MFNService.addListener(mfnListener, flags);
  async_run_tests(tests);
}

/*
 * helper functions
 */

// get the first message header found in a folder
function firstMsgHdr(folder) {
  let enumerator = folder.messages;
  if (enumerator.hasMoreElements())
    return enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}
