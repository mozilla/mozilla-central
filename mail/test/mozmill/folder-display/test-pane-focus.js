/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that cycling through the focus of the 3pane's panes works correctly.
 */
var MODULE_NAME = "test-pane-focus";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  folder = create_folder("PaneFocus");
  let msg1 = create_thread(1);
  thread = create_thread(3);
  let msg2 = create_thread(1);
  add_sets_to_folders([folder], [msg1, thread, msg2]);

  be_in_folder(folder);
  make_display_threaded();
  collapse_all_threads();
}

/**
 * Get the currently-focused pane in the 3pane. One of the folder pane, thread
 * pane, or message pane (single- or multi-message).
 *
 * @return the focused pane
 */
function get_focused_pane() {
  let panes = [mc.e(id) for each (id in [
    "threadTree", "folderTree", "messagepane", "multimessage"
  ])];

  let currentNode = mc.window.top.document.activeElement;

  while (currentNode) {
    if (panes.indexOf(currentNode) != -1)
      return currentNode;

    currentNode = currentNode.parentNode;
  }
  return null;
}

/**
 * Check that it's possible to cycle through the 3pane's panes forward and
 * backward.
 *
 * @param multimessage true if the multimessage pane should be active
 */
function check_pane_cycling(multimessage) {
  let folderPane = mc.e("folderTree");
  let threadPane = mc.e("threadTree");
  let messagePane = mc.e(multimessage ? "multimessage" : "messagepane");

  folderPane.focus();

  mc.keypress(null, "VK_F6", {});
  assert_equals(threadPane, get_focused_pane());
  mc.keypress(null, "VK_F6", {});
  assert_equals(messagePane, get_focused_pane());
  mc.keypress(null, "VK_F6", {});
  assert_equals(folderPane, get_focused_pane());

  mc.keypress(null, "VK_F6", {shiftKey: true});
  assert_equals(messagePane, get_focused_pane());
  mc.keypress(null, "VK_F6", {shiftKey: true});
  assert_equals(threadPane, get_focused_pane());
  mc.keypress(null, "VK_F6", {shiftKey: true});
  assert_equals(folderPane, get_focused_pane());
}

function test_no_messages_selected() {
  be_in_folder(folder);

  // Select nothing
  select_none();
  check_pane_cycling(false);
}

function test_one_message_selected() {
  be_in_folder(folder);

  // Select a message
  select_click_row(0);
  check_pane_cycling(false);
}

function test_n_messages_selected() {
  be_in_folder(folder);

  // Select a thread
  select_click_row(1);
  check_pane_cycling(true);
}

function test_between_tab_and_single_message() {
  be_in_folder(folder);
  select_click_row(0);
  let tab = open_selected_message_in_new_tab(true);

  select_click_row(2);

  // First, try swapping back and forth between the tabs when the message
  // pane is focused.
  mc.window.SetFocusMessagePane();

  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("messagepane"), get_focused_pane());
  
  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("messagepane"), get_focused_pane());

  // Now, focus the folder tree and make sure focus updates properly.
  mc.e("folderTree").focus();
  
  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("folderTree"), get_focused_pane());

  close_tab(tab);
}

function test_between_tab_and_multi_message() {
  be_in_folder(folder);
  select_click_row(0);
  let tab = open_selected_message_in_new_tab(true);

  select_click_row(1);

  // First, try swapping back and forth between the tabs when the message
  // pane is focused.
  mc.window.SetFocusMessagePane();

  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("multimessage"), get_focused_pane());
  
  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("multimessage"), get_focused_pane());

  // Now, focus the folder tree and make sure focus updates properly.
  mc.e("folderTree").focus();
  
  switch_tab(tab);
  assert_equals(mc.e("messagepane"), get_focused_pane());

  switch_tab();
  assert_equals(mc.e("folderTree"), get_focused_pane());

  close_tab(tab);
}

function test_after_delete() {
  be_in_folder(folder);
  make_display_threaded();
  collapse_all_threads();

  // Select a message, then delete it to move to the thread
  select_click_row(0);
  mc.window.SetFocusMessagePane();
  press_delete();

  assert_equals(mc.e("multimessage"), get_focused_pane());

  // Delete the thread (without warning) to move to a message
  Services.prefs.setBoolPref("mail.warn_on_collapsed_thread_operation", false);
  press_delete();

  assert_equals(mc.e("messagepane"), get_focused_pane());
}