/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test indexing in the face of junk classification and junk folders.  It is
 *  gloda policy not to index junk mail.
 *
 * A similar test that moving things to the trash folder is deletion happens in
 *  base_index_messages.js.
 */

load("resources/glodaTestHelper.js");

Components.utils.import("resource:///modules/mailServices.js");

const SPAM_BODY = {body: "superspam superspam superspam eevil eevil eevil"};
const HAM_BODY = {body: "ham ham ham nice nice nice happy happy happy"};

/**
 * Make SPAM_BODY be known as spammy and HAM_BODY be known as hammy.
 */
function setup_spam_filter() {
  let [folder, spamSet, hamSet] = make_folder_with_sets([
    {count: 1, body: SPAM_BODY}, {count: 1, body: HAM_BODY}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([spamSet, hamSet]);

  let junkListener = {
    onMessageClassified: function() {
      async_driver();
    }
  };

  // ham
  mark_action("actual", "marking message as ham", [hamSet.getMsgHdr(0)]);
  MailServices.junk.setMessageClassification(hamSet.getMsgURI(0),
                                             null, // no old classification
                                             MailServices.junk.GOOD,
                                             null,
                                             junkListener);
  yield false;

  // spam
  mark_action("actual", "marking message as spam", [spamSet.getMsgHdr(0)]);
  MailServices.junk.setMessageClassification(spamSet.getMsgURI(0),
                                             null, // no old classification
                                             MailServices.junk.JUNK,
                                             null,
                                             junkListener);
  yield false;
}

/**
 * Because gloda defers indexing until after junk, we should never index a
 *  message that gets marked as junk.  So if we inject a message that will
 *  definitely be marked as junk (thanks to use of terms that guarantee it),
 *  the indexer should never index it.
 *
 * ONLY THIS TEST ACTUALLY RELIES ON THE BAYESIAN CLASSIFIER.
 */
function test_never_indexes_a_message_marked_as_junk() {
  mark_sub_test_start("event-driven does not index junk");

  // make a message that will be marked as junk from the get-go
  let [folder, msgSet] = make_folder_with_sets([{count: 1, body: SPAM_BODY}]);
  yield wait_for_message_injection();
  // since the message is junk, gloda should not index it!
  yield wait_for_gloda_indexer([]);

  mark_sub_test_start("folder sweep does not index junk");
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([]);
}

/**
 * Reset the training data so the bayesian classifier stops doing things.
 */
function reset_spam_filter() {
  MailServices.junk.resetTrainingData();
}

/**
 * Marking a message as junk is equivalent to deleting the message, un-mark it
 *  and it should go back to being a happy message (with the same gloda-id!).
 *
 * THIS TEST DOES NOT RELY ON THE BAYESIAN CLASSIFIER.
 */
function test_mark_as_junk_is_deletion_mark_as_not_junk_is_exposure() {
  mark_sub_test_start("mark as junk is deletion");
  // create a message; it should get indexed
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([msgSet], {augment: true});

  let glodaId = msgSet.glodaMessages[0].id;

  // mark it as junk!
  msgSet.setJunk(true);

  // it will appear deleted after the event...
  yield wait_for_gloda_indexer([], {deleted: msgSet});


  mark_sub_test_start("mark as non-junk gets indexed");
  msgSet.setJunk(false);
  yield wait_for_gloda_indexer([msgSet], {augment: true});

  // we should have reused the existing gloda message so it should keep the id
  do_check_eq(glodaId, msgSet.glodaMessages[0].id);
}

/**
 * Moving a message to the junk folder is equivalent to deletion.  Gloda does
 *  not index junk folders at all, which is why this is an important and
 *  independent determination from marking a message directly as junk.
 *
 * The move to the junk folder is performed without using any explicit junk
 *  support code.  This ends up being effectively the same underlying logic test
 *  as base_index_messages' test of moving a message to the trash folder.
 */
function test_message_moving_to_junk_folder_is_deletion() {
  // create and index two messages in a conversation
  let [folder, msgSet] = make_folder_with_sets([{count: 2, msgsPerThread: 2}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([msgSet], {augment: true});

  let convId = msgSet.glodaMessages[0].conversation.id;
  let firstGlodaId = msgSet.glodaMessages[0].id;
  let secondGlodaId = msgSet.glodaMessages[1].id;

  // move them to the junk folder.
  yield async_move_messages(msgSet, get_junk_folder());

  // they will appear deleted after the events
  yield wait_for_gloda_indexer([], {deleted: msgSet});

  // we do not index the junk folder so this should actually make them appear
  //  deleted to an unprivileged query.
  let msgQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  msgQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgQuery, []);
  yield false; // queryExpect is async

  // force a sweep
  GlodaMsgIndexer.indexingSweepNeeded = true;
  // there should be no apparent change as the result of this pass
  // (well, the conversation will die, but we can't see that.)
  yield wait_for_gloda_indexer([]);

  // the conversation should be gone
  let convQuery = Gloda.newQuery(Gloda.NOUN_CONVERSATION);
  convQuery.id(convId);
  queryExpect(convQuery, []);
  yield false; // queryExpect is async

  // the messages should be entirely gone
  let msgPrivQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                                      noDbQueryValidityConstraints: true,
                                    });
  msgPrivQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgPrivQuery, []);
  yield false; // queryExpect is async
}

var tests = [
  setup_spam_filter,
  test_never_indexes_a_message_marked_as_junk,
  reset_spam_filter,
  test_mark_as_junk_is_deletion_mark_as_not_junk_is_exposure,
  test_message_moving_to_junk_folder_is_deletion,
];
