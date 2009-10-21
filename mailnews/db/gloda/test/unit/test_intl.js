/*
 * Test that i18n goes through das pipes acceptably.  Currently this means:
 * - Subject, Body, and Attachment names are properly indexed.
 */

load("../../mailnews/resources/messageGenerator.js");
load("resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();

/* ===== Tests ===== */

var intlPhrases = [
  {
    name: "Vending Machine",
    actual: '\u81ea\u52d5\u552e\u8ca8\u6a5f',
    encodings: {
      'utf-8': ['=?utf-8?b?6Ieq5YuV5ZSu6LKo5qmf?=',
                '\xe8\x87\xaa\xe5\x8b\x95\xe5\x94\xae\xe8\xb2\xa8\xe6\xa9\x9f'],
      'euc-jp': ['=?shift-jis?b?jqmTrppTid2LQA==?=',
                 '\xbc\xab\xc6\xb0\xd3\xb4\xb2\xdf\xb5\xa1'],
      'shift-jis': ['=?shift-jis?b?jqmTrppTid2LQA==?=',
                    '\x8e\xa9\x93\xae\x9aS\x89\xdd\x8b@']
    }
  }
];

var resultList = [];

/**
 * For each phrase in the intlPhrases array (we are parameterized over it using
 *  parameterizeTest in the 'tests' declaration), create a message where the
 *  subject, body, and attachment name are populated using the encodings in
 *  the phrase's "encodings" attribute, one encoding per message.  Make sure
 *  that the strings as exposed by the gloda representation are equal to the
 *  expected/actual value.
 */
function test_index(aPhrase) {
  // create a synthetic message for each of the delightful encoding types
  let messages = [];
  for each (let [charset, encodings] in Iterator(aPhrase.encodings)) {
    let [quoted, bodyEncoded] = encodings;

    let smsg = msgGen.makeMessage({
      subject: quoted,
      body: {charset: charset, encoding: "8bit", body: bodyEncoded},
      attachments: [
        {filename: quoted, body: "gabba gabba hey"},
      ],
      // save off the actual value for checking
      callerData: [charset, aPhrase.actual]
    });

    messages.push(smsg);
    resultList.push(smsg);
  }

  indexMessages(messages, verify_index, next_test);
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

function test_intl_fulltextsearch()
{
  var query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  /* CJK text is bi-gram */
  query.bodyMatches('\u81ea\u52d5');
  queryExpect(query, resultList);
}


/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_index, intlPhrases),
  test_intl_fulltextsearch,
];

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
