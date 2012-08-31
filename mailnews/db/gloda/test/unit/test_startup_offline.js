/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

/*
 * Test gloda starts up with indexing suppressed when offline at startup.
 */

// We must do this before the first load otherwise gloda is started without
// picking up the necessary initialisation.
Services.io.manageOfflineStatus = false;
Services.io.offline = true;

load("resources/glodaTestHelper.js");

/**
 * Make sure that if we have to reparse a local folder we do not hang or
 *  anything.  (We had a regression where we would hang.)
 */
function test_gloda_offline_startup() {
  // Set up a folder for indexing and check the message doesn't get indexed.
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer();

  // Now go online...
  Services.io.offline = false;

  // ...and check we have done the indexing and indexed the message.
  yield wait_for_gloda_indexer(msgSet);
}

let tests = [
  test_gloda_offline_startup,
];

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
