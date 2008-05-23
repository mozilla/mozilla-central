/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for account manager functions.
 */

function getCount(enumerator)
{
  var count = 0;

  while (enumerator.hasMoreElements()) {
    var rubbish = enumerator.getNext();
    ++count;
  }

  return count;
}

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

  // Get the current number of folders
  var numSubFolders = getCount(root.subFolders);

  root.createSubfolder("folder1", null);

  do_check_eq(getCount(root.subFolders), numSubFolders + 1);
}
