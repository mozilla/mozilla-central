/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests for custom folder tree modes. The test mode is provided by the test
 * extension in the test-extension subdirectory.
 */

var MODULE_NAME = "test-custom-folder-tree-mode";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
}

// Provided by the extension in test-extension
const kTestModeID = "testmode";

/**
 * Switch to the mode and verify that it displays correctly.
 */
function test_switch_to_test_mode() {
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let server = acctMgr.FindServer("tinderbox", "tinderbox", "pop3");
  folder = server.rootFolder.getChildNamed("Inbox");

  mc.folderTreeView.mode = kTestModeID;
  assert_folder_mode(kTestModeID);
  assert_folder_visible(folder);
}

/**
 * Open a new 3-pane window while the custom mode is selected, and make sure
 * that the mode displayed in the new window is the custom mode.
 */
function test_open_new_window_with_custom_mode() {
  // Our selection may get lost while changing modes, and be_in_folder is
  // not sufficient to ensure actual selection.
  mc.folderTreeView.selectFolder(folder);

  plan_for_new_window("mail:3pane");
  mc.window.MsgOpenNewWindowForFolder(null, -1);
  let mc2 = wait_for_new_window("mail:3pane");

  assert_folder_mode(kTestModeID, mc2);
  assert_folder_visible(folder, mc2);

  close_window(mc2);
}

/**
 * Switch back to all folders.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}
