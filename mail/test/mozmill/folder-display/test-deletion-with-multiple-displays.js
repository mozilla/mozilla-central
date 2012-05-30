/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that deleting a message in a given tab or window properly updates both
 *  that tab/window as well as all other tabs/windows.  We also test that the
 *  message tab title updates appropriately through all of this. We do all of
 *  this both for tabs that have ever been opened in the foreground, and tabs
 *  that haven't (and thus might have fake selections).
 */
var MODULE_NAME = 'test-deletion-with-multiple-displays';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder, lastMessageFolder, oneBeforeFolder, oneAfterFolder,
    multipleDeletionFolder1, multipleDeletionFolder2, multipleDeletionFolder3,
    multipleDeletionFolder4;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("DeletionA");
  lastMessageFolder = create_folder("DeletionB");
  oneBeforeFolder = create_folder("DeletionC");
  oneAfterFolder = create_folder("DeletionD");
  multipleDeletionFolder1 = create_folder("DeletionE");
  multipleDeletionFolder2 = create_folder("DeletionF");
  multipleDeletionFolder3 = create_folder("DeletionG");
  multipleDeletionFolder4 = create_folder("DeletionH");
  // we want exactly as many messages as we plan to delete, so that we can test
  //  that the message window and tabs close when they run out of things to
  //  to display.
  make_new_sets_in_folder(folder, [{count: 4}]);

  // since we don't test window close here, it doesn't really matter how many
  // messages these have
  make_new_sets_in_folder(lastMessageFolder, [{count: 4}]);
  make_new_sets_in_folder(oneBeforeFolder, [{count: 10}]);
  make_new_sets_in_folder(oneAfterFolder, [{count: 10}]);
  make_new_sets_in_folder(multipleDeletionFolder1, [{count: 30}]);

  // We're depending on selecting the last message here, so these do matter
  make_new_sets_in_folder(multipleDeletionFolder2, [{count: 10}]);
  make_new_sets_in_folder(multipleDeletionFolder3, [{count: 10}]);
  make_new_sets_in_folder(multipleDeletionFolder4, [{count: 10}]);
}


var tabFolder, tabMessage, tabMessageBackground, curMessage, nextMessage;

/**
 * The message window controller.  Short names because controllers get used a
 *  lot.
 */
var msgc;

/**
 * Open up the message at aIndex in all our display mechanisms, and check to see
 * if the displays are all correct. This also sets up all our globals.
 */
function _open_message_in_all_four_display_mechanisms_helper(aFolder, aIndex) {
  // - Select the message in this tab.
  tabFolder = be_in_folder(aFolder);
  curMessage = select_click_row(aIndex);
  assert_selected_and_displayed(curMessage);

  // - Open the tab with the message
  tabMessage = open_selected_message_in_new_tab();
  assert_selected_and_displayed(curMessage);
  assert_tab_titled_from(tabMessage, curMessage);

  // go back to the folder tab
  switch_tab(tabFolder);

  // - Open another tab with the message, this time in the background
  tabMessageBackground = open_selected_message_in_new_tab(true);
  assert_tab_titled_from(tabMessageBackground, curMessage);

  // - Open the window with the message
  // need to go back to the folder tab.  (well, should.)
  switch_tab(tabFolder);
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
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

/**
 * Have a message displayed in a folder tab, message tab (foreground and
 * background), and message window. The idea is that as we delete from the
 * various sources, they should all advance in lock-step through their messages,
 * simplifying our lives (but making us explode forevermore the first time any
 * of the tests fail.)
 */
function test_open_first_message_in_all_four_display_mechanisms() {
  _open_message_in_all_four_display_mechanisms_helper(folder, 0);
}

/**
 * Perform a deletion from the folder tab, verify the others update correctly
 *  (advancing to the next message).
 */
function test_delete_in_folder_tab() {
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
function test_delete_in_message_tab() {
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
function test_delete_in_message_window() {
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
function test_delete_last_message_closes_message_displays() {
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

/*
 * Now we retest everything, but while deleting the last message in our
 * selection. We need to make sure we select the previously next-to-last message
 * in that case.
 */

/**
 * Have the last message displayed in a folder tab, message tab (foreground and
 * background), and message window. The idea is that as we delete from the
 * various sources, they should all advance in lock-step through their messages,
 * simplifying our lives (but making us explode forevermore the first time any
 * of the tests fail.)
 */
function test_open_last_message_in_all_four_display_mechanisms() {
  // since we have four messages, index 3 is the last message.
  _open_message_in_all_four_display_mechanisms_helper(lastMessageFolder, 3);
}

/**
 * Perform a deletion from the folder tab, verify the others update correctly
 * (advancing to the next message).
 */
function test_delete_last_message_in_folder_tab() {
  // - plan to end up on the guy who is currently at index 2
  curMessage = mc.dbView.getMsgHdrAt(2);
  // while we're at it, figure out who is at 1 for the next step
  nextMessage = mc.dbView.getMsgHdrAt(1);
  // - delete the message
  press_delete();

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 2);
}

/**
 * Perform a deletion from the message tab, verify the others update correctly
 * (advancing to the next message).
 */
function test_delete_last_message_in_message_tab() {
  // (we're still on the message tab, and nextMessage is the guy we want to see
  //  once the delete completes.)
  press_delete();
  curMessage = nextMessage;

  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 1);
  // figure out the next guy...

  nextMessage = mc.dbView.getMsgHdrAt(0);
  if (!nextMessage)
    throw new Error("We ran out of messages early?");
}

/**
 * Perform a deletion from the message window, verify the others update
 * correctly (advancing to the next message).
 */
function test_delete_last_message_in_message_window() {
  // Vary this up. Switch to the folder tab instead of staying on the message
  // tab
  switch_tab(tabFolder);
  // - delete
  press_delete(msgc);
  curMessage = nextMessage;
  // - verify all displays
  _verify_message_is_displayed_in(VERIFY_ALL, curMessage, 0);

  // - clean up, close the message window and displays
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/*
 * Our next job is to open up a message, then delete the message one before it
 * in another view. The other selections shouldn't be affected.
 */

/**
 * Test "one before" deletion in the folder tab.
 */
function test_delete_one_before_message_in_folder_tab() {
  // Open up message 4 in message tabs and a window (we'll delete message 3).
  _open_message_in_all_four_display_mechanisms_helper(oneBeforeFolder, 4);

  let expectedMessage = mc.dbView.getMsgHdrAt(4);
  select_click_row(3);
  press_delete();

  // The message tab, background message tab and window shouldn't have changed
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test "one before" deletion in the message tab.
 */
function test_delete_one_before_message_in_message_tab() {
  // Open up 3 in a message tab, then select and open up 4 in a background tab
  // and window.
  select_click_row(3);
  tabMessage = open_selected_message_in_new_tab(true);
  let expectedMessage = select_click_row(4);
  tabMessageBackground = open_selected_message_in_new_tab(true);
  msgc = open_selected_message_in_new_window(true);

  // Switch to the message tab, and delete.
  switch_tab(tabMessage);
  press_delete();

  // The folder tab, background message tab and window shouldn't have changed
  _verify_message_is_displayed_in(VERIFY_FOLDER_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test "one before" deletion in the message window.
 */
function test_delete_one_before_message_in_message_window() {
  // Open up 3 in a message window, then select and open up 4 in a background
  // and a foreground tab.
  select_click_row(3);
  msgc = open_selected_message_in_new_window();
  let expectedMessage = select_click_row(4);
  tabMessage = open_selected_message_in_new_tab();
  switch_tab(tabFolder);
  tabMessageBackground = open_selected_message_in_new_tab(true);

  // Press delete in the message window.
  press_delete(msgc);

  // The folder tab, message tab and background message tab shouldn't have
  // changed
  _verify_message_is_displayed_in(VERIFY_FOLDER_TAB |
                                  VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB,
                                  expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/*
 * Now do all of that again, but this time delete the message _after_ the open one.
 */

/**
 * Test "one after" deletion in the folder tab.
 */
function test_delete_one_after_message_in_folder_tab() {
  // Open up message 4 in message tabs and a window (we'll delete message 5).
  _open_message_in_all_four_display_mechanisms_helper(oneAfterFolder, 4);

  let expectedMessage = mc.dbView.getMsgHdrAt(4);
  select_click_row(5);
  press_delete();

  // The message tab, background message tab and window shouldn't have changed
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test "one after" deletion in the message tab.
 */
function test_delete_one_after_message_in_message_tab() {
  // Open up 5 in a message tab, then select and open up 4 in a background tab
  // and window.
  select_click_row(5);
  tabMessage = open_selected_message_in_new_tab(true);
  let expectedMessage = select_click_row(4);
  tabMessageBackground = open_selected_message_in_new_tab(true);
  msgc = open_selected_message_in_new_window(true);

  // Switch to the message tab, and delete.
  switch_tab(tabMessage);
  press_delete();

  // The folder tab, background message tab and window shouldn't have changed
  _verify_message_is_displayed_in(VERIFY_FOLDER_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test "one after" deletion in the message window.
 */
function test_delete_one_after_message_in_message_window() {
  // Open up 5 in a message window, then select and open up 4 in a background
  // and a foreground tab.
  select_click_row(5);
  msgc = open_selected_message_in_new_window();
  let expectedMessage = select_click_row(4);
  tabMessage = open_selected_message_in_new_tab();
  switch_tab(tabFolder);
  tabMessageBackground = open_selected_message_in_new_tab(true);

  // Press delete in the message window.
  press_delete(msgc);

  // The folder tab, message tab and background message tab shouldn't have
  // changed
  _verify_message_is_displayed_in(VERIFY_FOLDER_TAB |
                                  VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB,
                                  expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/*
 * Delete multiple messages in a folder tab. Make sure message displays at the
 * beginning, middle and end of a selection work out.
 */

/**
 * Test deleting multiple messages in a folder tab, with message displays open
 * to the beginning of a selection.
 */
function test_delete_multiple_messages_with_first_selected_message_open() {
  // Open up 2 in a message tab, background tab, and message window.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder1,
                                                      2);

  // We'll select 2-5, 8, 9 and 10. We expect 6 to be the next displayed
  // message.
  select_click_row(2);
  select_shift_click_row(5);
  select_control_click_row(8);
  select_control_click_row(9);
  select_control_click_row(10);
  let expectedMessage = mc.dbView.getMsgHdrAt(6);

  // Delete the selected messages
  press_delete();

  // All the displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_ALL, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test deleting multiple messages in a folder tab, with message displays open
 * to somewhere in the middle of a selection.
 */
function test_delete_multiple_messages_with_nth_selected_message_open() {
  // Open up 9 in a message tab, background tab, and message window.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder1,
                                                      9);

  // We'll select 2-5, 8, 9 and 10. We expect 11 to be the next displayed
  // message.
  select_click_row(2);
  select_shift_click_row(5);
  select_control_click_row(8);
  select_control_click_row(9);
  select_control_click_row(10);
  let expectedMessage = mc.dbView.getMsgHdrAt(11);

  // Delete the selected messages
  press_delete();

  // The folder tab should now be showing message 2
  assert_selected_and_displayed(2);

  // The other displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test deleting multiple messages in a folder tab, with message displays open
 * to the end of a selection.
 */
function test_delete_multiple_messages_with_last_selected_message_open() {
  // Open up 10 in a message tab, background tab, and message window.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder1,
                                                      9);

  // We'll select 2-5, 8, 9 and 10. We expect 11 to be the next displayed
  // message.
  select_click_row(2);
  select_shift_click_row(5);
  select_control_click_row(8);
  select_control_click_row(9);
  select_control_click_row(10);
  let expectedMessage = mc.dbView.getMsgHdrAt(11);

  // Delete the selected messages
  press_delete();

  // The folder tab should now be showing message 2
  assert_selected_and_displayed(2);

  // The other displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);
  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test deleting multiple messages in a folder tab (including the last one!),
 * with message displays open to the beginning of a selection.
 */
function test_delete_multiple_messages_including_the_last_one_with_first_open() {
  // 10 messages in this folder. Open up message 1 everywhere.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder2,
                                                      1);

  // We'll select 1-4, 7, 8 and 9. We expect 5 to be the next displayed message.
  select_click_row(1);
  select_shift_click_row(4);
  select_control_click_row(7);
  select_control_click_row(8);
  select_control_click_row(9);
  let expectedMessage = mc.dbView.getMsgHdrAt(5);

  // Delete the selected messages
  press_delete();

  // All the displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_ALL, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test deleting multiple messages in a folder tab (including the last one!),
 * with message displays open to the middle of a selection.
 */
function test_delete_multiple_messages_including_the_last_one_with_nth_open() {
  // 10 messages in this folder. Open up message 7 everywhere.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder3,
                                                      7);

  // We'll select 1-4, 7, 8 and 9. We expect 6 to be the next displayed message.
  select_click_row(1);
  select_shift_click_row(4);
  select_control_click_row(7);
  select_control_click_row(8);
  select_control_click_row(9);
  let expectedMessage = mc.dbView.getMsgHdrAt(6);

  // Delete the selected messages
  press_delete();

  // The folder tab should now be showing message 1
  assert_selected_and_displayed(1);

  // The other displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}

/**
 * Test deleting multiple messages in a folder tab (including the last one!),
 * with message displays open to the end of a selection.
 */
function test_delete_multiple_messages_including_the_last_one_with_last_open() {
  // 10 messages in this folder. Open up message 9 everywhere.
  _open_message_in_all_four_display_mechanisms_helper(multipleDeletionFolder4,
                                                      9);

  // We'll select 1-4, 7, 8 and 9. We expect 6 to be the next displayed message.
  select_click_row(1);
  select_shift_click_row(4);
  select_control_click_row(7);
  select_control_click_row(8);
  select_control_click_row(9);
  let expectedMessage = mc.dbView.getMsgHdrAt(6);

  // Delete the selected messages
  press_delete();

  // The folder tab should now be showing message 1
  assert_selected_and_displayed(1);

  // The other displays should now be showing the expectedMessage
  _verify_message_is_displayed_in(VERIFY_MESSAGE_TAB |
                                  VERIFY_BACKGROUND_MESSAGE_TAB |
                                  VERIFY_MESSAGE_WINDOW, expectedMessage);

  // Clean up, close everything
  close_message_window(msgc);
  close_tab(tabMessage);
  close_tab(tabMessageBackground);
  switch_tab(tabFolder);
}
