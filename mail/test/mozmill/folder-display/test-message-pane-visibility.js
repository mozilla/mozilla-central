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
 * Test that the message pane collapses properly, stays collapsed amongst tab
 *  changes, and that persistence works (to a first approximation).
 */

var MODULE_NAME = 'test-message-pane-visibility';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("MessagePaneVisibility");
  make_new_sets_in_folder(folder, [{count: 3}]);
}

/**
 * When displaying a folder, assert that the message pane is visible and all the
 *  menus, splitters, etc. are set up right.
 */
function assert_message_pane_visible(aThreadPaneIllegal) {
  if (!mc.messageDisplay.visible)
    throw new Error("The message display does not think it is visible, but " +
                    "it should!");

  // - message pane should be visible
  if (mc.e("messagepanebox").getAttribute("collapsed"))
    throw new Error("messagepanebox should not be collapsed!");

  // if the thread pane is illegal, then the splitter should not be visible
  if (aThreadPaneIllegal) {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") != "true")
      throw new Error("threadpane-splitter should be collapsed because the " +
                      "thread pane is illegal");
  }
  else {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") == "true")
      throw new Error("threadpane-splitter should not be collapsed");
  }

  // - the menu item should be checked
  // force the view menu to update.
  mc.window.view_init();
  let paneMenuItem = mc.e("menu_showMessage");
  if (paneMenuItem.getAttribute("checked") != "true")
    throw new Error("The Message Pane menu item should be checked.");
}

/**
 * When displaying a folder, assert that the message pane is hidden and all the
 *  menus, splitters, etc. are set up right.
 *
 * @param aMessagePaneIllegal Is the pane illegal to display at this time?  This
 *     impacts whether the splitter should be visible, menu items should be
 *     visible, etc.
 */
function assert_message_pane_hidden(aMessagePaneIllegal) {
  // check messageDisplay.visible if we are not showing account central
  if (!mc.folderDisplay.isAccountCentralDisplayed && mc.messageDisplay.visible)
    throw new Error("The message display thinks it is visible, but it should " +
                    "not!");

  if (mc.e("messagepanebox").getAttribute("collapsed") != "true")
    throw new Error("messagepanebox should be collapsed!");

  // force the view menu to update.
  mc.window.view_init();
  let paneMenuItem = mc.e("menu_showMessage");
  if (aMessagePaneIllegal) {
    if (mc.e("threadpane-splitter").getAttribute("collapsed") != "true")
      throw new Error("threadpane-splitter should be collapsed because the " +
                      "message pane is illegal.");
    if (paneMenuItem.getAttribute("disabled") != "true")
      throw new Error("The Message Pane menu item should be disabled.");
  }
  else {
    if (mc.e("threadpane-splitter").getAttribute("collapsed"))
      throw new Error("threadpane-splitter should not be collapsed; the " +
                      "message pane is legal.");
    if (paneMenuItem.getAttribute("checked") == "true")
      throw new Error("The Message Pane menu item should not be checked.");
  }
}

function toggle_message_pane() {
  mc.keypress(null, "VK_F8", {});
  wait_for_message_display_completion();
}

/**
 * By default, the message pane should be visible.  Make sure that this state of
 *  affairs is correct in terms of menu options, splitters, etc.
 */
function test_message_pane_visible_state_is_right() {
  be_in_folder(folder);
  assert_message_pane_visible();
}

/**
 * Make sure the account central page does not have the mesage pane splitter
 *  visible.  This should go elsewhere once we have more tests involving
 *  account central.  (Layout tests?)
 */
function test_account_central_has_no_splitter() {
  be_in_folder(folder.rootFolder);
  assert_message_pane_hidden(true);
  be_in_folder(folder);
}

/**
 * Toggle the message off.
 */
function test_toggle_message_pane_off() {
  toggle_message_pane();
  assert_message_pane_hidden();
}

/**
 * Toggle the message pane on.
 */
function test_toggle_message_pane_on() {
  toggle_message_pane();
  assert_message_pane_visible();
}

/**
 * Make sure that the message tab isn't broken by being invoked from a folder tab
 *  with a collapsed message pane.
 */
function test_collapsed_message_pane_does_not_break_message_tab() {

  be_in_folder(folder);

  // - toggle message pane off
  toggle_message_pane();
  assert_message_pane_hidden();

  // - open message tab, make sure the message pane is visible
  select_click_row(0);
  let tabMessage = open_selected_message_in_new_tab();
  assert_message_pane_visible(true);

  // - close the tab, sanity check the transition was okay
  close_tab(tabMessage);
  assert_message_pane_hidden();

  // - restore the state...
  toggle_message_pane();
}

/**
 * Make sure that switching to message tabs or folder pane tabs with a different
 *  message pane state does not break.  This test should cover all transition
 *  states.
 */
function test_message_pane_is_sticky() {
  let tabFolderA = be_in_folder(folder);
  assert_message_pane_visible();

  // [folder+ => (new) message]
  select_click_row(0);
  let tabMessage = open_selected_message_in_new_tab();
  assert_message_pane_visible(true);

  // [message => folder+]
  switch_tab(tabFolderA);
  assert_message_pane_visible();

  // [folder+ => (new) folder+]
  let tabFolderB = open_folder_in_new_tab(folder);
  assert_message_pane_visible();

  // [folder pane toggle + => -]
  toggle_message_pane();
  assert_message_pane_hidden();

  // [folder- => folder+]
  switch_tab(tabFolderA);
  assert_message_pane_visible();

  // (redundant) [ folder pane toggle + => -]
  toggle_message_pane();
  assert_message_pane_hidden();

  // [folder- => message]
  switch_tab(tabMessage);
  assert_message_pane_visible(true);

  // [message => folder-]
  close_tab(tabMessage);
  assert_message_pane_hidden();

  // [folder- => (new) folder-]
  // (we are testing inheritance here)
  let tabFolderC = open_folder_in_new_tab(folder);
  assert_message_pane_hidden();

  // [folder- => folder-]
  close_tab(tabFolderC);
  // the tab we are on now doesn't matter, so we don't care
  assert_message_pane_hidden();
  switch_tab(tabFolderB);

  // [ folder pane toggle - => + ]
  toggle_message_pane();
  assert_message_pane_visible();

  // [folder+ => folder-]
  close_tab(tabFolderB);
  assert_message_pane_hidden();

  // (redundant) [ folder pane toggle - => + ]
  toggle_message_pane();
  assert_message_pane_visible();
}

/**
 * Test that if we serialize and restore the tabs that the message pane is in
 *  the expected collapsed/non-collapsed state.  Because of the special "first
 *  tab" situation, we need to do this twice to test each case for the first
 *  tab.  For additional thoroughness we also flip the state we have the other
 *  tabs be in.
 */
function test_message_pane_persistence_generally_works() {
  be_in_folder(folder);

  // helper to open tabs with the message pane in the desired states (1 for
  //  visible, 0 for hidden)
  function openTabs(aConfig) {
    let curState;
    for (let [iTab, messagePaneVisible] in Iterator(aConfig)) {
      if (iTab == 0) {
        curState = messagePaneVisible;
      }
      else {
        open_folder_in_new_tab(folder);
        if (curState != messagePaneVisible) {
          toggle_message_pane();
          curState = messagePaneVisible;
        }
      }
    }
  }

  // close everything but the first tab.
  function closeTabs() {
    while (mc.tabmail.tabInfo.length > 1)
      mc.tabmail.closeTab(1);
  }

  function verifyTabs(aConfig) {
    for (let [iTab, messagePaneVisible] in Iterator(aConfig)) {
      switch_tab(iTab);
      dump(" checking tab: " + iTab + "\n");
      if (messagePaneVisible)
        assert_message_pane_visible();
      else
        assert_message_pane_hidden();
    }
  }

  let configs = [
    // 1st time: [+ - - + +]
    [1, 0, 0, 1, 1],
    // 2nd time: [- + + - -]
    [0, 1, 1, 0, 0]
  ];
  for each (let [, config] in Iterator(configs)) {
    openTabs(config);
    verifyTabs(config); // make sure openTabs did its job right
    let state = mc.tabmail.persistTabs();
    closeTabs();
    // toggle the state for the current tab so we can be sure that it knows how
    //  to change things.
    toggle_message_pane();
    mc.tabmail.restoreTabs(state);
    verifyTabs(config);
    closeTabs();

    // toggle the first tab again.  This sets - properly for the second pass and
    //  restores it to + for when we are done.
    toggle_message_pane();
  }

}

