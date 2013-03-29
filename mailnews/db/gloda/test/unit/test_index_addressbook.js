/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

load("resources/glodaTestHelper.js");

Components.utils.import("resource:///modules/mailServices.js");

var gInbox;

function add_card(aEmailAddress, aDisplayName) {
  Cc["@mozilla.org/addressbook/services/addressCollector;1"]
    .getService(Ci.nsIAbAddressCollector)
    .collectSingleAddress(aEmailAddress,
                          aDisplayName, true,
                          Ci.nsIAbPreferMailFormat.unknown,
                          true);
}

function get_card_for_email(aEmailAddress) {
  let books = MailServices.ab.directories;

  let book, card;

  while (books.hasMoreElements()) {
    book = books.getNext()
                  .QueryInterface(Ci.nsIAbDirectory);
    var card = book.cardForEmailAddress(aEmailAddress);
    if (card)
      return [book, card];
  }
  return [null, null];
}

function delete_card(aEmailAddress) {
  let [book, card] = get_card_for_email(aEmailAddress);

  let cardArray = Cc["@mozilla.org/array;1"]
                    .createInstance(Ci.nsIMutableArray);
  cardArray.appendElement(card, false);

  MailServices.ab.getDirectory(book.URI)
              .deleteCards(cardArray);
}

function get_cached_gloda_identity_for_email(aEmailAddress) {
  return GlodaCollectionManager.cacheLookupOneByUniqueValue(
    Gloda.NOUN_IDENTITY, "email@" + aEmailAddress.toLowerCase());
}

const EMAIL_ADDRESS = "all.over@the.world.invalid";
const DISPLAY_NAME = "every day";

let identityCollection;

/**
 * Create an e-mail so the identity can exist.
 */
function setup_create_identity() {
  let [msgSet] = make_new_sets_in_folder(gInbox, [
                   {count: 1, from: [DISPLAY_NAME, EMAIL_ADDRESS]}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet);

  // okay, but it knows it has no card because indexing thinks stuff.
  // so let's flush all caches and create a query that just knows about the
  //  identity.
  nukeGlodaCachesAndCollections();

  let identQuery = Gloda.newQuery(Gloda.NOUN_IDENTITY);
  identQuery.kind("email");
  identQuery.value(EMAIL_ADDRESS);
  identityCollection = queryExpect(identQuery, [EMAIL_ADDRESS]);
  yield false;

  // now the identity exists... make sure it is in cache.
  let identity = get_cached_gloda_identity_for_email(EMAIL_ADDRESS);
  do_check_neq(identity, null);

  // and make sure it has no idea what the current state of the card is.
  if (identity._hasAddressBookCard !== undefined)
    do_throw("We should have no idea about the state of the ab card, but " +
             "it's: " + identity._hasAddressBookCard);
}

/**
 * (Re-)Add a card for that e-mail, make sure we update the cached identity ab
 *  card state.
 */
function test_add_card_cache_indication() {
  add_card(EMAIL_ADDRESS, DISPLAY_NAME);

  let identity = get_cached_gloda_identity_for_email(EMAIL_ADDRESS);
  do_check_eq(identity._hasAddressBookCard, true);
}

/**
 * Remove the card we added in setup, make sure we update the cached identity
 *  ab card state.
 */
function test_remove_card_cache_indication() {
  delete_card(EMAIL_ADDRESS);

  let identity = get_cached_gloda_identity_for_email(EMAIL_ADDRESS);
  do_check_eq(identity._hasAddressBookCard, false);
}


let tests = [
  // - events update identity._hasAddressBookCard correctly
  setup_create_identity,
  test_add_card_cache_indication,
  test_remove_card_cache_indication,
  // add it back again
  test_add_card_cache_indication,
];

function run_test() {
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
