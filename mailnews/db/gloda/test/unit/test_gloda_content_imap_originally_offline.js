/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests the operation of the GlodaContent (in connotent.js) and its exposure
 * via Gloda.getMessageContent for IMAP messages that are originally offline.
 */

load("test_gloda_content.js");

/**
 * Set the imap folder to offline before adding the messages.
 */
var pre_inject_message_hook = function imap_pre_inject_message_hook() {
  indexMessageState.imapInbox.setFlag(Ci.nsMsgFolderFlags.Offline);
  next_test();
};

injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
