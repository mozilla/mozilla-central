/**
 * Test indexing support for offline IMAP junk.
 */
load("base_index_junk.js");

function run_test() {
  configure_message_injection({mode: "imap", offline: true});
  glodaHelperRunTests(tests);
}
