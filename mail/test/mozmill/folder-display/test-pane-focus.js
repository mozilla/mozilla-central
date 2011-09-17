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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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
 * Test that cycling through the focus of the 3pane's panes works correctly.
 */
var MODULE_NAME = "test-pane-focus";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

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
 * pane, message pane (single- or multi-message), or account central pane.
 *
 * @return the focused pane
 */
function get_focused_pane() {
  let panes = [mc.e(id) for each (id in [
    "threadTree", "folderTree", "messagepane", "multimessage",
    "accountCentralPane"
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
function check_folder_pane_cycling(multimessage) {
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

function test_account_central() {
  be_in_folder(folder.rootFolder);

  let folderPane = mc.e("folderTree");
  let accountCentralPane = mc.e("accountCentralPane");

  folderPane.focus();

  mc.keypress(null, "VK_F6", {});
  assert_equals(accountCentralPane, get_focused_pane());
  mc.keypress(null, "VK_F6", {});
  assert_equals(folderPane, get_focused_pane());

  mc.keypress(null, "VK_F6", {shiftKey: true});
  assert_equals(accountCentralPane, get_focused_pane());
  mc.keypress(null, "VK_F6", {shiftKey: true});
  assert_equals(folderPane, get_focused_pane());
}

function test_account_central_focus_tweaks() {
  be_in_folder(folder.rootFolder);

  let folderPane = mc.e("folderTree");
  let accountCentralPane = mc.e("accountCentralPane");

  folderPane.focus();

  // Ensure we focus the first clickable item in the account central pane.
  mc.keypress(null, "VK_F6", {});
  assert_equals(accountCentralPane.contentDocument.activeElement.value,
                "View settings for this account");

  // Ensure that focusing elsewhere in the 3pane and then returning to account
  // central maintains the previous focus.
  mc.keypress(null, "VK_TAB", {});
  let focusedElement = accountCentralPane.contentDocument.activeElement;
  assert_equals(focusedElement.value, "Create a new account");

  mc.keypress(null, "VK_F6", {shiftKey: true});
  mc.keypress(null, "VK_F6", {});
  assert_equals(accountCentralPane.contentDocument.activeElement,
                focusedElement);

  // Ensure that opening a dialog from account central and closing it maintains
  // focus.
  plan_for_modal_dialog("mail:autoconfig", function(acc) {
    close_window(acc);
  });
  mc.click(new elib.Elem(focusedElement));
  let acc = wait_for_modal_dialog("mail:autoconfig");

  assert_equals(accountCentralPane.contentDocument.activeElement,
                focusedElement);
}

function test_no_messages_selected() {
  be_in_folder(folder);

  // Select nothing
  select_none();
  check_folder_pane_cycling(false);
}

function test_one_message_selected() {
  be_in_folder(folder);

  // Select a message
  select_click_row(0);
  check_folder_pane_cycling(false);
}

function test_n_messages_selected() {
  be_in_folder(folder);

  // Select a thread
  select_click_row(1);
  check_folder_pane_cycling(true);
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