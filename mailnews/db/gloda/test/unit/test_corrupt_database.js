/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This test does not use glodaTestHelper because:
 * 1) We need to do things as part of the test without gloda having remotely
 *    thought about opening the database.
 * 2) We expect and desire that the logger produce a warning and glodaTestHelper
 *    takes the view that warnings = death.
 *
 * We do use the rest of the test infrastructure though.
 */

load("../../../../resources/logHelper.js");
load("../../../../resources/asyncTestUtils.js");

Components.utils.import("resource://gre/modules/Services.jsm");

// -- Do configure the gloda prefs though...
// yes to indexing
Services.prefs.setBoolPref("mailnews.database.global.indexer.enabled",
                           true);
// no to a sweep we don't control
Services.prefs.setBoolPref("mailnews.database.global.indexer.perform_initial_sweep",
                           false);
// yes to debug output
Services.prefs.setBoolPref("mailnews.database.global.logging.dump", true);

// We'll start with this datastore ID, and make sure it gets overwritten
// when the index is rebuilt.
const kDatastoreIDPref = "mailnews.database.global.datastore.id";
const kOriginalDatastoreID = "47e4bad6-fedc-4931-bf3f-d2f4146ac63e";
Services.prefs.setCharPref(kDatastoreIDPref, kOriginalDatastoreID);

// -- Add a logger listener that throws when we give it a warning/error.
Components.utils.import("resource:///modules/gloda/log4moz.js");

/**
 * Count the type of each severity level observed.
 */
function CountingAppender() {
  this._name = "CountingAppender";
  this.counts = {};
}
CountingAppender.prototype = {
  reset: function CountingAppender_reset() {
    this.counts = {};
  },
  append: function CountingAppender_append(message) {
    if (!(message.level in this.counts))
      this.counts[message.level] = 1;
    else
      this.counts[message.level]++;
  },
  getCountForLevel: function CountingAppender_getCountForLevel(level) {
    if (level in this.counts)
      return this.counts[level];
    return 0;
  },
  toString: function() {
    return "One, two, three! Ah ah ah!";
  }
};


let countingAppender = new CountingAppender();
Log4Moz.repository.rootLogger.addAppender(countingAppender);

/**
 * Create an illegal=corrupt database and make sure that we log a message and
 * still end up happy.
 */
function test_corrupt_databases_get_reported_and_blown_away() {
  // - get the file path
  let dbFile = Services.dirsvc.get("ProfD", Ci.nsIFile);
  dbFile.append("global-messages-db.sqlite");

  // - protect dangerous people from themselves
  // (There should not be a database at this point; if there is one, we are
  // not in the sandbox profile we expect.  I wouldn't bother except we're
  // going out of our way to write gibberish whereas gloda accidentally
  // opening a valid database is bad but not horrible.)
  if (dbFile.exists())
    do_throw("There should not be a database at this point.");

  // - create the file
  mark_sub_test_start("creating gibberish file");
  let ostream = Cc["@mozilla.org/network/file-output-stream;1"]
                  .createInstance(Ci.nsIFileOutputStream);
  ostream.init(dbFile, -1, -1, 0);
  let fileContents = "I'm in ur database not being a database.\n";
  ostream.write(fileContents, fileContents.length);
  ostream.close();

  // - reset counts in preparation of gloda init
  countingAppender.reset();

  // - init gloda, get warnings
  mark_sub_test_start("init gloda");
  Components.utils.import("resource:///modules/gloda/public.js");
  mark_sub_test_start("gloda inited, checking");

  mark_action("actual", "Counting appender counts", [countingAppender.counts]);
  // we expect 2 warnings
  do_check_eq(countingAppender.getCountForLevel(Log4Moz.Level.Warn), 2);
  // and no errors
  do_check_eq(countingAppender.getCountForLevel(Log4Moz.Level.Error), 0);

  // - make sure the datastore has an actual database
  Components.utils.import("resource:///modules/gloda/datastore.js");

  // Make sure that the datastoreID was overwritten
  do_check_neq(Gloda.datastoreID, kOriginalDatastoreID);
  // And for good measure, make sure that the pref was also overwritten
  let currentDatastoreID = Services.prefs.getCharPref(kDatastoreIDPref);
  do_check_neq(currentDatastoreID, kOriginalDatastoreID);
  // We'll also ensure that the Gloda.datastoreID matches the one stashed
  // in prefs...
  do_check_eq(currentDatastoreID, Gloda.datastoreID);
  // And finally, we'll make sure that the datastoreID is a string with length
  // greater than 0.
  do_check_eq(typeof(Gloda.datastoreID), "string");
  do_check_true(Gloda.datastoreID.length > 0);

  if (!GlodaDatastore.asyncConnection)
    do_throw("No database connection suggests no database!");
}

var tests = [
  test_corrupt_databases_get_reported_and_blown_away,
];

function run_test() {
  async_run_tests(tests);
}
