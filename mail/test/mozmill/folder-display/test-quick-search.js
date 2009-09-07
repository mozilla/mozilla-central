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
 *   Andrew Sutherland <asutherland@asutherland.org>
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

var MODULE_NAME = 'test-quick-search';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;
var setFoo, setBar;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("QuickSearch");
  [setFoo, setBar] =
    make_new_sets_in_folder(folder, [{subject: "foo", count: 1},
                                     {subject: "bar", count: 1}]);
}

/**
 *
 */
function test_save_quick_search() {
  be_in_folder(folder);

  // - Type something in the quick search box.
  mc.type(mc.eid("searchInput"), "foo");
  mc.keypress(mc.eid("searchInput"), "VK_RETURN", {});
  wait_for_all_messages_to_load();

  // - Click the "Save Search as a Folder" button
  // This will create a virtual folder properties dialog...
  // (label: "New Saved Search Folder", source: virtualFolderProperties.xul
  //  no windowtype, id: "virtualFolderPropertiesDialog")
  plan_for_modal_dialog("mailnews:virtualFolderProperties",
                        subtest_save_search);
  mc.click(mc.eid("quickSearchSaveAsVirtualFolder"));
  wait_for_modal_dialog("mailnews:virtualFolderProperties");
}

/**
 * Save the search, making sure that the "subject OR from" constraints are
 *  there.
 */
function subtest_save_search(savc) {
  // - make sure our constraint propagated
  // this should be an "OR" constraint
  savc.assertValue(savc.eid("booleanAndGroup"), "or");

  // first constraint is on "Subject"=0 and should be "foo"
  let searchAttr0 = savc.eid("searchAttr0");
  savc.assertNode(searchAttr0);
  savc.assertValue(searchAttr0, "0");

  let searchVal0 = savc.aid("searchVal0", {crazyDeck: 0});
  savc.assertNode(searchVal0);
  savc.assertValue(searchVal0, "foo");

  // second constraint is on "From"=1 and should be "foo" as well
  let searchAttr1 = savc.eid("searchAttr1");
  savc.assertNode(searchAttr1);
  savc.assertValue(searchAttr1, "1");

  let searchVal1 = savc.aid("searchVal1", {crazyDeck: 0});
  savc.assertNode(searchVal1);
  savc.assertValue(searchVal1, "foo");

  // - Make sure the name mangling is as expected
  savc.assertValue(savc.eid("name"), "QuickSearch-foo");

  // - save it!
  // this will close the dialog, which wait_for_modal_dialog is making sure
  //  happens.
  savc.window.onOK();
}

/**
 * Make sure the folder showed up with the right name, and that displaying it
 *  has the right contents.
 */
function test_verify_saved_search() {
  let savedFolder = folder.findSubFolder("QuickSearch-foo");
  if (savedFolder == null)
    throw new Error("Saved folder did not show up.");

  be_in_folder(savedFolder);
  assert_messages_in_view(setFoo);
}
