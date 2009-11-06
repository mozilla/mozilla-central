/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test query support for IMAP messages that were offline before they were
 * indexed.
 */
load("base_query_messages.js");

function run_test() {
  configure_message_injection({mode: "imap", offline: true});
  glodaHelperRunTests(tests);
}
