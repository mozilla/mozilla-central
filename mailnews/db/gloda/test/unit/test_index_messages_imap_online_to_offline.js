/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests how well gloda indexes IMAP messages that are not offline at first, but
 * are made offline later.
 */

load("base_index_messages.js");

// we want to go offline once the messages have already been indexed online
goOffline = true;

function run_test() {
  // start with the messages online
  configure_message_injection({mode: "imap", offline: false});
  glodaHelperRunTests(tests);
}
