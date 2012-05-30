/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that we fail on bad messages by marking the messages as bad rather than
 *  exploding or something bad like that.
 */

load("resources/glodaTestHelper.js");

var gInbox;

const illegalMessageTemplates = [
  // -- authors
  {
    name: "no author",
    clobberHeaders: {
      From: ""
    }
  },
  {
    name: "too many authors (> 1)",
    clobberHeaders: {
      From: "Tweedle Dee <dee@example.com>, Tweedle Dum <dum@example.com>"
    }
  }
];

/**
 * Using exciting templates from |illegalMessageTemplates|, verify that gloda
 *  fails to index them and marks the messages bad.
 */
function test_illegal_message(aInfo) {
  // Inject the messages.
  let [msgSet] = make_new_sets_in_folder(gInbox, [
                   {count: 1, clobberHeaders: aInfo.clobberHeaders}]);
  yield wait_for_message_injection();

  // indexing should complete without actually indexing the message
  yield wait_for_gloda_indexer([], {recovered: 1, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});

  // make sure the header has the expected gloda bad message state.
  let msgHdr = msgSet.getMsgHdr(0);
  do_check_eq(msgHdr.getUint32Property("gloda-id"), GLODA_BAD_MESSAGE_ID);

  // make sure gloda does not think the message is indexed
  do_check_eq(Gloda.isMessageIndexed(msgHdr), false);
}

/**
 * A byzantine failure to stream should not sink us.  Fake a failure.
 */
function test_streaming_failure() {
  configure_gloda_indexing({injectFaultIn: "streaming"});

  // Inject the messages.
  let [msgSet] = make_new_sets_in_folder(gInbox, [{count: 1}]);
  yield wait_for_message_injection();

  // indexing should complete without actually indexing the message
  yield wait_for_gloda_indexer([], {recovered: 1, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});

  // make sure the header has the expected gloda bad message state.
  let msgHdr = msgSet.getMsgHdr(0);
  do_check_eq(msgHdr.getUint32Property("gloda-id"), GLODA_BAD_MESSAGE_ID);

  // make sure gloda does not think the message is indexed
  do_check_eq(Gloda.isMessageIndexed(msgHdr), false);

  configure_gloda_indexing({});
}

/**
 * If we have one bad message followed by a good message, the good message
 *  should still get indexed.  Additionally, if we do a sweep on the folder,
 *  we should not attempt to index the message again.
 */
function test_recovery_and_no_second_attempts() {
  let [badSet, goodSet] = make_new_sets_in_folder(gInbox, [
                   {count: 1, clobberHeaders: {From: ""}},
                   {count: 1}]);
  yield wait_for_message_injection();

  yield wait_for_gloda_indexer([goodSet], {recovered: 1});

  // index the folder; no messages should get indexed and there should be no
  //  failure things.
  GlodaMsgIndexer.indexFolder(gInbox);
  yield wait_for_gloda_indexer([], {recovered: 0, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});
}

/**
 * Make sure that we attempt to reindex a dirty bad message and that when we
 *  fail that we clear the dirty bit.
 */
function test_reindex_on_dirty_clear_dirty_on_fail() {
  // Inject a new illegal message
  let [msgSet] = make_new_sets_in_folder(gInbox, [{
                   count: 1,
                   clobberHeaders: illegalMessageTemplates[0].clobberHeaders,
                 }]);
  yield wait_for_message_injection();

  // indexing should complete without actually indexing the message
  yield wait_for_gloda_indexer([], {recovered: 1, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});

  // mark the message dirty, force the folder to be indexed
  let msgHdr = msgSet.getMsgHdr(0);
  msgHdr.setUint32Property("gloda-dirty", 1);
  GlodaMsgIndexer.indexFolder(gInbox);
  yield wait_for_gloda_indexer([], {recovered: 1, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});
  // now the message should be clean
  do_check_eq(msgHdr.getUint32Property("gloda-dirty"), 0);

  // eh, check again with filtyh
  msgHdr.setUint32Property("gloda-dirty", 2);
  GlodaMsgIndexer.indexFolder(gInbox);
  yield wait_for_gloda_indexer([], {recovered: 1, failedToRecover: 0,
                                    cleanedUp: 0, hadNoCleanUp: 0});
  // now the message should be clean
  do_check_eq(msgHdr.getUint32Property("gloda-dirty"), 0);
}

let tests = [
  parameterizeTest(test_illegal_message, illegalMessageTemplates),
  test_streaming_failure,
  test_recovery_and_no_second_attempts,
  test_reindex_on_dirty_clear_dirty_on_fail,
];

function run_test() {
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
