/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for the Address Collector Service.
 *
 * This tests the main collection functions for adding new cards and modifying
 * existing ones.
 *
 * Tests against cards in different ABs are done in test_collection_2.js.
 */

const nsIAbPMF = Components.interfaces.nsIAbPreferMailFormat;

// Source fields (emailHeader/mailFormat) and expected results for use for
// testing the addition of new addresses to the database.
//
// Note: these email addresses should be different to allow collecting an
// address to add a different card each time.
var addEmailChecks =
  // First 3 items aimed at basic collection and mail format.
  [ { emailHeader: "test0@invalid.com",
      primaryEmail: "test0@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    { emailHeader: "test1@invalid.com",
      primaryEmail: "test1@invalid.com",
      mailFormat: nsIAbPMF.plaintext,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    { emailHeader: "test2@invalid.com",
      primaryEmail: "test2@invalid.com",
      mailFormat: nsIAbPMF.html,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    // UTF-8 based addresses (bug 407564)
    { emailHeader: "test0@\u00D0.com",
      primaryEmail: "test0@\u00D0.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    { emailHeader: "test0\u00D0@invalid.com",
      primaryEmail: "test0\u00D0@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    // Screen names
    { emailHeader: "invalid\u00D00@aol.com",
      primaryEmail: "invalid\u00D00@aol.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "invalid\u00D00" },
    { emailHeader: "invalid1\u00D00@cs.com",
      primaryEmail: "invalid1\u00D00@cs.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "invalid1\u00D00" },
    { emailHeader: "invalid2\u00D00@netscape.net",
      primaryEmail: "invalid2\u00D00@netscape.net",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "invalid2\u00D00" },
    // Collection of names
    { emailHeader: "Test User <test3@invalid.com>",
      primaryEmail: "test3@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "Test User",
      firstName: "Test",
      lastName: "User",
      screenName: "" },
    { emailHeader: "Test <test4@invalid.com>",
      primaryEmail: "test4@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "Test",
      firstName: "",
      lastName: "",
      screenName: "" },
    // Collection of names with UTF-8 specific items
    { emailHeader: "Test\u00D0 User <test5@invalid.com>",
      primaryEmail: "test5@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "Test\u00D0 User",
      firstName: "Test\u00D0",
      lastName: "User",
      screenName: "" },
    { emailHeader: "Test\u00D0 <test6@invalid.com>",
      primaryEmail: "test6@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "Test\u00D0",
      firstName: "",
      lastName: "",
      screenName: "" },
    ];

// Source fields (emailHeader/mailFormat) and expected results for use for
// testing the modification of cards in the database.
//
// Note: these sets re-use some of the ones for ease of definition.
var modifyEmailChecks =
  // No display name/other details. Add details and modify mail format.
  [ { emailHeader: "Modify User\u00D0 <test0@\u00D0.com>",
      primaryEmail: "test0@\u00D0.com",
      mailFormat: nsIAbPMF.html,
      displayName: "Modify User\u00D0",
      firstName: "Modify",
      lastName: "User\u00D0",
      screenName: "" },
    { emailHeader: "Modify <test0\u00D0@invalid.com>",
      primaryEmail: "test0\u00D0@invalid.com",
      mailFormat: nsIAbPMF.plaintext,
      displayName: "Modify",
      firstName: "",
      lastName: "",
      screenName: "" },
    // No modification of existing cards with display names
    { emailHeader: "Modify2 User\u00D02 <test0@\u00D0.com>",
      primaryEmail: "test0@\u00D0.com",
      mailFormat: nsIAbPMF.html,
      displayName: "Modify User\u00D0",
      firstName: "Modify",
      lastName: "User\u00D0",
      screenName: "" },
    { emailHeader: "Modify3 <test0\u00D0@invalid.com>",
      primaryEmail: "test0\u00D0@invalid.com",
      mailFormat: nsIAbPMF.plaintext,
      displayName: "Modify",
      firstName: "",
      lastName: "",
      screenName: "" },
    // Check no modification of cards for mail format where format is not
    // "unknown".
    { emailHeader: "Modify User\u00D0 <test0@\u00D0.com>",
      primaryEmail: "test0@\u00D0.com",
      mailFormat: nsIAbPMF.plaintext,
      mailFormatOut: nsIAbPMF.html,
      displayName: "Modify User\u00D0",
      firstName: "Modify",
      lastName: "User\u00D0",
      screenName: "" },
    { emailHeader: "Modify <test0\u00D0@invalid.com>",
      primaryEmail: "test0\u00D0@invalid.com",
      mailFormat: nsIAbPMF.html,
      mailFormatOut: nsIAbPMF.plaintext,
      displayName: "Modify",
      firstName: "",
      lastName: "",
      screenName: "" },
    // No modification of cards with email in second email address.
    { emailHeader: "Modify Secondary <usersec\u00D0@invalid.com>",
      primaryEmail: "userprim\u00D0@invalid.com",
      secondEmail: "usersec\u00D0@invalid.com",
      mailFormat: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
    { emailHeader: "Modify <usersec\u00D0@invalid.com>",
      primaryEmail: "userprim\u00D0@invalid.com",
      secondEmail: "usersec\u00D0@invalid.com",
      mailFormat: nsIAbPMF.html,
      mailFormatOut: nsIAbPMF.unknown,
      displayName: "",
      firstName: "",
      lastName: "",
      screenName: "" },
   ];

var collectChecker = {
  addressCollect: null,
  AB: null,
  part: 0,

  checkAddress : function (aDetails) {
    try {
      this.addressCollect.collectAddress(aDetails.emailHeader, true,
                                         aDetails.mailFormat);

      this.checkCardResult(aDetails, false);
    }
    catch (e) {
      throw "FAILED in checkAddress emailHeader: " + aDetails.emailHeader +
      " part: " + this.part + " : " + e;
    }
    ++this.part;
  },

  checkAll : function (aDetailsArray) {
    try {
      // Formulate the string to add.
      var emailHeader = "";
      var i;

      for (i = 0; i < aDetailsArray.length - 1; ++i)
        emailHeader += aDetailsArray[i].emailHeader + ", ";

      emailHeader += aDetailsArray[aDetailsArray.length - 1].emailHeader;

      // Now add it. In this case we just set the Mail format Type to unknown.
      this.addressCollect.collectAddress(emailHeader, true,
                                         nsIAbPMF.unknown);

      for (i = 0; i < aDetailsArray.length; ++i)
        this.checkCardResult(aDetailsArray[i], true);
    }
    catch (e) {
      throw "FAILED in checkAll item: " + i + " : " + e;
    }
  },

  checkCardResult : function (aDetails, overrideMailFormat) {
    try {
      var card = this.AB.cardForEmailAddress(aDetails.primaryEmail);

      do_check_true(card != null);

      if ("secondEmail" in aDetails)
        do_check_eq(card.getProperty("SecondEmail", "BAD"), aDetails.secondEmail);

      if (overrideMailFormat)
        do_check_eq(card.getProperty("PreferMailFormat", "BAD"), nsIAbPMF.unknown);
      else if ("mailFormatOut" in aDetails)
        do_check_eq(card.getProperty("PreferMailFormat", "BAD"), aDetails.mailFormatOut);
      else
        do_check_eq(card.getProperty("PreferMailFormat", "BAD"), aDetails.mailFormat);

      do_check_eq(card.displayName, aDetails.displayName);
      do_check_eq(card.firstName, aDetails.firstName);
      do_check_eq(card.lastName, aDetails.lastName);
      do_check_eq(card.getProperty("_AimScreenName", ""), aDetails.screenName);
    }
    catch (e) {
      throw "FAILED in checkCardResult emailHeader: " + aDetails.emailHeader + " : " + e;
    }
  }
};

function run_test()
{
  // Test - Get the address collecter

  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch);

  var abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);

  // XXX Getting all directories ensures we create all ABs because the
  // address collecter can't currently create ABs itself (bug 314448).
  var temp = abManager.directories;

  // Get the actual AB for the collector so we can check cards have been
  // added.
  collectChecker.AB =
    abManager.getDirectory(prefService.getCharPref("mail.collect_addressbook"));

  // Get the actual collecter
  collectChecker.addressCollect =
    Components.classes["@mozilla.org/addressbook/services/addressCollector;1"]
              .getService(Components.interfaces.nsIAbAddressCollector);

  // Test - Addition of header without email address.

  collectChecker.addressCollect.collectAddress("MyTest <>", true,
                                               nsIAbPMF.unknown);

  // Address book should have no cards present.
  do_check_false(collectChecker.AB.childCards.hasMoreElements());

  // Test - Email doesn't exist, but don't add it.

  // As we've just set everything up, we know we haven't got anything in the
  // AB, so just try and collect without adding.
  collectChecker.addressCollect.collectAddress(addEmailChecks[0].emailHeader,
                                               false,
                                               addEmailChecks[0].mailFormat);

  var card = collectChecker.AB.cardForEmailAddress(addEmailChecks[0].emailHeader);

  do_check_true(card == null);

  // Test - Try and collect various emails and formats.

  collectChecker.part = 0;

  addEmailChecks.forEach(collectChecker.checkAddress, collectChecker);

  // Test - Do all emails at the same time.

  // First delete all existing cards
  var childCards = collectChecker.AB.childCards;
  var cardsToDelete = Components.classes["@mozilla.org/array;1"]
                                .createInstance(Components.interfaces.nsIMutableArray);
  while (childCards.hasMoreElements()) {
    cardsToDelete.appendElement(childCards.getNext(), false);
  }

  collectChecker.AB.deleteCards(cardsToDelete);

  // Null these directly, so gc() will purge them
  childCards = null;
  cardsToDelete = null;

  // Address book should have no cards present.
  do_check_false(collectChecker.AB.childCards.hasMoreElements());

  do_check_eq(collectChecker.AB.cardForEmailAddress(addEmailChecks[0].emailHeader), null);

  // Now do all emails at the same time.
  collectChecker.checkAll(addEmailChecks);

  // Test - Try and modify various emails and formats.

  // Add a basic card with just primary and second email to allow testing
  // of the case where we don't modify when second email is matching.
  card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                   .createInstance(Components.interfaces.nsIAbCard);

  card.primaryEmail = "userprim\u00D0@invalid.com";
  card.setProperty("SecondEmail", "usersec\u00D0@invalid.com");

  collectChecker.AB.addCard(card);

  collectChecker.part = 0;

  modifyEmailChecks.forEach(collectChecker.checkAddress, collectChecker);

  // Test collectSingleAddress - Note: because the above tests test
  // collectAddress which we know calls collectSingleAddress, we only need to
  // test the case where aSkipCheckExisting is true.

  // Add an email that is already there and check we get two instances of it in
  // the AB.

  const kSingleAddress = modifyEmailChecks[modifyEmailChecks.length - 1]
                         .primaryEmail;
  const kSingleDisplayName = "Test Single";

  collectChecker.addressCollect.collectSingleAddress(kSingleAddress,
                                                     kSingleDisplayName,
                                                     true,
                                                     nsIAbPMF.unknown,
                                                     true);

  childCards = collectChecker.AB.childCards;
  var foundCards = [];

  while(childCards.hasMoreElements()) {
    var card = childCards.getNext();
    if (card instanceof Ci.nsIAbCard &&
        card.primaryEmail == kSingleAddress)
      foundCards.push(card);
  }

  do_check_eq(foundCards.length, 2);

  if (foundCards[0].displayName != kSingleDisplayName &&
      foundCards[1].displayName != kSingleDisplayName)
    do_throw("Error, collectSingleCard didn't create a new card");

  if (foundCards[0].displayName != "" &&
      foundCards[1].displayName != "")
    do_throw("Error, collectSingleCard created ok, but other card does not exist");
};
