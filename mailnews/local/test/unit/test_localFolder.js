/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * nsIMsgFolder.subFolders tests
 */

function check_sub_folders(expected, actual) {
  let i = 0;
  while (actual.hasMoreElements()) {
    let actualFolder = actual.getNext().QueryInterface(Ci.nsIMsgFolder);
    do_check_eq(expected[i].name, actualFolder.name);
    let pluggableStore = actualFolder.msgStore;
    pluggableStore.discoverSubFolders(actualFolder, true);
    do_check_eq(!!expected[i].subFolders, actualFolder.hasSubFolders);
    if (actualFolder.hasSubFolders)
      check_sub_folders(expected[i].subFolders, actualFolder.subFolders);
    i++;
  }
}

function test_default_mailbox(expected, type)
{
  let mailbox = setup_mailbox(type, create_temporary_directory());

  check_sub_folders(expected, mailbox.subFolders);
}

function test_mailbox(expected, type) {
  let mailbox = setup_mailbox(type, create_mail_directory(expected));

  check_sub_folders(expected, mailbox.subFolders);
}

function run_test() {
  test_default_mailbox([{ name: "Trash" }, { name: "Outbox" }], "none");
  test_default_mailbox([{ name: "Inbox" }, { name: "Trash" }], "pop3");

  test_mailbox([
    {
      name: "Inbox",
      subFolders: [ { name: "sub4" } ]
    },
    {
      name: "Trash"
    }
  ], "pop3");

}
