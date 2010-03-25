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
 * Test that the smart folder mode works properly. This includes checking
 * whether |getParentOfFolder| works, and also making sure selectFolder behaves
 * properly, opening the right folders.
 */

var MODULE_NAME = "test-smart-folders";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var rootFolder;
var inboxSubfolder;
var trashFolder;
var trashSubfolder;

var smartInboxFolder;

const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  rootFolder = inboxFolder.server.rootFolder;

  // Create a folder as a subfolder of the inbox
  inboxFolder.createSubfolder("SmartFoldersA", null);
  inboxSubfolder = inboxFolder.getChildNamed("SmartFoldersA");

  trashFolder = inboxFolder.server.rootFolder.getFolderWithFlags(
    nsMsgFolderFlags.Trash);
  trashFolder.createSubfolder("SmartFoldersB", null);
  trashSubfolder = trashFolder.getChildNamed("SmartFoldersB");

  // The message itself doesn't really matter, as long as there's at least one
  // in the folder.
  make_new_sets_in_folder(inboxFolder, [{count: 1}]);
  make_new_sets_in_folder(inboxSubfolder, [{count: 1}]);
}

/**
 * Assert that the given folder is considered to be the container of the given
 * message header in this folder mode.
 */
function assert_folder_for_msg_hdr(aMsgHdr, aFolder) {
  let actualFolder = mc.folderTreeView.getFolderForMsgHdr(aMsgHdr);
  if (actualFolder != aFolder)
    throw new Error("Message " + aMsgHdr.messageId +
                    " should be contained in folder " + aFolder.URI +
                    "in this view, but is actually contained in " +
                    actualFolder.URI);
}

/**
 * Switch to the smart folder mode.
 */
function test_switch_to_smart_folders() {
  mc.folderTreeView.mode = "smart";

  // The smart inbox may not have been created at setupModule time, so get it
  // now
  smartInboxFolder = get_smart_folder_named("Inbox");
}

/**
 * Test the getParentOfFolder function.
 */
function test_get_parent_of_folder() {
  // An inbox should have the special inbox as its parent
  assert_folder_child_in_view(inboxFolder, smartInboxFolder);
  // Similarly for the trash folder
  assert_folder_child_in_view(trashFolder, get_smart_folder_named("Trash"));

  // A child of the inbox (a shallow special folder) should have the account's
  // root folder as its parent
  assert_folder_child_in_view(inboxSubfolder, rootFolder);
  // A child of the trash (a deep special folder) should have the trash itself
  // as its parent
  assert_folder_child_in_view(trashSubfolder, trashFolder);

  // Subfolders of subfolders of the inbox should behave as normal
  inboxSubfolder.createSubfolder("SmartFoldersC", null);
  assert_folder_child_in_view(inboxSubfolder.getChildNamed("SmartFoldersC"),
                       inboxSubfolder);
}

/**
 * Test the getFolderForMsgHdr function.
 */
function test_get_folder_for_msg_hdr() {
  be_in_folder(inboxFolder);
  let inboxMsgHdr = mc.dbView.getMsgHdrAt(0);
  assert_folder_for_msg_hdr(inboxMsgHdr, smartInboxFolder);

  be_in_folder(inboxSubfolder);
  let inboxSubMsgHdr = mc.dbView.getMsgHdrAt(0);
  assert_folder_for_msg_hdr(inboxSubMsgHdr, inboxSubfolder);
}

/**
 * Test that selectFolder expands a collapsed smart inbox.
 */
function test_select_folder_expands_collapsed_smart_inbox() {
  // Collapse the smart inbox
  collapse_folder(smartInboxFolder);
  assert_folder_collapsed(smartInboxFolder);

  // Also collapse the account root, make sure selectFolder don't expand it
  collapse_folder(rootFolder);
  assert_folder_collapsed(rootFolder);

  // Now attempt to select the folder
  mc.folderTreeView.selectFolder(inboxFolder);

  assert_folder_collapsed(rootFolder);
  assert_folder_expanded(smartInboxFolder);
  assert_folder_selected_and_displayed(inboxFolder);
}

/**
 * Test that selectFolder expands a collapsed account root.
 */
function test_select_folder_expands_collapsed_account_root() {
  // Collapse the account root
  collapse_folder(rootFolder);
  assert_folder_collapsed(rootFolder);

  // Also collapse the smart inbox, make sure selectFolder don't expand it
  collapse_folder(smartInboxFolder);
  assert_folder_collapsed(smartInboxFolder);

  // Now attempt to select the folder
  mc.folderTreeView.selectFolder(inboxSubfolder);

  assert_folder_collapsed(smartInboxFolder);
  assert_folder_expanded(rootFolder);
  assert_folder_selected_and_displayed(inboxSubfolder);
}

/**
 * Move back to the all folders mode.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}
