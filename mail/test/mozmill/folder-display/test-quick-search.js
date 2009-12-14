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
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'search-window-helpers'];

Cu.import("resource://app/modules/quickSearchManager.js");

var folder;
var setFoo, setBar;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let sh = collector.getModule('search-window-helpers');
  sh.installInto(module);

  folder = create_folder("QuickSearch");
  [setFoo, setBar] =
    make_new_sets_in_folder(folder, [{subject: "foo", count: 1},
                                     {subject: "bar", count: 1}]);
}

function _assert_quick_search_mode(aController, aMode)
{
  let searchInput = aController.e("searchInput");
  let actualMode = searchInput.searchMode;
  if (actualMode != aMode)
    throw new Error("The search mode is supposed to be " + aMode +
                    ", but is actually " + actualMode);

  // Check whether the menupopup has the correct value selected
  let menupopupMode = searchInput.menupopup.getAttribute("value");
  if (menupopupMode != aMode)
    throw new Error("The search menupopup's mode is supposed to be " + aMode +
                    ", but is actually " + menupopupMode);

  // Also check the empty text
  let expectedEmptyText = searchInput.menupopup.getElementsByAttribute("value",
                              aMode)[0].getAttribute("label");
  if (expectedEmptyText != searchInput.emptyText)
    throw new Error("The search empty text is supposed to be " +
                    expectedEmptyText + ", but is actually " +
                    searchInput.emptyText);
}

function _open_3pane_window()
{
  let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                        .getService(Ci.nsIWindowWatcher);
  windowWatcher.openWindow(null,
      "chrome://messenger/content/", "",
      "all,chrome,dialog=no,status,toolbar", null);
}

/**
 *
 */
function test_save_quick_search() {
  be_in_folder(folder);

  // - We want to do a from or subject search
  mc.e("searchInput").searchMode =
    QuickSearchConstants.kQuickSearchFromOrSubject.toString();

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
  mc.e("searchInput").saveAsVirtualFolder.doCommand();
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

/**
 * Test that when a new 3-pane window is opened from the original 3-pane, the
 * search mode is persisted.
 */
function test_search_mode_persistence_new_3pane_from_original_3pane()
{
  plan_for_new_window("mail:3pane");
  mc.window.MsgOpenNewWindowForFolder(null, -1);
  let mc2 = wait_for_new_window("mail:3pane");

  _assert_quick_search_mode(mc2,
      QuickSearchConstants.kQuickSearchFromOrSubject.toString());

  mc2.window.close();
}

/**
 * Test that the window.close() above doesn't cause session persistence to come
 * into play -- i.e. if we now change the search mode and open a window again,
 * the new window has the new search mode and not the old one.
 */
function test_search_mode_persistence_new_3pane_from_original_3pane_again()
{
  mc.e("searchInput").searchMode =
    QuickSearchConstants.kQuickSearchBody.toString();
  plan_for_new_window("mail:3pane");
  mc.window.MsgOpenNewWindowForFolder(null, -1);
  let mc2 = wait_for_new_window("mail:3pane");

  _assert_quick_search_mode(mc2,
      QuickSearchConstants.kQuickSearchBody.toString());

  mc2.window.close();
}

/**
 * Test that when a new 3-pane window is opened independently of the original
 * 3-pane, the search mode is persisted from the original 3-pane.
 */
function test_search_mode_persistence_new_3pane_independently()
{
  mc.e("searchInput").searchMode =
    QuickSearchConstants.kQuickSearchFromOrSubject.toString();
  plan_for_new_window("mail:3pane");
  _open_3pane_window();
  let mc2 = wait_for_new_window("mail:3pane");

  _assert_quick_search_mode(mc2,
      QuickSearchConstants.kQuickSearchFromOrSubject.toString());

  mc2.window.close();
}

/**
 * Test that the window.close() above doesn't cause session persistence to come
 * into play -- i.e. if we now change the search mode and open a window again,
 * the new window has the new search mode and not the old one.
 */
function test_search_mode_persistence_new_3pane_independently_again()
{
  mc.e("searchInput").searchMode =
    QuickSearchConstants.kQuickSearchBody.toString();
  plan_for_new_window("mail:3pane");
  _open_3pane_window();
  let mc2 = wait_for_new_window("mail:3pane");

  _assert_quick_search_mode(mc2,
      QuickSearchConstants.kQuickSearchBody.toString());

  mc2.window.close();
}

/**
 * Test that persistence works properly if the "Subject, To or Cc" filter is
 * selected.
 */
function test_search_mode_persistence_subject_to_cc_filter()
{
  mc.e("searchInput").searchMode =
    QuickSearchConstants.kQuickSearchRecipientOrSubject.toString();

  // Make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed.
  let swc = open_search_window();

  plan_for_window_close(mc);
  mc.window.close();
  wait_for_window_close();

  plan_for_new_window("mail:3pane");
  _open_3pane_window();
  mc = mainController = wait_for_new_window("mail:3pane");

  // We don't need the search window any more
  plan_for_window_close(swc);
  swc.window.close();
  wait_for_window_close();

  _assert_quick_search_mode(mc,
      QuickSearchConstants.kQuickSearchRecipientOrSubject.toString());
}
