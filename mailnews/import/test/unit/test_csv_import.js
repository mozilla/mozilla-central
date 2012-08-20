/**
 * Tests importing an address book export in the LDAP data interchange (LDIF)
 * format and checks the accuracy of the imported address book's cards.
 * The current export contains only one card with most fields full.
 *
 * This test also checks for the following bugs:
 *   -Bug 439819: LDIF import does not include mozillahomestreet.
 *   -Bug 182128: Edit Card, Notes on several lines appear on one after
 *                export/import in text format *(only tests the import).
 */
function run_test()
{
  // Due to the import code using nsIAbManager off the main thread, we need
  // to ensure that it is initialized before we start the main test.
  let abMgr = MailServices.ab;

  let file = do_get_file("resources/basic_csv_addressbook.csv");
  new AbImportHelper(file, "csv", "basic_csv_addressbook",
                     "csv_import").beginImport();
}
