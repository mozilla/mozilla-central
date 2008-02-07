/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions.
 */

var testnum = 0;

function run_test() {
  var i;

  try {
    var parser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                           .getService(Components.interfaces.nsIMsgHeaderParser);

    var checks =
    [
      ["", "test@invalid.com", "test@invalid.com"],
      ["Test", "test@invalid.com", "Test <test@invalid.com>"],
      ["Test", "\"abc!x.yz\"@invalid.com", "Test <\"abc!x.yz\"@invalid.com>"],
      ["Test", "test.user@invalid.com", "Test <test.user@invalid.com>"],
      ["Test", "test@[xyz!]", "Test <test@[xyz!]>"],
      // Based on RFC 2822 A.1.1
      ["John Doe", "jdoe@machine.example", "John Doe <jdoe@machine.example>"],
      // Next 2 tests Based on RFC 2822 A.1.2
      ["Joe Q. Public", "john.q.public@example.com",
       "\"Joe Q. Public\" <john.q.public@example.com>"],
      ["Giant; \"Big\" Box", "sysservices@example.net",
       "\"Giant; \\\"Big\\\" Box\" <sysservices@example.net>"],
    ];

    ++testnum; // Test 1 - empty strings

    do_check_eq(parser.makeFullAddressWString("", ""), "");

    ++testnum; // Test 2 - makeFullAddressWString

    for (i = 0; i < checks.length; ++i)
      do_check_eq(parser.makeFullAddressWString(checks[i][0], checks[i][1]),
                  checks[i][2]);

  } catch (e) {
    throw "FAILED in nsIMsgHeaderParser tests, test #" + testnum + " item #" + i + ": " + e;
  }
}
