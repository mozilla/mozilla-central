/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Simple demonstration of the imap pump test method.
 */

// async support 
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");

// IMAP pump
Components.utils.import("resource://testing-common/mailnews/IMAPpump.js");

Components.utils.import("resource://gre/modules/Services.jsm");

// Globals

// Messages to load must have CRLF line endings, that is Windows style
const gMessage = "bugmail10"; // message file used as the test message

setupIMAPPump();

// Definition of tests
var tests = [
  loadImapMessage,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  IMAPPump.mailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          IMAPPump.mailbox.uidnext++, []));
  IMAPPump.inbox.updateFolderWithListener(gDummyMsgWindow, asyncUrlListener);
  yield false;
  do_check_eq(1, IMAPPump.inbox.getTotalMessages(false));
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);
  yield true;
}

// Cleanup at end
function endTest()
{
  teardownIMAPPump();
}

function run_test()
{
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  async_run_tests(tests);
}

/*
 * helper functions
 */

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../../data/" + aFileName);
  let msgfileuri = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}
