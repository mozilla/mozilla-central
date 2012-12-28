/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "test-account-actions";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                         "account-manager-helpers"];

let imapAccount, nntpAccount, originalAccountCount;

function setupModule(module) {
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("account-manager-helpers").installInto(module);

  // There may be pre-existing accounts from other tests.
  originalAccountCount = MailServices.accounts.allServers.length;
  // There already should be a Local Folders account created.
  // It is needed for this test.
  assert_true(MailServices.accounts.localFoldersServer);

  // Create an IMAP server
  let imapServer = MailServices.accounts
    .createIncomingServer("nobody", "example.com", "imap")
    .QueryInterface(Components.interfaces.nsIImapIncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@example.com";

  imapAccount = MailServices.accounts.createAccount();
  imapAccount.incomingServer = imapServer;
  imapAccount.addIdentity(identity);

  // Create a NNTP server
  let nntpServer = MailServices.accounts
    .createIncomingServer(null, "example.nntp.invalid", "nntp")
    .QueryInterface(Components.interfaces.nsINntpIncomingServer);

  identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox2@example.com";

  nntpAccount = MailServices.accounts.createAccount();
  nntpAccount.incomingServer = nntpServer;
  nntpAccount.addIdentity(identity);
  // Now there should be 2 more accounts.
  assert_equals(MailServices.accounts.allServers.length, originalAccountCount + 2);
}

function teardownModule(module) {
  // Remove our test accounts to leave the profile clean.
  MailServices.accounts.removeAccount(nntpAccount);
  MailServices.accounts.removeAccount(imapAccount);
  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, originalAccountCount);
}

/**
 * Check that the account actions for the account are enabled or disabled appropriately.
 *
 * @param amc          the account options controller
 * @param aAccountKey  the key of the account to select
 * @param aIsSetAsDefaultEnabled  true if the menuitem should be enabled, false otherwise
 * @param aIsRemoveEnabled        true if the menuitem should be enabled, false otherwise
 * @param aIsAddAccountEnabled    true if the menuitems (Add Mail Account+Add Other Account)
 *                                should be enabled, false otherwise
 */
function subtest_check_account_actions(amc, aAccountKey, aIsSetAsDefaultEnabled,
                                       aIsRemoveEnabled, aIsAddAccountEnabled)
{
  let accountRow = get_account_tree_row(aAccountKey, null, amc);
  click_account_tree_row(amc, accountRow);

  // click the Actions Button to bring up the popup with menuitems to test
  amc.click(amc.eid("accountActionsButton"), 5, 5);
  wait_for_popup_to_open(amc.e("accountActionsDropdown"));

  let actionAddMailAccount = amc.e("accountActionsAddMailAccount");
  assert_not_equals(actionAddMailAccount, undefined);
  assert_equals(!actionAddMailAccount.getAttribute("disabled"), aIsAddAccountEnabled);

  let actionAddOtherAccount = amc.e("accountActionsAddOtherAccount");
  assert_not_equals(actionAddOtherAccount, undefined);
  assert_equals(!actionAddOtherAccount.getAttribute("disabled"), aIsAddAccountEnabled);

  let actionSetDefault = amc.e("accountActionsDropdownSetDefault");
  assert_not_equals(actionSetDefault, undefined);
  assert_equals(!actionSetDefault.getAttribute("disabled"), aIsSetAsDefaultEnabled);

  let actionRemove = amc.e("accountActionsDropdownRemove");
  assert_not_equals(actionRemove, undefined);
  assert_equals(!actionRemove.getAttribute("disabled"), aIsRemoveEnabled);

  close_popup(amc, amc.eid("accountActionsDropdown"));
}

function test_account_actions() {
  // IMAP account: can be default, can be removed.
  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, imapAccount.key, true, true, true);
  });
  // NNTP (News) account: can't be default, can be removed.
  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, nntpAccount.key, false, true, true);
  });
  // Local Folders account: can't be removed, can't be default.
  localFoldersAccount = MailServices.accounts.FindAccountForServer(MailServices.accounts.localFoldersServer);
  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, localFoldersAccount.key, false, false, true);
  });

  // SMTP server row: can't be removed, can't be default.
  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, null, false, false, true);
  });

  // on the IMAP account, disable Delete Account menu item
  let disableItemPref = "mail.disable_button.delete_account";

  // Set the pref on the default branch, otherwise .getBoolPref on it throws.
  Services.prefs.getDefaultBranch("").setBoolPref(disableItemPref, true);
  Services.prefs.lockPref(disableItemPref);

  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, imapAccount.key, true, false, true);
  });

  Services.prefs.unlockPref(disableItemPref);
  Services.prefs.getDefaultBranch("").deleteBranch(disableItemPref);

  // on the IMAP account, disable Set as Default menu item
  disableItemPref = "mail.disable_button.set_default_account";

  Services.prefs.getDefaultBranch("").setBoolPref(disableItemPref, true);
  Services.prefs.lockPref(disableItemPref);

  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, imapAccount.key, false, true, true);
  });

  Services.prefs.unlockPref(disableItemPref);
  Services.prefs.getDefaultBranch("").deleteBranch(disableItemPref);

  // on the IMAP account, disable Add new Account menu items
  disableItemPref = "mail.disable_new_account_addition";

  Services.prefs.getDefaultBranch("").setBoolPref(disableItemPref, true);
  Services.prefs.lockPref(disableItemPref);

  open_advanced_settings(function(amc) {
    subtest_check_account_actions(amc, imapAccount.key, true, true, false);
  });

  Services.prefs.unlockPref(disableItemPref);
  Services.prefs.getDefaultBranch("").deleteBranch(disableItemPref);
}
