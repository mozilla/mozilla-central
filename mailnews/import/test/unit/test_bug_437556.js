/**
 * Test for a regression of bug 437556: mailnews crashes while importing an 
 * address book if a field map is required but not set
 */
function run_test()
{
  var file = do_get_file("../mailnews/import/test/resources/basic_addressbook.csv");
  var errorStr = Cc["@mozilla.org/supports-string;1"]
                     .createInstance(Ci.nsISupportsString);
  // get the text Address Book import interface and make sure it succeeded
  var abInterface = getImportInterface("addressbook", ".csv");
  do_check_neq(abInterface, null);
  abInterface.SetData("addressLocation", file);
  do_check_true(abInterface.WantsProgress());

  // BeginImport should return false and log an error if the fieldMap isn't set
  do_check_false(abInterface.BeginImport(null, errorStr, false));
  do_check_neq(errorStr, null);
}
