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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

  // Now attempt to select the folder.
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

  // Now attempt to select the folder.
  mc.folderTreeView.selectFolder(inboxSubfolder);

  assert_folder_collapsed(smartInboxFolder);
  assert_folder_expanded(rootFolder);
  assert_folder_selected_and_displayed(inboxSubfolder);
}

/**
 * Test that smart folders are updated when the folders they should be
 * searching over are added/removed or have the relevant flag set/cleared.
 */
function test_folder_flag_changes() {
  expand_folder(smartInboxFolder);
  // Now attempt to select the folder.
  mc.folderTreeView.selectFolder(inboxSubfolder);
  // Need to archive two messages in two different accounts in order to
  // create a smart Archives folder.
  select_click_row(0);
  archive_selected_messages();
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let pop3Server = acctMgr.FindServer("tinderbox", "tinderbox", "pop3");
  let pop3Inbox = pop3Server.rootFolder.getChildNamed("Inbox");
  make_new_sets_in_folder(pop3Inbox, [{count: 1}]);
  mc.folderTreeView.selectFolder(pop3Inbox);
  select_click_row(0);
  archive_selected_messages();

  smartArchiveFolder = get_smart_folder_named("Archives");
  let archiveScope = "|" + smartArchiveFolder.msgDatabase.dBFolderInfo
                     .getCharProperty("searchFolderUri") + "|";
  // We should have both this account, and a folder corresponding
  // to this year in the scope.
  rootFolder = inboxFolder.server.rootFolder;
  let archiveFolder = rootFolder.getChildNamed("Archives");
  assert_folder_and_children_in_scope(archiveFolder, archiveScope);
  archiveFolder = pop3Server.rootFolder.getChildNamed("Archives");
  assert_folder_and_children_in_scope(archiveFolder, archiveScope);

  // Remove the archive flag, and make sure the archive folder and
  // its children are no longer in the search scope.
  archiveFolder.clearFlag(nsMsgFolderFlags.Archive);

  // Refresh the archive scope because clearing the flag should have
  // changed it.
  archiveScope = "|" + smartArchiveFolder.msgDatabase.dBFolderInfo
                 .getCharProperty("searchFolderUri") + "|";

  // figure out what we expect the archiveScope to now be.
  let allDescendents = Cc["@mozilla.org/supports-array;1"]
                         .createInstance(Ci.nsISupportsArray);
  rootFolder = inboxFolder.server.rootFolder;
  let localArchiveFolder = rootFolder.getChildNamed("Archives");
  localArchiveFolder.ListDescendents(allDescendents);
  let numFolders = allDescendents.Count();
  desiredScope = "|" + localArchiveFolder.URI + "|";
  for each (let f in fixIterator(allDescendents, Ci.nsIMsgFolder))
    desiredScope += f.URI + "|";

  if (archiveScope != desiredScope)
    throw "archive scope wrong after removing folder";
  assert_folder_and_children_not_in_scope(archiveFolder, archiveScope);
}

function assert_folder_and_children_in_scope(folder, searchScope)
{
  let folderURI = "|" + folder.URI + "|";
  assert_uri_found(folderURI, searchScope);
  let allDescendents = Cc["@mozilla.org/supports-array;1"]
                         .createInstance(Ci.nsISupportsArray);
  folder.ListDescendents(allDescendents);
  let numFolders = allDescendents.Count();
  for each (let f in fixIterator(allDescendents, Ci.nsIMsgFolder))
    assert_uri_found(f.URI, searchScope)
}

function assert_folder_and_children_not_in_scope(folder, searchScope)
{
  let folderURI = "|" + folder.URI + "|";
  assert_uri_not_found(folderURI, searchScope);
  let allDescendents = Cc["@mozilla.org/supports-array;1"]
                     .createInstance(Ci.nsISupportsArray);
  folder.ListDescendents(allDescendents);
  let numFolders = allDescendents.Count();
  for each (let f in fixIterator(allDescendents, Ci.nsIMsgFolder))
    assert_uri_not_found(f.URI, searchScope)
}

function assert_uri_found(folderURI, scopeList)
{
  if (scopeList.indexOf(folderURI) == -1)
    throw new Error("scope " + scopeList + "doesn't contain " + folderURI);
}

function assert_uri_not_found(folderURI, scopeList)
{
  if (scopeList.indexOf(folderURI) != -1)
    throw new Error("scope " + scopeList + "contains " + folderURI +
                    " but shouldn't");
}

/**
 * Move back to the all folders mode.
 */
function test_switch_to_all_folders() {
  mc.folderTreeView.mode = "all";
}
