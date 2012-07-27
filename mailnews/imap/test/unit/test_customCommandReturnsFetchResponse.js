/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test to ensure that imap customCommandResult function works properly
 * Bug ?????? 
 * uses Gmail extensions as test case - also useful for bug 721316
 */

// async support 
load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/Services.jsm");

// Globals

// Messages to load must have CRLF line endings, that is Windows style
const gMessageFileName = "bugmail10"; // message file used as the test message
var gMessage, gExpectedLength;

var gXGmLabels = ['\\\\Inbox', '\\\\Sent', 'Important', '"Muy Importante"', 'foo'];

var gMsgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
  .createInstance(Ci.nsIMsgWindow);

setupIMAPPump("GMail");

// Definition of tests
var tests = [
  loadImapMessage,
  testStoreXGMLabel,
  testStoreMinusXGmLabel,
  testStorePlusXGmLabel,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  gMessage = new imapMessage(specForFileName(gMessageFileName),
    gIMAPMailbox.uidnext++, []);
  gMessage.xGmLabels = [];
  gIMAPMailbox.addMessage(gMessage);
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function testStoreXGMLabel()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);
  gExpectedLength = gXGmLabels.length;
  let uri = gIMAPInbox.issueCommandOnMsgs("STORE", msgHdr.messageKey +
    " X-GM-LABELS (" + gXGmLabels.join(" ") + ")", gMsgWindow);
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
  uri.RegisterListener(xGmLabelsSetListener);
  yield false;
}

// listens for response from customCommandResult request for X-GM-MSGID
var xGmLabelsSetListener = {
  OnStartRunningUrl: function (aUrl) {},

  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    do_check_eq(aUrl.customCommandResult,
      "(" + gMessage.xGmLabels.join(" ") + ")");
    do_check_eq(gMessage.xGmLabels.length, gExpectedLength);
    async_driver();
  }
};

function testStoreMinusXGmLabel()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);
  gExpectedLength--;
  let uri = gIMAPInbox.issueCommandOnMsgs("STORE", msgHdr.messageKey +
    " -X-GM-LABELS (" + gXGmLabels[0] + ")", gMsgWindow);
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
  uri.RegisterListener(xGmLabelRemovedListener);
  yield false;
}

// listens for response from customCommandResult request for X-GM-MSGID
var xGmLabelRemovedListener = {
  OnStartRunningUrl: function (aUrl) {},

  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    do_check_eq(aUrl.customCommandResult,
      "(" + gMessage.xGmLabels.join(" ") + ")");      
    do_check_eq(gMessage.xGmLabels.length, gExpectedLength);
    async_driver();
  }
};

function testStorePlusXGmLabel()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);
  gExpectedLength++;
  let uri = gIMAPInbox.issueCommandOnMsgs("STORE", msgHdr.messageKey +
    ' +X-GM-LABELS ("New Label")', gMsgWindow);
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl);
  uri.RegisterListener(xGmLabelAddedListener);
  yield false;
}

// listens for response from customCommandResult request for X-GM-THRID
var xGmLabelAddedListener = {
  OnStartRunningUrl: function (aUrl) {},

  OnStopRunningUrl: function (aUrl, aExitCode) {
    aUrl.QueryInterface(Ci.nsIImapUrl);
    do_check_eq(aUrl.customCommandResult,
      "(" + gMessage.xGmLabels.join(" ") + ")");
    do_check_eq(gMessage.xGmLabels.length, gExpectedLength);
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
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}