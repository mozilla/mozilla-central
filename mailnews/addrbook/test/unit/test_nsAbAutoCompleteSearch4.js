/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Fourth Test suite for nsAbAutoCompleteSearch - test for second email address.
 */

const ACR = Components.interfaces.nsIAutoCompleteResult;

const cards = [
  { email: "primary@invalid.com", secondEmail: "second@invalid.com",
    firstName: "" },
  { email: "test1@invalid.com", secondEmail: "test2@invalid.com",
    firstName: "firstName" },
  { email: "bar1@invalid.com", secondEmail: "bar2@invalid.com",
    firstName: "sweet" },
  { email: "boo1@invalid.com", secondEmail: "boo2@invalid.com",
    firstName: "sample" },
  { email: "name@invalid.com", secondEmail: "thename@invalid.com",
    firstName: "thename" }
];

// These are for the initial search
const searches = [ "primary", "second", "firstName", "thename" ];

const expectedResults = [ [ "primary@invalid.com" ],
                          [ "second@invalid.com" ],
                          [ "test1@invalid.com",
                            "test2@invalid.com" ],
                          [ "name@invalid.com",
                            "thename@invalid.com" ],
                          ];

// These are for subsequent searches - reducing the number of results.
const reductionSearches = [ "b", "bo", "boo2" ];

const reductionExpectedResults = [ [ "bar1@invalid.com",
                                     "bar2@invalid.com",
                                     "boo1@invalid.com",
                                     "boo2@invalid.com" ],
                                   [ "boo1@invalid.com",
                                     "boo2@invalid.com" ],
                                   [ "boo2@invalid.com" ] ];

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
    card.setProperty("SecondEmail", element.secondEmail);
    card.displayName = element.displayName;
    card.setProperty("PopularityIndex", element.popularityIndex);
    card.firstName = element.firstName;

    ab.addCard(card);
  }

  cards.forEach(createAndAddCard);

  var acs = Components.classes["@mozilla.org/autocomplete/search;1?name=addrbook"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);

  var obs = new acObserver();

  print("Checking Initial Searches");

  function checkSearch(element, index, array) {
    acs.startSearch(element, null, null, obs);

    do_check_eq(obs._search, acs);
    do_check_eq(obs._result.searchString, element);
    do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
    do_check_eq(obs._result.errorDescription, null);
    do_check_eq(obs._result.matchCount, expectedResults[index].length);

    for (var i = 0; i < expectedResults[index].length; ++i) {
      do_check_eq(obs._result.getValueAt(i), expectedResults[index][i]);
      do_check_eq(obs._result.getCommentAt(i), "");
      do_check_eq(obs._result.getStyleAt(i), "local-abook");
      do_check_eq(obs._result.getImageAt(i), "");
      obs._result.QueryInterface(Ci.nsIAbAutoCompleteResult);
    }
  }

  searches.forEach(checkSearch);

  print("Checking Reduction of Search Results");

  var lastResult = null;

  function checkReductionSearch(element, index, array) {
    acs.startSearch(element, null, lastResult, obs);

    do_check_eq(obs._search, acs);
    do_check_eq(obs._result.searchString, element);
    do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
    do_check_eq(obs._result.errorDescription, null);
    do_check_eq(obs._result.matchCount, reductionExpectedResults[index].length);

    for (var i = 0; i < reductionExpectedResults[index].length; ++i) {
      do_check_eq(obs._result.getValueAt(i), reductionExpectedResults[index][i]);
      do_check_eq(obs._result.getCommentAt(i), "");
      do_check_eq(obs._result.getStyleAt(i), "local-abook");
      do_check_eq(obs._result.getImageAt(i), "");
      obs._result.QueryInterface(Ci.nsIAbAutoCompleteResult);
    }
    lastResult = obs._result;
  }
  reductionSearches.forEach(checkReductionSearch);
}
