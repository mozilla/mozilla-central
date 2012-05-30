/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test reload of saved searches over local folders after compaction
 * of local folders.
 */

var MODULE_NAME = 'test-vf-load-after-compact';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderInbox, folderVirtual;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
}

/**
 * Add some messages to a folder, delete the first one, and create a saved
 * search over the inbox and the folder. Then, compact folders.
 */
function test_setup_virtual_folder_and_compact() {
  otherFolder = create_folder("otherFolder");
  let [msgSet] = make_new_sets_in_folder(otherFolder, [{count: 2}]);

  /**
   * We delete the first message in the local folder, so compaction of the
   * folder will invalidate the key of the second message in the folder. Then,
   * we select the second message and issue the compact. This causes saving the
   * selection on the compaction notification to fail. We test the saved search
   * view still gets rebuilt, such that there is a valid msg hdr at row 0.
   */
  be_in_folder(otherFolder);
  let curMessage = select_click_row(0);
  press_delete();

  folderVirtual = create_virtual_folder([inboxFolder, otherFolder], {},
                                        true, "SavedSearch");

  be_in_folder(folderVirtual);
  curMessage = select_click_row(0);
  let urlListener = {
    compactDone: false,

    OnStartRunningUrl: function (aUrl) {
    },
    OnStopRunningUrl: function (aUrl, aExitCode) {
      this.compactDone = true;
    }
  };
  if (otherFolder.msgStore.supportsCompaction) {
    otherFolder.compactAll(urlListener, null, false);

    mc.waitFor(function () urlListener.compactDone,
               "Timeout waiting for compact to complete", 10000, 100);
  }
  // Let the event queue clear.
  mc.sleep(0);
  // Check view is still valid
  let msgHdr = mc.dbView.getMsgHdrAt(0);
}

