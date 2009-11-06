/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that are offline from the start.
 */

load("base_index_messages.js");

function run_test() {
  configure_message_injection({mode: "imap", offline: true});
  glodaHelperRunTests(tests);
}
