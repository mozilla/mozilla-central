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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
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
  be_in_folder(folder);

  assert_messages_in_view(setA);
  curMessage = select_click_row(0);
  assert_selected_and_displayed(curMessage);
}

function test_view_sort_maintained() {
  if (mc.dbView.sortType != nsMsgViewSortType.bySubject)
      throw new Error("view sort type not restored from invalid db");
}

