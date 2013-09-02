/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests that renaming non-ASCII name folder works.

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

setupIMAPPump();

var tests = [
  setup,
  test_rename,
];

function setup() {
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
  // Add folder listeners that will capture async events
  MailServices.mfn.addListener(mfnListener, MailServices.mfn.folderAdded);

  IMAPPump.incomingServer.rootFolder.createSubfolder("folder 1", null);
  yield false;

  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function test_rename() {
  let rootFolder = IMAPPump.incomingServer.rootFolder;
  let targetFolder = rootFolder.getChildNamed("folder 1");

  targetFolder.rename("folder \u00e1", null);

  IMAPPump.server.performTest("RENAME");
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;

  let folder = rootFolder.getChildNamed("folder \u00e1");
  do_check_true(folder.msgDatabase.summaryValid);
  do_check_eq("folder &AOE-", folder.filePath.leafName);
  do_check_eq("folder \u00e1", folder.prettyName);

  yield true;
}

var mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    // we are only using async yield on the target folder add
    if (aFolder.name == "folder 1")
      async_driver();
  },
};

function run_test()
{
  async_run_tests(tests);
}

