/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = "test-ab-whitelist";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers", "keyboard-helpers" ];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var gOldWhiteList = null;
var gKeyString = null;

let gAccount = null;

function setupModule(module) {
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);

  let server = MailServices.accounts
                           .FindServer("tinderbox", "tinderbox", "pop3");
  gAccount = MailServices.accounts.FindAccountForServer(server);
  let serverKey = server.key;

  gKeyString = "mail.server." + serverKey + ".whiteListAbURI";
  gOldWhiteList = Services.prefs.getCharPref(gKeyString);
  Services.prefs.setCharPref(gKeyString, "");
}

function teardownModule(module) {
  Services.prefs.setCharPref(gKeyString, gOldWhiteList);
}

/* First, test that when we initially load the account manager, that
 * we're not whitelisting any address books.  Then, we'll check all
 * address books and save.
 */
function subtest_check_whitelist_init_and_save(amc) {
  // Ok, the advanced settings window is open.  Let's choose
  // the junkmail settings.
  let accountRow = get_account_tree_row(gAccount.key, "am-junk.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  let doc = amc.window.document.getElementById("contentFrame").contentDocument;

  // At this point, we shouldn't have anything checked, but we should have
  // the two default address books (Personal and Collected) displayed
  let list = doc.getElementById("whiteListAbURI");
  assert_equals(2, list.getRowCount(),
                "There was an unexpected number of address books");

  // Now we'll check both address books
  for (let i = 0; i < list.getRowCount(); i++) {
    let abNode = list.getItemAtIndex(i);
    amc.click(new elib.Elem(abNode));
  }

  // And close the dialog
  amc.window.document.getElementById("accountManager").acceptDialog();
}

/* Next, we'll make sure that the address books we checked in
 * subtest_check_whitelist_init_and_save were properly saved.
 * Then, we'll clear the address books and save.
 */
function subtest_check_whitelist_load_and_clear(amc) {
  let accountRow = get_account_tree_row(gAccount.key, "am-junk.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  let doc = amc.window.document.getElementById("contentFrame").contentDocument;
  let list = doc.getElementById("whiteListAbURI");
  let whiteListURIs = Services.prefs.getCharPref(gKeyString).split(" ");

  for (let i = 0; i < list.getRowCount(); i++) {
    let abNode = list.getItemAtIndex(i);
    assert_equals("true", abNode.getAttribute("checked"),
                  "Should have been checked");
    // Also ensure that the address book URI was properly saved in the
    // prefs
    assert_not_equals(-1, whiteListURIs.indexOf(abNode.getAttribute("value")));
    // Now un-check that address book
    amc.click(new elib.Elem(abNode));
  }

  // And close the dialog
  amc.window.document.getElementById("accountManager").acceptDialog();
}

/* Finally, we'll make sure that the address books we cleared
 * were actually cleared.
 */
function subtest_check_whitelist_load_cleared(amc) {
  let accountRow = get_account_tree_row(gAccount.key, "am-junk.xul", amc);
  assert_not_equals(accountRow, -1);
  click_account_tree_row(amc, accountRow);

  let doc = amc.window.document.getElementById("contentFrame").contentDocument;
  let list = doc.getElementById("whiteListAbURI");
  let whiteListURIs = "";

  try {
    whiteListURIs = Services.prefs.getCharPref(gKeyString);
    // We should have failed here, because the pref should have been cleared
    // out.
    throw Error("The whitelist preference for this server wasn't properly "
                + "cleared.");
  } catch(e) {
  }

  for (let i = 0; i < list.getRowCount(); i++) {
    let abNode = list.getItemAtIndex(i);
    assert_equals("false", abNode.getAttribute("checked"),
                  "Should not have been checked");
    // Also ensure that the address book URI was properly cleared in the
    // prefs
    assert_equals(-1, whiteListURIs.indexOf(abNode.getAttribute("value")));
  }

  // And close the dialog
  amc.window.document.getElementById("accountManager").acceptDialog();
}

function test_address_book_whitelist() {
  open_advanced_settings(subtest_check_whitelist_init_and_save);
  open_advanced_settings(subtest_check_whitelist_load_and_clear);
  open_advanced_settings(subtest_check_whitelist_load_cleared);
}
