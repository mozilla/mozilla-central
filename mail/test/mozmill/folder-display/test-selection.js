/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  wait_for_blank_content_pane();
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

/**
 * Test that the last selected message persists through folder changes.
 */
function test_selection_persists_through_folder_changes() {
  // be in the folder
  be_in_folder(folder);
  // select a message
  select_click_row(3);
  // leave and re-enter the folder
  enter_folder(folder.rootFolder);
  enter_folder(folder);
  // make sure it is selected and displayed
  assert_selected_and_displayed(3);
}
