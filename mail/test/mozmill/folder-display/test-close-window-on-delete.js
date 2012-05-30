/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that the close message window on delete option works.
 */

var MODULE_NAME = 'test-close-window-on-delete';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("CloseWindowOnDeleteA");

  make_new_sets_in_folder(folder, [{count: 10}]);
}

/**
 * Delete a message and check that the message window is closed
 * where appropriate.
 */
function test_close_message_window_on_delete_from_message_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  msgc.window.focus();
  plan_for_window_close(msgc);
  press_delete(msgc);
  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);

  if (msgc2.window.closed)
    throw new Error("should only have closed the active window");

  close_window(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows are open to the message, and the
 * message is deleted from one of them.
 */
function test_close_multiple_message_windows_on_delete_from_message_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_window();
  let msgcA = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  msgc.window.focus();
  plan_for_window_close(msgc);
  plan_for_window_close(msgcA);
  press_delete(msgc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);
  wait_for_window_close(msgcA);

  if (msgc2.window.closed)
    throw new Error("should only have closed the active window");

  close_window(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows are open to the message, and the
 * message is deleted from the 3-pane window.
 */
function test_close_multiple_message_windows_on_delete_from_3pane_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_window();
  let msgcA = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  mc.window.focus();
  plan_for_window_close(msgc);
  plan_for_window_close(msgcA);
  select_click_row(0);
  press_delete(mc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);
  wait_for_window_close(msgcA);

  if (msgc2.window.closed)
    throw new Error("should only have closed the first window");

  close_window(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message and check that the message tab is closed
 * where appropriate.
 */
function test_close_message_tab_on_delete_from_message_tab() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_tab(true);

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_tab(true);

  let preCount = folder.getTotalMessages(false);
  switch_tab(msgc);
  press_delete();

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing tab");

  assert_number_of_tabs_open(2);

  if (msgc2 != mc.tabmail.tabInfo[1])
    throw new Error("should only have closed the active tab");

  close_tab(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows are open to the message, and the
 * message is deleted from one of them.
 */
function test_close_multiple_message_tabs_on_delete_from_message_tab() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_tab(true);
  let msgcA = open_selected_message_in_new_tab(true);

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_tab(true);

  let preCount = folder.getTotalMessages(false);
  switch_tab(msgc);
  press_delete();

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing tab");

  assert_number_of_tabs_open(2);

  if (msgc2 != mc.tabmail.tabInfo[1])
    throw new Error("should only have closed the active tab");

  close_tab(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple tabs are open to the message, and the
 * message is deleted from the 3-pane window.
 */
function test_close_multiple_message_tabs_on_delete_from_3pane_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_tab(true);
  let msgcA = open_selected_message_in_new_tab(true);

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_tab(true);

  let preCount = folder.getTotalMessages(false);
  mc.window.focus();
  select_click_row(0);
  press_delete(mc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");

  assert_number_of_tabs_open(2);

  if (msgc2 != mc.tabmail.tabInfo[1])
    throw new Error("should only have closed the active tab");

  close_tab(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows and tabs are open to the message, and
 * the message is deleted from the 3-pane window.
 */
function test_close_multiple_windows_tabs_on_delete_from_3pane_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  let msgc = open_selected_message_in_new_tab(true);
  let msgcA = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_tab(true);
  let msgc2A = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  mc.window.focus();
  plan_for_window_close(msgcA);
  select_click_row(0);
  press_delete(mc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgcA);

  assert_number_of_tabs_open(2);

  if (msgc2 != mc.tabmail.tabInfo[1])
    throw new Error("should only have closed the active tab");

  if (msgc2A.window.closed)
    throw new Error("should only have closed the first window");

  close_tab(msgc2);
  close_window(msgc2A);

  reset_close_message_on_delete();
}
