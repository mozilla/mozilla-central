/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions:
 *   extractHeaderAddressMailboxes
 *   extractHeaderAddressNames
 *   extractHeaderAddressName
 */

function run_test() {
  var i;

  var parser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                         .getService(Components.interfaces.nsIMsgHeaderParser);

  // In this array, the sub arrays consist of the following elements:
  // 0: input string
  // 1: expected output from extractHeaderAddressMailboxes
  // 2: expected output from extractHeaderAddressNames
  // 3: expected output from extractHeaderAddressName
  const checks =
  [
    ["abc@invalid.com",
     "abc@invalid.com",
     "abc@invalid.com",
     "abc@invalid.com" ],
    ["foo <ghj@invalid.com>",
     "ghj@invalid.com",
     "foo",
     "foo" ],
    ["abc@invalid.com, foo <ghj@invalid.com>",
     "abc@invalid.com, ghj@invalid.com",
     "abc@invalid.com, foo",
     "abc@invalid.com" ],
    ["foo bar <foo@bar.invalid>",
     "foo@bar.invalid",
     "foo bar",
     "foo bar" ],
    ["foo bar <foo@bar.invalid>, abc@invalid.com, foo <ghj@invalid.com>",
     "foo@bar.invalid, abc@invalid.com, ghj@invalid.com",
     "foo bar, abc@invalid.com, foo",
     "foo bar" ],
    // UTF-8 names
    ["foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@invalid.com>",
     "foo@bar.invalid, ghj@invalid.com",
     "foo\u00D0 bar, \u00F6foo",
     "foo\u00D0 bar" ],
    // More complicated examples drawn from RFC 2822
    ["\"Joe Q. Public\" <john.q.public@example.com>,Test <\"abc!x.yz\"@invalid.com>, Test <test@[xyz!]>,\"Giant; \\\"Big\\\" Box\" <sysservices@example.net>",
     "john.q.public@example.com, \"abc!x.yz\"@invalid.com, test@[xyz!], sysservices@example.net",
     "\"Joe Q. Public\", Test, Test, \"Giant; \\\"Big\\\" Box\"",
     // extractHeaderAddressName returns unquoted names, hence the difference.
     "Joe Q. Public" ],
  ];

  // Test - empty strings

  do_check_eq(parser.extractHeaderAddressMailboxes(""), "");
  do_check_eq(parser.extractHeaderAddressNames(""), "");
  do_check_eq(parser.extractHeaderAddressName(""), "");

  // Test - extractHeaderAddressMailboxes

  for (i = 0; i < checks.length; ++i) {
    do_check_eq(parser.extractHeaderAddressMailboxes(checks[i][0]), checks[i][1]);
    do_check_eq(parser.extractHeaderAddressNames(checks[i][0]), checks[i][2]);
    do_check_eq(parser.extractHeaderAddressName(checks[i][0]), checks[i][3]);
  }
}
