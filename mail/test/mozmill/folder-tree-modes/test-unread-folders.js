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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@mozillamessaging.com>
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

