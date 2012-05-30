/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that we can open and close a standalone message display window from the
 *  folder pane.
 */
var MODULE_NAME = 'test-message-window';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderA, folderB;
var curMessage;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folderA = create_folder("MessageWindowA");
  folderB = create_folder("MessageWindowB");
  // create three messages in the folder to display
  let msg1 = create_thread(1);
  let msg2 = create_thread(1);
  let thread1 = create_thread(2);
  let thread2 = create_thread(2);
  add_sets_to_folders([folderA], [msg1, msg2, thread1, thread2]);
  // add two more messages in another folder
  let msg3 = create_thread(1);
  let msg4 = create_thread(1);
  add_sets_to_folders([folderB], [msg3, msg4]);
  folderA.msgDatabase.dBFolderInfo.viewFlags = Ci.nsMsgViewFlagsType.kThreadedDisplay;
}

/** The message window controller. */
var msgc;

function test_open_message_window() {
  be_in_folder(folderA);

  // select the first message
  curMessage = select_click_row(0);

  // display it
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
}

/**
 * Use the "m" keyboard accelerator to mark a message as read or unread.
 */
function test_toggle_read() {
  curMessage.markRead(false);
  msgc.keypress(null, "m", {});
  assert_true(curMessage.isRead, "Message should have been marked read!");

  msgc.keypress(null, "m", {});
  assert_true(!curMessage.isRead, "Message should have been marked unread!");
}

/**
 * Use the "f" keyboard accelerator to navigate to the next message,
 * and verify that it is indeed loaded.
 */
function test_navigate_to_next_message() {
  plan_for_message_display(msgc);
  msgc.keypress(null, "f", {});
  wait_for_message_display_completion(msgc, true);
  assert_selected_and_displayed(msgc, 1);
}

/**
 * Delete a single message and verify the next message is loaded. This sets
 * us up for the next test, which is delete on a collapsed thread after
 * the previous message was deleted.
 */
function test_delete_single_message() {
  plan_for_message_display(msgc);
  press_delete(msgc);
  wait_for_message_display_completion(msgc, true);
  assert_selected_and_displayed(msgc, 1);
}

/**
 * Delete the current message, and verify that it only deletes
 * a single message, not the messages in the collapsed thread
 */
function test_del_collapsed_thread() {
  press_delete(msgc);
  if (folderA.getTotalMessages(false) != 4)
    throw new Error("should have only deleted one message");

}

function subtest_say_yes(cwc) {
  cwc.window.document.documentElement.getButton('accept').doCommand();
}

/**
 * Hit n enough times to mark all messages in folder A read, and then accept the
 * modal dialog saying that we should move to the next folder. Then, assert that
 * the message displayed in the standalone message window is folder B's first
 * message (since all messages in folder B were unread).
 */
function test_next_unread() {
  for (let i = 0; i < 3; ++i) {
    plan_for_message_display(msgc);
    msgc.keypress(null, "n", {});
    wait_for_message_display_completion(msgc, true);
  }

  plan_for_modal_dialog("commonDialog", subtest_say_yes);
  msgc.keypress(null, "n", {});
  plan_for_message_display(msgc);
  wait_for_modal_dialog("commonDialog");
  wait_for_message_display_completion(msgc, true);

  // move to folder B
  be_in_folder(folderB);

  // select the first message, and make sure it's not read
  let msg = select_click_row(0);

  // make sure we've been displaying the right message
  assert_selected_and_displayed(msgc, msg);
}

/**
 * Close the window by hitting escape.
 */
function test_close_message_window() {
  plan_for_window_close(msgc);
  msgc.keypress(null, "VK_ESCAPE", {});
  wait_for_window_close(msgc);
}
