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
 * Test that deleting a message in a given tab or window properly updates both
 *  that tab/window as well as all other tabs/windows.  We also test that the
 *  message tab title updates appropriately through all of this.
 */
var MODULE_NAME = 'test-deletion-with-multiple-displays';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("DeletionA");
  // we want exactly as many messages as we plan to delete, so that we can test
  //  that the message window and tabs close when they run out of things to
  //  to display.
  make_new_sets_in_folder(folder, [{count: 4}]);
}


var tabFolder, tabMessage, curMessage, nextMessage;

/**
 * The message window controller.  Short names because controllers get used a
 *  lot.
 */
var msgc;

/**
 * Have a message displayed in a folder tab, message tab, and message window.
 *  The idea is that as we delete from the various sources, they should all
 *  advance in lock-step through their messages, simplifying our lives (but
 *  making us explode forevermore the first time any of the tests fail.)
 */
function test_open_message_in_all_three_display_mechanisms() {
  // - Select the message in this tab.
  tabFolder = be_in_folder(folder);
  curMessage = select_click_row(0);
  assert_selected_and_displayed(curMessage);

  // - Open the tab with the message
  tabMessage = open_selected_message_in_new_tab();
  assert_selected_and_displayed(curMessage);
  assert_tab_titled_from(tabMessage, curMessage);

  // - Open the window with the message
  // need to go back to the folder tab.  (well, should.)
  switch_tab(tabFolder);
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
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
  // - make sure the right guy is selected, and that he is at index 0
  assert_selected_and_displayed(curMessage);
  assert_selected_and_displayed(0);

  // - make sure the message tab updated its title even without us switching
  assert_tab_titled_from(tabMessage, curMessage);

  // - switch to the message tab, make sure he is now on the right guy
  switch_tab(tabMessage);
  assert_selected_and_displayed(curMessage);

  // - check the window
  assert_selected_and_displayed(msgc, curMessage);
}

/**
 * Perform a deletion from the message tab, verify the others update correctly
 *  (advancing to the next message).
 */
function test_delete_in_message_tab() {
  // (we're still on the message tab, and nextMessage is the guy we want to see
  //  once the delete completes.)
  press_delete();
  curMessage = nextMessage;
  assert_selected_and_displayed(curMessage);
  assert_tab_titled_from(tabMessage, curMessage);

  // - switch to the folder tab and make sure he is on the right guy and at 0
  switch_tab(tabFolder);
  assert_selected_and_displayed(curMessage);
  assert_selected_and_displayed(0);
  // figure out the next guy...
  nextMessage = mc.dbView.getMsgHdrAt(1);
  if (!nextMessage)
    throw new Error("We ran out of messages early?");

  // - check the message window
  assert_selected_and_displayed(msgc, curMessage);
}

/**
 * Perform a deletion from the message window, verify the others update
 *  correctly (advancing to the next message).
 */
function test_delete_in_message_window() {
  // - delete, verify in the message window
  press_delete(msgc);
  curMessage = nextMessage;
  assert_selected_and_displayed(msgc, curMessage);

  // - verify in the folder tab (we're still on this tab)
  assert_selected_and_displayed(curMessage);
  assert_selected_and_displayed(0);

  // - verify in the message tab
  switch_tab(tabMessage);
  assert_selected_and_displayed(curMessage);
  assert_tab_titled_from(tabMessage, curMessage);
}

/**
 * Delete the last message in that folder, which should close all message
 *  displays.  For comprehensiveness, first open an additional message tab
 *  of the message so that we can test foreground and background closing at the
 *  same time.
 */
function test_delete_last_message_closes_message_displays() {
  // - open the additional message tab
  switch_tab(tabFolder);
  let tabMessage2 = open_selected_message_in_new_tab();

  // - prep for the message window disappearing
  plan_for_window_close(msgc);

  // - let's arbitrarily perform the deletion on this message tab
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
