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
 *   Blake Winton <bwinton@latte.ca>
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
 * Test that opening new folder and message tabs has the expected result and
 *  that closing them doesn't break anything.
 */
var MODULE_NAME = "test-folder-toolbar";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var folderA, folderB;

function setupModule(module)
{
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folderA = create_folder("FolderToolbarA");
  // we need one message to select and open
  folderB = create_folder("FolderToolbarB");
  make_new_sets_in_folder(folderB, [{count: 1}]);
}

function assert_equals(a, b, comment)
{
  if (!comment)
    comment = "a != b";
  if (a != b)
    throw new Error(comment + ": '"+ a + "' != '" + b + "'.");
}

function test_add_folder_toolbar()
{
  // It should not be present by default
  let folderLoc = mc.eid("locationFolders");
  mc.assertNodeNotExist(folderLoc);

  // But it should show up when we call
  add_to_toolbar(mc.e("mail-bar3"), "folder-location-container");
  folderLoc = mc.eid("locationFolders");
  mc.assertNode(folderLoc);

  // XXX I'm not sure we actually want this behavior...
  assert_equals(folderLoc.node.label, " ",
                "Uninitialized Folder doesn't have a blank label.");
}

function test_folder_toolbar_shows_correct_item()
{
  add_to_toolbar(mc.e("mail-bar3"), "folder-location-container");
  let folderLoc = mc.eid("locationFolders");

  // Start in folder a.
  let tabFolderA = be_in_folder(folderA);
  assert_folder_selected_and_displayed(folderA);
  assert_nothing_selected();
  assert_equals(folderLoc.node.label, "FolderToolbarA",
                "Opening FolderA doesn't update toolbar.");

  // Open tab b, make sure it works right.
  let tabFolderB = open_folder_in_new_tab(folderB);
  assert_folder_selected_and_displayed(folderB);
  assert_nothing_selected();
  assert_equals(folderLoc.node.label, "FolderToolbarB",
                "Opening FolderB in a tab doesn't update toolbar.");

  // Go back to tab/folder A and make sure we change correctly.
  switch_tab(tabFolderA);
  assert_folder_selected_and_displayed(folderA);
  assert_nothing_selected();
  assert_equals(folderLoc.node.label, "FolderToolbarA",
                "Switching back to FolderA's tab doesn't update toolbar.");

  // Go back to tab/folder A and make sure we change correctly.
  switch_tab(tabFolderB);
  assert_folder_selected_and_displayed(folderB);
  assert_nothing_selected();
  assert_equals(folderLoc.node.label, "FolderToolbarB",
                "Switching back to FolderB's tab doesn't update toolbar.");
  close_tab(tabFolderB);
}

function test_folder_toolbar_disappears_on_message_tab()
{
  add_to_toolbar(mc.e("mail-bar3"), "folder-location-container");
  be_in_folder(folderB);
  let folderLoc = mc.eid("locationFolders");
  mc.assertNode(folderLoc);
  assert_equals(folderLoc.node.label, "FolderToolbarB",
                "We should have started in FolderB.");
  assert_equals(folderLoc.node.collapsed, false,
                "The toolbar should be shown.");

  // Select one message
  let msgHdr = select_click_row(0);
  // Open it
  let messageTab = open_selected_message_in_new_tab();

  assert_equals(mc.e("folder-location-container").collapsed, true,
                "The toolbar should be hidden.");

  // Clean up, close the tab
  close_tab(messageTab);
}

function test_remove_folder_toolbar() {
  remove_from_toolbar(mc.e("mail-bar3"), "folder-location-container");

  mc.assertNodeNotExist(mc.eid("locationFolders"));
}
