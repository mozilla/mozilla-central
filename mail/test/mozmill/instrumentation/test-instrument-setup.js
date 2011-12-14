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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu<bienvenu@mozillamessaging.com>
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
  let pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
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
  let pref = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
  let pref_name = "mailnews.auto_config_url";
  let url = collector.addHttpResource("../account/xml", "autoconfig");
  pref.setCharPref(pref_name, url);

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
  pref.clearUserPref(pref_name);
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
  let am = Cc["@mozilla.org/messenger/account-manager;1"]
      .getService(Ci.nsIMsgAccountManager);
  let smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
                     .getService(Ci.nsISmtpService);

  let incomingServer = am.FindServer("roger.sterling", "testin.example.com", "pop3");
  let account = am.FindAccountForServer(incomingServer)

  let identity = account.defaultIdentity;
  am.removeIncomingServer(incomingServer, true);
  outgoing = smtpService.getServerByKey(identity.smtpServerKey);
  smtpService.deleteSmtpServer(outgoing);
  am.removeAccount(account);
}

