/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that aren't offline in bulk.
 */

// The definitions are common, so just re-use those
load("test_index_messages_in_bulk.js");

// Switch to the IMAP fake server
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
