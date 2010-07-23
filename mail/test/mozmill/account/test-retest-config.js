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
 *   Brian Lu <brian.lu@sun.com>
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

var MODULE_NAME = "test-retest-config";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["window-helpers"];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var wh, mc, awc, account, incoming, outgoing;

var user = {
  name: "test",
  email: "test@yahoo.com"
};

function setupModule(module) {
  wh = collector.getModule("window-helpers");
  mc = wh.wait_for_existing_window("mail:3pane");
  wh.installInto(module);
}

// Select File > New > Mail Account to open the Mail Account Setup Wizard
function open_mail_account_setup_wizard() {
  wh.plan_for_new_window("mail:autoconfig");
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newMailAccountMenuItem));
  return wh.wait_for_new_window("mail:autoconfig");
}

function teardownTest() {
  wh.close_window(awc);
}

// Emulate manual input
function input_value(str) {
  for (let i = 0; i < str.length; i++)
    awc.keypress(null, str.charAt(i), {});
}

function test_re_test_config() {

  awc = open_mail_account_setup_wizard();

  // Input user's account information
  awc.e("realname").focus();
  input_value(user.name);
  awc.keypress(null, "VK_TAB", {});
  input_value(user.email);

  // Click "continue" button
  awc.e("next_button").click();

  // Wait for 'edit' button to be enabled
  awc.waitForEval("subject.hidden == false", 100000, 600,
                  awc.e("edit_button"));

  awc.e("edit_button").click();

  awc.waitForEval("subject.hidden == false", 20000, 600,
                  awc.e("go_button"));

  // Click "re-test" button
  awc.e("go_button").click();

  awc.waitForEval("subject.hidden == false", 20000, 600,
                  awc.e("stop_button"));

  // Click 'start over' button
  awc.e("back_button").click();

  awc.waitForEval("subject.hidden == false", 20000, 600,
                  awc.e("next_button"));

  awc.e("next_button").click();

  var incoming_server = awc.e("incoming_server");

  var wizard_window = awc.e("autoconfigWizard");

  var right = incoming_server.boxObject.y+incoming_server.boxObject.height;
  var bottom = incoming_server.boxObject.x+incoming_server.boxObject.width;

  if (right > wizard_window.boxObject.height ||
      bottom > wizard_window.boxObject.width)
    throw new Error("The start over button didn't collapse the window.");
}

