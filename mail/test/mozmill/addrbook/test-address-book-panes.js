/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests for the address book.
 */

var MODULE_NAME = "test-address-book-panes";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["address-book-helpers", "folder-display-helpers"];

function setupModule(module) {
  // We need this to get mc which is needed in open_address_book_window.
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let abh = collector.getModule("address-book-helpers");
  abh.installInto(module);

  // Open the address book main window
  abController = open_address_book_window();
}

function teardownModule(module) {
  // Make sure the panes are all visible now that we're
  // done these tests.
  toggle_directory_pane();
  toggle_contact_pane();

  assert_directory_pane_visibility(true);
  assert_contact_pane_visibility(true);
}

/**
 * Helper function to toggle a pane.
 *
 * @param splitterId the id of the splitter to toggle
 */
function _help_toggle_pane(splitterId) {
  abController.window.togglePaneSplitter(splitterId);
}

/**
 * Helper function to check consistency of a pane's state.
 *
 * @param paneId the id of the pane in question
 * @param menuitemId the id of the menuitem corresponding to the pane
 * @param visible true if the pane should be visible, false otherwise
 */
function _help_assert_pane_visibility(paneId, menuitemId, visible) {
  if (abController.e(paneId).collapsed == visible)
    throw new Error(paneId + " pane should be " +
                    (visible ? "visible" : "hidden"));

  abController.window.InitViewLayoutMenuPopup();
  if ((abController.e(menuitemId).getAttribute("checked") == "true") != visible)
    throw new Error(menuitemId + " menuitem should be " +
                    (visible ? "checked" : "unchecked"));

}

/**
 * Toggle the directory pane.
 */
function toggle_directory_pane() {
  _help_toggle_pane("dirTree-splitter");
}

/**
 * Toggle the contact pane.
 */
function toggle_contact_pane() {
  _help_toggle_pane("results-splitter");
}

/**
 * Check that the directory pane is visible or hidden.
 *
 * @param visible true if the pane should be visible, false otherwise
 */
function assert_directory_pane_visibility(visible) {
  _help_assert_pane_visibility("dirTreeBox", "menu_showDirectoryPane", visible);
}

/**
 * Check that the contact pane is visible or hidden.
 *
 * @param visible true if the pane should be visible, false otherwise
 */
function assert_contact_pane_visibility(visible) {
  _help_assert_pane_visibility("CardViewOuterBox", "menu_showCardPane",
                               visible);
}

function test_hide_directory_pane() {
  toggle_directory_pane();
  assert_directory_pane_visibility(false);
}

function test_show_directory_pane() {
  toggle_directory_pane();
  assert_directory_pane_visibility(true);
}

function test_hide_contact_pane() {
  toggle_contact_pane();
  assert_contact_pane_visibility(false);
}

function test_show_contact_pane() {
  toggle_contact_pane();
  assert_contact_pane_visibility(true);
}

function test_persist_panes() {
  toggle_directory_pane();
  toggle_contact_pane();

  close_address_book_window(abController);
  abController = open_address_book_window();

  assert_directory_pane_visibility(false);
  assert_contact_pane_visibility(false);
}
