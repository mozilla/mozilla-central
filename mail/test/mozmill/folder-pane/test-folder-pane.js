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
 * Tests for the folder pane, in particular the tree view. This is kept separate
 * from the main folder-display suite so that the folders created by other tests
 * there don't influence the results here.
 */

var MODULE_NAME = 'test-folder-pane';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

var folderA, folderB;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
}

/**
 * Assert the Folder Pane is in All Folder mode by default.  Check that the
 * correct number of rows for accounts and folders are always shown as new
 * folders are created, expanded, and collapsed.
 */
function test_all_folders_toggle_folder_open_state() {
  // Test that we are in All Folders mode by default
  assert_folder_mode("all");

  // All folders mode should give us only 2 rows to start
  // (tinderbox account and local folders)
  let accounts = 2;
  assert_folder_tree_view_row_count(accounts);

  folderA = create_folder("FolderPaneA");
  be_in_folder(folderA);

  // After creating our first folder we should have 6 rows visible
  let inbox = trash = outbox = folderPaneA = 1;
  assert_folder_tree_view_row_count(accounts + inbox + trash + outbox +
                                    folderPaneA);

  let oneFolderCount = mc.folderTreeView.rowCount;

  // This makes sure the folder can be toggled
  folderA.createSubfolder("FolderPaneB", null);
  folderB = folderA.getChildNamed("FolderPaneB");
  // Enter folderB, then enter folderA. This makes sure that folderA is not
  // collapsed.
  enter_folder(folderB);
  enter_folder(folderA);

  // At this point folderA should be open, so the view should have one more
  // item than before (FolderPaneB).
  assert_folder_tree_view_row_count(oneFolderCount + 1);

  // Toggle the open state of folderA
  let index = mc.folderTreeView.getIndexOfFolder(folderA);
  mc.folderTreeView.toggleOpenState(index);

  // folderA should be collapsed so we are back to the original count
  assert_folder_tree_view_row_count(oneFolderCount);

  // Toggle it back to open
  mc.folderTreeView.toggleOpenState(index);

  // folderB should be visible again
  assert_folder_tree_view_row_count(oneFolderCount + 1);
}
