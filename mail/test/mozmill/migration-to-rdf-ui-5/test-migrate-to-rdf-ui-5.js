/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * When moving from ui-rdf 4 to 5, we ensure that we've added the App Menu
 * button to the mail toolbar, and that we've collapsed the main menu.
 */

let MODULE_NAME = "test-migrate-to-rdf-ui-5";
let RELATIVE_ROOT = "../shared-modules";
let MODULE_REQUIRES = ["folder-display-helpers"];

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
}

/**
 * Test that the App Menu button was added to the mail toolbar, and the main
 * menu is not collapsed (since this Mozmill test starts with a pre-existing
 * account).
 */
function test_appmenu_button_added() {
  const kAppMenuButton = "button-appmenu";

  // Make sure that the App Menu button is in the mail toolbar.
  let currentSet = mc.e("mail-bar3").currentSet;
  assert_not_equals(-1, currentSet.indexOf(kAppMenuButton),
                   "We didn't find the App Menu button where we should have.");

  // We also expect App Menu button at the end of the currentSet.
  let lastChars = currentSet.substring(currentSet.length - kAppMenuButton.length);
  assert_equals(lastChars, kAppMenuButton,
                "We didn't find the App Menu button at the end of the menu bar");

  // Skip the next test for OSX, since it never exposes the main menu.
  if (!mc.mozmillModule.isMac) {
    // Since we started with a pre-existing account, the main menu should
    // NOT be collapsed.
    let mainMenu = mc.e("mail-toolbar-menubar2");
    assert_false(mainMenu.hasAttribute("autohide"),
                 "The main menu should not have the autohide attribute set.");
  }
}
