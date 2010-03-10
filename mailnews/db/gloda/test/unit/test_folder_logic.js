/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


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
