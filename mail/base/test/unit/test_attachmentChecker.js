/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is autoconfig test code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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
 * Test suite for the attachmentChecker class
 *
 * Currently tested:
 * - GetAttachmentKeywords function.
 */

// Globals

Components.utils.import("resource://app/modules/attachmentChecker.js");

/*
 * UTILITIES
 */

function assert(aBeTrue, aWhy)
{
  if (!aBeTrue)
    do_throw(aWhy);
};

function assert_equal(aA, aB, aWhy)
{
  assert(aA == aB, aWhy + " (" + unescape(encodeURIComponent(aA)) + " != " +
                                 unescape(encodeURIComponent(aB)) + ").");
};

function utf8_decode(s)
{
  return decodeURIComponent(escape(s));
};

/*
 * TESTS
 */

/**
 * Test the GetAttachmentKeywords method with a simple word.
 */
function test_GetAttachmentKeywords_simple()
{
  let mailData = utf8_decode("latte.ca");
  let keywords = utf8_decode("latte");
  let result = GetAttachmentKeywords(mailData, keywords);
  assert_equal(result, "latte", "Simple keyword not equal!");
}

function test_GetAttachmentKeywords(desc, mailData, keywords, expected)
{
  mailData = utf8_decode(mailData);
  keywords = utf8_decode(keywords);
  expected = utf8_decode(expected);
  let result = GetAttachmentKeywords(mailData, keywords);
  assert_equal(result, expected, desc + " not equal!");
}

var tests = [
  // This is a function to demonstrate that we can put functions here.
  test_GetAttachmentKeywords_simple,

  // Desc, mail body Data, keywords to search for, expected keywords found.
  ["Greek", "This is a Θεωρία test", "Θεωρία,is", "Θεωρία,is"],
  ["Greek missing", "This a Θεωρίαω test", "Θεωρία", ""],
  ["Greek and punctuation", "This a:Θεωρία-test", "Θεωρία", "Θεωρία"],
  ["Greek and Japanese", "This a 添Θεωρία付 test", "Θεωρία", "Θεωρία"],
  ["Japanese", "This is 添付! test", "Θεωρία,添付", "添付"],
  ["More Japanese", "添付mailを送る", "添付,cv", "添付"],
  ["Japanese and English", "添付mailを送る", "添付,mail", "添付,mail"],
  ["Japanese and English Mixed", "添付mailを送る", "添付mail", "添付mail"],
  ["Japanese and English Mixed missing", "添付mailing", "添付mail", ""],
  ["Japanese trailers", "This is 添添付付! test", "Θεωρία,添付", "添付"],
  ["Multi-lang", "cv添付Θεωρία", "Θεωρία,添付,cv", "Θεωρία,添付,cv"],
];

function run_test()
{
  do_test_pending();

  for (var i in tests)
    if (typeof(tests[i]) == "function")
      tests[i]();
    else
      test_GetAttachmentKeywords.apply(null, tests[i]);

  do_test_finished();
};
