/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test query support for IMAP messages that were indexed, then made available
 * offline.
 */
load("test_query_messages.js");

/**
 * Set the imap folder to offline after adding the messages, then force a
 * download of all messages.
 */
var post_setup_populate_hook = function imap_post_setup_populate_hook() {
  imapDownloadAllMessages(indexMessageState.imapInbox, gSynMessages, null,
                          next_test);
};

// TODO: Make this use multiple folders, like the local folders test
var singleFolder = true;
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
