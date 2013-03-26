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

let gPopAccount, gImapAccount, gOriginalAccountCount;

function setupModule(module) {
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("account-manager-helpers").installInto(module);

  // There may be pre-existing accounts from other tests.
  gOriginalAccountCount = MailServices.accounts.allServers.length;

  // Create a POP server
  let popServer = MailServices.accounts
    .createIncomingServer("nobody", "pop.invalid", "pop3")
    .QueryInterface(Components.interfaces.nsIPop3IncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@pop.invalid";

  gPopAccount = MailServices.accounts.createAccount();
  gPopAccount.incomingServer = popServer;
  gPopAccount.addIdentity(identity);

  // Create an IMAP server
  let imapServer = MailServices.accounts
    .createIncomingServer("nobody", "imap.invalid", "imap")
    .QueryInterface(Components.interfaces.nsIImapIncomingServer);

  identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@imap.invalid";

  gImapAccount = MailServices.accounts.createAccount();
  gImapAccount.incomingServer = imapServer;
  gImapAccount.addIdentity(identity);

  // Now there should be one more account.
  assert_equals(MailServices.accounts.allServers.length, gOriginalAccountCount + 2);
}

function teardownModule(module) {
  // Remove our test accounts to leave the profile clean.
  MailServices.accounts.removeAccount(gPopAccount);
  MailServices.accounts.removeAccount(gImapAccount);

  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, gOriginalAccountCount);
}

/**
 * Bug 525024.
 * Check that the options in the server pane are properly preserved across
 * pane switches.
 */
function test_account_dot_IDs() {
  open_advanced_settings(function(amc) {
    subtest_check_account_dot_IDs(amc);
  });
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
  click_account_tree_row(amc, accountRow);

  let iframe = amc.e("contentFrame").contentDocument;
  // Check whether a standard element with "server.loginAtStartUp" stores its
  // value properly.
  let loginCheck = iframe.getElementById("server.loginAtStartUp");
  assert_false(loginCheck.checked);
  amc.check(new elib.Elem(loginCheck), true);

  accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  // Re-assign iframe.contentDocument because it was lost when changing panes
  // (uses loadURI to load a new document).
  iframe = amc.e("contentFrame").contentDocument;

  // Check by element properties.
  let loginCheck = iframe.getElementById("server.loginAtStartUp");
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

/**
 * Test for bug 807101.
 * Check if form controls are properly disabled when their attached prefs are locked.
 */
function test_account_locked_prefs() {
  open_advanced_settings(function(amc) {
    subtest_check_locked_prefs_addressing(amc);
  });

  open_advanced_settings(function(amc) {
    subtest_check_locked_prefs_server(amc);
  });
}

/**
 * Check that the LDAP server selection elements (radio group) are properly
 * disabled when their attached pref (prefstring attribute) is locked.
 *
 * @param amc  the account options controller
 */
function subtest_check_locked_prefs_addressing(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-addressing.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.e("contentFrame").contentDocument;

  // By default, 'use global LDAP server preferences' is set, not the
  // 'different LDAP server'.
  let useLDAPdirectory = iframe.getElementById("directories");
  assert_false(useLDAPdirectory.selected);

  // So the server selector is disabled.
  let LDAPdirectory = iframe.getElementById("identity.directoryServer");
  assert_true(LDAPdirectory.disabled);

  // And the Edit button too.
  let LDAPeditButton = iframe.getElementById("editButton");
  assert_true(LDAPeditButton.disabled);

  // Now toggle the 'different LDAP server' on. The server selector
  // and edit button should enable.
  amc.radio(new elib.Elem(useLDAPdirectory));
  assert_false(LDAPdirectory.disabled);
  assert_false(LDAPeditButton.disabled);

  // Lock the pref for the server selector.
  let prefstring = LDAPdirectory.getAttribute("prefstring");
  let controlPref = prefstring.replace("%identitykey%", gPopAccount.defaultIdentity.key);
  Services.prefs.getDefaultBranch("").setBoolPref(controlPref, "xxx");
  Services.prefs.lockPref(controlPref);

  // Refresh the pane by swithing to another one.
  accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gPopAccount.key, "am-addressing.xul", amc);
  click_account_tree_row(amc, accountRow);

  // Re-assign iframe.contentDocument because it was lost when changing panes
  // (uses loadURI to load a new document).
  iframe = amc.e("contentFrame").contentDocument;

  // We are now back and the 'different LDAP server' should still be selected
  // (the setting was saved).
  useLDAPdirectory = iframe.getElementById("directories");
  assert_true(useLDAPdirectory.selected);

  // But now the server selector should be disabled due to locked pref.
  LDAPdirectory = iframe.getElementById("identity.directoryServer");
  assert_true(LDAPdirectory.disabled);

  // The edit button still enabled (does not depend on the same pref lock)
  LDAPeditButton = iframe.getElementById("editButton");
  assert_false(LDAPeditButton.disabled);

  // Unlock the pref to clean up.
  Services.prefs.unlockPref(controlPref);
  Services.prefs.getDefaultBranch("").deleteBranch(controlPref);
}

/**
 * Check that the POP3 'keep on server' settings elements (2-level
 * checkboxes + textbox) are properly disabled when their attached pref
 * (prefstring attribute) is locked.
 *
 * @param amc  the account options controller
 */
function subtest_check_locked_prefs_server(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.e("contentFrame").contentDocument;

  // Top level leaveOnServer checkbox, disabled by default.
  let leaveOnServer = iframe.getElementById("pop3.leaveMessagesOnServer");
  assert_false(leaveOnServer.disabled);
  assert_false(leaveOnServer.checked);

  // Second level deleteByAge checkbox, disabled by default.
  let deleteByAge = iframe.getElementById("pop3.deleteByAgeFromServer");
  assert_true(deleteByAge.disabled);
  assert_false(deleteByAge.checked);

  // Third level daysToLeave textbox, disabled by default.
  let daysToLeave = iframe.getElementById("pop3.numDaysToLeaveOnServer");
  assert_true(daysToLeave.disabled);

  // When leaveOnServer is checked, only deleteByAge will get enabled.
  amc.check(new elib.Elem(leaveOnServer), true);
  assert_true(leaveOnServer.checked);
  assert_false(deleteByAge.disabled);
  assert_true(daysToLeave.disabled);

  // When deleteByAge is checked, daysToLeave will get enabled.
  amc.check(new elib.Elem(deleteByAge), true);
  assert_true(deleteByAge.checked);
  assert_false(daysToLeave.disabled);

  // Lock the pref deleteByAge checkbox (middle of the element hierarchy).
  let prefstring = deleteByAge.getAttribute("prefstring");
  let controlPref = prefstring.replace("%serverkey%", gPopAccount.incomingServer.key);
  Services.prefs.getDefaultBranch("").setBoolPref(controlPref, true);
  Services.prefs.lockPref(controlPref);

  // Refresh the pane by swithing to another one.
  accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  // Re-assign iframe.contentDocument because it was lost when changing panes
  // (uses loadURI to load a new document).
  iframe = amc.e("contentFrame").contentDocument;

  // Now leaveOnServer was preserved as checked.
  leaveOnServer = iframe.getElementById("pop3.leaveMessagesOnServer");
  assert_false(leaveOnServer.disabled);
  assert_true(leaveOnServer.checked);

  // Now deleteByAge was preserved as checked but is locked/disabled.
  deleteByAge = iframe.getElementById("pop3.deleteByAgeFromServer");
  assert_true(deleteByAge.disabled);
  assert_true(deleteByAge.checked);

  // Because deleteByAge is checked, daysToLeave should be enabled.
  daysToLeave = iframe.getElementById("pop3.numDaysToLeaveOnServer");
  assert_false(daysToLeave.disabled);

  // When leaveOnserver is unchecked, both of deleteByAge and daysToLeave
  // should get disabled.
  amc.check(new elib.Elem(leaveOnServer), false);
  assert_false(leaveOnServer.disabled);
  assert_false(leaveOnServer.checked);

  assert_true(deleteByAge.disabled);
  assert_true(deleteByAge.checked);
  assert_true(daysToLeave.disabled);

  // Unlock the pref to clean up.
  Services.prefs.unlockPref(controlPref);
  Services.prefs.getDefaultBranch("").deleteBranch(controlPref);
}

/**
 * Bug 530142.
 * Check that that if one field is set to a value, switching directly to another
 * account pane showing the same field really loads the value from the new account,
 * even when empty. This is tested on the Reply-To field.
 */
function test_replyTo_leak() {
  open_advanced_settings(function(amc) {
    subtest_check_replyTo_leak(amc);
  });
}

/**
 * @param amc  the account options controller
 */
function subtest_check_replyTo_leak(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, null, amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");

  // The Reply-To field should be empty.
  let replyAddress = iframe.contentDocument.getElementById("identity.replyTo");
  assert_equals(replyAddress.value, "");

  // Now we set a value into it and switch to another account, the main pane.
  replyAddress.value = "somewhere@else.com";

  // This test expects the following POP account to exist by default
  // in the test profile with port number 110 and no security.
  let firstServer = MailServices.accounts
                                .FindServer("tinderbox", "tinderbox", "pop3");
  let firstAccount = MailServices.accounts.FindAccountForServer(firstServer);

  accountRow = get_account_tree_row(firstAccount.key, null, amc);
  click_account_tree_row(amc, accountRow);

  // the Reply-To field should be empty as this account does not have it set.
  replyAddress = iframe.contentDocument.getElementById("identity.replyTo");
  assert_equals(replyAddress.value, "");
}

/**
 * Test for bug 804091.
 * Check if onchange handlers are properly executed when panes are switched.
 */
function test_account_onchange_handler() {
  open_advanced_settings(function(amc) {
    subtest_check_onchange_handler(amc);
  });
}

/**
 * Check if onchange handlers are properly executed when panes are switched.
 *
 * @param amc  the account options controller
 */
function subtest_check_onchange_handler(amc)
{
  let accountRow = get_account_tree_row(gImapAccount.key, "am-offline.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.e("contentFrame").contentDocument;

  let autoSync = iframe.getElementById("autosyncValue");
  // 30 is the default value so check if we are in clean state.
  assert_equals(autoSync.value, 30);

  let autoSyncInterval = iframe.getElementById("autosyncInterval");
  // 1 is the default value and means the 30 is in days.
  assert_equals(autoSyncInterval.value, 1);

  // Now type in 35 (days).
  amc.radio(new elib.ID(iframe, "useAutosync.ByAge"));
  autoSync.select();
  amc.type(new elib.Elem(autoSync), "35");

  // Immediatelly switch to another pane and back.
  accountRow = get_account_tree_row(gImapAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  accountRow = get_account_tree_row(gImapAccount.key, "am-offline.xul", amc);
  click_account_tree_row(amc, accountRow);

  iframe = amc.e("contentFrame").contentDocument;

  // The pane optimized the entered value a bit. So now we should find 5.
  autoSync = iframe.getElementById("autosyncValue");
  assert_equals(autoSync.value, 5);

  // And the unit is 7 days = week.
  autoSyncInterval = iframe.getElementById("autosyncInterval");
  assert_equals(autoSyncInterval.value, 7);
}
