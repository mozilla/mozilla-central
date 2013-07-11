/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-junk-commands';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'junk-helpers'];

var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);

// One folder's enough
var folder = null;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let jh = collector.getModule('junk-helpers');
  jh.installInto(module);

  folder = create_folder("JunkCommandsA");
  make_new_sets_in_folder(folder, [{count: 30}]);
}

/**
 * The number of messages to mark as junk and expect to be deleted.
 */
const NUM_MESSAGES_TO_JUNK = 8;

/**
 * Helper to check whether a folder has the right number of messages.
 *
 * @param aFolder the folder to check
 * @param aNumMessages the number of messages the folder should contain.
 */
function _assert_folder_total_messages(aFolder, aNumMessages) {
  let curMessages = aFolder.getTotalMessages(false);
  if (curMessages != aNumMessages)
    throw new Error("The folder " + aFolder.prettiestName + " should have " +
        aNumMessages + " messages, but actually has " + curMessages +
        " messages.");
}

/**
 * Test deleting junk messages with no messages marked as junk.
 */
function test_delete_no_junk_messages() {
  let initialNumMessages = folder.getTotalMessages(false);
  be_in_folder(folder);
  select_none();
  delete_mail_marked_as_junk(0);
  // Check if we still have the same number of messages
  _assert_folder_total_messages(folder, initialNumMessages);
}

/**
 * Test deleting junk messages with some messages marked as junk.
 */
function test_delete_junk_messages() {
  let initialNumMessages = folder.getTotalMessages(false);
  be_in_folder(folder);
  select_click_row(1);
  let selectedMessages = select_shift_click_row(NUM_MESSAGES_TO_JUNK);
  // Mark these messages as junk
  mark_selected_messages_as_junk();
  // Now delete junk mail
  delete_mail_marked_as_junk(NUM_MESSAGES_TO_JUNK);
  // Check that we have the right number of messages left
  _assert_folder_total_messages(folder,
                                initialNumMessages - NUM_MESSAGES_TO_JUNK);
  // Check that none of the message keys exist any more
  let db = folder.getDBFolderInfoAndDB({});
  for each (let [, msgHdr] in Iterator(selectedMessages)) {
    let key = msgHdr.messageKey;
    if (db.ContainsKey(key))
      throw new Error("The database shouldn't contain key " + key +
                      ", but does.");
  }
}
