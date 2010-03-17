/*
 * Fourth Test suite for nsAbAutoCompleteSearch - test for second email address.
 */

const ACR = Components.interfaces.nsIAutoCompleteResult;

const cards = [
  // Basic tests for primary and secondary emails.
  { email: "primary@test.invalid", secondEmail: "second@test.invalid",
    firstName: "" },
  { email: "test1@test.invalid", secondEmail: "test2@test.invalid",
    firstName: "firstName" },
  { email: "bar1@test.invalid", secondEmail: "bar2@test.invalid",
    firstName: "sweet" },
  { email: "boo1@test.invalid", secondEmail: "boo2@test.invalid",
    firstName: "sample" },
  { email: "name@test.invalid", secondEmail: "thename@test.invalid",
    firstName: "thename" },
  // Test to check correct sorting of primary and secondary emails.
  { email: "foo_b@test.invalid", secondEmail: "foo_a@test.invalid",
    displayName: "sortbasic" },
  { email: "d@test.invalid", secondEmail: "e@test.invalid",
    displayName: "testsort" },
  { email: "c@test.invalid", secondEmail: "a@test.invalid",
    displayName: "testsort" },
  // "2testsort" does the same as "testsort" but turns the cards around to
  // ensure the order is always consistent.
  { email: "c@test.invalid", secondEmail: "a@test.invalid",
    displayName: "2testsort" },
  { email: "d@test.invalid", secondEmail: "e@test.invalid",
    displayName: "2testsort" },
  { email: "g@test.invalid", secondEmail: "f@test.invalid",
    displayName: "3testsort", popularityIndex: 3 },
  { email: "j@test.invalid", secondEmail: "h@test.invalid",
    displayName: "3testsort", popularityIndex: 5 }
];

// These are for the initial search
const searches = [ "primary", "second", "firstName", "thename", "sortbasic",
                   "testsort", "2testsort", "3testsort" ];

const expectedResults = [ [ "primary@test.invalid" ],
                          [ "second@test.invalid" ],
                          [ "test1@test.invalid",
                            "test2@test.invalid" ],
                          [ "name@test.invalid",
                            "thename@test.invalid" ],
                          [ "sortbasic <foo_b@test.invalid>",
                            "sortbasic <foo_a@test.invalid>" ],
                          [ "testsort <c@test.invalid>",
                            "testsort <a@test.invalid>",
                            "testsort <d@test.invalid>",
                            "testsort <e@test.invalid>" ],
                          [ "2testsort <c@test.invalid>",
                            "2testsort <a@test.invalid>",
                            "2testsort <d@test.invalid>",
                            "2testsort <e@test.invalid>" ],
                          [ "3testsort <j@test.invalid>",
                            "3testsort <h@test.invalid>",
                            "3testsort <g@test.invalid>",
                            "3testsort <f@test.invalid>" ] ];

// These are for subsequent searches - reducing the number of results.
const reductionSearches = [ "b", "bo", "boo2" ];

const reductionExpectedResults = [ [ "bar1@test.invalid",
                                     "bar2@test.invalid",
                                     "boo1@test.invalid",
                                     "boo2@test.invalid" ],
                                   [ "boo1@test.invalid",
                                     "boo2@test.invalid" ],
                                   [ "boo2@test.invalid" ] ];

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
