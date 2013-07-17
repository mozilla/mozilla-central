/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "account-manager-helpers";

const RELATIVE_ROOT = "../shared-modules";
// we need this for the main controller
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

var wh, fdh, mc;

function setupModule() {
  fdh = collector.getModule('folder-display-helpers');
  mc = fdh.mc;
  wh = collector.getModule('window-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_advanced_settings = open_advanced_settings;
  module.open_advanced_settings_from_account_wizard =
    open_advanced_settings_from_account_wizard;
  module.click_account_tree_row = click_account_tree_row;
  module.get_account_tree_row = get_account_tree_row;
}

/**
 * Opens the Account Manager.
 *
 * @param callback Callback for the modal dialog that is opened.
 */
function open_advanced_settings(aCallback, aController) {
  if (aController === undefined)
    aController = mc;

  wh.plan_for_modal_dialog("mailnews:accountmanager", aCallback);
  aController.click(mc.eid("menu_accountmgr"));
  return wh.wait_for_modal_dialog("mailnews:accountmanager");
}

/**
 * Opens the Account Manager from the mail account setup wizard.
 *
 * @param callback Callback for the modal dialog that is opened.
 */
function open_advanced_settings_from_account_wizard(aCallback, aController) {
  wh.plan_for_modal_dialog("mailnews:accountmanager", aCallback);
  aController.e("manual-edit_button").click();
  aController.e("advanced-setup_button").click();
  return wh.wait_for_modal_dialog("mailnews:accountmanager");
}

/**
 * Click a row in the account settings tree
 *
 * @param controller the Mozmill controller for the account settings dialog
 * @param rowIndex the row to click
 */
function click_account_tree_row(controller, rowIndex) {
  utils.waitFor(function () controller.window.currentAccount != null,
                "Timeout waiting for currentAccount to become non-null");

  let tree = controller.window.document.getElementById("accounttree");

  if (rowIndex < 0 || rowIndex >= tree.view.rowCount)
    throw new Error("Row " + rowIndex + " does not exist in the account tree!");

  let selection = tree.view.selection;
  selection.select(rowIndex);
  tree.treeBoxObject.ensureRowIsVisible(rowIndex);

  // get cell coordinates
  var x = {}, y = {}, width = {}, height = {};
  var column = tree.columns[0];
  tree.treeBoxObject.getCoordsForCellItem(rowIndex, column, "text",
                                           x, y, width, height);

  controller.sleep(0);
  EventUtils.synthesizeMouse(tree.body, x.value + 4, y.value + 4,
                             {}, tree.ownerDocument.defaultView);
  controller.sleep(0);

  utils.waitFor(function () controller.window.pendingAccount == null,
                "Timeout waiting for pendingAccount to become null");

  // Ensure the page is fully loaded (e.g. onInit functions).
  wh.wait_for_frame_load(controller.e("contentFrame"),
    controller.window.pageURL(tree.contentView.getItemAtIndex(rowIndex)
                                              .getAttribute("PageTag")));
}

/**
 * Returns the index of the row in account tree corresponding to the wanted
 * account and its settings pane.
 *
 * @param aAccountKey  The key of the account to return.
 *                     If 'null', the SMTP pane is returned.
 * @param aPaneId      The ID of the account settings pane to select.
 *
 * @return  The row index of the account and pane. If it was not found return -1.
 *          Do not throw as callers may intentionally just check if a row exists.
 *          Just dump into the log so that a subsequent throw in
 *          click_account_tree_row has a useful context.
 */
function get_account_tree_row(aAccountKey, aPaneId, aController) {
  let rowIndex = 0;
  let accountTreeNode = aController.e("account-tree-children");

  for (let i = 0; i < accountTreeNode.childNodes.length; i++) {
    if ("_account" in accountTreeNode.childNodes[i]) {
      let accountHead = accountTreeNode.childNodes[i];
      if (aAccountKey == accountHead._account.key) {
        // If this is the wanted account, find the wanted settings pane.
        let accountBlock = accountHead.querySelectorAll("[PageTag]");
        // A null aPaneId means the main pane.
        if (!aPaneId)
          return rowIndex;

        // Otherwise find the pane in the children.
        for (let j = 0; j < accountBlock.length; j++) {
          if (accountBlock[j].getAttribute("PageTag") == aPaneId)
            return rowIndex + j + 1;
        }

        // The pane was not found.
        dump("The treerow for pane " + aPaneId + " of account " + aAccountKey + " was not found!\n");
        return -1;
      }
      // If this is not the wanted account, skip all of its settings panes.
      rowIndex += accountHead.querySelectorAll("[PageTag]").length;
    } else {
      // A row without _account should be the SMTP server.
      if (aAccountKey == null)
        return rowIndex;
    }
    rowIndex++;
  }

  // The account was not found.
  dump("The treerow for account " + aAccountKey + " was not found!\n");
  return -1;
}
