/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that the unread folder mode works properly. This includes making
 * sure that the selected folder is maintained correctly when the view
 * is rebuilt because a folder has become newly unread.
 */

var MODULE_NAME = "test-unread-folders";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var rootFolder;
var inboxSubfolder;
var trashFolder;
var trashSubfolder;

const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  rootFolder = inboxFolder.server.rootFolder;

  // Create a folder as a subfolder of the inbox
  inboxFolder.createSubfolder("UnreadFoldersA", null);
  inboxSubfolder = inboxFolder.getChildNamed("UnreadFoldersA");

  trashFolder = inboxFolder.server.rootFolder.getFolderWithFlags(
    nsMsgFolderFlags.Trash);
  trashFolder.createSubfolder("UnreadFoldersB", null);
  trashSubfolder = trashFolder.getChildNamed("UnreadFoldersB");

  // The message itself doesn't really matter, as long as there's at least one
  // in the folder.
  make_new_sets_in_folder(inboxFolder, [{count: 1}]);
  make_new_sets_in_folder(inboxSubfolder, [{count: 1}]);
}

/**
 * Switch to the all folders mode.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
  be_in_folder(inboxFolder);
}

/**
 * Switch to the unread folder mode.
 */
function test_switch_to_unread_folders() {
  mc.folderTreeView.mode = "unread";
}

/**
 * Test that inbox and inboxSubfolder are in view
 */
function test_folder_population() {
  assert_folder_visible(inboxFolder);
  assert_folder_visible(inboxSubfolder);
}

/**
 * Test that a folder newly getting unread messages doesn't
 * change the selected folder in unread folders mode.
 */
function test_newly_added_folder() {
  make_new_sets_in_folder(trashFolder, [{count: 1}]);
  assert_folder_visible(trashFolder);
  if (mc.folderTreeView.getSelectedFolders()[0] != inboxFolder)
    throw new Error("Inbox folder should be selected after new unread folder" +
                    " added to unread view");
}

