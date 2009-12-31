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

var msgHdr;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  // This is a subfolder of the inbox so that
  // test_display_message_in_smart_folder_mode_works is able to test that we
  // don't attempt to expand any inboxes.
  inboxFolder.createSubfolder("DisplayMessageWithFolderModesA", null);
  folder = inboxFolder.getChildNamed("DisplayMessageWithFolderModesA");
  make_new_sets_in_folder(folder, [{count: 5}]);
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
  folder.flags |= Components.interfaces.nsMsgFolderFlags.Favorite;

  // Make sure the folder doesn't appear in the favorite folder mode just
  // because it was selected last before switching
  be_in_folder(inboxFolder);

  // Switch to favorite folders. Check that the folder is now in the view
  mc.folderTreeView.mode = "favorite";
  assert_folder_visible(folder);

  // Try displaying a message
  display_message_in_folder_tab(msgHdr);

  assert_folder_mode("favorite");
  assert_folder_selected_and_displayed(folder);
  assert_selected_and_displayed(msgHdr);
}

/**
 * Test that displaying a message in smart folders mode causes the parent in the
 * view to expand.
 */
function test_display_message_in_smart_folder_mode_works() {
  mc.folderTreeView.mode = "smart";

  let rootFolder = folder.server.rootFolder;
  // Check that the folder is actually the child of the account root
  assert_folder_child_in_view(folder, rootFolder);

  // Collapse everything
  let smartInboxFolder = get_smart_folder_named("Inbox");
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
 * Move back to the all folders mode.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}
