/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Second Test suite for nsAbAutoCompleteSearch - test follow-on lookup after
 * a previous search.
 *
 * We run this test without address books, constructing manually ourselves,
 * so that we can ensure that we're not getting the data out of the address
 * books.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

// taken from nsAbAutoCompleteSearch.js
const ACR = Components.interfaces.nsIAutoCompleteResult;
const nsIAbAutoCompleteResult = Components.interfaces.nsIAbAutoCompleteResult;

function nsAbAutoCompleteResult(aSearchString) {
  // Can't create this in the prototype as we'd get the same array for
  // all instances
  this._searchResults = new Array();
  this.searchString = aSearchString;
}

nsAbAutoCompleteResult.prototype = {
  _searchResults: null,

  // nsIAutoCompleteResult

  searchString: null,
  searchResult: ACR.RESULT_NOMATCH,
  defaultIndex: -1,
  errorDescription: null,

  get matchCount() {
    return this._searchResults.length;
  },

  getValueAt: function getValueAt(aIndex) {
    return this._searchResults[aIndex].value;
  },

  getCommentAt: function getCommentAt(aIndex) {
    return this._searchResults[aIndex].comment;
  },

  getStyleAt: function getStyleAt(aIndex) {
    return "local-abook";
  },

  getImageAt: function getImageAt(aIndex) {
    return "";
  },

  removeValueAt: function removeValueAt(aRowIndex, aRemoveFromDB) {
  },

  // nsIAbAutoCompleteResult

  getCardAt: function getCardAt(aIndex) {
    return this._searchResults[aIndex].card;
  },

  // nsISupports

  QueryInterface: XPCOMUtils.generateQI([ACR, nsIAbAutoCompleteResult])
}

function createCard(chars, popularity) {
  var card = Components.classes["@mozilla.org/addressbook/cardproperty;1"]
                       .createInstance(Components.interfaces.nsIAbCard);

  card.firstName = "firstName".slice(0, chars);
  card.lastName = "lastName".slice(0, chars);
  card.displayName = "displayName".slice(0, chars);
  card.primaryEmail = "email".slice(0, chars) + "@invalid.com";
  card.setProperty("NickName", "nickName".slice(0, chars));

  return card;
}

const lastSearchCards = [ createCard(1, 0), createCard(2, 0), createCard(3, 0) ];

const results = [ { email: "d <e@invalid.com>", dirName: kPABData.dirName },
                  { email: "di <em@invalid.com>", dirName: kPABData.dirName },
                  { email: "dis <ema@invalid.com>", dirName: kPABData.dirName } ];

const firstNames = [ { search: "fi",     expected: [1, 2] },
                     { search: "fir",    expected: [2] } ];

const lastNames = [ { search: "la",     expected: [1, 2] },
                    { search: "las",    expected: [2] } ];

const displayNames = [ { search: "d",      expected: [5, 0, 1, 2, 3, 4] },
                       { search: "di",     expected: [5, 1, 2, 3, 4] },
                       { search: "dis",    expected: [5, 2, 3, 4] },
                       { search: "disp",   expected: [5, 3, 4]},
                       { search: "displ",  expected: [5, 4]},
                       { search: "displa", expected: [5]} ];

const nickNames = [ { search: "n",      expected: [5, 0, 1, 2, 3, 4] },
                    { search: "ni",     expected: [5, 0, 1, 2, 3] },
                    { search: "nic",    expected: [5, 1, 2, 3] },
                    { search: "nick",   expected: [5, 2, 3] },
                    { search: "nickn",  expected: [5, 3] },
                    { search: "nickna", expected: [5] } ];

const emails = [ { search: "e",     expected: [0, 1, 2, 3, 4] },
                 { search: "em",    expected: [0, 1, 2, 4] },
                 { search: "ema",   expected: [0, 1, 2] },
                 { search: "emai",  expected: [1, 2] },
                 { search: "email", expected: [2] } ];

// "l" case tested above
const lists = [ { search: "li", expected: [6, 7, 8] },
                { search: "lis", expected: [6, 7] },
                { search: "list", expected: [6] },
                { search: "t", expected: [6, 7, 8, 9] },
                { search: "te", expected: [7, 8, 9] },
                { search: "tes", expected: [8, 9] },
                { search: "test", expected: [9] } ];

const inputs = [ firstNames, lastNames];//, displayNames, nickNames, emails, lists ];

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

  var acs = Components.classes["@mozilla.org/autocomplete/search;1?name=addrbook"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);

  var obs = new acObserver();

  // Ensure we've got the comment column set up for extra checking.
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setIntPref("mail.autoComplete.commentColumn", 1);

  // Make up the last autocomplete result
  var lastResult = new nsAbAutoCompleteResult();

  lastResult.searchString = "";
  lastResult.searchResult = ACR.RESULT_SUCCESS;
  lastResult.defaultIndex = 0;
  lastResult.errorDescription = null;
  for (var i = 0; i < results.length; ++i) {
    lastResult._searchResults.push({
      value: results[i].email,
      comment: results[i].dirName,
      card: createCard(i + 1, 0)
    });
  }


  // Test - Matches

  // Now check multiple matches
  function checkInputItem(element, index, array) {
    acs.startSearch(element.search, null, lastResult, obs);

    do_check_eq(obs._search, acs);
    do_check_eq(obs._result.searchString, element.search);
    do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
    do_check_eq(obs._result.errorDescription, null);
    do_check_eq(obs._result.matchCount, element.expected.length);

    for (var i = 0; i < element.expected.length; ++i) {
      do_check_eq(obs._result.getValueAt(i), results[element.expected[i]].email);
      do_check_eq(obs._result.getCommentAt(i), results[element.expected[i]].dirName);
      do_check_eq(obs._result.getStyleAt(i), "local-abook");
      do_check_eq(obs._result.getImageAt(i), "");
    }
  }
  function checkInputSet(element, index, array) {
    element.forEach(checkInputItem);
  }

  inputs.forEach(checkInputSet);
};
