/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for checking we get the correct notifications when cards are
 * modified.
 *
 * XXX Still to do:
 * - Editing a mailing list properties (name/nickname/notes)
 * - Adding, editing and deleting items in mailing lists
 */

var abListener = {
  result: [],
  maxResults: 1,
  onItemAdded: function (parentItem, item) {
    do_check_true(this.result.length < this.maxResults);
    this.result.push(["onItemAdded", parentItem, item]);
  },
  onItemRemoved: function (parentItem, item) {
    do_check_true(this.result.length < this.maxResults);
    this.result.push(["onItemRemoved", parentItem, item]);
  },
  onItemPropertyChanged: function (item, property, oldValue, newValue) {
    do_check_true(this.result.length < this.maxResults);
    this.result.push(["onItemPropertyChanged", item, property, oldValue, newValue]);
  }
};

function run_test() {
  var i;

  // XXX Getting all directories ensures we create all ABs because the
  // address collecter can't currently create ABs itself (bug 314448).
  MailServices.ab.directories;

  // Add a listener
  MailServices.ab.addAddressBookListener(abListener, Ci.nsIAbListener.all);

  // Get the directory
  let AB = MailServices.ab.getDirectory(kPABData.URI);

  // For card tests, the most we expect is one notification.
  abListener.maxResults = 1;

  // Test - add a card

  var card = Cc["@mozilla.org/addressbook/cardproperty;1"]
               .createInstance(Ci.nsIAbCard);

  card.firstName = "test";
  card.primaryEmail = "test@foo.invalid";

  var newCard = AB.addCard(card);

  do_check_true(newCard instanceof Ci.nsIAbCard);
  do_check_eq(abListener.result[0][0], "onItemAdded");
  do_check_eq(abListener.result[0][1], AB);
  do_check_eq(abListener.result[0][2], newCard);
  abListener.result = [];

  // Test - modify a card

  newCard.lastName = "invalid";

  AB.modifyCard(newCard);

  do_check_eq(abListener.result[0][0], "onItemPropertyChanged");
  do_check_eq(abListener.result[0][1], newCard);
  do_check_eq(abListener.result[0][2], null);
  do_check_eq(abListener.result[0][3], null);
  do_check_eq(abListener.result[0][4], null);
  abListener.result = [];

  // Test - delete a card

  var cardsToDelete = Cc["@mozilla.org/array;1"]
                        .createInstance(Ci.nsIMutableArray);

  cardsToDelete.appendElement(newCard, false);

  AB.deleteCards(cardsToDelete);

  do_check_eq(abListener.result[0][0], "onItemRemoved");
  do_check_eq(abListener.result[0][1], AB);
  do_check_eq(abListener.result[0][2], newCard);
  abListener.result = [];

  print("Finished Cards");

  // Test - add a mailing list

  var mailList = Cc["@mozilla.org/addressbook/directoryproperty;1"]
                   .createInstance(Ci.nsIAbDirectory);

  mailList.isMailList = true;
  mailList.dirName = "TestList";
  mailList.listNickName = "test";
  mailList.description = "testdescription";

  // For mailing list addition, we expect 2 results, one for the card, one
  // for the directory
  abListener.maxResults = 2;

  AB.addMailList(mailList);
 
  do_check_eq(abListener.result.length, 2);
  do_check_eq(abListener.result[0][0], "onItemAdded");
  do_check_eq(abListener.result[0][1], AB);
  do_check_eq(abListener.result[1][0], "onItemAdded");
  do_check_eq(abListener.result[1][1], AB);

  // Now verify the card and the directory
  card = abListener.result[0][2].QueryInterface(Ci.nsIAbCard);
  do_check_true(card.isMailList);
  do_check_eq(card.displayName, "TestList");
  do_check_eq(card.getProperty("Notes", "BAD"), "testdescription");
  do_check_eq(card.getProperty("NickName", "BAD"), "test");

  var book = abListener.result[1][2].QueryInterface(Ci.nsIAbDirectory);
  do_check_true(book.isMailList);
  do_check_eq(book.dirName, "TestList");
  do_check_eq(book.listNickName, "test");
  do_check_eq(book.description, "testdescription");

  abListener.result = [];

  // Test - Remove a list.

  AB.deleteDirectory(book);

  do_check_eq(abListener.result.length, 2);
  do_check_eq(abListener.result[0][0], "onItemRemoved");
  do_check_eq(abListener.result[0][1], AB);
  do_check_eq(abListener.result[1][0], "onItemRemoved");
  do_check_eq(abListener.result[1][1], AB);

  // Now verify the card and the directory
  card = abListener.result[0][2].QueryInterface(Ci.nsIAbCard);
  do_check_true(card.isMailList);
  do_check_eq(card.displayName, "TestList");
  do_check_eq(card.getProperty("Notes", "BAD"), "testdescription");
  do_check_eq(card.getProperty("NickName", "BAD"), "test");

  var book = abListener.result[1][2].QueryInterface(Ci.nsIAbDirectory);
  do_check_true(book.isMailList);
  do_check_eq(book.dirName, "TestList");
  do_check_eq(book.listNickName, "test");
  do_check_eq(book.description, "testdescription");

  // Remove listener

  MailServices.ab.removeAddressBookListener(abListener);
};
