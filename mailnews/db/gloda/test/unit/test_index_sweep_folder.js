/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This file tests the folder indexing logic of Gloda._worker_folderIndex in
 *  the greater context of the sweep indexing mechanism in a whitebox fashion.
 *
 * Automated indexing is suppressed for the duration of this file.
 *
 * In order to test the phases of the logic we inject failures into
 *  GlodaIndexer._indexerGetEnumerator with a wrapper to control how far
 *  indexing gets.  We also clobber or wrap other functions as needed.
 */

load("resources/glodaTestHelper.js");
load("resources/asyncCallbackHandler.js");

/**
 * How many more enumerations before we should throw; 0 means don't throw.
 */
var explode_enumeration_after = 0;
GlodaMsgIndexer._original_indexerGetEnumerator =
  GlodaMsgIndexer._indexerGetEnumerator;
/**
 * Wrapper for GlodaMsgIndexer._indexerGetEnumerator to cause explosions.
 */
GlodaMsgIndexer._indexerGetEnumerator = function() {
  if (explode_enumeration_after && !(--explode_enumeration_after))
    throw asyncExpectedEarlyAbort;

  return GlodaMsgIndexer._original_indexerGetEnumerator.apply(
    GlodaMsgIndexer, arguments);
};

/**
 * Create a folder indexing job for the given injection folder handle and
 * run it until completion.
 */
function spin_folder_indexer() {
  return async_run({func: _spin_folder_indexer_gen,
                    args: arguments});
}
function _spin_folder_indexer_gen(aFolderHandle, aExpectedJobGoal) {
  let msgFolder = get_real_injection_folder(aFolderHandle);

  // cheat and use indexFolder to build the job for us
  GlodaMsgIndexer.indexFolder(msgFolder);
  // steal that job...
  let job = GlodaIndexer._indexQueue.pop();
  GlodaIndexer._indexingJobGoal--;

  // create the worker
  let worker = GlodaMsgIndexer._worker_folderIndex(job, asyncCallbackHandle);
  try {
    yield asyncCallbackHandle.pushAndGo(worker);
  }
  catch(ex) {
    // it's okay if this is from our exploding enumerator wrapper.
    if (ex != expectedReaper)
      do_throw(ex);
  }

  if (aExpectedJobGoal !== undefined)
    do_check_eq(job.goal, aExpectedJobGoal);
}

/**
 * The value itself does not matter; it just needs to be present and be in a
 *  certain range for our logic testing.
 */
const arbitraryGlodaId = 4096;

/**
 * When we enter a filthy folder we should be marking all the messages as filthy
 *  that have gloda-id's and committing.
 */
function test_propagate_filthy_from_folder_to_messages() {
  // mark the folder as filthy
  let [folder, msgSet] = make_folder_with_sets([{count: 3}]);
  let glodaFolder = Gloda.getFolderForFolder(folder);
  glodaFolder._dirtyStatus = glodaFolder.kFolderFilthy;

  // mark each header with a gloda-id so they can get marked filthy
  for each (let msgHdr in msgSet.msgHdrs) {
    msgHdr.setUint32Property("gloda-id", arbitraryGlodaId);
  }

  // force the database to see it as filthy so we can verify it changes
  glodaFolder._datastore.updateFolderDirtyStatus(glodaFolder);
  yield sqlExpectCount(1,
    "SELECT COUNT(*) FROM folderLocations WHERE id = ? " +
      "AND dirtyStatus = ?", glodaFolder.id, glodaFolder.kFolderFilthy);

  // index the folder, aborting at the second get enumerator request
  explode_enumeration_after = 2;
  yield spin_folder_indexer(folder);

  // the folder should only be dirty
  do_check_eq(glodaFolder.dirtyStatus, glodaFolder.kFolderDirty);
  // make sure the database sees it as dirty
  yield sqlExpectCount(1,
    "SELECT COUNT(*) FROM folderLocations WHERE id = ? " +
      "AND dirtyStatus = ?", glodaFolder.id, glodaFolder.kFolderDirty);

  // The messages should be filthy per the headers (we force a commit of the
  //  database.)
  for each (let msgHdr in msgSet.msgHdrs) {
    do_check_eq(msgHdr.getUint32Property("gloda-dirty"),
                GlodaMsgIndexer.kMessageFilthy);
  }
}


/**
 * Make sure our counting pass and our indexing passes gets it right.  We test
 *  with 0,1,2 messages matching.
 */
function test_count_pass() {
  let [folder, msgSet] = make_folder_with_sets([{count: 2}]);
  yield wait_for_message_injection();

  let hdrs = msgSet.msgHdrList;

  // - (clean) messages with gloda-id's do not get indexed
  // nothing is indexed at this point, so all 2.
  explode_enumeration_after = 2;
  yield spin_folder_indexer(folder, 2);

  // pretend the first is indexed, leaving a count of 1.
  hdrs[0].setUint32Property("gloda-id", arbitraryGlodaId);
  explode_enumeration_after = 2;
  yield spin_folder_indexer(folder, 1);

  // pretend both are indexed, count of 0
  hdrs[1].setUint32Property("gloda-id", arbitraryGlodaId);
  // (No explosion should happen since we should never get to the second
  //  enumerator.)
  yield spin_folder_indexer(folder, 0);

  // - dirty messages get indexed
  hdrs[0].setUint32Property("gloda-dirty", GlodaMsgIndexer.kMessageDirty);
  explode_enumeration_after = 2;
  yield spin_folder_indexer(folder, 1);

  hdrs[1].setUint32Property("gloda-dirty", GlodaMsgIndexer.kMessageDirty);
  explode_enumeration_after = 2;
  yield spin_folder_indexer(folder, 2);
}

let tests = [
  test_propagate_filthy_from_folder_to_messages,
  test_count_pass,
];

function run_test() {
  configure_message_injection({mode: "local"});
  // we do not want the event-driven indexer crimping our style
  configure_gloda_indexing({event: false});
  glodaHelperRunTests(tests);
}
