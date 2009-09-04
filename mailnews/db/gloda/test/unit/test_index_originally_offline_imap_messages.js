/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that are offline from the start.
 */

// Most of the definitions are common, so just re-use those
load("test_index_messages.js");

var get_expected_folder_URI = function imap_get_expected_folder_URI() {
  return indexMessageState.imapInbox.URI;
};

var pre_test_threading_hook = function imap_pre_test_threading_hook() {
  indexMessageState.imapInbox.setFlag(Ci.nsMsgFolderFlags.Offline);
  next_test();
};

// Switch to the IMAP fake server
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
