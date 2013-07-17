/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "search-window-helpers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);

var folderDisplayHelper;
var mc;
var windowHelper;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  windowHelper = collector.getModule('window-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_search_window = open_search_window;
  module.open_search_window_from_context_menu =
    open_search_window_from_context_menu;
  module.close_search_window = close_search_window;
  module.assert_search_window_folder_displayed =
    assert_search_window_folder_displayed;
}

/**
 * Open a search window using the accel-shift-f shortcut.
 *
 * @returns the controller for the search window
 */
function open_search_window() {
  windowHelper.plan_for_new_window("mailnews:search");
  mc.keypress(null, "f", {shiftKey: true, accelKey: true});
  return windowHelper.wait_for_new_window("mailnews:search");
}

/**
 * Open a search window as if from the context menu. This needs the context menu
 * to be already open.
 *
 * @param aFolder the folder to open the search window for
 * @returns the controller for the search window
 */
function open_search_window_from_context_menu(aFolder) {
  folderDisplayHelper.right_click_on_folder(aFolder);

  windowHelper.plan_for_new_window("mailnews:search");
  mc.folderTreeController.searchMessages();
  let swc = windowHelper.wait_for_new_window("mailnews:search");

  folderDisplayHelper.close_popup(mc, mc.eid("folderPaneContext"));

  return swc;
}

/**
 * Close a search window by calling window.close() on the controller.
 */
function close_search_window(aController) {
  windowHelper.close_window(aController);
}

/**
 * Assert that the given folder is selected in the search window corresponding
 * to the given controller.
 */
function assert_search_window_folder_displayed(aController, aFolder) {
  let currentFolder = aController.currentFolder;
  if (currentFolder != aFolder)
    throw new Error("The search window's selected folder should have been: " +
                    aFolder.prettiestName + ", but is actually: " +
                    currentFolder.prettiestName);
}
