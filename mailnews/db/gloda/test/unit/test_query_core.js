/*
 * Test the mechanics our query functionality.  Tests in this file are intended
 *  to cover extreme boundary cases and things that are just unlikely to happen
 *  in reasonable message use-cases.  (Which is to say, it could be hard to
 *  formulate a set of synthetic messages that result in the situation we want
 *  to test for.)  
 */

do_import_script("../mailnews/db/gloda/test/resources/glodaTestHelper.js");

/* ===== Test Noun ===== */
/*
 * Introduce a simple noun type for our testing so that we can avoid having to
 * deal with the semantics of messages/friends and all their complexity. 
 */

Widget = function () {
}
Widget.prototype = {
  toString: function () {
    return "" + this.id;
  }
};

var WidgetProvider = {
  providerName: "widget",
  process: function () {}
};

var WidgetNoun;
function setup_test_noun_and_attributes() {
  // --- noun
  WidgetNoun = Gloda.defineNoun({
    name: "widget",
    class: Widget,
    allowArbitraryAttrs: true,
    schema: {
      columns: [['id', 'INTEGER PRIMARY KEY'],
                ['intCol', 'NUMBER'],
                ['strCol', 'STRING']],
      indices: {intCol: ['intCol'],
                strCol: ['strCol']},
      fulltextColumns: [['fulltextOne', 'TEXT'],
                        ['fulltextTwo', 'TEXT']],
      genericAttributes: true
    }
  });
  
  EXT_NAME = "test";
  
  // --- special (on-row) attributes
  Gloda.defineAttribute({
    provider: this, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "intCol",
    singular: true,
    special: Gloda.kSpecialColumn,
    specialColumnName: "intCol",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_NUMBER
  });
  Gloda.defineAttribute({
    provider: this, extensionName: EXT_NAME,
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
    provider: this, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "fulltextOne",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: "fulltextOne",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });
  Gloda.defineAttribute({
    provider: this, extensionName: EXT_NAME,
    attributeType: Gloda.kAttrFundamental,
    attributeName: "fulltextTwo",
    singular: true,
    special: Gloda.kSpecialFulltext,
    specialColumnName: "fulltextTwo",
    subjectNouns: [WidgetNoun.id],
    objectNoun: Gloda.NOUN_FULLTEXT
  });
  Gloda.defineAttribute({
    provider: this, extensionName: EXT_NAME,
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
    provider: this, extensionName: EXT_NAME,
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

/* ===== Driver ===== */

var tests = [
  setup_test_noun_and_attributes,
  test_lots_of_string_constraints,
];

function run_test() {
  // use mbox injection so we get multiple folders...
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
