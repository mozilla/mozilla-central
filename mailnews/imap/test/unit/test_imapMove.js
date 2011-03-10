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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozillamessaging.com>
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

// This tests that we use IMAP move if the IMAP server supports it.

var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Ci.nsIMsgCopyService);
const ioService = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService);


load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

// IMAP pump
load("../../../resources/IMAPpump.js");
setupIMAPPump("CUSTOM1");

var gIMAPInbox, gFolder1;

var tests = [
  startTest,
  doMove,
  testMove,
  endTest
];

function startTest()
{
  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  let MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                     .getService(nsIMFNService);
  MFNService.addListener(mfnListener, nsIMFNService.folderAdded);

  gIMAPIncomingServer.rootFolder.createSubfolder("folder 1", null);
  yield false;
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];
  let dataUri = ioService.newURI("data:text/plain;base64," +
                  btoa(messages[0].toMessageString()),
                  null, null);
  let imapMsg = new imapMessage(dataUri.spec, gIMAPMailbox.uidnext++, []);
  gIMAPMailbox.addMessage(imapMsg);

  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  yield false;
}

function doMove() {
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gFolder1 = rootFolder.getChildNamed("folder 1")
               .QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
  let msg = gIMAPInbox.msgDatabase.GetMsgHdrForKey(gIMAPMailbox.uidnext - 1);
  gMessages.appendElement(msg, false);
  gIMAPServer._test = true;
  gCopyService.CopyMessages(gIMAPInbox, gMessages, gFolder1, true,
                            asyncCopyListener, null, false);
  gIMAPServer.performTest("UID MOVE");
  yield false;
}

function testMove() {
  do_check_eq(gIMAPInbox.getTotalMessages(false), 0);
  gFolder1.updateFolderWithListener(null, UrlListener);
  yield false;
  do_check_eq(gFolder1.getTotalMessages(false), 1);
  yield true;
}

var UrlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    async_driver();
  }
};

var mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    // we are only using async yield on the target folder add
    if (aFolder.name == "folder 1")
      async_driver();
  },
};

function run_test()
{
  async_run_tests(tests);
}


function endTest()
{
  teardownIMAPPump();
  do_test_finished();
}
