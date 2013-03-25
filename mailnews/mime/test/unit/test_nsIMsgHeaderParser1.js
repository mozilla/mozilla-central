/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions.
 */

Components.utils.import("resource:///modules/mailServices.js");

function run_test() {
  var checks =
  [
    ["", "test@foo.invalid", "test@foo.invalid"],
    ["Test", "test@foo.invalid", "Test <test@foo.invalid>"],
    ["Test", "\"abc!x.yz\"@foo.invalid", "Test <\"abc!x.yz\"@foo.invalid>"],
    ["Test", "test.user@foo.invalid", "Test <test.user@foo.invalid>"],
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

  do_check_eq(MailServices.headerParser.makeFullAddress("", ""), "");

  // Test - makeFullAddressWString

  for (let i = 0; i < checks.length; ++i)
    do_check_eq(MailServices.headerParser.makeFullAddress(checks[i][0], checks[i][1]),
                checks[i][2]);
}
