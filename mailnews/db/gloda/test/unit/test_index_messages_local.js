/**
 * Test indexing support for local messages.
 */
load("base_index_messages.js");

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
