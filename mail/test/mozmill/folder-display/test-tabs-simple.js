/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that opening new folder and message tabs has the expected result and
 * that closing them doesn't break anything.  sid0 added checks for focus
 * transitions at one point; I (asuth) am changing our test infrastructure to
 * cause more realistic focus changes so those changes now look sillier
 * because in many cases we are explicitly setting focus back after the thread
 * tree gains focus.
 */
var MODULE_NAME = 'test-tabs-simple';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderA, folderB, setA, setB;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folderA = create_folder("TabsSimpleA");
  folderB = create_folder("TabsSimpleB");

  // We will verify we are seeing the right folder by checking that it has the
  //  right messages in it.
  [setA] = make_new_sets_in_folder(folderA, [{}]);
  [setB] = make_new_sets_in_folder(folderB, [{}]);
}

/** The tabs in our test. */
var tabFolderA, tabFolderB, tabMessageA, tabMessageB;
/** The message that we selected for tab display, to check it worked right. */
var messageA, messageB;

/**
 * Make sure the default tab works right.
 */
function test_open_folder_a() {
  tabFolderA = be_in_folder(folderA);
  assert_messages_in_view(setA);
  assert_nothing_selected();
  // Focus the folder tree here
  focus_folder_tree();
}

/**
 * Open tab b, make sure it works right.
 */
function test_open_folder_b_in_tab() {
  tabFolderB = open_folder_in_new_tab(folderB);
  wait_for_blank_content_pane();
  assert_messages_in_view(setB);
  assert_nothing_selected();
  focus_thread_tree();
}

/**
 * Go back to tab/folder A and make sure we change correctly.
 */
function test_switch_to_tab_folder_a() {
  switch_tab(tabFolderA);
  assert_messages_in_view(setA);
  assert_nothing_selected();
  assert_folder_tree_focused();
}

/**
 * Select a message in folder A and open it in a new window, making sure that
 *  the displayed message is the right one.
 */
function test_open_message_a_in_tab() {
  // (this focuses the thread tree for tabFolderA...)
  messageA = select_click_row(0);
  // (...refocus the folder tree for our sticky check below)
  focus_folder_tree();
  tabMessageA = open_selected_message_in_new_tab();
  assert_selected_and_displayed(messageA);
  assert_message_pane_focused();
}

/**
 * Go back to tab/folder B and make sure we change correctly.
 */
function test_switch_to_tab_folder_b() {
  switch_tab(tabFolderB);
  assert_messages_in_view(setB);
  assert_nothing_selected();
  assert_thread_tree_focused();
}

/**
 * Select a message in folder B and open it in a new window, making sure that
 *  the displayed message is the right one.
 */
function test_open_message_b_in_tab() {
  messageB = select_click_row(0);
  // Let's focus the message pane now
  focus_message_pane();
  tabMessageB = open_selected_message_in_new_tab();
  assert_selected_and_displayed(messageB);
  assert_message_pane_focused();
}

/**
 * Switch to message tab A.
 */
function test_switch_to_message_a() {
  switch_tab(tabMessageA);
  assert_selected_and_displayed(messageA);
  assert_message_pane_focused();
}

/**
 * Close message tab A (when it's in the foreground).
 */
function test_close_message_a() {
  close_tab();
  // our current tab is now undefined for the purposes of this test.
}

/**
 * Make sure all the other tabs are still happy.
 */
function test_tabs_are_still_happy() {
  switch_tab(tabFolderB);
  assert_messages_in_view(setB);
  assert_selected_and_displayed(messageB);
  assert_message_pane_focused();

  switch_tab(tabMessageB);
  assert_selected_and_displayed(messageB);
  assert_message_pane_focused();

  switch_tab(tabFolderA);
  assert_messages_in_view(setA);
  assert_selected_and_displayed(messageA);
  // focus restoration uses setTimeout(0) and so we need to give it a chance
  mc.sleep(0);
  assert_folder_tree_focused();
}

/**
 * Close message tab B (when it's in the background).
 */
function test_close_message_b() {
  close_tab(tabMessageB);
  // we should still be on folder A
  assert_messages_in_view(setA);
  assert_selected_and_displayed(messageA);
  assert_folder_tree_focused();
}

/**
 * Switch to tab B, close it, make sure we end up on tab A.
 */
function test_close_folder_b() {
  switch_tab(tabFolderB);
  assert_messages_in_view(setB);
  assert_selected_and_displayed(messageB);
  assert_message_pane_focused();

  close_tab();
  assert_messages_in_view(setA);
  assert_selected_and_displayed(messageA);
  assert_folder_tree_focused();
}
