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
 * Tests for custom folder tree modes.
 */

var MODULE_NAME = "test-custom-folder-tree-mode";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  folder = create_folder("CustomFolderTreeMode");
}

const kTestModeID = "testmode";

// A custom folder tree mode that just returns a single folder.
var testFolderTreeMode = {
  generateMap: function customFolderTreeMode_generateMap(aFTV) {
    return [new mc.window.ftvItem(folder)];
  }
};

/**
 * Register the test folder tree mode with the folder pane.
 */
function test_register_mode() {
  // Subclass IFolderTreeMode as all good extensions are expected to do.
  testFolderTreeMode.__proto__ = mc.window.IFolderTreeMode;
  mc.folderTreeView.registerFolderTreeMode(kTestModeID, testFolderTreeMode,
                                           "Test Mode");
}

/**
 * Switch to the mode and verify that it displays correctly.
 */
function test_switch_to_test_mode() {
  mc.folderTreeView.mode = kTestModeID;
  assert_folder_mode(kTestModeID);
  assert_folder_visible(folder);
}

/**
 * Switch back to all folders.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}
