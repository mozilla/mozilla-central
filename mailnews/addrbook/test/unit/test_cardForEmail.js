/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Tests nsIAbDirectory::cardForEmailAddress
 * - checks correct return when no email address supplied
 * - checks correct return when no matching email address supplied
 * - checks correct return when matching email address supplied.
 *
 * Uses: cardForEmail.mab
 */

function check_correct_card(card) {
  do_check_neq(card, null);

  do_check_eq(card.firstName, "FirstName1");
  do_check_eq(card.lastName, "LastName1");
  do_check_eq(card.displayName, "DisplayName1");
  do_check_eq(card.primaryEmail, "PrimaryEmail1@test.invalid");
  do_check_eq(card.getProperty("SecondEmail", "BAD"), "SecondEmail1\u00D0@test.invalid");
}

function run_test() {
  // Test setup - copy the data file into place
  var testAB = do_get_file("data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB
  testAB.copyTo(do_get_profile(), kPABData.fileName);

  // Test - Get the directory
  let AB = MailServices.ab.getDirectory(kPABData.URI);

  // Test - Check that a null string succeeds and does not
  // return a card (bug 404264)
  do_check_true(AB.cardForEmailAddress(null) == null);

  // Test - Check that an empty string succeeds and does not
  // return a card (bug 404264)
  do_check_true(AB.cardForEmailAddress("") == null);

  // Test - Check that we don't match an email that doesn't exist
  do_check_true(AB.cardForEmailAddress("nocard@this.email.invalid") == null);

  // Test - Check that we match this email and some of the fields
  // of the card are correct.
  var card = AB.cardForEmailAddress("PrimaryEmail1@test.invalid");

  check_correct_card(card);

  // Test - Check that we match with the primary email with insensitive case.
  card = AB.cardForEmailAddress("pRimaryemAIL1@teST.invalid");

  check_correct_card(card);

  // Test - Check that we match with the second email.
  card = AB.cardForEmailAddress("SecondEmail1\u00D0@test.invalid");

  check_correct_card(card);

  // Test - Check that we match with the second email with insensitive case.
  card = AB.cardForEmailAddress("SECondEMail1\u00D0@TEST.inValid");

  check_correct_card(card);

  // Check getCardFromProperty returns null correctly for non-extant properties
  do_check_eq(AB.getCardFromProperty("JobTitle", "", false), null);
  do_check_eq(AB.getCardFromProperty("JobTitle", "JobTitle", false), null);

  // Check case-insensitive searching works
  card = AB.getCardFromProperty("JobTitle", "JobTitle1", true);
  check_correct_card(card);
  card = AB.getCardFromProperty("JobTitle", "JobTitle1", false);
  check_correct_card(card);

  do_check_eq(AB.getCardFromProperty("JobTitle", "jobtitle1", true), null);

  card = AB.getCardFromProperty("JobTitle", "jobtitle1", false);
  check_correct_card(card);

  var cards = AB.getCardsFromProperty("LastName", "DOE", true);
  do_check_false(cards.hasMoreElements());

  cards = AB.getCardsFromProperty("LastName", "Doe", true);
  var i = 0;
  var data = [ 'John', 'Jane' ];

  while (cards.hasMoreElements()) {
    i++;
    card = cards.getNext().QueryInterface(Components.interfaces.nsIAbCard);
    do_check_eq(card.lastName, 'Doe');
    var index = data.indexOf(card.firstName);
    do_check_neq(index, -1);
    delete data[index];
  }
  do_check_eq(i, 2);
};
