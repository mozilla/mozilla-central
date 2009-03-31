/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for basic LDAP address book functions
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

  var abUri = abManager.newAddressBook("test", kLDAPTestSpec, kLDAPDirectory);

  // Test - Check we have the directory.
  var abDir = abManager.getDirectory(kLDAPUriPrefix + abUri)
                       .QueryInterface(Components.interfaces.nsIAbLDAPDirectory);

  // Test - Check various fields
  do_check_eq(abDir.dirName, "test");
  do_check_eq(abDir.lDAPURL.spec, kLDAPTestSpec);
  do_check_true(abDir.readOnly);

  // Test - Write a UTF-8 Auth DN and check it
  abDir.authDn = "test\u00D0";

  do_check_eq(abDir.authDn, "test\u00D0");

  // Test - searchDuringLocalAutocomplete

  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);

  var ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // Set up an account and identity in the account manager
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var identity = acctMgr.createIdentity();

  const localAcTests =
    [
     // Online checks
     { useDir: false, dirSer: "",
       idOver: false, idSer: "", idKey: "",
       offline: false, result: false },
     { useDir: true, dirSer: abDir.dirPrefId,
       idOver: false, idSer: "", idKey: "",
       offline: false, result: false },
     // Offline checks with and without global prefs set, no identity key
     { useDir: false, dirSer: "",
       idOver: false, idSer: "", idKey: "",
       offline: true, result: false },
     { useDir: true, dirSer: "",
       idOver: false, idSer: "", idKey: "",
       offline: true, result: false },
     { useDir: true, dirSer: abDir.dirPrefId,
       idOver: false, idSer: "", idKey: "",
       offline: true, result: true },
     // Offline checks with and without global prefs set, with identity key
     { useDir: false, dirSer: "",
       idOver: false, idSer: "", idKey: identity.key,
       offline: true, result: false },
     { useDir: true, dirSer: "",
       idOver: false, idSer: "", idKey: identity.key,
       offline: true, result: false },
     { useDir: true, dirSer: abDir.dirPrefId,
       idOver: false, idSer: "", idKey: identity.key,
       offline: true, result: true },
     // Offline checks, no global prefs, identity ones only
     { useDir: false, dirSer: "",
       idOver: true, idSer: "", idKey: identity.key,
       offline: true, result: false },
     { useDir: false, dirSer: "",
       idOver: true, idSer: kPABData.dirPrefID, idKey: identity.key,
       offline: true, result: false },
     { useDir: false, dirSer: "",
       idOver: true, idSer: abDir.dirPrefId, idKey: identity.key,
       offline: true, result: true },
     { useDir: false, dirSer: "",
       idOver: false, idSer: abDir.dirPrefId, idKey: identity.key,
       offline: true, result: false },
     // Offline checks, global prefs and identity ones
     { useDir: true, dirSer: kPABData.dirPrefID,
       idOver: true, idSer: abDir.dirPrefId, idKey: identity.key,
       offline: true, result: true },
     { useDir: true, dirSer: abDir.dirPrefId,
       idOver: true, idSer: kPABData.dirPrefID, idKey: identity.key,
       offline: true, result: false }
     ];

  function checkAc(element, index, array) {
    dump("Testing index " + index + "\n");
    prefs.setBoolPref("ldap_2.autoComplete.useDirectory", element.useDir);
    prefs.setCharPref("ldap_2.autoComplete.directoryServer", element.dirSer);
    identity.overrideGlobalPref = element.idOver;
    identity.directoryServer = element.idSer;
    ioService.offline = element.offline;

    do_check_eq(abDir.useForAutocomplete(element.idKey), element.result);
  }

  localAcTests.forEach(checkAc);
};
