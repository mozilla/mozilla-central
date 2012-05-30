/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  assert_quick_filter_button_enabled(false);
}

function test_visible_by_default() {
  be_in_folder(folder);
  assert_quick_filter_button_enabled(true);
  assert_quick_filter_bar_visible(true);
}

function test_direct_toggle() {
  assert_quick_filter_bar_visible(true);
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(false);
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(true);
}

function test_control_shift_k_triggers_display() {
  // hide it
  toggle_quick_filter_bar();
  assert_quick_filter_bar_visible(false);

  // focus explicitly on the thread pane so we know where the focus is.
  mc.e("threadTree").focus();

  // hit control-shift-k
  mc.keypress(null, "k", {accelKey: true, shiftKey: true});

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
