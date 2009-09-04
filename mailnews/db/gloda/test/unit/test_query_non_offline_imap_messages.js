/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test query support for IMAP messages that aren't offline.
 */
load("test_query_messages.js");

var expectFulltextResults = false;
// TODO: Make this use multiple folders, like the local folders test
var singleFolder = true;
injectMessagesUsing(INJECT_IMAP_FAKE_SERVER);
