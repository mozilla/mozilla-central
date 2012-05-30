/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that we open multiple search windows when shortcuts are invoked multiple
 * times.
 */

var MODULE_NAME = 'test-multiple-search-windows';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'search-window-helpers'];

var folderA, folderB;
function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let swh = collector.getModule('search-window-helpers');
  swh.installInto(module);

  folderA = create_folder("MultipleSearchWindowsA");
  folderB = create_folder("MultipleSearchWindowsB");
}

/**
 * Test bringing up multiple search windows for multiple folders.
 */
function test_show_multiple_search_windows_for_multiple_folders() {
  be_in_folder(folderA);

  let swcA = open_search_window();
  // Check whether the window's displaying the right folder
  assert_search_window_folder_displayed(swcA, folderA);

  mc.window.focus();
  be_in_folder(folderB);
  // This should time out if a second search window isn't opened
  let swcB = open_search_window();

  // Now check whether both windows are displaying the right folders
  assert_search_window_folder_displayed(swcA, folderA);
  assert_search_window_folder_displayed(swcB, folderB);

  // Clean up, close both windows
  close_search_window(swcA);
  close_search_window(swcB);
}

/**
 * Test bringing up multiple search windows for the same folder.
 */
function test_show_multiple_search_windows_for_the_same_folder() {
  be_in_folder(folderA);
  let swc1 = open_search_window();
  // Check whether the window's displaying the right folder
  assert_search_window_folder_displayed(swc1, folderA);

  mc.window.focus();
  // This should time out if a second search window isn't opened
  let swc2 = open_search_window();

  // Now check whether both windows are displaying the right folders
  assert_search_window_folder_displayed(swc1, folderA);
  assert_search_window_folder_displayed(swc2, folderA);

  // Clean up, close both windows
  close_search_window(swc1);
  close_search_window(swc2);
}
