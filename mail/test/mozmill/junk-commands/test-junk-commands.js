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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

var MODULE_NAME = 'test-junk-commands';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'junk-helpers'];

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
  delete_mail_marked_as_junk();
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
  delete_mail_marked_as_junk();
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
