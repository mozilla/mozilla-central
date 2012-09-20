/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that the main menu will be collapsed by default if Thunderbird starts
 * with no accounts created.
 */

let MODULE_NAME = "test-main-menu-collapsed";
let RELATIVE_ROOT = "../shared-modules";
let MODULE_REQUIRES = ["folder-display-helpers"];

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
}

function test_main_menu_collapsed() {
  let mainMenu = mc.e("mail-toolbar-menubar2");
  assert_equals(mainMenu.getAttribute("autohide"), "true",
                "The main menu should have the autohide attribute set to true.");
}
test_main_menu_collapsed.EXCLUDED_PLATFORMS = ["Darwin"];
