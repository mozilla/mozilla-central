/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite to check that we correctly get child cards for LDAP directories
 * when offline and that we don't crash.
 */

const kLDAPDirectory = 0; // defined in nsDirPrefs.h
const kLDAPUriPrefix = "moz-abldapdirectory://";
const kLDAPTestSpec = "ldap://invalidhost//dc=intranet??sub?(objectclass=*)";

// Main function for the this test so we can check both personal and
// collected books work correctly in an easy manner.
function run_test() {
  // If nsIAbLDAPDirectory doesn't exist in our build options, someone has
  // specified --disable-ldap
  if (!("nsIAbLDAPDirectory" in Ci))
    return;

  // Test set-up
  let abUri = MailServices.ab.newAddressBook("test", kLDAPTestSpec, kLDAPDirectory);

  let abDir = MailServices.ab.getDirectory(kLDAPUriPrefix + abUri)
                             .QueryInterface(Ci.nsIAbLDAPDirectory);

  const kLDAPFileName = "ldap-1.mab";

  // Test setup - copy the data file into place
  do_get_file("data/cardForEmail.mab").copyTo(do_get_profile(), kLDAPFileName);

  // And tell the ldap directory we want this file.
  abDir.replicationFileName = kLDAPFileName;

  // Now go offline
  Services.io.offline = true;

  // Now try and get the card that has been replicated for offline use.
  let childCards = abDir.childCards;
  let count = 0;

  // Make sure we clear any memory that is now loose, so that the crash would
  // be triggered.
  gc();

  while (childCards.hasMoreElements())
  {
    // Make sure everything is an nsIAbCard.
    childCards.getNext().QueryInterface(Ci.nsIAbCard);

    ++count;
  }

  do_check_eq(count, 4);
}
