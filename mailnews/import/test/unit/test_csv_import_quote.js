/**
 * Tests importing quoted csv address books.
 */
function run_test()
{
  // Due to the import code using nsIAbManager off the main thread, we need
  // to ensure that it is initialized before we start the main test.
  let abMgr = MailServices.ab;

  let file = do_get_file("resources/quote.csv");
  new AbImportHelper(file, "csv", "quote",
                     "quote_csv").beginImport();
}
