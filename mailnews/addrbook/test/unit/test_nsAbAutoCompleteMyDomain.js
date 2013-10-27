/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsAbAutoCompleteSearch
 */

const ACR = Components.interfaces.nsIAutoCompleteResult;

function acObserver() {}

acObserver.prototype = {
  _search: null,
  _result: null,

  onSearchResult: function (aSearch, aResult) {
    this._search = aSearch;
    this._result = aResult;
  }
};

function run_test() {
  // Test - Create a new search component

  var acs = Components.classes["@mozilla.org/autocomplete/search;1?name=mydomain"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);

  var obs = new acObserver();
  let obsNews = new acObserver();
  let obsFollowup = new acObserver();

  // Set up an identity in the account manager with the default settings
  let identity = MailServices.accounts.createIdentity();

  // Initially disable autocomplete
  identity.autocompleteToMyDomain = false;
  identity.email = "myemail@foo.invalid";

  // Set up autocomplete parameters
  let params = JSON.stringify({ idKey: identity.key, type: "addr_to" });
  let paramsNews = JSON.stringify({ idKey: identity.key, type: "addr_newsgroups" });
  let paramsFollowup = JSON.stringify({ idKey: identity.key, type: "addr_followup" });

  // Test - Valid search - this should return no results (autocomplete disabled)
  acs.startSearch("test", params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "test");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Now enable autocomplete for this identity
  identity.autocompleteToMyDomain = true;

  // Test - Search with empty string

  acs.startSearch(null, params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, null);
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  acs.startSearch("", params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Test - Check ignoring result with comma

  acs.startSearch("a,b", params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "a,b");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Test - Check returning search string with @ sign

  acs.startSearch("a@b", params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "a@b");
  do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 1);

  do_check_eq(obs._result.getValueAt(0), "a@b");
  do_check_eq(obs._result.getLabelAt(0), "a@b");
  do_check_eq(obs._result.getCommentAt(0), null);
  do_check_eq(obs._result.getStyleAt(0), "default-match");
  do_check_eq(obs._result.getImageAt(0), null);

  // No autocomplete for addr_newsgroups!
  acs.startSearch("a@b", paramsNews, null, obsNews);
  do_check_true(obsNews._result == null || obsNews._result.matchCount == 0);

  // No autocomplete for addr_followup!
  acs.startSearch("a@b", paramsFollowup, null, obsFollowup);
  do_check_true(obsFollowup._result == null || obsFollowup._result.matchCount == 0);


  // Test - Add default domain

  acs.startSearch("test1", params, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "test1");
  do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 1);

  do_check_eq(obs._result.getValueAt(0), "test1@foo.invalid");
  do_check_eq(obs._result.getLabelAt(0), "test1@foo.invalid");
  do_check_eq(obs._result.getCommentAt(0), null);
  do_check_eq(obs._result.getStyleAt(0), "default-match");
  do_check_eq(obs._result.getImageAt(0), null);
};
