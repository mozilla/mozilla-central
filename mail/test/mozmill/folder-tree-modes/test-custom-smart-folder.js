/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
