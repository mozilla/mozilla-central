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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "bs",
                                   "@mozilla.org/browser/nav-bookmarks-service;1",
                                   "nsINavBookmarksService");
XPCOMUtils.defineLazyServiceGetter(this, "anno",
                                   "@mozilla.org/browser/annotation-service;1",
                                   "nsIAnnotationService");

let bookmarksObserver = {
  onBeginUpdateBatch: function() {},
  onEndUpdateBatch: function() {
    let itemId = bs.getIdForItemAt(bs.toolbarFolder, 0);
    do_check_neq(itemId, -1);
    if (anno.itemHasAnnotation(itemId, "Places/SmartBookmark"))
      continue_test();
  },
  onItemAdded: function() {},
  onItemRemoved: function(id, folder, index, itemType) {},
  onItemChanged: function() {},
  onItemVisited: function(id, visitID, time) {},
  onItemMoved: function() {},
  QueryInterface: XPCOMUtils.generateQI([Ci.nsINavBookmarkObserver])
};

const PREF_SMART_BOOKMARKS_VERSION = "browser.places.smartBookmarksVersion";

function run_test() {
  do_test_pending();

  // Create our bookmarks.html copying bookmarks.glue.html to the profile
  // folder.  It will be ignored.
  create_bookmarks_html("bookmarks.glue.html");

  // Remove current database file.
  let db = gProfD.clone();
  db.append("places.sqlite");
  if (db.exists()) {
    db.remove(false);
    do_check_false(db.exists());
  }

  // Initialize Places through the History Service.
  let hs = Cc["@mozilla.org/browser/nav-history-service;1"].
           getService(Ci.nsINavHistoryService);
  // Check a new database has been created.
  // nsSuiteGlue uses databaseStatus to manage initialization.
  do_check_eq(hs.databaseStatus, hs.DATABASE_STATUS_CREATE);

  // A migrator would run before nsSuiteGlue Places initialization, so mimic
  // that behavior adding a bookmark and notifying the migration.
  bs.insertBookmark(bs.bookmarksMenuFolder, uri("http://mozilla.org/"),
                    bs.DEFAULT_INDEX, "migrated");

  // Initialize nsSuiteGlue.
  let bg = Cc["@mozilla.org/suite/suiteglue;1"].
           getService(Ci.nsIObserver);
  bg.observe(null, "initial-migration", null)

  // The test will continue once import has finished and smart bookmarks
  // have been created.
  bs.addObserver(bookmarksObserver, false);
}

function continue_test() {
  // Check the created bookmarks still exist.
  let itemId = bs.getIdForItemAt(bs.bookmarksMenuFolder, SMART_BOOKMARKS_ON_MENU);
  do_check_eq(bs.getItemTitle(itemId), "migrated");

  // Check that we have not imported any new bookmark.
  do_check_eq(bs.getIdForItemAt(bs.bookmarksMenuFolder, SMART_BOOKMARKS_ON_MENU + 1), -1);
  do_check_eq(bs.getIdForItemAt(bs.toolbarFolder, SMART_BOOKMARKS_ON_MENU), -1);

  remove_bookmarks_html();

  do_test_finished();
}
