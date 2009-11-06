/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

load("resources/glodaTestHelper.js");

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
  var books = Cc["@mozilla.org/abmanager;1"]
                .getService(Ci.nsIAbManager)
                .directories;

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

  Cc["@mozilla.org/abmanager;1"]
    .getService(Components.interfaces.nsIAbManager)
    .getDirectory(book.URI)
    .deleteCards(cardArray);
}

function get_cached_gloda_identity_for_email(aEmailAddress) {
  return GlodaCollectionManager.cacheLookupOneByUniqueValue(
    Gloda.NOUN_IDENTITY, "email@" + aEmailAddress.toLowerCase());
}

const EMAIL_ADDRESS = "all.over@the.world";
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
