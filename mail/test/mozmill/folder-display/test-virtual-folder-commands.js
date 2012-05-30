/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that commands on virtual folders work properly.
 */
var MODULE_NAME = 'test-message-size';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

var msgsPerThread = 5;
var singleVirtFolder;
var multiVirtFolder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let [folderOne, setOne] = make_folder_with_sets(
    [{msgsPerThread: msgsPerThread}]);
  let [folderTwo, setTwo] = make_folder_with_sets(
    [{msgsPerThread: msgsPerThread}]);

  singleVirtFolder = make_virtual_folder([folderOne], {});
  multiVirtFolder = make_virtual_folder([folderOne, folderTwo], {});
}

function test_single_folder_select_thread() {
  be_in_folder(singleVirtFolder);
  make_display_threaded();
  expand_all_threads();

  // Try selecting the thread from the root message.
  select_click_row(0);
  mc.keypress(null, "a", {accelKey: true, shiftKey: true});
  assert_true(mc.folderDisplay.selectedCount == msgsPerThread,
              "Didn't select all messages in the thread!");

  // Now try selecting the thread from a non-root message.
  select_click_row(1);
  mc.keypress(null, "a", {accelKey: true, shiftKey: true});
  assert_true(mc.folderDisplay.selectedCount == msgsPerThread,
              "Didn't select all messages in the thread!");
}

function test_cross_folder_select_thread() {
  be_in_folder(multiVirtFolder);
  make_display_threaded();
  expand_all_threads();

  // Try selecting the thread from the root message.
  select_click_row(0);
  mc.keypress(null, "a", {accelKey: true, shiftKey: true});
  assert_true(mc.folderDisplay.selectedCount == msgsPerThread,
              "Didn't select all messages in the thread!");

  // Now try selecting the thread from a non-root message.
  select_click_row(1);
  mc.keypress(null, "a", {accelKey: true, shiftKey: true});
  assert_true(mc.folderDisplay.selectedCount == msgsPerThread,
              "Didn't select all messages in the thread!");
}
