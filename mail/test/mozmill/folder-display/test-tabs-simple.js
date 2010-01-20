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

/*
 * Test that opening new folder and message tabs has the expected result and
 *  that closing them doesn't break anything.
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
  // Thread tree here
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
  messageA = select_click_row(0);
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
  // Let's focus the message pane now
  focus_message_pane();
}

/**
 * Select a message in folder B and open it in a new window, making sure that
 *  the displayed message is the right one.
 */
function test_open_message_b_in_tab() {
  messageB = select_click_row(0);
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
