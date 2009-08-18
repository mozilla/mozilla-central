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
