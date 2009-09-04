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

function Widget(inum, date, str, notability, text1, text2) {
  this._inum = inum;
  this._date = date;
  this._str = str;
  this._notability = notability;
  this._text1 = text1;
  this._text2 = text2;
}
Widget.prototype = {
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
    allowArbitraryAttrs: true,
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
    attributeName: "intCol",
    singular: true,
    special: Gloda.kSpecialColumn,
    specialColumnName: "intCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_NUMBER
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "dateCol",
    singular: true,
    special: Gloda.kSpecialColumn,
    specialColumnName: "dateCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_DATE
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "strCol",
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
    attributeName: "fulltextOne",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: "fulltextOne",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });
  Gloda.defineAttribute({
    provider: WidgetProvider, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "fulltextTwo",
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

  next_test();
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
  query.strCol.apply(query, stringConstraints);

  queryExpect(query, []);
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

  let indexingInProgress = false;

  // Since we don't use the message indexer listener any more in this test, we
  // need to add our own listener.
  function genericIndexerCallback(aStatus) {
    // If indexingInProgress is false, we've received the synthetic
    // notification, so ignore it
    if (indexingInProgress && aStatus == Gloda.kIndexerIdle) {
      // We're done, so remove ourselves and move to the next test
      Gloda.removeIndexerListener(genericIndexerCallback);
      next_test();
    }
  }
  Gloda.addIndexerListener(genericIndexerCallback);
  indexingInProgress = true;
  GenericIndexer.indexNewObjects(fooWidgets.concat(barBazWidgets));
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
  queryExpect(query, fooWidgets, null, null, verify_widget_order_and_stashing);
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
  queryExpect(query, barBazWidgets, null, null, verify_widget_order_and_stashing);
}


/* ===== Driver ===== */

var tests = [
  setup_test_noun_and_attributes,
  test_lots_of_string_constraints,
  setup_search_ranking_idiom,
  test_search_ranking_idiom_offsets,
  test_search_ranking_idiom_score,
];

function run_test() {
  // Don't initialize the index message state
  glodaHelperRunTests(tests, null, true);
}
