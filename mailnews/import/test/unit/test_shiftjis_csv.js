function run_test()
{
  // Due to the import code using nsIAbManager off the main thread, we need
  // to ensure that it is initialized before we start the main test.
  let abMgr = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);

  let file = do_get_file("resources/shiftjis_addressbook.csv");
  let helper = new AbImportHelper(file, "csv",
                                  "shiftjis_addressbook", "shiftjis_csv");

  helper.setFieldMap(helper.getDefaultFieldMap(true));
  helper.beginImport();
}
