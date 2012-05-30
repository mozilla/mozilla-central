/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that message reloads happen properly when the message pane is hidden,
 * and then made visible again.
 */
var MODULE_NAME = "test-message-reloads";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  folder = create_folder("MessageReloads");
  make_new_sets_in_folder(folder, [{count: 1}]);
}

function test_message_reloads_work_with_message_pane_toggles() {
  be_in_folder(folder);

  assert_message_pane_visible();
  select_click_row(0);
  // Toggle the message pane off, then on
  toggle_message_pane();
  assert_message_pane_hidden();
  toggle_message_pane();
  assert_message_pane_visible();
  // Open a new tab with the same message
  open_folder_in_new_tab(folder);
  // Toggle the message pane off
  assert_message_pane_visible();
  toggle_message_pane();
  assert_message_pane_hidden();
  // Go back to the first tab, and make sure the message is actually displayed
  switch_tab(0);
  assert_message_pane_visible();
  assert_selected_and_displayed(0);
}
