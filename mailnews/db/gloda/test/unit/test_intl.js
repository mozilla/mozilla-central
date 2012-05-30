/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Sanity check our encoding transforms and make sure the mozporter tokenizer
 *  is resulting in the expected fulltext search results.  Specifically:
 * - Check that subject, body, and attachment names are properly indexed;
 *    previously we screwed up at least one of these in terms of handling
 *    encodings properly.
 * - Check that we can fulltext search on those things afterwards.
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
      'euc-jp': ['=?shift-jis?b?jqmTrppTid2LQA==?=',
                 '\xbc\xab\xc6\xb0\xd3\xb4\xb2\xdf\xb5\xa1'],
      'shift-jis': ['=?shift-jis?b?jqmTrppTid2LQA==?=',
                    '\x8e\xa9\x93\xae\x9aS\x89\xdd\x8b@']
    },
    searchPhrases: [
      // match bi-gram driven matches starting from the front
      { body: '"\u81ea\u52d5"', match: true },
      { body: '"\u81ea\u52d5\u552e"', match: true },
      { body: '"\u81ea\u52d5\u552e\u8ca8"', match: true },
      { body: '"\u81ea\u52d5\u552e\u8ca8\u6a5f"', match: true },
      // now match from the back (bi-gram based)
      { body: '"\u52d5\u552e\u8ca8\u6a5f"', match: true },
      { body: '"\u552e\u8ca8\u6a5f"', match: true },
      { body: '"\u8ca8\u6a5f"', match: true },
      // now everybody in the middle!
      { body: '"\u52d5\u552e\u8ca8"', match: true },
      { body: '"\u552e\u8ca8"', match: true },
      { body: '"\u52d5\u552e"', match: true },
      // -- now match nobody!
      // nothing in common with the right answer
      { body: '"\u81eb\u52dc"', match: false },
      // too long, no match
      { body: '"\u81ea\u52d5\u552e\u8ca8\u6a5f\u6a5f"', match: false },
      // minor change at the end
      { body: '"\u81ea\u52d5\u552e\u8ca8\u6a5e"', match: false },
    ]
  },
  // Use two words where the last character is a multi-byte sequence and one of
  //  them is the last word in the string.  This helps test an off-by-one error
  //  in both the asymmetric case (query's last character is last character in
  //  the tokenized string but it is not the last character in the body string)
  //  and symmetric case (last character in the query and the body).
  {
    name: "Czech diacritics",
    actual: "Slov\u00e1cko Moravsk\u00e9 rodin\u011b",
    encodings: {
      "utf-8": ["=?utf-8?b?U2xvdsOhY2tvIE1vcmF2c2vDqSByb2RpbsSb?=",
                "Slov\xc3\xa1cko Moravsk\xc3\xa9 rodin\xc4\x9b"]
    },
    searchPhrases: [
      // -- desired
      // Match on exact for either word should work
      {body: "Slov\u00e1cko", match: true},
      {body: "Moravsk\u00e9", match: true},
      {body: "rodin\u011b", match: true},
      // The ASCII uppercase letters get case-folded
      {body: "slov\u00e1cko", match: true},
      {body: "moravsk\u00e9", match: true},
      {body: "rODIN\u011b", match: true},
    ]
  },
  // ignore accent search
  {
    name: "having accent: Paris",
    actual: "Par\u00eds",
    encodings: {
      "utf-8": ["=?UTF-8?B?UGFyw61z?=",
                "Par\xc3\xads"]
    },
    searchPhrases: [
      {body: "paris", match: true},
    ]
  },
  // case insentive case for non-ASCII characters
  {
    name: "Russian: new",
    actual: "\u041d\u043e\u0432\u043e\u0435",
    encodings: {
      "utf-8": ["=?UTF-8?B?0J3QvtCy0L7QtQ==?=",
                "\xd0\x9d\xd0\xbe\xd0\xb2\xd0\xbe\xd0\xb5"]
    },
    searchPhrases: [
      {body: "\u043d\u043e\u0432\u043e\u0435", match: true},
    ]
  },
  // case-folding happens after decomposition
  {
    name: "Awesome where A has a bar over it",
    actual: "\u0100wesome",
    encodings: {
      "utf-8": ["=?utf-8?q?=C4=80wesome?=",
                "\xc4\x80wesome"]
    },
    searchPhrases: [
      {body: "\u0100wesome", match: true}, // upper A-bar
      {body: "\u0101wesome", match: true}, // lower a-bar
      {body: "Awesome", match: true}, // upper A
      {body: "awesome", match: true}, // lower a
    ]
  },
  // deep decomposition happens and after that, case folding
  {
    name: "Upper case upsilon with diaeresis and hook goes to small upsilon",
    actual: "\u03d4esterday",
    encodings: {
      "utf-8": ["=?utf-8?q?=CF=94esterday?=",
                "\xcf\x94esterday"]
    },
    searchPhrases: [
      {body: "\u03d4esterday", match: true}, // Y_: 03d4 => 03d2 (decomposed)
      {body: "\u03d3esterday", match: true}, // Y_' 03d3 => 03d2 (decomposed)
      {body: "\u03d2esterday", match: true}, // Y_  03d2 => 03a5 (decomposed)
      {body: "\u03a5esterday", match: true}, // Y   03a5 => 03c5 (lowercase)
      {body: "\u03c5esterday", match: true}, // y   03c5 (final state)
    ]
  },
  // full-width alphabet
  // Even if search phrases are ASCII, it has to hit.
  {
    name: "Full-width Thunderbird",
    actual: "\uff34\uff48\uff55\uff4e\uff44\uff45\uff52\uff42\uff49\uff52\uff44",
    encodings: {
      "utf-8": ["=?UTF-8?B?77y0772I772V772O772E772F772S772C772J772S772E?=",
                "\xef\xbc\xb4\xef\xbd\x88\xef\xbd\x95\xef\xbd\x8e\xef\xbd\x84\xef\xbd\x85\xef\xbd\x92\xef\xbd\x82\xef\xbd\x89\xef\xbd\x92\xef\xbd\x84"]
    },
    searchPhrases: [
      // full-width lower
      {body: "\uff34\uff28\uff35\uff2e\uff24\uff25\uff32\uff22\uff29\uff32\uff24", match: true},
      // half-width
      {body: "Thunderbird", match: true},
    ]
  },
  // half-width Katakana with voiced sound mark
  // Even if search phrases are full-width, it has to hit.
  {
    name: "Half-width Katakana: Thunderbird (SANDAABAADO)",
    actual: "\uff7b\uff9d\uff80\uff9e\uff70\uff8a\uff9e\uff70\uff84\uff9e",
    encodings: {
      "utf-8": ["=?UTF-8?B?7727776d776A776e772w776K776e772w776E776e?=",
                "\xef\xbd\xbb\xef\xbe\x9d\xef\xbe\x80\xef\xbe\x9e\xef\xbd\xb0\xef\xbe\x8a\xef\xbe\x9e\xef\xbd\xb0\xef\xbe\x84\xef\xbe\x9e"]
    },
    searchPhrases: [
      {body: "\u30b5\u30f3\u30c0\u30fc\u30d0\u30fc\u30c9", match: true},
    ]
  },
  // Thai: Would you like to see the movie?
  {
    name: "Thai: query movie word into Thai language content",
    actual: "\u0e04\u0e38\u0e13\u0e2d\u0e22\u0e32\u0e01\u0e44\u0e1b\u0e14\u0e39\u0e2b\u0e19\u0e31\u0e07",
    encodings: {
      "utf-8": ["=?UTF-8?B?4LiE4Li44LiT4Lit4Lii4Liy4LiB4LmE4Lib4LiU4Li54Lir4LiZ4Lix4LiH?=",
                "\xe0\xb8\x84\xe0\xb8\xb8\xe0\xb8\x93\xe0\xb8\xad\xe0\xb8\xa2\xe0\xb8\xb2\xe0\xb8\x81\xe0\xb9\x84\xe0\xb8\x9b\xe0\xb8\x94\xe0\xb8\xb9\xe0\xb8\xab\xe0\xb8\x99\xe0\xb8\xb1\xe0\xb8\x87"]
    },
    searchPhrases: [
      {body: "\u0e2b\u0e19\u0e31\u0e07", match: true},
    ]
  }
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


/**
 * Names with encoded commas in them can screw up our mail address parsing if
 *  we perform the mime decoding prior to handing the mail address off for
 *  parsing.
 */
function test_encoding_complications_with_mail_addresses() {
  let basePair = gMessageGenerator.makeNameAndAddress();
  // The =2C encodes a comma!
  let encodedCommaPair = ["=?iso-8859-1?Q?=DFnake=2C_=DFammy?=",
                          basePair[1]];
  // "Snake, Sammy", but with a much cooler looking S-like character!
  let decodedName = "\u00dfnake, \u00dfammy";
  // Use the thing with the comma in it for all cases; previously there was an
  //  asymmetry between to and cc...
  let smsg = gMessageGenerator.makeMessage({
    from: encodedCommaPair,
    to: [encodedCommaPair],
    cc: [encodedCommaPair],
  });
  function verify_sammy_snake(smsg, gmsg) {
    do_check_eq(gmsg.from.contact.name, decodedName);
    do_check_eq(gmsg.to.length, 1);
    do_check_eq(gmsg.to[0].id, gmsg.from.id);
    do_check_eq(gmsg.cc.length, 1);
    do_check_eq(gmsg.cc[0].id, gmsg.from.id);
  }

  let synSet = new SyntheticMessageSet([smsg]);
  yield add_sets_to_folder(gInbox, [synSet]);
  yield wait_for_gloda_indexer(synSet, {verifier: verify_sammy_snake});
}

/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_index, intlPhrases),
  // force a db flush so I can investigate the database if I want.
  function() {
    return wait_for_gloda_db_flush();
  },
  parameterizeTest(test_fulltextsearch, intlPhrases),
  test_encoding_complications_with_mail_addresses,
];

var gInbox;

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
