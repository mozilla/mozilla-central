/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that the main menu will NOT be collapsed by default if Thunderbird
 * starts with no accounts created, and mail.main_menu.collapse_by_default set
 * to false.
 */

let MODULE_NAME = "test-override-main-menu-collapse";
let RELATIVE_ROOT = "../shared-modules";
let MODULE_REQUIRES = ["folder-display-helpers"];

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
}

function test_main_menu_not_collapsed() {
  let mainMenu = mc.e("mail-toolbar-menubar2");
  assert_false(mainMenu.hasAttribute("autohide"),
               "The main menu should not have the autohide attribute.");
}
test_main_menu_not_collapsed.EXCLUDED_PLATFORMS = ["Darwin"];
