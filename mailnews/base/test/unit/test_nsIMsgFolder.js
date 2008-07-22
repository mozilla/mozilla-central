/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgFolder functions.
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

  // Add a sub folder to ensure that we have some folders created
  root.createSubfolder("folder1", null);

  // Test - getChildNamed

  var caught = false;
  try {
    root.getChildNamed("folder");
  }
  catch (e) {
    caught = true;
  }
  do_check_eq(caught, true);

  caught = false;
  try {
    root.getChildNamed("Trash1");
  }
  catch (e) {
    caught = true;
  }
  do_check_eq(caught, true);

  var folder1 = root.getChildNamed("folder1");

  do_check_neq(folder1, folder2);
  do_check_eq(folder1.prettiestName, "folder1");

  var folder2 = root.getChildNamed("FOLDER1");

  do_check_eq(folder1, folder2);
}
