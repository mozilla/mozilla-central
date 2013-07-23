/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Test that imapd.js fakeserver correctly emulates GMail server
// That means X-GM-EXT-1 capability and GMail flavor XLIST
// per https://developers.google.com/google-apps/gmail/imap_extensions

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/Services.jsm");


setupIMAPPump("GMail");
// create our own hander so that we can call imapd functions directly
var handler;

// Definition of tests
var tests = [
  setupMailboxes,
  testXlist,
  endTest
]

// mbox mailboxes cannot contain both child mailboxes and messages, so this will
// be one test case.
function setupMailboxes()
{
  gIMAPMailbox.specialUseFlag = "\\Inbox";
  gIMAPDaemon.createMailbox("[Gmail]", {flags : ["\\Noselect"]});
  gIMAPDaemon.createMailbox("[Gmail]/All Mail", {specialUseFlag : "\\AllMail"});
  gIMAPDaemon.createMailbox("[Gmail]/Drafts", {specialUseFlag : "\\Drafts"});
  gIMAPDaemon.createMailbox("[Gmail]/Sent", {specialUseFlag : "\\Sent"});
  gIMAPDaemon.createMailbox("[Gmail]/Spam", {specialUseFlag : "\\Spam"});
  gIMAPDaemon.createMailbox("[Gmail]/Starred", {specialUseFlag : "\\Starred"});
  gIMAPDaemon.createMailbox("[Gmail]/Trash", {specialUseFlag : "\\Trash"});
  gIMAPDaemon.createMailbox("test", {});

  handler = gIMAPServer._handlerCreator(gIMAPDaemon);
  let response = handler.onError('1', 'LOGIN user password');
  do_check_true(response.contains('OK'));
  // wait for imap pump to do its thing or else we get memory leaks
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

// test that 'XLIST "" "*"' returns the proper responses
function testXlist()
{
  let response = handler.onError('2', 'XLIST "" "*"');

  do_check_true(response.contains('* LIST (\\HasNoChildren \\Inbox) "/" "INBOX"'));
  do_check_true(response.contains('* LIST (\\Noselect \\HasChildren) "/" "[Gmail]"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\AllMail) "/" "[Gmail]/All Mail"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\Drafts) "/" "[Gmail]/Drafts"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\Sent) "/" "[Gmail]/Sent"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\Spam) "/" "[Gmail]/Spam"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\Starred) "/" "[Gmail]/Starred"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren \\Trash) "/" "[Gmail]/Trash"'));
  do_check_true(response.contains('* LIST (\\HasNoChildren) "/" "test"'));

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

function recursiveDeleteMailboxes(aMailbox)
{
  for each (var child in aMailbox.allChildren) {
    recursiveDeleteMailboxes(child);
  }
  gIMAPDaemon.deleteMailbox(aMailbox);
}
