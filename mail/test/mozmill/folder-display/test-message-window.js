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
 *   David Bienvenu <bienvenu@nventure.com>
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
 * Test that we can open and close a standalone message display window from the
 *  folder pane.
 */
var MODULE_NAME = 'test-message-window';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("MessageWindowA");
  // create three messages in the folder to display
  let msg1 = create_thread(1);
  let msg2 = create_thread(1);
  let thread1 = create_thread(2);
  let thread2 = create_thread(2);
  add_sets_to_folders([folder], [msg1, msg2, thread1, thread2]);
  folder.msgDatabase.dBFolderInfo.viewFlags = Ci.nsMsgViewFlagsType.kThreadedDisplay;
}

/** The message window controller. */
var msgc;

function test_open_message_window() {
  be_in_folder(folder);

  // select the first message
  let curMessage = select_click_row(0);

  // display it
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
}

/**
 * Use the "f" keyboard accelerator to navigate to the next message,
 * and verify that it is indeed loaded.
 */
function test_navigate_to_next_message() {
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
  if (folder.getTotalMessages(false) != 4)
    throw new Error("should have only deleted one message");

}
/**
 * Close the window by hitting escape.
 */
function test_close_message_window() {
  plan_for_window_close(msgc);
  msgc.keypress(null, "VK_ESCAPE", {});
  wait_for_window_close(msgc);
}
