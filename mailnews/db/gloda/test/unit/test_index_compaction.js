/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that gloda does the right things in terms of compaction.  Major cases:
 *
 * - Compaction occurs while we are in the process of indexing a folder.  We
 *    want to make sure we stop indexing cleanly
 *
 * - A folder that we have already indexed gets compacted.  We want to make sure
 *    that we update the message keys for all involved.  This means verifying
 *    that both the on-disk representations and in-memory representations are
 *    correct.
 *
 * - Make sure that an indexing sweep performs a compaction pass if we kill the
 *    compaction job automatically scheduled by the conclusion of the
 *    compaction.  (Simulating the user quitting before all compactions have
 *    been processed.)
 *
 * - Moves/deletes that happen after a compaction but before we process the
 *    compaction generate a special type of edge case that we need to check.
 *
 * There is also a less interesting case:
 *
 * - Make sure that the indexer does not try and start indexing a folder that is
 *    in the process of being compacted.
 */

load("resources/glodaTestHelper.js");

/*
 * All the rest of the gloda tests (should) work with maildir, but this test
 * only works/makes sense with mbox, so force it to always use mbox.  This
 * allows developers to manually change the default to maildir and have the
 * gloda tests run with that.
 */
Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");


/**
 * Verify that the message keys match between the message headers and the
 *  (augmented on) gloda messages that correspond to the headers.
 */
function verify_message_keys(aSynSet) {
  let iMsg = 0;
  for each (let msgHdr in aSynSet.msgHdrs) {
    let glodaMsg = aSynSet.glodaMessages[iMsg++];
    if (msgHdr.messageKey != glodaMsg.messageKey)
      mark_failure(["Message header", msgHdr,
                    "should have message key " + msgHdr.messageKey +
                     " but has key " + glodaMsg.messageKey + " per gloda msg",
                    glodaMsg]);
  }
  mark_action("actual", "verified message keys after compaction", []);
}

var indexingPassPermutations = [
  {
    name: "none pending commit",
    forceCommit: true,
  },
  {
    name: "all pending commit",
    forceCommit: false,
  },
];

/**
 * Compact a folder that we were not indexing.  Make sure gloda's representations
 *  get updated to the new message keys.
 *
 * This is parameterized because the logic has special cases to deal with
 *  messages that were pending commit that got blown away.
 */
function test_compaction_indexing_pass(aParam) {
  // Create 5 messages.  We will move just the third message so the first two
  //  message keep their keys and the last two change.  (We want 2 for both
  //  cases to avoid edge cases.)
  let [folder, sameSet, moveSet, shiftSet] = make_folder_with_sets([
    {count: 2}, {count: 1}, {count: 2}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([sameSet, moveSet, shiftSet], {augment: true});

  // move the message to another folder
  let otherFolder = make_empty_folder();
  yield async_move_messages(moveSet, otherFolder);
  yield wait_for_gloda_indexer([moveSet]);

  if (aParam.forceCommit)
    yield wait_for_gloda_db_flush();

  // compact
  let msgFolder = get_real_injection_folder(folder);
  mark_action("actual", "triggering compaction",
              ["folder", msgFolder,
               "gloda folder", Gloda.getFolderForFolder(msgFolder)]);
  msgFolder.compact(asyncUrlListener, null);
  yield false;
  // wait for the compaction job to complete
  yield wait_for_gloda_indexer();

  verify_message_keys(sameSet);
  verify_message_keys(shiftSet);
}

/**
 * Make sure that an indexing sweep performs a compaction pass if we kill the
 *  compaction job automatically scheduled by the conclusion of the compaction.
 *  (Simulating the user quitting before all compactions have been processed.)
 */
function test_sweep_performs_compaction() {
  let [folder, moveSet, staySet] = make_folder_with_sets([
    {count: 1}, {count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([moveSet, staySet], {augment: true});

  // move the message to another folder
  let otherFolder = make_empty_folder();
  yield async_move_messages(moveSet, otherFolder);
  yield wait_for_gloda_indexer([moveSet]);

  // Disable event-driven indexing so there is no way the compaction job can
  //  get worked.
  configure_gloda_indexing({event: false});

  // compact
  let msgFolder = get_real_injection_folder(folder);
  mark_action("actual", "triggering compaction",
              ["folder", msgFolder,
               "gloda folder", Gloda.getFolderForFolder(msgFolder)]);
  msgFolder.compact(asyncUrlListener, null);
  yield false;

  // Erase the compaction job.
  GlodaIndexer.purgeJobsUsingFilter(function() true);

  // Make sure the folder is marked compacted...
  let glodaFolder = Gloda.getFolderForFolder(msgFolder);
  do_check_true(glodaFolder.compacted);

  // Re-enable indexing and fire up an indexing pass
  configure_gloda_indexing({event: true});
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer();

  // Make sure the compaction happened
  verify_message_keys(staySet);
}

/**
 * Make sure that if we compact a folder then move messages out of it and/or
 *  delete messages from it before its compaction pass happens that the
 *  compaction pass properly marks the messages deleted.
 */
function test_moves_and_deletions_on_compacted_folder_edge_case() {
  let [folder, compactMoveSet, moveSet, delSet, staySet] =
    make_folder_with_sets([{count: 1}, {count: 1}, {count: 1}, {count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([compactMoveSet, moveSet, delSet, staySet],
                               {augment: true});

  // move the message to another folder
  let otherFolder = make_empty_folder();
  yield async_move_messages(compactMoveSet, otherFolder);
  yield wait_for_gloda_indexer([compactMoveSet]);

  // Disable indexing because we don't want to process the compaction.
  configure_gloda_indexing({event: false});

  // compact
  let msgFolder = get_real_injection_folder(folder);
  mark_action("actual", "triggering compaction",
              ["folder", msgFolder,
               "gloda folder", Gloda.getFolderForFolder(msgFolder)]);
  msgFolder.compact(asyncUrlListener, null);
  yield false;

  // Erase the compaction job.
  GlodaIndexer.purgeJobsUsingFilter(function() true);

  // - Delete
  // Because of the compaction, the PendingCommitTracker forgot that the message
  //  we are deleting got indexed; we will receive no event.
  yield async_delete_messages(delSet);

  // - Move
  // Same deal on the move, except that it will try and trigger event-based
  //  indexing in the target folder...
  yield async_move_messages(moveSet, otherFolder);
  // Kill the event-based indexing job of the target; we want the indexing sweep
  //  to see it as a move.
  mark_action("actual", "killing all indexing jobs", []);
  GlodaIndexer.purgeJobsUsingFilter(function() true);

  // - Indexing pass
  // Reenable indexing so we can do a sweep.
  configure_gloda_indexing({event: true});

  // This will trigger compaction (per the previous unit test) which should mark
  //  moveSet and delSet as deleted.  Then it should happen in to the next
  //  folder and add moveSet again...
  mark_action("actual", "triggering indexing sweep", []);
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([moveSet], {deleted: [moveSet, delSet]});

  // Sanity check the compaction for giggles.
  verify_message_keys(staySet);
}

/**
 * Induce a compaction while we are in the middle of indexing.  Make sure we
 *  clean up and that the folder ends
 *
 * Note that in order for compaction to happen there has to be something for
 *  compaction to do, so our prep involves moving a message to another folder.
 *  (Deletion actually produces more legwork for gloda whereas a local move is
 *  almost entirely free.)
 */
function test_compaction_interrupting_indexing() {
  // create a folder with a message inside.
  let [folder, compactionFodderSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([compactionFodderSet]);

  // move that message to another folder
  let otherFolder = make_empty_folder();
  yield async_move_messages(compactionFodderSet, otherFolder);
  yield wait_for_gloda_indexer([compactionFodderSet]);

  // Configure the gloda indexer to hang while streaming the message.
  configure_gloda_indexing({hangWhile: "streaming"});

  // create a folder with a message inside.
  let [msgSet] = make_new_sets_in_folder(folder, [{count: 1}]);
  yield wait_for_message_injection();

  yield wait_for_indexing_hang();

  // compact!  this should kill the job (and because of the compaction; no other
  //  reason should be able to do this.)
  let msgFolder = get_real_injection_folder(folder);
  msgFolder.compact(asyncUrlListener, null);
  yield false;

  // reset indexing to not hang
  configure_gloda_indexing({});

  // sorta get the event chain going again...
  resume_from_simulated_hang(true);

  // Because the folder was dirty it should actually end up getting indexed,
  //  so in the end the message will get indexed.
  // Also, make sure a cleanup was observed.
  yield wait_for_gloda_indexer([msgSet], {cleanedUp: 1});
}

/**
 *
 */
function test_do_not_enter_compacting_folders() {
  // turn off indexing...
  configure_gloda_indexing({event: false});

  // create a folder with a message inside.
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();

  // lie and claim we are compacting that folder
  let glodaFolder = Gloda.getFolderForFolder(get_real_injection_folder(folder));
  glodaFolder.compacting = true;

  // now try and force ourselves to index that folder and its message...
  // turn back on indexing...
  configure_gloda_indexing({event: true});

  // verify that the indexer completes without having indexed anything
  yield wait_for_gloda_indexer([]);
}

var tests = [
  parameterizeTest(test_compaction_indexing_pass, indexingPassPermutations),
  test_sweep_performs_compaction,
  test_moves_and_deletions_on_compacted_folder_edge_case,
  test_compaction_interrupting_indexing,
  test_do_not_enter_compacting_folders,
];

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
