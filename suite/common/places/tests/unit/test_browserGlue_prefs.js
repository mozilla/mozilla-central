/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that nsSuiteGlue is correctly interpreting the preferences settable
 * by the user or by other components.
 */

/** Bug 539067
 * Test is disabled due to random failures and timeouts, see run_test.
 * This is commented out to avoid leaks.
// Initialize SuiteGlue.
let bg = Cc["@mozilla.org/suite/suiteglue;1"].
         getService(Ci.nsISuiteGlue);
*/

// Initialize Places through Bookmarks Service.
let bs = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].
         getService(Ci.nsINavBookmarksService);

// Get other services.
let os = Cc["@mozilla.org/observer-service;1"].
         getService(Ci.nsIObserverService);

const PREF_IMPORT_BOOKMARKS_HTML = "browser.places.importBookmarksHTML";
const PREF_RESTORE_DEFAULT_BOOKMARKS = "browser.bookmarks.restore_default_bookmarks";
const PREF_SMART_BOOKMARKS_VERSION = "browser.places.smartBookmarksVersion";
const PREF_AUTO_EXPORT_HTML = "browser.bookmarks.autoExportHTML";

function waitForImportAndSmartBookmarks(aCallback) {
  Services.obs.addObserver(function waitImport() {
    Services.obs.removeObserver(waitImport, "bookmarks-restore-success");
    // Delay to test eventual smart bookmarks creation.
    do_execute_soon(function () {
      promiseAsyncUpdates().then(aCallback);
    });
  }, "bookmarks-restore-success", false);
}

let tests = [];
//------------------------------------------------------------------------------

tests.push({
  description: "Import from bookmarks.html if importBookmarksHTML is true.",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);

    // Set preferences.
    Services.prefs.setBoolPref(PREF_IMPORT_BOOKMARKS_HTML, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been imported, and a smart bookmark has been
      // created.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder,
                                     SMART_BOOKMARKS_ON_TOOLBAR);
      do_check_eq(bs.getItemTitle(itemId), "example");
      // Check preferences have been reverted.
      do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));

      next_test();
    });
    // Force nsSuiteGlue::_initPlaces().
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "import from bookmarks.html, but don't create smart bookmarks if they are disabled",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);

    // Set preferences.
    Services.prefs.setIntPref(PREF_SMART_BOOKMARKS_VERSION, -1);
    Services.prefs.setBoolPref(PREF_IMPORT_BOOKMARKS_HTML, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been imported, but smart bookmarks have not
      // been created.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder, 0);
      do_check_eq(bs.getItemTitle(itemId), "example");
      // Check preferences have been reverted.
      do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));

      next_test();
    });
    // Force nsSuiteGlue::_initPlaces().
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "Import from bookmarks.html, but don't create smart bookmarks if autoExportHTML is true and they are at latest version",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);
    // Set preferences.
    Services.prefs.setIntPref(PREF_SMART_BOOKMARKS_VERSION, 999);
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, true);
    Services.prefs.setBoolPref(PREF_IMPORT_BOOKMARKS_HTML, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been imported, but smart bookmarks have not
      // been created.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder, 0);
      do_check_eq(bs.getItemTitle(itemId), "example");
      do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));
      // Check preferences have been reverted.
      Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, false);

      next_test();
    });
    // Force nsSuiteGlue::_initPlaces()
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "Import from bookmarks.html, and create smart bookmarks if autoExportHTML is true and they are not at latest version.",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);
    // Set preferences.
    Services.prefs.setIntPref(PREF_SMART_BOOKMARKS_VERSION, 0);
    Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, true);
    Services.prefs.setBoolPref(PREF_IMPORT_BOOKMARKS_HTML, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been imported, but smart bookmarks have not
      // been created.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder, SMART_BOOKMARKS_ON_TOOLBAR);
      do_check_eq(bs.getItemTitle(itemId), "example");
      do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));
      // Check preferences have been reverted.
      Services.prefs.setBoolPref(PREF_AUTO_EXPORT_HTML, false);

      next_test();
    });
    // Force nsSuiteGlue::_initPlaces()
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------
tests.push({
  description: "restore from default bookmarks.html if restore_default_bookmarks is true.",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);
    // Set preferences.
    Services.prefs.setBoolPref(PREF_RESTORE_DEFAULT_BOOKMARKS, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been restored.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder, SMART_BOOKMARKS_ON_TOOLBAR + 1);
      do_check_true(itemId > 0);
      // Check preferences have been reverted.
      do_check_false(Services.prefs.getBoolPref(PREF_RESTORE_DEFAULT_BOOKMARKS));

      next_test();
    });
    // Force nsSuiteGlue::_initPlaces()
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------

tests.push({
  description: "setting both importBookmarksHTML and restore_default_bookmarks should restore defaults.",
  exec: function() {
    // Sanity check: we should not have any bookmark on the toolbar.
    do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, 0), -1);
    // Set preferences.
    Services.prefs.setBoolPref(PREF_IMPORT_BOOKMARKS_HTML, true);
    Services.prefs.setBoolPref(PREF_RESTORE_DEFAULT_BOOKMARKS, true);

    waitForImportAndSmartBookmarks(function () {
      // Check bookmarks.html has been restored.
      let itemId = bs.getIdForItemAt(bs.toolbarFolder, SMART_BOOKMARKS_ON_TOOLBAR + 1);
      do_check_true(itemId > 0);
      // Check preferences have been reverted.
      do_check_false(Services.prefs.getBoolPref(PREF_RESTORE_DEFAULT_BOOKMARKS));
      do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));

      do_test_finished();
    });
    // Force nsSuiteGlue::_initPlaces()
    do_log_info("Simulate Places init");
    bg.QueryInterface(Ci.nsIObserver).observe(null,
                                              PlacesUtils.TOPIC_INIT_COMPLETE,
                                              null);
  }
});

//------------------------------------------------------------------------------

function finish_test() {
  // Clean up database from all bookmarks.
  remove_all_bookmarks();
  remove_bookmarks_html();
  remove_all_JSON_backups();

  do_test_finished();
}
var testIndex = 0;
function next_test() {
  // Clean up database from all bookmarks.
  remove_all_bookmarks();
  // nsSuiteGlue stops observing topics after first notification,
  // so we add back the observer to test additional runs.
  os.addObserver(bg.QueryInterface(Ci.nsIObserver),
                 PlacesUtils.TOPIC_INIT_COMPLETE, false);
  os.addObserver(bg.QueryInterface(Ci.nsIObserver),
                 PlacesUtils.TOPIC_DATABASE_LOCKED, false);
  // Execute next test.
  let test = tests.shift();
  print("\nTEST " + (++testIndex) + ": " + test.description);
  test.exec();
}
function run_test() {
  // Bug 539067: disabled due to random failures and timeouts.
  return;

  do_test_pending();
  // Enqueue test, so it will consume the default places-init-complete
  // notification created at Places init.
  do_timeout(0, start_tests);
}

function start_tests() {
  // Clean up database from all bookmarks.
  remove_all_bookmarks();

  // Ensure preferences status.
  do_check_false(Services.prefs.getBoolPref(PREF_AUTO_EXPORT_HTML));
  try {
    do_check_false(Services.prefs.getBoolPref(PREF_IMPORT_BOOKMARKS_HTML));
    do_throw("importBookmarksHTML pref should not exist");
  }
  catch(ex) {}
  do_check_false(Services.prefs.getBoolPref(PREF_RESTORE_DEFAULT_BOOKMARKS));

  // Create our bookmarks.html from bookmarks.glue.html.
  create_bookmarks_html("bookmarks.glue.html");
  // Create our JSON backup from bookmarks.glue.json.
  create_JSON_backup("bookmarks.glue.json");
  // Kick-off tests.
  next_test();
}
