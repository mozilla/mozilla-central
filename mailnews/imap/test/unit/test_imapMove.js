/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests that we use IMAP move if the IMAP server supports it.

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

// IMAP pump
load("../../../resources/IMAPpump.js");
setupIMAPPump("CUSTOM1");

var gFolder1;

var tests = [
  startTest,
  doMove,
  testMove,
  endTest
];

function startTest()
{
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
  // Add folder listeners that will capture async events
  MailServices.mfn.addListener(mfnListener, MailServices.mfn.folderAdded);

  IMAPPump.incomingServer.rootFolder.createSubfolder("folder 1", null);
  yield false;
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];
  let dataUri = Services.io.newURI("data:text/plain;base64," +
                  btoa(messages[0].toMessageString()),
                  null, null);
  let imapMsg = new imapMessage(dataUri.spec, IMAPPump.mailbox.uidnext++, []);
  IMAPPump.mailbox.addMessage(imapMsg);

  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function doMove() {
  let rootFolder = IMAPPump.incomingServer.rootFolder;
  gFolder1 = rootFolder.getChildNamed("folder 1")
               .QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
  let msg = IMAPPump.inbox.msgDatabase.GetMsgHdrForKey(IMAPPump.mailbox.uidnext - 1);
  gMessages.appendElement(msg, false);
  IMAPPump.server._test = true;
  MailServices.copy.CopyMessages(IMAPPump.inbox, gMessages, gFolder1, true,
                            asyncCopyListener, null, false);
  IMAPPump.server.performTest("UID MOVE");
  yield false;
}

function testMove() {
  do_check_eq(IMAPPump.inbox.getTotalMessages(false), 0);
  gFolder1.updateFolderWithListener(null, asyncUrlListener);
  yield false;
  do_check_eq(gFolder1.getTotalMessages(false), 1);
  yield true;
}

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
