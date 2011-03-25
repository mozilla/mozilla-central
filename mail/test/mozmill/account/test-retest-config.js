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
var MODULE_REQUIRES = ["window-helpers", "folder-display-helpers"];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

Components.utils.import("resource://gre/modules/Services.jsm");

var wh, account, incoming, outgoing;

var url = collector.addHttpResource('../account/html', 'accountconfig');
collector.httpd.registerContentType("invalid", "text/xml");

var user = {
  name: "test",
  email: "test@momo.invalid",
  altEmail: "test2@momo.invalid"
};

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  wh = collector.getModule("window-helpers");
  wh.installInto(module);
  var kh = collector.getModule("keyboard-helpers");
  kh.installInto(module);
  Services.prefs.setCharPref("mail.wizard.logging.dump", "All");
  Services.prefs.setCharPref("mailnews.auto_config_url", url);
}

// Select File > New > Mail Account to open the Mail Account Setup Wizard
function open_mail_account_setup_wizard(k) {
  wh.plan_for_modal_dialog("mail:autoconfig", k);
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newMailAccountMenuItem));
  return wh.wait_for_modal_dialog("mail:autoconfig", 30000);
}

function test_re_test_config() {
  open_mail_account_setup_wizard(function (awc) {
    // Input user's account information
    awc.e("realname").focus();
    input_value(awc, user.name);
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.email);

    // Click "continue" button
    awc.e("next_button").click();

    // Wait for 'edit' button to be enabled
    awc.waitForEval("subject.disabled == false && subject.hidden == false",
                    8000, 600, awc.e("create_button"));

    awc.e("manual-edit_button").click();

    // Click "re-test" button
    awc.e("half-manual-test_button").click();

    awc.waitForEval("subject.disabled == false", 20000, 600,
                    awc.e("half-manual-test_button"));

    // There used to be a "start over" button (line commented out below). Now just
    // changing the value of the email field does the trick.
    awc.e("realname").focus();
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.altEmail);
    awc.keypress(null, "VK_TAB", {});

    // Wait for the "continue" button to be back, which means we're back to the
    // original state.
    awc.waitForEval("subject.hidden == false", 20000, 600,
                    awc.e("next_button"));

    awc.e("next_button").click();

    // Previously, we'd switched to the manual editing state. Now we've started
    // over, we should make sure the information is presented back in its original
    // "automatic" mode.
    assert_true(!awc.e("manual-edit_button").hidden,
      "We're not back to the original state!");
    assert_true(awc.e("advanced-setup_button").hidden,
      "We're not back to the original state!");

    wh.close_window(awc);
  });
}

