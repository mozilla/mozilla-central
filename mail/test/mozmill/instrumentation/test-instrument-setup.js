/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = "test-instrument-setup";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers", "keyboard-helpers" ];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);
Components.utils.import("resource://gre/modules/Services.jsm");

var wh, awc, account, incoming, outgoing;

var user = {
  name: "Roger Sterling",
  email: "roger.sterling@example.com",
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

function test_mail_account_setup() {
  // Set the pref to load a local autoconfig file.
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  Services.prefs.setCharPref(pref_name, url);

  // Force .com MIME-Type to text/xml
  collector.httpd.registerContentType("com", "text/xml");

  // Spawn the existing mail account config dialog by clicking on
  // File > New > Existing Mail Account
  mc.click(mc.eid("newMailAccountMenuItem"));
  awc = wh.wait_for_existing_window("mail:autoconfig");

  // Input user's account information
  awc.e("realname").focus();
  input_value(awc, user.name);
  awc.keypress(null, "VK_TAB", {});
  input_value(awc, user.email);

  // Load the autoconfig file from http://localhost:433**/autoconfig/example.com
  awc.e("next_button").click();

  let config = null;

  // XXX: This should probably use a notification, once we fix bug 561143.
  awc.waitFor(function () awc.window.gEmailConfigWizard._currentConfig != null,
              "Timeout waiting for current config to become non-null",
              8000, 600);
  config = awc.window.gEmailConfigWizard._currentConfig;
  plan_for_window_close(awc);
  awc.e("create_button").click();

  let events = mc.window.mailInstrumentationManager._currentState.events;

  // Clean up
  Services.prefs.clearUserPref(pref_name);
  wait_for_window_close();
  remove_account();

  // we expect to have accountAdded and smtpServerAdded events.
  if (! (events["accountAdded"].data))
    throw new Error("failed to add an account");
  else if (! (events["smtpServerAdded"].data))
    throw new Error("failed to add an smtp server");
}

// Remove the account we added.
function remove_account() {
  let incomingServer = MailServices.accounts.FindServer("roger.sterling", "testin.example.com", "pop3");
  let account = MailServices.accounts.FindAccountForServer(incomingServer)

  let identity = account.defaultIdentity;
  MailServices.accounts.removeIncomingServer(incomingServer, true);
  outgoing = MailServices.smtp.getServerByKey(identity.smtpServerKey);
  MailServices.smtp.deleteServer(outgoing);
  MailServices.accounts.removeAccount(account);
}

