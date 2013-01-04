/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "test-mail-account-setup-wizard";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                         "account-manager-helpers", "keyboard-helpers" ];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var account, incoming, outgoing;

var user = {
  name: "Yamato Nadeshiko",
  email: "yamato.nadeshiko@example.com",
  password: "abc12345",
  incomingHost: "testin.example.com",
  outgoingHost: "testout.example.com",
};

function setupModule(module) {
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("account-manager-helpers").installInto(module);
  collector.getModule("keyboard-helpers").installInto(module);

  try {
    let userInfo = Cc["@mozilla.org/userinfo;1"].getService(Ci.nsIUserInfo);
    user.name = userInfo.fullname;
  } catch(e) {
     // nsIUserInfo may not be implemented on all platforms, and name might
     // not be avaialble even if it is.
  }
}

// Select File > New > Mail Account to open the Mail Account Setup Wizard
function open_mail_account_setup_wizard(k) {
  plan_for_modal_dialog("mail:autoconfig", k);
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newMailAccountMenuItem));
  return wait_for_modal_dialog("mail:autoconfig");
}

// Remove an account on the Account Manager
function remove_account(amc) {
  let win = amc.window;

  try {
    // Remove the account and incoming server
    let serverId = incoming.serverURI;
    MailServices.accounts.removeAccount(account);
    if (serverId in win.accountArray)
      delete win.accountArray[serverId];
    win.selectServer(null, null);

    // Remove the outgoing server
    MailServices.smtp.deleteSmtpServer(outgoing);
    win.replaceWithDefaultSmtpServer(outgoing.key);
  } catch (ex) {
    throw new Error("failure to remove account: " + ex + "\n");
  }
}

function test_mail_account_setup() {
  // Set the pref to load a local autoconfig file.
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  Services.prefs.setCharPref(pref_name, url);

  // Force .com MIME-Type to text/xml
  collector.httpd.registerContentType("com", "text/xml");

  open_mail_account_setup_wizard(function (awc) {
    // Input user's account information
    awc.e("realname").focus();
    if (!awc.e("realname").value) {
       // Realname is likely already filled, if not, fill it now.
      input_value(awc, user.name); 
    }
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.email);
    awc.keypress(null, "VK_TAB", {});
    input_value(awc, user.password);

    // Load the autoconfig file from http://localhost:433**/autoconfig/example.com
    awc.e("next_button").click();

    let config = null;

    // XXX: This should probably use a notification, once we fix bug 561143.
    awc.waitFor(function () (awc.window.gEmailConfigWizard._currentConfig != null),
                "Timeout waiting for current config to become non-null",
                8000, 600);
    config = awc.window.gEmailConfigWizard.getConcreteConfig();

    // Open the advanced settings (Account Manager) to create the account
    // immediately.  We use an invalid email/password so the setup will fail
    // anyway.
    open_advanced_settings_from_account_wizard(subtest_verify_account, awc);

    // Clean up
    Services.prefs.clearUserPref(pref_name);
  });
}

function subtest_verify_account(amc) {
  amc.waitFor(function () (amc.window.currentAccount != null),
              "Timeout waiting for currentAccount to become non-null");
  account = amc.window.currentAccount;
  let identity = account.defaultIdentity;
  incoming = account.incomingServer;
  outgoing = MailServices.smtp.getServerByKey(identity.smtpServerKey);

  let config = {
    "incoming server username": {
      actual: incoming.username, expected: user.email.split("@")[0]
    },
    "outgoing server username": {
      actual: outgoing.username, expected: user.email.split("@")[0]
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

  try {
    for (let i in config) {
      if (config[i].actual != config[i].expected) {
        throw new Error("Configured " + i + " is " + config[i].actual +
                        ". It should be " + config[i].expected + ".");
      }
    }
  } finally {
    remove_account(amc);
  }
}

/**
 * Make sure that we don't re-set the information we get from the config
 * file if the password is incorrect.
 */
function test_bad_password_uses_old_settings() {
  // Set the pref to load a local autoconfig file.
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  Services.prefs.setCharPref(pref_name, url);

  // Force .com MIME-Type to text/xml
  collector.httpd.registerContentType("com", "text/xml");

  mc.sleep(0);
  open_mail_account_setup_wizard(function (awc) {
    try {
      // Input user's account information
      awc.e("realname").focus();
      if (!awc.e("realname").value) {
         // Realname is likely already filled, if not, fill it now.
        input_value(awc, user.name); 
      }
      awc.keypress(null, "VK_TAB", {});
      input_value(awc, user.email);
      awc.keypress(null, "VK_TAB", {});
      input_value(awc, user.password);

      // Load the autoconfig file from http://localhost:433**/autoconfig/example.com
      awc.e("next_button").click();

      let config = null;

      awc.waitFor(function () (this.disabled == false && this.hidden == false),
                  "Timeout waiting for create button to be visible and active",
                  8000, 600, awc.e("create_button"));
      awc.e("create_button").click();

      awc.waitFor(function () (this.disabled == false),
                  "Timeout waiting for create button to be visible and active",
                  8000, 600, awc.e("create_button"));
      awc.e("create_button").click();
      awc.e("manual-edit_button").click();

      // Make sure all the values are the same as in the user object.
      awc.sleep(1000);
      assert_equals(awc.e("outgoing_hostname").value, user.outgoingHost,
                    "Outgoing server changed!");
      assert_equals(awc.e("incoming_hostname").value, user.incomingHost,
                    "incoming server changed!");
    } finally {
      // Clean up
      Services.prefs.clearUserPref(pref_name);
      awc.e("cancel_button").click();
    }
  });
}

function test_remember_password() {
  remember_password_test(true);
  remember_password_test(false);
}

/**
 * Test remember_password checkbox behavior with
 * signon.rememberSignons set to "aPrefValue"
 */
function remember_password_test(aPrefValue) {
  // save the pref for backup purpose
  let rememberSignons_pref_save =
      Services.prefs.getBoolPref("signon.rememberSignons", true);

  Services.prefs.setBoolPref("signon.rememberSignons", aPrefValue);

  // without this, it breaks the test, don't know why
  mc.sleep(0);
  open_mail_account_setup_wizard(function (awc) {
    try {
      let password = new elementslib.ID(awc.window.document, "password");
      let rememberPassword =
          new elementslib.ID(awc.window.document, "remember_password");

      // type something in the password field
      awc.e("password").focus();
      input_value(awc, "testing");

      awc.assertProperty(rememberPassword, "disabled", !aPrefValue);
      if (aPrefValue) {
        awc.assertChecked(rememberPassword);
      }
      else {
        awc.assertNotChecked(rememberPassword);
      }

      // empty the password field
      awc.keypress(password, 'a', {accelKey: true});
      awc.keypress(password, 'VK_DELETE', {});

      // restore the saved signon.rememberSignons value
      Services.prefs.setBoolPref("signon.rememberSignons", rememberSignons_pref_save);
    } finally {
      // close the wizard
      awc.e("cancel_button").click();
    }
  });
}

