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

  // Set up an identity in the account manager with the default settings
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var identity = acctMgr.createIdentity();

  // Initially disable autocomplete
  identity.autocompleteToMyDomain = false;
  identity.email = "myemail@invalid.com";

  // Test - Valid search - this should return no results (autocomplete disabled)
  acs.startSearch("test", identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "test");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Now enable autocomplete for this identity
  identity.autocompleteToMyDomain = true;

  // Test - Search with empty string

  acs.startSearch(null, identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, null);
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  acs.startSearch("", identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Test - Check ignoring result with comma

  acs.startSearch("a,b", identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "a,b");
  do_check_eq(obs._result.searchResult, ACR.RESULT_FAILURE);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 0);

  // Test - Check returning search string with @ sign

  acs.startSearch("a@b", identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "a@b");
  do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 1);

  do_check_eq(obs._result.getValueAt(0), "a@b");
  do_check_eq(obs._result.getCommentAt(0), null);
  do_check_eq(obs._result.getStyleAt(0), "default-match");
  do_check_eq(obs._result.getImageAt(0), null);

  // Test - Add default domain

  acs.startSearch("test1", identity.key, null, obs);

  do_check_eq(obs._search, acs);
  do_check_eq(obs._result.searchString, "test1");
  do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
  do_check_eq(obs._result.errorDescription, null);
  do_check_eq(obs._result.matchCount, 1);

  do_check_eq(obs._result.getValueAt(0), "test1@invalid.com");
  do_check_eq(obs._result.getCommentAt(0), null);
  do_check_eq(obs._result.getStyleAt(0), "default-match");
  do_check_eq(obs._result.getImageAt(0), null);
};
