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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jonathan Protzenko <jonathan.protzenko@gmail.com>
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

var MODULE_NAME = 'test-archive-messages';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

/**
 * The number of messages in the thread we use to test.
 */
const NUM_MESSAGES_IN_THREAD = 6;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("ThreadedMessages");
  let thread = create_thread(NUM_MESSAGES_IN_THREAD);
  add_sets_to_folders([folder], [thread]);
  thread = create_thread(NUM_MESSAGES_IN_THREAD);
  add_sets_to_folders([folder], [thread]);
}

/**
 * Test archiving messages that are not currently selected.
 */
function test_batch_archiver() {
  be_in_folder(folder);
  make_display_threaded();

  select_none();
  assert_nothing_selected();

  /* Select the first (expanded) thread */
  let root = select_click_row(0);
  assert_selected_and_displayed(root);

  /* Get a grip on the first and the second sub-message */
  let m1 = select_click_row(1);
  let m2 = select_click_row(2);
  select_click_row(0);
  assert_selected_and_displayed(root);

  /* The root message is selected, we archive the first sub-message */
  archive_messages([m1]);

  /* This message is gone and the root message is still selected **/
  assert_message_not_in_view([m1]);
  assert_selected_and_displayed(root);

  /* Now, archiving messages under a collapsed thread */
  toggle_thread_row(0);
  archive_messages([m2]);

  /* Selection didn't change */
  assert_selected(root);

  /* And the message is gone */
  toggle_thread_row(0);
  assert_message_not_in_view([m2]);

  /* Both threads are collapsed */
  toggle_thread_row(0);
  toggle_thread_row(1);

  /* Get a grip on the second thread */
  let root2 = select_click_row(1);
  select_click_row(0);
  assert_selected(root);

  /* Archive the first thread, now the second thread should be selected */
  archive_messages(mc.folderDisplay.selectedMessages);
  assert_selected(root2);

  /* We only have the first thread left */
  toggle_thread_row(0);
  assert_selected_and_displayed(root2);

  /* Archive the head of the thread, check that it still works fine */
  let child1 = select_click_row(1);
  select_click_row(0);
  archive_messages([root2]);
  assert_selected_and_displayed(child1);

  /* Test archiving a partial selection */
  let child2 = select_click_row(1);
  let child3 = select_click_row(2);
  let child4 = select_click_row(3);

  select_shift_click_row(2);
  select_shift_click_row(1);
  select_shift_click_row(0);

  archive_messages([child1, child3]);
  assert_message_not_in_view([child1, child3]);
  assert_selected_and_displayed(child2);
}
