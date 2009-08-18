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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);

const MODULE_NAME = 'search-window-helpers';

const RELATIVE_ROOT = '../shared-modules';

const MODULES_REQUIRES = ['folder-display-helpers', 'window-helpers'];

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

  folderDisplayHelper.close_popup();

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
