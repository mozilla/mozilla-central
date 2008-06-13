/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for account manager functions.
 */

function run_test() {
  var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                          .getService(Components.interfaces.nsIMsgAccountManager);

  // Create a local mail account (we need this first)
  acctMgr.createLocalMailAccount();

  // Get the account
  var account = acctMgr.accounts.GetElementAt(0)
                       .QueryInterface(Components.interfaces.nsIMsgAccount);

  // Get the root folder
  var root = account.incomingServer.rootFolder;

  // Give it a poke so that the directories all exist
  root.subFolders;

  // Test - num/hasSubFolders

  // Get the current number of folders
  var numSubFolders = root.numSubFolders;

  var folder = root.addSubfolder("folder1", null);

  do_check_true(root.hasSubFolders);
  do_check_eq(root.numSubFolders, numSubFolders + 1);

  do_check_false(folder.hasSubFolders);
  do_check_eq(folder.numSubFolders, 0);

  var folder2 = folder.addSubfolder("folder2", null);

  do_check_true(folder.hasSubFolders);
  do_check_eq(folder.numSubFolders, 1);

  // Test - getChildNamed

  do_check_eq(root.getChildNamed("folder1"), folder);

  // Check for non match, this should throw
  var thrown = false;
  try {
    root.getChildNamed("folder2");
  }
  catch (e) {
    thrown = true;
  }

  do_check_true(thrown);

  // folder2 is a child of folder however.
  var folder2 = folder.getChildNamed("folder2");

  // Test - isAncestorOf

  do_check_true(folder.isAncestorOf(folder2));
  do_check_true(root.isAncestorOf(folder2));
  do_check_false(folder.isAncestorOf(root));

  // Test - FoldersWithFlag

  // Keep the same as nsMsgFolderFlags.h
  const MSG_FOLDER_FLAG_FAVORITE = 0x0080;
  const MSG_FOLDER_FLAG_CHECK_NEW = 0x4000;
  const MSG_FOLDER_FLAG_OFFLINE = 0x10000;

  folder.setFlag(MSG_FOLDER_FLAG_CHECK_NEW);
  do_check_true(folder.getFlag(MSG_FOLDER_FLAG_CHECK_NEW));
  do_check_false(folder.getFlag(MSG_FOLDER_FLAG_OFFLINE));

  folder.setFlag(MSG_FOLDER_FLAG_OFFLINE);
  do_check_true(folder.getFlag(MSG_FOLDER_FLAG_CHECK_NEW));
  do_check_true(folder.getFlag(MSG_FOLDER_FLAG_OFFLINE));

  folder.toggleFlag(MSG_FOLDER_FLAG_CHECK_NEW);
  do_check_false(folder.getFlag(MSG_FOLDER_FLAG_CHECK_NEW));
  do_check_true(folder.getFlag(MSG_FOLDER_FLAG_OFFLINE));

  folder.clearFlag(MSG_FOLDER_FLAG_OFFLINE);
  do_check_false(folder.getFlag(MSG_FOLDER_FLAG_CHECK_NEW));
  do_check_false(folder.getFlag(MSG_FOLDER_FLAG_OFFLINE));

  folder.setFlag(MSG_FOLDER_FLAG_FAVORITE);
  folder2.setFlag(MSG_FOLDER_FLAG_FAVORITE);
  folder.setFlag(MSG_FOLDER_FLAG_CHECK_NEW);
  folder2.setFlag(MSG_FOLDER_FLAG_OFFLINE);

  do_check_eq(root.getFolderWithFlags(MSG_FOLDER_FLAG_CHECK_NEW),
              folder);

  // Test - Move folders around

  var folder3 = root.addSubfolder("folder3");
  var folder3Local = folder3.QueryInterface(Components.interfaces.nsIMsgLocalMailFolder);
  folder3Local.copyFolderLocal(folder, true, null, null);

  // Test - Get the new folders, make sure the old ones don't exist

  var folder1Moved = folder3.getChildNamed("folder1");
  var folder2Moved = folder1Moved.getChildNamed("folder2");

  thrown = false;
  try {
    root.getChildNamed("folder1");
  }
  catch (e) {
    thrown = true;
  }

  do_check_true(thrown);

  do_check_false(folder.filePath.exists());
  do_check_false(folder2.filePath.exists());

  // Move folders back, get them
  var rootLocal = root.QueryInterface(Components.interfaces.nsIMsgLocalMailFolder);
  rootLocal.copyFolderLocal(folder1Moved, true, null, null);
  folder = root.getChildNamed("folder1");
  folder2 = folder.getChildNamed("folder2");

  // Test - propagateDelete (this tests recursiveDelete as well)

  var path1 = folder.filePath;
  var path2 = folder2.filePath;
  var path3 = folder3.filePath;

  do_check_true(path1.exists());
  do_check_true(path2.exists());
  do_check_true(path3.exists());

  // First try deleting folder3 -- folder1 and folder2 paths should still exist
  root.propagateDelete(folder3, true, null);

  do_check_true(path1.exists());
  do_check_true(path2.exists());
  do_check_false(path3.exists());

  root.propagateDelete(folder, true, null);

  do_check_false(path1.exists());
  do_check_false(path2.exists());
}
