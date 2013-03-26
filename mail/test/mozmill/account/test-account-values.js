/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test checks proper operation of the account settings panes
 * when certain special or invalid values are entered into the fields.
 */

const MODULE_NAME = "test-account-values";

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
  gOriginalAccountCount = MailServices.accounts.allServers.length;

  // Create a POP server
  let popServer = MailServices.accounts
    .createIncomingServer("nobody", "example.invalid", "pop3")
    .QueryInterface(Components.interfaces.nsIPop3IncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@example.invalid";

  gPopAccount = MailServices.accounts.createAccount();
  gPopAccount.incomingServer = popServer;
  gPopAccount.addIdentity(identity);

  // Now there should be one more account.
  assert_equals(MailServices.accounts.allServers.length, gOriginalAccountCount + 1);
}

function teardownModule(module) {
  // Remove our test account to leave the profile clean.
  MailServices.accounts.removeAccount(gPopAccount);
  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, gOriginalAccountCount);
}

/**
 * Bug 208628.
 * Check that if the CC field is empty, enabling CC will automatically
 * prefill the currently default email address.
 */
function test_default_CC_address() {
  open_advanced_settings(function(amc) {
    subtest_check_default_CC_address(amc);
  });
}

/**
 * Check that if the CC field is empty, enabling CC will automatically
 * prefill the currently default email address.
 *
 * @param amc  the account options controller
 */
function subtest_check_default_CC_address(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-copies.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");

  let defaultAddress = iframe.contentDocument.getElementById("identity.email").value;
  let ccCheck = iframe.contentDocument.getElementById("identity.doCc");
  let ccAddress = iframe.contentDocument.getElementById("identity.doCcList");
  // The CC checkbox is not enabled and the address value is empty.
  assert_false(ccCheck.checked);
  assert_equals(ccAddress.value, "");
  // After ticking the CC checkbox the default address should be prefilled.
  amc.check(new elib.Elem(ccCheck), true);
  assert_equals(ccAddress.value, defaultAddress);

  let bccCheck = iframe.contentDocument.getElementById("identity.doBcc");
  let bccAddress = iframe.contentDocument.getElementById("identity.doBccList");
  // The BCC checkbox is not enabled but we set the address value to something.
  assert_false(bccCheck.checked);
  assert_equals(bccAddress.value, "");
  let bccUserAddress = "somebody@else.invalid";
  bccAddress.value = bccUserAddress;
  // After ticking the BCC checkbox the current value of the address should not change.
  amc.check(new elib.Elem(bccCheck), true);
  assert_equals(bccAddress.value, bccUserAddress);
}

/**
 * Bug 720199.
 * Check if the account name automatically changes when the user changes
 * the username or hostname.
 */
function test_account_name() {
  // We already have a POP account ready.
  // Create also a NNTP server.
  let nntpServer = MailServices.accounts
    .createIncomingServer(null, "example.nntp.invalid", "nntp")
    .QueryInterface(Components.interfaces.nsINntpIncomingServer);

  identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox2@example.invalid";

  let nntpAccount = MailServices.accounts.createAccount();
  nntpAccount.incomingServer = nntpServer;
  nntpAccount.addIdentity(identity);

  assert_equals(gPopAccount.incomingServer.prettyName, "nobody on example.invalid");
  assert_equals(nntpAccount.incomingServer.prettyName, "example.nntp.invalid");

  // The automatic account name update works only if the name is
  // in the form of user@host.
  gPopAccount.incomingServer.prettyName = "nobody@example.invalid";

  let newHost = "some.host.invalid";
  let newUser = "somebody";

  // On NNTP there is no user name so just set new hostname.
  open_advanced_settings(function(amc) {
    subtest_check_account_name(nntpAccount, newHost, null, amc);
  });

  // And see if the account name is updated to it.
  assert_equals(nntpAccount.incomingServer.prettyName, newHost);

  // On POP3 there is both user name and host name.
  // Set new host name first.
  open_advanced_settings(function(amc) {
    subtest_check_account_name(gPopAccount, newHost, null, amc);
  });

  // And see if in the account name the host part is updated to it.
  assert_equals(gPopAccount.incomingServer.prettyName, "nobody@" + newHost);

  // Set new host name first.
  open_advanced_settings(function(amc) {
    subtest_check_account_name(gPopAccount, null, newUser, amc);
  });

  // And see if in the account name the user part is updated.
  assert_equals(gPopAccount.incomingServer.prettyName, newUser + "@" + newHost);

  newHost = "another.host.invalid";
  newUser = "anotherbody";

  // Set user name and host name at once.
  open_advanced_settings(function(amc) {
    subtest_check_account_name(gPopAccount, newHost, newUser, amc);
  });

  // And see if in the account name the host part is updated to it.
  assert_equals(gPopAccount.incomingServer.prettyName, newUser + "@" + newHost);

  // Now have an account name where the name does not match the hostname.
  gPopAccount.incomingServer.prettyName = newUser + "@example.invalid";

  newHost = "third.host.invalid";
  // Set the host name again.
  open_advanced_settings(function(amc) {
    subtest_check_account_name(gPopAccount, newHost, null, amc);
  });

  // And the account name should not be touched.
  assert_equals(gPopAccount.incomingServer.prettyName, newUser + "@example.invalid");

  MailServices.accounts.removeAccount(nntpAccount);
}

/**
 * Changes the user name and hostname to the supplied values.
 *
 * @param aAccount      the account to change
 * @param aNewHostname  the hostname value to set
 * @param aNewUsername  the username value to set
 * @param amc           the account options controller
 */
function subtest_check_account_name(aAccount, aNewHostname, aNewUsername, amc)
{
  let accountRow = get_account_tree_row(aAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");

  if (aNewHostname) {
    let hostname = iframe.contentDocument.getElementById("server.realHostName");
    assert_equals(hostname.value, aAccount.incomingServer.realHostName);

    // Now change the server host name.
    hostname.value = aNewHostname;
  }

  if (aNewUsername) {
    let username = iframe.contentDocument.getElementById("server.realUsername");
    assert_equals(username.value, aAccount.incomingServer.realUsername);

    // Now change the server user name.
    username.value = aNewUsername;
  }

  if (aNewUsername) {
    // If username has changed, we get a confirmation dialog.
    plan_for_modal_dialog("commonDialog", function(cdc) {
      // Just dismiss it.
      cdc.window.document.documentElement.acceptDialog();
    });
  }
  // We really need to save the new values so click OK on the Account settings.
  amc.window.document.documentElement.acceptDialog();
  if (aNewUsername)
    wait_for_modal_dialog("commonDialog");
}

/**
 * Bug 536768.
 * Check if invalid junk target settings (folders) are fixed to sane values.
 */
function test_invalid_junk_target() {
  // Set the junk target prefs to invalid values.
  let branch = Services.prefs.getBranch("mail.server." + gPopAccount.incomingServer.key + ".");
  branch.setCharPref("spamActionTargetAccount", "some random non-existent URI");
  branch.setCharPref("spamActionTargetFolder", "some random non-existent URI");
  let moveOnSpam = true;
  branch.setBoolPref("moveOnSpam", moveOnSpam);
  open_advanced_settings(function(amc) {
    subtest_check_invalid_junk_target(amc);
  });

  // The pref has no default so its non-existence means it was cleared.
  try {
    moveOnSpam = branch.getBoolPref("moveOnSpam");
  } catch (e) {
    moveOnSpam = false;
  }
  assert_false(moveOnSpam);
  // The targets should point to the same pop account now.
  let targetAccount = branch.getCharPref("spamActionTargetAccount");
  assert_equals(targetAccount, gPopAccount.incomingServer.serverURI);
  let targetFolder = branch.getCharPref("spamActionTargetFolder");
  assert_equals(targetFolder, gPopAccount.incomingServer.serverURI + "/Junk");
}

/**
 * Just show the Junk settings pane and let it fix the values.
 *
 * @param amc  the account options controller
 */
function subtest_check_invalid_junk_target(amc)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
  click_account_tree_row(amc, accountRow);

  // We need to save the new fixed values so click OK on the Account settings.
  amc.window.document.documentElement.acceptDialog();
}

/**
 * Bug 327812.
 * Checks if invalid server hostnames are not accepted.
 */
function test_invalid_hostname() {
  let branch = Services.prefs.getBranch("mail.server." + gPopAccount.incomingServer.key + ".");
  let origHostname = branch.getCharPref("realhostname");

  open_advanced_settings(function(amc) {
    subtest_check_invalid_hostname(amc, false, origHostname);
  });
  open_advanced_settings(function(amc) {
    subtest_check_invalid_hostname(amc, true, origHostname);
  });

  // The new bad hostname should not have been saved.
  let newHostname = branch.getCharPref("realhostname");
  assert_equals(origHostname, newHostname);
}

/**
 * Set the hostname to an invalid value and check if it gets fixed.
 *
 * @param amc                the account options controller
 * @param aExitSettings      Attempt to close the Account settings dialog.
 * @param aOriginalHostname  Original hostname of this server.
 */
function subtest_check_invalid_hostname(amc, aExitSettings, aOriginalHostname)
{
  let accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  let iframe = amc.window.document.getElementById("contentFrame");
  let hostname = iframe.contentDocument.getElementById("server.realHostName");
  assert_equals(hostname.value, aOriginalHostname);

  hostname.value = "some_invalid+host&domain*in>invalid";

  if (!aExitSettings) {
    accountRow = get_account_tree_row(gPopAccount.key, "am-junk.xul", amc);
    click_account_tree_row(amc, accountRow);

    // The invalid hostname should be set back to previous value at this point...
    accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
    click_account_tree_row(amc, accountRow);

    // ...let's check that:
    iframe = amc.window.document.getElementById("contentFrame");
    hostname = iframe.contentDocument.getElementById("server.realHostName");
    assert_equals(hostname.value, aOriginalHostname);
  } else {
    // If the hostname is bad, we should get a warning dialog.
    plan_for_modal_dialog("commonDialog", function(cdc) {
      // Just dismiss it.
      cdc.window.document.documentElement.acceptDialog();
    });

    // Click OK on the Account settings.
    amc.window.document.documentElement.acceptDialog();

    wait_for_modal_dialog("commonDialog");
  }
}
