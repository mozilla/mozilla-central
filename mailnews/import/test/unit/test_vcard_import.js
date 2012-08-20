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

  // test regular import (e.g. from file exported by another mail client)
  let file = do_get_file("resources/basic_vcard_addressbook.vcf");
  new AbImportHelper(file, "vcf", "basic_vcard_addressbook",
                     "vcard_import").beginImport();

  // test import against file with extra newlines (e.g. as copy-pasted by
  // hand, a relatively unlikely but still reasonable use case to cover)
  file = do_get_file("resources/emptylines_vcard_addressbook.vcf");
  new AbImportHelper(file, "vcf", "emptylines_vcard_addressbook",
                     "vcard_import").beginImport();
}
