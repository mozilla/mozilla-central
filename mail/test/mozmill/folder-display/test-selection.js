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

var MODULE_NAME = 'test-selection';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

// let us have 2 folders
var folder = null, folder2 = null;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  folder = create_folder("SelectionA");
  folder2 = create_folder("SelectionB");
  make_new_sets_in_folders([folder, folder2], [{count: 50}]);
};

// https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c80
function test_selection_on_entry() {
  enter_folder(folder);
  assert_nothing_selected();
}

function test_selection_extension() {
  be_in_folder(folder);

  // https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c79 (was good)
  select_click_row(1);
  select_control_click_row(2);
  press_delete();
  assert_selected_and_displayed(1);
  // https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c79 (was bad)
  select_click_row(2);
  select_control_click_row(1);
  press_delete();
  assert_selected_and_displayed(1);

  // https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c87 first bit
  press_delete();
  assert_selected_and_displayed(1);
}

// https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c87 last bit
function test_selection_last_message_deleted() {
  be_in_folder(folder);
  select_click_row(-1);
  press_delete();
  assert_selected_and_displayed(-1);
}


function test_selection_persists_through_threading_changes() {
  be_in_folder(folder);

  make_display_unthreaded();
  let message = select_click_row(3);
  make_display_threaded();
  assert_selected_and_displayed(message);
  make_display_grouped();
  assert_selected_and_displayed(message);
}

// https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c82 2nd half
function test_no_selection_persists_through_threading_changes() {
  be_in_folder(folder);

  make_display_unthreaded();
  select_none();
  make_display_threaded();
  assert_nothing_selected();
  make_display_grouped();
  assert_nothing_selected();
  make_display_unthreaded();
}

function test_selection_persists_through_folder_tab_changes() {
  let tab1 = be_in_folder(folder);

  select_click_row(2);

  let tab2 = open_folder_in_new_tab(folder2);
  assert_nothing_selected();

  switch_tab(tab1);
  assert_selected_and_displayed(2);

  switch_tab(tab2);
  assert_nothing_selected();
  select_click_row(3);

  switch_tab(tab1);
  assert_selected_and_displayed(2);
  select_shift_click_row(4); // 2-4 selected
  assert_selected_and_displayed([2,4]); // ensures multi-message summary

  switch_tab(tab2);
  assert_selected_and_displayed(3);

  close_tab(tab2);
  assert_selected_and_displayed([2,4]);
}

// https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c87
/**
 * Verify that we scroll to new messages when we enter a folder.
 */
function test_enter_scroll_to_new() {
  // be in the folder
  be_in_folder(folder);
  // make sure the sort is ascending...
  mc.folderDisplay.view.sortAscending();
  // leave the folder so that the messages get marked as read
  enter_folder(folder.rootFolder);
  // add a new message, and make sure it is new
  let newSet = make_new_sets_in_folder(folder, [{count: 1}]);
  // enter the folder
  enter_folder(folder);
  // make sure it (which must be the last row) is visible
  assert_visible(-1);
}
