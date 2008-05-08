/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for basic LDAP address book functions
 */

do_import_script("mailnews/test/resources/mailDirService.js");
do_import_script("mailnews/addrbook/test/resources/abSetup.js");
do_import_script("mailnews/addrbook/test/resources/abCleanup.js");

const kLDAPDirectory = 0; // defined in nsDirPrefs.h
const kLDAPUriPrefix = "moz-abldapdirectory://";
const kLDAPTestSpec = "ldap://invalidhost:389//dc=intranet??sub?(objectclass=*)";

function run_test() {
  // Test 1 - Create an LDAP directory
  var abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);

  var ldapUrl = Components.classes["@mozilla.org/network/ldap-url;1"]
                          .createInstance(Components.interfaces.nsILDAPURL);

  ldapUrl.spec = kLDAPTestSpec;

  var abUri = abManager.newAddressBook("test", ldapUrl.spec, kLDAPDirectory);

  // Test 2 - Check we have the directory.
  var abDir = abManager.getDirectory(kLDAPUriPrefix + abUri)
                       .QueryInterface(Components.interfaces.nsIAbLDAPDirectory);

  // Test 3 - Check various fields
  do_check_eq(abDir.dirName, "test");
  do_check_eq(abDir.lDAPURL.spec, kLDAPTestSpec);

  // Test 4 - Write a UTF-8 Auth DN and check it
  abDir.authDn = "test\u00D0";

  do_check_eq(abDir.authDn, "test\u00D0");

  cleanup();
};
