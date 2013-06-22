/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://testing-common/appInfoUtils.jsm");

function run_test() {
  do_get_profile();

  // Test the handling of accounts for unknown protocols.
  const kAccountName = "Unknown"
  const kPrplId = "prpl-unknown";

  let prefs = Services.prefs;
  prefs.setCharPref("messenger.account.account1.name", kAccountName);
  prefs.setCharPref("messenger.account.account1.prpl", kPrplId);
  prefs.setCharPref("messenger.accounts", "account1");

  try {
    // Having an implementation of nsIXULAppInfo is required for
    // Services.core.init to work.
    XULAppInfo.init();
    Services.core.init();

    let account = Services.accounts.getAccountByNumericId(1);
    do_check_true(account instanceof Ci.imIAccount);
    do_check_eq(account.name, kAccountName);
    do_check_eq(account.protocol.id, kPrplId);
    do_check_eq(account.connectionErrorReason, Ci.imIAccount.ERROR_UNKNOWN_PRPL);
  } finally {
    Services.core.quit();

    prefs.deleteBranch("messenger");
  }
}
