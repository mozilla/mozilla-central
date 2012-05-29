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

function create_temporary_directory() {
  let directory = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIProperties)
    .get("TmpD", Ci.nsIFile);
  directory.append("mailFolder");
  directory.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0700);
  return directory;
}

function create_sub_folders(parent, subFolders) {
  parent.leafName = parent.leafName + ".sbd";
  parent.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0700", 8));

  for (let folder in subFolders) {
    let subFolder = parent.clone();
    subFolder.append(subFolders[folder].name);
    subFolder.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0600", 8));
    if (subFolders[folder].subFolders)
      create_sub_folders(subFolder, subFolders[folder].subFolders);
  }
}

function create_mail_directory(subFolders) {
  let root = create_temporary_directory();

  for (let folder in subFolders) {
    if (!subFolders[folder].subFolders)
      continue;
    let directory = root.clone();
    directory.append(subFolders[folder].name);
    create_sub_folders(directory, subFolders[folder].subFolders);
  }

  return root;
}

function setup_mailbox(type, mailboxPath) {
  let user = Cc["@mozilla.org/uuid-generator;1"]
               .getService(Ci.nsIUUIDGenerator)
               .generateUUID().toString();
  let incomingServer =
    MailServices.accounts.createIncomingServer(user, "Local Folder", type);
  incomingServer.localPath = mailboxPath;

  return incomingServer.rootFolder;
}

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
