/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This test file recycles part of test_intl.js. What we do is insert into the
 * fulltext index two messages:
 * - one has tokens 'aa' and 'bbb',
 * - one is from a previous test and has CJK characters in it.
 *
 * We want to test that the behavior of the tokenizer is as expected (namely,
 * that it drops two-letter tokens unless they're CJK bigrams), and that
 * msg_search.js properly drops two-letter tokens (unless CJK) from the search
 * terms to avoid issuing a query that will definitely return no results.
 */

load("resources/glodaTestHelper.js");

/* ===== Tests ===== */

/**
 * To make the encoding pairs:
 * - For the subject bit:
 *   import email
 *   h = email.Header.Header(charset=CHARSET)
 *   h.append(STRING)
 *   h.encode()
 * - For the body bit
 *   s.encode(CHARSET)
 */
var intlPhrases = [
  // -- CJK case
  {
    name: "CJK: Vending Machine",
    actual: '\u81ea\u52d5\u552e\u8ca8\u6a5f',
    encodings: {
      'utf-8': ['=?utf-8?b?6Ieq5YuV5ZSu6LKo5qmf?=',
                '\xe8\x87\xaa\xe5\x8b\x95\xe5\x94\xae\xe8\xb2\xa8\xe6\xa9\x9f'],
    },
    searchPhrases: [
      // match bi-gram driven matches starting from the front
      { body: '"\u81ea\u52d5"', match: true },
    ]
  },
  // -- Regular case. Make sure two-letter tokens do not match, since the
  // tokenizer is supposed to drop them. Also make sure that a three-letter
  // token matches.
  {
    name: "Boring ASCII",
    actual: "aa bbb",
    encodings: {
      'utf-8': ['=?utf-8?q?aa_bbb?=', 'aa bbb'],
    },
    searchPhrases: [
      { body: 'aa', match: false },
      { body: 'bbb', match: true },
    ],
  },
];

/**
 * For each phrase in the intlPhrases array (we are parameterized over it using
 *  parameterizeTest in the 'tests' declaration), create a message where the
 *  subject, body, and attachment name are populated using the encodings in
 *  the phrase's "encodings" attribute, one encoding per message.  Make sure
 *  that the strings as exposed by the gloda representation are equal to the
 *  expected/actual value.
 * Stash each created synthetic message in a resultList list on the phrase so
 *  that we can use them as expected query results in
 *  |test_fulltextsearch|.
 */
function test_index(aPhrase) {
  // create a synthetic message for each of the delightful encoding types
  let messages = [];
  aPhrase.resultList = [];
  for each (let [charset, encodings] in Iterator(aPhrase.encodings)) {
    let [quoted, bodyEncoded] = encodings;

    let smsg = gMessageGenerator.makeMessage({
      subject: quoted,
      body: {charset: charset, encoding: "8bit", body: bodyEncoded},
      attachments: [
        {filename: quoted, body: "gabba gabba hey"},
      ],
      // save off the actual value for checking
      callerData: [charset, aPhrase.actual]
    });

    messages.push(smsg);
    aPhrase.resultList.push(smsg);
  }
  let synSet = new SyntheticMessageSet(messages);
  yield add_sets_to_folder(gInbox, [synSet]);

  yield wait_for_gloda_indexer(synSet, {verifier: verify_index});
}

/**
 * Does the per-message verification for test_index.  Knows what is right for
 *  each message because of the callerData attribute on the synthetic message.
 */
function verify_index(smsg, gmsg) {
  let [charset, actual] = smsg.callerData;
  let subject = gmsg.subject;
  let indexedBodyText = gmsg.indexedBodyText.trim();
  let attachmentName = gmsg.attachmentNames[0];
  LOG.debug("using character set: " + charset + " actual: " + actual);
  LOG.debug("subject: " + subject + " (len: " + subject.length + ")");
  do_check_eq(actual, subject);
  LOG.debug("body: " + indexedBodyText +
      " (len: " + indexedBodyText.length + ")");
  do_check_eq(actual, indexedBodyText);
  LOG.debug("attachment name:" + attachmentName +
      " (len: " + attachmentName.length + ")");
  do_check_eq(actual, attachmentName);
}

/**
 * - Check that the 'aa' token was never emitted (we don't emit two-letter
 *   tokens unless they're CJK).
 * - Check that the '\u81ea\u52d5' token was emitted, because it's CJK.
 * - Check that the 'bbb' token was duly emitted (three letters is more than two
 *   letters so it's tokenized).
 */
function test_token_count() {
  yield sqlExpectCount(0,
    "SELECT COUNT(*) FROM messagesText where messagesText MATCH 'aa'");
  yield sqlExpectCount(1,
    "SELECT COUNT(*) FROM messagesText where messagesText MATCH 'bbb'");
  yield sqlExpectCount(1,
    "SELECT COUNT(*) FROM messagesText where messagesText MATCH '\u81ea\u52d5'");
}

/**
 * For each phrase, make sure that all of the searchPhrases either match or fail
 *  to match as appropriate.
 */
function test_fulltextsearch(aPhrase)
{
  for each (let [, searchPhrase] in Iterator(aPhrase.searchPhrases)) {
    let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
    query.bodyMatches(searchPhrase.body);
    queryExpect(query, searchPhrase.match ? aPhrase.resultList : []);
    yield false; // queryExpect is async
  }
}

Components.utils.import("resource:///modules/gloda/msg_search.js");
Components.utils.import("resource:///modules/gloda/datastore.js");

/**
 * Pass a query string to the GlodaMsgSearcher, run the corresponding SQL query,
 * and check the resulted count is what we want.
 *
 * Use like so:
 *  yield msgSearchExpectCount(1, "I like cheese");
 */
function msgSearchExpectCount(aCount, aFulltextStr) {
  // Let the GlodaMsgSearcher build its query
  let searcher = new GlodaMsgSearcher(null, aFulltextStr);
  let conn = GlodaDatastore.asyncConnection;
  let query = searcher.buildFulltextQuery();

  // Brace yourself, brutal monkey-patching NOW
  let sql, args;
  let oldFunc = GlodaDatastore._queryFromSQLString;
  GlodaDatastore._queryFromSQLString = function (aSql, aArgs) {
    sql = aSql
    args = aArgs;
  };
  query.getCollection();
  GlodaDatastore._queryFromSQLString = oldFunc;

  // Bind the parameters
  let stmt = conn.createStatement(sql);
  for (let [iBinding, bindingValue] in Iterator(args)) {
    GlodaDatastore._bindVariant(stmt, iBinding, bindingValue);
  }

  let i = 0;
  stmt.executeAsync({
    handleResult: function(aResultSet) {
      for (let row = aResultSet.getNextRow();
           row;
           row = aResultSet.getNextRow()) {

        i++;
      }
    },

    handleError: function(aError) {
      do_throw(new Error("Error: " + aError.message));
    },

    handleCompletion: function(aReason) {
      if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
        do_throw(new Error("Query canceled or aborted!"));

      if (i != aCount) {
        mark_failure(["Didn't get the expected number of rows: got", i,
          "expected", aCount, "SQL:", sql]);
        do_throw();
      }
      async_driver();
    }
  });
  stmt.finalize();
  return false;
}

/**
 * We make sure that the Gloda module that builds the query drops two-letter
 * tokens, otherwise this would result in an empty search (no matches for
 * two-letter tokens).
 */
function test_query_builder() {
  // aa should be dropped, and we have one message containing the bbb token.
  yield msgSearchExpectCount(1, "aa bbb");
  // the CJK part should not be dropped, and match message 1; the bbb token
  // should not be dropped, and match message 2; 0 results returned because no
  // message has the two tokens in it
  yield msgSearchExpectCount(0, "\u81ea\u52d5 bbb");
}


/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_index, intlPhrases),
  // force a db flush so I can investigate the database if I want.
  function() {
    return wait_for_gloda_db_flush();
  },
  test_token_count,
  parameterizeTest(test_fulltextsearch, intlPhrases),
  test_query_builder,
];

var gInbox;

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
