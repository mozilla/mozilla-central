/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that aren't offline.
 */

// Most of the definitions are common, so just re-use those
load("test_index_messages.js");

var get_expected_folder_URI = function imap_get_expected_folder_URI() {
  return indexMessageState.imapInbox.URI;
};

var expectFulltextResults = false;

// Switch to the IMAP fake server
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
