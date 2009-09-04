/*
 * This file tests indexing a whole bunch of messages at once.  We
 * are primarily concerned about memory utilization and processor load.
 */

load("../../mailnews/resources/messageGenerator.js");
load("resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/**
 * Provide a bunch of messages to be indexed.
 */
var gSynMessages;
function test_index_a_bunch() {
  // 4-children-per, 3-deep = 21
  // 6-children-per, 3 deep = 43
  // 7-children-per, 3-deep = 57
  // 4-children-per, 4-deep = 85
  // 4-children-per, 5-deep pyramid = 341
  // 5-children-per, 5-deep pyramid = 781
  // 4-children-per, 6-deep pyramid = 1365 messages
  gSynMessages = scenarios.fullPyramid(6, 3);
  // we have no need to verify.
  indexMessages(gSynMessages, null, next_test);
}

var pre_test_hook = function default_pre_test_hook() {
  next_test();
};
var post_test_hook = function default_post_test_hook() {
  next_test();
};

var tests = [
  function pre_test() { pre_test_hook(); },
  test_index_a_bunch,
  function post_test() { post_test_hook(); },
];

function run_test() {
  glodaHelperRunTests(tests);
}

injectMessagesUsing(INJECT_MBOX);
