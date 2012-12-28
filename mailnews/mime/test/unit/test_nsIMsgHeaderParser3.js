/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgHeaderParser function removeDuplicateAddresses:
 */

function run_test() {
  const checks =
  [
    { addrs: "test@foo.invalid",
      otherAddrs: "",
      expectedResult: "test@foo.invalid" },
    { addrs: "foo bar <test@foo.invalid>",
      otherAddrs: "",
      expectedResult: "foo bar <test@foo.invalid>" },
    { addrs: "foo bar <test@foo.invalid>, abc@foo.invalid",
      otherAddrs: "",
      expectedResult: "foo bar <test@foo.invalid>, abc@foo.invalid" },
    { addrs: "foo bar <test@foo.invalid>, abc@foo.invalid, test <test@foo.invalid>",
      otherAddrs: "",
      expectedResult: "foo bar <test@foo.invalid>, abc@foo.invalid" },
    { addrs: "foo bar <test@foo.invalid>",
      otherAddrs: "abc@foo.invalid",
      expectedResult: "foo bar <test@foo.invalid>" },
    { addrs: "foo bar <test@foo.invalid>",
      otherAddrs: "foo bar <test@foo.invalid>",
      expectedResult: null },
    { addrs: "foo bar <test@foo.invalid>, abc@foo.invalid",
      otherAddrs: "foo bar <test@foo.invalid>",
      expectedResult: "abc@foo.invalid" },
    { addrs: "foo bar <test@foo.invalid>, abc@foo.invalid",
      otherAddrs: "abc@foo.invalid",
      expectedResult: "foo bar <test@foo.invalid>" },
    { addrs: "foo bar <test@foo.invalid>, abc@foo.invalid, test <test@foo.invalid>",
      otherAddrs: "abc@foo.invalid",
      expectedResult: "foo bar <test@foo.invalid>" },
    // UTF-8 names
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@foo.invalid>",
      otherAddrs: "",
      expectedResult: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@foo.invalid>" },
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@foo.invalid>",
      otherAddrs: "foo\u00D0 bar <foo@bar.invalid>",
      expectedResult: "\u00F6foo <ghj@foo.invalid>" },
    { addrs: "foo\u00D0 bar <foo@bar.invalid>, \u00F6foo <ghj@foo.invalid>, foo\u00D0 bar <foo@bar.invalid>",
      otherAddrs: "\u00F6foo <ghj@foo.invalid>",
      expectedResult: "foo\u00D0 bar <foo@bar.invalid>" }
  ];

  // Test - empty strings

  var parser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                         .getService(Components.interfaces.nsIMsgHeaderParser);

  do_check_eq(parser.removeDuplicateAddresses("", ""), "");
  do_check_eq(parser.removeDuplicateAddresses("", "test@foo.invalid"), "");

  // Test - removeDuplicateAddresses

  for (let i = 0; i < checks.length; ++i) {
    dump("Test " + i + "\n");
    do_check_eq(parser.removeDuplicateAddresses(checks[i].addrs,
						checks[i].otherAddrs),
		checks[i].expectedResult);
  }
}
