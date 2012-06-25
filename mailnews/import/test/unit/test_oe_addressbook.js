function run_test()
{
  // Due to the import code using nsIAbManager off the main thread, we need
  // to ensure that it is initialized before we start the main test.
  var abMgr = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);

  var file = do_get_file("resources/OutlookExpress.wab");
  var helper = new AbImportHelper(file,
                                  "Outlook Express",
                                  "Outlook Express Address Book",
                                  "johndoe");
  helper.beginImport();
}
