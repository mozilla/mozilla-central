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
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

/*
 * Test that the message filter bar toggles into and out of existence and
 * states are updated as appropriate.
 */

var MODULE_NAME = 'test-toggle-bar';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'quick-filter-bar-helper'];

var folder;
var setUnstarred, setStarred;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let qfb = collector.getModule('quick-filter-bar-helper');
  qfb.installInto(module);

  folder = create_folder("QuickFilterBarToggleBar");
  [setUnstarred, setStarred] = make_new_sets_in_folder(folder, [
                                 {count: 1}, {count: 1}]);
  setStarred.setStarred(true);
}

function test_filter_button_hidden_on_account_central() {
  be_in_folder(folder.rootFolder);
  assert_quick_filter_button_visible(false);
}

function test_visible_by_default() {
  be_in_folder(folder);
  assert_quick_filter_button_visible(true);
  assert_quick_filter_bar_visible(true);
}

function test_direct_toggle() {
  assert_quick_filter_bar_visible(true);
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(false);
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(true);
}

function test_control_f_triggers_display() {
  // hide it
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(false);

  // focus explicitly on the thread pane so we know where the focus is.
  mc.e("threadTree").focus();

  // hit control-f
  mc.keypress(null, "f", {accelKey: true});

  // now we should be visible again!
  assert_quick_filter_bar_visible(true);
}

function test_constraints_disappear_when_collapsed() {
  // set some constraints
  toggle_boolean_constraints("starred");
  assert_constraints_expressed({starred: true});
  assert_messages_in_view(setStarred);

  // collapse, now we should see them all again!
  toggle_quick_filter_bar();
  assert_messages_in_view([setUnstarred, setStarred]);

  // uncollapse, we should still see them all!
  toggle_quick_filter_bar();
  assert_messages_in_view([setUnstarred, setStarred]);

  // there better be no constraints left!
  assert_constraints_expressed({});
}
