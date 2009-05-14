/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser function removeDuplicateAddresses:
 */

function run_test() {
  const checks =
  [
    { addrs: "test@invalid.com",
      otherAddrs: "",
      expectedResult: "test@invalid.com" },
    { addrs: "foo bar <test@invalid.com>",
      otherAddrs: "",
      expectedResult: "foo bar <test@invalid.com>" },
    { addrs: "foo bar <test@invalid.com>, abc@invalid.com",
      otherAddrs: "",
      expectedResult: "foo bar <test@invalid.com>, abc@invalid.com" },
    { addrs: "foo bar <test@invalid.com>, abc@invalid.com, test <test@invalid.com>",
      otherAddrs: "",
      expectedResult: "foo bar <test@invalid.com>, abc@invalid.com" },
    { addrs: "foo bar <test@invalid.com>",
      otherAddrs: "abc@invalid.com",
      expectedResult: "foo bar <test@invalid.com>" },
    { addrs: "foo bar <test@invalid.com>",
      otherAddrs: "foo bar <test@invalid.com>",
      expectedResult: null },
    { addrs: "foo bar <test@invalid.com>, abc@invalid.com",
      otherAddrs: "foo bar <test@invalid.com>",
      expectedResult: "abc@invalid.com" },
    { addrs: "foo bar <test@invalid.com>, abc@invalid.com",
      otherAddrs: "abc@invalid.com",
      expectedResult: "foo bar <test@invalid.com>" },
    { addrs: "foo bar <test@invalid.com>, abc@invalid.com, test <test@invalid.com>",
      otherAddrs: "abc@invalid.com",
      expectedResult: "foo bar <test@invalid.com>" },
    // UTF-8 names
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@invalid.com>",
      otherAddrs: "",
      expectedResult: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@invalid.com>" },
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@invalid.com>",
      otherAddrs: "foo\u00D0 bar <foo@bar.invalid>",
      expectedResult: "\u00F6foo <ghj@invalid.com>" },
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@invalid.com>, foo\u00D0 bar <foo@bar.invalid>",
      otherAddrs: "\u00F6foo <ghj@invalid.com>",
      expectedResult: "foo\u00D0 bar <foo@bar.invalid>" }
  ];

  // Test - empty strings

  var parser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                         .getService(Components.interfaces.nsIMsgHeaderParser);

  do_check_eq(parser.removeDuplicateAddresses("", ""), "");
  do_check_eq(parser.removeDuplicateAddresses("", "test@invalid.com"), "");

  // Test - removeDuplicateAddresses

  for (let i = 0; i < checks.length; ++i) {
    dump("Test " + i + "\n");
    do_check_eq(parser.removeDuplicateAddresses(checks[i].addrs,
						checks[i].otherAddrs),
		checks[i].expectedResult);
  }
}
