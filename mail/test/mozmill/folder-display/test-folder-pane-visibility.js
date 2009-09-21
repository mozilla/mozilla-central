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
 * Test that the folder pane collapses properly, stays collapsed amongst tab
 * changes, and that persistence works (to a first approximation).
 */

var MODULE_NAME = "test-folder-pane-visibility";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("FolderPaneVisibility");
  make_new_sets_in_folder(folder, [{count: 3}]);
}

/**
 * When displaying a folder, assert that the folder pane is visible and all the
 * menus, splitters, etc. are set up right.
 */
function assert_folder_pane_visible() {
  if (!mc.folderDisplay.folderPaneVisible)
    throw new Error("The folder display does not think that the folder pane " +
                    "is visible, but it should!");

  // - folder pane should be visible
  if (mc.e("folderPaneBox").collapsed === true)
    throw new Error("folderPaneBox should not be collapsed!");

  // - the folder pane splitter should not be collapsed
  if (mc.e("folderpane_splitter").collapsed === true)
    throw new Error("folderpane_splitter should not be collapsed!");
}

/**
 * When displaying a folder, assert that the folder pane is hidden and all the
 * menus, splitters, etc. are set up right.
 *
 * @param aFolderPaneIllegal Is the folder pane illegal to display at this time?
 *     This impacts whether the folder pane splitter should be visible.
 */
function assert_folder_pane_hidden(aFolderPaneIllegal) {
  if (mc.folderDisplay.folderPaneVisible)
    throw new Error("The folder display thinks that the folder pane is " +
                    "visible, but it shouldn't!");

  // - folder pane shouldn't be visible
  if (mc.e("folderPaneBox").collapsed === false)
    throw new Error("folderPaneBox should be collapsed!");

  // - the folder pane splitter should or should not be collapsed, depending on
  //   aFolderPaneIllegal
  if (aFolderPaneIllegal) {
    if (mc.e("folderpane_splitter").collapsed === false)
      throw new Error("folderpane_splitter should be collapsed!");
  }
  else {
    if (mc.e("folderpane_splitter").collapsed === true)
      throw new Error("folderpane_splitter should not be collapsed!");
  }
}

function toggle_folder_pane() {
  // Since we don't have a shortcut to toggle the folder pane, we're going to
  // have to collapse it ourselves
  let folderPaneBox = mc.e("folderPaneBox");
  let currentState = folderPaneBox.collapsed;

  folderPaneBox.collapsed = !currentState;
}

/**
 * By default, the folder pane should be visible.
 */
function test_folder_pane_visible_state_is_right() {
  be_in_folder(folder);
  assert_folder_pane_visible();
}

/**
 * Toggle the folder pane off.
 */
function test_toggle_folder_pane_off() {
  toggle_folder_pane();
  assert_folder_pane_hidden();
}

/**
 * Toggle the folder pane on.
 */
function test_toggle_folder_pane_on() {
  toggle_folder_pane();
  assert_folder_pane_visible();
}

/**
 * Make sure that switching to message tabs of folder tabs with a different
 * folder pane state does not break. This test should cover all transition
 * states.
 */
function test_folder_pane_is_sticky() {
  let tabFolderA = be_in_folder(folder);
  assert_folder_pane_visible();

  // [folder+ => (new) message]
  select_click_row(0);
  let tabMessage = open_selected_message_in_new_tab();
  assert_folder_pane_hidden(true);

  // [message => folder+]
  switch_tab(tabFolderA);
  assert_folder_pane_visible();

  // [folder+ => (new) folder+]
  let tabFolderB = open_folder_in_new_tab(folder);
  assert_folder_pane_visible();

  // [folder pane toggle + => -]
  toggle_folder_pane();
  assert_folder_pane_hidden();

  // [folder- => folder+]
  switch_tab(tabFolderA);
  assert_folder_pane_visible();

  // (redundant) [ folder pane toggle + => -]
  toggle_folder_pane();
  assert_folder_pane_hidden();

  // [folder- => message]
  switch_tab(tabMessage);
  assert_folder_pane_hidden(true);

  // [message => folder-]
  close_tab(tabMessage);
  assert_folder_pane_hidden();

  // [folder- => (new) folder-]
  // (we are testing inheritance here)
  let tabFolderC = open_folder_in_new_tab(folder);
  assert_folder_pane_hidden();

  // [folder- => folder-]
  close_tab(tabFolderC);
  // the tab we are on now doesn't matter, so we don't care
  assert_folder_pane_hidden();
  switch_tab(tabFolderB);

  // [ folder pane toggle - => + ]
  toggle_folder_pane();
  assert_folder_pane_visible();

  // [folder+ => folder-]
  close_tab(tabFolderB);
  assert_folder_pane_hidden();

  // (redundant) [ folder pane toggle - => + ]
  toggle_folder_pane();
  assert_folder_pane_visible();
}

/**
 * Test that if we serialize and restore the tabs then the folder pane is in the
 * expected collapsed/non-collapsed state. Because of the special "first tab"
 * situation, we need to do this twice to test each case for the first tab.  For
 * additional thoroughness we also flip the state we have the other tabs be in.
 */
function test_folder_pane_persistence_generally_works() {
  be_in_folder(folder);

  // helper to open tabs with the folder pane in the desired states (1 for
  //  visible, 0 for hidden)
  function openTabs(aConfig) {
    let curState;
    for (let [iTab, folderPaneVisible] in Iterator(aConfig)) {
      if (iTab == 0) {
        curState = folderPaneVisible;
      }
      else {
        open_folder_in_new_tab(folder);
        if (curState != folderPaneVisible) {
          toggle_folder_pane();
          curState = folderPaneVisible;
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
    for (let [iTab, folderPaneVisible] in Iterator(aConfig)) {
      switch_tab(iTab);
      dump(" checking tab: " + iTab + "\n");
      if (folderPaneVisible)
        assert_folder_pane_visible();
      else
        assert_folder_pane_hidden();
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
    // to change things.
    toggle_folder_pane();
    mc.tabmail.restoreTabs(state);
    verifyTabs(config);
    closeTabs();

    // toggle the first tab again.  This sets - properly for the second pass and
    // restores it to + for when we are done.
    toggle_folder_pane();
  }
  // For one last time, make sure.
  assert_folder_pane_visible();
}
