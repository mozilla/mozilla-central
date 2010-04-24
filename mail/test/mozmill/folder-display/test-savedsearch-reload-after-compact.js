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
 * The Mozilla Foundation.
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
  otherFolder.compactAll(urlListener, null, false);

  mc.waitForEval("subject.compactDone == true",
                          10000, 100, urlListener);

  // Let the event queue clear.
  mc.sleep(0);
  // Check view is still valid
  let msgHdr = mc.dbView.getMsgHdrAt(0);
}

