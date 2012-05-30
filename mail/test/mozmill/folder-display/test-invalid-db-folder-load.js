/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that clicking on a folder with an invalid or missing .msf file
 * regenerates the.msf file and loads the view.
 * Also, check that rebuilding the index on a loaded folder reloads the folder.
 */

var MODULE_NAME = 'test-invalid-db-folder-load';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;
var setA;
var curMessage;

var nsMsgViewSortType = Components.interfaces.nsMsgViewSortType;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("InvalidMSF");
  [setA] = make_new_sets_in_folder(folder, [{count: 3}]);
}

/**
 *
 */
function test_load_folder_with_invalidDB() {
  folder.msgDatabase.dBFolderInfo.sortType = nsMsgViewSortType.bySubject;
  folder.msgDatabase.summaryValid = false;
  folder.msgDatabase.ForceClosed();
  folder.msgDatabase = null;
  dump("entering invalidmsf folder\n");
  be_in_folder(folder);

  assert_messages_in_view(setA);
  curMessage = select_click_row(0);
  assert_selected_and_displayed(curMessage);
}

function test_view_sort_maintained() {
  if (mc.dbView.sortType != nsMsgViewSortType.bySubject)
      throw new Error("view sort type not restored from invalid db");
}

