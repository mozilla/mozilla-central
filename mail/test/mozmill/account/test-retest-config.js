/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  // Opening multiple windows in the same run seems to require letting the stack
  // unwind before opening the next one, so do that here.
  mc.sleep(0);
  open_mail_account_setup_wizard(function (awc) {
    // Input user's account information
    awc.e("realname").focus();
    input_value(awc, user.name);
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.email);

    // Click "continue" button
    awc.e("next_button").click();

    // Wait for 'edit' button to be enabled
    awc.waitFor(function () (this.disabled == false && this.hidden == false),
                "Timeout waiting for edit button to be enabled",
                8000, 600, awc.e("create_button"));

    awc.e("manual-edit_button").click();

    // Click "re-test" button
    awc.e("half-manual-test_button").click();

    awc.waitFor(function () (this.disabled == false),
                "Timeout waiting for re-test button to be enabled",
                20000, 600, awc.e("half-manual-test_button"));

    // There used to be a "start over" button (line commented out below). Now just
    // changing the value of the email field does the trick.
    awc.e("realname").focus();
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.altEmail);
    awc.keypress(null, "VK_TAB", {});

    // Wait for the "continue" button to be back, which means we're back to the
    // original state.
    awc.waitFor(function () (this.hidden == false),
                "Timeout waiting for continue button to be visible",
                20000, 600, awc.e("next_button"));

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

