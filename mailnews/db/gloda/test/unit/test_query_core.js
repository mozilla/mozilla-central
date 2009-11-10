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
 * Portions created by the Initial Developer are Copyright (C) 2009
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
 * Test the mechanics our query functionality.  Tests in this file are intended
 *  to cover extreme boundary cases and things that are just unlikely to happen
 *  in reasonable message use-cases.  (Which is to say, it could be hard to
 *  formulate a set of synthetic messages that result in the situation we want
 *  to test for.)
 */

load("resources/glodaTestHelper.js");
load("resources/genericIndexer.js");

/* ===== Test Noun ===== */
/*
 * Introduce a simple noun type for our testing so that we can avoid having to
 * deal with the semantics of messages/friends and all their complexity.
 */

/**
 * Simple test object.
 *
 * Has some tricks for gloda indexing to deal with gloda's general belief that
 *  things are immutable.  When we get indexed we stash all of our attributes
 *  at that time in _indexStash.  Then when we get cloned we propagate our
 *  current attributes over to the cloned object and restore _indexStash.  This
 *  sets things up the way gloda expects them as long as we never de-persist
 *  from the db.
 */
function Widget(inum, date, str, notability, text1, text2) {
  this._id = undefined;
  this._inum = inum;
  this._date = date;
  this._str = str;
  this._notability = notability;
  this._text1 = text1;
  this._text2 = text2;

  this._indexStash = null;
  this._restoreStash = null;
}
Widget.prototype = {
  _clone: function() {
    let clonus = new Widget(this._inum, this._date, this._str, this._notability,
                            this._text1, this._text2);
    clonus._id = this._id;
    clonus._iAmAClone = true;

    for each (let [key, value] in Iterator(this)) {
      if (key[0] == "_")
        continue;
      clonus[key] = value;
      if (key in this._indexStash) {
        this[key] = this._indexStash[key];
      }
    }

    return clonus;
  },
  _stash: function() {
    this._indexStash = {};
    for each (let [key, value] in Iterator(this)) {
      if (key[0] == "_")
        continue;
      this._indexStash[key] = value;
    }
  },

  get id() { return this._id; },
  set id(aVal) { this._id = aVal; },

  // gloda's attribute idiom demands that row attributes be prefixed with a '_'
  //  (because Gloda.grokNounItem detects attributes by just walking...).  This
  //  could be resolved by having the special attributes moot these dudes, but
  //  that's not how things are right now.
  get inum() { return this._inum; },
  set inum(aVal) { this._inum = aVal; },
  get date() { return this._date; },
  set date(aVal) { this._date = aVal; },
  get str() { return this._str; },
  set str(aVal) { this._str = aVal; },
  get notability() { return this._notability; },
  set notability(aVal) { this._notability = aVal; },
  get text1() { return this._text1; },
  set text1(aVal) { this._text1 = aVal; },
  get text2() { return this._text2; },
  set text2(aVal) { this._text2 = aVal; },

  toString: function () {
    return "" + this.id;
  }
};

var WidgetProvider = {
  providerName: "widget",
  process: function () {
    yield Gloda.kWorkDone;
  }
};

var WidgetNoun;
function setup_test_noun_and_attributes() {
  // --- noun
  WidgetNoun = Gloda.defineNoun({
    name: "widget",
    clazz: Widget,
    allowsArbitraryAttrs: true,
    // It is vitally important to our correctness that we allow caching
    //  otherwise our in-memory representations will not be canonical and the db
    //  will load some.  Or we could add things to collections as we index them.
    cache: true, cacheCost: 32,
    schema: {
      columns: [['id', 'INTEGER PRIMARY KEY'],
                ['intCol', 'NUMBER', 'inum'],
                ['dateCol', 'NUMBER', 'date'],
                ['strCol', 'STRING', 'str'],
                ['notabilityCol', 'NUMBER', 'notability'],
                ['textOne', 'STRING', 'text1'],
                ['textTwo', 'STRING', 'text2']],
      indices: {intCol: ['intCol'],
                strCol: ['strCol']},
      fulltextColumns: [['fulltextOne', 'TEXT', 'text1'],
                        ['fulltextTwo', 'TEXT', 'text2']],
      genericAttributes: true
    }
  });

  EXT_NAME = "test";

  // --- special (on-row) attributes
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "inum",
    singular: true,
    special: Gloda.kSpecialColumn,
    specialColumnName: "intCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_NUMBER
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "date",
    singular: true,
    special: Gloda.kSpecialColumn,
    specialColumnName: "dateCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_DATE
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "str",
    singular: true,
    special: Gloda.kSpecialString,
    specialColumnName: "strCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_STRING
  });


  // --- fulltext attributes
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "text1",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: "fulltextOne",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "text2",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: "fulltextTwo",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "fulltextAll",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: WidgetNoun.tableName + "Text",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });

  // --- external (attribute-storage) attributes
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "singleIntAttr",
    singular: true,
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_NUMBER
  });

  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "multiIntAttr",
    singular: false,
    emptySetIsSignificant: true,
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_NUMBER
  });
}

/* ===== Tests ===== */

ALPHABET = "abcdefghijklmnopqrstuvwxyz";
function test_lots_of_string_constraints() {
  let stringConstraints = [];
  for (let i = 0; i < 2049; i++) {
    stringConstraints.push(ALPHABET[Math.floor(i / (ALPHABET.length * 2)) %
                                    ALPHABET.length] +
                           ALPHABET[Math.floor(i / (ALPHABET.length)) %
                                    ALPHABET.length] +
                           ALPHABET[i % ALPHABET.length] +
                           // throw in something that will explode if not quoted
                           // (and use an uneven number of things so if we fail
                           // to quote it won't get quietly eaten.)
                           "'" + '"');
  }

  let query = Gloda.newQuery(WidgetNoun.id);
  query.str.apply(query, stringConstraints);

  queryExpect(query, []);
  return false; // queryExpect is async
}

/* === Query === */

/**
 * Use a counter so that each test can have its own unique value for intCol so
 *  that it can use that as a constraint.  Otherwise we would need to purge
 *  between every test.  That's not an unreasonable alternative, but this works.
 * Every test should increment this before using it.
 */
var testUnique = 100;

/**
 * Widgets with multiIntAttr populated with one or more values.
 */
var nonSingularWidgets;
/**
 * Widgets with multiIntAttr unpopulated.
 */
var singularWidgets;

function setup_non_singular_values() {
  testUnique++;
  let origin = new Date("2007/01/01");
  nonSingularWidgets = [
    new Widget(testUnique, origin, "ns1", 0, "", ""),
    new Widget(testUnique, origin, "ns2", 0, "", ""),
  ];
  singularWidgets = [
    new Widget(testUnique, origin, "s1", 0, "", ""),
    new Widget(testUnique, origin, "s2", 0, "", ""),
  ];
  nonSingularWidgets[0].multiIntAttr = [1, 2];
  nonSingularWidgets[1].multiIntAttr = [3];
  singularWidgets[0].multiIntAttr = [];
  // and don't bother setting it on singularWidgets[1]

  yield GenericIndexer.indexObjects(
    nonSingularWidgets.concat(singularWidgets));
}

function test_query_has_value_for_non_singular() {
  let query = Gloda.newQuery(WidgetNoun.id);
  query.inum(testUnique);
  query.multiIntAttr();
  queryExpect(query, nonSingularWidgets);
  return false;
}

/**
 * We should find the one singular object where we set the multiIntAttr to an
 *  empty set.  We don't find the one without the attribute since that's
 *  actually something different.
 * We also want to test that re-indexing properly adds/removes the attribute
 *  so change the object and make sure everything happens correctly.
 *
 * @tests gloda.datastore.sqlgen.kConstraintIn.emptySet
 * @tests gloda.query.test.kConstraintIn.emptySet
 */
function test_empty_set_logic() {
  // - initial query based on the setup previously
  mark_sub_test_start("initial index case");
  let query = Gloda.newQuery(WidgetNoun.id);
  query.inum(testUnique);
  query.multiIntAttr(null);
  queryExpect(query, [singularWidgets[0]]);
  yield false;

  // - make one of the non-singulars move to empty and move the guy who matched
  //  to no longer match.
  mark_sub_test_start("incremental index case");
  nonSingularWidgets[0].multiIntAttr = [];
  singularWidgets[0].multiIntAttr = [4, 5];

  yield GenericIndexer.indexObjects([nonSingularWidgets[0],
                                     singularWidgets[0]]);

  query = Gloda.newQuery(WidgetNoun.id);
  query.inum(testUnique);
  query.multiIntAttr(null);
  queryExpect(query, [nonSingularWidgets[0]]);
  yield false;

  // make sure that the query doesn't explode when it has to handle a case
  //  that's not supposed to match
  do_check_false(query.test(singularWidgets[0]));
}

/* === Search === */
/*
 * The conceit of our search is that more recent messages are better than older
 *  messages.  But at the same time, we care about some messages more than
 *  others (in general), and we care about messages that match search terms
 *  more strongly too.  So we introduce a general 'score' heuristic which we
 *  then apply to message timestamps to make them appear more recent.  We
 *  then order by this 'date score' hybrid, which we dub "dascore".  Such a
 *  flattening heuristic is over-simple, but believed to be sufficient to
 *  generally get us the messsages we want.  Post-processing based can then
 *  be more multi-dimensional and what not, but that is beyond the scope of
 *  this unit test.
 */

/**
 * How much time boost should a 'score point' amount to?  The authoritative,
 *  incontrivertible answer, across all time and space, is a week.
 *  Note that gloda stores timestamps as PRTimes for no exceedingly good
 *  reason.
 */
const SCORE_TIMESTAMP_FACTOR = 1000 * 1000 * 60 * 60 * 24 * 7;

/**
 * How many score points for each fulltext match?
 */
const SCORE_FOR_FULLTEXT_MATCH = 1;

/**
 * Roughly how many characters are in each offset match.
 */
const OFFSET_CHARS_PER_FULLTEXT_MATCH = 8;

var fooWidgets = null;
var barBazWidgets = null;

function setup_search_ranking_idiom() {
  // --- build some widgets for testing.  use inum to represent the expected
  //  result sequence
  // setup a base date...
  let origin = new Date("2008/01/01");
  let daymore = new Date("2008/01/02");
  let monthmore = new Date("2008/02/01");
  fooWidgets = [
    // -- setup the term "foo" to do frequency tests
    new Widget(5, origin, "", 0, "", "foo"),
    new Widget(4, origin, "", 0, "", "foo foo"),
    new Widget(3, origin, "", 0, "foo", "foo foo"),
    new Widget(2, origin, "", 0, "foo foo", "foo foo"),
    new Widget(1, origin, "", 0, "foo foo", "foo foo foo"),
    new Widget(0, origin, "", 0, "foo foo foo", "foo foo foo")
  ];
  barBazWidgets = [
    // -- setup score and matches to boost older messages over newer messages
    new Widget(7, origin, "", 0, "", "bar"), // score boost: 1 + date: 0
    new Widget(6, daymore, "", 0, "", "bar"), // 1 + 0+
    new Widget(5, origin, "", 1, "", "bar"), // 2 + 0
    new Widget(4, daymore, "", 0, "bar", "bar"), // 2 + 0+
    new Widget(3, origin, "", 1, "bar", "baz"), // 3 + 0
    new Widget(2, monthmore, "", 0, "", "bar"), // 1 + 4
    new Widget(1, origin, "", 0, "bar baz", "bar baz bar bar"), // 6 + 0
    new Widget(0, origin, "", 1, "bar baz", "bar baz bar bar") // 7 + 0
  ];

  yield GenericIndexer.indexObjects(fooWidgets.concat(barBazWidgets));
}

// add one because the last snippet shouldn't have a trailing space
const OFFSET_SCORE_SQL_SNIPPET =
  "(((length(osets) + 1) / " + OFFSET_CHARS_PER_FULLTEXT_MATCH + ") * " +
  SCORE_FOR_FULLTEXT_MATCH + ")";

const SCORE_SQL_SNIPPET =
  "(" + OFFSET_SCORE_SQL_SNIPPET + " + notabilityCol)";

const DASCORE_SQL_SNIPPET =
  "((" + SCORE_SQL_SNIPPET + " * " + SCORE_TIMESTAMP_FACTOR + ") + dateCol)";

const WIDGET_FULLTEXT_QUERY_EXPLICIT_SQL =
  "SELECT ext_widget.*, offsets(ext_widgetText) AS osets " +
    "FROM ext_widget, ext_widgetText WHERE ext_widgetText MATCH ?" +
    " AND ext_widget.id == ext_widgetText.docid";

/**
 * Used by queryExpect to verify
 */
function verify_widget_order_and_stashing(aZeroBasedIndex, aWidget,
                                          aCollection) {
  do_check_eq(aZeroBasedIndex, aWidget.inum);
  if (!aCollection.stashedColumns[aWidget.id] ||
      !aCollection.stashedColumns[aWidget.id].length)
    do_throw("no stashed information for widget: " + aWidget);
}

/**
 * Test the fundamentals of the search ranking idiom we use elsewhere.  This
 *  is primarily a simplified
 */
function test_search_ranking_idiom_offsets() {
  let query = Gloda.newQuery(WidgetNoun.id, {
    explicitSQL: WIDGET_FULLTEXT_QUERY_EXPLICIT_SQL,
    // osets becomes 0-based column number 7
    // dascore becomes 0-based column number 8
    outerWrapColumns: [DASCORE_SQL_SNIPPET + " AS dascore"],
    // save our extra columns for analysis and debugging
    stashColumns: [7, 8]
  });
  query.fulltextAll("foo");
  query.orderBy('-dascore');
  queryExpect(query, fooWidgets, null, null,
              verify_widget_order_and_stashing);
  return false; // queryExpect is async
}

function test_search_ranking_idiom_score() {
  let query = Gloda.newQuery(WidgetNoun.id, {
    explicitSQL: WIDGET_FULLTEXT_QUERY_EXPLICIT_SQL,
    // osets becomes 0-based column number 7
    // dascore becomes 0-based column number 8
    outerWrapColumns: [DASCORE_SQL_SNIPPET + " AS dascore",
                       SCORE_SQL_SNIPPET + " AS dabore", "dateCol"],
    // save our extra columns for analysis and debugging
    stashColumns: [7, 8, 9, 10]
  });
  query.fulltextAll("bar OR baz");
  query.orderBy('-dascore');
  queryExpect(query, barBazWidgets, null, null,
              verify_widget_order_and_stashing);
  return false; // queryExpect is async
}


/* ===== Driver ===== */

var tests = [
  setup_test_noun_and_attributes,
  test_lots_of_string_constraints,
  setup_non_singular_values,
  test_query_has_value_for_non_singular,
  test_empty_set_logic,
  setup_search_ranking_idiom,
  test_search_ranking_idiom_offsets,
  test_search_ranking_idiom_score,
];

function run_test() {
  // Don't initialize the index message state
  glodaHelperRunTests(tests, "widget");
}
