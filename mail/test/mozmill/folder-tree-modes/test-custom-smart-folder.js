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
 *   Shane Caraveo <shane@caraveo.com>
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
var MODULE_NAME = "test-custom-smart-folder";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

// spaces in the name are intentional
var smartParentNameA="My Smart Folder A";
var smartParentNameB="My Smart Folder B";

var rootFolder;
var inboxSubfolder, subfolderA, subfolderB;
var smartInboxFolder;
var smartFolderA;

const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;

/**
 * create two smart folder types and two real folders, one for each
 * smart folder type
 */
function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  rootFolder = inboxFolder.server.rootFolder;

  // register a new smart folder type
  mc.folderTreeView.getFolderTreeMode("smart")
        .addSmartFolderType(smartParentNameA, false, false);
  mc.folderTreeView.getFolderTreeMode("smart")
        .addSmartFolderType(smartParentNameB, false, false);

  // Create a folder as a subfolder of the inbox
  inboxFolder.createSubfolder("smartFolderA", null);
  subfolderA = inboxFolder.getChildNamed("smartFolderA");
  inboxFolder.createSubfolder("smartFolderB", null);
  subfolderB = inboxFolder.getChildNamed("smartFolderB");
  
  // This is how folders are marked to match a custom smart folder
  subfolderA.setStringProperty("smartFolderName", smartParentNameA);
  subfolderB.setStringProperty("smartFolderName", smartParentNameB);

  // The message itself doesn't really matter, as long as there's at least one
  // in the folder.
  make_new_sets_in_folder(subfolderA, [{count: 1}]);
  make_new_sets_in_folder(subfolderB, [{count: 1}]);
}

/**
 * Switch to the smart folder mode, get the smart inbox.
 */
function test_switch_to_smart_folder_mode() {
  mc.folderTreeView.mode = "smart";
  assert_folder_mode("smart");
  
  smartFolderA = get_smart_folder_named(smartParentNameA);
  mc.folderTreeView.selectFolder(smartFolderA);
}


function test_string_property() {
  if (subfolderA.getStringProperty("smartFolderName") != smartParentNameA)
    throw new Error("smartFolderName string property not set");
  if (subfolderB.getStringProperty("smartFolderName") != smartParentNameB)
    throw new Error("smartFolderName string property not set");
}

function _test_smart_folder_type(folder, parentName) {
  let smartMode = mc.folderTreeView.getFolderTreeMode('smart');
  let [flag,name,deep,search] = smartMode._getSmartFolderType(folder) ;
  if (flag != 0)
    throw new Error("custom smart folder definition ["+parentName+"] has a flag")
  if (name != parentName)
    throw new Error("custom smart folder ["+folder.name+"] is incorrect ["+name+"] should be ["+parentName+"]")
}

function test_smart_folder_type() {
  _test_smart_folder_type(subfolderA, smartParentNameA);
  _test_smart_folder_type(subfolderB, smartParentNameB);
}

/**
 * Test that our custom smart folders exist
 */

function test_custom_folder_exists() {
  assert_folder_mode("smart");
  assert_folder_displayed(smartFolderA);
  // this is our custom smart folder parent created in folderPane.js
  mc.folderTreeView.selectFolder(subfolderA);
  assert_folder_selected_and_displayed(subfolderA);
}

function FTVItemHasChild(parentFTVItem, childFolder, recurse) {
  for each(let child in parentFTVItem.children) {
    if (child._folder.URI == childFolder.URI ||
        recurse && FTVItemHasChild(child, childFolder, recurse))
      return true;
  }
  return false;
}

/**
 * test that our real smart folder is in fact a child if the correct
 * smart folder parent
 */
function test_smart_child_parent_relationship() {
  let folderIndex = assert_folder_visible(smartFolderA);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  if (!FTVItemHasChild(folderFTVItem, subfolderA, false))
    throw new Error("Folder: " + subfolderA.name + " is not a child of our smart parent folder");
  assert_folder_mode("smart")
}


/**
 * test that our real smart folder is NOT a child of the smart inbox in the
 * tree view.
 */
function test_real_child_parent_relationship() {
  smartFolderInbox = get_smart_folder_named("Inbox");
  expand_folder(smartFolderInbox);
  // the real parent should be an Inbox
  let folderIndex = assert_folder_visible(subfolderA.parent);
  let folderFTVItem = mc.folderTreeView.getFTVItemForIndex(folderIndex);
  // in the tree, subfolder is a child of our magic smart folder, and should not
  // be a child of inbox
  if (FTVItemHasChild(folderFTVItem, subfolderA, true))
    throw new Error("Folder: " + subfolderA.name + " should not be a child of an inbox");
  assert_folder_mode("smart")
}


/**
 * test collapse/expand states of one of our smart folders
 */
function test_smart_subfolder() {
  assert_folder_mode("smart");
  collapse_folder(smartFolderA);
  assert_folder_collapsed(smartFolderA);
  assert_folder_not_visible(subfolderA);

  expand_folder(smartFolderA);
  assert_folder_expanded(smartFolderA);
  assert_folder_visible(subfolderA);
}

/**
 * Switch back to all folders.
 */
function test_return_to_all_folders() {
  assert_folder_mode("smart");
  mc.folderTreeView.mode = "all";
  assert_folder_mode("all");
}
