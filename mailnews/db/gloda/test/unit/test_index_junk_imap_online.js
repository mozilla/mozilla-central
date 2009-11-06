/**
 * Test indexing support for online IMAP junk.
 */
load("base_index_junk.js");

function run_test() {
  configure_message_injection({mode: "imap", offline: false});
  glodaHelperRunTests(tests);
}
