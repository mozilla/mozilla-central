/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests the operation of the GlodaContent (in connotent.js) and its exposure
 * via Gloda.getMessageContent for IMAP messages that were not originally
 * offline, but were later made offline.
 */

load("test_gloda_content.js");

/**
 * Set the imap folder to offline after adding the messages, then force a
 * download of all messages.
 */
var post_inject_message_hook = function imap_post_inject_message_hook() {
  imapDownloadAllMessages(indexMessageState.imapInbox, gSynMessages,
                          glodaInfoStasher, next_test);
};

injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
