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
 *   Kohei Yoshino <kohei.yoshino@gmail.com>
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

var MODULE_NAME = "test-mail-account-setup-wizard";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers", "keyboard-helpers" ];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var wh, awc, account, incoming, outgoing;

var user = {
  name: "Yamato Nadeshiko",
  email: "yamato.nadeshiko@example.com",
  password: "abc12345",
  incomingHost: "testin.example.com",
  outgoingHost: "testout.example.com",
};

function setupModule(module) {
  wh = collector.getModule("window-helpers");
  wh.installInto(module);
  var fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  var amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);
  var kh = collector.getModule("keyboard-helpers");
  kh.installInto(module);
}

// Select File > New > Mail Account to open the Mail Account Setup Wizard
function open_mail_account_setup_wizard() {
  wh.plan_for_new_window("mail:autoconfig");
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newMailAccountMenuItem));
  return wh.wait_for_new_window("mail:autoconfig");
}

// Remove an account on the Account Manager
function remove_account(amc) {
  let win = amc.window;

  try {
    // Remove the account and incoming server
    let serverId = incoming.serverURI;
    Cc["@mozilla.org/messenger/account-manager;1"]
      .getService(Ci.nsIMsgAccountManager).removeAccount(account);
    if (serverId in win.accountArray)
      delete win.accountArray[serverId];
    win.selectServer(null, null);

    // Remove the outgoing server
    win.smtpService.deleteSmtpServer(outgoing);
    win.replaceWithDefaultSmtpServer(outgoing.key);
  } catch (ex) {
    throw new Error("failure to remove account: " + ex + "\n");
  }
}

function test_mail_account_setup() {
  // Set the pref to load a local autoconfig file.
  let pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  pref.setCharPref(pref_name, url);

  // Force .com MIME-Type to text/xml
  collector.httpd.registerContentType("com", "text/xml");

  awc = open_mail_account_setup_wizard();

  // Input user's account information
  awc.e("realname").focus();
  input_value(awc, user.name);
  awc.keypress(null, "VK_TAB", {});
  input_value(awc, user.email);
  awc.keypress(null, "VK_TAB", {});
  input_value(awc, user.password);

  // Load the autoconfig file from http://localhost:433**/autoconfig/example.com
  awc.e("next_button").click();

  let config = null;

  // XXX: This should probably use a notification, once we fix bug 561143.
  awc.waitForEval("subject._currentConfigFilledIn != null", 8000, 600,
                  awc.window.gEmailConfigWizard);
  config = awc.window.gEmailConfigWizard._currentConfigFilledIn;

  // Open the advanced settings (Account Manager) to create the account
  // immediately.  We use an invalid email/password so the setup will fail
  // anyway.
  open_advanced_settings_from_account_wizard(subtest_verify_account, awc);

  // Clean up
  pref.clearUserPref(pref_name);
}

function subtest_verify_account(amc) {
  amc.waitForEval("subject.currentAccount != null", 6000, 600, amc.window);
  account = amc.window.currentAccount;
  let identity = account.defaultIdentity;
  incoming = account.incomingServer;
  outgoing = amc.window.smtpService.getServerByKey(identity.smtpServerKey);

  let config = {
    "incoming server username": {
      actual: incoming.username, expected: user.email.split("@")[0]
    },
    "outgoing server username": {
      actual: outgoing.username, expected: user.email
    },
    "incoming server hostname": {
      // Note: N in the hostName is uppercase
      actual: incoming.hostName, expected: user.incomingHost
    },
    "outgoing server hostname": {
      // And this is lowercase
      actual: outgoing.hostname, expected: user.outgoingHost
    },
    "user real name": { actual: identity.fullName, expected: user.name },
    "user email address": { actual: identity.email, expected: user.email }
  };

  let i, has_error = false;

  for (i in config) {
    if (config[i].actual != config[i].expected) {
      has_error = true;
      break;
    }
  }

  remove_account(amc);

  if (has_error)
    throw new Error("Configured " + i + " is " + config[i].actual +
                    ". It should be " + config[i].expected + ".");
}

/**
 * Make sure that we don't re-set the information we get from the config
 * file if the password is incorrect.
 **/
function test_bad_password_uses_old_settings() {
  // Set the pref to load a local autoconfig file.
  let pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  try {
    pref.setCharPref(pref_name, url);

    // Force .com MIME-Type to text/xml
   collector.httpd.registerContentType("com", "text/xml");

    mc.sleep(0);
    awc = open_mail_account_setup_wizard();

    // Input user's account information
    awc.e("realname").focus();
    input_value(awc, user.name);
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.email);
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.password);

    // Load the autoconfig file from http://localhost:433**/autoconfig/example.com
    awc.e("next_button").click();

    let config = null;

    awc.waitForEval("subject.disabled == false", 8000, 600,
                    awc.e("create_button"));
    awc.e("create_button").click();

    awc.waitForEval("subject.disabled == false", 8000, 600,
                    awc.e("create_button"));
    awc.e("create_button").click();

    // Make sure all the values are the same as in the user object.
    awc.sleep(1000);
    assert_equals(awc.e("outgoing_server").value, user.outgoingHost,
                  "Outgoing server changed!");
    assert_equals(awc.e("incoming_server").value, user.incomingHost,
                  "incoming server changed!");
  }
  finally {
    // Clean up
    pref.clearUserPref(pref_name);
    awc.e("cancel_button").click();
  }
}

function test_remember_password() {
  remember_password_test(true);
  remember_password_test(false);
}

/* Test remember_password checkbox behavior with
 * signon.rememberSignons set to "aPrefValue"
 */
function remember_password_test(aPrefValue) {
  let pref = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefBranch);

  // save the pref for backup purpose
  let rememberSignons_pref_save =
      pref.getBoolPref("signon.rememberSignons", true);

  pref.setBoolPref("signon.rememberSignons", aPrefValue);

  // without this, it breaks the test, don't know why
  mc.sleep(0);
  awc = open_mail_account_setup_wizard();

  try {
  let password = new elementslib.ID(awc.window.document, "password");
  let rememberPassword =
      new elementslib.ID(awc.window.document, "remember_password");

  // password field is empty and the checkbox is disabled initially
  // -> uncheck checkbox

  awc.assertProperty(rememberPassword, "disabled", true);
  awc.assertNotChecked(rememberPassword);

  // type something in the password field
  awc.e("password").focus();
  input_value(awc, "testing");

  awc.assertProperty(rememberPassword, "disabled", !aPrefValue);
  if (aPrefValue) {
    // password field is not empty any more
    // -> enable and check checkbox
    awc.assertChecked(rememberPassword);
  }
  else {
    // password field is not empty any more, but aPrefValue is false
    // -> disable and uncheck checkbox
    awc.assertNotChecked(rememberPassword);
  }

  // empty the password field
  awc.keypress(password, 'a', {accelKey: true});
  awc.keypress(password, 'VK_DELETE', {});

  // password field is empty -> disable and uncheck checkbox
  awc.assertProperty(rememberPassword, "disabled", true);
  awc.assertNotChecked(rememberPassword);

  // restore the saved signon.rememberSignons value
  pref.setBoolPref("signon.rememberSignons", rememberSignons_pref_save);
  }
  finally {
    // close the wizard
    awc.e("cancel_button").click();
  }
}
