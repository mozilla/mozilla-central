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
 * Test the many horrors involving right-clicks, middle clicks, and selections.
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

  folder = create_folder("RightClickMiddleClickA");
  // we want exactly as many messages as we plan to delete, so that we can test
  //  that the message window and tabs close when they run out of things to
  //  to display.
  make_new_sets_in_folder(folder, [{count: 20}]);
}

/**
 * Make sure that a right-click when there is nothing currently selected does
 *  not cause us to display something, as well as correctly causing a transient
 *  selection to occur.
 */
function test_right_click_with_nothing_selected() {
  be_in_folder(folder);

  select_none();
  assert_nothing_selected();

  right_click_on_row(1);
  assert_selected(1);
  assert_displayed();

  close_popup();
  assert_nothing_selected();
}

/**
 * One-thing selected, right-click on something else.
 */
function test_right_click_with_one_thing_selected() {
  be_in_folder(folder);

  select_click_row(0);
  assert_selected_and_displayed(0);

  right_click_on_row(1);
  assert_selected(1);
  assert_displayed(0);

  close_popup();
  assert_selected_and_displayed(0);
}

/**
 * Many things selected, right-click on something that is not in that selection.
 */
function test_right_click_with_many_things_selected() {
  be_in_folder(folder);

  select_click_row(0);
  select_shift_click_row(5);
  assert_selected_and_displayed([0, 5]);

  right_click_on_row(6);
  assert_selected(6);
  assert_displayed([0, 5]);

  close_popup();
  assert_selected_and_displayed([0, 5]);
}

/**
 * One thing selected, right-click on that.
 */
function test_right_click_on_existing_single_selection() {
  be_in_folder(folder);

  select_click_row(3);
  assert_selected_and_displayed(3);

  right_click_on_row(3);
  assert_selected_and_displayed(3);

  close_popup();
  assert_selected_and_displayed(3);
}

/**
 * Many things selected, right-click somewhere in the selection.
 */
function test_right_click_on_existing_multi_selection() {
  be_in_folder(folder);

  select_click_row(3);
  select_shift_click_row(6);
  assert_selected_and_displayed([3, 6]);

  right_click_on_row(5);
  assert_selected_and_displayed([3, 6]);

  close_popup();
  assert_selected_and_displayed([3, 6]);
}

/**
 * Middle clicking should open a message in a tab, but not affect our selection.
 */
function _middle_click_with_nothing_selected_helper(aBackground) {
  be_in_folder(folder);

  select_none();
  assert_nothing_selected();
  let folderTab = mc.tabmail.currentTabInfo;
  let [tabMessage, curMessage] = middle_click_on_row(1);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(folderTab);
    // Now switch to the new tab and check
    switch_tab(tabMessage);
  }
  assert_selected_and_displayed(curMessage);
  close_tab(tabMessage);

  assert_nothing_selected();
}

/**
 * One-thing selected, middle-click on something else.
 */
function _middle_click_with_one_thing_selected_helper(aBackground) {
  be_in_folder(folder);

  select_click_row(0);
  assert_selected_and_displayed(0);

  let folderTab = mc.tabmail.currentTabInfo;
  let [tabMessage, curMessage] = middle_click_on_row(1);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(folderTab);
    // Now switch to the new tab and check
    switch_tab(tabMessage);
  }
  assert_selected_and_displayed(curMessage);
  close_tab(tabMessage);

  assert_selected_and_displayed(0);
}

/**
 * Many things selected, middle-click on something that is not in that
 *  selection.
 */
function _middle_click_with_many_things_selected_helper(aBackground) {
  be_in_folder(folder);

  select_click_row(0);
  select_shift_click_row(5);
  assert_selected_and_displayed([0, 5]);

  let folderTab = mc.tabmail.currentTabInfo;
  let [tabMessage, curMessage] = middle_click_on_row(1);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(folderTab);
    // Now switch to the new tab and check
    switch_tab(tabMessage);
  }
  assert_selected_and_displayed(curMessage);
  close_tab(tabMessage);

  assert_selected_and_displayed([0, 5]);
}

/**
 * One thing selected, middle-click on that.
 */
function _middle_click_on_existing_single_selection_helper(aBackground) {
  be_in_folder(folder);

  select_click_row(3);
  assert_selected_and_displayed(3);

  let folderTab = mc.tabmail.currentTabInfo;
  let [tabMessage, curMessage] = middle_click_on_row(3);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(folderTab);
    // Now switch to the new tab and check
    switch_tab(tabMessage);
  }
  assert_selected_and_displayed(curMessage);
  close_tab(tabMessage);

  assert_selected_and_displayed(3);
}

/**
 * Many things selected, right-click somewhere in the selection.
 */
function _middle_click_on_existing_multi_selection_helper(aBackground) {
  be_in_folder(folder);

  select_click_row(3);
  select_shift_click_row(6);
  assert_selected_and_displayed([3, 6]);

  let folderTab = mc.tabmail.currentTabInfo;
  let [tabMessage, curMessage] = middle_click_on_row(5);
  if (aBackground) {
    // Make sure we haven't switched to the new tab.
    assert_selected_tab(folderTab);
    // Now switch to the new tab and check
    switch_tab(tabMessage);
  }
  assert_selected_and_displayed(curMessage);
  close_tab(tabMessage);

  assert_selected_and_displayed([3, 6]);
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
  "middle_click_with_nothing_selected",
  "middle_click_with_one_thing_selected",
  "middle_click_with_many_things_selected",
  "middle_click_on_existing_single_selection",
  "middle_click_on_existing_multi_selection"
]);

/**
 * Right-click on something and delete it, having no selection previously.
 */
function test_right_click_deletion_nothing_selected() {
  be_in_folder(folder);

  select_none();
  assert_selected_and_displayed();

  let delMessage = right_click_on_row(3);
  delete_via_popup();
  // eh, might as well make sure the deletion worked while we are here
  assert_message_not_in_view(delMessage);

  assert_selected_and_displayed();
}

/**
 * We want to make sure that the selection post-delete still includes the same
 *  message (and that it is displayed).  In order for this to be interesting,
 *  we want to make sure that we right-click delete a message above the selected
 *  message so there is a shift in row numbering.
 */
function test_right_click_deletion_one_other_thing_selected() {
  be_in_folder(folder);

  let curMessage = select_click_row(5);

  let delMessage = right_click_on_row(3);
  delete_via_popup();
  assert_message_not_in_view(delMessage);

  assert_selected_and_displayed(curMessage);
}

function test_right_click_deletion_many_other_things_selected() {
  be_in_folder(folder);

  select_click_row(4);
  let messages = select_shift_click_row(6);

  let delMessage = right_click_on_row(2);
  delete_via_popup();
  assert_message_not_in_view(delMessage);

  assert_selected_and_displayed(messages);
}

function test_right_click_deletion_of_one_selected_thing() {
  be_in_folder(folder);

  let curMessage = select_click_row(2);

  right_click_on_row(2);
  delete_via_popup();
  assert_message_not_in_view(curMessage);

  if (!mc.folderDisplay.selectedCount)
    throw new Error("We should have tried to select something!");
}

function test_right_click_deletion_of_many_selected_things() {
  be_in_folder(folder);

  select_click_row(2);
  let messages = select_shift_click_row(4);

  right_click_on_row(3);
  delete_via_popup();
  assert_messages_not_in_view(messages);

  if (!mc.folderDisplay.selectedCount)
    throw new Error("We should have tried to select something!");
}

