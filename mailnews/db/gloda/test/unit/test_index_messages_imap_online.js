/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that aren't offline.
 */

// Most of the definitions are common, so just re-use those
load("base_index_messages.js");

expectFulltextResults = false;

function run_test() {
  configure_message_injection({mode: "imap", offline: false});
  glodaHelperRunTests(tests);
}
