/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions.
 */

function run_test() {
  var i;

  var parser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                         .getService(Components.interfaces.nsIMsgHeaderParser);

  const checks =
  [
    ["abc@invalid.com",
     "abc@invalid.com" ],
    ["foo <ghj@invalid.com>",
     "ghj@invalid.com"],
    ["abc@invalid.com, foo <ghj@invalid.com>",
     "abc@invalid.com, ghj@invalid.com"],
    ["foo bar <foo@bar.invalid>",
     "foo@bar.invalid"],
    ["foo bar <foo@bar.invalid>, abc@invalid.com, foo <ghj@invalid.com>",
     "foo@bar.invalid, abc@invalid.com, ghj@invalid.com"],
    // More complicated examples drawn from RFC 2822
    ["Test <\"abc!x.yz\"@invalid.com>, Test <test@[xyz!]>,\"Joe Q. Public\" <john.q.public@example.com>,\"Giant; \\\"Big\\\" Box\" <sysservices@example.net>",
     "\"abc!x.yz\"@invalid.com, test@[xyz!], john.q.public@example.com, sysservices@example.net"],
  ];

  // Test - empty strings

  do_check_eq(parser.extractHeaderAddressMailboxes(""), "");

  // Test - extractHeaderAddressMailboxes

  for (i = 0; i < checks.length; ++i)
    do_check_eq(parser.extractHeaderAddressMailboxes(checks[i][0]), checks[i][1]);
}
