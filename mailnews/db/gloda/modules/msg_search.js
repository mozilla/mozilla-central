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
 * Portions created by the Initial Developer are Copyright (C) 2008
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

const EXPORTED_SYMBOLS = ["GlodaMsgSearcher"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/public.js");

/**
 * How much time boost should a 'score point' amount to?  The authoritative,
 *  incontrivertible answer, across all time and space, is a week.
 *  Note that gloda stores timestamps as PRTimes for no exceedingly good
 *  reason.
 */
const FUZZSCORE_TIMESTAMP_FACTOR = 1000 * 1000 * 60 * 60 * 24 * 7;

const RANK_USAGE =
  "glodaRank(matchinfo(messagesText), 2.0, 1.0, 2.0, 1.5, 1.5)";

const DASCORE =
  "(((" + RANK_USAGE + " + messages.notability) * " +
    FUZZSCORE_TIMESTAMP_FACTOR +
   ") + messages.date)";

/**
 * A new optimization decision we are making is that we do not want to carry
 *  around any data in our ephemeral tables that is not used for whittling the
 *  result set.  The idea is that the btree page cache or OS cache is going to
 *  save us from the disk seeks and carrying around the extra data is just going
 *  to be CPU/memory churn that slows us down.
 *
 * Additionally, we try and avoid row lookups that would have their results
 *  discarded by the LIMIT.  Because of limitations in FTS3 (which might
 *  be addressed in FTS4 by a feature request), we can't avoid the 'messages'
 *  lookup since that has the message's date and static notability but we can
 *  defer the 'messagesText' lookup.
 *
 * This is the access pattern we are after here:
 * 1) Order the matches with minimized lookup and result storage costs.
 * - The innermost MATCH does the doclist magic and provides us with
 *    matchinfo() support which does not require content row retrieval
 *    from messagesText.  Unfortunately, this is not enough to whittle anything
 *    because we still need static interestingness, so...
 * - Based on the match we retrieve the date and notability for that row from
 *    'messages' using this in conjunction with matchinfo() to provide a score
 *    that we can then use to LIMIT our results.
 * 2) We reissue the MATCH query so that we will be able to use offsets(), but
 *    we intersect the results of this MATCH against our LIMITed results from
 *    step 1.
 * - We use 'docid IN (phase 1 query)' to accomplish this because it results in
 *    efficient lookup.  If we just use a join, we get O(mn) performance because
 *    a cartesian join ends up being performed where either we end up performing
 *    the fulltext query M times and table scan intersect with the results from
 *    phase 1 or we do the fulltext once but traverse the entire result set from
 *    phase 1 N times.
 * - We believe that the re-execution of the MATCH query should have no disk
 *    costs because it should still be cached by SQLite or the OS.  In the case
 *    where memory is so constrained this is not true our behavior is still
 *    probably preferable than the old way because that would have caused lots
 *    of swapping.
 * - This part of the query otherwise resembles the basic gloda query but with
 *    the inclusion of the offsets() invocation.  The messages table lookup
 *    should not involve any disk traffic because the pages should still be
 *    cached (SQLite or OS) from phase 1.  The messagesText lookup is new, and
 *    this is the major disk-seek reduction optimization we are making.  (Since
 *    we avoid this lookup for all of the documents that were excluded by the
 *    LIMIT.)  Since offsets() also needs to retrieve the row from messagesText
 *    there is a nice synergy there.
 */
const NUEVO_FULLTEXT_SQL =
  "SELECT messages.*, messagesText.*, offsets(messagesText) AS osets " +
  "FROM messagesText, messages " +
  "WHERE" +
    " messagesText MATCH ?1 " +
    " AND messagesText.docid IN (" +
       "SELECT docid " +
       "FROM messagesText JOIN messages ON messagesText.docid = messages.id " +
       "WHERE messagesText MATCH ?1 " +
       "ORDER BY " + DASCORE + " DESC " +
       "LIMIT ?2" +
    " )" +
    " AND messages.id = messagesText.docid " +
    " AND +messages.deleted = 0" +
    " AND +messages.folderID IS NOT NULL" +
    " AND +messages.messageKey IS NOT NULL";

function identityFunc(x) {
  return x;
}

function oneLessMaxZero(x) {
  if (x <= 1)
    return 0;
  else
    return x - 1;
}

function reduceSum(accum, curValue) {
  return accum + curValue;
}

/*
 * Columns are: subject, body, attachment names, author, recipients
 */

/**
 * Scores if all search terms match in a column.  We bias against author
 *  slightly and recipient a bit more in this case because a search that
 *  entirely matches just on a person should give a mention of that person
 *  in the subject or attachment a fighting chance.
 * Keep in mind that because of our indexing in the face of address book
 *  contacts (namely, we index the name used in the e-mail as well as the
 *  display name on the address book card associated with the e-mail adress)
 *  a contact is going to bias towards matching multiple times.
 */
const COLUMN_ALL_MATCH_SCORES = [20, 4, 20, 16, 12];
/**
 * Score for each distinct term that matches in the column.  This is capped
 *  by COLUMN_ALL_SCORES.
 */
const COLUMN_PARTIAL_PER_MATCH_SCORES = [4, 1, 4, 4, 3];
/**
 * If a term matches multiple times, what is the marginal score for each
 *  additional match.  We count the total number of matches beyond the
 *  first match for each term.  In other words, if we have 3 terms which
 *  matched 5, 3, and 0 times, then the total from our perspective is
 *  (5 - 1) + (3 - 1) + 0 = 4 + 2 + 0 = 6.  We take the minimum of that value
 *  and the value in COLUMN_MULTIPLE_MATCH_LIMIT and multiply by the value in
 *  COLUMN_MULTIPLE_MATCH_SCORES.
 */
const COLUMN_MULTIPLE_MATCH_SCORES = [0, 1, 0, 0, 0];
const COLUMN_MULTIPLE_MATCH_LIMIT = [0, 10, 0, 0, 0];

/**
 * Score the message on its offsets (from stashedColumns).
 */
function scoreOffsets(aMessage, aContext) {
  let score = 0;

  let termTemplate = [0 for each (term in Iterator(aContext.terms, true))];
  // for each column, a list of the incidence of each term
  let columnTermIncidence = [termTemplate.concat(),
                             termTemplate.concat(),
                             termTemplate.concat(),
                             termTemplate.concat(),
                             termTemplate.concat()];

  // we need a friendlyParseInt because otherwise the radix stuff happens
  //  because of the extra arguments map parses.  curse you, map!
  let offsetNums =
    [parseInt(x) for each (x in aContext.stashedColumns[aMessage.id][0].split(" "))];
  for (let i=0; i < offsetNums.length; i += 4) {
    let columnIndex = offsetNums[i];
    let termIndex = offsetNums[i+1];
    columnTermIncidence[columnIndex][termIndex]++;
  }

  for (let iColumn = 0; iColumn < COLUMN_ALL_MATCH_SCORES.length; iColumn++) {
    let termIncidence = columnTermIncidence[iColumn];
    // bestow all match credit
    if (termIncidence.every(identityFunc))
      score += COLUMN_ALL_MATCH_SCORES[iColumn];
    // bestow partial match credit
    else if (termIncidence.some(identityFunc))
      score += Math.min(COLUMN_ALL_MATCH_SCORES[iColumn],
                        COLUMN_PARTIAL_PER_MATCH_SCORES[iColumn] *
                          termIncidence.filter(identityFunc).length);
    // bestow multiple match credit
    score += Math.min(termIncidence.map(oneLessMaxZero).reduce(reduceSum, 0),
                      COLUMN_MULTIPLE_MATCH_LIMIT[iColumn]) *
             COLUMN_MULTIPLE_MATCH_SCORES[iColumn];
  }

  return score;
}

/**
 * The searcher basically looks like a query, but is specialized for fulltext
 *  search against messages.  Most of the explicit specialization involves
 *  crafting a SQL query that attempts to order the matches by likelihood that
 *  the user was looking for it.  This is based on full-text matches combined
 *  with an explicit (generic) interest score value placed on the message at
 *  indexing time.  This is followed by using the more generic gloda scoring
 *  mechanism to explicitly score the messages given the search context in
 *  addition to the more generic score adjusting rules.
 */
function GlodaMsgSearcher(aListener, aSearchString, aAndTerms) {
  this.listener = aListener;

  this.searchString = aSearchString;
  this.fulltextTerms = this.parseSearchString(aSearchString);
  this.andTerms = (aAndTerms != null) ? aAndTerms : true;

  this.query = null;
  this.collection = null;

  this.scores = null;
}
GlodaMsgSearcher.prototype = {
  /**
   * Number of messages to retrieve initially.
   */
  retrievalLimit: 400,

  /**
   * Parse the string into terms/phrases by finding matching double-quotes.
   */
  parseSearchString: function GlodaMsgSearcher_parseSearchString(aSearchString) {
    aSearchString = aSearchString.trim();
    let terms = [];

    /*
     * Add the term as long as the trim on the way in didn't obliterate it.
     *
     * In the future this might have other helper logic; it did once before.
     */
    function addTerm(aTerm) {
      if (aTerm)
        terms.push(aTerm);
    }

    while (aSearchString) {
      if (aSearchString[0] == '"') {
        let endIndex = aSearchString.indexOf(aSearchString[0], 1);
        // eat the quote if it has no friend
        if (endIndex == -1) {
          aSearchString = aSearchString.substring(1);
          continue;
        }

        addTerm(aSearchString.substring(1, endIndex).trim());
        aSearchString = aSearchString.substring(endIndex + 1);
        continue;
      }

      let spaceIndex = aSearchString.indexOf(" ");
      if (spaceIndex == -1) {
        addTerm(aSearchString);
        break;
      }

      addTerm(aSearchString.substring(0, spaceIndex));
      aSearchString = aSearchString.substring(spaceIndex+1);
    }

    return terms;
  },

  buildFulltextQuery: function GlodaMsgSearcher_buildFulltextQuery() {
    let query = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
      noMagic: true,
      explicitSQL: NUEVO_FULLTEXT_SQL,
      limitClauseAlreadyIncluded: true,
      // osets is 0-based column number 14 (volatile to column changes)
      // save the offset column for extra analysis
      stashColumns: [14]
    });

    let fulltextQueryString = "";

    for each (let [iTerm, term] in Iterator(this.fulltextTerms)) {
      if (iTerm)
        fulltextQueryString += this.andTerms ? " " : " OR ";

      // Put our term in quotes.  This is needed for the tokenizer to be able
      //  to do useful things.  The exception is people clever enough to use
      //  NEAR.
      if (/^NEAR(\/\d+)?$/.test(term))
        fulltextQueryString += term;
      // Check if this is a single-character CJK search query.  If so, we want
      //  to add a wildcard.
      // Our tokenizer treats anything at/above 0x2000 as CJK for now.
      else if (term.length == 1 && term.charCodeAt(0) >= 0x2000)
        fulltextQueryString += term + "*";
      else
        fulltextQueryString += '"' + term + '"';

    }

    query.fulltextMatches(fulltextQueryString);
    query.limit(this.retrievalLimit);

    return query;
  },

  getCollection: function GlodaMsgSearcher_getCollection(
      aListenerOverride, aData) {
    if (aListenerOverride)
      this.listener = aListenerOverride;

    this.query = this.buildFulltextQuery();
    this.collection = this.query.getCollection(this, aData);
    this.completed = false;

    return this.collection;
  },

  sortBy: '-dascore',

  onItemsAdded: function GlodaMsgSearcher_onItemsAdded(aItems, aCollection) {
    let newScores = Gloda.scoreNounItems(
      aItems,
      {
        terms: this.fulltextTerms,
        stashedColumns: aCollection.stashedColumns
      },
      [scoreOffsets]);
    if (this.scores)
      this.scores = this.scores.concat(newScores);
    else
      this.scores = newScores;

    if (this.listener)
      this.listener.onItemsAdded(aItems, aCollection);
  },
  onItemsModified: function GlodaMsgSearcher_onItemsModified(aItems,
                                                             aCollection) {
    if (this.listener)
      this.listener.onItemsModified(aItems, aCollection);
  },
  onItemsRemoved: function GlodaMsgSearcher_onItemsRemoved(aItems,
                                                           aCollection) {
    if (this.listener)
      this.listener.onItemsRemoved(aItems, aCollection);
  },
  onQueryCompleted: function GlodaMsgSearcher_onQueryCompleted(aCollection) {
    this.completed = true;
    if (this.listener)
      this.listener.onQueryCompleted(aCollection);
  },
};
