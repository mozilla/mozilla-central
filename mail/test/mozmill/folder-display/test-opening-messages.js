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
 * Test that we open single and multiple messages from the thread pane
 * according to the mail.openMessageBehavior preference, and that we have the
 * correct message headers displayed in whatever we open.
 *
 * Currently tested:
 * - opening single and multiple messages in tabs
 * - opening a single message in a window. (Multiple messages require a fair
 *   amount of additional work and are hard to test. We're also assuming here
 *   that multiple messages opened in windows are just the same function called
 *   repeatedly.)
 * - reusing an existing window to show another message
 */
var MODULE_NAME = 'test-opening-messages';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

// One folder's enough
var folder = null;

// Number of messages to open for multi-message tests
const NUM_MESSAGES_TO_OPEN = 5;

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("OpeningMessagesA");
  make_new_sets_in_folder(folder, [{count: 10}]);
};

/**
 * Test opening a single message in a new tab.
 */
function test_open_single_message_in_tab() {
  set_open_message_behavior("NEW_TAB");
  let folderTab = mc.tabmail.currentTabInfo;
  let preCount = mc.tabmail.tabContainer.childNodes.length;
  be_in_folder(folder);
  // Select one message
  let msgHdr = select_click_row(1);
  // Open it
  open_selected_message();
  // This is going to trigger a message display in the main 3pane window
  wait_for_message_display_completion(mc);
  // Check that the tab count has increased by 1
  assert_number_of_tabs_open(preCount + 1);
  // Check that the currently displayed tab is a message tab (i.e. our newly
  // opened tab is in the foreground)
  assert_tab_mode_name(null, "message");
  // Check that the message header displayed is the right one
  assert_selected_and_displayed(msgHdr);
  // Clean up, close the tab
  close_tab(mc.tabmail.currentTabInfo);
  switch_tab(folderTab);
  reset_open_message_behavior();
}

/**
 * Test opening multiple messages in new tabs.
 */
function test_open_multiple_messages_in_tabs() {
  set_open_message_behavior("NEW_TAB");
  let folderTab = mc.tabmail.currentTabInfo;
  let preCount = mc.tabmail.tabContainer.childNodes.length;
  be_in_folder(folder);

  // Select a bunch of messages
  select_click_row(1);
  let selectedMessages = select_shift_click_row(NUM_MESSAGES_TO_OPEN);
  // Open them
  open_selected_messages();
  // This is going to trigger a message display in the main 3pane window
  wait_for_message_display_completion(mc);
  // Check that the tab count has increased by the correct number
  assert_number_of_tabs_open(preCount + NUM_MESSAGES_TO_OPEN);
  // Check that the currently displayed tab is a message tab (i.e. one of our
  // newly opened tabs is in the foreground)
  assert_tab_mode_name(null, "message");

  // Now check whether each of the NUM_MESSAGES_TO_OPEN tabs has the correct
  // title
  for (let i = 0; i < NUM_MESSAGES_TO_OPEN; i++)
    assert_tab_titled_from(mc.tabmail.tabInfo[preCount + i],
                           selectedMessages[i]);

  // Check whether each tab has the correct message, then close it to load the
  // previous tab.
  for (let i = 0; i < NUM_MESSAGES_TO_OPEN; i++) {
    assert_selected_and_displayed(selectedMessages.pop());
    close_tab(mc.tabmail.currentTabInfo);
  }
  switch_tab(folderTab);
  reset_open_message_behavior();
}

/**
 * Test opening a message in a new window.
 */
function test_open_message_in_new_window() {
  set_open_message_behavior("NEW_WINDOW");
  be_in_folder(folder);

  // Select a message
  let msgHdr = select_click_row(1);
  
  plan_for_new_window("mail:messageWindow");
  // Open it
  open_selected_message();
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  assert_selected_and_displayed(msgc, msgHdr);
  // Clean up, close the window
  close_message_window(msgc);
  reset_open_message_behavior();
}

/**
 * Test reusing an existing window to open a new message.
 */
function test_open_message_in_existing_window() {
  set_open_message_behavior("EXISTING_WINDOW");
  be_in_folder(folder);

  // Open up a window
  select_click_row(1);
  plan_for_new_window("mail:messageWindow");
  open_selected_message();
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  // Select another message and open it
  let msgHdr = select_click_row(2);
  open_selected_message();
  // We don't need to pass true here, as open_selected_message should have
  // started off the load before returning.
  wait_for_message_display_completion(msgc);

  // Check if our old window displays the message
  assert_selected_and_displayed(msgc, msgHdr);
  // Clean up, close the window
  close_message_window(msgc);
  reset_open_message_behavior();
}
