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
 *   Kent James <kent@caspia.com>
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

// This tests that arbitrary message header properties are preserved
//  during online move of an imap message.

// async support 
load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/mailTestUtils.js");
load("../../mailnews/resources/asyncTestUtils.js");

// IMAP pump
load("../../mailnews/resources/IMAPpump.js");

// Globals

const gMessage = "bugmail10"; // message file used as the test message

setupIMAPPump();

// Definition of tests
var tests = [
  createSubfolder,
  loadImapMessage,
  moveMessageToSubfolder,
  testPropertyOnMove,
  endTest
]

let gSubfolder;
function createSubfolder()
{
  gIMAPIncomingServer.rootFolder.createSubfolder("Subfolder", null);
  dl('wait for folderAdded notification');
  yield false; 
  gSubfolder = gIMAPIncomingServer.rootFolder.getChildNamed("Subfolder");
  do_check_true(gSubfolder instanceof Ci.nsIMsgImapMailFolder);
  gSubfolder.updateFolderWithListener(null, UrlListener);
  dl('wait for OnStopRunningURL');
  yield false;
}  

// load and update a message in the imap fake server
function loadImapMessage()
{
  gIMAPMailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          gIMAPMailbox.uidnext++, []));
  gIMAPInbox.updateFolder(null);
  dl('wait for msgAdded notification');
  yield false;
  do_check_eq(1, gIMAPInbox.getTotalMessages(false));
  let msgHdr = firstMsgHdr(gIMAPInbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);

  // set an arbitrary property
  msgHdr.setStringProperty("testprop", "somevalue");
  yield true;
}

// move the message to a subfolder
function moveMessageToSubfolder()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);

  // Now move this message to the subfolder.
  var messages = Cc["@mozilla.org/array;1"]
                   .createInstance(Ci.nsIMutableArray);
  messages.appendElement(msgHdr, false);
  /*
  void CopyMessages(in nsIMsgFolder srcFolder,
                    in nsIArray messages,
                    in nsIMsgFolder dstFolder,
                    in boolean isMove,
                    in nsIMsgCopyServiceListener listener,
                    in nsIMsgWindow msgWindow,
                    in boolean allowUndo);
  */

  let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
  copyService.CopyMessages(gIMAPInbox, messages, gSubfolder, true,
                           asyncCopyListener, null, false);
  dl('wait for OnStopCopy');
  yield false;
}

var UrlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
    dl('OnStartRunningUrl');
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    dl('OnStopRunningUrl');
    async_driver();
  }
};

function testPropertyOnMove()
{
  gSubfolder.updateFolderWithListener(null, UrlListener);
  dl('wait for msgAdded');
  yield false; // wait for msgAdded notification
  dl('wait for OnStopRunningURL');
  yield false; // wait for OnStopRunningUrl
  let msgHdr = firstMsgHdr(gSubfolder);
  do_check_eq(msgHdr.getStringProperty("testprop"), "somevalue");
  yield true;
}

// Cleanup
function endTest()
{
  teardownIMAPPump();
}

// listeners

mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    dl('folderAdded <' + aFolder.name + '>');
    // we are only using async yield on the Subfolder add
    if (aFolder.name == "Subfolder")
      async_driver();
  },

  msgAdded: function msgAdded(aMsg)
  {
    dl('msgAdded with subject <' + aMsg.subject + '>')
    async_driver();
  },

};

function run_test()
{
  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  var MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
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

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../mailnews/data/" + aFileName);
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}

// shorthand output of a line of text
function dl(text) {
  dump(text + '\n');
}
