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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <jvporter@wisc.edu>
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
