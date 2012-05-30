/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  wait_for_blank_content_pane();
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
