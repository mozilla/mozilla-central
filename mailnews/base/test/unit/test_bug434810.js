/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 
// Test of setup of localMailFolders

Components.utils.import("resource://gre/modules/Services.jsm");

function run_test()
{
  localAccountUtils.loadLocalMailAccount();

  var rootFolder = localAccountUtils.incomingServer.rootFolder;

  var msgProps = Services.strings.createBundle("chrome://messenger/locale/messenger.properties");

  var expectedFolders = [ "Inbox" ]; // Inbox hard-coded in localAccountUtils.js

  // These two MailNews adds by default
  expectedFolders.push(msgProps.GetStringFromName("outboxFolderName"));
  expectedFolders.push(msgProps.GetStringFromName("trashFolderName"));

  do_check_eq(rootFolder.numSubFolders, expectedFolders.length);
  for (var i = 0; i < expectedFolders.length; ++i)
    do_check_true(rootFolder.containsChildNamed(expectedFolders[i]));
  do_check_true(rootFolder.isAncestorOf(localAccountUtils.inboxFolder));
}
