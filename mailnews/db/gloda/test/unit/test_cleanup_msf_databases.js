/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file tests whether we cleanup after ourselves, msf-wise.
 * This is very much a white-box test; we want to make sure that all the parts
 *  of the mechanism are actually doing what we think they should be doing.
 *
 * This test should stand on its own!  It should not be lumped together with
 *  other tests unless you take care to fix all our meddling.
 */

load("resources/glodaTestHelper.js");

/**
 * @return the number of live gloda folders tracked by
 *     GlodaDatastore._liveGlodaFolders.
 */
function getLiveFolderCount() {
  return [key for each (key in GlodaDatastore._liveGlodaFolders)].length;
}

/**
 * Meddle with internals of live folder tracking, create a synthetic message and
 *  index it. We do the actual work involving the headers and folders in
 *  poke_and_verify_msf_closure.
 */
function test_msf_closure() {
  // before doing anything, the indexer should not be tracking any live folders
  do_check_false(GlodaDatastore._folderCleanupActive);
  do_check_eq(0, getLiveFolderCount());

  // make the datastore's folder cleanup timer never be at risk of firing
  GlodaDatastore._folderCleanupTimerInterval = 1000000000;
  // set the acceptably old threshold so it will never age out
  GlodaFolder.prototype.ACCEPTABLY_OLD_THRESHOLD = 1000000000;

  // create a synthetic message
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {verifier: poke_and_verify_msf_closure});
}

/**
 * Grab the message header, see live folder, cleanup live folders, make sure
 *  live folder stayed live, change constants so folder can die, cleanup live
 *  folders, make sure folder died.
 *
 * @param aSynthMessage The synthetic message we indexed.
 * @param aGlodaMessage Its exciting gloda representation
 */
function poke_and_verify_msf_closure(aSynthMessage, aGlodaMessage) {
  // get the nsIMsgDBHdr
  let header = aGlodaMessage.folderMessage;
  // if we don't have a header, this test is unlikely to work...
  do_check_neq(header, null);

  // we need a reference to the glodaFolder
  let glodaFolder = aGlodaMessage.folder;

  // -- check that everyone is tracking things correctly
  // the message's folder should be holding an XPCOM reference to the folder
  do_check_neq(glodaFolder._xpcomFolder, null);
  // the cleanup timer should now be alive
  do_check_true(GlodaDatastore._folderCleanupActive);
  // live folder count should be one
  do_check_eq(1, getLiveFolderCount());

  // -- simulate a timer cleanup firing...
  GlodaDatastore._performFolderCleanup();

  // -- verify that things are still as they were before the cleanup firing
  // the message's folder should be holding an XPCOM reference to the folder
  do_check_neq(glodaFolder._xpcomFolder, null);
  // the cleanup timer should now be alive
  do_check_true(GlodaDatastore._folderCleanupActive);
  // live folder count should be one
  do_check_eq(1, getLiveFolderCount());

  // -- change oldness constant so that it cannot help but be true
  // (the goal is to avoid getting tricked by the granularity of the timer
  //  updates, as well as to make sure our logic is right by skewing the
  //  constant wildly, so that if our logic was backwards, we would fail.)
  // put the threshold 1000 seconds in the future; the event must be older than
  //  the future, for obvious reasons.
  GlodaFolder.prototype.ACCEPTABLY_OLD_THRESHOLD = -1000000;

  // -- simulate a timer cleanup firing...
  GlodaDatastore._performFolderCleanup();

  // -- verify that cleanup has occurred and the cleanup mechanism shutdown.
  // the message's folder should no longer be holding an XPCOM reference
  do_check_eq(glodaFolder._xpcomFolder, null);
  // the cleanup timer should now be dead
  do_check_false(GlodaDatastore._folderCleanupActive);
  // live folder count should be zero
  do_check_eq(0, getLiveFolderCount());
}

var tests = [
  test_msf_closure,
];

function run_test() {
  // we only need to test using local folders, although it is important that
  //  we are using a non-Inbox folder (which we are).
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
