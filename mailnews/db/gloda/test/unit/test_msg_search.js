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
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

/*
 * Test msg_search.js our heuristic-based fulltext search mechanism.  Things we
 *  generally want to verify:
 * - fulltext weighting by where the match happened works.
 * - static interestingness impacts things appropriately.
 *
 * Our general strategy is to create two messages each with a unique string
 *  placed in controlled places and whatever intentional message manipulation
 *  is required to set things up.  Then we query using a GlodaMsgSearcher with
 *  the limit set to 1.  Only the message we expect should come back.
 * Keep in mind in all tests that our underlying ranking mechanism is based on
 *  time so the date of each message is relevant but should not be significant
 *  because our score boost factor should always be well in excess of the one
 *  hour increment between messages.
 *
 * Previously, we relied on the general equivalence of the logic in
 *  test_query_core to our message search logic.
 */

load("resources/glodaTestHelper.js");

var uniqueCounter = 0;
/**
 * Generate strings like "aaaaa", "aabaa", "aacaa", etc.  The idea with the
 * suffix is to avoid the porter stemmer from doing something weird that
 * collapses things.
 */
function unique_string() {
  let uval = uniqueCounter++;
  let s = String.fromCharCode(97 + Math.floor(uval / (26 * 26))) +
          String.fromCharCode(97 + (Math.floor(uval / 26) % 26)) +
          String.fromCharCode(97 + (uval % 26)) +
          "aa";
  return s;
}

Components.utils.import("resource:///modules/gloda/msg_search.js");

/**
 * Wrap the construction of a GlodaMsgSearcher with a limit of 1 and feed it to
 * queryExpect.
 *
 * @param aFulltextStr The fulltext query string which GlodaMsgSearcher will
 *     parse.
 * @param aExpectedSet The expected result set.  Make sure that the size of the
 *     set is consistent with aLimit.
 * @param [aLimit=1]
 *
 * Use like so:
 *  yield asyncMsgSearchExpect("foo bar", someSynMsgSet);
 */
function asyncMsgSearcherExpect(aFulltextStr, aExpectedSet, aLimit) {
  let searcher = new GlodaMsgSearcher(null, aFulltextStr);
  searcher.retrievalLimit = aLimit ? aLimit : 1;
  queryExpect(searcher.buildFulltextQuery(), aExpectedSet);
  return false;
}

/**
 * Verify that the ranking function is using the weights as expected.  We do not
 *  need to test all the permutations
 */
function test_fulltext_weighting_by_column() {
  let ustr = unique_string();
  let [folder, subjSet, bodySet] = make_folder_with_sets(
    [{count: 1, subject: ustr}, {count: 1, body: {body: ustr}}]);
  yield wait_for_gloda_indexer([subjSet, bodySet]);
  yield asyncMsgSearcherExpect(ustr, subjSet);
}

/**
 * A term mentioned 3 times in the body is worth more than twice in the subject.
 * (This is because the subject saturates at one occurrence worth 2.0 and the
 * body does not saturate until 10, each worth 1.0.)
 */
function test_fulltext_weighting_saturation() {
  let ustr = unique_string();
  let double_ustr = ustr + " " + ustr;
  let thrice_ustr = ustr + " " + ustr + " " + ustr;
  let [folder, subjSet, bodySet] = make_folder_with_sets(
    [{count: 1, subject: double_ustr}, {count: 1, body: {body: thrice_ustr}}]);
  yield wait_for_gloda_indexer([subjSet, bodySet]);
  yield asyncMsgSearcherExpect(ustr, bodySet);
}

/**
 * Use a starred message with the same fulltext match characteristics as another
 * message to verify the preference goes the right way.  Have the starred
 * message be the older message for safety.
 */
function test_static_interestingness_boost_works() {
  let ustr = unique_string();
  let [folder, starred, notStarred] = make_folder_with_sets(
    [{count: 1, subject: ustr}, {count: 1, subject: ustr}]);
  // index in their native state
  yield wait_for_gloda_indexer([starred, notStarred]);
  // star and index
  starred.setStarred(true);
  yield wait_for_gloda_indexer([starred]);
  // stars upon thars wins
  yield asyncMsgSearcherExpect(ustr, starred);
}

/**
 * Make sure that the query does not retrieve more than actually matches.
 */
function test_joins_do_not_return_everybody() {
  let ustr = unique_string();
  let [folder, subjSet] = make_folder_with_sets([{count: 1, subject: ustr}]);
  yield wait_for_gloda_indexer([subjSet]);
  yield asyncMsgSearcherExpect(ustr, subjSet, 2);
}

var tests = [
  test_fulltext_weighting_by_column,
  test_fulltext_weighting_saturation,
  test_static_interestingness_boost_works,
  test_joins_do_not_return_everybody,
];

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
