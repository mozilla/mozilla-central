/**
 * Tests importing an address book export in the LDAP data interchange format
 * (LDIF) with a labeledURI and checks the accuracy of the imported contact.
 *
 * This test checks for the following bug:
 *   - Bug 264405: The Address Book doesn't show the LDAP-field "labeledURI"
 *                 as Website
 */
Components.utils.import("resource:///modules/mailServices.js");

function run_test()
{
  // Due to the import code using nsIAbManager off the main thread, we need
  // to ensure that it is initialized before we start the main test.
  var abMgr = MailServices.ab;

  var file = do_get_file("resources/bug_263304.ldif");
  new AbImportHelper(file, "Text file", "bug_263304", "bug_263304").beginImport();
}
