/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for msg database functions.
 */

do_import_script("mailnews/test/resources/mailTestUtils.js");

function run_test() {
  loadLocalMailAccount();
  // Get the root folder
  var root = gLocalIncomingServer.rootFolder;

  root.createSubfolder("dbTest", null);
  var dbService = Components.classes["@mozilla.org/msgDatabase/msgDBService;1"]
                          .getService(Components.interfaces.nsIMsgDBService);
                        
  var folder = root.getChildNamed("dbTest");
  var db = dbService.openFolderDB(folder, true, true);
  do_check_neq(db, null);
  db.dBFolderInfo.highWater = 10;
  db.Close(true);
  db = dbService.openFolderDB(folder, true, true);
  do_check_neq(db, null);
  do_check_eq(db.dBFolderInfo.highWater, 10);
  db.dBFolderInfo.onKeyAdded(15);
  do_check_eq(db.dBFolderInfo.highWater, 15);
}
