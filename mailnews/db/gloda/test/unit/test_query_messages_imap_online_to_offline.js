/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test query support for IMAP messages that were indexed, then made available
 * offline.
 */
load("base_query_messages.js");

// we want to go offline once the messages have already been indexed online
goOffline = true;

function run_test() {
  // start with the messages online
  configure_message_injection({mode: "imap", offline: false});
  glodaHelperRunTests(tests);
}
