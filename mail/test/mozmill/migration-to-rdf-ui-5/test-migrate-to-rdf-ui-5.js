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

const kAppMenuButton = "button-appmenu";

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
}

/**
 * Ensures that the button with ID aButtonID exists at the end of a
 * toolbar with ID aToolbarID.
 *
 * @param aToolbarID the ID of the toolbar to check.
 * @param aButtonID the ID of the button to look for.
 */
function assert_button_at_end_of_toolbar(aToolbarID, aButtonID) {
  let currentSet = mc.e(aToolbarID).currentSet;
  assert_not_equals(-1, currentSet.indexOf(aButtonID),
                   "We didn't find the button with ID " + aButtonID +
                   "where we should have for the toolbar with ID " +
                   aToolbarID);

  let lastChars = currentSet.substring(currentSet.length -
                                       aButtonID.length);
  assert_equals(lastChars, aButtonID,
                "We didn't find the button with ID " + aButtonID + " at the " +
                "end of the toolbar with ID " + aToolbarID);
}

/**
 * Test that the App Menu button was added to the mail toolbar, and the main
 * menu is not collapsed (since this Mozmill test starts with a pre-existing
 * account).
 */
function test_appmenu_button_added() {
  assert_button_at_end_of_toolbar("mail-bar3", "button-appmenu");
  assert_button_at_end_of_toolbar("chat-toobar", "button-chat-appmenu");
  // Skip the next test for OSX, since it never exposes the main menu.
  if (!mc.mozmillModule.isMac) {
    // Since we started with a pre-existing account, the main menu should
    // NOT be collapsed.
    let mainMenu = mc.e("mail-toolbar-menubar2");
    assert_false(mainMenu.hasAttribute("autohide"),
                 "The main menu should not have the autohide attribute set.");
  }
}
