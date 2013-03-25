/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser functions:
 *   extractHeaderAddressMailboxes
 *   extractHeaderAddressNames
 *   extractHeaderAddressName
 */

Components.utils.import("resource:///modules/mailServices.js");

function run_test() {
  // In this array, the sub arrays consist of the following elements:
  // 0: input string
  // 1: expected output from extractHeaderAddressMailboxes
  // 2: expected output from extractHeaderAddressNames
  // 3: expected output from extractHeaderAddressName
  const checks =
  [
    ["abc@foo.invalid",
     "abc@foo.invalid",
     "abc@foo.invalid",
     "abc@foo.invalid" ],
    ["foo <ghj@foo.invalid>",
     "ghj@foo.invalid",
     "foo",
     "foo" ],
    ["abc@foo.invalid, foo <ghj@foo.invalid>",
     "abc@foo.invalid, ghj@foo.invalid",
     "abc@foo.invalid, foo",
     "abc@foo.invalid" ],
    ["foo bar <foo@bar.invalid>",
     "foo@bar.invalid",
     "foo bar",
     "foo bar" ],
    ["foo bar <foo@bar.invalid>, abc@foo.invalid, foo <ghj@foo.invalid>",
     "foo@bar.invalid, abc@foo.invalid, ghj@foo.invalid",
     "foo bar, abc@foo.invalid, foo",
     "foo bar" ],
    // UTF-8 names
    ["foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@foo.invalid>",
     "foo@bar.invalid, ghj@foo.invalid",
     "foo\u00D0 bar, \u00F6foo",
     "foo\u00D0 bar" ],
    // More complicated examples drawn from RFC 2822
    ["\"Joe Q. Public\" <john.q.public@example.com>,Test <\"abc!x.yz\"@foo.invalid>, Test <test@[xyz!]>,\"Giant; \\\"Big\\\" Box\" <sysservices@example.net>",
     "john.q.public@example.com, \"abc!x.yz\"@foo.invalid, test@[xyz!], sysservices@example.net",
     "\"Joe Q. Public\", Test, Test, \"Giant; \\\"Big\\\" Box\"",
     // extractHeaderAddressName returns unquoted names, hence the difference.
     "Joe Q. Public" ],
    // Bug 549931
    ["Undisclosed recipients:;",
     "\"Undisclosed recipients:;\"", // Mailboxes
     "\"Undisclosed recipients:;\"", // Address Names
     "Undisclosed recipients:;"] // Address Name
  ];

  // this used to cause memory read overruns
  let addresses = {}, names = {}, fullAddresses = {};
  MailServices.headerParser.parseHeadersWithArray("\" \"@a a;b", addresses, names, fullAddresses);

  // This checks that the mime header parser doesn't march past the end
  // of strings with ":;" in them. The second ":;" is required to force the
  // parser to keep going.
  do_check_eq(MailServices.headerParser.extractHeaderAddressMailboxes(
    "undisclosed-recipients:;\0:; foo <ghj@veryveryveryverylongveryveryveryveryinvalidaddress.invalid>"),
              "undisclosed-recipients:;");

  do_check_eq(MailServices.headerParser.extractHeaderAddressMailboxes("<a;a@invalid"), "");

  // Test - empty strings

  do_check_eq(MailServices.headerParser.extractHeaderAddressMailboxes(""), "");
  do_check_eq(MailServices.headerParser.extractHeaderAddressNames(""), "");
  do_check_eq(MailServices.headerParser.extractHeaderAddressName(""), "");

  // Test - extractHeaderAddressMailboxes

  for (let i = 0; i < checks.length; ++i) {
    do_check_eq(MailServices.headerParser.extractHeaderAddressMailboxes(checks[i][0]), checks[i][1]);
    do_check_eq(MailServices.headerParser.extractHeaderAddressNames(checks[i][0]), checks[i][2]);
    do_check_eq(MailServices.headerParser.extractHeaderAddressName(checks[i][0]), checks[i][3]);
  }
}
