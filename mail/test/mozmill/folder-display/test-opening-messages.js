/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  // Check that the message pane is focused
  assert_message_pane_focused();
  // Check that the message pane in a newly opened tab has full height.
  check_message_pane_in_tab_full_height();
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

  // Check whether each tab has the correct message and whether the message pane
  // is focused in each case, then close it to load the previous tab.
  for (let i = 0; i < NUM_MESSAGES_TO_OPEN; i++) {
    assert_selected_and_displayed(selectedMessages.pop());
    assert_message_pane_focused();
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

  // Check that the message pane in a newly opened window has full height.
  check_message_pane_in_window_full_height(msgc);

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
  plan_for_message_display(msgc);
  open_selected_message();
  wait_for_message_display_completion(msgc, true);

  // Check if our old window displays the message
  assert_selected_and_displayed(msgc, msgHdr);
  // Clean up, close the window
  close_message_window(msgc);
  reset_open_message_behavior();
}

/**
 * Check if the message pane in a new tab has the full height, so no
 * empty box is visible below it.
 */

function check_message_pane_in_tab_full_height() {
  let messagesBoxHeight = mc.e("messagesBox").boxObject.height;
  let displayDeckHeight = mc.e("displayDeck").boxObject.height;
  let messagePaneBoxWrapperHeight = mc.e("messagepaneboxwrapper").boxObject.height;
  let notificationBoxHeight = mc.e("msg-footer-notification-box").boxObject.height;

  assert_equals(messagesBoxHeight, displayDeckHeight + messagePaneBoxWrapperHeight + notificationBoxHeight,
      "messanges box height (" + messagesBoxHeight +
      ") not equal to the sum of displayDeck height (" + displayDeckHeight +
      ") and message pane box wrapper height (" + messagePaneBoxWrapperHeight +
      ") and message notification box height (" + notificationBoxHeight +
      ")");
}

/**
 * Check if the message pane in a new window has the full height, so no
 * empty box is visible below it.
 */

function check_message_pane_in_window_full_height(aWC) {
  let messengerWindowHeight = aWC.e("messengerWindow").boxObject.height;
  let messengerChildren = aWC.e("messengerWindow").children;
  let childrenHeightsSum = 0;
  let childrenHeightsStr = "";
  for (var i=0; i < messengerChildren.length; i++) {
    childrenHeightsSum += messengerChildren[i].boxObject.height;
    childrenHeightsStr += '"' + messengerChildren[i].id + '": ' +
                          messengerChildren[i].boxObject.height + ', ';
  }

  assert_equals(messengerWindowHeight, childrenHeightsSum,
    "messenger window height not equal to the sum of children heights: " +
    childrenHeightsStr);
}
