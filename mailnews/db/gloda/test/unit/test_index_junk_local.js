/**
 * Test indexing support for local junk.
 */
load("base_index_junk.js");

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
