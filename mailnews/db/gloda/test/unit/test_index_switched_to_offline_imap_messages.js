/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that are not offline at first, but
 * are made offline later.
 */

// Most of the definitions are common, so just re-use those
load("test_index_messages.js");

var get_expected_folder_URI = function imap_get_expected_folder_URI() {
  return indexMessageState.imapInbox.URI;
};

var post_test_threading_hook = function imap_post_test_threading_hook() {
  // We aren't concerned about verification here, so just pass in null
  imapDownloadAllMessages(indexMessageState.imapInbox, gSynMessages, null,
                          next_test);
};

// Switch to the IMAP fake server
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
