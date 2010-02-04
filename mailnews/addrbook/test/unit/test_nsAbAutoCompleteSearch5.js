/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * This suite ensures that we can correctly read and re-set the popularity
 * indexes on a 
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const ACR = Components.interfaces.nsIAutoCompleteResult;

const results = [ { email: "d <ema@test.invalid>", dirName: kPABData.dirName },
                  { email: "di <emai@test.invalid>", dirName: kPABData.dirName },
                  { email: "dis <email@test.invalid>", dirName: kPABData.dirName },
                  { email: "disp <e@test.invalid>", dirName: kPABData.dirName },
                  { email: "displ <em@test.invalid>", dirName: kPABData.dirName },
                  { email: "t <list>", dirName: kPABData.dirName },
                  { email: "te <lis>", dirName: kPABData.dirName },
                  { email: "tes <li>", dirName: kPABData.dirName },
                  { email: "test <l>", dirName: kPABData.dirName } ];

const firstNames = [ { search: "f",      expected: [4, 0, 1, 2, 3] },
                     { search: "fi",     expected: [4, 0, 1, 3] },
                     { search: "fir",    expected: [4, 0, 1] },
                     { search: "firs",   expected: [0, 1] },
                     { search: "first",  expected: [1] } ];

const lastNames = [ { search: "l",      expected: [4, 0, 1, 2, 3, 5, 6, 7, 8] },
                    { search: "la",     expected: [4, 0, 2, 3] },
                    { search: "las",    expected: [4, 0, 3] },
                    { search: "last",   expected: [4, 0] },
                    { search: "lastn",  expected: [0] } ];

const inputs = [ firstNames, lastNames];

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
  // Copy the data files into place
  let testAB = do_get_file("../../mailnews/data/tb2hexpopularity.mab");

  testAB.copyTo(gProfileDir, kPABData.fileName);

  // Test - Create a new search component

  let acs = Components.classes["@mozilla.org/autocomplete/search;1?name=addrbook"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);

  let obs = new acObserver();

  // Ensure we've got the comment column set up for extra checking.
  let prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setIntPref("mail.autoComplete.commentColumn", 1);

  // Test - Matches

  // Now check multiple matches
  function checkInputItem(element, index, array) {
    print("Checking " + element.search);
    acs.startSearch(element.search, null, null, obs);

    do_check_eq(obs._search, acs);
    do_check_eq(obs._result.searchString, element.search);
    do_check_eq(obs._result.searchResult, ACR.RESULT_SUCCESS);
    do_check_eq(obs._result.errorDescription, null);
    do_check_eq(obs._result.matchCount, element.expected.length);
    do_check_eq(obs._result.defaultIndex, 0);

    for (let i = 0; i < element.expected.length; ++i) {
      do_check_eq(obs._result.getValueAt(i), results[element.expected[i]].email);
      do_check_eq(obs._result.getCommentAt(i), results[element.expected[i]].dirName);
      do_check_eq(obs._result.getStyleAt(i), "local-abook");
      do_check_eq(obs._result.getImageAt(i), "");

      // Card at result number 4 is the one with the TB 2 popularity set as "a"
      // in the file, so check that we're now setting the popularity to 10
      // and hence future tests don't have to convert it.
      if (element.expected[i] == 4) {
        let result = obs._result.QueryInterface(Ci.nsIAbAutoCompleteResult);
        do_check_eq(result.getCardAt(i).getProperty("PopularityIndex", -1), 10);
      }
    }
  }
  function checkInputSet(element, index, array) {
    element.forEach(checkInputItem);
  }

  inputs.forEach(checkInputSet);
};
