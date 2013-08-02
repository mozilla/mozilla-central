/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that BCC gets added to message headers on IMAP download
 *
 * adapted from test_downloadOffline.js
 *
 * original author Kent James <kent@caspia.com>
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

const gFileName = "draft1";
const gMsgFile = do_get_file("../../../data/" + gFileName);

var tests = [
  setup,
  downloadAllForOffline,
  checkBccs,
  teardown
];

function setup() {
  setupIMAPPump();

  /*
   * Ok, prelude done. Read the original message from disk
   * (through a file URI), and add it to the Inbox.
   */
  let msgfileuri =
    Services.io.newFileURI(gMsgFile).QueryInterface(Ci.nsIFileURL);

  IMAPPump.mailbox.addMessage(new imapMessage(msgfileuri.spec,
                                          IMAPPump.mailbox.uidnext++, []));

  // ...and download for offline use.
  IMAPPump.inbox.downloadAllForOffline(asyncUrlListener, null);
  yield false;
}

function downloadAllForOffline() {
  IMAPPump.inbox.downloadAllForOffline(asyncUrlListener, null);
  yield false;
}

function checkBccs() {
  // locate the new message by enumerating through the database
  let enumerator = IMAPPump.inbox.msgDatabase.EnumerateMessages();
  while(enumerator.hasMoreElements()) {
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    do_check_true(hdr.bccList.contains("Another Person"));
    do_check_true(hdr.bccList.contains("<u1@example.com>"));
    do_check_false(hdr.bccList.contains("IDoNotExist"));
  }
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}

