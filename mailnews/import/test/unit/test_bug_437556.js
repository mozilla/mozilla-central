/**
 * Test for a regression of bug 437556: mailnews crashes while importing an 
 * address book if a field map is required but not set
 */
function run_test()
{
  var file = do_get_file('mailnews/import/test/resources/basic_addressbook.csv');
  var importService = Cc["@mozilla.org/import/import-service;1"]
                        .getService(Ci.nsIImportService);
  var module = importService.GetModule("addressbook", 0);
  var abInterface = module.GetImportInterface("addressbook")
                          .QueryInterface(Ci.nsIImportGeneric);

  abInterface.SetData("addressLocation", file);
 
  do_check_true(abInterface.WantsProgress());

  // BeginImport should return false if the field map isn't set
  do_check_false(abInterface.BeginImport(null, null, false));	
}
