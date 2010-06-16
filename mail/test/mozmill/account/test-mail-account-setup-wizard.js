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
var MODULE_REQUIRES = ["window-helpers"];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var wh, mc, awc, account, incoming, outgoing;

var user = {
  name: "Yamato Nadeshiko",
  email: "yamato.nadeshiko@example.com",
  password: "abc12345"
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

// Open the Account Manager from the Mail Account Setup Wizard
function open_advanced_settings() {
  wh.plan_for_modal_dialog("mailnews:accountmanager", subtest_verify_account);
  awc.e("advanced_settings").click();
  return wh.wait_for_modal_dialog("mailnews:accountmanager");
}

function close_mail_account_setup_wizard() {
  wh.close_window(awc);
}

// Emulate manual input
function input_value(str) {
  for (let i = 0; i < str.length; i++)
    awc.keypress(null, str.charAt(i), {});
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
  input_value(user.name);
  awc.keypress(null, "VK_TAB", {});
  input_value(user.email);
  awc.keypress(null, "VK_TAB", {});
  input_value(user.password);

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
  open_advanced_settings();

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
      actual: incoming.hostName, expected: "pop.example.com"
    },
    "outgoing server hostname": {
      // And this is lowercase
      actual: outgoing.hostname, expected: "smtp.example.com"
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
