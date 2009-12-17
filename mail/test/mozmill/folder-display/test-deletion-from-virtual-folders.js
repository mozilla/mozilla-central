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

/*
 * Test that deleting messages works from a virtual folder.
 */

var MODULE_NAME = 'test-deletion-from-virtual-folders';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var baseFolder, folder, lastMessageFolder;

var tabFolder, tabMessage, tabMessageBackground, curMessage, nextMessage;

var setNormal;

/**
 * The message window controller.
 */
var msgc;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  baseFolder = create_folder("DeletionFromVirtualFoldersA");
  // For setTagged, we want exactly as many messages as we plan to delete, so
  // that we can test that the message window and tabs close when they run out
  // of things to display.
  let [, setTagged] = make_new_sets_in_folder(baseFolder, [{count: 4},
                                                           {count: 4}]);
  setTagged.addTag("$label1"); // Important, by default
  // We depend on the count for this, too
  [setNormal] = make_new_sets_in_folder(inboxFolder, [{count: 4}]);

  // Add the view picker to the toolbar
  let toolbar = mc.e("mail-bar3");
  toolbar.insertItem("mailviews-container", null);
  mc.assertNode(mc.eid("mailviews-container"));
}

/// Check whether this message is displayed in the folder tab
var VERIFY_FOLDER_TAB = 0x1;
/// Check whether this message is displayed in the foreground message tab
var VERIFY_MESSAGE_TAB = 0x2;
/// Check whether this message is displayed in the background message tab
var VERIFY_BACKGROUND_MESSAGE_TAB = 0x4;
/// Check whether this message is displayed in the message window
var VERIFY_MESSAGE_WINDOW = 0x8;
var VERIFY_ALL = 0xF;

/**
 * Verify that the message is displayed in the given tabs. The index is
 * optional.
 */
function _verify_message_is_displayed_in(aFlags, aMessage, aIndex) {
  if (aFlags & VERIFY_FOLDER_TAB) {
    switch_tab(tabFolder);
    assert_selected_and_displayed(aMessage);
    if (aIndex !== undefined)
      assert_selected_and_displayed(aIndex);
  }
  if (aFlags & VERIFY_MESSAGE_TAB) {
    // Verify the title first
    assert_tab_titled_from(tabMessage, aMessage);
    switch_tab(tabMessage);
    // Verify the title again, just in case
    assert_tab_titled_from(tabMessage, aMessage);
    assert_selected_and_displayed(aMessage);
    if (aIndex !== undefined)
      assert_selected_and_displayed(aIndex);
  }
  if (aFlags & VERIFY_BACKGROUND_MESSAGE_TAB) {
    // Only verify the title
    assert_tab_titled_from(tabMessageBackground, aMessage);
  }
  if (aFlags & VERIFY_MESSAGE_WINDOW) {
    assert_selected_and_displayed(msgc, aMessage);
    if (aIndex !== undefined)
      assert_selected_and_displayed(msgc, aIndex);
  }
}

function test_create_virtual_folders() {
  be_in_folder(baseFolder);

  // Apply the mail view
  mc.window.RefreshAllViewPopups(mc.e("viewPickerPopup"));
  mc.window.ViewChange(":$label1");
  wait_for_all_messages_to_load();

  // - save it
  plan_for_modal_dialog("mailnews:virtualFolderProperties",
                        subtest_save_mail_view);
  // we have to use value here because the option mechanism is not sophisticated
  //  enough.
  mc.window.ViewChange(MailViewConstants.kViewItemVirtual);
  wait_for_modal_dialog("mailnews:virtualFolderProperties");
}

function subtest_save_mail_view(savc) {
  savc.window.onOK();
}

function _open_first_message() {
  // Enter the folder and open a message
  tabFolder = be_in_folder(folder);
  curMessage = select_click_row(0);
  assert_selected_and_displayed(curMessage);

  // Open the tab with the message
  tabMessage = open_selected_message_in_new_tab();
  assert_selected_and_displayed(curMessage);
  assert_tab_titled_from(tabMessage, curMessage);

  switch_tab(tabFolder);

  // Open another tab with the message, this time in the background
  tabMessageBackground = open_selected_message_in_new_tab(true);
  assert_tab_titled_from(tabMessageBackground, curMessage);

  // Open the window with the message
  switch_tab(tabFolder);
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
}


function test_open_first_message_in_virtual_folder() {
  folder = baseFolder.findSubFolder(baseFolder.prettyName + "-Important");
  if (!folder)
    throw new Error("DeletionFromVirtualFoldersA-Important was not created!");

  _open_first_message();
}

/**
 * Perform a deletion from the folder tab, verify the others update correctly
 * (advancing to the next message).
 */
function test_delete_from_virtual_folder_in_folder_tab() {
  // XXX We need to do this to get the test working on trunk. If we don't have
  // this, the deletes never happen, probably because we don't receive the delete
  // keypress event.
  focus_thread_tree();

  // - plan to end up on the guy who is currently at index 1
  curMessage = mc.dbView.getMsgHdrAt(1);
  // while we're at it, figure out who is at 2 for the next step
  nextMessage = mc.dbView.getMsgHdrAt(2);
  // - delete the message
  press_delete();

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);
}

/**
 * Perform a deletion from the message tab, verify the others update correctly
 *  (advancing to the next message).
 */
function test_delete_from_virtual_folder_in_message_tab() {
  switch_tab(tabMessage);
  // nextMessage is the guy we want to see once the delete completes.
  press_delete();
  curMessage = nextMessage;

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);

  // figure out the next guy...
  nextMessage = mc.dbView.getMsgHdrAt(1);
  if (!nextMessage)
    throw new Error("We ran out of messages early?");
}

/**
 * Perform a deletion from the message window, verify the others update
 *  correctly (advancing to the next message).
 */
function test_delete_from_virtual_folder_in_message_window() {
  // - delete
  press_delete(msgc);
  curMessage = nextMessage;
  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);
}

/**
 * Delete the last message in that folder, which should close all message
 *  displays.
 */
function test_delete_last_message_from_virtual_folder_closes_message_displays() {
  // - since we have both foreground and background message tabs, we don't need
  // to open yet another tab to test

  // - prep for the message window disappearing
  plan_for_window_close(msgc);

  // - let's arbitrarily perform the deletion on this message tab
  switch_tab(tabMessage);
  press_delete();

  // - the message window should have gone away...
  // (this also helps ensure that the 3pane gets enough event loop time to do
  //  all that it needs to accomplish)
  wait_for_window_close(msgc);
  msgc = null;

  // - and we should now be on the folder tab and there should be no other tabs
  if (mc.tabmail.tabInfo.length != 1)
    throw new Error("There should only be one tab left!");
  // the below check is implied by the previous check if things are sane-ish
  if (mc.tabmail.currentTabInfo != tabFolder)
    throw new Error("We should be on the folder tab!");
}

/**
 * Open the first message in the smart inbox.
 */
function test_open_first_message_in_smart_inbox() {
  // Switch to smart folders
  mc.folderTreeView.mode = "smart";
  // Select the smart inbox
  folder = get_smart_folder_named("Inbox");
  be_in_folder(folder);
  assert_messages_in_view(setNormal);
  // Open the first message
  _open_first_message();
}

/**
 * Perform a deletion from the folder tab, verify the others update correctly
 * (advancing to the next message).
 */
function test_delete_from_smart_inbox_in_folder_tab() {
  // XXX We need to do this to get the test working on trunk. If we don't have
  // this, the deletes never happen, probably because we don't receive the delete
  // keypress event.
  focus_thread_tree();

  // - plan to end up on the guy who is currently at index 1
  curMessage = mc.dbView.getMsgHdrAt(1);
  // while we're at it, figure out who is at 2 for the next step
  nextMessage = mc.dbView.getMsgHdrAt(2);
  // - delete the message
  press_delete();

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);
}

/**
 * Perform a deletion from the message tab, verify the others update correctly
 *  (advancing to the next message).
 */
function test_delete_from_smart_inbox_in_message_tab() {
  switch_tab(tabMessage);
  // nextMessage is the guy we want to see once the delete completes.
  press_delete();
  curMessage = nextMessage;

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);

  // figure out the next guy...
  nextMessage = mc.dbView.getMsgHdrAt(1);
  if (!nextMessage)
    throw new Error("We ran out of messages early?");
}

/**
 * Perform a deletion from the message window, verify the others update
 *  correctly (advancing to the next message).
 */
function test_delete_from_smart_inbox_in_message_window() {
  // - delete
  press_delete(msgc);
  curMessage = nextMessage;
  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);
}

/**
 * Delete the last message in that folder, which should close all message
 *  displays.
 */
function test_delete_last_message_from_smart_inbox_closes_message_displays() {
  // - since we have both foreground and background message tabs, we don't need
  // to open yet another tab to test

  // - prep for the message window disappearing
  plan_for_window_close(msgc);

  // - let's arbitrarily perform the deletion on this message tab
  switch_tab(tabMessage);
  press_delete();

  // - the message window should have gone away...
  // (this also helps ensure that the 3pane gets enough event loop time to do
  //  all that it needs to accomplish)
  wait_for_window_close(msgc);
  msgc = null;

  // - and we should now be on the folder tab and there should be no other tabs
  if (mc.tabmail.tabInfo.length != 1)
    throw new Error("There should only be one tab left!");
  // the below check is implied by the previous check if things are sane-ish
  if (mc.tabmail.currentTabInfo != tabFolder)
    throw new Error("We should be on the folder tab!");
}

/**
 * Switch back to the all folders mode for further tests.
 */
function test_switch_back_to_all_folders_mode() {
  mc.folderTreeView.mode = "all";
}
