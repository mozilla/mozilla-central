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
 * Test the many horrors involving right-clicks, middle clicks, and
 * selections... on folders!
 */

var MODULE_NAME = 'test-right-click-middle-click-folders';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderA, folderB, folderC;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folderA = create_folder("RightClickMiddleClickFoldersA");
  folderB = create_folder("RightClickMiddleClickFoldersB");
  folderC = create_folder("RightClickMiddleClickFoldersC");

  // We aren't really interested in the messages the folders contain, but just
  // for appearance's sake, add a message to each folder

  make_new_sets_in_folder(folderA, [{count: 1}]);
  make_new_sets_in_folder(folderB, [{count: 1}]);
  make_new_sets_in_folder(folderC, [{count: 1}]);
}

/**
 * Make sure that a right-click when there is nothing currently selected does
 *  not cause us to display something, as well as correctly causing a transient
 *  selection to occur.
 */
function test_right_click_folder_with_nothing_selected() {
  // This should cause folderA to be displayed
  be_in_folder(folderA);

  select_no_folders();
  assert_no_folders_selected();

  right_click_on_folder(folderB);
  assert_folder_selected(folderB);
  // The displayed folder shouldn't change
  assert_folder_displayed(folderA);

  close_popup();
  assert_no_folders_selected();
}

/**
 * One-thing selected, right-click on something else.
 */
function test_right_click_folder_with_one_thing_selected() {
  select_click_folder(folderB);
  assert_folder_selected_and_displayed(folderB);

  right_click_on_folder(folderA);
  assert_folder_selected(folderA);
  assert_folder_displayed(folderB);

  close_popup();
  assert_folder_selected_and_displayed(folderB);
}

/**
 * Many things selected, right-click on something that is not in that selection.
 */
function test_right_click_folder_with_many_things_selected() {
  select_click_folder(folderA);
  select_shift_click_folder(folderB);
  assert_folders_selected_and_displayed(folderA, folderB);

  right_click_on_folder(folderC);
  assert_folder_selected(folderC);
  assert_folder_displayed(folderA);

  close_popup();
  assert_folders_selected_and_displayed(folderA, folderB);
}

/**
 * One thing selected, right-click on that.
 */
function test_right_click_folder_on_existing_single_selection() {
  select_click_folder(folderA);
  assert_folders_selected_and_displayed(folderA);

  right_click_on_folder(folderA);
  assert_folders_selected_and_displayed(folderA);

  close_popup();
  assert_folders_selected_and_displayed(folderA);
}

/**
 * Many things selected, right-click somewhere in the selection.
 */
function test_right_click_folder_on_existing_multi_selection() {
  select_click_folder(folderB);
  select_shift_click_folder(folderC);
  assert_folders_selected_and_displayed(folderB, folderC);

  right_click_on_folder(folderC);
  assert_folders_selected_and_displayed(folderB, folderC);

  close_popup();
  assert_folders_selected_and_displayed(folderB, folderC);
}

/**
 * Middle clicking should open a message in a tab, but not affect our selection.
 */
function _middle_click_folder_with_nothing_selected_helper(aBackground) {
  // This should cause folderA to be displayed
  be_in_folder(folderA);

  select_no_folders();
  assert_no_folders_selected();

  let originalTab = mc.tabmail.currentTabInfo;
  let [newTab, ] = middle_click_on_folder(folderA);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(originalTab);
    // Now switch to the new tab and check
    switch_tab(newTab);
  }
  assert_folder_selected_and_displayed(folderA);
  close_tab(newTab);

  // XXX This is wrong, we shouldn't have anything selected. Since we don't
  // have a special state for nothing selected, we're giving this a pass for
  // now.
  assert_folder_selected_and_displayed(folderA);
}

/**
 * One-thing selected, middle-click on something else.
 */
function _middle_click_folder_with_one_thing_selected_helper(aBackground) {
  select_click_folder(folderB);
  assert_folder_selected_and_displayed(folderB);

  let originalTab = mc.tabmail.currentTabInfo;
  let [newTab, ] = middle_click_on_folder(folderA);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(originalTab);
    // Now switch to the new tab and check
    switch_tab(newTab);
  }
  assert_folder_selected_and_displayed(folderA);
  close_tab(newTab);

  assert_folder_selected_and_displayed(folderB);
}

function _middle_click_folder_with_many_things_selected_helper(aBackground) {
  select_click_folder(folderB);
  select_shift_click_folder(folderC);
  assert_folders_selected_and_displayed(folderB, folderC);

  let originalTab = mc.tabmail.currentTabInfo;
  let [newTab, ] = middle_click_on_folder(folderA);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(originalTab);
    // Now switch to the new tab and check
    switch_tab(newTab);
  }
  assert_folder_selected_and_displayed(folderA);
  close_tab(newTab);

  // XXX Again, this is wrong. We're still giving it a pass because selecting
  // both folderB and folderC is currently the same as selecting folderB.
  assert_folder_selected_and_displayed(folderB);
}

/**
 * One thing selected, middle-click on that.
 */
function _middle_click_folder_on_existing_single_selection_helper(aBackground) {
  select_click_folder(folderC);
  assert_folder_selected_and_displayed(folderC);

  let originalTab = mc.tabmail.currentTabInfo;
  let [newTab, ] = middle_click_on_folder(folderC);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(originalTab);
    // Now switch to the new tab and check
    switch_tab(newTab);
  }
  assert_folder_selected_and_displayed(folderC);
  close_tab(newTab);

  assert_folder_selected_and_displayed(folderC);
}

/**
 * Many things selected, middle-click somewhere in the selection.
 */
function _middle_click_on_existing_multi_selection_helper(aBackground) {
  select_click_folder(folderA);
  select_shift_click_folder(folderC);
  assert_folders_selected_and_displayed(folderA, folderB, folderC);

  let originalTab = mc.tabmail.currentTabInfo;
  let [newTab, ] = middle_click_on_folder(folderB);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(originalTab);
    // Now switch to the new tab and check
    switch_tab(newTab);
  }
  assert_folder_selected_and_displayed(folderB);
  close_tab(newTab);

  // XXX Again, this is wrong. We're still giving it a pass because selecting
  // folderA through folderC is currently the same as selecting folderA.
  assert_folder_selected_and_displayed(folderA);
}

/**
 * Generate background and foreground tests for each middle click test.
 *
 * @param aTests an array of test names
 */
function _generate_background_foreground_tests(aTests) {
  let self = this;
  for each (let [, test] in Iterator(aTests)) {
    let helperFunc = this["_" + test + "_helper"];
    this["test_" + test + "_background"] = function() {
      set_context_menu_background_tabs(true);
      helperFunc.apply(self, [true]);
      reset_context_menu_background_tabs();
    };
    this["test_" + test + "_foreground"] = function() {
      set_context_menu_background_tabs(false);
      helperFunc.apply(self, [false]);
      reset_context_menu_background_tabs();
    };
  }
}

_generate_background_foreground_tests([
  "middle_click_folder_with_nothing_selected",
  "middle_click_folder_with_one_thing_selected",
  "middle_click_folder_with_many_things_selected",
  "middle_click_folder_on_existing_single_selection"
]);
