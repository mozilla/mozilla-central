/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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
