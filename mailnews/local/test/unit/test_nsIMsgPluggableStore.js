/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * nsIMsgPluggableStore interface tests
 */

var gPluggableStores = [
  "@mozilla.org/msgstore/berkeleystore;1",
  "@mozilla.org/msgstore/maildirstore;1"
];

function test_discoverSubFolders() {
  let mailbox = setup_mailbox("none", create_temporary_directory());

  mailbox.msgStore.discoverSubFolders(mailbox, true);

}

function run_all_tests() {
  test_discoverSubFolders();
}

function run_test() {
  for (let store in gPluggableStores) {
    Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                               gPluggableStores[store]);
    run_all_tests();
  }
}
