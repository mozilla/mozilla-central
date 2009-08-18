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
