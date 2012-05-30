/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that displaying messages in folder tabs works correctly with folder
 * modes. This includes:
 * - switching to the default folder mode if the folder isn't present in the
 *   current folder mode
 * - not switching otherwise
 * - making sure that we're able to expand the right folders in the smart folder
 *   mode
 */

var MODULE_NAME = "test-display-message-with-folder-modes";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var folder;
var dummyFolder;
var smartInboxFolder;

var msgHdr;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  // This is a subfolder of the inbox so that
  // test_display_message_in_smart_folder_mode_works is able to test that we
  // don't attempt to expand any inboxes.
  inboxFolder.createSubfolder("DisplayMessageWithFolderModesA", null);
  folder = inboxFolder.getChildNamed("DisplayMessageWithFolderModesA");
  // This second folder is meant to act as a dummy folder to switch to when we
  // want to not be in folder.
  inboxFolder.createSubfolder("DisplayMessageWithFolderModesB", null);
  dummyFolder = inboxFolder.getChildNamed("DisplayMessageWithFolderModesB");
  make_new_sets_in_folder(folder, [{count: 5}]);
  // The message itself doesn't really matter, as long as there's at least one
  // in the inbox.  We will delete this in teardownModule because the inbox
  // is a shared resource and it's not okay to leave stuff in there.
  make_new_sets_in_folder(inboxFolder, [{count: 1}]);
}

/**
 * Test that displaying a message causes a switch to the default folder mode if
 * the folder isn't present in the current folder mode.
 */
function test_display_message_with_folder_not_present_in_current_folder_mode() {
  be_in_folder(folder);
  msgHdr = mc.dbView.getMsgHdrAt(0);

  // Make sure the folder doesn't appear in the favorite folder mode just
  // because it was selected last before switching
  be_in_folder(inboxFolder);

  // Move to favorite folders. This folder isn't currently a favorite folder
  mc.folderTreeView.mode = "favorite";
  assert_folder_not_visible(folder);

  // Try displaying a message
  display_message_in_folder_tab(msgHdr);

  assert_folder_mode(mc.window.kDefaultMode);
  assert_folder_selected_and_displayed(folder);
  assert_selected_and_displayed(msgHdr);
}

/**
 * Test that displaying a message _does not_ cause a switch to the default
 * folder mode if the folder is present in the current folder mode.
 */
function test_display_message_with_folder_present_in_current_folder_mode() {
  // Mark the folder as a favorite
  folder.flags |= Ci.nsMsgFolderFlags.Favorite;
  // Also mark the dummy folder as a favorite, in preparation for
  // test_display_message_in_smart_folder_mode_works
  dummyFolder.flags |= Ci.nsMsgFolderFlags.Favorite;

  // Make sure the folder doesn't appear in the favorite folder mode just
  // because it was selected last before switching
  be_in_folder(inboxFolder);

  // Switch to favorite folders. Check that the folder is now in the view, as is
  // the dummy folder
  mc.folderTreeView.mode = "favorite";
  assert_folder_visible(folder);
  assert_folder_visible(dummyFolder);

  // Try displaying a message
  display_message_in_folder_tab(msgHdr);

  assert_folder_mode("favorite");
  assert_folder_selected_and_displayed(folder);
  assert_selected_and_displayed(msgHdr);

  // Now unset the flags so that we don't affect later tests.
  folder.flags &= ~Ci.nsMsgFolderFlags.Favorite;
  dummyFolder.flags &= ~Ci.nsMsgFolderFlags.Favorite;
}

/**
 * Test that displaying a message in smart folders mode causes the parent in the
 * view to expand.
 */
function test_display_message_in_smart_folder_mode_works() {
  // Clear the message selection, otherwise msgHdr will still be displayed and
  // display_message_in_folder_tab(msgHdr) will be a no-op.
  select_none();
  // Switch to the dummy folder, otherwise msgHdr will be in the view and the
  // display message in folder tab logic will simply select the message without
  // bothering to expand any folders.
  be_in_folder(dummyFolder);

  mc.folderTreeView.mode = "smart";

  let rootFolder = folder.server.rootFolder;
  // Check that the folder is actually the child of the account root
  assert_folder_child_in_view(folder, rootFolder);

  // Collapse everything
  smartInboxFolder = get_smart_folder_named("Inbox");
  collapse_folder(smartInboxFolder);
  assert_folder_collapsed(smartInboxFolder);
  collapse_folder(rootFolder);
  assert_folder_collapsed(rootFolder);
  assert_folder_not_visible(folder);

  // Try displaying the message
  display_message_in_folder_tab(msgHdr);

  // Check that the right folders have expanded
  assert_folder_mode("smart");
  assert_folder_collapsed(smartInboxFolder);
  assert_folder_expanded(rootFolder);
  assert_folder_selected_and_displayed(folder);
  assert_selected_and_displayed(msgHdr);
}

/**
 * Test that displaying a message in an inbox in smart folders mode causes the
 * message to be displayed in the smart inbox.
 */
function test_display_inbox_message_in_smart_folder_mode_works() {
  be_in_folder(inboxFolder);
  let inboxMsgHdr = mc.dbView.getMsgHdrAt(0);

  // Collapse everything
  collapse_folder(smartInboxFolder);
  assert_folder_collapsed(smartInboxFolder);
  assert_folder_not_visible(inboxFolder);
  let rootFolder = folder.server.rootFolder;
  collapse_folder(rootFolder);
  assert_folder_collapsed(rootFolder);

  // Move to a different folder
  be_in_folder(get_smart_folder_named("Trash"));
  assert_message_not_in_view(inboxMsgHdr);

  // Try displaying the message
  display_message_in_folder_tab(inboxMsgHdr);

  // Check that nothing has expanded, and that the right folder is selected
  assert_folder_mode("smart");
  assert_folder_collapsed(smartInboxFolder);
  assert_folder_collapsed(rootFolder);
  assert_folder_selected_and_displayed(smartInboxFolder);
  assert_selected_and_displayed(inboxMsgHdr);
}

/**
 * Move back to the all folders mode.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}

function teardownModule() {
  be_in_folder(inboxFolder);
  select_click_row(0);
  press_delete();
}
