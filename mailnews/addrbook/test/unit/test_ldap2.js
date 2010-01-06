/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for bug 532170. LDAP address book named with cyrillic/chinese
 * letters doesn't work.
 */

const kLDAPDirectory = 0; // defined in nsDirPrefs.h
const kLDAPUriPrefix = "moz-abldapdirectory://";
const kLDAPTestSpec = "ldap://invalidhost//dc=intranet??sub?(objectclass=*)";

function run_test() {
  // If nsIAbLDAPDirectory doesn't exist in our build options, someone has
  // specified --disable-ldap
  if (!("nsIAbLDAPDirectory" in Components.interfaces))
    return;

  // Test - Create an LDAP directory
  var abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);

  // Use a UTF-8 based directory name
  var abUri =
    abManager.newAddressBook("\u041C\u0435\u043B\u0435\u043D\u043A\u0438",
                             kLDAPTestSpec, kLDAPDirectory);

  // Test - Check we have the directory.
  var abDir = abManager.getDirectory(kLDAPUriPrefix + abUri)
                       .QueryInterface(Components.interfaces.nsIAbLDAPDirectory);

  // Test - Check various fields
  do_check_eq(abDir.dirName, "\u041C\u0435\u043B\u0435\u043D\u043A\u0438");
  do_check_eq(abDir.lDAPURL.spec, kLDAPTestSpec);
  do_check_true(abDir.readOnly);

  // XXX I'd really like a better check than this, to check that searching
  // works correctly. However we haven't got the support for that at the moment
  // and this at least ensures that we get a consistent ascii based preference
  // for the directory.
  do_check_eq(abDir.dirPrefId, "ldap_2.servers._nonascii");
};
