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

EXPORTED_SYMBOLS = ["GlodaMsgSearcher"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/public.js");

/**
 * How much time boost should a 'score point' amount to?  The authoritative,
 *  incontrivertible answer, across all time and space, is a week.
 *  Note that gloda stores timestamps as PRTimes for no exceedingly good
 *  reason.
 */
const FUZZSCORE_TIMESTAMP_FACTOR = 1000 * 1000 * 60 * 60 * 24 * 7;

/**
 * How many score points for each fulltext match?
 */
const FUZZSCORE_FOR_FULLTEXT_MATCH = 1;

/**
 * Roughly how many characters are in each offset match.  SQLite division is
 *  truncating, so we can have this be slightly higher than the minimum case
 *  ("x x x x") in recognition that message bodies may be more than 10
 *  characters long and have OFFSET_CHARS_FUZZ help us out so we are still
 *  approximately correct at lower offsets.
 */
const OFFSET_CHARS_PER_FULLTEXT_MATCH = 10;
/**
 * How many characters we should add to the length(osets) to adjust for lack of
 *  trailing whitespace for just one match, but also to compensate for having
 *  OFFSETS_CHARS_PER_FULLTEXT_MATCH be biased towards the existence of
 *  multi-digit character offsets.
 * This value is currently arbitrarily chosen, feel free to do an analysis and
 *  pick a better one.
 */
const OFFSET_CHARS_FUZZ = 6;

const OFFSET_FUZZSCORE_SQL_SNIPPET =
  "(((length(osets) + " + OFFSET_CHARS_FUZZ + ") / " +
    OFFSET_CHARS_PER_FULLTEXT_MATCH + ") * " +
    FUZZSCORE_FOR_FULLTEXT_MATCH + ")";

const FUZZSCORE_SQL_SNIPPET =
  "(" + OFFSET_FUZZSCORE_SQL_SNIPPET + " + notability)";

const DASCORE_SQL_SNIPPET =
  "((" + FUZZSCORE_SQL_SNIPPET + " * " + FUZZSCORE_TIMESTAMP_FACTOR +
    ") + date)";

const FULLTEXT_QUERY_EXPLICIT_SQL =
  "SELECT messages.*, offsets(messagesText) AS osets " +
    "FROM messages, messagesText WHERE messagesText MATCH ?" +
    " AND messages.id == messagesText.docid";


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


function GlodaMsgSearcher(aViewWrapper, aFulltextTerms) {
  this.viewWrapper = aViewWrapper;

  this.fulltextTerms = aFulltextTerms;

  this.query = null;
  this.collection = null;

  this.scoresByUriAndKey = {};
  this.whysByUriAndKey = {};
}
GlodaMsgSearcher.prototype = {
  /**
   * Number of messages to retrieve initially.
   */
  retrievalLimit: 100,

  buildFulltextQuery: function GlodaMsgSearcher_buildFulltextQuery() {
    let query = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
      noMagic: true,
      explicitSQL: FULLTEXT_QUERY_EXPLICIT_SQL,
      // osets is 0-based column number 9 (volatile to column changes)
      // dascore becomes 0-based column number 10
      outerWrapColumns: [DASCORE_SQL_SNIPPET + " AS dascore"],
      // save the offset column for extra analysis
      stashColumns: [9]
    });

    query.fulltextMatches(this.fulltextTerms.join(" "));
    query.orderBy('-dascore');
    query.limit(this.retrievalLimit);

    return query;
  },

  go: function GlodaMsgSearcher_go() {
    this.query = this.buildFulltextQuery();
    this.collection = this.query.getCollection(this);

    return this.collection;
  },

  onItemsAdded: function GlodaMsgSearcher_onItemsAdded(aItems, aCollection) {
    let scores = Gloda.scoreNounItems(
      aItems,
      {
        terms: this.fulltextTerms,
        stashedColumns: aCollection.stashedColumns
      },
      [scoreOffsets]);
    let actualItems = [];
    for (let i = 0; i < aItems.length; i++) {
      let item = aItems[i];
      let score = scores[i];

      let hdr = item.folderMessage;
      if (hdr) {
        this.scoresByUriAndKey[hdr.folder.URI + "-" + hdr.messageKey] = score;
        actualItems.push(item);
      }
    }

    this.viewWrapper.onItemsAdded(actualItems, aCollection);
  },
  onItemsModified: function GlodaMsgSearcher_onItemsModified() {},
  onItemsRemoved: function GlodaMsgSearcher_onItemsRemoved() {},
  onQueryCompleted: function GlodaMsgSearcher_onQueryCompleted(aCollection) {
    this.viewWrapper.onQueryCompleted(aCollection);
  },
};