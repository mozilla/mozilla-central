/*
 * This file tests indexing a whole bunch of messages at once.  We
 * are primarily concerned about memory utilization and processor load.
 */

do_import_script("../mailnews/db/gloda/test/resources/messageGenerator.js");

//these are imported by glodaTestHelper's import of head_maillocal
// do_import_script("../mailnews/test/resources/mailDirService.js");
// do_import_script("../mailnews/test/resources/mailTestUtils.js");
do_import_script("../mailnews/db/gloda/test/resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/**
 * Provide a bunch of messages to be indexed.
 */
function test_index_a_bunch() {
  // 4-children-per, 3-deep = 21
  // 4-children-per, 4-deep = 85
  // 4-children-per, 5-deep pyramid = 341
  // 5-children-per, 5-deep pyramid = 781
  // 4-children-per, 6-deep pyramid = 1365 messages
  let messages = scenarios.fullPyramid(4, 3);
  // we have no need to verify.
  indexMessages(messages, null, next_test);
}

var tests = [
  test_index_a_bunch,
];

function run_test() {
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
