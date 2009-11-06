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
 * Test that i18n goes through das pipes acceptably.  Currently this means:
 * - Subject, Body, and Attachment names are properly indexed.
 */

load("resources/glodaTestHelper.js");

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
    resultList.push(smsg);
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

var intlSearchPhrases = [
  // match bi-gram driven matches starting from the front
  { name: '"\u81ea\u52d5"', match: true },
  { name: '"\u81ea\u52d5\u552e"', match: true },
  { name: '"\u81ea\u52d5\u552e\u8ca8"', match: true },
  { name: '"\u81ea\u52d5\u552e\u8ca8\u6a5f"', match: true },
  // now match from the back (bi-gram based)
  { name: '"\u52d5\u552e\u8ca8\u6a5f"', match: true },
  { name: '"\u552e\u8ca8\u6a5f"', match: true },
  { name: '"\u8ca8\u6a5f"', match: true },
  // now everybody in the middle!
  { name: '"\u52d5\u552e\u8ca8"', match: true },
  { name: '"\u552e\u8ca8"', match: true },
  { name: '"\u52d5\u552e"', match: true },
  // -- now match nobody!
  // nothing in common with the right answer
  { name: '"\u81eb\u52dc"', match: false },
  // too long, no match
  { name: '"\u81ea\u52d5\u552e\u8ca8\u6a5f\u6a5f"', match: false },
  // minor change at the end
  { name: '"\u81ea\u52d5\u552e\u8ca8\u6a5e"', match: false },
];

function test_intl_fulltextsearch(aPhrase)
{
  var query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  /* CJK text is bi-gram */
  query.bodyMatches(aPhrase.name);
  queryExpect(query, aPhrase.match ? resultList : []);
  return false; // queryExpect is async
}


/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_index, intlPhrases),
  parameterizeTest(test_intl_fulltextsearch, intlSearchPhrases),
];

var gInbox;

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
