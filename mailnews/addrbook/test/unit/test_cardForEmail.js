/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Tests nsIAbMDBDirectory::cardForEmailAddress
 * - checks correct return when no email address supplied
 * - checks correct return when no matching email address supplied
 * - checks correct return when matching email address supplied.
 *
 * Uses: cardForEmail.mab
 */
function run_test() {
  var testnum = 0;

  try {
    // Test setup - copy the data file into place
    var testAB = do_get_file("mailnews/addrbook/test/unit/data/cardForEmail.mab");

    // Copy the file to the profile directory for a PAB
    testAB.copyTo(profileDir, kPABData.fileName);

    ++testnum; // Test 1 - Get the directory
    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Components.interfaces.nsIRDFService);
    do_check_true(rdf != null);

    var AB = rdf.GetResource(kPABData.URI)
                .QueryInterface(Components.interfaces.nsIAbMDBDirectory);
    do_check_true(AB != null);

    ++testnum; // Test 2 - Check that a null string succeeds and does not
               // return a card (bug 404264)
    do_check_true(AB.cardForEmailAddress(null) == null);

    ++testnum; // Test 3 - Check that an empty string succeeds and does not
               // return a card (bug 404264)
    do_check_true(AB.cardForEmailAddress("") == null);

    ++testnum; // Test 4 - Check that we don't match an email that doesn't exist
    do_check_true(AB.cardForEmailAddress("nocard@this.email.invalid") == null);

    ++testnum; // Test 5 - Check that we match this email and some of the fields
               // of the card are correct.
    var card = AB.cardForEmailAddress("PrimaryEmail1@test.invalid");

    do_check_true(card != null);

    do_check_eq(card.firstName, "FirstName1");
    do_check_eq(card.lastName, "LastName1");
    do_check_eq(card.displayName, "DisplayName1");
    do_check_eq(card.primaryEmail, "PrimaryEmail1@test.invalid");
  }
  catch (e) {
    throw "FAILED in test #" + testnum + ": " + e;
  }
};
