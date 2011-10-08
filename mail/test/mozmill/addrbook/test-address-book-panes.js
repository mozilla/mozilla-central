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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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
    throw new Error(paneId+" pane should be " +
                    (visible ? "visible" : "hidden"));

  abController.window.InitViewLayoutMenuPopup();
  if ((abController.e(menuitemId).getAttribute("checked") == "true") != visible)
    throw new Error(menuitemId+" menuitem should be " +
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
