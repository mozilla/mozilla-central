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
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
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
 * Test that the close message window on delete option works.
 */

var MODULE_NAME = 'test-close-window-on-delete';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("CloseWindowOnDeleteA");

  make_new_sets_in_folder(folder, [{count: 10}]);
}

/**
 * Delete a message and check that the message window is closed
 * where appropriate.
 */
function test_close_message_window_on_delete_from_message_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  msgc = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  msgc.window.focus();
  plan_for_window_close(msgc);
  press_delete(msgc);
  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);

  if (msgc2.window.closed)
    throw new Error("should only have closed the active window");

  close_window(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows are open to the message, and the
 * message is deleted from one of them.
 */
function test_close_multiple_message_windows_on_delete_from_message_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  msgc = open_selected_message_in_new_window();
  msgcA = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  msgc.window.focus();
  plan_for_window_close(msgc);
  plan_for_window_close(msgcA);
  press_delete(msgc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);
  wait_for_window_close(msgcA);

  if (msgc2.window.closed)
    throw new Error("should only have closed the active window");

  close_window(msgc2);

  reset_close_message_on_delete();
}

/**
 * Delete a message when multiple windows are open to the message, and the
 * message is deleted from the 3-pane window.
 */
function test_close_multiple_message_windows_on_delete_from_3pane_window() {
  set_close_message_on_delete(true);
  be_in_folder(folder);

  // select the first message
  let firstMessage = select_click_row(0);
  // display it
  msgc = open_selected_message_in_new_window();
  msgcA = open_selected_message_in_new_window();

  let secondMessage = select_click_row(1);
  let msgc2 = open_selected_message_in_new_window();

  let preCount = folder.getTotalMessages(false);
  mc.window.focus();
  plan_for_window_close(msgc);
  plan_for_window_close(msgcA);
  select_click_row(0);
  press_delete(mc);

  if (folder.getTotalMessages(false) != preCount - 1)
    throw new Error("didn't delete a message before closing window");
  wait_for_window_close(msgc);
  wait_for_window_close(msgcA);

  if (msgc2.window.closed)
    throw new Error("should only have closed the active window");

  close_window(msgc2);

  reset_close_message_on_delete();
}
