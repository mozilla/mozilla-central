/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that stale temporary files are cleaned up when the msg compose service
 * is initialized.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

var gExpectedFiles;

function create_temporary_files_for(name) {
  let file = Services.dirsvc.get("TmpD", Ci.nsIFile);
  file.append(name);
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

  return file;
}

function collect_expected_temporary_files() {
  let files = [];

  files.push(create_temporary_files_for("nsmail.tmp"));
  files.push(create_temporary_files_for("nsmail.tmp"));
  files.push(create_temporary_files_for("nsmail.tmp"));
  files.push(create_temporary_files_for("nsemail.html"));
  files.push(create_temporary_files_for("nsemail.html"));
  files.push(create_temporary_files_for("nscopy.tmp"));
  files.push(create_temporary_files_for("nscopy.tmp"));

  return files;
}

function check_files_not_exist(files) {
  files.forEach(function(file) {
    do_check_false(file.exists());
  });
}

function run_test() {
  gExpectedFiles = collect_expected_temporary_files();
  do_register_cleanup(function() {
    gExpectedFiles.forEach(function(file) {
      if (file.exists())
        file.remove(false);
    });
  });

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();
  let composeService = MailServices.compose;
  do_test_pending();
  check_files_not_exist(gExpectedFiles);
  do_test_finished();

}

