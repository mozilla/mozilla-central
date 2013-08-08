/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Tests for bug 534822 - non-built-in address books specified in preferences
 * don't appear in address book lists.
 */

function run_test() {
  // Read in the prefs that will be default.
  let specialPrefs = do_get_file("data/bug534822prefs.js");

  var profileDir = do_get_profile();
  specialPrefs.copyTo(profileDir, "");

  specialPrefs = profileDir;
  specialPrefs.append("bug534822prefs.js");

  Services.prefs.readUserPrefs(specialPrefs);

  // Now load the ABs and check we've got all of them.
  let dirs = MailServices.ab.directories;

  let dir;

  let results = [
    { name: "extension", result: false },
    { name: kPABData.dirName, result: false },
    { name: kCABData.dirName, result: false }
  ];

  // Check the OS X Address Book if available
  if ("@mozilla.org/rdf/resource-factory;1?name=moz-abosxdirectory" in Cc)
    results.push({ name: kOSXData.dirName, result: false });

  while (dirs.hasMoreElements()) {
    let dir = dirs.getNext().QueryInterface(Ci.nsIAbDirectory);

    for (let i = 0; i < results.length; ++i) {
      if (results[i].name == dir.dirName) {
        do_check_false(results[i].result);
        results[i].result = true;
      }
    }
  }

  results.forEach(function (result) { do_check_true(result.result); });
};
