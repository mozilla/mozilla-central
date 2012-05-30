/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-right-click-to-open-search-window';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'search-window-helpers'];

var folderA, folderB;
function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let swh = collector.getModule('search-window-helpers');
  swh.installInto(module);

  folderA = create_folder("RightClickToOpenSearchWindowA");
  folderB = create_folder("RightClickToOpenSearchWindowB");
}

/**
 * Test opening a search window while nothing is selected.
 */
function test_open_search_window_with_nothing_selected() {
  // Make sure the folders we need are visible
  enter_folder(folderB);
  select_no_folders();
  assert_no_folders_selected();

  let swc = open_search_window_from_context_menu(folderA);
  assert_search_window_folder_displayed(swc, folderA);

  close_search_window(swc);
}

/**
 * Test opening a search window while the same folder is selected.
 */
function test_open_search_window_with_existing_single_selection() {
  select_click_folder(folderA);
  assert_folders_selected_and_displayed(folderA);

  let swc = open_search_window_from_context_menu(folderA);
  assert_search_window_folder_displayed(swc, folderA);

  close_search_window(swc);
}

/**
 * Test opening a search window while a different folder is selected.
 */
function test_open_search_window_with_one_thing_selected() {
  select_click_folder(folderA);
  assert_folders_selected_and_displayed(folderA);

  let swc = open_search_window_from_context_menu(folderB);
  assert_search_window_folder_displayed(swc, folderB);

  close_search_window(swc);
}
