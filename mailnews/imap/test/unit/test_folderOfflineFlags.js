/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test that the folders that should get flagged for offline use do, and that
 * those that shouldn't don't.
 */

// make SOLO_FILE="test_folderOfflineFlags.js" -C mailnews/imap/test check-one

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");

// IMAP pump

Components.utils.import("resource://gre/modules/Services.jsm");

// Definition of tests
var tests = [
  setup,
  testGeneralFoldersOffline,
  testTrashNotOffline,
  testJunkNotOffline,
  teardown
];

/**
 * Setup the mailboxes that will be used for this test.
 */
function setup() {
  setupIMAPPump("GMail");

  IMAPPump.mailbox.subscribed = true;
  IMAPPump.mailbox.specialUseFlag = "\\Inbox";
  IMAPPump.daemon.createMailbox("[Gmail]", {flags : ["\\Noselect"], subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/All Mail", {specialUseFlag : "\\AllMail", subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/Drafts", {specialUseFlag : "\\Drafts", subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/Sent", {specialUseFlag : "\\Sent", subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/Spam", {specialUseFlag : "\\Spam", subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/Starred", {specialUseFlag : "\\Starred", subscribed: true});
  IMAPPump.daemon.createMailbox("[Gmail]/Trash", {specialUseFlag : "\\Trash", subscribed: true});
  IMAPPump.daemon.createMailbox("folder1", {subscribed : true});
  IMAPPump.daemon.createMailbox("folder2", {subscribed : true});

  // select the inbox to force folder discovery, etc.
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);

  yield false;
}

/**
 * Test that folders generally are marked for offline use by default.
 */
function testGeneralFoldersOffline() {
  do_check_true(IMAPPump.inbox.getFlag(Ci.nsMsgFolderFlags.Offline));

  let gmail = IMAPPump.incomingServer.rootFolder.getChildNamed("[Gmail]");

  let allmail = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Archive);
  do_check_true(allmail.getFlag(Ci.nsMsgFolderFlags.Offline));

  let drafts = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Drafts);
  do_check_true(drafts.getFlag(Ci.nsMsgFolderFlags.Offline));

  let sent = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.SentMail);
  do_check_true(sent.getFlag(Ci.nsMsgFolderFlags.Offline));

  let rootFolder = IMAPPump.incomingServer.rootFolder;

  let folder1 =  rootFolder.getChildNamed("folder1");
  do_check_true(folder1.getFlag(Ci.nsMsgFolderFlags.Offline));

  let folder2 =  rootFolder.getChildNamed("folder2");
  do_check_true(folder2.getFlag(Ci.nsMsgFolderFlags.Offline));

  yield true;
}

/**
 * Test that Trash isn't flagged for offline use by default.
 */
function testTrashNotOffline() {
  let gmail = IMAPPump.incomingServer.rootFolder.getChildNamed("[Gmail]");
  let trash = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
  do_check_false(trash.getFlag(Ci.nsMsgFolderFlags.Offline));
  yield true;
}

/**
 * Test that Junk isn't flagged for offline use by default.
 */
function testJunkNotOffline() {
  let gmail = IMAPPump.incomingServer.rootFolder.getChildNamed("[Gmail]");
  let spam = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Junk);
  do_check_false(spam.getFlag(Ci.nsMsgFolderFlags.Offline));
  yield true;
}

/** Cleanup at the end. */
function teardown() {
  teardownIMAPPump();
}

/** Run the tests. */
function run_test() {
  async_run_tests(tests);
}

