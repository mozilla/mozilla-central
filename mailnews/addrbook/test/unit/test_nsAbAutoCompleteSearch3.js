/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Third Test suite for nsAbAutoCompleteSearch - test for duplicate elimination
 */

const ACR = Components.interfaces.nsIAutoCompleteResult;

const cards = [
  { email: "test@invalid.com", displayName: "",
    popularityIndex: 0, firstName: "test0", value: "test@invalid.com" },
  { email: "test@invalid.com", displayName: "",
    popularityIndex: 1, firstName: "test1", value: "test@invalid.com" },
  { email: "abc@invalid.com", displayName: "",
    popularityIndex: 1, firstName: "test2", value: "abc@invalid.com" },
  { email: "foo1@invalid.com", displayName: "d",
    popularityIndex: 0, firstName: "first1", value: "d <foo1@invalid.com>" },
  { email: "foo2@invalid.com", displayName: "di",
    popularityIndex: 1, firstName: "first1", value: "di <foo2@invalid.com>" },
  { email: "foo3@invalid.com", displayName: "dis",
    popularityIndex: 2, firstName: "first2", value: "dis <foo3@invalid.com>" },
  { email: "foo2@invalid.com", displayName: "di",
    popularityIndex: 3, firstName: "first2", value: "di <foo2@invalid.com>" }
];

const duplicates = [
  { search: "test", expected: [2, 1] },
  { search: "first", expected: [6, 5, 3] }
];


function acObserver() {}

acObserver.prototype = {
  _search: null,
  _result: null,

  onSearchResult: function (aSearch, aResult) {
    this._search = aSearch;
    this._result = aResult;
  }
};

function run_test()
{
  // We set up the cards for this test manually as it is easier to set the
  // popularity index and we don't need many.

  var abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);

  // Ensure all the directories are initialised.
  abManager.directories;

  var ab = abManager.getDirectory(kPABData.URI);

  function createAndAddCard(element) {
    var card = Cc["@mozilla.org/addressbook/cardproperty;1"]
                 .createInstance(Ci.nsIAbCard);

    card.primaryEmail = element.email;
    card.displayName = element.displayName;
    card.popularityIndex = element.popularityIndex;
    card.firstName = element.firstName;

    ab.addCard(card);
  }

  cards.forEach(createAndAddCard);

  // Test - duplicate elements

  var acs = Components.classes["@mozilla.org/autocomplete/search;1?name=addrbook"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);

  var obs = new acObserver();

  function checkInputItem(element, index, array) {
    print("Checking " + element.search);
    acs.startSearch(element.search, null, null, obs);

    do_check_eq(obs._search, acs);
    do_check_eq(obs._result.searchString, element.search);
    do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
    do_check_eq(obs._result.errorDescription, null);
    do_check_eq(obs._result.matchCount, element.expected.length);

    for (var i = 0; i < element.expected.length; ++i)
      print(obs._result.getValueAt(i));

    for (var i = 0; i < element.expected.length; ++i) {
      do_check_eq(obs._result.getValueAt(i), cards[element.expected[i]].value);
      do_check_eq(obs._result.getCommentAt(i), "");
      do_check_eq(obs._result.getStyleAt(i), "local-abook");
      do_check_eq(obs._result.getImageAt(i), "");
      obs._result.QueryInterface(Ci.nsIAbAutoCompleteResult);
      do_check_eq(obs._result.getCardAt(i).firstName,
                  cards[element.expected[i]].firstName);
    }
  }

  duplicates.forEach(checkInputItem);
}
