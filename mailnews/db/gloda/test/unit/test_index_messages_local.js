/*
 * Test indexing support for local messages.
 */
load("base_index_messages.js");

/**
 * Make sure that if we have to reparse a local folder we do not hang or
 *  anything.  (We had a regression where we would hang.)
 */
function test_reparse_of_local_folder_works() {
  // index a folder
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet);

  // force a db flush so we do not have any outstanding references to the
  //  folder or its headers.
  yield wait_for_gloda_db_flush();

  // mark the summary invalid
  folder.msgDatabase.summaryValid = false;
  // clear the database so next time we have to reparse
  folder.msgDatabase.ForceClosed();

  // force gloda to re-parse the folder again...
  GlodaMsgIndexer.indexFolder(folder);
  yield wait_for_gloda_indexer();
}

tests.unshift(test_reparse_of_local_folder_works);

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
