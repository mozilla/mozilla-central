/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that nsSuiteGlue does not overwrite bookmarks imported from the
 * migrators.  They usually run before nsSuiteGlue, so if we find any
 * bookmark on init, we should not try to import.
 */

const PREF_SMART_BOOKMARKS_VERSION = "browser.places.smartBookmarksVersion";
const PREF_BMPROCESSED = "distribution.516444.bookmarksProcessed";
const PREF_DISTRIBUTION_ID = "distribution.id";

const TOPIC_FINAL_UI_STARTUP = "final-ui-startup";
const TOPIC_CUSTOMIZATION_COMPLETE = "distribution-customization-complete";

function run_test() {
  // This is needed but we still have to investigate the reason, could just be
  // we try to act too late in the game, moving our shutdown earlier will help.
  let hs = Cc["@mozilla.org/browser/nav-history-service;1"].
         getService(Ci.nsINavHistoryService);
  // TODO: re-enable when bug 523936 is fixed.
  return;

  do_test_pending();

  // Copy distribution.ini file to our app dir.
  let distroDir = Services.dirsvc.get("XCurProcD", Ci.nsIFile);
  distroDir.append("distribution");
  let iniFile = distroDir.clone();
  iniFile.append("distribution.ini");
  if (iniFile.exists()) {
    iniFile.remove(false);
    print("distribution.ini already exists, did some test forget to cleanup?");
  }

  let testDistributionFile = gTestDir.clone();
  testDistributionFile.append("distribution.ini");
  testDistributionFile.copyTo(distroDir, "distribution.ini");
  do_check_true(testDistributionFile.exists());

  // Disable Smart Bookmarks creation.
  Services.prefs.setIntPref(PREF_SMART_BOOKMARKS_VERSION, -1);
  // Avoid migrateUI, we are just simulating a partial startup.
  Services.prefs.setIntPref("browser.migration.version", 1);

  // Initialize Places through the History Service.
  let hs = Cc["@mozilla.org/browser/nav-history-service;1"].
           getService(Ci.nsINavHistoryService);
  // Check a new database has been created.
  // nsSuiteGlue will use databaseStatus to manage initialization.
  do_check_eq(hs.databaseStatus, hs.DATABASE_STATUS_CREATE);

  // Initialize nsSuiteGlue.
  let bg = Cc["@mozilla.org/suite/suiteglue;1"].
           getService(Ci.nsISuiteGlue);

  let os = Cc["@mozilla.org/observer-service;1"].
           getService(Ci.nsIObserverService);
  let observer = {
    observe: function(aSubject, aTopic, aData) {
      os.removeObserver(this, PlacesUtils.TOPIC_INIT_COMPLETE);

      // Simulate browser startup.
      bg.QueryInterface(Ci.nsIObserver).observe(null,
                                                TOPIC_FINAL_UI_STARTUP,
                                                null);
      // Test will continue on customization complete notification.
      let cObserver = {
        observe: function(aSubject, aTopic, aData) {
          os.removeObserver(this, TOPIC_CUSTOMIZATION_COMPLETE);
          do_execute_soon(continue_test);
        }
      }
      os.addObserver(cObserver, TOPIC_CUSTOMIZATION_COMPLETE, false);
    }
  }
  os.addObserver(observer, PlacesUtils.TOPIC_INIT_COMPLETE, false);
}

function continue_test() {
  let bs = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].
           getService(Ci.nsINavBookmarksService);

  dump_table("moz_bookmarks");

  // Check the custom bookmarks exist on menu.
  let menuItemId = bs.getIdForItemAt(bs.bookmarksMenuFolder, 0);
  do_check_neq(menuItemId, -1);
  do_check_eq(bs.getItemTitle(menuItemId), "Menu Link Before");
  menuItemId = bs.getIdForItemAt(bs.bookmarksMenuFolder, 1 + DEFAULT_BOOKMARKS_ON_MENU);
  do_check_neq(menuItemId, -1);
  do_check_eq(bs.getItemTitle(menuItemId), "Menu Link After");

  // Check the custom bookmarks exist on toolbar.
  let toolbarItemId = bs.getIdForItemAt(bs.toolbarFolder, 0);
  do_check_neq(toolbarItemId, -1);
  do_check_eq(bs.getItemTitle(toolbarItemId), "Toolbar Link Before");
  toolbarItemId = bs.getIdForItemAt(bs.toolbarFolder, 1 + DEFAULT_BOOKMARKS_ON_TOOLBAR);
  do_check_neq(toolbarItemId, -1);
  do_check_eq(bs.getItemTitle(toolbarItemId), "Toolbar Link After");

  // Check the bmprocessed pref has been created.
  do_check_true(Services.prefs.getBoolPref(PREF_BMPROCESSED));

  // Check distribution prefs have been created.
  do_check_eq(Services.prefs.getCharPref(PREF_DISTRIBUTION_ID), "516444");

  do_test_finished();
}

do_register_cleanup(function() {
  // Remove the distribution file, even if the test failed, otherwise all
  // next tests will import it.
  let iniFile = Services.dirsvc.get("XCurProcD", Ci.nsIFile);
  iniFile.append("distribution");
  iniFile.append("distribution.ini");
  if (iniFile.exists())
    iniFile.remove(false);
  do_check_false(iniFile.exists());
});
