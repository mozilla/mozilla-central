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
 *   Mike Conley
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

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var gOldWhiteList = null;
var gKeyString = null;

function setupModule(module) {
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);

  let server = MailServices.accounts
                           .FindServer("tinderbox", "tinderbox", "pop3");
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
  click_account_tree_row(amc, 4);
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
  click_account_tree_row(amc, 4);
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
  click_account_tree_row(amc, 4);
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
