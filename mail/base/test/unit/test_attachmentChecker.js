/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test suite for the attachmentChecker class
 *
 * Currently tested:
 * - GetAttachmentKeywords function.
 */

// Globals

Components.utils.import("resource:///modules/attachmentChecker.js");

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

/*
 * TESTS
 */

function test_GetAttachmentKeywords(desc, mailData, keywords, expected)
{
  let result = GetAttachmentKeywords(mailData, keywords);
  assert_equal(result, expected, desc + " not equal!");
}

var tests = [
  // Desc, mail body Data, keywords to search for, expected keywords found.
  ["Simple keyword", "latte.ca", "latte", "latte"],
  ["Extension", "testing document.pdf", ".pdf", "document.pdf"],
  ["Two Extensions", "testing document.pdf and test.pdf", ".pdf",
    "document.pdf,test.pdf"],
  ["Url", "testing http://document.pdf", ".pdf", ""],
  ["Both", "testing http://document.pdf test.pdf", ".pdf", "test.pdf"],
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
  ["Should match", "I've attached the http/test.pdf file", ".pdf",
    "http/test.pdf"],
  ["Should still fail", "a https://test.pdf a", ".pdf", ""],
  ["Should match Japanese", "a test.添付 a", ".添付", "test.添付"],
  ["Should match Greek", "a test.Θεωρία a", ".Θεωρία", "test.Θεωρία"],
  ["Should match once", "a test.pdf.doc a", ".pdf,.doc", "test.pdf.doc"],
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
