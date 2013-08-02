/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test to ensure that, in case of GMail server, fetching of custom GMail
 * attributes works properly.
 *
 * Bug 721316
 *
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=721316
 * for more info.
 *
 * Original Author: Atul Jangra<atuljangra66@gmail.com>
 */

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump

Components.utils.import("resource://gre/modules/Services.jsm");

// Messages to load must have CRLF line endings, that is Windows style
const gMessage = "bugmail10"; // message file used as the test message

const gXGmMsgid = "1278455344230334865";
const gXGmThrid = "1266894439832287888";
const gXGmLabels = '(\\Inbox \\Sent Important "Muy Importante" foo)';

setupIMAPPump("GMail");

IMAPPump.mailbox.specialUseFlag = "\\Inbox";
IMAPPump.mailbox.subscribed = true;

// need all mail folder to identify this as gmail server.
IMAPPump.daemon.createMailbox("[Gmail]", {flags : ["\\NoSelect"] });
IMAPPump.daemon.createMailbox("[Gmail]/All Mail", {subscribed : true,
                                               specialUseFlag : "\\AllMail"});

// Definition of tests
var tests = [
  loadImapMessage,
  testFetchXGmMsgid,
  testFetchXGmThrid,
  testFetchXGmLabels,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  let message = new imapMessage(specForFileName(gMessage),
                                IMAPPump.mailbox.uidnext++, []);
  message.xGmMsgid = gXGmMsgid;
  message.xGmThrid = gXGmThrid;
  message.xGmLabels = gXGmLabels;
  IMAPPump.mailbox.addMessage(message);
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function testFetchXGmMsgid()
{
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  let val = msgHdr.getStringProperty("X-GM-MSGID");
  do_check_eq(val, gXGmMsgid);
}

function testFetchXGmThrid()
{
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  let val = msgHdr.getStringProperty("X-GM-THRID");
  do_check_eq(val, gXGmThrid);
}

function testFetchXGmLabels()
{
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  let val = msgHdr.getStringProperty("X-GM-LABELS");
   // We need to remove the starting "(" and ending ")" from gXGmLabels while comparing
  do_check_eq(val, gXGmLabels.substring(1 ,gXGmLabels.length - 1));
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
