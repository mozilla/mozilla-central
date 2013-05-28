/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test checks proper operation of the account tree in the Account manager.
 */

const MODULE_NAME = "test-account-tree";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                         "account-manager-helpers"];

let gPopAccount, gOriginalAccountCount;

function setupModule(module) {
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("account-manager-helpers").installInto(module);

  // There may be pre-existing accounts from other tests.
  gOriginalAccountCount = MailServices.accounts.allServers.length;

  // Create a POP server
  let popServer = MailServices.accounts
    .createIncomingServer("nobody", "foo.invalid", "pop3")
    .QueryInterface(Ci.nsIPop3IncomingServer);

  let identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox@foo.invalid";

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
 * Test for bug 536248.
 * Check if the account manager dialog remembers the open state of accounts.
 */
function test_account_open_state() {
  open_advanced_settings(function(amc) {
    subtest_check_account_open_state(amc, true);
  });
  open_advanced_settings(function(amc) {
    subtest_check_account_open_state(amc, false);
  });
  // After this test all the accounts must be "open".
}

/**
 * Check if the open state of accounts is in the wished state.
 *
 * @param amc           The account options controller.
 * @param aWishedState  The open state in which the account row should be found (bool).
 */
function subtest_check_account_open_state(amc, aWishedState)
{
  let accountRow = get_account_tree_row(gPopAccount.key, null, amc);
  click_account_tree_row(amc, accountRow);

  // See if the account row is in the wished open state.
  let accountTree = amc.e("accounttree");
  assert_equals(accountRow, accountTree.view.selection.currentIndex);
  assert_equals(accountTree.view.isContainerOpen(accountRow), aWishedState);

  accountTree.view.toggleOpenState(accountRow);
  assert_equals(accountTree.view.isContainerOpen(accountRow), !aWishedState);

  // Whatever the open state of the account was, selecting one of its subpanes
  // must open it.
  amc.window.selectServer(gPopAccount.incomingServer, "am-junk.xul");
  assert_true(accountTree.view.isContainerOpen(accountRow));

  // Set the proper state again for continuation of the test.
  accountTree.view.getItemAtIndex(accountRow).setAttribute("open", !aWishedState);
  assert_equals(accountTree.view.isContainerOpen(accountRow), !aWishedState);
}

/**
 * Bug 740617.
 * Check if the default account is styled in bold.
 *
 */
function test_default_account_highlight() {
  open_advanced_settings(function(amc) {
    subtest_check_default_account_highlight(amc);
  });
}

/**
 * Check if the default account is styled in bold and another account is not.
 *
 * @param amc           The account options controller.
 */
function subtest_check_default_account_highlight(amc)
{
  // Select the default account.
  let accountRow = get_account_tree_row(MailServices.accounts.defaultAccount.key, null, amc);
  click_account_tree_row(amc, accountRow);

  let accountTree = amc.e("accounttree");
  assert_equals(accountRow, accountTree.view.selection.currentIndex);
  let cell = accountTree.view.getItemAtIndex(accountRow).firstChild.firstChild;
  assert_equals(cell.tagName, "treecell");

  // We can't read the computed style of the tree cell directly, so at least see
  // if the isDefaultServer-true property is set on it. Hopefully the proper style
  // is attached to this property.
  let propArray = accountTree.view
    .getCellProperties(accountRow, accountTree.columns.getColumnAt(0)).split(" ");
  assert_not_equals(propArray.indexOf("isDefaultServer-true"), -1);

  // Now select another account that is not default.
  accountRow = get_account_tree_row(gPopAccount.key, null, amc);
  click_account_tree_row(amc, accountRow);

  // There should isDefaultServer-true on its tree cell.
  propArray = accountTree.view
    .getCellProperties(accountRow, accountTree.columns.getColumnAt(0)).split(" ");
  assert_equals(propArray.indexOf("isDefaultServer-true"), -1);
}
/**
 * Bug 58713.
 * Check if after deleting an account the next one is selected.
 *
 * This test should always be the last one as it removes our specially
 * created gPopAccount.
 */
function test_selection_after_account_deletion() {
  open_advanced_settings(function(amc) {
    subtest_check_selection_after_account_deletion(amc);
  });
}

/**
 * Check if after deleting an account the next one is selected.
 *
 * @param amc           The account options controller.
 */
function subtest_check_selection_after_account_deletion(amc)
{
  // Select the default account.
  let accountRow = get_account_tree_row(gPopAccount.key, "am-server.xul", amc);
  click_account_tree_row(amc, accountRow);

  let accountList = [];
  let accountTreeNode = amc.e("account-tree-children");
  // Build the list of accounts in the account tree (order is important).
  for (let i = 0; i < accountTreeNode.childNodes.length; i++) {
    if ("_account" in accountTreeNode.childNodes[i]) {
      let curAccount = accountTreeNode.childNodes[i]._account;
      if (accountList.indexOf(curAccount) == -1)
        accountList.push(curAccount);
    }
  }

  // Get position of the current account in the account list.
  let accountIndex = accountList.indexOf(gPopAccount);

  plan_for_modal_dialog("commonDialog", function(cdc) {
    // Account removal confirmation dialog. Just accept it.
    cdc.window.document.documentElement.acceptDialog();
  });
  // Use the Remove item in the Account actions menu.
  amc.click_menus_in_sequence(amc.e("accountActionsDropdown"),
                              [ {id: "accountActionsDropdownRemove"} ]);
  wait_for_modal_dialog("commonDialog");
  // Now there should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, gOriginalAccountCount);

  // See if the currently selected account is the one next in the account list.
  let accountTree = amc.e("accounttree");
  accountRow = accountTree.view.selection.currentIndex;
  assert_equals(accountTree.view.getItemAtIndex(accountRow)._account,
                accountList[accountIndex + 1]);
}
