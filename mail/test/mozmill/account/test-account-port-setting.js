/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

var MODULE_NAME = "test-account-port-setting";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers", "keyboard-helpers" ];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

// This test expects the first account to be a POP account with port number 110
// and no security
const PORT_NUMBERS_TO_TEST =
  [
    "110", // The original port number. We don't input this though.
    "456", // Random port number.
    "995", // The SSL port number.
    "110"  // Back to the original.
  ];

var gTestNumber;

/**
 * Click the specified tree cell
 *
 * @param {MozMillController} controller
 *        MozMillController of the browser window to operate on
 * @param {tree} tree
 *        Tree to operate on
 * @param {number } rowIndex
 *        Index of the row
 * @param {number} columnIndex
 *        Index of the column
 * @param {object} eventDetails
 *        Details about the mouse event
 */
function clickTreeCell(controller, tree, rowIndex, columnIndex, eventDetails)
{
  var selection = tree.view.selection;
  selection.select(rowIndex);
  tree.treeBoxObject.ensureRowIsVisible(rowIndex);

  // get cell coordinates
  var x = {}, y = {}, width = {}, height = {};
  var column = tree.columns[columnIndex];
  tree.treeBoxObject.getCoordsForCellItem(rowIndex, column, "text",
                                           x, y, width, height);

  controller.sleep(0);
  EventUtils.synthesizeMouse(tree.body, x.value + 4, y.value + 4,
                             eventDetails, tree.ownerDocument.defaultView);
  controller.sleep(0);
}

function subtest_check_set_port_number(amc, aDontSet) {
  amc.waitForEval("subject.currentAccount != null", 6000, 600, amc.window);

  clickTreeCell(amc, amc.window.document.getElementById("accounttree"),
                1, 0, {});

  amc.waitForEval("subject.pendingAccount == null", 6000, 600, amc.window);

  let iframe = amc.window.document.getElementById("contentFrame");
  let portElem = iframe.contentDocument.getElementById("server.port");
  portElem.focus();

  if (portElem.value != PORT_NUMBERS_TO_TEST[gTestNumber - 1])
    throw new Error("Port Value is not " +
                    PORT_NUMBERS_TO_TEST[gTestNumber - 1] +
                    " as expected, it is: " + portElem.value);

  if (!aDontSet) {
    delete_existing(amc, new elib.Elem(portElem), 3);
    input_value(amc, PORT_NUMBERS_TO_TEST[gTestNumber]);

    mc.sleep(0);
  }

  amc.window.document.getElementById("accountManager").acceptDialog();
}

function subtest_check_port_number(amc) {
  subtest_check_set_port_number(amc, true);
}

function setupModule(module) {
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);
  let kh = collector.getModule("keyboard-helpers");
  kh.installInto(module);
}

function test_account_port_setting() {
  for (gTestNumber = 1; gTestNumber < PORT_NUMBERS_TO_TEST.length; ++gTestNumber) {
    open_advanced_settings(subtest_check_set_port_number);
  }

  open_advanced_settings(subtest_check_port_number);
}
