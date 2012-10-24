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
let MODULE_REQUIRES = ["folder-display-helpers",
                       "window-helpers"];

Cu.import("resource://gre/modules/Services.jsm");

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
}

function test_main_menu_not_collapsed() {
  // Due to random oranges on slower machines, we need to ensure that startup
  // is complete before running this test.
  let done = false;
  let observer = {
    observe: function(aSubject, aTopic, aData) {
      if (aTopic == "mail-startup-done") {
        done = true;
      }
    }
  };
  Services.obs.addObserver(observer, "mail-startup-done", false);

  // Since no accounts were set up, and the account provisoner was disabled
  // in prefs.js, the wizard will show up. Find it, and close it. This will
  // cause mail-startup-done to eventually be fired.
  let wizard = wait_for_existing_window("mail:autoconfig");
  close_window(wizard);

  // Spin the event loop until mail-startup-done is fired.
  mc.waitFor(function () done);

  let mainMenu = mc.e("mail-toolbar-menubar2");
  assert_false(mainMenu.hasAttribute("autohide"),
               "The main menu should not have the autohide attribute.");

  Services.obs.removeObserver(observer, "mail-startup-done");
}
test_main_menu_not_collapsed.EXCLUDED_PLATFORMS = ["Darwin"];
