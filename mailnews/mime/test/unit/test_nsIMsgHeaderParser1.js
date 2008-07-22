/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions.
 */

function run_test() {
  var i;

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

  // Test - empty strings

  do_check_eq(parser.makeFullAddress("", ""), "");

  // Test - makeFullAddressWString

  for (i = 0; i < checks.length; ++i)
    do_check_eq(parser.makeFullAddress(checks[i][0], checks[i][1]),
                checks[i][2]);
}
