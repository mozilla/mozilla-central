/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test query support for IMAP messages that were offline before they were
 * indexed.
 */
load("test_query_messages.js");

// Set the inbox to offline before proceeding
var pre_setup_populate_hook = function imap_pre_setup_populate_hook() {
  indexMessageState.imapInbox.setFlag(Ci.nsMsgFolderFlags.Offline);
  next_test();
};

// TODO: Make this use multiple folders, like the local folders test
var singleFolder = true;
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
