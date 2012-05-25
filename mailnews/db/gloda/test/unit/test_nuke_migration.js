/**
 * Atypical gloda unit test that tests nuke migration.  Gloda is not designed
 * to be shutdown and started up again in the same process lifetime.  It tries
 * to be clever with caching accessors that clobber themselves out of existence
 * which are hard to make come back to life, and probably other things.
 *
 * So what we do is create a global-messages-db.sqlite with an unacceptably
 * old schema version before tickling gloda to startup.  If gloda comes up
 * with a database connection and it has the right schema version, we declare
 * that gloda has successfully loaded.  Our only historical screw-up here was
 * very blatant (and was actually a result of trying to avoid complexity in
 * the nuke path! oh the irony!) so we don't need to get all hardcore.
 **/

// we need the directory service
load("../../../../resources/mailDirService.js");

/**
 * The DB version to use.  We set this as a non-const variable so that
 * test_nuke_migration_from_future.js can change it.
 */
var BAD_DB_VERSION_TO_USE = 2;

/**
 * Synchronously create and close the out-of-date database.  Because we are
 * only using synchronous APIs, we know everything is in fact dead.  GC being
 * what it is, the various C++ objects will probably stay alive through the
 * next test, but will be inert because we have closed the database.
 */
function make_out_of_date_database() {
    // Get the path to our global database
    var dirService = Cc["@mozilla.org/file/directory_service;1"].
                     getService(Ci.nsIProperties);
    var dbFile = dirService.get("ProfD", Ci.nsIFile);
    dbFile.append("global-messages-db.sqlite");

    // Get the storage (sqlite) service
    var dbService = Cc["@mozilla.org/storage/service;1"].
                    getService(Ci.mozIStorageService);
    // Create the database
    var dbConnection = dbService.openUnsharedDatabase(dbFile);
    dbConnection.schemaVersion = BAD_DB_VERSION_TO_USE;

    // Close the database (will throw if there's a problem closing)
    dbConnection.close();
}

// some copied and pasted preference setup from glodaTestHelper that is
// appropriate here.
const gPrefs = Cc["@mozilla.org/preferences-service;1"]
                 .getService(Ci.nsIPrefBranch);
// yes to indexing
gPrefs.setBoolPref("mailnews.database.global.indexer.enabled", true);
// no to a sweep we don't control
gPrefs.setBoolPref("mailnews.database.global.indexer.perform_initial_sweep",
    false);
// yes to debug output
gPrefs.setBoolPref("mailnews.database.global.logging.dump", true);

function run_test() {

  // - make the old database
  make_out_of_date_database();

  // - tickle gloda
  // public.js loads gloda.js which self-initializes and initializes the datastore
  Components.utils.import("resource:///modules/gloda/public.js");
  Components.utils.import("resource:///modules/gloda/datastore.js");

  do_check_neq(GlodaDatastore.asyncConnection, null);
}
