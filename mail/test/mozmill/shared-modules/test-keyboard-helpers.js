/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "keyboard-helpers";

const RELATIVE_ROOT = "../shared-modules";
// we need this for the main controller
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);

var wh, fdh, mc;

function setupModule() {
  fdh = collector.getModule('folder-display-helpers');
  mc = fdh.mc;
  wh = collector.getModule('window-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.input_value = input_value;
  module.delete_existing = delete_existing;
}

/**
 * Emulates manual input
 *
 * @param aController The window controller to input keypresses into
 * @param aStr        The string to input into the control element
 * @param aElement    (optional) Element on which to perform the input
 */
function input_value(aController, aStr, aElement) {
  for (let i = 0; i < aStr.length; i++)
    aController.keypress(aElement || null, aStr.charAt(i), {});
}

/**
 * Emulates deleting strings via the keyboard
 *
 * @param aController The window controller to input keypresses into
 * @param aElement    The element in which to delete characters
 * @param aNumber     The number of times to press the delete key.
 */
function delete_existing(aController, aElement, aNumber) {
  for (let i = 0; i < aNumber; ++i)
    aController.keypress(aElement, 'VK_BACK_SPACE', {});
}

/**
 * Emulates deleting the entire string by pressing Ctrl-A and DEL
 *
 * @param aController The window controller to input keypresses into
 * @param aElement    The element in which to delete characters
 */
function delete_all_existing(aController, aElement) {
  aController.keypress(aElement, 'a', {accelKey: true});
  aController.keypress(aElement, 'VK_DELETE', {});
}
