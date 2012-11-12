/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test checks proper operation of the account settings panes infrastructure
 * in the Account manager. E.g. if the values of elements are properly stored when
 * panes are switched.
 *
 * New checks can be added to it as needed.
 */

const MODULE_NAME = "test-account-settings-infrastructure";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                         "account-manager-helpers"];

let elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

let gPopAccount, gOriginalAccountCount;

function setupModule(module) {
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("account-manager-helpers").installInto(module);

  // There may be pre-existing accounts from other tests.
  gOriginalAccountCount = MailServices.accounts.allServers.Count();

  // Create a POP server
  let popServer = MailServices.accounts
    .createIncomingServer("nobody", "example.com", "pop3")
    .QueryInterface(Components.interfaces.nsIPop3IncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@example.com";

  gPopAccount = MailServices.accounts.createAccount();
  gPopAccount.incomingServer = popServer;
  gPopAccount.addIdentity(identity);

  // Now there should be one more account.
  assert_equals(MailServices.accounts.allServers.Count(), gOriginalAccountCount + 1);
}

function teardownModule(module) {
  // Remove our test account to leave the profile clean.
  MailServices.accounts.removeAccount(gPopAccount);
  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.Count(), gOriginalAccountCount);
}

/**
 * Check that the options in the server pane are stored even if the id
 * of the element contains multiple dots (not used in standard TB yet
 * but extensions may want it).
 *
 * @param amc  the account options controller
 */
function subtest_check_account_dot_IDs(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");
  // Check whether a standard element with "server.loginAtStartUp" stores its
  // value properly.
  let loginCheck = iframe.contentDocument.getElementById("server.loginAtStartUp");
  assert_false(loginCheck.checked);
  amc.check(new elib.Elem(loginCheck), true);

  accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  // Check by element properties.
  let loginCheck = iframe.contentDocument.getElementById("server.loginAtStartUp");
  assert_true(loginCheck.checked);

  // Check for correct value in the accountValues array, that will be saved into prefs.
  let rawCheckValue = amc.window.getAccountValue(gPopAccount,
                                                 amc.window.getValueArrayFor(gPopAccount),
                                                 "server", "loginAtStartUp",
                                                 null, false);

  assert_true(rawCheckValue);

  // The "server.login.At.StartUp" value does not exist yet, so the value should be 'null'.
  rawCheckValue = amc.window.getAccountValue(gPopAccount,
                                             amc.window.getValueArrayFor(gPopAccount),
                                             "server", "login.At.StartUp",
                                             null, false);
  assert_equals(rawCheckValue, null);

  // Change the ID so that "server.login.At.StartUp" exists now.
  loginCheck.id = "server.login.At.StartUp";

  accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  // Check for correct value in the accountValues array, that will be saved into prefs.
  // We can't check by element property here, because the am-server.xul pane was
  // reloaded and the element now has the original ID of "server.loginAtStartUp".
  rawCheckValue = amc.window.getAccountValue(gPopAccount,
                                             amc.window.getValueArrayFor(gPopAccount),
                                             "server", "login.At.StartUp",
                                             null, false);

  assert_true(rawCheckValue);
}

function test_account_panes() {
  open_advanced_settings(function(amc) {
    subtest_check_account_dot_IDs(amc);
  });
}
