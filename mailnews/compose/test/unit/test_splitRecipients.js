/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgCompFields functions.
 * Currently only tests nsIMsgCompFields::SplitRecipients
 */

const splitRecipientsTests =
  [ { recipients: "me@foo.invalid",
      emailAddressOnly: false,
      count: 1,
      result: [ "me@foo.invalid" ]
    },
    { recipients: "me@foo.invalid, me2@foo.invalid",
      emailAddressOnly: false,
      count: 2,
      result: [ "me@foo.invalid", "me2@foo.invalid" ]
    },
    { recipients: '"foo bar" <me@foo.invalid>',
      emailAddressOnly: false,
      count: 1,
      result: [ '"foo bar" <me@foo.invalid>' ]
    },
    { recipients: '"foo bar" <me@foo.invalid>',
      emailAddressOnly: true,
      count: 1,
      result: [ 'me@foo.invalid' ]
    },
    { recipients: '"foo bar" <me@foo.invalid>, "bar foo" <me2@foo.invalid>',
      emailAddressOnly: false,
      count: 2,
      result: [ '"foo bar" <me@foo.invalid>', '"bar foo" <me2@foo.invalid>' ]
    },
    { recipients: '"foo bar" <me@foo.invalid>, "bar foo" <me2@foo.invalid>',
      emailAddressOnly: true,
      count: 2,
      result: [ "me@foo.invalid", "me2@foo.invalid" ]
    },
    { recipients: "A Group:Ed Jones <c@a.invalid>,joe@where.invalid,John <jdoe@one.invalid>;",
      emailAddressOnly: false,
      count: 3,
      result: [ "A Group:Ed Jones <c@a.invalid>", "joe@where.invalid", "John <jdoe@one.invalid>" ]
    },
    { recipients: 'mygroup:;, empty:;, foo@foo.invalid, othergroup:bar@foo.invalid, bar2@foo.invalid;,       y@y.invalid, empty:;',
      emailAddressOnly: true,
      count: 7,
      result: [ "mygroup:;", "empty:;", "foo@foo.invalid", "othergroup:bar@foo.invalid", "bar2@foo.invalid", "y@y.invalid", "empty:;" ]
    },
    { recipients: 'Undisclosed recipients:;;;;;;;;;;;;;;;;,,,,,,,,,,,,,,,,',
      emailAddressOnly: true,
      count: 1,
      result: ["\"Undisclosed recipients:;\""]
    },
    { recipients: 'a@xxx.invalid; b@xxx.invalid',
      emailAddressOnly: true,
      count: 2,
      result: [ "a@xxx.invalid", "b@xxx.invalid" ]
    },
    { recipients: 'a@xxx.invalid; B <b@xxx.invalid>',
      emailAddressOnly: false,
      count: 2,
      result: [ "a@xxx.invalid", 'B <b@xxx.invalid>' ]
    },
    { recipients: '"A " <a@xxx.invalid>; b@xxx.invalid',
      emailAddressOnly: false,
      count: 2,
      result: [ '"A " <a@xxx.invalid>', "b@xxx.invalid" ]
    },
    { recipients: 'A <a@xxx.invalid>; B <b@xxx.invalid>',
      emailAddressOnly: false,
      count: 2,
      result: [ "A <a@xxx.invalid>", 'B <b@xxx.invalid>' ]
    },
    { recipients: "A (this: is, a comment;) <a.invalid>; g:   (this: is, <a> comment;) C <c.invalid>, d.invalid;",
      emailAddressOnly: false,
      count: 3,
      result: [ '"A (this: is, a comment;)" <a.invalid>', '"g: (this: is, <a> comment;) C" <c.invalid>', "d.invalid" ]
    },
    { recipients: 'Mary Smith <mary@x.invalid>, extra:;, group:jdoe@example.invalid; Who? <one@y.invalid>; <boss@nil.invalid>, "Giant; \"Big\" Box" <sysservices@example.invalid>,         ',
      emailAddressOnly: false,
      count: 6,
      result: [ "Mary Smith <mary@x.invalid>", "extra:;", "group:jdoe@example.invalid;", "Who? <one@y.invalid>", "boss@nil.invalid", '"Giant; \"Big\" Box" <sysservices@example.invalid>' ]
      },
    { recipients: 'Undisclosed recipients: a@foo.invalid ;;extra:;',
      emailAddressOnly: true,
      count: 2,
      result: [ '\"Undisclosed recipients: a\"@foo.invalid ;', 'extra:;' ]
    },
    { recipients: 'Undisclosed recipients:;;extra:a@foo.invalid;',
      emailAddressOnly: true,
      count: 2,
      result: [ '\"Undisclosed recipients:;\"', 'extra:a@foo.invalid;' ]
    },
    { recipients: "",
      emailAddressOnly: false,
      count: 0,
      result: []
    } ];

function run_test() {
  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);

  // As most of SplitRecipients functionality is in the nsIMsgHeaderParser
  // functionality, here (at least initially), we're just interested in checking
  // the basic argument/return combinations.

  for (var part = 0; part < splitRecipientsTests.length; ++part) {
    var count = {};
    print("Test: " + splitRecipientsTests[part].recipients);
    var result = fields.splitRecipients(splitRecipientsTests[part].recipients,
                                        splitRecipientsTests[part].emailAddressOnly,
                                        count);

    do_check_eq(splitRecipientsTests[part].count, count.value);
    do_check_eq(splitRecipientsTests[part].count, result.length);

    for (var item = 0; item < count.value; ++item)
      do_check_eq(splitRecipientsTests[part].result[item], result[item]);
  }
}
