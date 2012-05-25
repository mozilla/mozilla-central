/**
 * There are actually two ways the nuke migration can be invoked.  From
 * a database too far from the future, and too far from the past.  This
 * one is the future one.  We must keep ourselves safe from time-traveling
 * grandchildren!
 **/

load("test_nuke_migration.js");

// pick something so far forward it will never get used!
BAD_DB_VERSION_TO_USE = 100000000;
