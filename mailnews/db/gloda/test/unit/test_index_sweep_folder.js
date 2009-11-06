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
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
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

/* This file tests the folder indexing logic of Gloda._worker_folderIndex in
 *  the greater context of the sweep indexing mechanism.
 *
 * Automated indexing is suppressed for the duration of this file.
 *
 * This is all white-box testing where we know and depend on how the mechanism
 *  is supposed to work/works.  In order to test the phases of the logic we
 *  inject failures into GlodaIndexer._indexerGetEnumerator with a wrapper to
 *  control how far indexing gets.  We also clobber or wrap other functions as
 *  needed.
 */

load("resources/glodaTestHelper.js");

/**
 * We do not index news or RSS.  Make sure we stay out of those folders.
 */
function test_ignore_folders_we_should_not_index() {
  // make sure it ignores news
  // make sure it ignores RSS
}

/**
 * When we enter a filthy folder we should be marking all the messages as filthy
 *  and committing.
 *
 */
function test_propagate_filthy_from_folder_to_messages() {
  // mark the folder as filthy

  // index the folder, aborting at the second get enumerator request

  // all those messages better be filthy now!
}

/**
 * Create a folder indexing job for the given injection folder handle.  We
 *
 */
function spin_folder_indexer(aFolderHandle) {
  let msgFolder = get_real_injection_folder(aFolderHandle);

  // cheat and use indexFolder to build the job for us
  GlodaMsgIndexer.indexFolder(msgFolder);
  // steal that job...
  let job = GlodaIndexer._indexQueue.pop();
  GlodaIndexer._indexingJobGoal--;

  // create the worker
  let worker = GlodaIndexer._worker_folderIndex(job);


}

/**
 * Make sure our counting pass and our indexing passes gets it right.  We test
 *  with 0,1,2 messages matching.
 */
function test_count_and_index_messages() {
  let [folder, msgSet] = make_folder_with_sets([{count: 3}]);
  yield wait_for_message_injection();

  let hdrs = msgSet.msgHdrs;

  // - messages with no gloda-id need to get indexed!

  // - messages with gloda-id's do not get indexed

  // - dirty messages get indexed
}

/**
 * Make sure we try and index the right messages.  This is basically the
 */

let tests = [
  test_ignore_folders_we_should_not_index,
  test_propagate_filthy_from_folder_to_messages,
  test_count_and_index_messages,
];

function run_test() {
  configure_message_injection({mode: "local"});
  // we do not want the event-driven indexer crimping our style
  configure_gloda_indexing({event: false});
  glodaHelperRunTests(tests);
}
