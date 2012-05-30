/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


load("resources/glodaTestHelper.js");


/**
 * Newly created folders should not be filthy (at least as long as they have
 *  nothing in them.)
 */
function test_newly_created_folders_start_clean() {
  let msgFolder = make_empty_folder();
  let glodaFolder = Gloda.getFolderForFolder(msgFolder);
  do_check_eq(glodaFolder.dirtyStatus, glodaFolder.kFolderClean);
}

/**
 * Deleted folders should not leave behind any mapping, and that mapping
 *  definitely should not interfere with a newly created folder of the same
 *  name.
 */
function test_deleted_folder_tombstones_get_forgotten() {
  let oldFolder = make_empty_folder("volver");
  let oldGlodaFolder = Gloda.getFolderForFolder(oldFolder);
  yield async_delete_folder(oldFolder);

  // the tombstone needs to know it is deleted
  do_check_true(oldGlodaFolder._deleted);

  let newFolder = make_empty_folder("volver");
  let newGlodaFolder = Gloda.getFolderForFolder(newFolder);

  // this folder better not be the same and better not think it is deleted.
  do_check_neq(oldGlodaFolder, newGlodaFolder);
  do_check_false(newGlodaFolder._deleted);
}

var tests = [
  test_newly_created_folders_start_clean,
  test_deleted_folder_tombstones_get_forgotten,
];

function run_test() {
  // Tests in this file assume that returned folders are nsIMsgFolders and not
  //  handles which currently only local injection supports.
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
