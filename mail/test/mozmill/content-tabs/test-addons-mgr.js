/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-addons-pane';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
};

function test_open_addons_with_url() {
  mc.window.openAddonsMgr('addons://list/theme');
  mc.sleep(0);

  let tab = mc.tabmail.currentTabInfo;
  wait_for_content_tab_load(tab, 'about:addons');
  assert_true(content_tab_e(tab, 'category-theme').selected,
              "Themes category should be selected!");

  mc.tabmail.switchToTab(0); // switch to 3pane

  mc.window.openAddonsMgr('addons://list/plugin');
  mc.sleep(0);

  tab = mc.tabmail.currentTabInfo;
  wait_for_content_tab_load(tab, 'about:addons');
  assert_true(content_tab_e(tab, 'category-plugin').selected,
              "Plugins category should be selected!");
}
