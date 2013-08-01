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
load("../../../resources/IMAPpump.js");

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

  gIMAPMailbox.subscribed = true;
  gIMAPMailbox.specialUseFlag = "\\Inbox";
  gIMAPDaemon.createMailbox("[Gmail]", {flags : ["\\Noselect"], subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/All Mail", {specialUseFlag : "\\AllMail", subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/Drafts", {specialUseFlag : "\\Drafts", subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/Sent", {specialUseFlag : "\\Sent", subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/Spam", {specialUseFlag : "\\Spam", subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/Starred", {specialUseFlag : "\\Starred", subscribed: true});
  gIMAPDaemon.createMailbox("[Gmail]/Trash", {specialUseFlag : "\\Trash", subscribed: true});
  gIMAPDaemon.createMailbox("folder1", {subscribed : true});
  gIMAPDaemon.createMailbox("folder2", {subscribed : true});

  // select the inbox to force folder discovery, etc.
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);

  yield false;
}

/**
 * Test that folders generally are marked for offline use by default.
 */
function testGeneralFoldersOffline() {
  do_check_true(gIMAPInbox.getFlag(Ci.nsMsgFolderFlags.Offline));

  let gmail = gIMAPIncomingServer.rootFolder.getChildNamed("[Gmail]");

  let allmail = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Archive);
  do_check_true(allmail.getFlag(Ci.nsMsgFolderFlags.Offline));

  let drafts = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Drafts);
  do_check_true(drafts.getFlag(Ci.nsMsgFolderFlags.Offline));

  let sent = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.SentMail);
  do_check_true(sent.getFlag(Ci.nsMsgFolderFlags.Offline));

  let rootFolder = gIMAPIncomingServer.rootFolder;

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
  let gmail = gIMAPIncomingServer.rootFolder.getChildNamed("[Gmail]");
  let trash = gmail.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash);
  do_check_false(trash.getFlag(Ci.nsMsgFolderFlags.Offline));
  yield true;
}

/**
 * Test that Junk isn't flagged for offline use by default.
 */
function testJunkNotOffline() {
  let gmail = gIMAPIncomingServer.rootFolder.getChildNamed("[Gmail]");
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

