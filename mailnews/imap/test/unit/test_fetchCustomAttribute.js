/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test to ensure that imap fetchCustomMsgAttribute function works properly
 */

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump

Components.utils.import("resource://gre/modules/Services.jsm");

// Globals

// Messages to load must have CRLF line endings, that is Windows style
const gMessage = "bugmail10"; // message file used as the test message

const gCustomValue = "Custom";
const gCustomList = ["Custom1", "Custom2", "Custom3"];

var gMsgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
  .createInstance(Ci.nsIMsgWindow);

setupIMAPPump("CUSTOM1");

// Definition of tests
var tests = [
  loadImapMessage,
  testFetchCustomValue,
  testFetchCustomList,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  let message = new imapMessage(specForFileName(gMessage),
                          IMAPPump.mailbox.uidnext++, []);
  message.xCustomValue = gCustomValue;
  message.xCustomList = gCustomList;
  IMAPPump.mailbox.addMessage(message);
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

// Used to verify that nsIServerResponseParser.msg_fetch() can handle
// not in a parenthesis group - Bug 750012
function testFetchCustomValue()
{
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  let uri = IMAPPump.inbox.fetchCustomMsgAttribute("X-CUSTOM-VALUE", msgHdr.messageKey, gMsgWindow);
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
  uri.RegisterListener(fetchCustomValueListener);
  yield false;
}

// listens for resposne from fetchCustomMsgAttribute request for X-CUSTOM-VALUE
var fetchCustomValueListener = {
  OnStartRunningUrl: function (aUrl) {},

  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    do_check_eq(aUrl.customAttributeResult, gCustomValue);
    async_driver();
  }
};

// Used to verify that nsIServerResponseParser.msg_fetch() can handle a parenthesis group - Bug 735542
function testFetchCustomList()
{
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  let uri = IMAPPump.inbox.fetchCustomMsgAttribute("X-CUSTOM-LIST", msgHdr.messageKey, gMsgWindow);
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
  uri.RegisterListener(fetchCustomListListener);
  yield false;
}

// listens for response from fetchCustomMsgAttribute request for X-CUSTOM-LIST
var fetchCustomListListener = {
  OnStartRunningUrl: function (aUrl) {},

  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    do_check_eq(aUrl.customAttributeResult, "(" + gCustomList.join(" ") + ")");
    async_driver();
  }
};

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
